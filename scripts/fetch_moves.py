#!/usr/bin/env python3
import asyncio
import json
from typing import List

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


async def main():
    api_url = "https://pokeapi.co/api/v2/move?limit=10000"
    async with aiohttp.ClientSession() as client:
        async with client.get(api_url) as response:
            if response.status != 200:
                raise ValueError("Failed to fetch pokemon")
            json_response = (await response.json())["results"]
            urls: List[str] = [x["url"] for x in json_response]

        semaphore = asyncio.Semaphore(1000)
        tasks = [fetch_url(client, url, semaphore) for url in urls]
        results = await asyncio.gather(*tasks)
        # Filter out failed fetches (None)
        results = [r for r in results if r is not None]
        result_map = {}

        for move in results:
            result_map[move["name"]] = {
                "name": move["name"],
                "id": move["id"],
                "type": move["type"]["name"],
            }

        with open("../wasm/moves.json", "w") as f:
            json.dump(result_map, f, indent=2)

        return 0


if __name__ == "__main__":
    asyncio.run(main())
