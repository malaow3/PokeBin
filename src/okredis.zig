const std = @import("std");
const zlog = @import("zlog");
const okredis = @import("okredis");

pub const types = okredis.types;
pub const Dynamic = types.DynamicReply;
pub const FixBuf = types.FixBuf;
pub const OrErr = types.OrErr;

pub const RedisConfig = struct {
    host: []const u8,
    port: u16,
    user: []const u8,
    pass: []const u8,
};

const Client = struct {
    c: okredis.Client,
    last_use: i64,

    fn close(self: *Client) void {
        self.c.close();
    }
};

pub const RedisPool = struct {
    const Self = @This();

    allocator: std.mem.Allocator,
    config: RedisConfig,
    connections: []*Client,
    shutdown: bool,
    available: usize,
    mutex: std.Thread.Mutex,
    cond: std.Thread.Condition,
    timeout: u32 = 10 * std.time.ms_per_s,

    pub fn freeResponse(self: *Self, reply: anytype, allocator: ?std.mem.Allocator) void {
        if (allocator) |alloc| {
            okredis.freeReply(reply, alloc);
        } else {
            okredis.freeReply(reply, self.allocator);
        }
    }

    pub fn init(allocator: std.mem.Allocator, config: *RedisConfig, max_connections: usize) !Self {
        const conns = try allocator.alloc(*Client, max_connections);
        errdefer allocator.free(conns);

        var initialized: usize = 0;
        errdefer {
            for (0..initialized) |i| {
                conns[i].close();
                allocator.destroy(conns[i]);
            }
        }

        for (0..max_connections) |i| {
            const conn = try allocator.create(Client);
            errdefer allocator.destroy(conn);

            // const tcp = try std.net.tcpConnectToAddress(address);
            const tcp = try std.net.tcpConnectToHost(allocator, config.host, config.port);
            var connStruct: okredis.Client = undefined;
            try connStruct.init(
                tcp,
                .{
                    .auth = .{
                        .user = config.user,
                        .pass = config.pass,
                    },
                },
            );

            conn.* = Client{
                .c = connStruct,
                .last_use = std.time.milliTimestamp(),
            };

            conns[i] = conn;
            initialized += 1;
        }

        const pool = Self{
            .allocator = allocator,
            .config = config.*,
            .connections = conns,
            .mutex = std.Thread.Mutex{},
            .cond = std.Thread.Condition{},
            .shutdown = false,
            .available = max_connections,
        };

        return pool;
    }

    pub fn deinit(self: *Self) void {
        const conns = self.connections;
        self.mutex.lock();
        self.shutdown = true;

        self.cond.broadcast();
        while (true) {
            if (self.available == conns.len) {
                break;
            }
            self.cond.wait(&self.mutex);
        }
        self.mutex.unlock();

        const allocator = self.allocator;
        for (conns) |conn| {
            conn.close();
            allocator.destroy(conn);
        }
        allocator.free(self.connections);
        allocator.destroy(self);
    }

    fn isValid(conn: *okredis.Client) bool {
        const response = conn.send(OrErr(FixBuf(6)), .{"PING"}) catch {
            return false;
        };

        switch (response) {
            .Ok => |reply| {
                if (std.mem.eql(u8, reply.toSlice(), "PONG")) {
                    return true;
                }
                return false;
            },
            else => {
                return false;
            },
        }
    }

    pub fn acquire(self: *Self) !*Client {
        const conns = self.connections;

        self.mutex.lock();
        errdefer self.mutex.unlock();
        while (true) {
            if (self.shutdown) {
                return error.PoolShuttingDown;
            }
            const available = self.available;
            if (available == 0) {
                try self.cond.timedWait(&self.mutex, self.timeout);
                continue;
            }
            const index = available - 1;
            var conn = conns[index];

            const now = std.time.milliTimestamp();
            const five_min = 5 * 60 * 1000;
            if (conn.c.broken or !isValid(&conn.c) or now - conn.last_use > five_min) {
                conn.close();

                const tcp = try std.net.tcpConnectToHost(self.allocator, self.config.host, self.config.port);

                var connStruct: okredis.Client = undefined;
                try connStruct.init(
                    tcp,
                    .{
                        .auth = .{
                            .user = self.config.user,
                            .pass = self.config.pass,
                        },
                    },
                );
                conn.* = Client{
                    .c = connStruct,
                    .last_use = now,
                };
            }

            self.available = index;
            self.mutex.unlock();

            return conn;
        }
    }

    pub fn release(self: *Self, conn: *Client) void {
        var conns = self.connections;

        if (conn.c.broken) {
            conn.close();

            const tcp = std.net.tcpConnectToHost(self.allocator, self.config.host, self.config.port) catch {
                @panic("Failed to connect to redis");
            };
            var connStruct: okredis.Client = undefined;

            connStruct.init(
                tcp,
                .{
                    .auth = .{
                        .user = self.config.user,
                        .pass = self.config.pass,
                    },
                },
            ) catch {
                @panic("Failed to connect to redis");
            };
            conn.* = Client{
                .c = connStruct,
                .last_use = std.time.milliTimestamp(),
            };
        }

        self.mutex.lock();
        const available = self.available;
        conns[available] = conn;
        self.available = available + 1;
        self.mutex.unlock();

        self.cond.signal();
    }

    pub fn send(self: *Self, comptime ResultType: type, args: anytype) !ResultType {
        const conn = try self.acquire();
        defer self.release(conn);

        return try conn.c.send(ResultType, args);
    }

    pub fn sendAlloc(self: *Self, comptime ResultType: type, allocator: ?std.mem.Allocator, args: anytype) !ResultType {
        const conn = try self.acquire();
        defer self.release(conn);

        if (allocator) |alloc| {
            return try conn.c.sendAlloc(ResultType, alloc, args);
        } else {
            return try conn.c.sendAlloc(ResultType, self.allocator, args);
        }
    }

    // Core operations
    pub fn get(self: *Self, comptime ResultType: type, key: []const u8) !ResultType {
        return try self.send(ResultType, .{ "GET", key });
    }

    pub fn getAlloc(self: *Self, comptime ResultType: type, allocator: std.mem.Allocator, key: []const u8) !ResultType {
        return try self.sendAlloc(ResultType, allocator, .{ "GET", key });
    }

    pub fn set(self: *Self, comptime ResultType: type, key: []const u8, value: []const u8) !ResultType {
        return try self.send(ResultType, .{ "SET", key, value });
    }

    pub fn exists(self: *Self, key: []const u8) !bool {
        const reply: i32 = try self.send(i32, .{ "EXISTS", key });
        return reply == 1;
    }

    pub fn ping(self: *Self) ![]u8 {
        const reply: []u8 = try self.send([]u8, .{"PING"});
        return reply;
    }
};
