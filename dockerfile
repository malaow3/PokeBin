# -------------------------------
# Build stage
# -------------------------------
FROM ubuntu:24.04 AS build

# Install build dependencies
RUN apt-get update && apt-get install -y \
    curl build-essential pkg-config libssl-dev brotli git \
    && rm -rf /var/lib/apt/lists/*

# Install Zig
RUN curl -L https://ziglang.org/download/0.15.1/zig-x86_64-linux-0.15.1.tar.xz \
    | tar -xJ && \
    mv zig-x86_64-linux-0.15.1 /opt/zig && \
    ln -s /opt/zig/zig /usr/local/bin/zig

WORKDIR /app

# Copy project files
COPY . .

# Build the project (ReleaseSafe + compress-wasm step)
RUN zig build compress-wasm --release=safe

# -------------------------------
# Runtime stage
# -------------------------------
FROM ubuntu:24.04 AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libssl3 brotli ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy the built binary and wasm outputs
COPY --from=build /app/zig-out/bin/pokebin zig-out/bin/pokebin
COPY --from=build /app/zig-out/bin/*.wasm* zig-out/bin/

# Copy static assets
COPY web/dist web/dist
COPY home home
# COPY .env .
COPY robots.txt robots.txt

CMD ["zig-out/bin/pokebin"]
