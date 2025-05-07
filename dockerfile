FROM ghcr.io/astral-sh/uv:latest as uv-binary
FROM ubuntu:latest

COPY --from=uv-binary /uv /usr/local/bin/uv

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends libssl3 ca-certificates python3 git

COPY web/dist web/dist
COPY home home

COPY tour_fetch.py ./tour_fetch.py
COPY pyproject.toml ./pyproject.toml
RUN uv sync
COPY dist/pokebin ./pokebin
COPY .env .
COPY robots.txt robots.txt
COPY dist/wasm.wasm.br zig-out/bin/wasm.wasm.br

RUN chmod +x ./pokebin
CMD ["./pokebin"]
