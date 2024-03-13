use axum::Router;
use blowfish::cipher::{generic_array::GenericArray, BlockDecrypt, BlockEncrypt, KeyInit};
use std::time::Duration;

use log::debug;
use tower_http::trace::TraceLayer;

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Mon {
    pub id: u32,
    pub type1: String,
    pub type2: String,
    pub has_shiny: bool,
    pub has_female: bool,
}

#[derive(Debug, serde::Serialize, serde::Deserialize, Clone)]
pub struct Move {
    pub name: String,
    pub id: u32,
    pub type1: String,
}

pub fn add_logging(app: Router) -> Router {
    app.layer(
        TraceLayer::new_for_http()
            .on_request(|request: &axum::http::Request<_>, _span: &tracing::Span| {
                let method = request.method();
                let uri = request.uri();
                debug!("{:?} {:?}", method, uri);
            })
            .on_response(
                |response: &axum::response::Response<_>,
                 duration: Duration,
                 _span: &tracing::Span| {
                    let status = response.status();
                    debug!("{:?} {:?}", status, duration);
                },
            ),
    )
}

pub fn create_cipher() -> blowfish::Blowfish {
    let key = std::env::var("POKEBIN_KEY").unwrap();
    // Create new blowfish cipher
    let cipher = blowfish::Blowfish::new_from_slice(key.as_bytes()).unwrap();
    cipher
}

pub fn encode_id(id: i64, cipher: &blowfish::Blowfish) -> String {
    let mut id_bytes = id.to_be_bytes();
    let generic_array = GenericArray::from_mut_slice(&mut id_bytes);
    cipher.encrypt_block(generic_array);
    hex::encode(generic_array)
}

pub fn decode_id(id: &str, cipher: &blowfish::Blowfish) -> Result<i64, anyhow::Error> {
    let mut id_bytes = hex::decode(id)?;
    let generic_array = GenericArray::from_mut_slice(&mut id_bytes);
    cipher.decrypt_block(generic_array);

    // Convert the generic_array into a [u8; 8] so we can use it as a u64
    let i64_bytes: &[u8; 8] = generic_array.as_slice().try_into()?;

    Ok(i64::from_be_bytes(*i64_bytes))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encode_decode() -> Result<(), anyhow::Error> {
        std::env::set_var("POKEBIN_KEY", "MYSECRET");
        let cipher = create_cipher();
        let first_id = 12345;
        let encoded = encode_id(first_id, &cipher);

        println!("{}", encoded);

        let id: i64 = 30981023981;
        let encoded_2 = encode_id(id, &cipher);
        println!("{}", encoded_2);

        assert_eq!(encoded.len(), encoded_2.len());

        let decoded = decode_id(&encoded, &cipher)?;
        println!("{}", decoded);

        assert_eq!(first_id, decoded);

        let decoded_2 = decode_id(&encoded_2, &cipher)?;
        println!("{}", decoded_2);

        assert_eq!(id, decoded_2);
        Ok(())
    }
}
