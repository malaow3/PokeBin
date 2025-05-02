const std = @import("std");
const brotli = @import("src/brotli.zig");

const wasm_file_name = "wasm";

pub fn build(b: *std.Build) void {
    // Standard target options and optimization options
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const brotli_pkg = b.dependency("brotli", .{});
    const brotli_lib = brotli_pkg.artifact("brotli");

    // -----------------------------------------------------------------------
    // Define dependencies (zlog, httpz, zul, okredis)
    const zlog = b.dependency("zlog", .{});
    const http = b.dependency("httpz", .{});
    const zul = b.dependency("zul", .{});
    const okredis = b.dependency("okredis", .{});
    const pg = b.dependency("pg", .{});

    // -----------------------------------------------------------------------
    // Create modules (lib_mod, exe_mod, redis)
    const lib_mod = b.createModule(.{
        .root_source_file = b.path("src/root.zig"),
        .target = target,
        .optimize = optimize,
    });
    const exe_mod = b.createModule(.{
        .root_source_file = b.path("src/main.zig"),
        .target = target,
        .optimize = optimize,
    });
    const redis = b.createModule(.{
        .root_source_file = b.path("src/okredis.zig"),
        .target = target,
        .optimize = optimize,
    });
    const pgMod = b.createModule(.{
        .root_source_file = b.path("src/pg.zig"),
        .target = target,
        .optimize = optimize,
    });

    // Add imports to modules
    exe_mod.addImport("pokebin_lib", lib_mod);
    exe_mod.addImport("redis", redis);
    exe_mod.addImport("zlog", zlog.module("zlog"));
    exe_mod.addImport("httpz", http.module("httpz"));
    exe_mod.addImport("zul", zul.module("zul"));
    exe_mod.linkLibrary(brotli_lib);
    exe_mod.addIncludePath(brotli_pkg.path("c/include"));

    lib_mod.addImport("redis", redis);
    lib_mod.addImport("zlog", zlog.module("zlog"));
    lib_mod.addImport("zul", zul.module("zul"));

    redis.addImport("zlog", zlog.module("zlog"));
    redis.addImport("okredis", okredis.module("okredis"));

    pgMod.addImport("pg", pg.module("pg"));

    // -----------------------------------------------------------------------
    // Create the WASM module
    const wasm_target = b.resolveTargetQuery(.{
        .cpu_arch = .wasm32,
        .os_tag = .freestanding,
    });
    const wasm_module = b.createModule(.{
        .root_source_file = b.path("wasm/wasm.zig"),
        .target = wasm_target,
        .optimize = optimize,
    });

    const wasm = b.addExecutable(.{
        .name = wasm_file_name,
        .root_module = wasm_module,
    });
    wasm.entry = .disabled; // Disable the entry point
    wasm.rdynamic = true; // Enable rdynamic linking

    const wasm_check = b.addExecutable(.{
        .name = "wasm-check",
        .root_module = wasm_module,
    });

    b.installArtifact(wasm);
    // -----------------------------------------------------------------------
    // Create the WASM compression step
    const wasm_compress_step = b.step("compress-wasm", "Compress WASM files with gzip");

    // Create a custom step for compression
    wasm_compress_step.makeFn = makeWasm;

    // -----------------------------------------------------------------------
    // Create the main executable (pokebin)
    const exe = b.addExecutable(.{
        .name = "pokebin",
        .root_module = exe_mod,
        .use_llvm = false,
        .use_lld = false,
    });
    b.installArtifact(exe); // Install the executable
    wasm_compress_step.dependOn(b.getInstallStep());

    // -----------------------------------------------------------------------
    // Standard build steps (run, test, check) - keep these at the end

    // Add a run step (if needed)
    const run_cmd = b.addRunArtifact(exe);
    run_cmd.step.dependOn(b.getInstallStep());
    run_cmd.step.dependOn(wasm_compress_step);
    if (b.args) |args| {
        run_cmd.addArgs(args);
    }
    const run_step = b.step("run", "Run the app");
    run_step.dependOn(&run_cmd.step);

    // Add unit test steps
    const lib_unit_tests = b.addTest(.{ .root_module = lib_mod });
    const run_lib_unit_tests = b.addRunArtifact(lib_unit_tests);
    const exe_unit_tests = b.addTest(.{ .root_module = exe_mod });
    const run_exe_unit_tests = b.addRunArtifact(exe_unit_tests);
    const test_step = b.step("test", "Run unit tests");
    test_step.dependOn(&run_lib_unit_tests.step);
    test_step.dependOn(&run_exe_unit_tests.step);

    // Add a check step
    const exe_check = b.addExecutable(.{ .name = "check", .root_module = exe_mod });
    const check = b.step("check", "Check if the app compiles");
    check.dependOn(&exe_check.step);
    check.dependOn(&wasm_check.step);
}

// -----------------------------------------------------------------------
// Function to compress the WASM file
fn makeWasm(step: *std.Build.Step, options: std.Build.Step.MakeOptions) anyerror!void {
    std.debug.print("Compressing WASM file\n", .{});
    _ = options;
    const b = step.owner;
    const allocator = b.allocator;

    // Get install directory. This is where zig will put the file
    const output_dir = b.install_path;
    const bin_dir = std.fs.path.join(allocator, &.{ output_dir, "bin" }) catch unreachable;
    defer allocator.free(bin_dir);

    const wasm_file_ext = std.fmt.allocPrint(allocator, "{s}.wasm", .{wasm_file_name}) catch unreachable;
    const wasm_file_path = std.fs.path.join(allocator, &.{ bin_dir, wasm_file_ext }) catch unreachable;

    std.debug.print("wasm_file_path: {s}\n", .{wasm_file_path});

    const compressed_file_name = std.fmt.allocPrint(allocator, "{s}.br", .{wasm_file_ext}) catch unreachable;
    const compressed_file_path = std.fs.path.join(allocator, &.{ bin_dir, compressed_file_name }) catch unreachable;

    // Compress WASM data
    try brotli.compressWithBrotli(allocator, wasm_file_path, compressed_file_path);

    std.debug.print("Compressed WASM file: {s} -> {s}\n", .{ wasm_file_path, compressed_file_path });
}
