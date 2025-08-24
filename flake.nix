{
  description = "PokeBin Zig development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixpkgs-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils, ... }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        # Detect platform
        isLinux = builtins.match ".*linux.*" system != null;
        isDarwin = builtins.match ".*darwin.*" system != null;

        # Cross toolchain (Linux target)
        cross = pkgs.pkgsCross.gnu64;
      in
      {
        # Native dev shell
        devShells.default = pkgs.mkShell {
          buildInputs =
            [
              pkgs.yq
              pkgs.brotli
              pkgs.pkg-config
            ]
            ++ (if isLinux then [ pkgs.openssl ] else [])
            ++ (if isDarwin then [ pkgs.openssl ] else []); # or rely on Homebrew

          shellHook = ''
            if [[ "$(uname)" == "Darwin" ]]; then
              export OPENSSL_LIB_PATH="$(brew --prefix openssl)/lib"
              export OPENSSL_INCLUDE_PATH="$(brew --prefix openssl)/include"
            else
              export OPENSSL_LIB_PATH=${pkgs.openssl.out}/lib
              export OPENSSL_INCLUDE_PATH=${pkgs.openssl.dev}/include
            fi

            echo "Native devShell for ${system}"
          '';
        };

        # Cross-compilation dev shell (target = x86_64-linux)
        devShells.cross = pkgs.mkShell {
          buildInputs = [
            cross.openssl
            cross.glibc
            cross.gcc
            pkgs.brotli
            pkgs.pkg-config
          ];

          shellHook = ''
            export OPENSSL_LIB_PATH=${cross.openssl.out}/lib
            export OPENSSL_INCLUDE_PATH=${cross.openssl.dev}/include
            echo "Cross-compilation devShell (target = x86_64-linux)"
          '';
        };
      }
    );
}
