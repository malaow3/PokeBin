use crate::utils::Mon;
use crate::utils::Move;
use std::collections::HashMap;

use log::error;

pub async fn run_img() {
    // Get the list of ALL species from the pokeapi endpoint
    // Then, for each species, get the species details
    // Then look at the "varieties" in order to get the ID for each variety.
    // Then for each variety, add it to the hashmap.

    let client = reqwest::Client::new();
    let species_list = match get_species_list(&client).await {
        Ok(species_list) => species_list,
        Err(e) => {
            error!("Error getting species list: {}", e);
            return;
        }
    };

    // Get the species details in parallel.
    let mut tasks = Vec::new();
    for species in species_list {
        let client = client.clone();
        tasks.push(tokio::spawn(async move {
            get_species_details(client, species).await
        }));
    }

    let mut species_details = Vec::new();
    futures::future::join_all(tasks)
        .await
        .into_iter()
        .for_each(|result| {
            if let Ok(Ok(species)) = result {
                species_details.push(species);
            }
        });

    let mut map: HashMap<String, Mon> = HashMap::new();
    for species in species_details {
        let varieties = match species["varieties"].as_array() {
            Some(varieties) => varieties,
            None => continue,
        };

        for variety in varieties {
            // If the variety is the default, save the name as the species name.
            // Otherwise, save the name as the species name + the variety name.
            let name = match variety["is_default"].as_bool() {
                Some(true) => species["name"].as_str().unwrap(),
                _ => variety["pokemon"]["name"].as_str().unwrap(),
            };

            let id = match variety["pokemon"]["url"].as_str() {
                Some(url) => url
                    .split('/')
                    .filter(|s| !s.is_empty())
                    .last()
                    .unwrap()
                    .parse::<u32>()
                    .unwrap(),
                None => continue,
            };

            map.insert(
                name.to_string(),
                Mon {
                    id,
                    type1: String::from(""),
                    type2: String::from(""),
                    has_shiny: false,
                    has_female: false,
                },
            );
        }
    }

    // For each item, fetch the pokemon entry.
    // Then, save the type1 and type2 to the hashmap.
    let mut tasks = Vec::new();
    for (_item, mon) in map.iter_mut() {
        let client = client.clone();
        let id = mon.id;
        tasks.push(tokio::spawn(async move {
            let response = client
                .get(&format!("https://pokeapi.co/api/v2/pokemon/{}", id))
                .send()
                .await;
            if let Ok(response) = response {
                let pokemon = response.json::<serde_json::Value>().await;
                if let Ok(pokemon) = pokemon {
                    return Some(pokemon);
                }
            }
            None
        }));
    }

    let results = futures::future::join_all(tasks).await;
    for (item, result) in map.iter_mut().zip(results) {
        if let Ok(Some(pokemon)) = result {
            item.1.type1 = pokemon["types"][0]["type"]["name"]
                .as_str()
                .unwrap()
                .to_string();
            if pokemon["types"].as_array().unwrap().len() > 1 {
                item.1.type2 = pokemon["types"][1]["type"]["name"]
                    .as_str()
                    .unwrap()
                    .to_string();
            }

            if pokemon["sprites"]["front_shiny"].as_str().is_some() {
                item.1.has_shiny = true;
            }
            if pokemon["sprites"]["front_female"].as_str().is_some() {
                item.1.has_female = true;
            }
        }
    }

    // Write the hashmap to a file.
    let mut file = match std::fs::File::create("pokemon.json") {
        Ok(file) => file,
        Err(e) => {
            error!("Error creating file: {}", e);
            return;
        }
    };

    match serde_json::to_writer_pretty(&mut file, &map) {
        Ok(_) => {}
        Err(e) => {
            error!("Error writing to file: {}", e);
        }
    }

    // Get all the moves.
    let moves_url = "https://pokeapi.co/api/v2/move?limit=10000";
    let moves = client
        .get(moves_url)
        .send()
        .await
        .unwrap()
        .json::<serde_json::Value>()
        .await
        .unwrap();

    let mut moves_map: HashMap<String, Move> = HashMap::new();
    let moves = moves["results"].as_array().unwrap();
    let mut tasks = Vec::new();
    for moveitem in moves.iter() {
        let client = client.clone();
        let move_url = moveitem["url"].as_str().unwrap().to_string();
        tasks.push(tokio::spawn(async move {
            let move_data = client.get(move_url).send().await.unwrap();
            let move_data = move_data.json::<serde_json::Value>().await.unwrap();
            let move_obj = Move {
                id: move_data["id"].as_u64().unwrap() as u32,
                name: move_data["name"].as_str().unwrap().to_string(),
                type1: move_data["type"]["name"].as_str().unwrap().to_string(),
            };
            Some(move_obj)
        }))
    }

    let results = futures::future::join_all(tasks).await;
    for res in results.iter().flatten().flatten() {
        moves_map.insert(res.name.clone(), res.clone());
    }

    let mut file = match std::fs::File::create("moves.json") {
        Ok(file) => file,
        Err(e) => {
            error!("Error creating file: {}", e);
            return;
        }
    };

    match serde_json::to_writer_pretty(&mut file, &moves_map) {
        Ok(_) => {}
        Err(e) => {
            error!("Error writing to file: {}", e);
        }
    }
}

async fn get_species_details(
    client: reqwest::Client,
    species: serde_json::Value,
) -> Result<serde_json::Value, anyhow::Error> {
    let species_details = client.get(species["url"].as_str().unwrap()).send().await?;

    let species_details: serde_json::Value = species_details.json().await?;

    Ok(species_details)
}

async fn get_species_list(
    client: &reqwest::Client,
) -> Result<Vec<serde_json::Value>, anyhow::Error> {
    let species = client
        .get("https://pokeapi.co/api/v2/pokemon-species?limit=10000")
        .send()
        .await?;

    let species: serde_json::Value = species.json().await?;

    let species: Vec<serde_json::Value> = match species["results"].as_array() {
        Some(species) => species.to_vec(),
        None => return Err(anyhow::anyhow!("No results found")),
    };

    Ok(species)
}
