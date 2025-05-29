FROM ubuntu:latest

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libssl3 ca-certificates git

COPY web/dist web/dist
COPY home home

COPY dist/pokebin ./pokebin
COPY .env .
COPY robots.txt robots.txt
COPY dist/wasm.wasm.br zig-out/bin/wasm.wasm.br
COPY dist/web_wasm.wasm.br zig-out/bin/web_wasm.wasm.br

RUN chmod +x ./pokebin
CMD ["./pokebin"]
