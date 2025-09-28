const std = @import("std");
const utils = @import("utils.zig");
const data = @import("data.zig");
const zpacked = @import("packed.zig");
const qr = @import("qr");

const consoleLog = utils.consoleLog;
const allocator = utils.allocator;
const destroy = utils.destroy;

pub var packed_ptr: u32 = 0;
pub var packed_str_len: i32 = -1;

// Functions to get result information
export fn getPackedPtr() u32 {
    return packed_ptr;
}

export fn getPackedLen() i32 {
    return packed_str_len;
}

export fn resetPackedResult() void {
    packed_ptr = 0;
    packed_str_len = -1;
}

export fn savePasteToLastViewed(limit: u32, packed_string: [*]u8, packed_len: usize, paste_json: [*]u8, paste_len: usize) void {
    const packed_string_slice = packed_string[0..packed_len];

    const existing = zpacked.parsePacked(packed_string_slice) catch @panic("failed to parse packed string");

    const paste_json_slice = paste_json[0..paste_len];
    const paste = std.json.parseFromSlice(std.json.Value, allocator, paste_json_slice, .{}) catch @panic("failed to parse paste");
    defer paste.deinit();

    const id_opt = paste.value.object.get("id");
    if (id_opt == null) {
        consoleLog("Paste has no id", .{});
        packed_str_len = -1;
        return;
    }
    const id = id_opt.?.string;
    if (existing.ids.contains(id)) {
        consoleLog("Paste already exists in list", .{});
        packed_str_len = -1;
        return;
    }

    var newPaste = zpacked.newPaste();
    newPaste.id = id;

    const pokemon_len = paste.value.object.get("pokemon_len").?.integer;
    const pokemon = allocator.alloc([]const u8, @intCast(pokemon_len)) catch @panic("failed to allocate memory");

    const pokemon_array = paste.value.object.get("pokemon").?.array;
    for (pokemon_array.items, 0..) |item, i| {
        const pokemon_object = item.object;
        pokemon[i] = pokemon_object.get("name").?.string;
    }

    newPaste.pokemon = pokemon;

    if (paste.value.object.get("title")) |t| {
        const title_slice = t.string;
        newPaste.name = title_slice;
    }

    if (paste.value.object.get("format")) |f| {
        const format_slice = f.string;
        newPaste.format = format_slice;
    }

    var pasteList = std.ArrayList(zpacked.PackedPaste).initCapacity(allocator, ARRAY_LIST_INITIAL_CAPACITY) catch @panic("failed to allocate paste list");
    defer pasteList.deinit(allocator);

    for (existing.pastes) |p| {
        if (pasteList.items.len + 1 == limit) {
            break;
        }
        pasteList.append(allocator, p) catch @panic("failed to append paste");
    }

    pasteList.insert(allocator, 0, newPaste) catch @panic("failed to append paste");

    const packed_str: []const u8 = zpacked.packedPasteListToString(pasteList.items) catch {
        packed_str_len = -1;
        consoleLog("Failed to convert paste to packed string", .{});
        return;
    };

    packed_ptr = @intFromPtr(packed_str.ptr);
    packed_str_len = @intCast(packed_str.len);
}

extern fn createQRCodeCallback(matrixPtr: [*]const u8, size: usize) void;
export fn createQRCode(messagePtr: [*:0]const u8) void {
    const message = std.mem.span(messagePtr);

    const options = qr.CreateOptions{ .content = message, .quietZoneSize = 1, .ecLevel = .M };

    const matrix = qr.create(allocator, options) catch @panic("failed to create QR code");
    defer matrix.deinit();

    // var buffer = std.heap.page_allocator.alloc(u8, length) catch @panic("failed to allocate memory");
    var buffer = allocator.alloc(u8, matrix.size * matrix.size) catch @panic("failed to allocate memory");

    for (0..matrix.size) |r| {
        for (0..matrix.size) |c| {
            buffer[r * matrix.size + c] = @intCast(matrix.get(r, c));
        }
    }

    createQRCodeCallback(buffer.ptr, matrix.size);
}

const max_bytes = @floor(450 * 1.25);
const max_line_len = @floor(65 * 1.25);
const max_lines_per_item = @floor(16 * 1.25);
const showdown_box_size = 24;

const ARRAY_LIST_INITIAL_CAPACITY = 1024;

// Return code:
// 0 - success
// 1 - item too many bytes
// 2 - line too long
// 3 - line contains invalid content
// 4 - paste has too many lines
// 5 - item add error
// 6 - too many pokemon
export fn validatePaste(pastePtr: [*]u8, paste_len: usize) usize {
    data.init() catch |err| {
        consoleLog("Failed to initialize data - {any}", .{err});
        @panic("failed to initialize data");
    };
    const paste = pastePtr[0..paste_len];

    var iter = std.mem.splitSequence(u8, paste, "\n\n");
    var items = std.ArrayList([]const u8).initCapacity(allocator, ARRAY_LIST_INITIAL_CAPACITY) catch @panic("failed to allocate array list");

    while (iter.next()) |item| {
        if (item.len == 0) continue;
        if (item.len > max_bytes) return 1;

        var lines = std.mem.splitAny(u8, item, "\n");
        var line_count: usize = 1;
        while (lines.next()) |l| {
            if (l.len > max_line_len) return 2;
            if (l.len == 0) continue;
            if (line_count == 1) {
                var name_items = std.mem.splitScalar(u8, l, '@');
                var name_part = name_items.next().?;

                name_part = trim(name_part);
                if (std.mem.endsWith(u8, name_part, "(M)")) {
                    name_part = sanitize(trim(name_part[0 .. name_part.len - 3]));
                } else if (std.mem.endsWith(u8, name_part, "(F)")) {
                    name_part = sanitize(trim(name_part[0 .. name_part.len - 3]));
                }

                var name: [*:0]const u8 = allocator.dupeZ(u8, "") catch @panic("failed to allocate memory");
                if (name_part[name_part.len - 1] == ')') {
                    // Nickname present
                    const start = findLastInstance(name_part, '(');
                    if (start) |i| {
                        name = sanitize(trim(name_part[i + 1 .. name_part.len - 1]));
                    } else {
                        @panic("Failed to find pokemon name");
                    }
                } else {
                    name = sanitize(trim(name_part));
                }

                const span = std.mem.span(name);
                const lower = getSearchName(span, null);
                const search_value = searchLike(lower);
                if (search_value == null) {
                    consoleLog("Invalid pokemon name: {s}", .{lower});
                    return 3;
                }
            }
            if (line_count > 1) {
                if (std.mem.indexOf(u8, l, "https://") != null //
                or std.mem.indexOf(u8, l, "http://") != null //
                or std.mem.indexOf(u8, l, "www.") != null //
                or std.mem.indexOf(u8, l, ".com") != null //
                or std.mem.indexOfAny(u8, l, "><.,!?") != null //
                ) {
                    consoleLog("Line has illegal start: {s}", .{l});
                    return 3;
                }

                // Should be A-Z, `-`, or a `[`
                const startingChar = l[0];
                if (!((startingChar >= 'A' and startingChar <= 'Z') or
                    startingChar == '-' or startingChar == '['))
                {
                    consoleLog("Invalid line: {s}", .{l});
                    return 3;
                }
            }
            line_count += 1;
        }
        if (line_count > max_lines_per_item) return 4;

        items.append(allocator, item) catch return 5;

        if (items.items.len > showdown_box_size) {
            return 6;
        }
    }

    return 0;
}

const Data = struct {
    title: []const u8,
    author: []const u8,
    notes: []const u8,
    format: []const u8,
    rental: []const u8,
    content: []const u8,
};

const Move = extern struct {
    name: [*:0]const u8,
    type1: [*:0]const u8,
};

const Pokemon = extern struct {
    name: [*:0]const u8,
    nickname: [*:0]const u8,
    item: [*:0]const u8,
    gender: usize,
    item_image: [*:0]const u8,
    pokemon_image: [*:0]const u8,
    moves_len: usize,
    moves: [*]*Move,
    evs: [6]usize,
    ivs: [6]usize,
    lines_count: usize,
    lines: [*][*:0]const u8,
    last_stat_ev: [*:0]const u8,
    last_stat_iv: [*:0]const u8,
    type1: [*:0]const u8,
    type2: [*:0]const u8,
    ability: [*:0]const u8,
    level: usize,
    shiny: [*:0]const u8,
    hidden_power: [*:0]const u8,
    tera_type: [*:0]const u8,
    nature: [*:0]const u8,
};

const Paste = extern struct {
    title: [*:0]const u8,
    author: [*:0]const u8,
    notes: [*:0]const u8,
    format: [*:0]const u8,
    rental: [*:0]const u8,
    pokemon_len: usize,
    pokemon: [*]*Pokemon,
    isOts: u32,
};

export fn destroyPaste(pointer: usize) void {
    const paste: *Paste = @ptrFromInt(pointer);
    for (0..paste.pokemon_len) |i| {
        destroy(Pokemon, @intFromPtr(paste.pokemon[i]));
    }
    destroy(Paste, pointer);
}

// Returns an HTML-sanitized, null-terminated string.
fn sanitize(str: []const u8) [:0]const u8 {
    var output = std.ArrayList(u8).initCapacity(allocator, str.len) catch @panic("failed to allocate array list");
    defer output.deinit(allocator);

    var it = std.unicode.Utf8Iterator{ .bytes = str, .i = 0 };
    while (it.nextCodepoint()) |cp| {
        switch (cp) {
            '<' => output.appendSlice(allocator, "&lt;") catch @panic("failed to append slice"),
            '>' => output.appendSlice(allocator, "&gt;") catch @panic("failed to append slice"),
            '&' => output.appendSlice(allocator, "&amp;") catch @panic("failed to append slice"),
            '"' => output.appendSlice(allocator, "&quot;") catch @panic("failed to append slice"),
            '\'' => output.appendSlice(allocator, "&apos;") catch @panic("failed to append slice"),
            else => {
                // Append the codepoint as UTF-8
                var buf: [4]u8 = undefined;
                const len = std.unicode.utf8Encode(cp, &buf) catch @panic("utf8 encode failed");
                output.appendSlice(allocator, buf[0..len]) catch @panic("failed to append");
            },
        }
    }

    return allocator.dupeZ(u8, output.items) catch @panic("failed to allocate sanitized string");
}

fn clean(str: []const u8) [:0]const u8 {
    return allocator.dupeZ(u8, trim(str)) catch @panic("failed to allocate sanitized string");
}

fn initPokemon() *Pokemon {
    const pokemon = allocator.create(Pokemon) catch @panic("failed to allocate Pokemon");
    const pokemonStruct = Pokemon{
        .name = "\x00",
        .nickname = "\x00",
        .item = "\x00",
        .gender = 0,
        .item_image = "\x00",
        .pokemon_image = "\x00",
        .moves_len = 0,
        .moves = &[_]*Move{},
        .evs = [_]usize{0} ** 6,
        .ivs = [_]usize{31} ** 6,
        .lines_count = 0,
        .lines = &[_][*:0]const u8{},
        .last_stat_ev = "\x00",
        .last_stat_iv = "\x00",
        .type1 = "\x00",
        .type2 = "\x00",
        .ability = "\x00",
        .level = 100,
        .shiny = "\x00",
        .hidden_power = "\x00",
        .tera_type = "\x00",
        .nature = "\x00",
    };
    pokemon.* = pokemonStruct;
    return pokemon;
}

fn trim(str: []const u8) []const u8 {
    return std.mem.trim(u8, str, "\t \n");
}

fn findLastInstance(str: []const u8, char: u8) ?usize {
    var last_index: ?usize = null;
    for (str, 0..) |c, i| {
        if (c == char) {
            last_index = i;
        }
    }
    return last_index;
}

const SearchValue = struct {
    name: []const u8,
    value: data.Pokemon,
};
fn searchLike(search: []const u8) ?SearchValue {
    const value = data.POKEMON.get(search);
    if (value) |p| {
        return .{
            .name = search,
            .value = p,
        };
    }

    var iter = data.POKEMON.iterator();
    while (iter.next()) |entry| {
        if (std.mem.startsWith(u8, entry.key_ptr.*, search)) {
            return .{
                .name = entry.key_ptr.*,
                .value = entry.value_ptr.*,
            };
        }
    }

    // Try searching on the individual parts
    const old_pattern = search;
    var patIter = std.mem.splitScalar(u8, search, '-');
    var items = std.ArrayList([]const u8).initCapacity(allocator, ARRAY_LIST_INITIAL_CAPACITY) catch @panic("failed to allocate array list");
    while (patIter.next()) |item| {
        items.append(allocator, item) catch @panic("failed to append item");
    }

    while (items.items.len > 1) {
        const pat = std.mem.join(allocator, "-", items.items[0 .. items.items.len - 1]) catch @panic("failed to join");
        if (std.mem.eql(u8, old_pattern, pat)) {
            return null;
        }

        const res = searchLike(pat);
        if (res) |v| {
            return .{
                .name = old_pattern,
                .value = v.value,
            };
        }

        _ = items.pop();
    }

    return null;
}

fn getImageLink(item: []const u8) [*:0]const u8 {
    const missing = ("background: transparent url(\"assets/missing.png\") no-repeat; height: 64px !important; width: 64px!important; background-position: 5px 10px");
    const value = data.ITEMS.get(item);
    if (value) |v| {
        const sprite_num: i64 = v.spritenum;
        const top: i64 = @divFloor(sprite_num, 16) * 24 * 2;
        const left: i64 = @mod(sprite_num, 16) * 24 * 2;
        return std.fmt.allocPrintSentinel(allocator, "background: transparent url(\"assets/sprites\") -{d}px -{d}px no-repeat;", .{ left, top }, 0) catch @panic("failed to allocate sprite");
    } else {
        return missing;
    }
}

const same_as_base_forms = &[_][]const u8{
    "sinistcha-masterpiece",
    "poltchageist-artisan",
    "polteageist-antique",
    "sinistea-antique",
};

const alcremie_decorations = &[_][]const u8{
    "berry-sweet",
    "clove-sweet",
    "flower-sweet",
    "love-sweet",
    "ribbon-sweet",
    "star-sweet",
    "strawberry-sweet",
};

fn arrayContains(comptime T: type, array: []const T, value: []const u8) bool {
    for (array) |item| {
        if (std.mem.eql(u8, item, value)) {
            return true;
        }
    }
    return false;
}

inline fn getFlavor(pokemon: []const u8) []const u8 {
    if (std.mem.indexOf(u8, pokemon, "alcremie") == null) {
        @panic("This function should only be called when the pokemon is Alcremie");
    }
    if (std.mem.eql(u8, pokemon, "alcremie")) return "vanilla-cream";
    var items = std.mem.splitScalar(u8, pokemon, '-');
    _ = items.next();
    return items.rest();
}

fn getImage(raw_pokemon: []const u8, is_female: bool, is_shiny: bool, twoDImages: bool) [*:0]const u8 {
    // First, see if the pokemon is in the map.
    // If it is, return the filepath.

    var base_path: []u8 = allocator.dupe(u8, "home") catch @panic("failed to allocate sprite");
    if (twoDImages) {
        const new_path = std.fs.path.join(allocator, &[_][]const u8{ base_path, "official-artwork" }) catch @panic("failed to allocate sprite");
        allocator.free(base_path);
        base_path = new_path;
    }
    var pokemon = raw_pokemon;

    if (arrayContains([]const u8, same_as_base_forms, pokemon)) {
        var items = std.mem.splitScalar(u8, pokemon, '-');
        pokemon = items.next().?;
    }

    if (std.mem.eql(u8, pokemon, "maushold")) {
        pokemon = "maushold-family-of-three";
    } else if (std.mem.eql(u8, pokemon, "maushold-family-of-four")) {
        pokemon = "maushold";
    }

    if (std.mem.indexOf(u8, pokemon, "alcremie") != null and std.mem.indexOf(u8, pokemon, "gmax") == null) {
        const random_decoration_idx = utils.getRand().?.*.random().intRangeAtMost(usize, 0, alcremie_decorations.len - 1);
        const decoration = alcremie_decorations[random_decoration_idx];
        if (is_shiny) {
            return std.fmt.allocPrintSentinel(allocator, "{s}/shiny/869-{s}.png", .{ base_path, decoration }, 0) catch @panic("failed to allocate sprite");
        }
        const flavor = getFlavor(pokemon);
        return std.fmt.allocPrintSentinel(allocator, "{s}/869-{s}-{s}.png", .{ base_path, flavor, decoration }, 0) catch @panic("failed to allocate sprite");
    }

    const value = data.POKEMON.get(pokemon);
    if (value) |v| {
        if (is_shiny and v.has_shiny) {
            if (twoDImages) {
                const id_str = std.fmt.allocPrint(allocator, "{s}", .{v.id}) catch @panic("failed to allocate sprite");
                defer allocator.free(id_str);
                if (data.MISSING_SHINIES.get(id_str) == null) {
                    base_path = std.fs.path.join(allocator, &[_][]const u8{ base_path, "shiny" }) catch @panic("failed to allocate sprite");
                }
            } else {
                base_path = std.fs.path.join(allocator, &[_][]const u8{ base_path, "shiny" }) catch @panic("failed to allocate sprite");
            }
        }

        if (is_female and v.has_female and !twoDImages) {
            base_path = std.fs.path.join(allocator, &[_][]const u8{ base_path, "female" }) catch @panic("failed to allocate sprite");
        }

        return std.fmt.allocPrintSentinel(allocator, "{s}/{s}.png", .{ base_path, v.id }, 0) catch @panic("failed to allocate sprite");
    }

    const search_like_value = searchLike(pokemon);
    if (search_like_value) |v| {
        if (is_shiny and v.value.has_shiny) {
            if (twoDImages) {
                const id_str = std.fmt.allocPrint(allocator, "{s}", .{v.value.id}) catch @panic("failed to allocate sprite");
                defer allocator.free(id_str);
                if (data.MISSING_SHINIES.get(id_str) == null) {
                    base_path = std.fs.path.join(allocator, &[_][]const u8{ base_path, "shiny" }) catch @panic("failed to allocate sprite");
                }
            } else {
                base_path = std.fs.path.join(allocator, &[_][]const u8{ base_path, "shiny" }) catch @panic("failed to allocate sprite");
            }
        }
        if (is_female and v.value.has_female and !twoDImages) {
            base_path = std.fs.path.join(allocator, &[_][]const u8{ base_path, "female" }) catch @panic("failed to allocate sprite");
        }
        return std.fmt.allocPrintSentinel(allocator, "{s}/{s}.png", .{ base_path, v.value.id }, 0) catch @panic("failed to allocate sprite");
    }

    var items = std.mem.splitScalar(u8, pokemon, '-');
    const species = items.next().?;
    const species_value = data.POKEMON.get(species);
    if (species_value) |v| {
        const remaining = items.rest();
        const id = std.fmt.allocPrintSentinel(allocator, "{s}-{s}", .{ v.id, remaining }, 0) catch @panic("failed to allocate sprite");

        if (is_shiny and v.has_shiny) {
            if (twoDImages) {
                const id_str = std.fmt.allocPrint(allocator, "{s}", .{v.id}) catch @panic("failed to allocate sprite");
                defer allocator.free(id_str);
                if (data.MISSING_SHINIES.get(id_str) == null) {
                    base_path = std.fs.path.join(allocator, &[_][]const u8{ base_path, "shiny" }) catch @panic("failed to allocate sprite");
                }
            } else {
                base_path = std.fs.path.join(allocator, &[_][]const u8{ base_path, "shiny" }) catch @panic("failed to allocate sprite");
            }
        }
        if (is_female and v.has_female and !twoDImages) {
            base_path = std.fs.path.join(allocator, &[_][]const u8{ base_path, "female" }) catch @panic("failed to allocate sprite");
        }
        return std.fmt.allocPrintSentinel(allocator, "{s}/{s}.png", .{ base_path, id }, 0) catch @panic("failed to allocate sprite");
    }

    const egg_path = std.fmt.allocPrintSentinel(allocator, "home/0.png", .{}, 0) catch @panic("failed to allocate sprite");
    return egg_path;
}

const statResult = struct {
    stats: [6]usize,
    nature: []const u8,
};
fn parseEvIvLineNew(line: []const u8, base_value: usize) !statResult {
    var values: [6]usize = [_]usize{base_value} ** 6;
    var iter = std.mem.splitSequence(u8, line, ": ");
    _ = iter.next();

    const stats = iter.rest();

    var items = try std.ArrayList([]const u8).initCapacity(allocator, ARRAY_LIST_INITIAL_CAPACITY);
    defer items.deinit(allocator);
    var stat_iter = std.mem.splitScalar(u8, trim(stats), '/');
    while (stat_iter.next()) |item| {
        try items.append(allocator, item);
    }

    var nature: []const u8 = "";
    for (items.items) |item| {
        // Example: EVs: 28 HP / - Atk / 12 Def / 228+ SpA / 4 SpD / 236 Spe (Modest)
        const trimmed_item = std.mem.trim(u8, item, " ");
        var sections = std.mem.splitScalar(u8, trim(trimmed_item), ' ');
        const value_raw = std.mem.trim(u8, sections.next().?, "+- ");

        if (value_raw.len == 0 or value_raw[0] < 48 or value_raw[0] > 57) {
            // No numeric value
            continue;
        }

        const stat = sections.next().?;

        var idx: usize = 6;
        if (std.mem.eql(u8, stat, "HP")) {
            idx = 0;
        } else if (std.mem.eql(u8, stat, "Atk")) {
            idx = 1;
        } else if (std.mem.eql(u8, stat, "Def")) {
            idx = 2;
        } else if (std.mem.eql(u8, stat, "SpA")) {
            idx = 3;
        } else if (std.mem.eql(u8, stat, "SpD")) {
            idx = 4;
        } else if (std.mem.eql(u8, stat, "Spe")) {
            idx = 5;
        } else {
            return error.InvalidStat;
        }
        if (std.mem.eql(u8, value_raw, "")) {
            values[idx] = base_value;
            continue;
        }

        if (sections.next()) |nature_string| {
            const start = std.mem.indexOf(u8, nature_string, "(") orelse {
                return error.InvalidStat;
            };
            const end = std.mem.indexOf(u8, nature_string, ")") orelse {
                return error.InvalidStat;
            };
            nature = nature_string[start + 1 .. end];
        }

        const value = try std.fmt.parseInt(usize, trim(value_raw), 10);
        values[idx] = value;
    }
    return statResult{
        .nature = nature,
        .stats = values,
    };
}

fn parseEvIvLine(line: []const u8, base_value: usize) ![6]usize {
    var values: [6]usize = [_]usize{base_value} ** 6;
    var iter = std.mem.splitSequence(u8, line, ": ");
    _ = iter.next();
    const stats = iter.rest();
    var items = std.mem.splitSequence(u8, stats, "/");
    while (items.next()) |item| {
        var sections = std.mem.splitScalar(u8, trim(item), ' ');
        const value = try std.fmt.parseInt(usize, trim(sections.next().?), 10);
        const stat = trim(sections.next().?);
        if (std.mem.eql(u8, stat, "HP")) {
            values[0] = value;
        } else if (std.mem.eql(u8, stat, "Atk")) {
            values[1] = value;
        } else if (std.mem.eql(u8, stat, "Def")) {
            values[2] = value;
        } else if (std.mem.eql(u8, stat, "SpA")) {
            values[3] = value;
        } else if (std.mem.eql(u8, stat, "SpD")) {
            values[4] = value;
        } else if (std.mem.eql(u8, stat, "Spe")) {
            values[5] = value;
        } else {
            consoleLog("Invalid line: {s}", .{item});
            return error.InvalidStat;
        }
    }
    return values;
}

fn stripAccents(str: []const u8) []const u8 {
    const replacements = [_]struct { from: []const u8, to: u8 }{
        .{ .from = "é", .to = 'e' },
        .{ .from = "è", .to = 'e' },
        .{ .from = "ê", .to = 'e' },
        .{ .from = "ë", .to = 'e' },
        .{ .from = "á", .to = 'a' },
        .{ .from = "à", .to = 'a' },
        .{ .from = "ä", .to = 'a' },
        .{ .from = "â", .to = 'a' },
        .{ .from = "í", .to = 'i' },
        .{ .from = "ï", .to = 'i' },
        .{ .from = "ó", .to = 'o' },
        .{ .from = "ö", .to = 'o' },
        .{ .from = "ú", .to = 'u' },
        .{ .from = "ü", .to = 'u' },
        .{ .from = "ñ", .to = 'n' },
    };

    var out = allocator.alloc(u8, str.len) catch @panic("failed to allocate memory");
    var j: usize = 0;
    var i: usize = 0;
    while (i < str.len) {
        var replaced = false;
        for (replacements) |repl| {
            if (std.mem.startsWith(u8, str[i..], repl.from)) {
                out[j] = repl.to;
                i += repl.from.len;
                replaced = true;
                break;
            }
        }
        if (!replaced) {
            out[j] = str[i];
            i += 1;
        }
        j += 1;
    }
    return out[0..j];
}

fn isCombiningMark(cp: u21) bool {
    // Unicode combining marks: U+0300–U+036F
    return (cp >= 0x300 and cp <= 0x36F);
}

fn stripCombiningMarks(input: []const u8) ![]u8 {
    var it = std.unicode.Utf8Iterator{ .bytes = input, .i = 0 };
    var out = try allocator.alloc(u8, input.len);
    var j: usize = 0;
    while (it.nextCodepoint()) |cp| {
        if (!isCombiningMark(cp)) {
            j += std.unicode.utf8Encode(cp, out[j..]) catch @panic("utf8 encode failed");
        }
    }
    return out[0..j];
}

fn getSearchName(pokemon_name: []const u8, pokemon: ?*Pokemon) []const u8 {
    const search_name = std.mem.replaceOwned(u8, allocator, pokemon_name, " ", "-") catch @panic("failed to allocate memory");
    defer allocator.free(search_name);
    var lower = std.ascii.allocLowerString(allocator, search_name) catch @panic("failed to allocate memory");

    if (std.mem.eql(u8, lower, "calyrex-shadow-rider")) {
        if (pokemon) |p| {
            p.*.name = "Calyrex-Shadow";
        }
        allocator.free(lower);
        lower = allocator.dupe(u8, "calyrex-shadow") catch @panic("failed to allocate memory");
    } else if (std.mem.eql(u8, lower, "calyrex-ice-rider")) {
        if (pokemon) |p| {
            p.*.name = "Calyrex-Ice";
        }
        allocator.free(lower);
        lower = allocator.dupe(u8, "calyrex-ice") catch @panic("failed to allocate memory");
    } else if (std.mem.eql(u8, lower, "vivillon-pokeball")) {
        if (pokemon) |p| {
            p.*.name = "Vivillon-Pokeball";
        }
        allocator.free(lower);
        lower = allocator.dupe(u8, "vivillon-poke-ball") catch @panic("failed to allocate memory");
    }

    const strippedAccents = stripAccents(lower);
    allocator.free(lower);
    const result = stripCombiningMarks(strippedAccents) catch @panic("failed to strip combining marks");
    allocator.free(strippedAccents);

    return result;
}

const VersionReturn = struct {
    isNewVersion: bool,
    lines: [][]const u8,
};

fn isNewVersion(pokemonText: []const u8) !VersionReturn {
    var iter = std.mem.splitScalar(u8, pokemonText, '\n');

    var lines = try std.ArrayList([]const u8).initCapacity(allocator, ARRAY_LIST_INITIAL_CAPACITY);
    defer lines.deinit(allocator);

    while (iter.next()) |line| {
        try lines.append(allocator, line);
    }

    var isNew = false;
    if (lines.items.len > 1) {
        if (lines.items[1][0] == '[' and std.mem.indexOf(u8, lines.items[1], "]") != null) {
            isNew = true;
        }
    }

    const result = VersionReturn{
        .lines = try lines.toOwnedSlice(allocator),
        .isNewVersion = isNew,
    };

    return result;
}

fn parsePokemonFromLines(lines: [][]const u8, twoDImages: bool, fullMonText: []const u8) !*Pokemon {
    var pokemon = initPokemon();
    var moves = try std.ArrayList(*Move).initCapacity(allocator, EXPECTED_MOVES_COUNT);
    var other_lines = try std.ArrayList([]const u8).initCapacity(allocator, ARRAY_LIST_INITIAL_CAPACITY);

    for (0..lines.len) |line_idx| {
        const line = lines[line_idx];
        if (line.len == 0) continue;
        if (line_idx == 0) {
            var items = std.mem.splitScalar(u8, line, '@');
            var name_part = items.next().?;
            const pokemon_item = items.next();

            if (pokemon_item) |i| {
                const trim_item = trim(i);
                pokemon.item = sanitize(trim_item);
                const remove_space = std.mem.replaceOwned(u8, allocator, trim_item, " ", "") catch @panic("failed to allocate sprite");
                defer allocator.free(remove_space);
                const remove_dash = std.mem.replaceOwned(u8, allocator, remove_space, "-", "") catch @panic("failed to allocate sprite");
                defer allocator.free(remove_dash);
                const remove_apos = std.mem.replaceOwned(u8, allocator, remove_dash, "'", "") catch @panic("failed to allocate sprite");
                defer allocator.free(remove_apos);
                const search_item = std.ascii.allocLowerString(
                    allocator,
                    remove_apos,
                ) catch @panic("failed to allocate sprite");
                pokemon.item_image = getImageLink(search_item);
            }

            name_part = trim(name_part);
            if (std.mem.endsWith(u8, name_part, "(M)")) {
                pokemon.gender = 'M';
                name_part = sanitize(trim(name_part[0 .. name_part.len - 3]));
            } else if (std.mem.endsWith(u8, name_part, "(F)")) {
                pokemon.gender = 'F';
                name_part = sanitize(trim(name_part[0 .. name_part.len - 3]));
            }

            if (name_part[name_part.len - 1] == ')') {
                // Nickname present
                const start = findLastInstance(name_part, '(');
                if (start) |i| {
                    pokemon.name = sanitize(trim(name_part[i + 1 .. name_part.len - 1]));
                    pokemon.nickname = sanitize(trim(name_part[0..i]));
                } else {
                    @panic("Failed to find pokemon name");
                }
            } else {
                pokemon.name = sanitize(trim(name_part));
            }

            const name = pokemon.name;
            const span = std.mem.span(name);

            const lower = getSearchName(span, pokemon);
            defer allocator.free(lower);

            const value = searchLike(lower);
            if (value) |v| {
                pokemon.type1 = try allocator.dupeZ(u8, v.value.type1);
                if (v.value.type2.len > 0) {
                    pokemon.type2 = try allocator.dupeZ(u8, v.value.type2);
                }
            }

            const isFemale = pokemon.gender == 'F';
            const isShiny = std.mem.indexOf(u8, fullMonText, "Shiny: Yes") != null;
            pokemon.pokemon_image = getImage(lower, isFemale, isShiny, twoDImages);
        } else if (line[0] == '-') {
            const move_name = sanitize(trim(line[1..]));
            const move = try allocator.create(Move);
            const move_slug = try std.mem.replaceOwned(u8, allocator, move_name, " ", "-");
            const move_lookup = try std.ascii.allocLowerString(allocator, move_slug);
            allocator.free(move_slug);
            move.* = .{
                .name = move_name,
                .type1 = &[_:0]u8{0},
            };

            if (data.MOVES.get(move_lookup)) |v| {
                move.type1 = try allocator.dupeZ(u8, v.type1);
            }
            allocator.free(move_lookup);

            moves.append(allocator, move) catch @panic("failed to append move");
        } else if (std.mem.startsWith(u8, line, "EVs:")) {
            pokemon.evs = try parseEvIvLine(line, 0);
            var idx: i64 = 5;
            while (idx > 0) {
                if (pokemon.evs[@intCast(idx)] != 0) {
                    break;
                }
                idx -= 1;
            }
            switch (idx) {
                -1 => pokemon.last_stat_ev = "\x00",
                0 => pokemon.last_stat_ev = "hp\x00",
                1 => pokemon.last_stat_ev = "atk\x00",
                2 => pokemon.last_stat_ev = "def\x00",
                3 => pokemon.last_stat_ev = "spa\x00",
                4 => pokemon.last_stat_ev = "spd\x00",
                5 => pokemon.last_stat_ev = "spe\x00",
                else => @panic("Invalid EV index"),
            }
        } else if (std.mem.startsWith(u8, line, "IVs:")) {
            pokemon.ivs = try parseEvIvLine(line, 31);
            var idx: i64 = 5;
            while (idx > 0) {
                if (pokemon.ivs[@intCast(idx)] != 31) {
                    break;
                }
                idx -= 1;
            }
            switch (idx) {
                -1 => pokemon.last_stat_iv = "\x00",
                0 => pokemon.last_stat_iv = "hp\x00",
                1 => pokemon.last_stat_iv = "atk\x00",
                2 => pokemon.last_stat_iv = "def\x00",
                3 => pokemon.last_stat_iv = "spa\x00",
                4 => pokemon.last_stat_iv = "spd\x00",
                5 => pokemon.last_stat_iv = "spe\x00",
                else => @panic("Invalid IV index"),
            }
        } else if (std.mem.startsWith(u8, line, "Ability: ")) {
            pokemon.ability = clean(line[9..]);
        } else if (std.mem.startsWith(u8, line, "Level: ")) {
            pokemon.level = try std.fmt.parseInt(usize, trim(line[7..]), 10);
        } else if (std.mem.startsWith(u8, line, "Shiny: ")) {
            pokemon.shiny = clean(line[7..]);
        } else if (std.mem.startsWith(u8, line, "Hidden Power: ")) {
            pokemon.hidden_power = clean(line[12..]);
        } else if (std.mem.startsWith(u8, line, "Tera Type: ")) {
            pokemon.tera_type = clean(line[10..]);
        } else if (std.mem.endsWith(u8, trim(line), "Nature")) {
            pokemon.nature = clean(line);
        } else {
            try other_lines.append(allocator, trim(line));
        }
    }

    pokemon.moves_len = moves.items.len;
    pokemon.moves = moves.items.ptr;

    if (other_lines.items.len > 0) {
        pokemon.lines_count = other_lines.items.len;

        // Allocate space for item pointers
        const lines_slice = try allocator.alloc([*:0]const u8, other_lines.items.len);

        // Duplicate each item string and store pointers
        for (other_lines.items, 0..) |line, i| {
            lines_slice[i] = sanitize(line);
        }
        pokemon.lines = lines_slice.ptr;
    }

    return pokemon;
}

fn parsePokemonFromLinesNew(lines: [][]const u8, twoDImages: bool) !*Pokemon {
    const pokemon = initPokemon();

    var moves = try std.ArrayList(*Move).initCapacity(allocator, EXPECTED_MOVES_COUNT);
    var other_lines = try std.ArrayList([]const u8).initCapacity(allocator, ARRAY_LIST_INITIAL_CAPACITY);

    for (0..lines.len) |line_idx| {
        const line = lines[line_idx];
        if (line_idx == 0) {
            var name_line = line;
            if (line[0] == '(') {
                // Nickname present
                const end = std.mem.indexOf(u8, line, ")") orelse {
                    return error.InvalidPokemon;
                };
                const nickname = line[1..end];
                name_line = line[end + 1 ..];
                pokemon.nickname = sanitize(trim(nickname));
            }

            if (std.mem.endsWith(u8, name_line, " (M)")) {
                pokemon.gender = 'M';
            } else if (std.mem.endsWith(u8, name_line, " (F)")) {
                pokemon.gender = 'F';
            }
            if (pokemon.gender != 0) {
                name_line = name_line[0 .. name_line.len - 4];
            }
            pokemon.name = sanitize(trim(name_line));
        } else if (line[0] == '[' or line[0] == '@') {
            // Ability
            if (line[0] == '[') {
                const end = std.mem.indexOf(u8, line, "]") orelse {
                    return error.InvalidPokemon;
                };
                const ability = line[1..end];
                pokemon.ability = clean(ability);
            }
            if (std.mem.indexOf(u8, line, "@ ") != null) {
                var split = std.mem.splitSequence(u8, line, "@ ");
                // Skip the first.
                _ = split.next();
                const item_opt = split.next();
                if (item_opt) |item| {
                    const trim_item = trim(item);
                    pokemon.item = clean(trim_item);
                    const remove_space = std.mem.replaceOwned(u8, allocator, trim_item, " ", "") catch @panic("failed to allocate sprite");
                    defer allocator.free(remove_space);
                    const remove_dash = std.mem.replaceOwned(u8, allocator, remove_space, "-", "") catch @panic("failed to allocate sprite");
                    defer allocator.free(remove_dash);
                    const search_item = std.ascii.allocLowerString(
                        allocator,
                        remove_dash,
                    ) catch @panic("failed to allocate sprite");
                    pokemon.item_image = getImageLink(search_item);
                }
            }
        } else if (line[0] == '-') {
            const move_name = clean(line[1..]);
            if (move_name.len == 0) {
                continue;
            }
            const move = try allocator.create(Move);
            const move_slug = try std.mem.replaceOwned(u8, allocator, move_name, " ", "-");
            const move_lookup = try std.ascii.allocLowerString(allocator, move_slug);
            allocator.free(move_slug);
            move.* = .{
                .name = move_name,
                .type1 = &[_:0]u8{0},
            };

            if (data.MOVES.get(move_lookup)) |v| {
                move.type1 = try allocator.dupeZ(u8, v.type1);
            }
            allocator.free(move_lookup);

            try moves.append(allocator, move);
        } else if (std.mem.startsWith(u8, line, "EVs: ")) {
            const evStats = try parseEvIvLineNew(line, 0);
            pokemon.evs = evStats.stats;
            pokemon.nature = sanitize(trim(evStats.nature));

            var idx: i64 = 5;
            while (idx > 0) {
                if (pokemon.evs[@intCast(idx)] != 0) {
                    break;
                }
                idx -= 1;
            }
            switch (idx) {
                -1 => pokemon.last_stat_ev = "\x00",
                0 => pokemon.last_stat_ev = "hp\x00",
                1 => pokemon.last_stat_ev = "atk\x00",
                2 => pokemon.last_stat_ev = "def\x00",
                3 => pokemon.last_stat_ev = "spa\x00",
                4 => pokemon.last_stat_ev = "spd\x00",
                5 => pokemon.last_stat_ev = "spe\x00",
                else => @panic("Invalid EV index"),
            }
        } else if (std.mem.startsWith(u8, line, "IVs: ")) {
            const ivStats = try parseEvIvLineNew(line, 31);
            pokemon.ivs = ivStats.stats;

            var idx: i64 = 5;
            while (idx > 0) {
                if (pokemon.ivs[@intCast(idx)] != 31) {
                    break;
                }
                idx -= 1;
            }
            switch (idx) {
                -1 => pokemon.last_stat_iv = "\x00",
                0 => pokemon.last_stat_iv = "hp\x00",
                1 => pokemon.last_stat_iv = "atk\x00",
                2 => pokemon.last_stat_iv = "def\x00",
                3 => pokemon.last_stat_iv = "spa\x00",
                4 => pokemon.last_stat_iv = "spd\x00",
                5 => pokemon.last_stat_iv = "spe\x00",
                else => @panic("Invalid IV index"),
            }
        } else if (std.mem.startsWith(u8, line, "Shiny")) {
            pokemon.shiny = sanitize(trim("Yes"));
        } else if (std.mem.startsWith(u8, line, "Level: ")) {
            pokemon.level = try std.fmt.parseInt(usize, trim(line[7..]), 10);
        } else if (std.mem.startsWith(u8, line, "Hidden Power: ")) {
            pokemon.hidden_power = clean(line[12..]);
        } else if (std.mem.startsWith(u8, line, "Tera Type: ")) {
            pokemon.tera_type = clean(line[10..]);
        } else {
            try other_lines.append(allocator, trim(line));
        }
    }

    const name = pokemon.name;
    const span = std.mem.span(name);

    const lower = getSearchName(span, pokemon);
    defer allocator.free(lower);

    const value = searchLike(lower);
    if (value) |v| {
        pokemon.type1 = try allocator.dupeZ(u8, v.value.type1);
        if (v.value.type2.len > 0) {
            pokemon.type2 = try allocator.dupeZ(u8, v.value.type2);
        }
    }

    const isFemale = pokemon.gender == 'F';
    const shinyValue: []const u8 = std.mem.span(pokemon.shiny);
    const isShiny = std.mem.eql(u8, shinyValue, "Yes");
    pokemon.pokemon_image = getImage(lower, isFemale, isShiny, twoDImages);

    if (moves.items.len > 0) {
        pokemon.moves_len = moves.items.len;
    } else {
        pokemon.moves_len = 0;
    }
    pokemon.moves = moves.items.ptr;

    // Allocate space for item pointers
    const lines_slice = try allocator.alloc([*:0]const u8, other_lines.items.len);
    if (other_lines.items.len > 0) {
        pokemon.lines_count = other_lines.items.len;

        // Duplicate each item string and store pointers
        for (other_lines.items, 0..) |line, i| {
            lines_slice[i] = sanitize(line);
        }
    } else {
        pokemon.lines_count = 0;
    }
    pokemon.lines = lines_slice.ptr;

    return pokemon;
}

fn parsePokemon(item: []const u8, twoDImages: bool) !*Pokemon {
    consoleLog("Parsing pokemon: {s}", .{item});
    const result = try isNewVersion(item);
    if (!result.isNewVersion) {
        return parsePokemonFromLines(result.lines, twoDImages, item);
    }
    return parsePokemonFromLinesNew(result.lines, twoDImages);
}

const EXPECTED_MOVES_COUNT = 4;
const EXPECTED_POKEMON_COUNT = 6;

export fn parsePaste(buffer: [*]u8, buffer_len: usize, twoDimages: bool) *Paste {
    data.init() catch |err| {
        consoleLog("Failed to initialize data - {any}", .{err});
        @panic("failed to initialize data");
    };

    const string = buffer[0..buffer_len];
    const json_data = std.json.parseFromSlice(Data, allocator, string, .{}) catch {
        consoleLog("Failed to parse JSON", .{});
        @panic("failed to parse JSON");
    };
    const value = json_data.value;

    const paste = allocator.create(Paste) catch @panic("failed to allocate Paste");

    if (value.title.len == 0) {
        paste.title = "Untitled\x00";
    } else {
        paste.title = sanitize(value.title);
    }

    if (value.author.len == 0) {
        paste.author = "\x00";
    } else {
        paste.author = sanitize(value.author);
    }

    if (value.format.len == 0) {
        paste.format = "\x00";
    } else {
        paste.format = sanitize(value.format);
    }

    if (value.rental.len == 0) {
        paste.rental = "\x00";
    } else {
        paste.rental = sanitize(value.rental);
    }

    // HTML escape the notes.
    if (value.notes.len == 0) {
        paste.notes = "\x00";
    } else {
        paste.notes = sanitize(value.notes);
    }

    var pokemon_list = std.ArrayList(*Pokemon).initCapacity(
        allocator,
        EXPECTED_POKEMON_COUNT,
    ) catch @panic("failed to allocate pokemon list");

    var iter = std.mem.splitSequence(u8, value.content, "\n\n");
    while (iter.next()) |item| {
        if (item.len == 0) continue;
        const pokemon = parsePokemon(
            std.mem.trim(u8, item, "\n \t"),
            twoDimages,
        ) catch |err| {
            consoleLog("Failed to parse pokemon: {any}", .{err});
            @panic("Failed to parse pokemon");
        };
        pokemon_list.append(allocator, pokemon) catch @panic("failed to append pokemon");
    }

    paste.pokemon_len = pokemon_list.items.len;
    paste.pokemon = pokemon_list.items.ptr;

    var is_ots = true;
    for (0..paste.pokemon_len) |i| {
        const pokemon = paste.pokemon[i];
        const last_stat_iv = std.mem.span(pokemon.last_stat_iv);
        const last_stat_ev = std.mem.span(pokemon.last_stat_ev);
        if (!std.mem.eql(u8, last_stat_iv, "") or !std.mem.eql(u8, last_stat_ev, "")) {
            is_ots = false;
            break;
        }
    }
    paste.isOts = @intFromBool(is_ots);

    return paste;
}
