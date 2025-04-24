#!/usr/bin/env python3
import asyncio
import json
import os
from typing import Any

import aiohttp


async def fetch_url(
    client: aiohttp.ClientSession, url: str, semaphore: asyncio.Semaphore
):
    async with semaphore:
        try:
            async with client.get(url) as response:
                response.raise_for_status()
                return await response.json()
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            return None


async def download_image(
    client: aiohttp.ClientSession,
    url: str,
    file_path: str,
    semaphore: asyncio.Semaphore,
):
    async with semaphore:
        try:
            async with client.get(url) as response:
                response.raise_for_status()
                data = await response.read()
                os.makedirs(os.path.dirname(file_path), exist_ok=True)
                with open(file_path, "wb") as f:
                    f.write(data)
        except Exception as e:
            print(f"Error fetching {url}: {e}")
            return None


def get_variety_filename(id, is_default, variety_name):
    if is_default:
        return f"{id}.png"
    else:
        return f"{id}-{variety_name}.png"


async def main():
    api_url = "https://pokeapi.co/api/v2/pokemon?limit=10000"
    async with aiohttp.ClientSession() as client:
        async with client.get(api_url) as response:
            if response.status != 200:
                raise ValueError("Failed to fetch pokemon")
            json_response = (await response.json())["results"]
            urls: list[str] = [x["url"] for x in json_response]

        semaphore = asyncio.Semaphore(1000)
        tasks = [fetch_url(client, url, semaphore) for url in urls]
        results = await asyncio.gather(*tasks)
        # Filter out failed fetches (None)
        results = [r for r in results if r is not None]
        result_map = {}

        image_download_tasks: list[Any] = []

        for result in results:
            has_shiny = False
            has_female = False

            sprites = result["sprites"]
            if sprites["other"]["home"]["front_shiny"] is not None:
                has_shiny = True
            if sprites["other"]["home"]["front_female"] is not None:
                has_female = True

            result_map[result["name"]] = {
                "id": result["id"],
                "type1": result["types"][0]["type"]["name"],
                "type2": result["types"][1]["type"]["name"]
                if len(result["types"]) > 1
                else "",
                "has_shiny": has_shiny,
                "has_female": has_female,
            }

        await asyncio.gather(*image_download_tasks)

        with open("../wasm/pokemon.json", "w") as f:
            f.write(json.dumps(result_map, indent=2))

        return 0


if __name__ == "__main__":
    asyncio.run(main())
