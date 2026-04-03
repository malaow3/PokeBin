const std = @import("std");
const builtin = @import("builtin");
const c = @cImport({
    @cInclude("brotli/encode.h");
});

const png_utils = @import("png_utils.zig");


pub fn compressData(allocator: std.mem.Allocator, data: []const u8) ![]u8 {
    // Estimate max compressed size (Brotli doc: worst case is input + 600 bytes)
    const max_compressed_size = data.len + 600;
    var compressed = try allocator.alloc(u8, max_compressed_size);

    var out_size: usize = max_compressed_size;

    const ok = c.BrotliEncoderCompress(
        c.BROTLI_DEFAULT_QUALITY, // quality: 0..11 (default 11 is slowest/best)
        c.BROTLI_DEFAULT_WINDOW, // window: 10..24 (default 22)
        c.BROTLI_MODE_GENERIC, // mode: GENERIC, TEXT, FONT
        data.len, // input size
        data.ptr, // input buffer
        &out_size, // in/out: output size
        compressed.ptr, // output buffer
    );

    if (ok != 1) {
        allocator.free(compressed);
        return error.CompressionFailed;
    }

    // Shrink to actual size
    const result = try allocator.alloc(u8, out_size);
    @memcpy(result.ptr, compressed[0..out_size]);
    allocator.free(compressed);

    return result;
}

pub fn cropImage(allocator: std.mem.Allocator, io: std.Io, img_file: []const u8) !void {
    try png_utils.cropFile(allocator, io, img_file, 200);
}


pub fn generateScreenshot(allocator: std.mem.Allocator, io: std.Io, id: []const u8) !void {
    const cwd = std.Io.Dir.cwd();
    const exe = switch (builtin.os.tag) {
        .linux, .macos => "bun",
        .windows => "bun.exe",
        else => @panic("Unsupported OS"),
    };

    const file = try cwd.realPathFileAlloc(io, "screenshot/index.ts", allocator);
    defer allocator.free(file);

    var child = try std.process.spawn(io, .{
        .argv = &[_][]const u8{
            exe,
            file,
            id,
        },
    });
    _ = try child.wait(io);
}
