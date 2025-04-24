const std = @import("std");
const httpz = @import("httpz");
const state = @import("state.zig");
const websocket = httpz.websocket;
const zlog = @import("zlog");

pub const Client = struct {
    conn: *websocket.Conn,
    appState: *state.State,

    pub const Context = struct {
        appState: *state.State,
    };

    pub fn init(conn: *websocket.Conn, ctx: *const Context) !Client {
        const client_ptr = try ctx.appState.allocator.create(Client);
        client_ptr.* = Client{
            .conn = conn,
            .appState = ctx.appState,
        };

        return client_ptr.*;
    }

    pub fn afterInit(client: *Client) !void {
        client.appState.conn_rwlock.lock();
        client.appState.connections += 1;
        client.appState.conn_rwlock.unlock();
    }

    const Message = struct {
        action: []const u8,
        data: ?[]const u8,
    };

    pub fn clientMessage(self: *Client, data: []const u8) !void {
        _ = self;
        _ = data;
    }

    pub fn close(self: *Client) void {
        self.appState.conn_rwlock.lock();
        self.appState.connections -= 1;
        self.appState.conn_rwlock.unlock();
    }
};
