DROP DATABASE IF EXISTS "PoemDB";
CREATE DATABASE "PoemDB";

\c PoemDB;

DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
	is_admin BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP
);

DROP TABLE IF EXISTS categories;
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL
);
INSERT INTO categories (name) VALUES ('None');
INSERT INTO categories (name) VALUES ('Love');
INSERT INTO categories (name) VALUES ('Sadness');
INSERT INTO categories (name) VALUES ('Happiness');
INSERT INTO categories (name) VALUES ('Horror');
CREATE TABLE poems (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP,
    category_id INTEGER REFERENCES categories(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE comments (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    poem_id INTEGER REFERENCES poems(id) ON DELETE CASCADE
);

CREATE TABLE likes (
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    poem_id INTEGER REFERENCES poems(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, poem_id)
);