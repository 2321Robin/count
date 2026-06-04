// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultData } from "./defaultData";
import { clearSyncConfig, loadSyncConfig, pullFromGist, pushToGist, saveSyncConfig } from "./sync";

describe("sync", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    localStorage.clear();
  });

  it("saves and clears sync config separately from app data", () => {
    saveSyncConfig({ token: " token ", gistId: " gist " });

    expect(loadSyncConfig()).toEqual({ token: "token", gistId: "gist" });

    clearSyncConfig();
    expect(loadSyncConfig()).toEqual({ token: "", gistId: "" });
  });

  it("pushes app data to a new gist", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "gist-created" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await pushToGist(createDefaultData(), { token: "token", gistId: "" });

    expect(result).toEqual({ ok: true, gistId: "gist-created" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/gists", expect.objectContaining({ method: "POST" }));
  });

  it("pulls and migrates app data from a gist", async () => {
    const data = createDefaultData();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      files: {
        "s2-capture-counter.json": { content: JSON.stringify(data) },
      },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await pullFromGist({ token: "token", gistId: "gist" });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data?.version).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/gists/gist", expect.any(Object));
  });

  it("reports auth failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));

    const result = await pullFromGist({ token: "bad", gistId: "gist" });

    expect(result).toEqual({ ok: false, error: "拉取失败：GitHub Token 无效或没有 gist 权限。" });
  });
});
