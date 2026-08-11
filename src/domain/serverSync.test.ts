// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminResetPassword,
  clearLastServerUpdatedAt,
  clearSession,
  fetchMe,
  loadLastServerUpdatedAt,
  loadSession,
  loginAccount,
  logoutAccount,
  pullFromServer,
  pushToServer,
  registerAccount,
  saveLastServerUpdatedAt,
  saveSession,
} from "./serverSync";
import type { AppData } from "./types";

const DATA: AppData = {
  version: 5,
  creatures: [{ id: "c1", name: "精灵一号", targetCount: 80, currentEncounters: 3, totalEncounters: 3, location: "", notes: "", isDefault: true }],
  records: [],
  giftedRecords: [],
  fairyTaleBookRecords: [],
  currentRound: null,
  settings: { sortMode: "default" },
  meta: { lastModifiedAt: "2026-08-11T00:00:00.000Z", lastModifiedBy: "computer" },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("serverSync", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("registers and returns the session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ userId: 7, username: "alice", isAdmin: false }, 201)));
    const result = await registerAccount("alice", "password1");
    expect(result).toEqual({ ok: true, session: { userId: 7, username: "alice", isAdmin: false } });
    expect(fetch).toHaveBeenCalledWith("/api/register", expect.objectContaining({ method: "POST", body: expect.stringContaining("alice") }));
  });

  it("maps auth errors from the server", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "用户名已被注册。" }, 400)));
    const result = await registerAccount("alice", "password1");
    expect(result).toEqual({ ok: false, error: "用户名已被注册。" });
  });

  it("maps login failures and network errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "用户名或密码错误。" }, 401)));
    expect(await loginAccount("alice", "wrong")).toEqual({ ok: false, error: "用户名或密码错误。" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network"); }));
    expect(await loginAccount("alice", "password1")).toEqual({ ok: false, error: "无法连接服务器，请检查网络。" });
  });

  it("keeps the session in localStorage and fetches /api/me", async () => {
    const session = { userId: 1, username: "alice", isAdmin: false };
    saveSession(session);
    expect(loadSession()).toEqual(session);
    clearSession();
    expect(loadSession()).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ userId: 1, username: "alice", isAdmin: false })));
    expect(await fetchMe()).toEqual(session);
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "未登录。" }, 401)));
    expect(await fetchMe()).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network"); }));
    expect(await fetchMe()).toBeNull();
  });

  it("logs out and resets passwords", async () => {
    const logoutFetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", logoutFetch);
    await logoutAccount();
    expect(logoutFetch).toHaveBeenCalledWith("/api/logout", expect.objectContaining({ method: "POST" }));

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: true })));
    expect(await adminResetPassword("bob", "brand-new-3")).toEqual({ ok: true });
  });

  it("pulls empty and populated cloud data, migrating old versions", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: null, updatedAt: null, revision: null })));
    expect(await pullFromServer("s3")).toEqual({ ok: true, empty: true });

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: DATA, updatedAt: "2026-08-11T02:00:00.000Z", revision: 2 })));
    const pull = await pullFromServer("s3");
    expect(pull).toMatchObject({ ok: true, empty: false, updatedAt: "2026-08-11T02:00:00.000Z" });
    if (pull.ok && !pull.empty) expect(pull.data.creatures[0].name).toBe("精灵一号");

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "未登录。" }, 401)));
    expect(await pullFromServer("s3")).toEqual({ ok: false, error: "拉取失败：登录已过期，请重新登录。" });
  });

  it("pushes data and returns the server timestamp", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ updatedAt: "2026-08-11T03:00:00.000Z", revision: 3 })));
    expect(await pushToServer(DATA, "s3")).toEqual({ ok: true, updatedAt: "2026-08-11T03:00:00.000Z" });
    expect(fetch).toHaveBeenCalledWith("/api/data/s3", expect.objectContaining({ method: "PUT" }));

    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network"); }));
    expect(await pushToServer(DATA, "s3")).toEqual({ ok: false, error: "上传失败：无法连接服务器，请检查网络。" });
  });

  it("stores the last server updated-at per user and season", () => {
    saveLastServerUpdatedAt("s2", 1, "2026-08-11T00:00:00.000Z");
    saveLastServerUpdatedAt("s3", 1, "2026-08-11T01:00:00.000Z");
    expect(loadLastServerUpdatedAt("s2", 1)).toBe("2026-08-11T00:00:00.000Z");
    expect(loadLastServerUpdatedAt("s3", 1)).toBe("2026-08-11T01:00:00.000Z");
    expect(loadLastServerUpdatedAt("s2", 2)).toBeNull();
    clearLastServerUpdatedAt("s2", 1);
    expect(loadLastServerUpdatedAt("s2", 1)).toBeNull();
  });

  it("migrates legacy v1 payloads during pull", async () => {
    // 手工构造 v1 形状数据（同 storage.test.ts 既有降级法），验证云端旧数据也能升级
    const legacy = JSON.parse(JSON.stringify({
      ...DATA,
      version: 1,
      giftedRecords: undefined,
      currentRound: undefined,
      records: [
        { id: "r1", creatureId: "c1", creatureName: "精灵一号", date: "2026-05-24", roundEncounters: 6, totalEncountersAtRecord: 18, location: "", notes: "" },
      ],
    }));
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: legacy, updatedAt: "2026-08-11T02:00:00.000Z", revision: 1 })));

    const pull = await pullFromServer("s3");

    expect(pull.ok).toBe(true);
    if (pull.ok && !pull.empty) {
      expect(pull.data.version).toBe(5);
      expect(pull.data.giftedRecords).toEqual([]);
      expect(pull.data.records[0]).toMatchObject({ acquisitionNumber: 1, date: "2026-05-24T00:00:00" });
    }
  });

  it("reports admin reset password failures from the server", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "没有权限。" }, 403)));
    expect(await adminResetPassword("bob", "brand-new-3")).toEqual({ ok: false, error: "没有权限。" });

    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 500 })));
    expect(await adminResetPassword("bob", "brand-new-3")).toEqual({ ok: false, error: "重置失败：服务器返回 500。" });
  });

  it("falls back to generic messages when the server body is not JSON", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>", { status: 200 })));
    expect(await pullFromServer("s3")).toEqual({ ok: false, error: "拉取失败：无法连接服务器，请检查网络。" });
    expect(await pushToServer(DATA, "s3")).toEqual({ ok: false, error: "上传失败：无法连接服务器，请检查网络。" });
    expect(await fetchMe()).toBeNull();
  });

  it("passes through the server rate-limit message for 429s", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "操作太频繁，请 42 秒后再试。" }, 429)));
    expect(await pullFromServer("s3")).toEqual({ ok: false, error: "操作太频繁，请 42 秒后再试。" });

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "操作太频繁，请 7 秒后再试。" }, 429)));
    expect(await pushToServer(DATA, "s3")).toEqual({ ok: false, error: "操作太频繁，请 7 秒后再试。" });

    // 429 但无服务端文案时落现有兜底
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({}, 429)));
    expect(await pullFromServer("s3")).toEqual({ ok: false, error: "拉取失败：操作太频繁，请稍后再试。" });
  });
});
