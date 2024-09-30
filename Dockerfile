from debian:bookworm-slim
RUN apt-get update && apt-get install -y \
	libssl-dev \
	pkg-config \
	curl \
	&& rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY .env .
COPY robots.txt .
COPY web/dist web/dist
COPY data/ ./data
COPY home ./home
COPY pokebin .
EXPOSE 3005
CMD ["./pokebin"]
