// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createDb } from "./db.js";
import type { Db } from "./db.js";
import {
  deleteSession,
  getUserBySessionToken,
  hashSessionToken,
  insertSession,
  registerUser,
  resetUserPassword,
  validatePassword,
  validateUsername,
  verifyLogin,
} from "./auth.js";

function freshDb(): Db {
  return createDb(":memory:");
}

describe("auth", () => {
  it("rejects invalid usernames and passwords", () => {
    expect(validateUsername("a")).not.toBeNull();
    expect(validateUsername("")).not.toBeNull();
    expect(validateUsername("ab cd")).not.toBeNull();
    expect(validateUsername("阿伟")).toBeNull();
    expect(validateUsername("alice_123")).toBeNull();
    expect(validatePassword("short")).not.toBeNull();
    expect(validatePassword("password1")).toBeNull();
    expect(validatePassword("x".repeat(73))).not.toBeNull();
  });

  it("registers a user and rejects duplicates", async () => {
    const db = freshDb();
    const first = await registerUser(db, "alice", "password1");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.user).toEqual({ userId: 1, username: "alice", isAdmin: false });
    const dup = await registerUser(db, "alice", "password1");
    expect(dup).toEqual({ ok: false, error: "用户名已被注册。" });
    const invalid = await registerUser(db, "a", "password1");
    expect(invalid.ok).toBe(false);
  });

  it("logs in with the right password only", async () => {
    const db = freshDb();
    await registerUser(db, "alice", "password1");
    expect(await verifyLogin(db, "alice", "password1")).not.toBeNull();
    expect(await verifyLogin(db, "alice", "wrong")).toBeNull();
    expect(await verifyLogin(db, "nobody", "password1")).toBeNull();
  });

  it("creates sessions that round-trip through the token hash and expire", async () => {
    const db = freshDb();
    await registerUser(db, "alice", "password1");
    const token = insertSession(db, 1);
    expect(token.length).toBeGreaterThanOrEqual(32);
    const user = getUserBySessionToken(db, token);
    expect(user).toEqual({ userId: 1, username: "alice", isAdmin: false });
    expect(getUserBySessionToken(db, hashSessionToken(token))).toBeNull(); // 传哈希当 token 无效
    expect(getUserBySessionToken(db, "bogus")).toBeNull();
    expect(getUserBySessionToken(db, "")).toBeNull();

    db.prepare("UPDATE sessions SET expires_at = ?").run(new Date(Date.now() - 1000).toISOString());
    expect(getUserBySessionToken(db, token)).toBeNull();

    deleteSession(db, token);
    expect(getUserBySessionToken(db, token)).toBeNull();
  });

  it("resets a password and revokes existing sessions", async () => {
    const db = freshDb();
    await registerUser(db, "alice", "password1");
    const token = insertSession(db, 1);
    const result = await resetUserPassword(db, "alice", "new-password-2");
    expect(result).toEqual({ ok: true });
    expect(await verifyLogin(db, "alice", "new-password-2")).not.toBeNull();
    expect(await verifyLogin(db, "alice", "password1")).toBeNull();
    expect(getUserBySessionToken(db, token)).toBeNull();
    const missing = await resetUserPassword(db, "nobody", "new-password-2");
    expect(missing).toEqual({ ok: false, error: "找不到该用户。" });
  });
});
