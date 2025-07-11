const std = @import("std");
const brotli = @import("src/brotli.zig");
const build_zig_zon = @embedFile("build.zig.zon");

const wasm_file_name = "wasm";

pub fn build(b: *std.Build) void {
    // Standard target options and optimization options
    const target = b.standardTargetOptions(.{});
    const optimize = b.standardOptimizeOption(.{});

    const brotli_pkg = b.dependency("brotli", .{
        .target = target,
        .optimize = optimize,
    });
    const brotli_lib = brotli_pkg.artifact("brotli");

    // -----------------------------------------------------------------------
    const zlog = b.dependency("zlog", .{});
    const http = b.dependency("httpz", .{});
    const zul = b.dependency("zul", .{});
    const pg = b.dependency("pg", .{});
    const qr = b.dependency("qr", .{});

    // -----------------------------------------------------------------------
    // Create modules (lib_mod, exe_mod)
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
    var options = std.Build.Step.Options.create(b);
    options.addOption([]const u8, "contents", build_zig_zon);
    exe_mod.addOptions("build.zig.zon", options);

    // Add imports to modules
    exe_mod.addImport("pokebin_lib", lib_mod);
    exe_mod.addImport("zlog", zlog.module("zlog"));
    exe_mod.addImport("httpz", http.module("httpz"));
    exe_mod.addImport("zul", zul.module("zul"));
    exe_mod.linkLibrary(brotli_lib);
    exe_mod.addIncludePath(brotli_pkg.path("c/include"));
    exe_mod.addImport("pg", pg.module("pg"));
    exe_mod.addImport("qr", qr.module("qr"));

    lib_mod.addImport("zlog", zlog.module("zlog"));
    lib_mod.addImport("zul", zul.module("zul"));

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

    const web_wasm_module = b.createModule(.{
        .root_source_file = b.path("wasm/web_wasm.zig"),
        .target = wasm_target,
        .optimize = optimize,
    });
    web_wasm_module.addImport("qr", qr.module("qr"));

    const web_wasm = b.addExecutable(.{
        .name = "web_wasm",
        .root_module = web_wasm_module,
    });
    web_wasm.entry = .disabled; // Disable the entry point
    web_wasm.rdynamic = true; // Enable rdynamic linking

    const web_wasm_check = b.addExecutable(.{
        .name = "web-wasm-check",
        .root_module = web_wasm_module,
    });

    b.installArtifact(wasm);
    b.installArtifact(web_wasm);
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
        // .use_llvm = false,
        // .use_lld = false,
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
    check.dependOn(&web_wasm_check.step);
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

    var wasm_file_ext = std.fmt.allocPrint(allocator, "{s}.wasm", .{wasm_file_name}) catch unreachable;
    var wasm_file_path = std.fs.path.join(allocator, &.{ bin_dir, wasm_file_ext }) catch unreachable;

    std.debug.print("wasm_file_path: {s}\n", .{wasm_file_path});

    var compressed_file_name = std.fmt.allocPrint(allocator, "{s}.br", .{wasm_file_ext}) catch unreachable;
    var compressed_file_path = std.fs.path.join(allocator, &.{ bin_dir, compressed_file_name }) catch unreachable;

    // Compress WASM data
    try brotli.compressWithBrotli(allocator, wasm_file_path, compressed_file_path);
    std.debug.print("Compressed WASM file: {s} -> {s}\n", .{ wasm_file_path, compressed_file_path });

    wasm_file_ext = std.fmt.allocPrint(allocator, "web_wasm.wasm", .{}) catch unreachable;
    wasm_file_path = std.fs.path.join(allocator, &.{ bin_dir, wasm_file_ext }) catch unreachable;

    std.debug.print("wasm_file_path: {s}\n", .{wasm_file_path});

    compressed_file_name = std.fmt.allocPrint(allocator, "{s}.br", .{wasm_file_ext}) catch unreachable;
    compressed_file_path = std.fs.path.join(allocator, &.{ bin_dir, compressed_file_name }) catch unreachable;

    // Compress WASM data
    try brotli.compressWithBrotli(allocator, wasm_file_path, compressed_file_path);

    std.debug.print("Compressed WASM file: {s} -> {s}\n", .{ wasm_file_path, compressed_file_path });
}
