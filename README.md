# PokeBin

# Table of Contents

- [What is PokeBin?](#what-is-pokebin)
- [How the sausage is made](#how-the-sausage-is-made)
- [How to use](#how-to-use)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

## What is PokeBin?

PokeBin is a portmanteau of "Pokemon" and "Pastebin". More generally, it's a website that aims
to allow you to share Pokemon spreads & sets with anyone. While there isn't official integration with Pokemon Showdown, it is possible to use PokeBin
via the PokeBin Extension. See [here](extension/readme.md) for more information.

## How the sausage is made

PokeBin is composed of a two main components:

- The server code (backend)
- The client code (frontend)

### Pokemon data

There are a few pieces that are required to make PokeBin somewhat useful.

- Pokemon information (types, species, forms, move data). This information comes curtosey of [PokeApi](https://pokeapi.co/)
  which is a wonderful project and I highly recommend you check them out!
- Pokemon images. Again, these come from [PokeApi](https://pokeapi.co/).
- Item information and sprites. This comes from [Pokemon Showdown](https://pokemonshowdown.com/). The data is in a JS file by default, so
  I put together a small script to convert it to JSON.

### Web server

The web server is built with Zig (specifically using [http.zig](https://github.com/karlseguin/http.zig)). Initially the client
was written in Rust, but after working with Zig on other projects, I've really liked the language and
found that I'd be able to achieve similar performance with faster compile times and more reusability through WASM.

### Web client

The web client is built with SolidJS. Additionally I use WASM for data-intensive operations such as encryption and decryption or pastes.

### Database

Both encrypted and decrypted pastes are stored in a Redis database for quick key-value lookups.

## How to use

First, make sure you have all the prerequisites completed.

- Basic understanding of Git / command line familiarity
- Zig installed
- Redis installed
- Brotli CLI installed for compressing files
- Docker installed (If on WSL you will need [Docker Desktop](https://www.docker.com/products/docker-desktop/))
- Your Javascript package manager of choice (for this example, I'll be using [Bun](https://bun.sh/))

If you want to run PokeBin localy, you'll need to follow the following steps:

1. Clone the repo
2. You will need to create a .env file. Inside that file you'll need to define two environment variables.

   - DB_HOST: The url of your database. If running via Docker, this should be 'redis'
   - DB_USER: Username for the database
   - DB_PORT: Port for the database, default is 6379
   - DB_PASS: Password for the database

3. Install the web dependencies by running `cd web; bun install`
4. Build the web files by running `bun run build`
5. Cd back to the root of the repo by running `cd ..`
6. Start the program. Run `docker compose up`

# Contributing

I believe open source is one of the most amazing parts of software! Being able to contribute to a tool you use to make it better, fix a bug, or add a new feature is incredibly rewarding.
If you want to contribute, feel free to fork the repo and send a PR with your changes!

Unfortunately, there isn't a strict set of tests / linting guidelines. I might be a bit picky on a review, but over time I hope to get the repo to a state where
contributing is easy and there is enough feedback baked into the tests/linting/static analysis that if things pass it should have no problem getting merged!

# Notes

This project is not affiliated with, maintained, authorized, endorsed, or sponsored by the Pokémon Company, Nintendo, or any of its affiliates or subsidiaries.
All Pokémon images, names, and related media are intellectual property of their respective owners. This application is intended for educational, development,
and informational purposes only.

The use of any trademarks, copyright materials, or intellectual property by this project is done under fair use or with permission, and does not imply
any association with or endorsement by their respective owners. This project does not claim any ownership over any of the Pokémon franchise materials used within.

If you are the rightful owner of any content used in this project and believe that your copyright has been infringed, please contact us directly
to discuss the removal of such content or any other concerns.
