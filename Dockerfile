from debian:bookworm-slim
RUN apt-get update && apt-get install -y \
	libssl-dev \
	pkg-config \
	curl \
	&& rm -rf /var/lib/apt/lists/*

COPY .env .
COPY web/dist web/dist
COPY moves.json .
copy items.json .
copy pokemon.json .
COPY home home
COPY templates templates/
COPY ads.txt .
COPY target/release/pokebin /usr/local/bin/
EXPOSE 8000
CMD ["pokebin"]
