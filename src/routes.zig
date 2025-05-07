const build_info = @import("build_info");
const httpz = @import("httpz");
const std = @import("std");
const zlog = @import("zlog");
const state = @import("state.zig");
const redis = @import("redis");
const ws = @import("ws.zig");
const VERSION = @import("main.zig").version;

fn serveCachedFile(
    app: *state.State,
    res: *httpz.Response,
    filepath: []const u8,
    content_type: httpz.ContentType,
    cache: bool,
) !void {
    const cached = try app.getOrLoadFile(filepath, content_type);
    if (cache) {
        // Content should generally not change, so let's make the cache a long time
        // 60 sec * 60 min * 24 hours * 365 days = 31536000 seconds
        res.header("Cache-Control", "public, max-age=31536000");
    }
    res.content_type = content_type;
    if (cached.compressed_data) |compressed_data| {
        res.header("Content-Encoding", "br");
        res.body = compressed_data;
    } else {
        if (std.mem.eql(u8, std.fs.path.extension(filepath), ".gz")) {
            res.header("Content-Encoding", "gzip");
        } else if (std.mem.eql(u8, std.fs.path.extension(filepath), ".br")) {
            res.header("Content-Encoding", "br");
        }
        res.body = cached.data;
    }
}

pub fn siteWebmanifest(app: *state.State, _: *httpz.Request, res: *httpz.Response) !void {
    const file = try app.getOrLoadFile("web/dist/favicon/site.webmanifest", .TEXT);
    if (file.compressed_data) |compressed_data| {
        res.body = compressed_data;
        res.header("Content-Encoding", "br");
    } else {
        res.body = file.data;
    }
    res.content_type = .TEXT;
    res.header("Cache-Control", "public, max-age=31536000");
    return;
}

pub fn version(_: *state.State, _: *httpz.Request, res: *httpz.Response) !void {
    res.body = try std.fmt.allocPrint(res.arena, "{s}", .{VERSION});
    res.content_type = .TEXT;
}

pub fn serveHtmlFile(app: *state.State, filepath: []const u8, res: *httpz.Response) !void {
    const data = app.getOrLoadFile(filepath, .HTML) catch {
        return error.FileError;
    };

    // Content should NEVER change, so let's make the cache a long time
    // 60 sec * 60 min * 24 hours * 365 days = 31536000 seconds
    res.header("Cache-Control", "public, max-age=31536000");

    if (data.compressed_data) |compressed_data| {
        res.body = compressed_data;
        res.header("Content-Encoding", "br");
    } else {
        res.body = data.data;
    }
    res.content_type = .HTML;
    return;
}

pub fn replay(app: *state.State, _: *httpz.Request, res: *httpz.Response) !void {
    return serveHtmlFile(app, "web/dist/replay.html", res);
}

/// fetchReplay serves as a wrapper around the Showdown API. Because of the CORS restrictions
/// we cannot fetch this info directly from the client. User credentials are not saved and are only
/// used for this single request. Data is sent over HTTPS and is encrypted.
pub fn fetchReplay(_: *state.State, req: *httpz.Request, res: *httpz.Response) !void {
    const data = req.body();
    const allocator = res.arena;

    const SDUser = struct {
        name: []const u8,
        pass: []const u8,
        challstr: []const u8,
    };

    if (data) |d| {
        const user = std.json.parseFromSlice(SDUser, allocator, d, .{}) catch |err| {
            zlog.err("Failed to parse JSON: {s}", .{@errorName(err)});
            return error.InvalidJSON;
        };
        defer user.deinit();

        var client = std.http.Client{
            .allocator = allocator,
        };

        const headers = &[_]std.http.Header{
            .{ .name = "Content-Type", .value = "application/x-www-form-urlencoded" },
        };

        const header_buf = try allocator.alloc(u8, 1024);
        defer allocator.free(header_buf);

        const body = try std.fmt.allocPrint(allocator, "name={s}&pass={s}&challstr={s}", .{ user.value.name, user.value.pass, user.value.challstr });
        const response = client.fetch(.{
            .method = .POST,
            .location = .{ .url = "https://play.pokemonshowdown.com/api/login" },
            .extra_headers = headers,
            .payload = body,
            .server_header_buffer = header_buf,
        }) catch |err| {
            zlog.err("Failed to login: {s}", .{@errorName(err)});
            return error.LoginFailed;
        };

        if (response.status != .ok and response.status != .no_content) {
            zlog.err("Status: {s}", .{@tagName(response.status)});
            return error.ReportSubmissionFailed;
        }

        var split = std.mem.splitScalar(u8, header_buf, '\n');
        var sid: []const u8 = "";
        while (split.next()) |line| {
            if (std.mem.startsWith(u8, line, "Set-Cookie: sid=")) {
                const idx = std.mem.indexOf(u8, line, ";") orelse line.len;
                sid = line[16..idx];
            }
        }

        if (sid.len == 0) {
            return error.AuthError;
        }

        // Pagination loop
        var all_replays = std.ArrayList(u8).init(allocator);
        try all_replays.append('[');

        var page: usize = 1;
        var first = true;
        const cookie_value = try std.fmt.allocPrint(allocator, "sid={s}", .{sid});
        const replay_headers = &[_]std.http.Header{
            .{ .name = "Cookie", .value = cookie_value },
        };
        defer allocator.free(cookie_value);

        while (true) {
            const replay_url = try std.fmt.allocPrint(allocator, "https://replay.pokemonshowdown.com/api/replays/searchprivate?username={s}&format=&page={d}", .{ user.value.name, page });

            var replay_response_body = std.ArrayList(u8).init(allocator);
            defer replay_response_body.deinit();

            const replay_response = client.fetch(.{
                .method = .GET,
                .location = .{ .url = replay_url },
                .extra_headers = replay_headers,
                .response_storage = .{ .dynamic = &replay_response_body },
            }) catch |err| {
                zlog.err("Failed to fetch page {d} replays: {s}", .{ page, @errorName(err) });
                return err;
            };

            if (replay_response.status != .ok and replay_response.status != .no_content) {
                break;
            }

            // The response is always prefixed with a ']' character
            // An empty page is `][]` or just `]`
            if (replay_response_body.items.len <= 2) break; // '][' or ']'
            const json_slice = replay_response_body.items[1..]; // skip the first ']'

            // If the page is empty (i.e., "[]"), break
            if (json_slice.len == 2 and std.mem.eql(u8, json_slice, "[]")) break;

            // Remove the surrounding [] from each page, join with commas
            if (json_slice.len > 2) {
                if (!first) try all_replays.append(',');
                first = false;
                try all_replays.appendSlice(json_slice[1 .. json_slice.len - 1]);
            }

            page += 1;
        }

        try all_replays.append(']');

        res.status = 200;
        res.headers.add("Content-Type", "application/json");
        res.body = all_replays.items;
    }
}

pub fn index(app: *state.State, _: *httpz.Request, res: *httpz.Response) !void {
    return serveHtmlFile(app, "web/dist/index.html", res);
}

pub fn about(app: *state.State, _: *httpz.Request, res: *httpz.Response) !void {
    return serveHtmlFile(app, "web/dist/about.html", res);
}

pub fn settings(app: *state.State, _: *httpz.Request, res: *httpz.Response) !void {
    return serveHtmlFile(app, "web/dist/settings.html", res);
}

pub fn tos(app: *state.State, _: *httpz.Request, res: *httpz.Response) !void {
    return serveHtmlFile(app, "web/dist/tos.html", res);
}

pub fn report(app: *state.State, _: *httpz.Request, res: *httpz.Response) !void {
    return serveHtmlFile(app, "web/dist/report.html", res);
}

pub fn image(app: *state.State, req: *httpz.Request, res: *httpz.Response) !void {
    const path = req.url.path;
    const sub_path = try std.fmt.allocPrint(res.arena, "{s}.br", .{path[6..]});
    const filepath = try std.fs.path.join(res.arena, &[_][]const u8{
        "home", sub_path,
    });

    return serveCachedFile(app, res, filepath, state.getMimeType(sub_path) orelse httpz.ContentType.BINARY, true) catch {
        res.status = 404;
        res.content_type = .TEXT;
        res.body = "Not Found";
        return;
    };
}

pub fn totalPastes(app: *state.State, _: *httpz.Request, res: *httpz.Response) !void {
    var result = try app.pgpool.getCount();
    // TODO: Remove this once data starts coming in!
    result += @intCast(app.config.total_offset);

    res.body = try std.fmt.allocPrint(res.arena, "{d}", .{result});
    res.content_type = .TEXT;
}

pub fn favicon(app: *state.State, req: *httpz.Request, res: *httpz.Response) !void {
    const path = req.url.path;
    const filepath = try std.fs.path.join(res.arena, &[_][]const u8{
        "web", "dist", path,
    });

    return serveCachedFile(app, res, filepath, state.getMimeType(filepath) orelse httpz.ContentType.BINARY, true) catch {
        res.status = 404;
        res.content_type = .TEXT;
        res.body = "Not Found";
        return;
    };
}

pub fn assets(app: *state.State, req: *httpz.Request, res: *httpz.Response) !void {
    const path = req.url.path;
    const sub_path = path[8..];
    var filepath = try std.fs.path.join(res.arena, &[_][]const u8{
        "web", "dist", sub_path,
    });
    if (std.mem.eql(u8, sub_path, "sprites")) {
        res.arena.free(filepath);
        filepath = try std.fs.path.join(res.arena, &[_][]const u8{
            "web", "dist", "itemicons-sheet.png",
        });
    }

    return serveCachedFile(app, res, filepath, state.getMimeType(sub_path) orelse httpz.ContentType.BINARY, true) catch {
        res.status = 404;
        res.content_type = .TEXT;
        res.body = "Not Found";
        return;
    };
}

pub fn static(app: *state.State, req: *httpz.Request, res: *httpz.Response) !void {
    const path = req.url.path;
    const sub_path = path[8..];
    const filepath = try std.fs.path.join(res.arena, &[_][]const u8{
        "web", "dist", "static", sub_path,
    });

    return serveCachedFile(app, res, filepath, state.getMimeType(sub_path) orelse httpz.ContentType.BINARY, true) catch {
        res.status = 404;
        res.content_type = .TEXT;
        res.body = "Not Found";
        return;
    };
}

pub fn wasm(app: *state.State, _: *httpz.Request, res: *httpz.Response) !void {
    res.headers.add("Access-Control-Allow-Origin", "https://play.pokemonshowdown.com");
    return serveCachedFile(app, res, "zig-out/bin/wasm.wasm.br", .WASM, true) catch {
        res.status = 404;
        res.content_type = .TEXT;
        res.body = "Not Found";
        return;
    };
}

pub fn robots(app: *state.State, _: *httpz.Request, res: *httpz.Response) !void {
    return serveCachedFile(app, res, "robots.txt", .TEXT, true) catch {
        res.status = 404;
        res.content_type = .TEXT;
        res.body = "Not Found";
        return;
    };
}

pub fn getUUIDJson(app: *state.State, req: *httpz.Request, res: *httpz.Response) !void {
    res.headers.add("Access-Control-Allow-Origin", "https://play.pokemonshowdown.com");
    const user = req.params.get("uuid") orelse {
        res.status = 404;
        res.body = "Not Found";
        return;
    };

    const value = app.pgpool.getUUID(user) catch {
        res.status = 404;
        res.body = "Not Found";
        return;
    };
    res.body = value;
    res.content_type = .JSON;
    res.status = 200;
}

pub fn getUUID(appState: *state.State, req: *httpz.Request, res: *httpz.Response) !void {
    const user = req.params.get("uuid") orelse {
        res.status = 404;
        res.body = "Not Found";
        return;
    };

    // Content should NEVER change, so let's make the cache a long time
    // 60 sec * 60 min * 24 hours * 365 days = 31536000 seconds
    res.header("Cache-Control", "public, max-age=31536000");

    const exists = try appState.pgpool.uuidExists(user);
    if (exists) {
        return serveHtmlFile(appState, "web/dist/paste.html", res);
    } else {
        res.header("Location", "/");
        res.status = 302;
    }
}

pub fn hashDataToHex(data: []const u8, allocator: std.mem.Allocator) ![]const u8 {
    const Sha256 = std.crypto.hash.sha2.Sha256;
    var hash_buf: [Sha256.digest_length]u8 = undefined;
    Sha256.hash(data, &hash_buf, .{});
    var hex_buf = std.fmt.bytesToHex(hash_buf[0..], .lower);
    return try allocator.dupe(u8, hex_buf[0..]);
}

pub fn create(app: *state.State, req: *httpz.Request, res: *httpz.Response) !void {
    const form = try req.formData();

    const data_opt = form.get("data");
    if (data_opt == null) {
        return error.NoData;
    }
    const data = data_opt.?;

    const decoder = std.base64.standard.Decoder;
    const max_size = try decoder.calcSizeForSlice(data);
    const decoded = try res.arena.alloc(u8, max_size);

    try decoder.decode(decoded, data);

    // Hash and check for existing
    const hash = try hashDataToHex(decoded, res.arena);

    const existing: ?[]const u8 = app.pgpool.hashExists(hash) catch null;
    if (existing) |e| {
        zlog.info("UUID already exists: {s}", .{e});
        // Data already exists, redirect to existing UUID
        const url = try std.fmt.allocPrint(res.arena, "/{s}", .{e});
        res.status = 302;
        res.header("Location", url);
        return;
    }

    // Not found, create new UUID and store
    const uuid = try app.getNewUUID(res.arena);
    zlog.info("Inserting new UUID: {s}", .{uuid});

    // Store in DB
    try app.pgpool.savePaste(uuid, decoded, hash);

    const url = try std.fmt.allocPrint(res.arena, "/{s}", .{uuid});
    res.status = 302;
    res.header("Location", url);
}

pub fn createReport(s: *state.State, req: *httpz.Request, res: *httpz.Response) !void {
    const allocator = res.arena;
    const data = req.body();
    if (data) |d| {
        var client = std.http.Client{
            .allocator = allocator,
        };

        const headers = &[_]std.http.Header{
            .{ .name = "Content-Type", .value = "application/json" },
        };

        const ResponseType = struct {
            paste: []const u8,
            password: ?[]const u8,
        };

        const json = try std.json.parseFromSlice(ResponseType, allocator, d, .{});
        defer json.deinit();

        const Field = struct {
            name: []const u8,
            value: []const u8,
            @"inline": bool,
        };

        const Embed = struct {
            title: []const u8,
            fields: []const Field,
        };

        const Message = struct {
            embeds: []const Embed,
        };

        // Create message data
        const msgdata = Message{
            .embeds = &[_]Embed{
                .{
                    .title = "PokeBin Report",
                    .fields = &[_]Field{
                        .{
                            .name = "Paste",
                            .value = json.value.paste,
                            .@"inline" = false,
                        },
                        .{
                            .name = "Password",
                            .value = json.value.password orelse "None",
                            .@"inline" = false,
                        },
                    },
                },
            },
        };

        const json_string = try std.json.stringifyAlloc(allocator, msgdata, .{});
        defer allocator.free(json_string);

        const response = try client.fetch(.{
            .method = .POST,
            .location = .{ .url = s.config.webhook },
            .extra_headers = headers,
            .payload = json_string,
        });

        if (response.status != .ok and response.status != .no_content) {
            return error.ReportSubmissionFailed;
        }

        res.status = 200;
    } else {
        return error.NoData;
    }
}

pub fn wsFn(appState: *state.State, req: *httpz.Request, res: *httpz.Response) !void {
    const ctx = ws.Client.Context{ .appState = appState };

    if (try httpz.upgradeWebsocket(ws.Client, req, res, &ctx) == false) {
        res.status = 500;
        res.body = "Invalid WebSocket";
    }
    const ws_worker: *httpz.websocket.server.Worker(ws.Client) = @ptrCast(@alignCast(res.conn.ws_worker));
    ws_worker.worker.allocator = res.arena;
    // Do not use `res` from this point on
}

pub fn active(app: *state.State, _: *httpz.Request, res: *httpz.Response) !void {
    app.conn_rwlock.lockShared();
    var result = app.connections;
    app.conn_rwlock.unlockShared();
    result += app.config.live_offset;

    var prng = std.Random.DefaultPrng.init(@intCast(std.time.milliTimestamp()));
    const rng = prng.random();
    result += rng.intRangeAtMost(usize, 0, app.config.live_offset);

    res.body = try std.fmt.allocPrint(res.arena, "{d}", .{result});
    res.content_type = .TEXT;
}
