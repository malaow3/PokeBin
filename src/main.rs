mod db;
mod download_images;
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

            std::fs::write("data/items.json", items_json).unwrap();
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
    let file = std::fs::File::open("data/pokemon.json").unwrap();
    let map: HashMap<String, utils::Mon> = serde_json::from_reader(file).unwrap();

    let item_file = std::fs::File::open("data/items.json").unwrap();
    let item_map: HashMap<String, Value> = serde_json::from_reader(item_file).unwrap();

    let move_file = std::fs::File::open("data/moves.json").unwrap();
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
        .allow_methods([http::Method::GET, http::Method::POST])
        .allow_headers(Any);

    let app = axum::Router::new()
        .route("/create", post(create_paste))
        // Serve the about.html file
        .nest_service(
            "/assets/favicon",
            axum::routing::get_service(ServeDir::new("./web/dist/favicon")),
        )
        .nest_service(
            "/about",
            axum::routing::get_service(ServeDir::new("./web/solid/dist/about.html")),
        )
        .nest_service("/home", axum::routing::get_service(ServeDir::new("./home")))
        // Serve the web/dist folder as static files
        .nest_service(
            "/:id",
            axum::routing::get_service(ServeDir::new("./web/solid/dist/paste.html")),
        )
        //.route("/:id", get(get_paste))
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
        .route(
            "/assets/missing",
            // Serve the image file
            get(|| async move {
                let file = match tokio::fs::File::open("web/dist/missing.png").await {
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
        .route("/other-data-info", get(get_other_data_info))
        .nest_service(
            "/static",
            axum::routing::get_service(ServeDir::new("./web/solid/dist/static")),
        )
        .fallback_service(axum::routing::get_service(ServeDir::new(
            "./web/solid/dist",
        )))
        // Serve the images in the home folder.
        .layer(cors)
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
    encrypted_data: String,
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
    let encrypted_data = payload.encrypted_data.trim();

    // Remove "\r" from the end of the string
    let title = title.replace('\r', "");
    let author = author.replace('\r', "");
    let notes = notes.replace('\r', "");
    let rental = rental.replace('\r', "");
    let paste = paste.replace('\r', "");
    let format = format.replace('\r', "");
    let encrypted_data = encrypted_data.replace('\r', "");

    if payload.encrypted_data.is_empty() {
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
        return axum::response::Redirect::to(&format!("/{id}")).into_response();
    }

    info!("Encrypted data received");

    let id = match db::create_paste_encrypted(encrypted_data.trim(), &state.db_pool).await {
        Ok(id) => encode_id(id, &state.cipher),
        Err(e) => return (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    };

    // Redirect to the paste page.
    axum::response::Redirect::to(&format!("/{id}")).into_response()
}

//async fn get_paste(State(_state): State<AppState>, Path(id): Path<String>) -> Response {
//    //let template = templates::PasteTemplate { paste: id };
//    HtmlTemplate(template).into_response()
//}

async fn get_paste_json(State(state): State<AppState>, Path(id): Path<String>) -> Response {
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

    let mut paste = match paste {
        db::DBResult::Paste(p) => p,
        db::DBResult::EncryptedPaste(e) => {
            // Early return the JSON.
            return Json(json!({
                "encrypted_data": e,
                "mons": state.mon_map,
                "items": state.item_map,
                "moves": state.move_map,
            }))
            .into_response();
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

async fn get_other_data_info(State(state): State<AppState>) -> Response {
    Json(json!({
        "mons": state.mon_map,
        "items": state.item_map,
        "moves": state.move_map,
    }))
    .into_response()
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
        Ok(p) => p,
        Err(_) => {
            // Redirect to the home page.
            return axum::response::Redirect::to("/").into_response();
        }
    };

    match paste {
        db::DBResult::Paste(p) => Json(json!({
            "title": String::from_utf8_lossy(&p.title),
            "author": String::from_utf8_lossy(&p.author),
            "notes": String::from_utf8_lossy(&p.notes),
            "format": String::from_utf8_lossy(&p.format),
            "rental": String::from_utf8_lossy(&p.rental),
            "paste": String::from_utf8_lossy(&p.paste),
        }))
        .into_response(),
        db::DBResult::EncryptedPaste(e) => {
            // Early return the JSON.
            Json(json!({
                "encrypted_data": e,
            }))
            .into_response()
        }
    }
}
