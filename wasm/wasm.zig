const std = @import("std");
const crypto = std.crypto;
const zcrypto = @import("crypto.zig");
const data = @import("data.zig");

var arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
const allocator = arena.allocator();

extern "env" fn _throwError(pointer: [*]const u8, length: u32) noreturn;
extern "env" fn _consoleLog(pointer: [*]const u8, length: u32) void;

pub fn throwError(message: []const u8) noreturn {
    _throwError(message.ptr, message.len);
}

const RndGen = std.Random.DefaultPrng;
pub var rand: std.Random.DefaultPrng = undefined;

export fn init(seed: u64) void {
    rand = RndGen.init(seed);
}

pub fn consoleLog(comptime fmt: []const u8, args: anytype) void {
    const msg = std.fmt.allocPrint(allocator, fmt, args) catch
        @panic("failed to allocate memory for consoleLog message");
    defer allocator.free(msg);
    _consoleLog(msg.ptr, msg.len);
}

export fn allocUint8(length: u32) [*]const u8 {
    const slice = allocator.alloc(u8, length) catch
        @panic("failed to allocate memory");
    return slice.ptr;
}

export fn free(pointer: u32, length: u32) void {
    const slice: [*]u8 = @ptrFromInt(pointer);
    return allocator.free(slice[0..length]);
}

// Reset the arena
export fn resetArena() void {
    arena.deinit();
    arena = std.heap.ArenaAllocator.init(std.heap.page_allocator);
    zcrypto.result_ptr = 0;
    zcrypto.result_len = 0;
}

fn destroy(comptime T: type, pointer: u32) void {
    const ptr: *T = @ptrFromInt(pointer);
    allocator.destroy(ptr);
}

export fn getResultPtr() u32 {
    return zcrypto.getResultPtr();
}

export fn getResultLen() u32 {
    return zcrypto.getResultLen();
}

export fn encryptMessage(
    buffer_ptr: [*]u8,
    passphrase_len: usize,
    message_len: usize,
) bool {
    return zcrypto.encryptMessage(
        allocator,
        buffer_ptr,
        passphrase_len,
        message_len,
    );
}

export fn decryptMessage(buffer_ptr: [*]u8, passphrase_len: usize, encrypted_len: usize) bool {
    return zcrypto.decryptMessage(
        allocator,
        buffer_ptr,
        passphrase_len,
        encrypted_len,
    );
}

const max_bytes = @floor(450 * 1.25);
const max_line_len = @floor(65 * 1.25);
const max_lines_per_item = @floor(16 * 1.25);
const showdown_box_size = 24;

// Return code:
// 0 - success
// 1 - item too many bytes
// 2 - line too long
// 3 - line contains invalid content
// 4 - paste has too many lines
// 5 - item add error
// 6 - too many pokemon
export fn validatePaste(pastePtr: [*]u8, paste_len: usize) usize {
    const paste = pastePtr[0..paste_len];

    var iter = std.mem.splitSequence(u8, paste, "\n\n");
    var items = std.ArrayList([]const u8).init(allocator);

    while (iter.next()) |item| {
        if (item.len == 0) continue;
        if (item.len > max_bytes) return 1;

        var lines = std.mem.splitAny(u8, item, "\n");
        var line_count: usize = 1;
        while (lines.next()) |l| {
            if (l.len > max_line_len) return 2;
            if (l.len == 0) continue;
            if (line_count > 1) {
                if (std.mem.indexOf(u8, l, "https://") != null //
                or std.mem.indexOf(u8, l, "http://") != null //
                or std.mem.indexOf(u8, l, "www.") != null //
                or std.mem.indexOf(u8, l, ".com") != null //
                or std.mem.indexOfAny(u8, l, "><.,!?+") != null //
                ) {
                    return 3;
                }

                // Should be A-Z or a `-`
                const startingChar = l[0];
                if (!((startingChar >= 'A' and startingChar <= 'Z') or
                    startingChar == '-'))
                {
                    return 3;
                }
            }
            line_count += 1;
        }
        if (line_count > max_lines_per_item) return 4;

        items.append(item) catch return 5;

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
    var output = std.ArrayList(u8).init(allocator);
    defer output.deinit();

    for (str) |c| {
        switch (c) {
            '<' => output.appendSlice("&lt;") catch @panic("failed to append slice"),
            '>' => output.appendSlice("&gt;") catch @panic("failed to append slice"),
            '&' => output.appendSlice("&amp;") catch @panic("failed to append slice"),
            '"' => output.appendSlice("&quot;") catch @panic("failed to append slice"),
            '\'' => output.appendSlice("&apos;") catch @panic("failed to append slice"),
            else => output.append(c) catch @panic("failed to append"),
        }
    }

    return allocator.dupeZ(u8, output.items) catch @panic("failed to allocate sanitized string");
}

fn initPokemon() *Pokemon {
    const pokemon = allocator.create(Pokemon) catch @panic("failed to allocate Pokemon");
    const pokemonStruct = Pokemon{
        .name = &[_:0]u8{0},
        .nickname = &[_:0]u8{0},
        .item = &[_:0]u8{0},
        .gender = 0,
        .item_image = &[_:0]u8{0},
        .pokemon_image = &[_:0]u8{0},
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
    const pat = patIter.next().?;
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

    return null;
}

fn getImageLink(item: []const u8) [*:0]const u8 {
    const missing = ("background: transparent url(\"assets/missing.png\") no-repeat; height: 64px !important; width: 64px!important; background-position: 5px 10px");
    var value = data.ITEMS.get(item);
    if (value == null) {
        // Remove the `-` and ` `
        const no_dash = std.mem.replaceOwned(u8, allocator, item, "-", "") catch @panic("failed to allocate memory");
        const no_space = std.mem.replaceOwned(u8, allocator, no_dash, " ", "") catch @panic("failed to allocate memory");
        value = data.ITEMS.get(no_space);
        allocator.free(no_space);
        allocator.free(no_dash);
    }
    if (value) |v| {
        const sprite_num: i64 = v.spritenum;
        const top: i64 = @divFloor(sprite_num, 16) * 24 * 2;
        const left: i64 = @mod(sprite_num, 16) * 24 * 2;
        return std.fmt.allocPrintZ(allocator, "background: transparent url(\"assets/sprites\") -{d}px -{d}px no-repeat;", .{ left, top }) catch @panic("failed to allocate sprite");
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
        const random_decoration_idx = rand.random().intRangeAtMost(usize, 0, alcremie_decorations.len - 1);
        const decoration = alcremie_decorations[random_decoration_idx];
        if (is_shiny) {
            return std.fmt.allocPrintZ(allocator, "{s}/shiny/869-{s}.png", .{ base_path, decoration }) catch @panic("failed to allocate sprite");
        }
        const flavor = getFlavor(pokemon);
        return std.fmt.allocPrintZ(allocator, "{s}/869-{s}-{s}.png", .{ base_path, flavor, decoration }) catch @panic("failed to allocate sprite");
    }

    const value = data.POKEMON.get(pokemon);
    if (value) |v| {
        if (is_shiny and v.has_shiny) {
            if (twoDImages) {
                const id_str = std.fmt.allocPrint(allocator, "{d}", .{v.id}) catch @panic("failed to allocate sprite");
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

        return std.fmt.allocPrintZ(allocator, "{s}/{d}.png", .{ base_path, v.id }) catch @panic("failed to allocate sprite");
    }

    const search_like_value = searchLike(pokemon);
    if (search_like_value) |v| {
        if (is_shiny and v.value.has_shiny) {
            if (twoDImages) {
                const id_str = std.fmt.allocPrint(allocator, "{d}", .{v.value.id}) catch @panic("failed to allocate sprite");
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
        return std.fmt.allocPrintZ(allocator, "{s}/{d}.png", .{ base_path, v.value.id }) catch @panic("failed to allocate sprite");
    }

    var items = std.mem.splitScalar(u8, pokemon, '-');
    const species = items.next().?;
    const species_value = data.POKEMON.get(species);
    if (species_value) |v| {
        const remaining = items.rest();
        const id = std.fmt.allocPrintZ(allocator, "{d}-{s}", .{ v.id, remaining }) catch @panic("failed to allocate sprite");

        if (is_shiny and v.has_shiny) {
            if (twoDImages) {
                const id_str = std.fmt.allocPrint(allocator, "{d}", .{v.id}) catch @panic("failed to allocate sprite");
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
        return std.fmt.allocPrintZ(allocator, "{s}/{s}.png", .{ base_path, id }) catch @panic("failed to allocate sprite");
    }

    const egg_path = std.fmt.allocPrintZ(allocator, "home/0.png", .{}) catch @panic("failed to allocate sprite");
    return egg_path;
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

fn parsePokemon(item: []const u8, twoDImages: bool) !*Pokemon {
    const pokemon = initPokemon();
    var lines = std.mem.splitScalar(u8, item, '\n');
    var line_idx: usize = 0;

    var moves = std.ArrayList(*Move).init(allocator);
    var other_lines = std.ArrayList([]const u8).init(allocator);

    while (lines.next()) |line| {
        if (line.len == 0) continue;
        if (line_idx == 0) {
            var items = std.mem.splitScalar(u8, line, '@');
            var name_part = items.next().?;
            const pokemon_item = items.next();

            if (pokemon_item) |i| {
                const trim_item = trim(i);
                pokemon.item = sanitize(trim_item);
                const remove_space = std.mem.replaceOwned(u8, allocator, trim_item, " ", "") catch @panic("failed to allocate sprite");
                const search_item = std.ascii.allocLowerString(
                    allocator,
                    remove_space,
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

            const search_name = try std.mem.replaceOwned(u8, allocator, span, " ", "-");
            defer allocator.free(search_name);

            var lower = try std.ascii.allocLowerString(allocator, search_name);
            defer allocator.free(lower);

            if (std.mem.eql(u8, lower, "calyrex-shadow-rider")) {
                pokemon.name = "Calyrex-Shadow";
                allocator.free(lower);
                lower = try allocator.dupe(u8, "calyrex-shadow");
            } else if (std.mem.eql(u8, lower, "calyrex-ice-rider")) {
                pokemon.name = "Calyrex-Ice";
                allocator.free(lower);
                lower = try allocator.dupe(u8, "calyrex-ice");
            } else if (std.mem.eql(u8, lower, "vivillon-pokeball")) {
                pokemon.name = "Vivillon-Pokeball";
                allocator.free(lower);
                lower = try allocator.dupe(u8, "vivillon-poke-ball");
            }

            const value = searchLike(lower);
            if (value) |v| {
                pokemon.type1 = try allocator.dupeZ(u8, v.value.type1);
                if (v.value.type2.len > 0) {
                    pokemon.type2 = try allocator.dupeZ(u8, v.value.type2);
                }
            }

            const isFemale = pokemon.gender == 'F';
            const isShiny = std.mem.indexOf(u8, item, "Shiny: Yes") != null;
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

            moves.append(move) catch @panic("failed to append move");
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
            pokemon.ability = sanitize(trim(line[9..]));
        } else if (std.mem.startsWith(u8, line, "Level: ")) {
            pokemon.level = try std.fmt.parseInt(usize, trim(line[7..]), 10);
        } else if (std.mem.startsWith(u8, line, "Shiny: ")) {
            pokemon.shiny = sanitize(trim(line[7..]));
        } else if (std.mem.startsWith(u8, line, "Hidden Power: ")) {
            pokemon.hidden_power = sanitize(trim(line[12..]));
        } else if (std.mem.startsWith(u8, line, "Tera Type: ")) {
            pokemon.tera_type = sanitize(trim(line[10..]));
        } else if (std.mem.endsWith(u8, trim(line), "Nature")) {
            pokemon.nature = sanitize(trim(line));
        } else {
            try other_lines.append(trim(line));
        }
        line_idx += 1;
    }

    if (moves.items.len > 0) {
        pokemon.moves_len = moves.items.len;
        pokemon.moves = moves.items.ptr;
    }

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

    var pokemon_list = std.ArrayList(*Pokemon).init(allocator);

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
        pokemon_list.append(pokemon) catch @panic("failed to append pokemon");
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
