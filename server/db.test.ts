// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createDb, initSchema } from "./db.js";
import type { Db } from "./db.js";

function freshDb(): Db {
  return createDb(":memory:");
}

describe("db schema", () => {
  it("creates the three tables", () => {
    const db = freshDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all() as { name: string }[];
    expect(tables.map((row) => row.name)).toEqual(["season_data", "sessions", "users"]);
  });

  it("enforces one row per user per season", () => {
    const db = freshDb();
    const insertUser = db.prepare("INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, ?)");
    insertUser.run("alice", "hash", "2026-08-11T00:00:00.000Z");
    insertUser.run("bob", "hash", "2026-08-11T00:00:00.000Z");
    const insert = db.prepare("INSERT INTO season_data (user_id, season_id, data_json, updated_at, revision) VALUES (?, ?, ?, ?, 1)");
    insert.run(1, "s2", "{}", "2026-08-11T00:00:00.000Z");
    expect(() => insert.run(1, "s2", "{}", "2026-08-11T00:00:00.000Z")).toThrow();
    insert.run(1, "s3", "{}", "2026-08-11T00:00:00.000Z");
    insert.run(2, "s2", "{}", "2026-08-11T00:00:00.000Z");
  });

  it("initializes the schema idempotently", () => {
    const db = freshDb();
    initSchema(db);
    initSchema(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
    expect(tables.some((row) => row.name === "users")).toBe(true);
  });

  it("creates the parent directory for a file database", () => {
    const db = createDb("counter-data/test-dir/db.sqlite");
    db.close();
  });
});