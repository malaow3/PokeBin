# # Ubuntu 22.04 that runs a Rust binary.
#
# FROM ubuntu:22.04
#
# # Install dependencies
# RUN apt-get update && apt-get install -y \
# 	libssl-dev \
# 	pkg-config \
# 	curl \
# 	&& rm -rf /var/lib/apt/lists/*
#
# # Copy the binary to the container
# COPY ./target/release/ /usr/local/bin/
#
# # Run the binary
# CMD ["pokebin"]
#

from debian:bookworm-slim
RUN apt-get update && apt-get install -y \
	libssl-dev \
	pkg-config \
	curl \
	&& rm -rf /var/lib/apt/lists/*
# Install psql

COPY .env .
COPY web/dist web/dist
COPY moves.json .
copy battleItems.json .
copy pokemon.json .
COPY target/release/pokebin /usr/local/bin/
EXPOSE 8000
CMD ["pokebin"]
