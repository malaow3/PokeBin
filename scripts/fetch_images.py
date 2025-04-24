#!/usr/bin/env python3

import os
import shutil
import zipfile
from concurrent.futures import ThreadPoolExecutor

import brotli
import requests


def brotli_encode_file(filepath):
    """Brotli-encode a file and save as .br"""
    outpath = filepath + ".br"
    with open(filepath, "rb") as f_in, open(outpath, "wb") as f_out:
        data = f_in.read()
        compressed = brotli.compress(data)
        f_out.write(compressed)
        os.remove(filepath)
    return outpath


def main():
    response = requests.get(
        "https://github.com/PokeAPI/sprites/archive/refs/heads/master.zip"
    )

    data = response.content
    with open("sprites.zip", "wb") as f:
        f.write(data)

    if os.path.exists("../home"):
        shutil.rmtree("../home")

    # Unzip the file
    with zipfile.ZipFile("sprites.zip", "r") as zip_ref:
        prefix = "sprites-master/sprites/pokemon/other/home/"
        official_prefix = "sprites-master/sprites/pokemon/other/official-artwork"
        extracted = False

        for member in zip_ref.namelist():
            if member.startswith(prefix) and not member.endswith("/"):
                rel_path = member.removeprefix("sprites-master/sprites/pokemon/other")
                rel_path = "../" + rel_path
                os.makedirs(os.path.dirname(rel_path), exist_ok=True)
                with zip_ref.open(member) as source, open(rel_path, "wb") as target:
                    shutil.copyfileobj(source, target)
                extracted = True
            if member.startswith(official_prefix) and not member.endswith("/"):
                rel_path = member.removeprefix("sprites-master/sprites/pokemon/other/")
                rel_path = "../home/" + rel_path
                os.makedirs(os.path.dirname(rel_path), exist_ok=True)
                with zip_ref.open(member) as source, open(rel_path, "wb") as target:
                    shutil.copyfileobj(source, target)
                extracted = True

    if not extracted:
        print("No files extracted")
        os.remove("sprites.zip")
        return

    # Brotli encode each file in the "home" folder in parallel
    home_dir = "../home"
    files_to_encode = []
    for root, _, files in os.walk(home_dir):
        for file in files:
            filepath = os.path.join(root, file)
            files_to_encode.append(filepath)

    with ThreadPoolExecutor(max_workers=100) as executor:
        list(executor.map(brotli_encode_file, files_to_encode))

    os.remove("sprites.zip")


if __name__ == "__main__":
    main()
