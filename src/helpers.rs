#![allow(dead_code)]
use std::{collections::HashMap, path::PathBuf};

use rand::seq::SliceRandom;
use regex::Regex;

use crate::utils::Mon;

const ALCREMIE_DECORATIONS: [&str; 7] = [
    "berry-sweet",
    "clove-sweet",
    "flower-sweet",
    "love-sweet",
    "ribbon-sweet",
    "star-sweet",
    "strawberry-sweet",
];

pub fn search_like<T: Clone>(map: &HashMap<String, T>, pattern: &str) -> Option<(String, T)> {
    // Check for direct match
    if map.contains_key(pattern) {
        return Some((pattern.to_string(), map[pattern].clone()));
    }

    // Check a secondary match
    let regex_pattern = format!("(?i)^{}", pattern.replace('%', ".*").replace('_', "."));
    let re = Regex::new(&regex_pattern).unwrap();
    for (key, value) in map.iter() {
        if re.is_match(key) {
            return Some((key.to_string(), value.clone()));
        }
    }

    // If no match still, split on "-" and search for first item.
    let old_pattern = pattern;
    let pattern = pattern.split('-').collect::<Vec<&str>>()[0];
    if old_pattern == pattern {
        return None;
    }

    let res = search_like(map, pattern);
    if res.is_some() {
        let (_, value) = res.unwrap();
        return Some((old_pattern.to_owned(), value));
    }
    None
}

pub fn verify_map(map: &mut HashMap<String, Mon>) {
    // Confirm that for every item in the map, there is a corresponding image.
    let mut remove_keys = Vec::new();
    for (key, value) in map.iter() {
        let path = PathBuf::from(format!("home/{}.png", value.id));
        if !path.exists() {
            // Remove the item from the map
            remove_keys.push(key.clone());
        }
    }

    for key in remove_keys {
        map.remove(&key);
    }
}

pub fn get_image(map: &HashMap<String, Mon>, pokemon: &str, shiny: bool, female: bool) -> String {
    // First, see if the pokemon is in the map.
    // If it is, return the filepath.
    let mut base_path = PathBuf::from("home");
    if pokemon.contains("alcremie") && !pokemon.contains("gmax") {
        // Alcremie has a special case. Since there are SO many variations.

        let random_decoration = ALCREMIE_DECORATIONS
            .choose(&mut rand::thread_rng())
            .unwrap()
            .to_string();
        if shiny {
            return format!("home/shiny/869-{}.png", random_decoration);
        } else {
            let flavor = match pokemon {
                "alcremie" => "vanilla-cream".to_string(),
                _ => pokemon.split('-').collect::<Vec<&str>>()[1..].join("-"),
            };
            return format!("home/869-{}-{}.png", flavor, random_decoration);
        }
    }

    if map.contains_key(pokemon) {
        // First check if shiny is true.
        if shiny {
            base_path.push("shiny");
        }

        // Add female to the path if relevant.
        if female {
            base_path.push("female")
        }

        // Add the id to the path.
        base_path.push(format!("{}.png", map[pokemon].id));
        // If the path exists, return it.
        if base_path.exists() {
            return base_path.to_str().unwrap().to_string();
        }

        // If it doesn't, search the map for the pokemon species.
        base_path.pop();
        if female {
            base_path.pop();
        }
        if shiny {
            base_path.pop();
        }
        base_path.push(format!("{}.png", map[pokemon].id));

        // If the path exists, return it.
        if base_path.exists() {
            return base_path.to_str().unwrap().to_string();
        }
    }

    // If it isn't, search the map for the pokemon species.
    // If it's found, see if the species has a filepath with the modification.

    // Split on the dash.
    let split: Vec<&str> = pokemon.split('-').collect();
    let species = split[0];
    if map.contains_key(species) {
        let id = format!("{}-{}", map[species].id, split[1..].join("-"));
        // First check if shiny is true.
        if shiny {
            base_path.push("shiny");
        }

        // Add female to the path if relevant.
        if female {
            // There are CURRENTLY no female differences for cosmetic forms.
            base_path.push("female")
        }

        // Add the id to the path.
        base_path.push(format!("{}.png", id));
        // If the path exists, return it.
        if base_path.exists() {
            return base_path.to_str().unwrap().to_string();
        }
        base_path.pop();
        if female {
            base_path.pop();
        }
        if shiny {
            base_path.pop();
        }

        base_path.push(format!("{}.png", map[species].id));
        // If the path exists, return it.
        if base_path.exists() {
            return base_path.to_str().unwrap().to_string();
        }
    }

    // Lastly, check for Alcremie forms.
    let mut egg_path = PathBuf::from("home");
    egg_path.push("0.png");

    return egg_path.to_str().unwrap().to_string();
}

pub fn get_item_image(map: &HashMap<String, serde_json::Value>, item: &str) -> String {
    let early_return = "background: transparent url(\"https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png?v16\") -360px -2580px no-repeat".to_string();

    if map.contains_key(item) {
        let sprite_num = match map[item]["spritenum"].as_u64() {
            Some(num) => num,
            None => return early_return,
        };

        let top = (sprite_num / 16) * 24 * 2;
        let left = (sprite_num % 16) * 24 * 2;
        return format!(
            "background: transparent url(\"assets/sprites\") -{}px -{}px no-repeat",
            left, top
        );
    }

    // unown-question mark
    early_return
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_search() {
        // Open the file and parse it into a HashMap
        let file = std::fs::File::open("pokemon.json").unwrap();
        let map: HashMap<String, Mon> = serde_json::from_reader(file).unwrap();

        // Test a pokemon that is in the map.
        let pokemon = "bulbasaur";
        let shiny = false;
        let female = false;
        let result = get_image(&map, pokemon, shiny, female);
        assert_eq!(result, "home/1.png");

        // Test a pokemon that is in the map, but shiny.
        let pokemon = "charizard";
        let shiny = true;
        let female = false;
        let result = get_image(&map, pokemon, shiny, female);
        assert_eq!(result, "home/shiny/6.png");

        // Test a pokemon that is in the map, and has a distinct female form.
        let pokemon = "unfezant";
        let shiny = false;
        let female = true;
        let result = get_image(&map, pokemon, shiny, female);
        assert_eq!(result, "home/female/521.png");

        // Test a pokemon that does not have a distinct female form.
        let pokemon = "charizard-mega-x";
        let shiny = false;
        let female = true;
        let result = get_image(&map, pokemon, shiny, female);
        assert_eq!(result, "home/10034.png");

        // Test for a pokemon that has ONLY a cosmetic form.
        let pokemon = "floette-white";
        let shiny = false;
        let female = false;
        let result = get_image(&map, pokemon, shiny, female);
        assert_eq!(result, "home/670-white.png");

        // Test for a pokemon that has ONLY a cosmetic form, and is shiny.
        let pokemon = "furfrou-heart";
        let shiny = true;
        let female = false;
        let result = get_image(&map, pokemon, shiny, female);
        assert_eq!(result, "home/shiny/676-heart.png");

        let pokemon = "unown-b";
        let shiny = false;
        let result = get_image(&map, pokemon, shiny, false);
        assert_eq!(result, "home/201-b.png");

        let pokemon = "unown-question";
        let result = get_image(&map, pokemon, shiny, false);
        assert_eq!(result, "home/201-question.png");

        let pokemon = "deoxys";
        let shiny = false;
        let result = get_image(&map, pokemon, shiny, false);
        assert_eq!(result, "home/386.png");

        let pokemon = "deoxys-attack";
        let result = get_image(&map, pokemon, shiny, false);
        assert_eq!(result, "home/10001.png");

        let pokemon = "urshifu";
        let shiny = false;
        let result = get_image(&map, pokemon, shiny, false);
        assert_eq!(result, "home/892.png");
        let pokemon = "urshifu-rapid-strike";
        let result = get_image(&map, pokemon, shiny, false);
        assert_eq!(result, "home/10191.png");

        let pokemon = "ogerpon";
        let shiny = false;
        let result = get_image(&map, pokemon, shiny, false);
        assert_eq!(result, "home/1017.png");

        let pokemon = "ogerpon-hearthflame-mask";
        let result = get_image(&map, pokemon, shiny, false);
        assert_eq!(result, "home/10274.png");

        let pokemon = "alcremie-matcha-cream";
        let result = get_image(&map, pokemon, shiny, false);
        println!("{}", result);
        assert!(result.starts_with("home/869-matcha-cream-"));

        let pokemon = "alcremie-mint-cream";
        let result = get_image(&map, pokemon, true, false);
        println!("{}", result);
        assert!(result.starts_with("home/shiny/869-"));

        let pokemon = "floette-eternal";
        let result = get_image(&map, pokemon, false, false);
        println!("{}", result);
    }

    #[test]
    fn test_get_item() {
        let file = std::fs::File::open("battleItems.json").unwrap();
        let map: HashMap<String, serde_json::Value> = serde_json::from_reader(file).unwrap();

        let item = "lucky-egg";
        let result = get_item_image(&map, item);

        let dne = "background: transparent url(\"https://play.pokemonshowdown.com/sprites/pokemonicons-sheet.png?v16\") -360px -2580px no-repeat".to_string();
        assert_eq!(result, dne);

        let item = "Black Sludge";
        let result = get_item_image(&map, item);
        assert_eq!(result, "background: transparent url(\"https://play.pokemonshowdown.com/sprites/itemicons-sheet.png\") -48px -48px no-repeat");
    }

    #[test]
    fn test_search_like() {
        let file = std::fs::File::open("pokemon.json").unwrap();
        let map: HashMap<String, Mon> = serde_json::from_reader(file).unwrap();

        let search = "unown-quesiton";
        let result = search_like(&map, search);

        println!("{:?}", result);
    }
}
