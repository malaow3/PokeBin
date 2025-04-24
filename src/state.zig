const lib = @import("pokebin_lib");
const std = @import("std");
const httpz = @import("httpz");
const redis = @import("redis");
const zlog = @import("zlog");
const zul = @import("zul");
const ws = @import("ws.zig");
const utils = @import("utils.zig");

const CachedFile = struct {
    data: []u8,
    compressed_data: ?[]u8 = null,
    content_type: httpz.ContentType,
    last_modified: i128,
};

pub fn getMimeType(filename: []const u8) ?httpz.ContentType {
    const ext = std.fs.path.extension(filename);
    if (std.mem.eql(u8, ext, ".wasm")) return httpz.ContentType.WASM;
    if (std.mem.eql(u8, ext, ".js")) return httpz.ContentType.JS;
    if (std.mem.eql(u8, ext, ".json")) return httpz.ContentType.JSON;
    if (std.mem.eql(u8, ext, ".css")) return httpz.ContentType.CSS;
    if (std.mem.eql(u8, ext, ".html")) return httpz.ContentType.HTML;
    if (std.mem.eql(u8, ext, ".txt")) return httpz.ContentType.TEXT;
    if (std.mem.eql(u8, ext, ".svg")) return httpz.ContentType.SVG;
    if (std.mem.eql(u8, ext, ".png")) return httpz.ContentType.PNG;
    if (std.mem.eql(u8, ext, ".jpg")) return httpz.ContentType.JPG;
    if (std.mem.eql(u8, ext, ".jpeg")) return httpz.ContentType.JPG;
    if (std.mem.eql(u8, ext, ".gif")) return httpz.ContentType.GIF;
    if (std.mem.eql(u8, ext, ".ico")) return httpz.ContentType.ICO;
    if (std.mem.eql(u8, ext, ".xml")) return httpz.ContentType.XML;
    if (std.mem.eql(u8, ext, ".ttf")) return httpz.ContentType.TTF;
    if (std.mem.eql(u8, ext, ".woff")) return httpz.ContentType.WOFF;
    if (std.mem.eql(u8, ext, ".woff2")) return httpz.ContentType.WOFF2;
    return null;
}

pub const State = struct {
    const Self = @This();
    allocator: std.mem.Allocator,
    pool: redis.RedisPool,
    file_cache: std.StringHashMap(CachedFile),
    rwlock: std.Thread.RwLock,
    config: lib.EnvConfig,
    conn_rwlock: std.Thread.RwLock,
    connections: usize,

    pub const WebsocketHandler = ws.Client;

    pub fn init(allocator: std.mem.Allocator, max_connections: ?usize) !State {
        const connections = if (max_connections) |m| m else 10;
        var config = try lib.parseEnv(allocator);
        const redisConfig: *redis.RedisConfig = @ptrCast(&config.db_config);

        return Self{
            .allocator = allocator,
            .pool = try redis.RedisPool.init(allocator, redisConfig, connections),
            .file_cache = std.StringHashMap(CachedFile).init(allocator),
            .rwlock = std.Thread.RwLock{},
            .config = config,
            .conn_rwlock = std.Thread.RwLock{},
            .connections = 0,
        };
    }

    pub fn deinit(self: *State) void {
        self.pool.deinit();
        var iter = self.file_cache.iterator();
        while (iter.next()) |entry| {
            self.allocator.free(entry.key_ptr.*);
            if (entry.value_ptr.compressed_data) |compressed_data| {
                self.allocator.free(compressed_data);
            }
            self.allocator.free(entry.value_ptr.data);
        }
        self.file_cache.deinit();
    }

    fn statusToString(method: httpz.Method) []const u8 {
        switch (method) {
            .GET => return "GET",
            .HEAD => return "HEAD",
            .POST => return "POST",
            .PUT => return "PUT",
            .DELETE => return "DELETE",
            .CONNECT => return "CONNECT",
            .OPTIONS => return "OPTIONS",
            .PATCH => return "PATCH",
            .OTHER => return "OTHER",
        }
    }

    pub fn dispatch(
        self: *Self,
        action: httpz.Action(*Self),
        req: *httpz.Request,
        res: *httpz.Response,
    ) !void {
        const method_string = statusToString(req.method);
        var timer = try std.time.Timer.start();
        action(self, req, res) catch {
            res.status = 500;
            res.body = "Internal Server Error";
            return;
        };
        const elapsed = timer.lap() / 1000;
        if (res.status == 404) {
            zlog.warn(
                "[{d}] {s} {s} - {d}μs",
                .{ res.status, method_string, req.url.path, elapsed },
            );
        } else {
            zlog.info(
                "[{d}] {s} {s} - {d}μs",
                .{ res.status, method_string, req.url.path, elapsed },
            );
        }
    }

    pub fn preloadFile(self: *Self, path: []const u8, content_type: ?httpz.ContentType, precompressed: bool) !void {
        // Load the file
        const cwd = std.fs.cwd();
        const file = try cwd.openFile(path, .{});
        defer file.close();

        // Get file size for better allocation
        const stat = try file.stat();
        const file_size = stat.size;

        // Allocate memory and read file
        const data = try self.allocator.alloc(u8, file_size);
        const bytes_read = try file.readAll(data);
        if (bytes_read != file_size) {
            self.allocator.free(data);
            return error.IncompleteRead;
        }
        const actual_content_type = content_type orelse .BINARY;
        // Compress the data
        var compressed_data: ?[]u8 = null;
        if (file_size > 1024 and shouldCompress(path, actual_content_type)) { // Only compress files > 1KB
            compressed_data = utils.compressData(self.allocator, data) catch null;
        }

        // Create cache entry
        const path_copy = try self.allocator.dupe(u8, path);
        const cached_file = if (!precompressed) CachedFile{
            .data = data,
            .content_type = content_type orelse .BINARY,
            .last_modified = stat.mtime,
            .compressed_data = compressed_data,
        } else CachedFile{
            .data = &[_]u8{},
            .content_type = content_type orelse .BINARY,
            .last_modified = stat.mtime,
            .compressed_data = data,
        };

        // Store in cache
        try self.file_cache.put(path_copy, cached_file);

        zlog.debug("Preloaded file: {s}", .{path});
    }

    pub fn preloadDirectory(self: *Self, dir_path: []const u8) !void {
        const cwd = std.fs.cwd();
        var dir = try cwd.openDir(dir_path, .{ .iterate = true });
        defer dir.close();

        var it = dir.iterate();
        while (try it.next()) |entry| {
            if (entry.kind != .file) continue;

            const full_path = try std.fs.path.join(
                self.allocator,
                &[_][]const u8{ dir_path, entry.name },
            );
            defer self.allocator.free(full_path);

            const content_type = getMimeType(entry.name);
            try self.preloadFile(full_path, content_type);
        }
        zlog.debug("Preloaded directory: {s}", .{dir_path});
    }

    pub fn preloadDirectoryRecursive(self: *Self, dir_path: []const u8, precompressed: bool) !void {
        try self.preloadDirectoryRecursiveInternal(dir_path, dir_path, precompressed);
        zlog.debug("Recursively preloaded directory: {s}", .{dir_path});
    }

    pub fn preloadHTML(self: *Self, dir_path: []const u8) !void {
        // Find all HTML files in the directory
        var dir = try std.fs.cwd().openDir(dir_path, .{ .iterate = true });
        const files = try std.ArrayList([]const u8).init(self.allocator);
        defer files.deinit();
        var walker = try dir.walk();
        while (try walker.next()) |entry| {
            if (entry.kind == .file and std.mem.endsWith(u8, entry.name, ".html")) {
                const file = try dir.openFile(.name, .{});
                defer file.close();

                const file_contents = try std.fs.readToEndAlloc(self.allocator, file, std.math.maxInt(usize));
                var output = try std.mem.replaceOwned(u8, self.allocator, file_contents, "{{GOOGLE_ADSENSE}}", self.config.google_adsense);
                defer self.allocator.free(output);
                while (std.mem.indexOf(u8, output, "{{G_TAG_ID}}") != null) {
                    const old_output = output;
                    output = try std.mem.replaceOwned(u8, self.allocator, output, "{{G_TAG_ID}}", self.config.gtag_id);
                    self.allocator.free(old_output);
                }
                const compressed = utils.compressData(self.allocator, output) catch {
                    return error.CompressionError;
                };

                const filepath = try std.fs.path.join(self.allocator, &[_][]const u8{ dir_path, entry.name });
                try self.file_cache.put(filepath, CachedFile{
                    .data = file_contents,
                    .content_type = .HTML,
                    .last_modified = entry.mtime,
                    .compressed_data = compressed,
                });
            }
        }
    }

    fn preloadDirectoryRecursiveInternal(self: *Self, base_path: []const u8, current_path: []const u8, precompressed: bool) !void {
        const cwd = std.fs.cwd();
        var dir = try cwd.openDir(current_path, .{ .iterate = true });
        defer dir.close();

        var it = dir.iterate();
        while (try it.next()) |entry| {
            const full_path = try std.fs.path.join(
                self.allocator,
                &[_][]const u8{ current_path, entry.name },
            );
            defer self.allocator.free(full_path);

            if (entry.kind == .directory) {
                try self.preloadDirectoryRecursiveInternal(base_path, full_path, precompressed);
            } else if (entry.kind == .file) {
                const content_type = getMimeType(entry.name);
                try self.preloadFile(full_path, content_type, precompressed);
            }
        }
    }

    fn shouldCompress(path: []const u8, content_type: httpz.ContentType) bool {
        // Don't compress already compressed formats
        if (std.mem.eql(u8, std.fs.path.extension(path), ".gz")) return false;
        if (std.mem.eql(u8, std.fs.path.extension(path), ".zip")) return false;
        if (std.mem.eql(u8, std.fs.path.extension(path), ".mp3")) return false;
        if (std.mem.eql(u8, std.fs.path.extension(path), ".mp4")) return false;
        if (std.mem.eql(u8, std.fs.path.extension(path), ".br")) return false;

        // Compress text-based formats and WASM
        return content_type == .HTML or
            content_type == .CSS or
            content_type == .JS or
            content_type == .JSON or
            content_type == .XML or
            content_type == .TEXT or
            content_type == .PNG or
            content_type == .JPG or
            content_type == .WEBP or
            content_type == .WASM;
    }

    pub fn getOrLoadFile(self: *Self, path: []const u8, content_type: ?httpz.ContentType) !CachedFile {
        self.rwlock.lockShared();

        // Load the file
        const cwd = std.fs.cwd();
        const file = cwd.openFile(path, .{}) catch |err| {
            self.rwlock.unlockShared();
            zlog.err("Error opening file: {s} ({})", .{ path, err });
            return err;
        };
        defer file.close();

        // Get file size for better allocation
        const stat = try file.stat();
        const file_size = stat.size;

        const current_mod_time = stat.mtime;

        // Check if file is already cached and up to date
        if (self.file_cache.get(path)) |cached| {
            if (cached.last_modified == current_mod_time) {
                // File hasn't changed, use cached version
                defer self.rwlock.unlockShared();
                return cached;
            }
        }
        self.rwlock.unlockShared();

        // Need to modify the cache, upgrade to write lock
        self.rwlock.lock();
        defer self.rwlock.unlock();
        // Check again inside exclusive lock
        if (self.file_cache.get(path)) |cached| {
            if (cached.last_modified == current_mod_time) {
                return cached;
            }
            // else, remove outdated cache entry
            const old_path = self.file_cache.fetchRemove(path).?.key;
            self.allocator.free(old_path);
            self.allocator.free(cached.data);
            if (cached.compressed_data) |cd| self.allocator.free(cd);
        }

        // Allocate memory and read file
        const data = try self.allocator.alloc(u8, file_size);
        const bytes_read = try file.readAll(data);
        if (bytes_read != file_size) {
            self.allocator.free(data);
            return error.IncompleteRead;
        }
        const actual_content_type = content_type orelse .BINARY;
        // Compress the data
        var compressed_data: ?[]u8 = null;
        if (file_size > 1024 and shouldCompress(path, actual_content_type)) { // Only compress files > 1KB
            compressed_data = utils.compressData(self.allocator, data) catch null;
        }

        // Create cache entry
        const path_copy = try self.allocator.dupe(u8, path);
        const cached_file = CachedFile{
            .data = data,
            .content_type = content_type orelse .BINARY,
            .last_modified = current_mod_time,
            .compressed_data = compressed_data,
        };

        // Store in cache
        try self.file_cache.put(path_copy, cached_file);

        return cached_file;
    }

    fn getFileModTime(path: []const u8) !i128 {
        const cwd = std.fs.cwd();
        const file = try cwd.openFile(path, .{});
        defer file.close();
        const stat = try file.stat();
        return stat.mtime;
    }

    pub fn getNewUUID(self: *State, allocator: std.mem.Allocator) ![]const u8 {
        var uuid = zul.UUID.v4();
        var id = lib.uuidToPasteID(uuid);
        var value = try self.pool.exists(&id);
        while (value) {
            uuid = zul.UUID.v4();
            id = lib.uuidToPasteID(uuid);
            value = try self.pool.exists(&id);
        }
        const result = try std.fmt.allocPrint(allocator, "{s}", .{id});
        return result;
    }
};
