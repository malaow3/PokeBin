#!/bin/bash

# Get the directory of this script
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

SRC_DIR="$DIR/src"

# Check whether the src folder exists
if [ ! -d "$SRC_DIR" ]; then
    echo "Error: src folder does not exist."
    exit 1
fi

# On invocation, we build the first time
bun run build

# Watch for changes in the src folder
fswatch -o --event Updated "$SRC_DIR" | xargs -I{} bun run build

# If we get here, something went wrong
exit 1
