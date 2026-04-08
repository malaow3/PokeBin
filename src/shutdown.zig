const std = @import("std");
const builtin = @import("builtin");
const httpz = @import("httpz");
const main = @import("main.zig");

fn shutdown(_: std.c.SIG) callconv(.c) void {
    if (main.server_instance) |server| {
        main.server_instance = null;
        server.stop();
    }
    // Force exit to avoid hanging on CLOSE_WAIT connections or pool cleanup.
    std.process.exit(0);
}

pub fn initSigHandler() void {
    if (builtin.os.tag == .windows) {
        const handler_routine = struct {
            fn handler_routine(dwCtrlType: std.os.windows.DWORD) callconv(std.os.windows.WINAPI) std.os.windows.BOOL {
                if (dwCtrlType == std.os.windows.CTRL_C_EVENT) {
                    shutdown(0);
                    return std.os.windows.TRUE;
                } else {
                    return std.os.windows.FALSE;
                }
            }
        }.handler_routine;
        try std.os.windows.SetConsoleCtrlHandler(handler_routine, true);
    } else {
        std.posix.sigaction(std.posix.SIG.INT, &.{
            .handler = .{ .handler = shutdown },
            .mask = std.posix.sigemptyset(),
            .flags = 0,
        }, null);
        std.posix.sigaction(std.posix.SIG.TERM, &.{
            .handler = .{ .handler = shutdown },
            .mask = std.posix.sigemptyset(),
            .flags = 0,
        }, null);
    }
}
