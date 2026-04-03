const std = @import("std");
const zul = @import("zul");

// For a 16 character hexadecimal string, the chance of a collision between 10 million generated
// values is ~ 0.000271%
pub fn uuidToPasteID(uuid: zul.UUID) [16]u8 {
    var result: [16]u8 = undefined;
    const uuidHex: [36]u8 = uuid.toHex(.lower);
    @memcpy(result[0..8], uuidHex[0..8]);
    @memcpy(result[8..12], uuidHex[9..13]);
    @memcpy(result[12..16], uuidHex[14..18]);
    return result;
}

pub const DBConfig = struct {
    host: []const u8 = "",
    port: u16 = 0,
    user: []const u8 = "",
    pass: []const u8 = "",
};

pub const EnvConfig = struct {
    db_config: DBConfig = .{},
    webhook: []const u8 = "",
    live_offset: usize = 0,
    total_offset: usize = 0,
};

pub fn parseEnv(allocator: std.mem.Allocator, io: std.Io, envmap: *std.process.Environ.Map) !EnvConfig {
    const cwd = std.Io.Dir.cwd();
    var env_file_exists = true;
    cwd.access(io, ".env", .{}) catch {
        env_file_exists = false;
    };
    var envConfig = EnvConfig{};
    var dbConfig = DBConfig{};

    if (env_file_exists) {
        const env = try cwd.openFile(io, ".env", .{});
        defer env.close(io);

        var file_buf: [1024]u8 = undefined;
        var file_reader = env.reader(io, &file_buf);
        var reader = &file_reader.interface;
        const fileData = try reader.allocRemaining(allocator, .unlimited);

        var lines = std.mem.splitAny(u8, fileData, "\n");
        while (lines.next()) |line| {
            if (std.mem.eql(u8, line, "")) {
                continue;
            }
            var items = std.mem.splitScalar(u8, line, '=');
            const key = std.mem.trim(u8, items.next().?, " ");
            const value = std.mem.trim(u8, items.next().?, " ");

            if (std.mem.eql(u8, key, "DB_HOST")) {
                dbConfig.host = try allocator.dupe(u8, value);
            } else if (std.mem.eql(u8, key, "DB_PORT")) {
                dbConfig.port = try std.fmt.parseUnsigned(u16, value, 10);
            } else if (std.mem.eql(u8, key, "DB_USER")) {
                dbConfig.user = try allocator.dupe(u8, value);
            } else if (std.mem.eql(u8, key, "DB_PASS")) {
                dbConfig.pass = try allocator.dupe(u8, value);
            } else if (std.mem.eql(u8, key, "DISCORD_WEBHOOK")) {
                envConfig.webhook = try allocator.dupe(u8, value);
            } else if (std.mem.eql(u8, key, "LIVE_OFFSET")) {
                envConfig.live_offset = try std.fmt.parseUnsigned(usize, value, 10);
            } else if (std.mem.eql(u8, key, "TOTAL_OFFSET")) {
                envConfig.total_offset = try std.fmt.parseUnsigned(usize, value, 10);
            }
        }
        allocator.free(fileData);
    } else {
        envConfig.webhook = envmap.get("DISCORD_WEBHOOK") orelse "";
        envConfig.live_offset = try std.fmt.parseUnsigned(usize, envmap.get("LIVE_OFFSET") orelse "0", 10);
        envConfig.total_offset = try std.fmt.parseUnsigned(usize, envmap.get("TOTAL_OFFSET") orelse "0", 10);
        dbConfig.host = envmap.get("DB_HOST") orelse "";
        dbConfig.port = try std.fmt.parseUnsigned(u16, envmap.get("DB_PORT") orelse "0", 10);
        dbConfig.user = envmap.get("DB_USER") orelse "";
        dbConfig.pass = envmap.get("DB_PASS") orelse "";
    }

    envConfig.db_config = dbConfig;

    return envConfig;
}
