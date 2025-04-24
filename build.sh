#!/bin/bash
set -e

RELEASE_FLAG=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release)
      RELEASE_FLAG="--release=safe"
      # RELEASE_FLAG="--release=small"
      shift
      ;;
    *)
      echo "Unknown parameter passed: $1"
      exit 1
      ;;
  esac
done

zig build compress-wasm -Dtarget=x86_64-linux-gnu $RELEASE_FLAG
mkdir -p dist/
cp zig-out/bin/pokebin dist/
cp zig-out/bin/wasm.wasm.br dist/
pushd web
bun i 
bun run build
popd
