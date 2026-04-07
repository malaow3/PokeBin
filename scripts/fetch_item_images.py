#!/usr/bin/env python3

import json
import os
import re
from concurrent.futures import ThreadPoolExecutor
from html.parser import HTMLParser

import brotli
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry


class OptionParser(HTMLParser):
    """Parse <option> tags to build a name -> slug mapping."""

    def __init__(self):
        super().__init__()
        self.mapping = {}
        self._current_value = None

    def handle_starttag(self, tag, attrs):
        if tag == "option":
            for name, value in attrs:
                if name == "value":
                    self._current_value = value

    def handle_data(self, data):
        if self._current_value:
            text = data.strip()
            if text:
                self.mapping[text] = self._current_value
            self._current_value = None


def normalize(name: str) -> str:
    """Normalize a name for fuzzy matching: lowercase, remove non-alphanumeric."""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def slug_from_value(value: str) -> str:
    """Convert e.g. '/itemdex/beastball.shtml' to 'beastball'."""
    return value.rsplit("/", 1)[-1].removesuffix(".shtml")


def brotli_encode_file(filepath: str) -> str:
    outpath = filepath + ".br"
    with open(filepath, "rb") as f_in, open(outpath, "wb") as f_out:
        compressed = brotli.compress(f_in.read())
        f_out.write(compressed)
    os.remove(filepath)
    return outpath


def make_session() -> requests.Session:
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
    session.mount("https://", HTTPAdapter(max_retries=retries))
    return session


def download_item(args: tuple[str, list[str], str, requests.Session]) -> None:
    key, urls, out_dir, session = args
    for url in urls:
        try:
            resp = session.get(url)
        except requests.RequestException:
            continue
        if resp.status_code == 200:
            filepath = os.path.join(out_dir, f"{key}.png")
            with open(filepath, "wb") as f:
                f.write(resp.content)
            brotli_encode_file(filepath)
            return
    print(f"Failed to download {key}")


def main():
    with open("../wasm/items.json") as f:
        items = json.load(f)

    # Fetch itemdex page and parse <option> tags for name -> slug mapping
    resp = requests.get("https://www.serebii.net/itemdex/")
    resp.raise_for_status()

    parser = OptionParser()
    parser.feed(resp.text)

    # Build normalized name -> slug lookup
    norm_to_slug = {}
    for name, val in parser.mapping.items():
        slug = slug_from_value(val)
        norm_to_slug[normalize(name)] = slug

    out_dir = "../items"
    os.makedirs(out_dir, exist_ok=True)

    # For each item, build a list of candidate URLs to try in order:
    # 1. Standard itemdex sprite using the slug matched by name
    # 2. ZA sprite using the item key
    # 3. Standard itemdex sprite using the normalized item name
    tasks = []
    for key, item in items.items():
        name = item["name"]
        norm = normalize(name)
        slug = norm_to_slug.get(norm)

        urls = []
        if slug is not None:
            urls.append(f"https://www.serebii.net/itemdex/sprites/{slug}.png")
        urls.append(f"https://www.serebii.net/itemdex/sprites/za/{key}.png")
        if slug is None:
            urls.append(f"https://www.serebii.net/itemdex/sprites/{norm}.png")
        tasks.append((key, urls, out_dir))

    session = make_session()
    print(f"Downloading {len(tasks)} item images...")
    with ThreadPoolExecutor(max_workers=5) as executor:
        list(executor.map(download_item, [(k, u, d, session) for k, u, d, *_ in tasks]))

    print("Done.")


if __name__ == "__main__":
    main()
