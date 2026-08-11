// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createDb } from "./db.js";
import type { Db } from "./db.js";

function freshApp(rateLimit?: { limit: number; windowMs: number }) {
  const db = createDb(":memory:");
  return { db, app: createApp(db, { rateLimit: rateLimit ?? { limit: 1000, windowMs: 60_000 } }) };
}

function sessionTokenFrom(response: Response): string {
  const match = /counter_session=([^;]+)/.exec(response.headers.get("set-cookie") ?? "");
  if (!match) throw new Error("no session cookie in response");
  return match[1];
}

function authHeaders(token: string): Record<string, string> {
  return { Cookie: `counter_session=${token}` };
}

const VALID_DATA = {
  version: 5,
  creatures: [{ id: "c1", name: "精灵一号", targetCount: 80, currentEncounters: 3, totalEncounters: 3, location: "", notes: "", isDefault: true }],
  records: [],
  giftedRecords: [],
  fairyTaleBookRecords: [],
  currentRound: null,
  settings: { sortMode: "default" },
  meta: { lastModifiedAt: "2026-08-11T00:00:00.000Z", lastModifiedBy: "computer" },
};

describe("counter api", () => {
  it("registers, reads /api/me, and logs out", async () => {
    const { app } = freshApp();
    const register = await app.request("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password1" }),
    });
    expect(register.status).toBe(201);
    const token = sessionTokenFrom(register);

    const me = await app.request("/api/me", { headers: authHeaders(token) });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ userId: 1, username: "alice", isAdmin: false });

    const logout = await app.request("/api/logout", { method: "POST", headers: authHeaders(token) });
    expect(logout.status).toBe(204);
    expect((await app.request("/api/me", { headers: authHeaders(token) })).status).toBe(401);
  });

  it("rejects duplicate registration and bad credentials", async () => {
    const { app } = freshApp();
    const body = JSON.stringify({ username: "alice", password: "password1" });
    const headers = { "Content-Type": "application/json" };
    expect((await app.request("/api/register", { method: "POST", headers, body })).status).toBe(201);
    const dup = await app.request("/api/register", { method: "POST", headers, body });
    expect(dup.status).toBe(400);
    expect((await dup.json() as { error: string }).error).toBe("用户名已被注册。");

    const badLogin = await app.request("/api/login", { method: "POST", headers, body: JSON.stringify({ username: "alice", password: "wrong-pass" }) });
    expect(badLogin.status).toBe(401);

    const goodLogin = await app.request("/api/login", { method: "POST", headers, body });
    expect(goodLogin.status).toBe(200);
    expect(sessionTokenFrom(goodLogin).length).toBeGreaterThan(0);
  });

  it("round-trips season data per user", async () => {
    const { app } = freshApp();
    const headers = { "Content-Type": "application/json" };
    const token = sessionTokenFrom(await app.request("/api/register", { method: "POST", headers, body: JSON.stringify({ username: "alice", password: "password1" }) }));
    const auth = authHeaders(token);

    const empty = await app.request("/api/data/s3", { headers: auth });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ data: null, updatedAt: null, revision: null });

    const put = await app.request("/api/data/s3", { method: "PUT", headers: { ...headers, ...auth }, body: JSON.stringify(VALID_DATA) });
    expect(put.status).toBe(200);
    const putBody = await put.json() as { updatedAt: string; revision: number };
    expect(putBody.revision).toBe(1);

    const get = await app.request("/api/data/s3", { headers: auth });
    const getBody = await get.json() as { data: unknown; updatedAt: string; revision: number };
    expect(getBody.revision).toBe(1);
    expect(getBody.data).toEqual(VALID_DATA);

    const put2 = await app.request("/api/data/s3", { method: "PUT", headers: { ...headers, ...auth }, body: JSON.stringify({ ...VALID_DATA, meta: { ...VALID_DATA.meta, lastModifiedAt: "2026-08-11T01:00:00.000Z" } }) });
    expect(((await put2.json()) as { revision: number }).revision).toBe(2);

    // 赛季隔离：s2 为空
    const s2 = await app.request("/api/data/s2", { headers: auth });
    expect(((await s2.json()) as { data: unknown }).data).toBeNull();

    // 用户隔离：bob 看不到 alice 的数据
    const bobToken = sessionTokenFrom(await app.request("/api/register", { method: "POST", headers, body: JSON.stringify({ username: "bob", password: "password1" }) }));
    const bobGet = await app.request("/api/data/s3", { headers: authHeaders(bobToken) });
    expect(((await bobGet.json()) as { data: unknown }).data).toBeNull();
  });

  it("rejects invalid seasons, bodies, and oversized payloads", async () => {
    const { app } = freshApp();
    const headers = { "Content-Type": "application/json" };
    const token = sessionTokenFrom(await app.request("/api/register", { method: "POST", headers, body: JSON.stringify({ username: "alice", password: "password1" }) }));
    const auth = authHeaders(token);

    expect((await app.request("/api/data/s4", { headers: auth })).status).toBe(400);
    expect((await app.request("/api/data/s3", { method: "PUT", headers: { ...headers, ...auth }, body: "not json" })).status).toBe(400);
    expect((await app.request("/api/data/s3", { method: "PUT", headers: { ...headers, ...auth }, body: JSON.stringify({ version: 5 }) })).status).toBe(400);
    expect((await app.request("/api/data/s3", { method: "PUT", headers: { ...headers, ...auth }, body: JSON.stringify({ version: 5, creatures: [] }, null, 0).padEnd(2_000_001, "x") })).status).toBe(413);
  });

  it("requires login for data endpoints", async () => {
    const { app } = freshApp();
    expect((await app.request("/api/data/s3")).status).toBe(401);
    expect((await app.request("/api/data/s3", { method: "PUT", body: "{}" })).status).toBe(401);
    expect((await app.request("/api/admin/reset-password", { method: "POST", body: "{}" })).status).toBe(401);
  });

  it("lets an admin reset another user's password", async () => {
    const { app, db } = freshApp();
    const headers = { "Content-Type": "application/json" };
    const register = async (username: string) => {
      const res = await app.request("/api/register", { method: "POST", headers, body: JSON.stringify({ username, password: "password1" }) });
      return sessionTokenFrom(res);
    };
    const aliceToken = await register("alice");
    await register("bob");
    db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'alice'").run();

    const denied = await app.request("/api/admin/reset-password", { method: "POST", headers: { ...headers, ...authHeaders(await register("carol")) }, body: JSON.stringify({ username: "bob", newPassword: "brand-new-3" }) });
    expect(denied.status).toBe(403);

    const ok = await app.request("/api/admin/reset-password", { method: "POST", headers: { ...headers, ...authHeaders(aliceToken) }, body: JSON.stringify({ username: "bob", newPassword: "brand-new-3" }) });
    expect(ok.status).toBe(200);

    const login = await app.request("/api/login", { method: "POST", headers, body: JSON.stringify({ username: "bob", password: "brand-new-3" }) });
    expect(login.status).toBe(200);
  });

  it("rate limits register and login", async () => {
    const { app } = freshApp({ limit: 2, windowMs: 60_000 });
    const headers = { "Content-Type": "application/json" };
    const body = JSON.stringify({ username: "alice", password: "password1" });
    expect((await app.request("/api/register", { method: "POST", headers, body })).status).toBe(201);
    expect((await app.request("/api/register", { method: "POST", headers, body })).status).toBe(400); // 重复用户名，仍计数
    const third = await app.request("/api/register", { method: "POST", headers, body });
    expect(third.status).toBe(429);
    expect((await third.json() as { error: string }).error).toContain("操作太频繁");
  });
});
