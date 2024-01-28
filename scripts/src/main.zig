const std = @import("std");

pub fn main() !void {
    var allocator = std.heap.page_allocator;

    // Open the file in read-write mode.
    var file = try std.fs.cwd().openFile("../data/items.js", .{ .mode = .read_write });
    defer file.close();

    // Get file size.
    const file_stat = try file.stat();
    const file_size = file_stat.size;

    // Allocate a buffer exactly for the file size.
    var file_contents_buf = try allocator.alloc(u8, file_size);
    defer allocator.free(file_contents_buf);

    // Read the file into the buffer.
    const actual_size = try file.reader().readAll(file_contents_buf);

    file_contents_buf = file_contents_buf;
    _ = actual_size;

    // Split the string on the " = " delimiter.
    var items = std.mem.split(u8, file_contents_buf, " = "); // 'const' removed from here

    _ = items.next();
    const data = items.next().?;

    // Remove the final ";\n" from the data.
    const data_without_semicolon = data[0 .. data.len - 2];

    // Format the data to JSON.
    const formatted_data = try formatToJSON(allocator, data_without_semicolon);

    // Write the formatted data to a new file.
    const new_file = try std.fs.cwd().createFile("items.json", .{});
    defer new_file.close();

    try new_file.writer().writeAll(formatted_data);
}

fn formatToJSON(allocator: std.mem.Allocator, data: []const u8) ![]u8 {
    // Copy the data to a new buffer.
    var builder = std.ArrayList(u8).init(allocator);
    defer builder.deinit();

    var is_key = false;
    var is_start_of_key_or_value = true;
    var inside_quotes = false;

    for (data) |byte| {
        switch (byte) {
            ':' => {
                if (inside_quotes) {
                    try builder.append(':');
                    continue;
                }
                if (is_key) {
                    try builder.append('"');
                    try builder.append(':');
                    is_key = false;
                    is_start_of_key_or_value = true;
                } else {
                    try builder.append(':');
                }
            },
            ',' => {
                try builder.append(',');
                if (inside_quotes) {
                    continue;
                }
                if (!is_key) {
                    is_key = true;
                    is_start_of_key_or_value = true;
                }
            },
            '{' => {
                try builder.append('{');
                is_key = true;
                is_start_of_key_or_value = true;
            },
            '[' => {
                try builder.append('[');
                is_key = false;
                is_start_of_key_or_value = true;
            },
            ']' => {
                try builder.append(']');
            },
            '"' => {
                if (inside_quotes) {
                    inside_quotes = false;
                } else {
                    inside_quotes = true;
                }
                try builder.append('"');
            },
            else => {
                if (inside_quotes) {
                    try builder.append(byte);
                    continue;
                }
                if (is_start_of_key_or_value and is_key) {
                    try builder.append('"');
                    is_start_of_key_or_value = false;
                }
                try builder.append(byte);
            },
        }
    }

    return builder.toOwnedSlice();
}
