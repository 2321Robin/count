import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context, Next } from "hono";
import { deleteSession, getUserBySessionToken, insertSession, registerUser, resetUserPassword, verifyLogin } from "./auth.js";
import { createRateLimiter } from "./rateLimit.js";
import type { Db } from "./db.js";

const SEASON_IDS = ["s2", "s3"] as const;
type SeasonId = (typeof SEASON_IDS)[number];
function isSeasonId(value: string): value is SeasonId {
  return value === "s2" || value === "s3";
}

type AppDataShape = { version: number; creatures: unknown[]; [key: string]: unknown };
function isAppDataShape(value: unknown): value is AppDataShape {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.version === "number" && Array.isArray(record.creatures);
}

const SESSION_COOKIE = "counter_session";
const MAX_DATA_BYTES = 2_000_000;
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export type AppOptions = { rateLimit?: { limit: number; windowMs: number } };

type Env = { Variables: { userId: number; isAdmin: boolean } };

export function createApp(db: Db, options: AppOptions = {}) {
  const app = new Hono<Env>();
  const rateLimit = createRateLimiter(options.rateLimit ?? { limit: 5, windowMs: 60_000 });
  const isProd = process.env.NODE_ENV === "production";

  function clientIp(c: Context): string {
    // 生产环境部署在 nginx 反代后，nginx 已用 X-Real-IP 覆写真实客户端地址；
    // 优先取它，避免攻击者伪造 X-Forwarded-For 打空限流窗口。
    const realIp = c.req.header("x-real-ip");
    if (isProd && realIp) return realIp.trim();
    return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  }

  const requireUser = async (c: Context<Env>, next: Next) => {
    const user = getUserBySessionToken(db, getCookie(c, SESSION_COOKIE) ?? "");
    if (!user) return c.json({ error: "未登录。" }, 401);
    c.set("userId", user.userId);
    c.set("isAdmin", user.isAdmin);
    await next();
  };

  app.get("/api/me", (c) => {
    const user = getUserBySessionToken(db, getCookie(c, SESSION_COOKIE) ?? "");
    if (!user) return c.json({ error: "未登录。" }, 401);
    return c.json({ userId: user.userId, username: user.username, isAdmin: user.isAdmin });
  });

  app.post("/api/register", async (c) => {
    const check = rateLimit(clientIp(c));
    if (!check.allowed) return c.json({ error: `操作太频繁，请 ${check.retryAfterSec} 秒后再试。` }, 429);
    const body = await c.req.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
    const username = typeof body?.username === "string" ? body.username : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const result = await registerUser(db, username, password);
    if (!result.ok) return c.json({ error: result.error }, 400);
    const token = insertSession(db, result.user.userId);
    setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: "Lax", secure: isProd, maxAge: SESSION_MAX_AGE, path: "/" });
    return c.json({ userId: result.user.userId, username: result.user.username, isAdmin: result.user.isAdmin }, 201);
  });

  app.post("/api/login", async (c) => {
    const check = rateLimit(clientIp(c));
    if (!check.allowed) return c.json({ error: `操作太频繁，请 ${check.retryAfterSec} 秒后再试。` }, 429);
    const body = await c.req.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
    const username = typeof body?.username === "string" ? body.username : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const user = await verifyLogin(db, username, password);
    if (!user) return c.json({ error: "用户名或密码错误。" }, 401);
    const token = insertSession(db, user.userId);
    setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: "Lax", secure: isProd, maxAge: SESSION_MAX_AGE, path: "/" });
    return c.json({ userId: user.userId, username: user.username, isAdmin: user.isAdmin });
  });

  app.post("/api/logout", (c) => {
    deleteSession(db, getCookie(c, SESSION_COOKIE) ?? "");
    deleteCookie(c, SESSION_COOKIE);
    return c.body(null, 204);
  });

  app.use("/api/data/*", requireUser);
  app.use("/api/admin/*", requireUser);

  app.get("/api/data/:season", (c) => {
    const season = c.req.param("season");
    if (!isSeasonId(season)) return c.json({ error: "无效的赛季。" }, 400);
    const row = db.prepare("SELECT data_json, updated_at, revision FROM season_data WHERE user_id = ? AND season_id = ?")
      .get(c.get("userId"), season) as { data_json: string; updated_at: string; revision: number } | undefined;
    if (!row) return c.json({ data: null, updatedAt: null, revision: null });
    return c.json({ data: JSON.parse(row.data_json), updatedAt: row.updated_at, revision: row.revision });
  });

  app.put("/api/data/:season", async (c) => {
    const season = c.req.param("season");
    if (!isSeasonId(season)) return c.json({ error: "无效的赛季。" }, 400);
    const raw = await c.req.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_DATA_BYTES) return c.json({ error: "数据过大。" }, 413);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return c.json({ error: "数据格式错误。" }, 400);
    }
    if (!isAppDataShape(parsed)) return c.json({ error: "数据格式错误。" }, 400);
    const userId = c.get("userId");
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO season_data (user_id, season_id, data_json, updated_at, revision) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(user_id, season_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at, revision = season_data.revision + 1`
    ).run(userId, season, raw, now);
    const row = db.prepare("SELECT revision FROM season_data WHERE user_id = ? AND season_id = ?").get(userId, season) as { revision: number };
    return c.json({ updatedAt: now, revision: row.revision });
  });

  app.post("/api/admin/reset-password", async (c) => {
    if (!c.get("isAdmin")) return c.json({ error: "没有权限。" }, 403);
    const body = await c.req.json().catch(() => null) as { username?: unknown; newPassword?: unknown } | null;
    const username = typeof body?.username === "string" ? body.username : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    const result = await resetUserPassword(db, username, newPassword);
    if (!result.ok) return c.json({ error: result.error }, 400);
    return c.json({ ok: true });
  });

  return app;
}
