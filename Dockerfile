from debian:bookworm-slim
RUN apt-get update && apt-get install -y \
	libssl-dev \
	pkg-config \
	curl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY .env .
COPY web/dist web/dist
COPY data/ ./data
COPY home ./home
COPY target/release/pokebin .
EXPOSE 8000
CMD ["./pokebin"]
