#!/usr/bin/env python3

import json
import re

import requests


def main():
    items = requests.get("https://play.pokemonshowdown.com/data/items.js").text
    js_obj = items.split(" = ")[1].strip().removesuffix(";")
    pattern = r"([,{]\s*)(\w+)\s*:"
    json_like = re.sub(pattern, r'\1"\2":', js_obj)
    data = json.loads(json_like)

    with open("../wasm/items.json", "w") as f:
        json.dump(data, f, indent=2)

    return


if __name__ == "__main__":
    main()
