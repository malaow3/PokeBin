const std = @import("std");
const utils = @import("utils.zig");
const allocator = utils.allocator;
const consoleLog = utils.consoleLog;

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

        var string = std.ArrayList(u8).init(allocator);
        defer string.deinit();

        try string.appendSlice(filled);

        for (self.pokemon) |pokemon| {
            consoleLog("pokemon: {s}", .{pokemon});
            try string.append('|');
            try string.appendSlice(pokemon);
        }

        return try string.toOwnedSlice();
    }
};

pub fn packedPasteListToString(list: []PackedPaste) ![]const u8 {
    var string = std.ArrayList(u8).init(allocator);
    defer string.deinit();

    for (list, 0..) |paste, i| {
        const p = try paste.toPackedString();
        if (i > 0) {
            try string.append('\n');
        }
        try string.appendSlice(p);
    }
    return try string.toOwnedSlice();
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

pub fn parsePacked(packedString: []const u8) !ParsedPacked {
    var ids = std.StringHashMap(void).init(allocator);
    if (std.mem.eql(u8, packedString, "") or packedString.len == 0) {
        return ParsedPacked{
            .ids = ids,
            .pastes = &[_]PackedPaste{},
        };
    }
    var pastes = std.ArrayList(PackedPaste).init(allocator);
    defer pastes.deinit();

    var lines = std.mem.splitScalar(u8, packedString, '\n');
    while (lines.next()) |line| {
        var paste = newPaste();

        var pokemon = std.ArrayList([]const u8).init(allocator);
        defer pokemon.deinit();

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
                    try pokemon.append(item);
                },
            }
            idx += 1;
        }

        paste.pokemon_count = pokemon.items.len;
        paste.pokemon = try pokemon.toOwnedSlice();

        try pastes.append(paste);
    }

    const pastesSlice = try pastes.toOwnedSlice();
    return ParsedPacked{
        .ids = ids,
        .pastes = pastesSlice,
    };
}
