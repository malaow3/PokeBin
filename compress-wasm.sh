#!/bin/bash

find zig-out/bin -maxdepth 1 -type f -name "*.wasm" -print0 | while IFS= read -r -d '' f; do
  brotli -f -q 11 "$f" -o "$f.br"
done
