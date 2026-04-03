const std = @import("std");

pub const Error = error{
    NotPng,
    InvalidPngChunk,
    MissingIhdr,
    CropLargerThanImage,
    UnsupportedInterlace,
    UnsupportedBitDepth,
};

const ColorType = enum(u8) {
    grayscale = 0,
    truecolor = 2,
    indexed = 3,
    grayscale_alpha = 4,
    truecolor_alpha = 6,

    pub fn channels(c: @This()) usize {
        return switch (c) {
            .grayscale => 1,
            .truecolor => 3,
            .indexed => 1,
            .grayscale_alpha => 2,
            .truecolor_alpha => 4,
        };
    }
};

const Filter = enum(u8) {
    None = 0,
    Sub = 1,
    Up = 2,
    Average = 3,
    Paeth = 4,
};

/// Crop a PNG file in-place. Removes `crop_right` pixels from the right edge.
pub fn cropFile(allocator: std.mem.Allocator, io: std.Io, img_file: []const u8, crop_right: u32) !void {
    const cwd = std.Io.Dir.cwd();
    const file = try cwd.openFile(io, img_file, .{});
    defer file.close(io);

    var read_buf: [8192]u8 = undefined;
    var rdr = file.reader(io, &read_buf);
    const data = try rdr.interface.readAlloc(allocator, 50 * 1024 * 1024);
    defer allocator.free(data);

    const cropped = try crop(allocator, data, 0, 0, crop_right, 0);
    defer allocator.free(cropped);

    const tmp_file = try std.fmt.allocPrint(allocator, "{s}.tmp", .{img_file});
    defer allocator.free(tmp_file);

    {
        const tmp = try cwd.createFile(io, tmp_file, .{});
        defer tmp.close(io);
        try tmp.writeStreamingAll(io, cropped);
    }
    try std.Io.Dir.rename(cwd, tmp_file, cwd, img_file, io);
}

/// Crop a PNG from raw bytes. Cropping is specified as pixels to remove from each edge.
pub fn crop(
    allocator: std.mem.Allocator,
    data: []const u8,
    top: u32,
    left: u32,
    right: u32,
    bottom: u32,
) Error![]u8 {
    const png_sig = [8]u8{ 137, 80, 78, 71, 13, 10, 26, 10 };
    if (data.len < 8 or !std.mem.eql(u8, data[0..8], &png_sig))
        return Error.NotPng;

    var ihdr_payload: ?[]const u8 = null;
    var idat_buf: std.ArrayList(u8) = .empty;
    defer idat_buf.deinit(allocator);

    var offset: usize = 8;
    while (offset + 8 <= data.len) {
        const chunk_len = std.mem.readInt(u32, data[offset..][0..4], .big);
        const chunk_type = data[offset + 4 .. offset + 8];
        offset += 8;

        if (offset + chunk_len > data.len) return Error.InvalidPngChunk;

        const payload = data[offset .. offset + chunk_len];
        offset += chunk_len + 4; // skip CRC

        if (std.mem.eql(u8, chunk_type, "IHDR")) ihdr_payload = payload;
        if (std.mem.eql(u8, chunk_type, "IDAT")) idat_buf.appendSlice(allocator, payload) catch return Error.InvalidPngChunk;
        if (std.mem.eql(u8, chunk_type, "IEND")) break;
    }

    const ihdr = ihdr_payload orelse return Error.MissingIhdr;
    if (idat_buf.items.len == 0) return Error.InvalidPngChunk;

    const width = std.mem.readInt(u32, ihdr[0..4], .big);
    const height = std.mem.readInt(u32, ihdr[4..8], .big);
    const bit_depth_u8 = ihdr[8];
    const color_type_val = ihdr[9];
    const interlace = ihdr[12];

    if (interlace != 0) return Error.UnsupportedInterlace;
    if (bit_depth_u8 != 8) return Error.UnsupportedBitDepth;

    const color_type: ColorType = @enumFromInt(color_type_val);
    const ch = color_type.channels();
    const bpp = ch * (bit_depth_u8 / 8);

    const out_width = width - left - right;
    const out_height = height - top - bottom;
    if (out_width == 0 or out_height == 0) return Error.CropLargerThanImage;

    const src_row_bytes = bpp * width;
    const dst_row_bytes = bpp * out_width;

    // Decompress zlib IDAT
    var in_reader = std.Io.Reader.fixed(idat_buf.items);
    var decomp_buf: [std.compress.flate.max_window_len]u8 = undefined;
    var decomp = std.compress.flate.Decompress.init(&in_reader, .zlib, &decomp_buf);
    var raw_pixels: std.ArrayList(u8) = .empty;
    defer raw_pixels.deinit(allocator);
    // Read decompressed data
    {
        var raw_writer = std.Io.Writer.fromArrayList(&raw_pixels);
        _ = decomp.reader.streamRemaining(&raw_writer) catch return Error.InvalidPngChunk;
        raw_pixels = std.Io.Writer.toArrayList(&raw_writer);
    }

    // Allocate row buffers once
    var this_row = allocator.alloc(u8, src_row_bytes) catch return Error.InvalidPngChunk;
    defer allocator.free(this_row);
    const above_row = allocator.alloc(u8, src_row_bytes) catch return Error.InvalidPngChunk;
    defer allocator.free(above_row);
    @memset(above_row, 0);

    // Un-filter, crop, re-filter with None
    var cropped_pixels: std.ArrayList(u8) = .empty;
    defer cropped_pixels.deinit(allocator);

    for (0..height) |y| {
        const row_start = y * (src_row_bytes + 1);
        const filt_row = raw_pixels.items[row_start .. row_start + 1 + src_row_bytes];
        const filt_type: Filter = @enumFromInt(filt_row[0]);
        const filt_data = filt_row[1..];

        if (y > 0) @memcpy(above_row, this_row);

        unfilterRow(this_row, filt_data, above_row, bpp, filt_type);

        if (y < top) continue;
        if (y >= height - bottom) continue;

        const cropped_row = this_row[left * bpp .. left * bpp + dst_row_bytes];
        cropped_pixels.append(allocator, @intFromEnum(Filter.None)) catch return Error.InvalidPngChunk;
        cropped_pixels.appendSlice(allocator, cropped_row) catch return Error.InvalidPngChunk;
    }

    // Recompress zlib
    var out_buf: std.ArrayList(u8) = .empty;
    defer out_buf.deinit(allocator);
    {
        var out_writer = std.Io.Writer.fromArrayList(&out_buf);
        var zlib_buf: [std.compress.flate.max_window_len]u8 = undefined;
        var comp = std.compress.flate.Compress.init(&out_writer, &zlib_buf, .zlib, .default) catch return Error.InvalidPngChunk;
        comp.writer.writeAll(cropped_pixels.items) catch return Error.InvalidPngChunk;
        comp.finish() catch return Error.InvalidPngChunk;
        out_buf = std.Io.Writer.toArrayList(&out_writer);
    }

    // Build PNG
    var png: std.ArrayList(u8) = .empty;
    png.appendSlice(allocator, &png_sig) catch return Error.InvalidPngChunk;

    // Build IHDR payload
    var new_ihdr_bytes: [13]u8 = undefined;
    std.mem.writeInt(u32, new_ihdr_bytes[0..4], out_width, .big);
    std.mem.writeInt(u32, new_ihdr_bytes[4..8], out_height, .big);
    @memcpy(new_ihdr_bytes[8..13], ihdr[8..13]);
    writePngChunk(allocator, &png, "IHDR", &new_ihdr_bytes);

    writePngChunk(allocator, &png, "IDAT", out_buf.items);
    writePngChunk(allocator, &png, "IEND", &.{});

    return png.toOwnedSlice(allocator) catch return Error.InvalidPngChunk;
}

fn writePngChunk(allocator: std.mem.Allocator, png: *std.ArrayList(u8), chunk_type: []const u8, payload: []const u8) void {
    var len_buf: [4]u8 = undefined;
    std.mem.writeInt(u32, &len_buf, @intCast(payload.len), .big);
    png.appendSlice(allocator, &len_buf) catch unreachable;
    png.appendSlice(allocator, chunk_type) catch unreachable;
    png.appendSlice(allocator, payload) catch unreachable;
    var crc = std.hash.Crc32.init();
    crc.update(chunk_type);
    crc.update(payload);
    var crc_buf: [4]u8 = undefined;
    std.mem.writeInt(u32, &crc_buf, crc.final(), .big);
    png.appendSlice(allocator, &crc_buf) catch unreachable;
}

fn unfilterRow(row: []u8, filtered: []const u8, above_row: []const u8, bpp: usize, filter: Filter) void {
    switch (filter) {
        .None => @memcpy(row, filtered),
        .Sub => {
            for (0..row.len) |i| {
                const a = if (i >= bpp) row[i - bpp] else 0;
                row[i] = filtered[i] +% a;
            }
        },
        .Up => {
            for (0..row.len) |i| {
                const b = if (i < above_row.len) above_row[i] else 0;
                row[i] = filtered[i] +% b;
            }
        },
        .Average => {
            for (0..row.len) |i| {
                const a = if (i >= bpp) row[i - bpp] else 0;
                const b = if (i < above_row.len) above_row[i] else 0;
                row[i] = filtered[i] +% @as(u8, @truncate((@as(u16, a) + b) / 2));
            }
        },
        .Paeth => {
            for (0..row.len) |i| {
                const a = if (i >= bpp) row[i - bpp] else 0;
                const b = if (i < above_row.len) above_row[i] else 0;
                const c = if (i >= bpp and i < above_row.len) above_row[i - bpp] else 0;
                row[i] = filtered[i] +% paethPredictor(a, b, c);
            }
        },
    }
}

fn paethPredictor(a: u8, b: u8, c: u8) u8 {
    const pa: i32 = @intCast(a);
    const pb: i32 = @intCast(b);
    const pc: i32 = @intCast(c);
    const p = pa + pb - pc;
    const da = @abs(p - pa);
    const db = @abs(p - pb);
    const dc = @abs(p - pc);
    if (da <= db and da <= dc) return a;
    if (db <= dc) return b;
    return c;
}
