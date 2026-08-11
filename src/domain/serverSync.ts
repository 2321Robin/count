import { migrateAppData } from "./migration";
import type { SeasonId } from "./seasons";
import type { AppData } from "./types";

export type Session = { userId: number; username: string; isAdmin: boolean };

export type MigrationState =
  | { kind: "upload-local" }
  | { kind: "choose"; cloudUpdatedAt: string; localModifiedAt: string };

const SESSION_STORAGE_KEY = "s2-capture-counter:session";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.userId !== "number" || typeof record.username !== "string" || typeof record.isAdmin !== "boolean") return null;
    return { userId: record.userId, username: record.username, isAdmin: record.isAdmin };
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export type AuthResult = { ok: true; session: Session } | { ok: false; error: string };

function authError(prefix: string, status: number): string {
  if (status === 401) return `${prefix}失败：用户名或密码错误，或登录已过期。`;
  if (status === 429) return `${prefix}失败：操作太频繁，请稍后再试。`;
  return `${prefix}失败：服务器返回 ${status}。`;
}

async function authRequest(path: string, username: string, password: string, prefix: string): Promise<AuthResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password }),
    });
    const payload = await response.json().catch(() => null) as { error?: unknown; userId?: unknown; username?: unknown; isAdmin?: unknown } | null;
    if (!response.ok) return { ok: false, error: typeof payload?.error === "string" ? payload.error : authError(prefix, response.status) };
    if (typeof payload?.userId !== "number" || typeof payload.username !== "string") return { ok: false, error: "服务器返回异常。" };
    return { ok: true, session: { userId: payload.userId, username: payload.username, isAdmin: payload.isAdmin === true } };
  } catch {
    return { ok: false, error: "无法连接服务器，请检查网络。" };
  }
}

export function registerAccount(username: string, password: string): Promise<AuthResult> {
  return authRequest("/api/register", username, password, "注册");
}

export function loginAccount(username: string, password: string): Promise<AuthResult> {
  return authRequest("/api/login", username, password, "登录");
}

export async function logoutAccount(): Promise<void> {
  try {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
  } catch {
    // 网络失败不阻断登出流程；服务端会话会自然过期。
  }
}

export async function fetchMe(): Promise<Session | null> {
  try {
    const response = await fetch("/api/me", { credentials: "same-origin" });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null) as { userId?: unknown; username?: unknown; isAdmin?: unknown } | null;
    // 非 JSON 响应体视作无效会话，按未登录处理
    if (!payload) return null;
    if (typeof payload.userId !== "number" || typeof payload.username !== "string") return null;
    return { userId: payload.userId, username: payload.username, isAdmin: payload.isAdmin === true };
  } catch {
    return null;
  }
}

export async function adminResetPassword(username: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, newPassword }),
    });
    const payload = await response.json().catch(() => null) as { error?: unknown } | null;
    if (!response.ok) return { ok: false, error: typeof payload?.error === "string" ? payload.error : "重置失败：服务器返回 " + response.status + "。" };
    return { ok: true };
  } catch {
    return { ok: false, error: "无法连接服务器，请检查网络。" };
  }
}

export type ServerDataPull =
  | { ok: true; empty: false; data: AppData; updatedAt: string }
  | { ok: true; empty: true }
  | { ok: false; error: string };

function dataError(prefix: string, status: number, serverError?: unknown): string {
  if (status === 401) return `${prefix}失败：登录已过期，请重新登录。`;
  if (status === 429) return typeof serverError === "string" ? serverError : `${prefix}失败：操作太频繁，请稍后再试。`;
  return `${prefix}失败：服务器返回 ${status}。`;
}

export async function pullFromServer(seasonId: SeasonId): Promise<ServerDataPull> {
  try {
    const response = await fetch(`/api/data/${seasonId}`, { credentials: "same-origin" });
    const payload = await response.json().catch(() => null) as { data?: unknown; updatedAt?: unknown; error?: unknown } | null;
    if (!response.ok) return { ok: false, error: dataError("拉取", response.status, payload?.error) };
    // 2xx 但响应体不是 JSON 时视为协议异常，落入外层 catch 的网络失败文案
    if (!payload) throw new Error("invalid payload");
    if (payload.data === null || payload.data === undefined) return { ok: true, empty: true };
    if (typeof payload.updatedAt !== "string") return { ok: false, error: "服务器返回异常。" };
    const data = migrateAppData(payload.data, seasonId);
    if (!data) return { ok: false, error: "拉取失败：云端数据格式无效。" };
    return { ok: true, empty: false, data, updatedAt: payload.updatedAt };
  } catch {
    return { ok: false, error: "拉取失败：无法连接服务器，请检查网络。" };
  }
}

export type ServerDataPush = { ok: true; updatedAt: string } | { ok: false; error: string };

export async function pushToServer(data: AppData, seasonId: SeasonId): Promise<ServerDataPush> {
  try {
    const response = await fetch(`/api/data/${seasonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(data),
    });
    const payload = await response.json().catch(() => null) as { updatedAt?: unknown; error?: unknown } | null;
    if (!response.ok) return { ok: false, error: dataError("上传", response.status, payload?.error) };
    // 2xx 但响应体不是 JSON 时视为协议异常，落入外层 catch 的网络失败文案
    if (!payload) throw new Error("invalid payload");
    if (typeof payload.updatedAt !== "string") return { ok: false, error: "服务器返回异常。" };
    return { ok: true, updatedAt: payload.updatedAt };
  } catch {
    return { ok: false, error: "上传失败：无法连接服务器，请检查网络。" };
  }
}

export function lastServerUpdatedAtKey(seasonId: SeasonId, userId: number): string {
  return `s2-capture-counter:${userId}:last-server-updated-at:${seasonId}`;
}

export function loadLastServerUpdatedAt(seasonId: SeasonId, userId: number): string | null {
  return localStorage.getItem(lastServerUpdatedAtKey(seasonId, userId));
}

export function saveLastServerUpdatedAt(seasonId: SeasonId, userId: number, updatedAt: string): void {
  localStorage.setItem(lastServerUpdatedAtKey(seasonId, userId), updatedAt);
}

export function clearLastServerUpdatedAt(seasonId: SeasonId, userId: number): void {
  localStorage.removeItem(lastServerUpdatedAtKey(seasonId, userId));
}
