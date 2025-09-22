FROM ubuntu:latest

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl gnupg \
    libssl3 ca-certificates git \
    software-properties-common \
    python3 python3-pip python3-venv \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Bun
RUN curl -fsSL https://bun.sh/install | bash && \
    mv /root/.bun/bin/bun /usr/local/bin/

# Install Node.js 18 (LTS)
RUN curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs

COPY web/dist web/dist
COPY screenshot screenshot

workdir /app/screenshot
RUN npm install
RUN npx playwright install --with-deps
workdir /app

COPY home home

COPY dist/pokebin ./pokebin
COPY .env .
COPY robots.txt robots.txt
COPY dist/wasm.wasm.br zig-out/bin/wasm.wasm.br
COPY dist/web_wasm.wasm.br zig-out/bin/web_wasm.wasm.br

RUN chmod +x ./pokebin
CMD ["./pokebin"]
