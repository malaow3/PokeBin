const std = @import("std");
const lib = @import("pokebin_lib");
const zlog = @import("zlog");
const zul = @import("zul");
const redis = @import("redis");
const httpz = @import("httpz");
const utils = @import("utils.zig");
const state = @import("state.zig");
const shutdown = @import("shutdown.zig");
const routes = @import("routes.zig");

pub const version = "2.0.0";

pub var state_ptr: ?*state.State = null;
pub var server_instance: ?*httpz.Server(*state.State) = null;

pub fn main() !void {
    shutdown.initSigHandler();

    // Allocator setup
    var gpa = std.heap.GeneralPurposeAllocator(.{}).init;
    defer {
        switch (gpa.deinit()) {
            .ok => {},
            .leak => std.debug.print("leaked memory\n", .{}),
        }
    }
    const gpa_allocator = gpa.allocator();

    var arena = std.heap.ArenaAllocator.init(gpa_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();
    // End allocator setup

    // Logging setup
    try zlog.initGlobalLogger(
        .INFO,
        // .DEBUG,
        true,
        "PokeBin",
        null,
        null,
        allocator,
    );
    defer zlog.deinitGlobalLogger();
    // End logging setup
    zlog.info("Initializing PokeBin - v{s}", .{version});

    zlog.info("Initializing Redis!", .{});
    var appState = try state.State.init(allocator, null);
    state_ptr = &appState;
    defer appState.deinit();
    zlog.info("Redis initialized!", .{});

    zlog.info("Preloading cache!", .{});
    try appState.preloadDirectoryRecursive("web/dist/", false);
    try appState.preloadFile("zig-out/bin/wasm.wasm.br", .WASM, true);
    try appState.preloadFile("robots.txt", .TEXT, false);
    try appState.preloadDirectoryRecursive("home/", true);
    zlog.info("Cache preload complete!", .{});

    var server = try httpz.Server(*state.State).init(allocator, .{
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

    zlog.info("Starting PokeBin!", .{});
    try server.listen();
}
