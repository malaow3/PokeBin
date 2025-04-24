{
  description = "PokeBin Zig development environment";

  inputs = {
    nixpkgs-unstable.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    nixpkgs-stable.url = "github:NixOS/nixpkgs/release-24.11";
    flake-utils.url = "github:numtide/flake-utils";

    # Uncomment this if you want to use Zig via Flake -- I prefer to use the tip of master as opposed to nightly.
    #
    # zig = {
    #   url = "github:mitchellh/zig-overlay";
    #   inputs = {
    #     nixpkgs.follows = "nixpkgs-stable";
    #     flake-utils.follows = "flake-utils";
    #   };
    # };
  };

  outputs = {
    self,
    nixpkgs-unstable,
    nixpkgs-stable,
    flake-utils,
    # zig,
    ...
  }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs-stable = nixpkgs-stable.legacyPackages.${system};
        pkgs-unstable = nixpkgs-unstable.legacyPackages.${system};

        # zigVersion = "master";
        
        # Check if the current system is Linux
        isLinux = builtins.match ".*linux.*" system != null;
        
        # Conditionally include valgrind only on Linux
        valgrindPackage = if isLinux then [ pkgs-unstable.valgrind ] else [];
        
        # Conditionally include valgrind-related shell hook text
        valgrindHook = if isLinux then ''
          echo "Valgrind version: $(valgrind --version)"
          echo "  valgrind --leak-check=full ./zig-out/bin/pokebin_zig - Check for memory leaks"
        '' else "";
      in
      {
        devShells.default = pkgs-stable.mkShell {
          buildInputs = [

            # Enable these if you want to use Zig via Flake -- I prefer to use the tip of master as opposed to nightly.
            # zig.packages.${system}.${zigVersion}
            # pkgs-stable.zls

            pkgs-stable.redis
            pkgs-stable.brotli
            pkgs-unstable.blueprint-compiler # remove once blueprint-compiler 0.16.0 is in the stable nixpkgs
          ] ++ valgrindPackage;

          shellHook = ''
            echo "PokeBin Zig development environment"
            echo "Zig version: $(zig version)"
            ${valgrindHook}
            echo ""
            echo "Useful commands:"
            echo "  zig build        - Build the project"
            echo "  zig build run    - Run the project"
            echo "  zig build test   - Run tests"
            echo ""
          '';
        };

        packages.default = pkgs-unstable.stdenv.mkDerivation {
          pname = "pokebin-zig";
          version = "2.0.0";
          src = ./.;

          # nativeBuildInputs = [ zig.packages.${system}.${zigVersion} ];

          buildPhase = ''
            zig build -Doptimize=ReleaseSafe
          '';

          installPhase = ''
            mkdir -p $out/bin
            cp zig-out/bin/pokebin_zig $out/bin/
          '';
        };
      }
    );
}
