const std = @import("std");
const print = std.debug.print;
const http = std.http;

const ThreadData = struct {
    post: std.json.Value,
    // String for the JSON.
    result: []u8,
};

pub fn main() !void {
    var gpa = std.heap.GeneralPurposeAllocator(.{}){};
    defer _ = gpa.deinit();
    const allocator = gpa.allocator();

    var client = http.Client{ .allocator = allocator };
    defer client.deinit();
    errdefer client.deinit();

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

    // Join all threads and collect results.
    var species_details = std.ArrayList(std.json.Parsed(std.json.Value)).init(allocator);
    defer species_details.deinit();

    for (results) |post| {
        // Allocate new thread data.
        const data = allocator.create(ThreadData) catch |err| {
            std.debug.print("Failed to allocate ThreadData: {}\n", .{err});
            // Handle allocation failure, possibly by breaking the loop
            break;
        };
        data.* = ThreadData{ .post = post, .result = "" };
        try threadDataList.append(data);
        const thread = try std.Thread.spawn(.{}, printPost, .{ threadDataList.getLast(), allocator });
        try threadList.append(thread);

        // If the theadlist length == 10 then join all threads and collect results.
        if (threadList.items.len == 10) {
            for (threadList.items) |t| {
                t.join();
            }

            for (threadDataList.items) |d| {
                if (!std.mem.eql(u8, d.result, "")) {
                    const json = try std.json.parseFromSlice(std.json.Value, allocator, d.result, .{});
                    try species_details.append(json);
                }
                allocator.free(d.result);
                allocator.destroy(d);
            }

            // Clear out the threadlist and threadDataList
            threadList.shrinkAndFree(0);
            threadDataList.shrinkAndFree(0);
        }
    }

    for (threadList.items) |thread| {
        thread.join();
    }

    for (threadDataList.items) |data| {
        if (!std.mem.eql(u8, data.result, "")) {
            const json = try std.json.parseFromSlice(std.json.Value, allocator, data.result, .{});
            try species_details.append(json);
        }
        allocator.free(data.result);
        allocator.destroy(data);
    }

    // Use urls here
    for (species_details.items) |details| {
        try std.json.stringify(details.value, .{}, std.io.getStdOut().writer());
        details.deinit();
    }
}

fn printPost(data: *ThreadData, allocator: std.mem.Allocator) !void {
    const url = data.post.object.get("url").?.string;

    if (std.mem.eql(u8, url, "https://pokeapi.co/api/v2/pokemon-species/1/")) {
        var client = http.Client{ .allocator = allocator };
        defer client.deinit();

        var headers = http.Headers{ .allocator = allocator };
        defer headers.deinit();

        const uri = try std.Uri.parse(url);

        var req = try client.open(.GET, uri, headers, .{});
        defer req.deinit();
        try req.send(.{});
        try req.wait();

        // Default to maximum u64.
        const content_length: u64 = std.math.maxInt(u64);
        var rdr = req.reader();
        const body = try rdr.readAllAlloc(allocator, content_length);
        defer allocator.free(body);

        // Copy the body into the result
        data.result = try allocator.alloc(u8, body.len);
        std.mem.copyForwards(u8, data.result, body);
    }
}
