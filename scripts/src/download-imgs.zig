const std = @import("std");
const print = std.debug.print;
const http = std.http;

const ThreadData = struct {
    post: std.json.Value,
    result: []const u8,
};

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var client = http.Client{ .allocator = allocator };
    defer client.deinit();

    var headers = http.Headers{ .allocator = allocator };
    defer headers.deinit();

    const uri = try std.Uri.parse("https://pokeapi.co/api/v2/pokemon-species?limit=10000");
    var req = try client.open(.GET, uri, headers, .{});
    errdefer req.deinit();

    try req.send(.{});
    defer req.deinit();

    try req.wait();

    // Default to maximum u64.
    const content_length: u64 = std.math.maxInt(u64);
    var rdr = req.reader();
    const body = try rdr.readAllAlloc(allocator, content_length);
    defer allocator.free(body);

    // Convert the data to a JSON.
    var tree = try std.json.parseFromSlice(std.json.Value, allocator, body, .{});
    defer tree.deinit();

    var threadDataList = std.ArrayList(*ThreadData).init(allocator);
    defer threadDataList.deinit();
    var threadList = std.ArrayList(std.Thread).init(allocator);
    defer threadList.deinit();
    // Iterate over the posts and print them out in parallel.

    const results = tree.value.object.get("results").?.array.items;

    for (results) |post| {
        // Allocate new thread data.
        const data = allocator.create(ThreadData) catch |err| {
            std.debug.print("Failed to allocate ThreadData: {}\n", .{err});
            // Handle allocation failure, possibly by breaking the loop
            break;
        };
        data.* = ThreadData{ .post = post, .result = "" };
        try threadDataList.append(data);
        const thread = try std.Thread.spawn(.{}, printPost, .{threadDataList.getLast()});
        try threadList.append(thread);
    }

    // Join all threads and collect results.
    var urls = std.ArrayList([]const u8).init(allocator);
    defer urls.deinit();

    for (threadList.items) |thread| {
        thread.join();
    }

    for (threadDataList.items) |data| {
        try urls.append(data.result);
        allocator.destroy(data);
    }

    // Use urls here
    for (urls.items) |url| {
        print("URL: {s}\n", .{url});
    }
}

fn printPost(data: *ThreadData) void {
    const name = data.post.object.get("name").?.string;
    print("{s}\n", .{
        name,
    });
    const url = data.post.object.get("url").?.string;

    data.result = url;
}
