const std = @import("std");

var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
pub const allocator = arena.allocator();

extern "env" fn _throwError(pointer: [*]const u8, length: u32) noreturn;
extern "env" fn _consoleLog(pointer: [*]const u8, length: u32) void;

pub fn throwError(message: []const u8) noreturn {
    _throwError(message.ptr, message.len);
}

const RndGen = std.Random.DefaultPrng;
pub var rand: ?*std.Random.DefaultPrng = null;

export fn init(seed: u64) void {
    var rand_inst = RndGen.init(seed);
    rand = &rand_inst;
}

pub fn getRand() ?*std.Random.DefaultPrng {
    return rand;
}

pub fn consoleLog(comptime fmt: []const u8, args: anytype) void {
    const msg = std.fmt.allocPrint(allocator, fmt, args) catch
        @panic("failed to allocate memory for consoleLog message");
    defer allocator.free(msg);
    _consoleLog(msg.ptr, msg.len);
}

pub export fn allocUint8(length: u32) [*]const u8 {
    const slice = allocator.alloc(u8, length) catch
        @panic("failed to allocate memory");
    return slice.ptr;
}

export fn free(pointer: u32, length: u32) void {
    const slice: [*]u8 = @ptrFromInt(pointer);
    return allocator.free(slice[0..length]);
}

// Reset the arena
pub export fn resetArena() void {
    arena.deinit();
    arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
}

pub fn destroy(comptime T: type, pointer: u32) void {
    const ptr: *T = @ptrFromInt(pointer);
    allocator.destroy(ptr);
}
