# PokeBin

# Table of Contents

- [What is PokeBin?](#what-is-pokebin)
- [How the sausage is made](#how-the-sausage-is-made)
- [How to use](#how-to-use)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

## What is PokeBin?
PokeBin is a portmanteau of "Pokemon" and "Pastebin". More generally, it's a website that aims
to allow you to share Pokemon spreads & sets with anyone. This is essentially a fork of [Pokepaste](https://github.com/felixphew/pokepaste)
with some minor updates!


## How the sausage is made
PokeBin is composed of a few components:
- Relevant Pokemon data
- A web server (backend)
- A web client (frontend)
- A database

### Relevant Pokemon data
There are a few pieces that are required to make PokeBin somewhat useful.

- Pokemon information (types, species, forms, move data). This information comes curtosey of [PokeApi](https://pokeapi.co/)
which is a wonderful project and I highly recommend you check them out!
- Pokemon images. Again, these come from [PokeApi](https://pokeapi.co/). There is a *slight* difference between this repo and
the production version. That difference is the images are hosted in an S3 bucket from Amazon. This is only because when I tried to copy
all the images with Docker I ran out of disk space 😭 whoops!
- Item information and sprites. This comes from [Pokemon Showdown](https://pokemonshowdown.com/). The data is in a JS file by default, so
I put together a small script to convert it to JSON.

### Web server
The web server is built with Rust (using Axum). I just like writing Rust. Not much more to it!

### Web client
The web client is built with Svelte. I have never used Svelte before and this seemed
like a great learning experience.

### Database
The database used is Postgres. When running locally, I spin it up with Docker. For Prod, it's a hosted database instance.


## How to use
First, make sure you have all the prerequisites completed.
- Basic understanding of Git / command line familiarity
- Rust installed
    - Rust can be installed by following the instructions located [here](https://www.rust-lang.org/tools/install)
    - It is recommended that you also use the nightly compiler -- once Rust is installed, run `rustup default nightly`
    - You will also want the [mold linker](https://github.com/rui314/mold)
    - You will also want the cranelift codegen by running `$ rustup component add rustc-codegen-cranelift-preview --toolchain nightly`
- Postgres (On ubuntu, a simple `apt install postgresql`, but installation varies per distro. A quick google should get you there.)
- Docker installed (If on WSL you will need [Docker Desktop](https://www.docker.com/products/docker-desktop/))
- Your Javascript package manager of choice (for this example, I'll be using [Bun](https://bun.sh/))


If you want to run PokeBin localy, you'll need to follow the following steps:

1. Clone the repo
2. You will need to create a .env file. Inside that file you'll need to define two environment variables.
    - DATABASE_URL: The URL of the database. You can use a docker container and use the docker compose file to spin up the database. If you are using docker for example it will be "postgresql://malaow:postgres@localhost:5432/pokebin"
    - POKEBIN_KEY: A key to encrypt the IDs in the database.

For example your file might look like:
```
DATABASE_URL=postgresql://malaow:postgres@localhost:5432/pokebin
POKEBIN_KEY=my_secret_key
```
If you use a different username and password for your local database, you will also have to make the changes to the
docker-compose.yml file.

3. Install the web dependencies by running `cd web; bun install`
4. Build the web files by running `bun run build`
5. Cd back to the root of the repo by running `cd ..`
6. Start the database. Run `docker compose up -d db`
7. Create the database in Postgres.
    - Run `psql -U <username>` -h localhost` to connect to the database.
    - Run `CREATE DATABASE pokebin;` to create the database.
    - Run `\list` to confirm the database is created.
    - Run `\q` to quit.

NOTE: If you skipped installing the mold linker and the codegen backend, you will need to make changes to the Cargo.toml file AND the
config file located at `.cargo/config.toml`. It is recommended you install those for faster compilation AND so that you don't have to make
changes yourself!

8. Build the Rust binary by running `cargo build -r`

If you are on Linux, you can run the whole thing via docker. Just run `docker compose up -d`
If you **aren't** on Linux, that's fine. Just make sure the database is running, then run the web server with `./target/release/pokebin`

# Roadmap
There are a couple of "planned" features that I hope to add to PokeBin -- time permitting.

I'm going to excluded things like routine maitenance. I'll be adding new mons / items / etc. in the future as they come out.

In order of prority:

- Import / Export from Showdown -- this obviously requires a change on Showdown's platform -- I am willing to make those contributions if this site gains enough traction.

- Update service provider. Right now I host via AWS and the costs for that seem a little higher than I'd like. Maybe I can find a better hosting provider to cut the monthly expenses.

- Update design - There is a minor inconsistency with the display for mobile vs. desktop. Improving the overall design on mobile
is also important, truthfully it looks pretty poor right now 😭.

- Rewrite it in Go? I wrote this in Rust for the learning experience, maybe Go is better for OSS contributions. This is still on the table.

- Accounts: associating pastes to an account so that they can be later reviewed without hoping you saved the link. Maybe there is a way to link a Showdown account? TBD.
    - This can also let a paste be deleted if it's requested by the owner of the paste.

- Native for mobile? Instead of a PWA or mobile-responsive website, building a native app could be pretty neat.

- Timed-deletion: You can mark a paste to be deleted after a specific amount of time.


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
