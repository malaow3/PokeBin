#!/usr/bin/env python3
import json
import os


def main():
    official_dir = "../home/official-artwork"
    shiny_dir = os.path.join(official_dir, "shiny")

    official_files = [
        f
        for f in os.listdir(official_dir)
        if os.path.isfile(os.path.join(official_dir, f))
    ]

    if os.path.exists(shiny_dir):
        shiny_files = set(os.listdir(shiny_dir))
    else:
        shiny_files = set()

    missing_in_shiny = sorted([f for f in official_files if f not in shiny_files])
    missing_dict: dict[str, None] = {}
    for f in missing_in_shiny:
        id = f.split(".")[0]
        missing_dict[id] = None

    with open("../wasm/pokemon.json", "r") as file:
        pokemon_data = json.load(file)
    for pokemon in pokemon_data.values():
        if not pokemon["has_shiny"]:
            missing_dict[pokemon["id"]] = None

    with open("../wasm/missing_shiny.json", "w") as file:
        json.dump(missing_dict, file, indent=2)


if __name__ == "__main__":
    main()
