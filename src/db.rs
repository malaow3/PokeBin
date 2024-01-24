pub async fn create_db() -> sqlx::PgPool {
    let url = std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");

    // connect to the database with SQLX
    sqlx::PgPool::connect(&url).await.unwrap()
}

pub struct Paste {
    pub id: i64,
    pub title: String,
    pub author: String,
    pub notes: String,
    pub rental: String,
    pub paste: String,
    pub format: String,
}

pub async fn get_paste(db_pool: &sqlx::PgPool, id: i64) -> Result<Paste, anyhow::Error> {
    let paste = sqlx::query_as!(
        Paste,
        "SELECT id, title, author, notes, rental, paste, format FROM pastes WHERE id = $1",
        id
    )
    .fetch_one(db_pool)
    .await?;

    Ok(paste)
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
    let paste_id = sqlx::query!(
        "INSERT INTO pastes (title, author, notes, rental, paste, format) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        title,
        author,
        notes,
        rental,
        paste,
        format
    )
    .fetch_one(db_pool)
    .await?
    .id;

    Ok(paste_id)
}
