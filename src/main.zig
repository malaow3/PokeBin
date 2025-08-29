const std = @import("std");
const lib = @import("pokebin_lib");
const zlog = @import("zlog");
const zul = @import("zul");
const httpz = @import("httpz");
const utils = @import("utils.zig");
const state = @import("state.zig");
const shutdown = @import("shutdown.zig");
const routes = @import("routes.zig");
const wslog = @import("wslog.zig");
const build_zig_zon = @import("build.zig.zon");

pub const std_options = std.Options{
    .logFn = wslog.log,
};

pub fn getVersion() ?[]const u8 {
    var it = std.mem.splitScalar(u8, build_zig_zon.contents, '\n');
    while (it.next()) |item| {
        const line = std.mem.trim(u8, item, " \t\n\r");
        if (std.mem.startsWith(u8, line, ".version")) {
            var tokenizer = std.mem.tokenizeAny(u8, line[".version".len..], " \"=");
            return tokenizer.next();
        }
    }
    return null;
}

pub const version = getVersion() orelse @panic("Failed to get version");

pub var state_ptr: ?*state.State = null;
pub var server_instance: ?*httpz.Server(*state.State) = null;

pub fn main() !void {
    shutdown.initSigHandler();

    // Allocator setup
    var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    // End allocator setup

    var skip_preload = false;
    var verbose = false;
    var args = std.process.args();
    while (args.next()) |arg| {
        if (std.mem.eql(u8, arg, "--skip-preload") or std.mem.eql(u8, arg, "-s")) {
            skip_preload = true;
        }
        if (std.mem.eql(u8, arg, "--verbose") or std.mem.eql(u8, arg, "-v")) {
            verbose = true;
        }
    }

    // Logging setup
    const log_level = if (verbose) zlog.Logger.Level.DEBUG else zlog.Logger.Level.INFO;
    try zlog.initGlobalLogger(
        log_level,
        true,
        "PokeBin",
        null,
        null,
        allocator,
    );
    defer zlog.deinitGlobalLogger();
    // End logging setup
    zlog.info("Initializing PokeBin - v{s}", .{version});

    var appState = try state.State.init(allocator);
    state_ptr = &appState;
    defer appState.deinit();

    if (!skip_preload) {
        zlog.info("Preloading cache!", .{});
        try appState.preloadDirectoryRecursive("web/dist/", false);
        try appState.preloadFile("zig-out/bin/wasm.wasm.br", .WASM, true);
        try appState.preloadFile("zig-out/bin/web_wasm.wasm.br", .WASM, true);
        try appState.preloadFile("robots.txt", .TEXT, false);
        try appState.preloadDirectoryRecursive("home/", true);
        zlog.info("Cache preload complete!", .{});
    }

    var server = try httpz.Server(*state.State).init(allocator, .{
        .thread_pool = .{ .count = 25 },
        .websocket = .{
            .large_buffer_pool = 100,
            .small_buffer_pool = 25,
            .max_message_size = 1024 * 1024 * 10,
        },
        .workers = .{
            .min_conn = 10,
            .max_conn = 100,
            .count = 10,
        },
        .address = "0.0.0.0",
        .port = 2000,
        .request = .{
            .max_form_count = 10,
            .max_param_count = 10,
        },
    }, &appState);
    server_instance = &server;

    var router = try server.router(.{});
    router.get("/", routes.index, .{});
    router.get("/:uuid/json", routes.getUUIDJson, .{});
    router.get("/:uuid", routes.getUUID, .{});
    router.get("/static/*", routes.static, .{});
    router.get("/assets/*", routes.assets, .{});
    router.get("/favicon/*", routes.favicon, .{});
    router.get("/wasm", routes.wasm, .{});
    router.get("/web_wasm", routes.web_wasm, .{});
    router.get("/about", routes.about, .{});
    router.get("/tos", routes.tos, .{});
    router.post("/create", routes.create, .{});
    router.get("/report", routes.report, .{});
    router.post("/report", routes.createReport, .{});
    router.get("/home/*", routes.image, .{});
    router.get("/total", routes.totalPastes, .{});
    router.get("/live", routes.active, .{});
    router.get("/ws", routes.wsFn, .{});
    router.get("/robots.txt", routes.robots, .{});
    router.get("/version", routes.version, .{});
    router.get("/site.webmanifest", routes.siteWebmanifest, .{});
    router.get("/replay", routes.replay, .{});
    router.post("/api/fetch-replays", routes.fetchReplay, .{});
    router.get("/settings", routes.settings, .{});
    router.get("/recent", routes.recent, .{});
    // router.post("/qr", routes.qrCode, .{});

    zlog.info("Starting PokeBin!", .{});
    try server.listen();
}
