const std = @import("std");
const pg = @import("pg");
const zlog = @import("zlog");
const lib = @import("pokebin_lib");

pub const Pool = struct {
    allocator: std.mem.Allocator,
    pool: *pg.Pool,
    paste_count: std.atomic.Value(usize),

    pub fn deinit(self: *Pool) void {
        self.pool.deinit();
        self.allocator.destroy(self);
    }

    pub fn getCountFromDB(self: *Pool) !usize {
        const result = try self.pool.query("SELECT COUNT(*) FROM pastes;", .{});
        defer result.deinit();
        const row: pg.Row = try result.next() orelse return error.NoRows;
        const total = row.get(?i64, 0);
        if (total) |t| {
            return @intCast(t);
        }
        return 0;
    }

    pub fn getCount(self: *Pool) !usize {
        return self.paste_count.load(.seq_cst);
    }

    pub fn getUUID(self: *Pool, uuid: []const u8) ![]const u8 {
        const result = try self.pool.query("SELECT content FROM pastes WHERE uuid = $1;", .{uuid});
        defer result.deinit();
        const row: pg.Row = try result.next() orelse return error.NoRows;
        return try self.allocator.dupe(u8, row.get([]u8, 0));
    }

    pub fn uuidExists(self: *Pool, uuid: []const u8) !bool {
        const result = try self.pool.query("SELECT EXISTS(SELECT 1 FROM pastes WHERE uuid = $1);", .{uuid});
        defer result.deinit();
        const row = try result.next() orelse return error.NoRows;
        return row.get(bool, 0);
    }

    pub fn hashExists(self: *Pool, hash: []const u8) ![]const u8 {
        const result = try self.pool.query("SELECT uuid FROM pastes WHERE content_hash = $1;", .{hash});
        defer result.deinit();
        const row = try result.next() orelse return error.NoRows;
        const uuid = try self.allocator.dupe(u8, row.get([]u8, 0));
        return uuid;
    }

    pub fn savePaste(
        self: *Pool,
        uuid: []const u8,
        data: []const u8,
        hash: []const u8,
    ) !void {
        const value = try self.pool.exec("INSERT INTO pastes (uuid, content_hash, content) VALUES ($1, $2, $3);", .{ uuid, hash, data });
        if (value) |v| {
            if (v != 1) {
                return error.DBError;
            }
            _ = self.paste_count.fetchAdd(1, .seq_cst);
        } else {
            return error.DBError;
        }
    }

    pub fn logFeatureUsage(
        self: *Pool,
        paste_id: []const u8,
        feature: []const u8,
    ) !void {
        _ = try self.pool.exec("INSERT INTO feature_usage (feature, paste_id) VALUES ($1, $2);", .{ feature, paste_id });
    }
};

pub fn initDB(
    allocator: std.mem.Allocator,
    config: lib.DBConfig,
) !*Pool {
    const pool = try pg.Pool.init(allocator, .{ .size = 5, .connect = .{
        .port = config.port,
        .host = config.host,
    }, .auth = .{
        .username = config.user,
        .password = config.pass,
        .database = "pokebin",
        .timeout = 10_000,
    } });

    // If the pastes table doesn't exist, we will create it.
    const create_table_query =
        \\
        \\ CREATE TABLE IF NOT EXISTS pastes (
        \\  uuid text PRIMARY KEY,
        \\  content jsonb NOT NULL,
        \\  content_hash text NOT NULL,
        \\  created_at timestamptz NOT NULL DEFAULT NOW()
        \\ );
        \\ 
        \\ CREATE TABLE IF NOT EXISTS feature_usage (
        \\   id integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
        \\   feature text NOT NULL,
        \\   timestamp timestamptz NOT NULL DEFAULT NOW(),
        \\   paste_id text REFERENCES pastes(uuid) ON DELETE CASCADE
        \\ );
    ;
    _ = try pool.exec(create_table_query, .{});

    const psqlPool = try allocator.create(Pool);
    psqlPool.* = Pool{
        .allocator = allocator,
        .pool = pool,
        .paste_count = std.atomic.Value(usize).init(0),
    };

    psqlPool.paste_count.store(try psqlPool.getCountFromDB(), .seq_cst);
    return psqlPool;
}
