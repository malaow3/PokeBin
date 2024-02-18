use deku::prelude::*;

pub async fn create_db() -> sqlx::PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    // connect to the database with SQLX
    sqlx::PgPool::connect(&url).await.unwrap()
}

#[derive(Debug, PartialEq, DekuRead, DekuWrite)]
pub struct Paste {
    pub id: i64,
    // For strings, you might consider using Vec<u8> and handling conversion separately
    pub title_len: u64,
    #[deku(count = "title_len")]
    pub title: Vec<u8>,

    pub author_len: u64,
    #[deku(count = "author_len")]
    pub author: Vec<u8>,

    pub notes_len: u64,
    #[deku(count = "notes_len")]
    pub notes: Vec<u8>,

    pub rental_len: u8,
    #[deku(count = "rental_len")]
    pub rental: Vec<u8>,

    pub paste_len: u64,
    #[deku(count = "paste_len")]
    pub paste: Vec<u8>,

    pub format_len: u64,
    #[deku(count = "format_len")]
    pub format: Vec<u8>,
}

pub enum DBResult {
    Paste(Paste),
    EncryptedPaste(String),
}

pub async fn get_paste(db_pool: &sqlx::PgPool, id: i64) -> Result<DBResult, anyhow::Error> {
    let row = sqlx::query!("SELECT data, encrypted FROM pastes_comp WHERE id = $1", id)
        .fetch_one(db_pool)
        .await?;

    let data = row.data;
    let encrypted = row.encrypted;

    if !encrypted {
        let (_, paste) = Paste::from_bytes((&data, 0)).unwrap();
        return Ok(DBResult::Paste(paste));
    }

    let encrypted_string = match String::from_utf8(data) {
        Ok(s) => s,
        Err(e) => {
            return Err(anyhow::Error::msg(format!(
                "Could not convert bytes to string: {:?}",
                e
            )))
        }
    };
    Ok(DBResult::EncryptedPaste(encrypted_string))
}

pub async fn create_paste(
    title: &str,
    author: &str,
    notes: &str,
    rental: &str,
    paste: &str,
    format: &str,
    db_pool: &sqlx::PgPool,
) -> Result<i64, anyhow::Error> {
    let paste = Paste {
        id: 0,
        title_len: title.as_bytes().len() as u64,
        title: title.as_bytes().to_vec(),

        author_len: author.as_bytes().len() as u64,
        author: author.as_bytes().to_vec(),

        notes_len: notes.as_bytes().len() as u64,
        notes: notes.as_bytes().to_vec(),

        rental_len: rental.as_bytes().len() as u8,
        rental: rental.as_bytes().to_vec(),

        paste_len: paste.as_bytes().len() as u64,
        paste: paste.as_bytes().to_vec(),

        format_len: format.as_bytes().len() as u64,
        format: format.as_bytes().to_vec(),
    };

    let paste_id = sqlx::query!(
        "INSERT INTO pastes_comp (data, encrypted) VALUES ($1, FALSE) RETURNING id",
        paste.to_bytes().unwrap()
    )
    .fetch_one(db_pool)
    .await?
    .id;

    Ok(paste_id)
}

pub async fn create_paste_encrypted(
    encrypted_data: &str,
    db_pool: &sqlx::PgPool,
) -> Result<i64, anyhow::Error> {
    let data_bytes_array = encrypted_data.bytes().collect::<Vec<u8>>();
    let paste_id = sqlx::query!(
        "INSERT INTO pastes_comp (data, encrypted) VALUES ($1, TRUE) RETURNING id",
        data_bytes_array.as_slice()
    )
    .fetch_one(db_pool)
    .await?
    .id;

    Ok(paste_id)
}
