const std = @import("std");
const utils = @import("utils.zig");
const allocator = utils.allocator;

const ARRAY_LIST_INITIAL_CAPACITY = 1024;

pub const PackedPaste = struct {
    id: []const u8,
    name: []const u8,
    format: []const u8,
    pokemon_count: usize,
    pokemon: [][]const u8,

    pub fn toPackedString(self: PackedPaste) ![]const u8 {
        const filled = try std.fmt.allocPrint(allocator, "{s}|{s}|{s}", .{
            self.id,
            self.name,
            self.format,
        });
        defer allocator.free(filled);

        var string = try std.ArrayList(u8).initCapacity(allocator, ARRAY_LIST_INITIAL_CAPACITY);
        defer string.deinit(allocator);

        try string.appendSlice(allocator, filled);

        for (self.pokemon) |pokemon| {
            try string.append(allocator, '|');
            try string.appendSlice(allocator, pokemon);
        }

        return try string.toOwnedSlice(allocator);
    }
};

pub fn packedPasteListToString(list: []PackedPaste) ![]const u8 {
    var string = try std.ArrayList(u8).initCapacity(allocator, ARRAY_LIST_INITIAL_CAPACITY);
    defer string.deinit(allocator);

    for (list, 0..) |paste, i| {
        const p = try paste.toPackedString();
        if (i > 0) {
            try string.append(allocator, '\n');
        }
        try string.appendSlice(allocator, p);
    }
    return try string.toOwnedSlice(allocator);
}

pub fn newPaste() PackedPaste {
    return PackedPaste{
        .id = "",
        .name = "",
        .format = "",
        .pokemon_count = 0,
        .pokemon = &[_][]const u8{},
    };
}

const ParsedPacked = struct {
    ids: std.StringHashMap(void),
    pastes: []PackedPaste,

    pub fn deinit(self: *ParsedPacked) void {
        self.ids.deinit();
    }
};

const EXPECTED_POKEMON_PER_PASTE = 6;

pub fn parsePacked(packedString: []const u8) !ParsedPacked {
    var ids = std.StringHashMap(void).init(allocator);
    if (std.mem.eql(u8, packedString, "") or packedString.len == 0) {
        return ParsedPacked{
            .ids = ids,
            .pastes = &[_]PackedPaste{},
        };
    }
    var pastes = try std.ArrayList(PackedPaste).initCapacity(allocator, ARRAY_LIST_INITIAL_CAPACITY);
    defer pastes.deinit(allocator);

    var lines = std.mem.splitScalar(u8, packedString, '\n');
    while (lines.next()) |line| {
        var paste = newPaste();

        var pokemon = try std.ArrayList([]const u8).initCapacity(allocator, EXPECTED_POKEMON_PER_PASTE);
        defer pokemon.deinit(allocator);

        var sections = std.mem.splitScalar(u8, line, '|');
        var idx: usize = 0;
        while (sections.next()) |item| {
            switch (idx) {
                0 => {
                    paste.id = item;
                    try ids.put(item, {});
                },
                1 => {
                    paste.name = item;
                },
                2 => {
                    paste.format = item;
                },
                else => {
                    try pokemon.append(allocator, item);
                },
            }
            idx += 1;
        }

        paste.pokemon_count = pokemon.items.len;
        paste.pokemon = try pokemon.toOwnedSlice(allocator);

        try pastes.append(allocator, paste);
    }

    const pastesSlice = try pastes.toOwnedSlice(allocator);
    return ParsedPacked{
        .ids = ids,
        .pastes = pastesSlice,
    };
}
