#!/bin/bash

# Path to the .env file
ENV_FILE="./.env"

# Check if the .env file exists
if [ ! -f "$ENV_FILE" ]; then
    echo "Error: .env file not found."
    exit 1
fi

# Extract DATABASE_URL from the .env file
DATABASE_URL=$(grep DATABASE_URL $ENV_FILE | cut -d '=' -f2- | tr -d '"' | tr -d "'")

# Check if DATABASE_URL is empty
if [ -z "$DATABASE_URL" ]; then
    echo "Error: DATABASE_URL not set in .env file."
    exit 1
fi

# SQL command to create the 'pastes' table
CREATE_TABLE_SQL="
CREATE TABLE IF NOT EXISTS pastes (
    id BIGSERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    author TEXT NOT NULL,
    notes TEXT NOT NULL,
    rental TEXT NOT NULL,
    paste TEXT NOT NULL,
    format TEXT NOT NULL
);"

# Execute the SQL command
echo $CREATE_TABLE_SQL | psql $DATABASE_URL

CREATE_TABLE_SQL="
CREATE TABLE IF NOT EXISTS pastes_comp (
    id BIGSERIAL PRIMARY KEY,
	data BYTEA NOT NULL,
	encrypted BOOLEAN NOT NULL
);"

# Execute the SQL command
echo $CREATE_TABLE_SQL | psql $DATABASE_URL
# Check for success or failure
if [ $? -eq 0 ]; then
    echo "Database schema created successfully."
else
    echo "Failed to create database schema." >&2
    exit 1
fi
