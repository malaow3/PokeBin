#!/usr/bin/env python3

import json
import os
import sys
from concurrent.futures import ThreadPoolExecutor

import brotli


def load_pokemon_ids():
    json_path = os.path.join(os.path.dirname(__file__), "..", "wasm", "pokemon.json")
    with open(json_path) as f:
        data = json.load(f)
    return {name: info["id"] for name, info in data.items()}


def compress_and_rename_file(filepath, pokemon_id, output_dir):
    filename = f"{pokemon_id}.png.br"
    output_path = os.path.join(output_dir, filename)
    os.makedirs(output_dir, exist_ok=True)
    with open(filepath, "rb") as f_in:
        data = f_in.read()
        compressed = brotli.compress(data)
        with open(output_path, "wb") as f_out:
            f_out.write(compressed)
    return output_path


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        print("Usage: compress_images.py <input> <output>")
        return

    input_dir, output_dir = args[0], args[1]
    pokemon_id_map = load_pokemon_ids()

    files_to_process = []
    for filename in os.listdir(input_dir):
        if not filename.lower().endswith((".png", ".jpg", ".jpeg", ".gif", ".webp")):
            continue
        name_without_ext = os.path.splitext(filename)[0].lower()
        if "-mega" in name_without_ext:
            lookup_name = name_without_ext
        else:
            lookup_name = f"{name_without_ext}-mega"
        if lookup_name in pokemon_id_map:
            files_to_process.append(
                (os.path.join(input_dir, filename), pokemon_id_map[lookup_name])
            )

    with ThreadPoolExecutor(max_workers=100) as executor:
        for filepath, pokemon_id in files_to_process:
            executor.submit(compress_and_rename_file, filepath, pokemon_id, output_dir)

    print(f"Processed {len(files_to_process)} images")


if __name__ == "__main__":
    main()
