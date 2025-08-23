# -------------------------------
# Base build dependencies
# -------------------------------
FROM ubuntu:24.04 AS build-deps

# Install build dependencies (with caching)
RUN --mount=type=cache,target=/var/lib/apt/lists \
    apt-get update && apt-get install -y \
    curl build-essential pkg-config libssl-dev brotli git \
    && rm -rf /var/lib/apt/lists/*

# -------------------------------
# Zig installation layer
# -------------------------------
FROM build-deps AS zig

# Install Zig (pinned version)
RUN curl -L https://ziglang.org/download/0.15.1/zig-x86_64-linux-0.15.1.tar.xz \
    | tar -xJ && \
    mv zig-x86_64-linux-0.15.1 /opt/zig && \
    ln -s /opt/zig/zig /usr/local/bin/zig

# -------------------------------
# Build stage
# -------------------------------
FROM zig AS build

WORKDIR /app

# Copy only dependency files first (for better caching)
COPY build.zig.zon build.zig .
COPY src src
copy wasm wasm

# Build the project (ReleaseSafe + compress-wasm step)
RUN --mount=type=cache,target=/root/.cache \
    zig build compress-wasm --release=safe

# -------------------------------
# Runtime stage
# -------------------------------
FROM debian:bookworm-slim AS runtime

# Install runtime dependencies
RUN --mount=type=cache,target=/var/cache/apt \
    apt-get update && apt-get install -y \
    libssl3 brotli ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the built binary and wasm outputs
COPY --from=build /app/zig-out/bin/pokebin zig-out/bin/pokebin
COPY --from=build /app/zig-out/bin/*.wasm* zig-out/bin/

# Copy static assets
COPY web/dist web/dist
COPY home home
COPY robots.txt robots.txt

CMD ["zig-out/bin/pokebin"]
