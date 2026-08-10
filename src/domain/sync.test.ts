// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDefaultData } from "./defaultData";
import { clearSyncConfig, loadSyncConfig, mergeAppData, pullFromGist, pushToGist, saveSyncConfig, selectHigherTotalData } from "./sync";
import type { AppData } from "./types";

describe("sync", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    const session = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    vi.stubGlobal("sessionStorage", {
      clear: () => session.clear(),
      getItem: (key: string) => session.get(key) ?? null,
      removeItem: (key: string) => session.delete(key),
      setItem: (key: string, value: string) => session.set(key, value),
    });
    localStorage.clear();
    sessionStorage.clear();
  });

  it("saves and clears sync config separately from app data", () => {
    saveSyncConfig({ token: " token ", gistId: " gist " });

    expect(loadSyncConfig()).toEqual({ token: "token", gistId: "gist" });

    clearSyncConfig();
    expect(loadSyncConfig()).toEqual({ token: "", gistId: "" });
  });

  it("stores the token in sessionStorage and the gist id in localStorage", () => {
    saveSyncConfig({ token: "token-1", gistId: "gist-1" });

    expect(sessionStorage.getItem("s2-capture-counter:github-token")).toBe("token-1");
    expect(localStorage.getItem("s2-capture-counter:github-token")).toBeNull();
    expect(localStorage.getItem("s2-capture-counter:gist-id")).toBe("gist-1");
    expect(sessionStorage.getItem("s2-capture-counter:gist-id")).toBeNull();

    clearSyncConfig();
    expect(sessionStorage.getItem("s2-capture-counter:github-token")).toBeNull();
    expect(localStorage.getItem("s2-capture-counter:gist-id")).toBeNull();
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

  it("merges cloud data into the upload when the gist already exists", async () => {
    const local = createDefaultData("s2");
    const cloud: AppData = {
      ...createDefaultData("s2"),
      records: [{ id: "record-cloud-only", creatureId: local.creatures[0].id, creatureName: local.creatures[0].name, date: "2026-05-24T00:00:00", acquisitionNumber: 1, roundEncounters: 1, roundBreakdown: [], isOffTarget: false, targetCreatureId: local.creatures[0].id, targetCreatureName: local.creatures[0].name, targetRoundEncounters: 1, totalEncountersAtRecord: 1, location: "", notes: "" }],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: { "s2-capture-counter.json": { content: JSON.stringify(cloud) } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "gist" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await pushToGist(local, { token: "token", gistId: "gist" }, "s2");

    expect(result).toEqual({ ok: true, gistId: "gist" });
    expect(fetchMock).toHaveBeenNthCalledWith(1, "https://api.github.com/gists/gist", expect.any(Object)); // 预拉取 GET（method 缺省即为 GET）
    const patchCall = fetchMock.mock.calls[1];
    expect(patchCall[0]).toBe("https://api.github.com/gists/gist");
    expect(patchCall[1]?.method).toBe("PATCH");
    const patchBody = JSON.parse(patchCall[1]?.body as string);
    const uploaded = JSON.parse(patchBody.files["s2-capture-counter.json"].content) as AppData;
    // 云端独有记录被合并进上传内容
    expect(uploaded.records.map((record) => record.id)).toEqual(["record-cloud-only"]);
  });

  it("uploads local data unchanged when the cloud pre-fetch fails", async () => {
    const data = createDefaultData("s2");
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "gist" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await pushToGist(data, { token: "token", gistId: "gist" }, "s2");

    expect(result).toEqual({ ok: true, gistId: "gist" });
    const patchBody = JSON.parse(fetchMock.mock.calls[1][1]?.body as string);
    expect(JSON.parse(patchBody.files["s2-capture-counter.json"].content)).toEqual(data);
  });

  it("uploads local data unchanged when the cloud pre-fetch returns an error status", async () => {
    const data = createDefaultData("s2");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response("{}", { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "gist" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await pushToGist(data, { token: "token", gistId: "gist" }, "s2");

    expect(result).toEqual({ ok: true, gistId: "gist" });
    const patchBody = JSON.parse(fetchMock.mock.calls[1][1]?.body as string);
    expect(JSON.parse(patchBody.files["s2-capture-counter.json"].content)).toEqual(data);
  });

  it("uploads local data unchanged when the gist has no valid season file", async () => {
    const data = createDefaultData("s2");
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ files: { "s3-capture-counter.json": { content: JSON.stringify(createDefaultData("s3")) } } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ id: "gist" }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await pushToGist(data, { token: "token", gistId: "gist" }, "s2");

    expect(result).toEqual({ ok: true, gistId: "gist" });
    const patchBody = JSON.parse(fetchMock.mock.calls[1][1]?.body as string);
    expect(JSON.parse(patchBody.files["s2-capture-counter.json"].content)).toEqual(data);
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
    if (result.ok) expect(result.data?.version).toBe(5);
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

  it("merges creatures by taking the larger counts and keeping local fields", () => {
    const local = createDefaultData("s2");
    const cloud: AppData = {
      ...createDefaultData("s2"),
      creatures: [
        { ...createDefaultData("s2").creatures[0], name: "云端改名", totalEncounters: 10, currentEncounters: 6 },
        { id: "cloud-only", name: "云端独有", targetCount: 80, currentEncounters: 2, totalEncounters: 2, location: "", notes: "", isDefault: false },
      ],
    };

    const merged = mergeAppData(local, cloud);

    expect(merged.creatures[0]).toMatchObject({
      id: local.creatures[0].id,
      name: local.creatures[0].name, // 名称等非计数字段保留本地值
      totalEncounters: 10,
      currentEncounters: 6,
    });
    expect(merged.creatures[merged.creatures.length - 1]).toMatchObject({ id: "cloud-only", name: "云端独有" });
    expect(merged.creatures.length).toBe(local.creatures.length + 1);
    // 不变式：合并后 currentEncounters <= totalEncounters 依然成立
    expect(merged.creatures.every((creature) => creature.currentEncounters <= creature.totalEncounters)).toBe(true);
  });

  it("merges records by id, keeping local order and appending cloud-only records", () => {
    const baseRecord = {
      creatureId: "limited-shiny-houmaizai",
      creatureName: "猴麦仔",
      date: "2026-05-24T00:00:00",
      acquisitionNumber: 1,
      roundEncounters: 1,
      roundBreakdown: [] as { creatureId: string; creatureName: string; encounters: number }[],
      isOffTarget: false,
      targetCreatureId: "limited-shiny-houmaizai",
      targetCreatureName: "猴麦仔",
      targetRoundEncounters: 1,
      totalEncountersAtRecord: 1,
      location: "",
      notes: "",
    };
    const localRecord = { ...baseRecord, id: "record-local" };
    const cloudRecord = { ...baseRecord, id: "record-cloud" };
    const localGift = { id: "gift-local", creatureId: "limited-shiny-houmaizai", creatureName: "猴麦仔", receivedAt: "2026-05-24T00:00:00", giftedBy: "A", notes: "" };
    const cloudGift = { id: "gift-cloud", creatureId: "limited-shiny-houmaizai", creatureName: "猴麦仔", receivedAt: "2026-05-24T00:00:00", giftedBy: "B", notes: "" };
    const localBook = { id: "book-local", date: "2026-05-24", entries: [] as { creatureId: string; creatureName: string; count: number }[], shinyCreatureIds: [] as string[], notes: "" };
    const cloudBook = { id: "book-cloud", date: "2026-05-24", entries: [], shinyCreatureIds: [], notes: "" };
    const local = { ...createDefaultData("s2"), records: [localRecord], giftedRecords: [localGift], fairyTaleBookRecords: [localBook] };
    const cloud = { ...createDefaultData("s2"), records: [cloudRecord, localRecord], giftedRecords: [cloudGift], fairyTaleBookRecords: [cloudBook] };

    const merged = mergeAppData(local, cloud);

    // 本地顺序保持，云端独有记录追加到末尾，重复 id 只保留一份
    expect(merged.records.map((record) => record.id)).toEqual(["record-local", "record-cloud"]);
    expect(merged.giftedRecords.map((record) => record.id)).toEqual(["gift-local", "gift-cloud"]);
    expect(merged.fairyTaleBookRecords.map((record) => record.id)).toEqual(["book-local", "book-cloud"]);
  });

  it("keeps local currentRound, settings, and version", () => {
    const localRound = { creatureIds: ["limited-shiny-houmaizai"], targetCreatureId: null, updatedAt: "2026-05-24T00:00:00" };
    const cloudRound = { creatureIds: ["other-id"], targetCreatureId: "limited-shiny-houmaizai", updatedAt: "2026-06-01T00:00:00" };
    const local = { ...createDefaultData("s2"), currentRound: localRound };
    const cloud = { ...createDefaultData("s2"), currentRound: cloudRound };

    const merged = mergeAppData(local, cloud);

    expect(merged.currentRound).toEqual(localRound);
    expect(merged.settings).toEqual(local.settings);
    expect(merged.version).toBe(5);
  });
});
