const std = @import("std");
const pbytes = @embedFile("pokemon.json");
const ibytes = @embedFile("items.json");
const mbytes = @embedFile("moves.json");
const missing_bytes = @embedFile("missing_shiny.json");

pub const Pokemon = struct {
    id: []const u8,
    type1: []const u8,
    type2: []const u8,
    has_shiny: bool,
    has_female: bool,
};

pub const Item = struct {
    name: []const u8,
    num: i64,
    spritenum: i64,
};

pub const Move = struct {
    name: []const u8,
    id: i64,
    type1: []const u8,
};

pub var POKEMON: std.ArrayHashMapUnmanaged([]const u8, Pokemon, std.array_hash_map.StringContext, true) = undefined;
pub var ITEMS: std.ArrayHashMapUnmanaged([]const u8, Item, std.array_hash_map.StringContext, true) = undefined;
pub var MOVES: std.ArrayHashMapUnmanaged([]const u8, Move, std.array_hash_map.StringContext, true) = undefined;
pub var MISSING_SHINIES: std.ArrayHashMapUnmanaged([]const u8, ?[]const u8, std.array_hash_map.StringContext, true) = undefined;

pub fn init() !void {
    const pjson = try std.json.parseFromSlice(std.json.ArrayHashMap(Pokemon), std.heap.wasm_allocator, pbytes, .{});
    const pjson_value = pjson.value;
    const pmap = pjson_value.map;
    POKEMON = pmap;

    const ijson = try std.json.parseFromSlice(
        std.json.ArrayHashMap(Item),
        std.heap.wasm_allocator,
        ibytes,
        .{ .ignore_unknown_fields = true },
    );
    const ijson_value = ijson.value;
    const imap = ijson_value.map;
    ITEMS = imap;

    const mjson = try std.json.parseFromSlice(
        std.json.ArrayHashMap(Move),
        std.heap.wasm_allocator,
        mbytes,
        .{},
    );
    const mjson_value = mjson.value;
    const mmap = mjson_value.map;
    MOVES = mmap;

    const missing_shiny = try std.json.parseFromSlice(
        std.json.ArrayHashMap(?[]const u8),
        std.heap.wasm_allocator,
        missing_bytes,
        .{},
    );
    const missing_json_value = missing_shiny.value;
    const missing_map = missing_json_value.map;
    MISSING_SHINIES = missing_map;
}
