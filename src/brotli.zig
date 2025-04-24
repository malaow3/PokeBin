const std = @import("std");

pub fn compressWithBrotli(
    allocator: std.mem.Allocator,
    input_file_path: []const u8,
    compressed_file_path: []const u8,
) !void {
    var child = std.process.Child.init(&[_][]const u8{
        "brotli", "-f", "-o", compressed_file_path, input_file_path,
    }, allocator);
    const term = try child.spawnAndWait();
    if (term.Exited != 0) {
        return error.CompressionFailed;
    }
}
