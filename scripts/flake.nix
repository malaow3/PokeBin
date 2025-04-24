{
  description = "Python with CA certificates";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.simpleFlake {
      inherit self nixpkgs;
      name = "python-aiohttp-certs";
      shell = { pkgs }:
        pkgs.mkShell {
          buildInputs = [
            pkgs.cacert
            # pkgs.postgresql
          ];
          shellHook = ''
            export SSL_CERT_FILE="${pkgs.cacert}/etc/ssl/certs/ca-bundle.crt"
          '';
        };
    };
}
