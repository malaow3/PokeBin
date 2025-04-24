FROM ubuntu:latest

WORKDIR /app

COPY web/dist web/dist
COPY home home

COPY dist/pokebin ./pokebin
COPY .env .
COPY robots.txt robots.txt
COPY dist/wasm.wasm.br zig-out/bin/wasm.wasm.br

RUN chmod +x ./pokebin
CMD ["./pokebin"]
