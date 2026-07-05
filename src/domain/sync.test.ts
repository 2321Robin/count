// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultData } from "./defaultData";
import { clearSyncConfig, loadSyncConfig, pullFromGist, pushToGist, saveSyncConfig, selectHigherTotalData } from "./sync";
import type { AppData } from "./types";

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

    const result = await pushToGist(createDefaultData("s2"), { token: "token", gistId: "" }, "s2");

    expect(result).toEqual({ ok: true, gistId: "gist-created" });
    expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/gists", expect.objectContaining({ method: "POST" }));
  });

  it("pushes current S3 data to the S3 gist file", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ id: "gist-created" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    const data = { ...createDefaultData("s3"), creatures: [{ id: "s3-custom", name: "S3 自定义", targetCount: 80, currentEncounters: 0, totalEncounters: 0, location: "", notes: "", isDefault: false }] };

    const result = await pushToGist(data, { token: "token", gistId: "" }, "s3");

    expect(result).toEqual({ ok: true, gistId: "gist-created" });
    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.files["s3-capture-counter.json"].content).toBe(JSON.stringify(data, null, 2));
    expect(body.files["s2-capture-counter.json"]).toBeUndefined();
  });

  it("pulls and migrates app data from a gist", async () => {
    const data = createDefaultData("s2");
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      files: {
        "s2-capture-counter.json": { content: JSON.stringify(data) },
      },
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await pullFromGist({ token: "token", gistId: "gist" }, "s2");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data?.version).toBe(3);
    expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/gists/gist", expect.any(Object));
  });

  it("pulls current S3 data from the S3 gist file", async () => {
    const data = { ...createDefaultData("s3"), creatures: [{ id: "s3-custom", name: "S3 自定义", targetCount: 80, currentEncounters: 0, totalEncounters: 0, location: "", notes: "", isDefault: false }] };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      files: {
        "s3-capture-counter.json": { content: JSON.stringify(data) },
      },
    }), { status: 200 })));

    const result = await pullFromGist({ token: "token", gistId: "gist" }, "s3");

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.creatures[0].name).toBe("S3 自定义");
  });

  it("does not pull S2 data when the selected S3 gist file is missing", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      files: {
        "s2-capture-counter.json": { content: JSON.stringify(createDefaultData("s2")) },
      },
    }), { status: 200 })));

    const result = await pullFromGist({ token: "token", gistId: "gist" }, "s3");

    expect(result).toEqual({ ok: false, error: "拉取失败：Gist 中没有有效的计数器数据。" });
  });

  it("reports auth failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 403 })));

    const result = await pullFromGist({ token: "bad", gistId: "gist" }, "s2");

    expect(result).toEqual({ ok: false, error: "拉取失败：GitHub Token 无效或没有 gist 权限。" });
  });

  it("selects cloud data when cloud total encounters are higher", () => {
    const local = createDefaultData();
    const cloud: AppData = {
      ...createDefaultData(),
      creatures: createDefaultData().creatures.map((creature, index) => index === 0 ? { ...creature, totalEncounters: 2 } : creature),
    };

    expect(selectHigherTotalData(local, cloud)).toEqual({
      selected: cloud,
      source: "cloud",
      localTotal: 0,
      cloudTotal: 2,
    });
  });

  it("keeps local data when local total encounters are higher", () => {
    const local: AppData = {
      ...createDefaultData(),
      creatures: createDefaultData().creatures.map((creature, index) => index === 0 ? { ...creature, totalEncounters: 3 } : creature),
    };
    const cloud = createDefaultData();

    expect(selectHigherTotalData(local, cloud)).toEqual({
      selected: local,
      source: "local",
      localTotal: 3,
      cloudTotal: 0,
    });
  });

  it("keeps local data when total encounters are equal", () => {
    const local: AppData = {
      ...createDefaultData(),
      creatures: createDefaultData().creatures.map((creature, index) => index === 0 ? { ...creature, totalEncounters: 1 } : creature),
    };
    const cloud: AppData = {
      ...createDefaultData(),
      creatures: createDefaultData().creatures.map((creature, index) => index === 1 ? { ...creature, totalEncounters: 1 } : creature),
    };

    expect(selectHigherTotalData(local, cloud)).toEqual({
      selected: local,
      source: "equal",
      localTotal: 1,
      cloudTotal: 1,
    });
  });
});
