const std = @import("std");
const zlog = @import("zlog");

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const gpa_allocator = gpa.allocator();

    var arena = std.heap.ArenaAllocator.init(gpa_allocator);
    defer arena.deinit();
    const allocator = arena.allocator();

    try zlog.initGlobalLogger(.INFO, true, "standings", null, null, allocator);
    defer zlog.deinitGlobalLogger();

    zlog.info("Hello, world!", .{});

    const start = std.time.milliTimestamp();
    try fetchFromPokeData(allocator);
    const end = std.time.milliTimestamp();
    zlog.info("Took {d}ms", .{end - start});
}

const TournamentsJsonResponse = struct {
    vg: struct {
        type: []const u8,
        data: []Tournament,
    },
};

const Tournament = struct {
    id: []const u8,
    name: []const u8,
    players: ?std.json.Value = null,
};
const Players = struct {
    juniors: ?u32 = null,
    seniors: ?u32 = null,
    masters: ?u32 = null,
};

pub fn fetchFromPokeData(allocator: std.mem.Allocator) !void {
    try zlog.pushScope("fetchFromPokeData");
    defer _ = zlog.popScope() catch {
        @panic("popScope failed");
    };

    var client = std.http.Client{ .allocator = allocator };
    defer client.deinit();

    var body = std.ArrayList(u8).init(allocator);
    defer body.deinit();

    const response = try client.fetch(.{
        .method = .GET,
        .location = .{
            .url = "https://www.pokedata.ovh/apiv2/tournaments",
        },
        .response_storage = .{ .dynamic = &body },
    });

    if (response.status != .ok) {
        return error.FetchFailed;
    }

    const body_str = body.items;
    const json = try std.json.parseFromSlice(TournamentsJsonResponse, allocator, body_str, .{
        .ignore_unknown_fields = true,
    });
    defer json.deinit();

    const tournaments = json.value.vg;

    zlog.info("Found {d} tournaments", .{tournaments.data.len});
    const latest = tournaments.data[tournaments.data.len - 1];

    if (latest.players) |p| {
        const masters_value = p.object.get("masters").?;
        const masters = masters_value.integer;

        zlog.info("Latest tournament: {s} - {d} masters players", .{
            latest.name,
            masters,
        });
    }
}
