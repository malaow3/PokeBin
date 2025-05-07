#!/bin/bash

RELEASE_FLAG=""
SKIP_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release)
      RELEASE_FLAG="--release"
      shift
      ;;
    --skip)
      SKIP_BUILD=1
      shift
      ;;
    *)
      echo "Unknown parameter passed: $1"
      exit 1
      ;;
  esac
done

if [[ $SKIP_BUILD -eq 0 ]]; then
  ./build.sh $RELEASE_FLAG
else
  echo "Skipping build step."
fi

# Create temporary docker-compose file
TEMP_COMPOSE="docker-compose.tmp.yml"
trap 'rm -f "$TEMP_COMPOSE"' EXIT

# Use yq to remove coolify network and set network_mode: host
yq 'del(.services[].networks) | del(.networks.coolify) | .services[].network_mode = "host"' docker-compose.yml > "$TEMP_COMPOSE"

# Run docker compose with temporary file
docker compose -f "$TEMP_COMPOSE" up --build
