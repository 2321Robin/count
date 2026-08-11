import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { Db } from "./db.js";

export type UserRow = { id: number; username: string; password_hash: string; is_admin: number; created_at: string };
export type PublicUser = { userId: number; username: string; isAdmin: boolean };

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const USERNAME_PATTERN = /^[\p{L}\p{N}_-]{2,32}$/u;

export function validateUsername(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) return "用户名需为 2–32 位字母、数字、下划线或中文。";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "密码至少 8 位。";
  if (password.length > 72) return "密码不能超过 72 位。";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type RegisterResult = { ok: true; user: PublicUser } | { ok: false; error: string };

export async function registerUser(db: Db, username: string, password: string): Promise<RegisterResult> {
  const name = username.trim();
  const nameError = validateUsername(name);
  if (nameError) return { ok: false, error: nameError };
  const pwError = validatePassword(password);
  if (pwError) return { ok: false, error: pwError };
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(name);
  if (existing) return { ok: false, error: "用户名已被注册。" };
  const passwordHash = await hashPassword(password);
  const createdAt = new Date().toISOString();
  const result = db.prepare("INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, 0, ?)").run(name, passwordHash, createdAt);
  return { ok: true, user: { userId: Number(result.lastInsertRowid), username: name, isAdmin: false } };
}

export async function verifyLogin(db: Db, username: string, password: string): Promise<PublicUser | null> {
  const row = db.prepare("SELECT id, username, is_admin, password_hash FROM users WHERE username = ?").get(username.trim()) as UserRow | undefined;
  if (!row) return null;
  if (!(await verifyPassword(password, row.password_hash))) return null;
  return { userId: row.id, username: row.username, isAdmin: row.is_admin === 1 };
}

export function insertSession(db: Db, userId: number): string {
  const token = createSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(hashSessionToken(token), userId, now.toISOString(), expiresAt);
  return token;
}

export function getUserBySessionToken(db: Db, token: string): PublicUser | null {
  if (!token) return null;
  const row = db.prepare(
    `SELECT u.id AS id, u.username AS username, u.is_admin AS is_admin
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  ).get(hashSessionToken(token), new Date().toISOString()) as { id: number; username: string; is_admin: number } | undefined;
  if (!row) return null;
  return { userId: row.id, username: row.username, isAdmin: row.is_admin === 1 };
}

export function deleteSession(db: Db, token: string): void {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
}

export type ResetResult = { ok: true } | { ok: false; error: string };

export async function resetUserPassword(db: Db, username: string, newPassword: string): Promise<ResetResult> {
  const pwError = validatePassword(newPassword);
  if (pwError) return { ok: false, error: pwError };
  const row = db.prepare("SELECT id FROM users WHERE username = ?").get(username.trim()) as { id: number } | undefined;
  if (!row) return { ok: false, error: "找不到该用户。" };
  const passwordHash = await hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, row.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.id);
  return { ok: true };
}
