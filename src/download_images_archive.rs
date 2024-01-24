use std::collections::HashMap;

use fancy_regex::Regex;
use serde::Deserialize;

use crate::helpers;

#[derive(Debug, Deserialize)]
struct Continue {
    cmcontinue: String,
}

#[derive(Debug, Deserialize)]
struct ApiResponse {
    #[serde(rename = "continue")]
    continue_data: Option<Continue>,
    query: Query,
}

#[derive(Debug, Deserialize)]
struct Query {
    categorymembers: Vec<CategoryMember>,
}

#[derive(Debug, Deserialize)]
struct CategoryMember {
    title: String,
}

const MON_NAME_REGEX: &str = r"\{\{HOME\|\d+\|(.*?)(?:\|(.*))?\}\}";

pub async fn run_img() {
    // Set the default
    let client = reqwest::ClientBuilder::new()
        .user_agent("Mozilla/5.0")
        .build()
        .unwrap();

    // Create imgs directory if it doesn't exist.
    match std::fs::create_dir("imgs") {
        Ok(_) => {}
        Err(e) => {
            if e.kind() != std::io::ErrorKind::AlreadyExists {
                panic!("Error creating directory: {}", e)
            }
        }
    };

    let api_endpoint = "https://archives.bulbagarden.net/w/api.php";
    let category_title = "Category:HOME_artwork";
    let mut cmcontinue = String::new();
    let mut all_filenames = Vec::new();

    loop {
        let mut url = format!(
            "{}?action=query&list=categorymembers&cmtitle={}&cmlimit=500&format=json",
            api_endpoint, category_title
        );
        if !cmcontinue.is_empty() {
            url.push_str(&format!("&cmcontinue={}", cmcontinue));
        }

        let response = match client.get(&url).send().await {
            Ok(r) => r,
            Err(e) => {
                panic!("Error sending request: {}", e)
            }
        };
        let response_text = match response.text().await {
            Ok(r) => r,
            Err(e) => {
                panic!("Error reading response: {}", e)
            }
        };
        let api_response: ApiResponse = match serde_json::from_str(&response_text) {
            Ok(r) => r,
            Err(e) => {
                panic!("Error parsing response: {}\n{}", e, response_text)
            }
        };

        for member in &api_response.query.categorymembers {
            if member.title.contains(" b") {
                // Back sprite, we can skip
                continue;
            }
            if !member.title.starts_with("File:HOME") {
                // Not a HOME sprite, we can skip
                continue;
            }
            // If the character after "HOME" is not a digit, we can skip
            if !member.title[9..].starts_with(|c: char| c.is_ascii_digit()) {
                continue;
            }

            all_filenames.push(member.title.clone());
        }

        if let Some(continue_data) = api_response.continue_data {
            cmcontinue = continue_data.cmcontinue.clone();
        } else {
            break;
        }
    }

    // Write all the filenames to a file.
    let file = match std::fs::File::create("all_filenames.json") {
        Ok(f) => f,
        Err(e) => {
            panic!("Error creating file: {}", e)
        }
    };

    match serde_json::to_writer_pretty(file, &all_filenames) {
        Ok(_) => {}
        Err(e) => {
            panic!("Error writing to file: {}", e)
        }
    };

    // Now we have all the filenames, we can download them.
    // We'll do this in parallel to speed things up.
    // Then we'll write the mon -> filename mapping to a file.
    let mut mon_to_filename = HashMap::new();
    let mut tasks = Vec::new();
    let mut results = Vec::new();
    for filename in all_filenames {
        tasks.push(download_image(filename, client.clone()));
        if tasks.len() == 350 {
            // We've got 250 tasks, let's run them.
            results.extend(futures::future::join_all(tasks).await);
            tasks = Vec::new();
        }
    }

    results.extend(futures::future::join_all(tasks).await);

    let forms_regex = Regex::new(r"HOME\d+(.*)\.png").unwrap();

    // Join the results futures.
    results
        .into_iter()
        .filter(|(filename, mon)| {
            if filename.is_empty() || mon.is_empty() {
                return false;
            }
            true
        })
        .for_each(|(filename, mon)| {
            if filename.ends_with(" s.png") {
                // Shiny sprite, we can skip
                return;
            }

            // Get the "forms" from the filename by splitting on the first space.
            let mut mon = mon;
            if let Ok(Some(caps)) = forms_regex.captures(&filename) {
                let forms = caps.get(1).unwrap().as_str();
                if forms == "MX" || forms == "MY" {
                    // Add the forms to the mon name.
                    mon.push(' ');
                    mon.push_str(forms);
                }
                if !mon.contains('(') {
                    mon.push_str(" (");
                    mon.push_str(forms);
                    mon.push(')');
                }
            }

            let mon = mon.replace("; Shiny", "");
            let mon = mon.replace(", Shiny", "");

            // Insert the mon -> filename mapping.
            mon_to_filename.insert(
                mon.clone(),
                helpers::Association {
                    name: mon,
                    filename,
                },
            );
        });

    // Write the mapping to a file.
    let file = match std::fs::File::create("mon_to_filename.json") {
        Ok(f) => f,
        Err(e) => {
            panic!("Error creating file: {}", e)
        }
    };

    match serde_json::to_writer_pretty(file, &mon_to_filename) {
        Ok(_) => {}
        Err(e) => {
            panic!("Error writing to file: {}", e)
        }
    };
}

/// Downloads an image from the Bulbapedia archives and returns the filename and the Pokémon name
async fn download_image(item: String, client: reqwest::Client) -> (String, String) {
    let url = format!(
        "https://archives.bulbagarden.net/w/api.php?action=query&titles={item}&prop=globalusage|imageinfo&guprop=pageid|namespace&iiprop=url|size|dimensions|mime|comment&iilimit=100&format=json"
    );

    let response = match client.get(&url).send().await {
        Ok(r) => r,
        Err(e) => {
            panic!("Error sending request: {}", e)
        }
    };

    // Parse the response to JSON.
    let response_json: serde_json::Value = match response.json().await {
        Ok(r) => r,
        Err(e) => {
            panic!("Error reading response: {}", e)
        }
    };

    // The pokemon name will be present in the imageinfo field that the comment contains the "Summary"
    // The file is always the first imageinfo.

    let imageinfos = match response_json["query"]["pages"].as_object() {
        Some(o) => &o.values().next().unwrap()["imageinfo"],
        None => {
            panic!("Error parsing response: {:?}", response_json);
        }
    };

    let imageinfo = match imageinfos.as_array() {
        Some(a) => &a[0],
        None => {
            panic!("Error parsing response: {:?}", response_json);
        }
    };

    let url = match imageinfo["url"].as_str() {
        Some(s) => s,
        None => {
            panic!("Error parsing response: {:?}", response_json);
        }
    };

    // Download the image.
    let response = match client.get(url).send().await {
        Ok(r) => r,
        Err(e) => {
            panic!("Error sending request: {}", e)
        }
    };
    let bytes = match response.bytes().await {
        Ok(b) => b,
        Err(e) => {
            panic!("Error reading response: {}", e)
        }
    };
    let filename = "imgs/".to_owned() + &item.replace("File:", "");
    // Write the image to a file.
    match std::fs::write(&filename, bytes) {
        Ok(_) => {}
        Err(e) => {
            panic!("Error writing to file: {}", e)
        }
    };
    let re = Regex::new(MON_NAME_REGEX).unwrap();

    // Now we need to get the Pokémon name.
    for imageinfo in imageinfos.as_array().unwrap() {
        let comment = match imageinfo["comment"].as_str() {
            Some(s) => s,
            None => {
                panic!("Error parsing response: {:?}", response_json);
            }
        };
        if comment.contains("== Summary ==") {
            // This is the one we want.
            // Find the Pokémon name using the regex.
            let caps = match re.captures(comment) {
                Ok(c) => match c {
                    Some(c) => c,
                    None => {
                        return ("".to_owned(), "".to_owned());
                    }
                },
                Err(_e) => {
                    return ("".to_owned(), "".to_owned());
                }
            };

            // build the mon name from the regex captures.
            let mut mon = caps.get(1).unwrap().as_str().to_owned();
            if let Some(caps) = caps.get(2) {
                mon.push(' ');
                mon.push_str(caps.as_str());
            }

            return (filename, mon);
        }
    }

    // If no summary found, see if we can just get the name from the first imageinfo comment.
    let comment = match imageinfos[0]["comment"].as_str() {
        Some(s) => s,
        None => {
            return ("".to_owned(), "".to_owned());
        }
    };

    let caps = match re.captures(comment) {
        Ok(c) => match c {
            Some(c) => c,
            None => {
                return ("".to_owned(), "".to_owned());
            }
        },
        Err(_e) => {
            return ("".to_owned(), "".to_owned());
        }
    };

    // build the mon name from the regex captures.
    let mut mon = caps.get(1).unwrap().as_str().to_owned();
    if let Some(caps) = caps.get(2) {
        mon.push(' ');
        mon.push_str(caps.as_str());
    }

    (filename, mon)
}
