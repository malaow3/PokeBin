mod db;
mod download_images;
mod helpers;
mod templates;
mod utils;

use axum::response::IntoResponse;
use axum::response::Response;
use lazy_static::lazy_static;
use std::{collections::HashMap, sync::Arc};
use templates::HtmlTemplate;
use tokio_util::io::ReaderStream;
use utils::encode_id;
use utils::Move;

use axum::{
    extract::{Path, State},
    http::StatusCode,
    routing::{get, post},
    Json,
};
use clap::Parser;

use download_images::run_img;
use log::{info, LevelFilter};
use serde_json::{json, Value};

use tower_http::cors::{Any, CorsLayer};
use tower_http::services::ServeDir;

use crate::utils::Mon;

#[derive(Parser, Debug)]
struct Args {
    #[clap(subcommand)]
    command: Option<Command>,
}

#[derive(clap::Subcommand, Debug)]
enum Command {
    Img,
    Items,
}

#[tokio::main]
async fn main() {
    dotenv::dotenv().ok();
    trunkrs::init_env_logging(true, LevelFilter::Debug, Some("pokebin"));

    let args = Args::parse();

    match args.command {
        Some(Command::Img) => run_img().await,
        Some(Command::Items) => {
            // Read the contents of the JavaScript file (replace with your file path)
            let js_code = std::fs::read_to_string("data/items.js").unwrap();

            // Split on "=" and remove the first element
            let js_code = js_code.split('=').collect::<Vec<&str>>()[1].trim();
            // Remove the last character
            let js_code = js_code[0..js_code.len() - 1].trim();

            // Define a regular expression pattern to match keys without double quotes
            let pattern = r#"([,{]\s*)(\w+)\s*:"#;

            // Replace matched keys with quotes around them
            let adjusted_js_code = fancy_regex::Regex::new(pattern)
                .unwrap()
                .replace_all(js_code, |caps: &fancy_regex::Captures| {
                    format!("{}\"{}\":", &caps[1], &caps[2])
                })
                .to_string();

            // Parse the modified data as JSON in Rust
            let parsed_json: Value = serde_json::from_str(&adjusted_js_code).unwrap();

            // Now you have the data as a JSON Value
            println!("{:#?}", parsed_json);

            // Write it to a file
            let mut new_items = HashMap::new();
            for (_k, v) in parsed_json.as_object().unwrap() {
                new_items.insert(v["name"].as_str().unwrap().to_string(), v);
            }

            let items_json = serde_json::to_string_pretty(&new_items).unwrap();

            std::fs::write("items.json", items_json).unwrap();
        }
        None => run_main().await,
    }
}

#[derive(Clone)]
struct AppState {
    db_pool: Arc<sqlx::PgPool>,
    cipher: Arc<blowfish::Blowfish>,
    mon_map: Arc<HashMap<String, Mon>>,
    move_map: Arc<HashMap<String, Move>>,
    item_map: Arc<HashMap<String, Value>>,
}

lazy_static! {
    static ref RE_HEAD: regex::Regex = regex::Regex::new(r#"^(?:(.* \()([A-Z][a-z0-9:']+\.?(?:[- ][A-Za-z][a-z0-9:']*\.?)*)(\))|([A-Z][a-z0-9:']+\.?(?:[- ][A-Za-z][a-z0-9:']*\.?)*))(?:( \()([MF])(\)))?(?:( @ )([A-Z][a-z0-9:']*(?:[- ][A-Z][a-z0-9:']*)*))?( *)$"#).unwrap();
    static ref RE_MOVE: regex::Regex = regex::Regex::new(r#"^(-)( ([A-Z][a-z\']*(?:[- ][A-Za-z][a-z\']*)*)(?: \[([A-Z][a-z]+)\])?(?: / [A-Z][a-z\']*(?:[- ][A-Za-z][a-z\']*)*)* *)$"#).unwrap();
    static ref RE_STAT: regex::Regex = regex::Regex::new(r#"^(\d+ HP)?( / )?(\d+ Atk)?( / )?(\d+ Def)?( / )?(\d+ SpA)?( / )?(\d+ SpD)?( / )?(\d+ Spe)?( *)$"#).unwrap();
    static ref IS_SHINY: regex::Regex = regex::Regex::new(r#"Shiny: Yes"#).unwrap();
}

async fn run_main() {
    // Spin up an axum server
    info!("Starting server");
    let db_pool = db::create_db().await;
    let cipher = utils::create_cipher();
    let file = std::fs::File::open("pokemon.json").unwrap();
    let mut map: HashMap<String, utils::Mon> = serde_json::from_reader(file).unwrap();
    helpers::verify_map(&mut map);

    let item_file = std::fs::File::open("items.json").unwrap();
    let item_map: HashMap<String, Value> = serde_json::from_reader(item_file).unwrap();

    let move_file = std::fs::File::open("moves.json").unwrap();
    let move_map: HashMap<String, utils::Move> = serde_json::from_reader(move_file).unwrap();

    let state = AppState {
        db_pool: Arc::new(db_pool),
        cipher: Arc::new(cipher),
        mon_map: Arc::new(map.clone()),
        move_map: Arc::new(move_map),
        item_map: Arc::new(item_map),
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods([http::Method::GET, http::Method::POST]);

    let app = axum::Router::new()
        .layer(cors)
        .route("/create", post(create_paste))
        .route(
            "/get-img/:mon/:shiny/:female",
            get(
                |Path((mon, shiny, female)): Path<(String, bool, bool)>| async move {
                    let img = helpers::get_image(&map, &mon, shiny, female);
                    println!("Image: {}", img);

                    // replace "home" with "imgs"
                    let img = img.replace("home", "imgs");
                    (
                        axum::http::StatusCode::OK,
                        Json(json!({
                            "img": img
                        })),
                    )
                },
            ),
        )
        // Serve the about.html file
        .nest_service(
            "/about",
            axum::routing::get_service(ServeDir::new("./web/dist/about.html")),
        )
        .nest_service("/imgs", axum::routing::get_service(ServeDir::new("./home")))
        // Serve the web/dist folder as static files
        .route("/:id", get(get_paste))
        .route("/detailed/:id", get(get_paste_json_detailed))
        .route("/:id/json", get(get_paste_json))
        .route(
            "/assets/sprites",
            // Serve the image file
            get(|| async move {
                let file = match tokio::fs::File::open("web/dist/itemicons-sheet.png").await {
                    Ok(file) => file,
                    Err(err) => {
                        return Err((StatusCode::NOT_FOUND, format!("File not found: {}", err)))
                    }
                };
                // convert the `AsyncRead` into a `Stream`
                let stream = ReaderStream::new(file);
                // convert the `Stream` into an `axum::body::HttpBody`
                let body = axum::body::Body::from_stream(stream);

                Ok(body)
            }),
        )
        .fallback_service(axum::routing::get_service(ServeDir::new("./web/dist")))
        // Serve the images in the home folder.
        .with_state(state);

    let app = utils::add_logging(app);

    let listener = tokio::net::TcpListener::bind("0.0.0.0:8000").await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

#[derive(serde::Deserialize, Debug)]
struct Payload {
    title: String,
    author: String,
    notes: String,
    rental: String,
    paste: String,
    format: String,
}

async fn create_paste(
    State(state): State<AppState>,
    // Form data
    axum::Form(payload): axum::Form<Payload>,
) -> Response {
    let title = payload.title.trim();
    let author = payload.author.trim();
    let notes = payload.notes.trim();
    let rental = payload.rental.trim();
    let paste = payload.paste.trim();
    let format = payload.format.trim();

    // Remove "\r" from the end of the string
    let title = title.replace('\r', "");
    let author = author.replace('\r', "");
    let notes = notes.replace('\r', "");
    let rental = rental.replace('\r', "");
    let paste = paste.replace('\r', "");
    let format = format.replace('\r', "");

    let id = match db::create_paste(
        title.trim(),
        author.trim(),
        notes.trim(),
        &rental,
        paste.trim(),
        format.trim(),
        &state.db_pool,
    )
    .await
    {
        Ok(id) => encode_id(id, &state.cipher),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    // Redirect to the paste page.
    axum::response::Redirect::to(&format!("/{id}")).into_response()
}

async fn get_paste(State(state): State<AppState>, Path(id): Path<String>) -> Response {
    let decode_id = match utils::decode_id(&id, &state.cipher) {
        Ok(id) => id,
        Err(_) => {
            // Redirect to the home page.
            return axum::response::Redirect::to("/").into_response();
        }
    };
    // Get the paste from the database.
    match db::get_paste(&state.db_pool, decode_id).await {
        Ok(paste) => paste,
        Err(_) => {
            // Redirect to the home page.
            return axum::response::Redirect::to("/").into_response();
        }
    };

    let template = templates::PasteTemplate { paste: id };
    HtmlTemplate(template).into_response()
}

async fn get_paste_json(State(state): State<AppState>, Path(id): Path<String>) -> Response {
    let decode_id = match utils::decode_id(&id, &state.cipher) {
        Ok(id) => id,
        Err(_) => {
            // Redirect to the home page.
            return axum::response::Redirect::to("/").into_response();
        }
    };

    // Get the paste from the database.
    let mut paste = match db::get_paste(&state.db_pool, decode_id).await {
        Ok(paste) => paste,
        Err(_) => {
            // Redirect to the home page.
            return axum::response::Redirect::to("/").into_response();
        }
    };

    if !paste.format.is_empty() {
        paste.notes = format!(
            "Format: {}\n{}",
            String::from_utf8_lossy(&paste.format),
            String::from_utf8_lossy(&paste.notes)
        )
        .into();
    }

    Json(json!({
        "title": String::from_utf8_lossy(&paste.title),
        "author": String::from_utf8_lossy(&paste.author),
        "notes": String::from_utf8_lossy(&paste.notes),
        "paste": String::from_utf8_lossy(&paste.paste),
    }))
    .into_response()
}

#[derive(serde::Serialize, serde::Deserialize)]
struct Content {
    text: Option<String>,
    mon: Option<Set>,
}

#[derive(serde::Serialize, serde::Deserialize, Default)]
struct Set {
    name: String,
    search_name: String,
    image: String,
    item: String,
    item_img: String,
    moves: Vec<Move>,
    type1: String,
    gender: String,
    other: Vec<String>,
    hp: u32,
    atk: u32,
    def: u32,
    spa: u32,
    spd: u32,
    spe: u32,
    hp_iv: Option<u32>,
    atk_iv: Option<u32>,
    def_iv: Option<u32>,
    spa_iv: Option<u32>,
    spd_iv: Option<u32>,
    spe_iv: Option<u32>,
    nickname: String,
}

async fn get_paste_json_detailed(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Response {
    let decode_id = match utils::decode_id(&id, &state.cipher) {
        Ok(id) => id,
        Err(_) => {
            // Redirect to the home page.
            return axum::response::Redirect::to("/").into_response();
        }
    };

    // Get the paste from the database.
    let paste = match db::get_paste(&state.db_pool, decode_id).await {
        Ok(paste) => paste,
        Err(_) => {
            // Redirect to the home page.
            return axum::response::Redirect::to("/").into_response();
        }
    };

    // Split the paste on 2+ newlines.
    let paste_string = String::from_utf8_lossy(&paste.paste);
    let sets = paste_string
        .split("\n\n")
        .filter_map(|s| {
            if s.is_empty() {
                return None;
            }
            Some(s.trim())
        })
        .collect::<Vec<&str>>();

    let mut contents = vec![];

    for set in sets {
        let lines = set.lines().collect::<Vec<&str>>();
        let m = RE_HEAD.captures(lines[0]);
        if m.is_none() {
            contents.push(Content {
                text: Some(set.to_string()),
                mon: None,
            });
            continue;
        }

        let mut setmon = Set::default();

        let m = m.unwrap();
        if let Some(name) = m.get(2) {
            // Get the pokemon data.
            let searchname = name.as_str().to_lowercase().replace(' ', "-");
            let mon = helpers::search_like(&state.mon_map, &searchname);
            setmon.name = name.as_str().to_string();
            if let Some((search_name, mon)) = mon {
                setmon.search_name = search_name;
                setmon.type1 = mon.type1;
                let nickname = m.get(1).unwrap().as_str();
                setmon.nickname = nickname[0..nickname.len() - 1].to_string();
            }
        } else if let Some(name) = m.get(4) {
            // Get the pokemon data.
            let searchname = name.as_str().to_lowercase().replace(' ', "-");
            let mon = helpers::search_like(&state.mon_map, &searchname);
            setmon.name = name.as_str().to_string();
            if let Some((search_name, mon)) = mon {
                setmon.search_name = search_name;
                setmon.type1 = mon.type1;
            }
        }

        if let Some(item) = m.get(6) {
            let gender = item.as_str();
            if gender == "M" {
                setmon.gender = "m".to_string();
            } else if gender == "F" {
                setmon.gender = "f".to_string();
            }
        }

        if let Some(item) = m.get(9) {
            setmon.item = item.as_str().to_string();
            setmon.item_img = helpers::get_item_image(&state.item_map, &setmon.item);
        }

        // Get the image for the mon.
        let is_female = setmon.gender == "f";
        let is_shiny = IS_SHINY.is_match(set);
        let image = helpers::get_image(&state.mon_map, &setmon.search_name, is_shiny, is_female);
        setmon.image = image.replace("home", "imgs");

        // Get the moves.
        for line in lines[1..].iter() {
            let m = RE_MOVE.captures(line);
            if m.is_some() {
                let m = m.unwrap();
                if let Some(move_name) = m.get(3) {
                    let move_search = move_name.as_str().to_lowercase().replace(' ', "-");
                    let move_item = helpers::search_like(&state.move_map, &move_search);
                    if let Some((_, move_item)) = move_item {
                        setmon.moves.push(Move {
                            name: move_name.as_str().to_string(),
                            type1: move_item.type1,
                            id: 0,
                        });
                    } else {
                        setmon.moves.push(Move {
                            name: move_name.as_str().to_string(),
                            type1: "".to_string(),
                            id: 0,
                        })
                    }
                }
            } else if line.starts_with("EVs: ") {
                let evs = line.split(": ").collect::<Vec<&str>>();
                let m = RE_STAT.captures(evs[1]);
                if m.is_some() {
                    let m = m.unwrap();
                    if let Some(evs) = m.get(1) {
                        setmon.hp = evs.as_str().split(' ').collect::<Vec<&str>>()[0]
                            .parse()
                            .unwrap();
                    }
                    if let Some(evs) = m.get(3) {
                        setmon.atk = evs.as_str().split(' ').collect::<Vec<&str>>()[0]
                            .parse()
                            .unwrap();
                    }
                    if let Some(evs) = m.get(5) {
                        setmon.def = evs.as_str().split(' ').collect::<Vec<&str>>()[0]
                            .parse()
                            .unwrap();
                    }
                    if let Some(evs) = m.get(7) {
                        setmon.spa = evs.as_str().split(' ').collect::<Vec<&str>>()[0]
                            .parse()
                            .unwrap();
                    }
                    if let Some(evs) = m.get(9) {
                        setmon.spd = evs.as_str().split(' ').collect::<Vec<&str>>()[0]
                            .parse()
                            .unwrap();
                    }
                    if let Some(evs) = m.get(11) {
                        setmon.spe = evs.as_str().split(' ').collect::<Vec<&str>>()[0]
                            .parse()
                            .unwrap();
                    }
                }
            } else if line.starts_with("IVs: ") {
                let ivs = line.split(": ").collect::<Vec<&str>>();
                let m = RE_STAT.captures(ivs[1]);
                if m.is_some() {
                    let m = m.unwrap();
                    if let Some(ivs) = m.get(1) {
                        setmon.hp_iv = Some(
                            ivs.as_str().split(' ').collect::<Vec<&str>>()[0]
                                .parse()
                                .unwrap(),
                        );
                    }
                    if let Some(ivs) = m.get(3) {
                        setmon.atk_iv = Some(
                            ivs.as_str().split(' ').collect::<Vec<&str>>()[0]
                                .parse()
                                .unwrap(),
                        );
                    }
                    if let Some(ivs) = m.get(5) {
                        setmon.def_iv = Some(
                            ivs.as_str().split(' ').collect::<Vec<&str>>()[0]
                                .parse()
                                .unwrap(),
                        );
                    }
                    if let Some(ivs) = m.get(7) {
                        setmon.spa_iv = Some(
                            ivs.as_str().split(' ').collect::<Vec<&str>>()[0]
                                .parse()
                                .unwrap(),
                        );
                    }
                    if let Some(ivs) = m.get(9) {
                        setmon.spd_iv = Some(
                            ivs.as_str().split(' ').collect::<Vec<&str>>()[0]
                                .parse()
                                .unwrap(),
                        );
                    }
                    if let Some(ivs) = m.get(11) {
                        setmon.spe_iv = Some(
                            ivs.as_str().split(' ').collect::<Vec<&str>>()[0]
                                .parse()
                                .unwrap(),
                        );
                    }
                }
            } else {
                setmon.other.push(line.to_string());
            }
        }

        contents.push(Content {
            text: None,
            mon: Some(setmon),
        })
    }

    Json(json!({
        "title": String::from_utf8_lossy(&paste.title),
        "author": String::from_utf8_lossy(&paste.author),
        "notes": String::from_utf8_lossy(&paste.notes),
        "rental": String::from_utf8_lossy(&paste.rental),
        "format": String::from_utf8_lossy(&paste.format),
        "sets": contents
    }))
    .into_response()
}
