import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Db = Database.Database;

export function initSchema(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin      INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS season_data (
      user_id    INTEGER NOT NULL REFERENCES users(id),
      season_id  TEXT NOT NULL,
      data_json  TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      revision   INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, season_id)
    );
  `);
}

export function createDb(filename: string): Db {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma("foreign_keys = ON");
  initSchema(db);
  return db;
}
