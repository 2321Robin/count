import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import { HistoryList } from "./components/HistoryList";
import { createDefaultData } from "./domain/defaultData";
import { SELECTED_SEASON_KEY, seasons } from "./domain/seasons";
import { S2_STORAGE_KEY, S3_STORAGE_KEY } from "./domain/storage";
import type { AcquisitionRecord, AppData } from "./domain/types";

function enableTestS3() {
  seasons.s3.isAvailable = true;
}

function resetTestS3() {
  seasons.s3.isAvailable = true;
}

describe("App", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  afterEach(() => {
    cleanup();
    resetTestS3();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the counter dashboard", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "S3 捕捉计数器" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "数据管理与多端同步" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开当前轮次" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开多端同步" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /苞米仔/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "S2" })).toHaveValue("s2");
    expect(screen.getAllByText("目标 80")[0]).toBeInTheDocument();
  });

  it("loads existing S2 storage when S2 is selected", () => {
    localStorage.setItem(SELECTED_SEASON_KEY, "s2");
    const saved = {
      ...createDefaultData("s2"),
      creatures: createDefaultData("s2").creatures.map((creature, index) => index === 0 ? { ...creature, name: "S2 已保存", totalEncounters: 5 } : creature),
    };
    localStorage.setItem(S2_STORAGE_KEY, JSON.stringify(saved));

    render(<App />);

    expect(screen.getByRole("heading", { name: "S2 捕捉计数器" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /S2 已保存/ })).toBeInTheDocument();
    expect(screen.getByText("当前操作仅影响 S2 数据，不会修改其它赛季记录。")).toBeInTheDocument();
  });

  it("loads the persisted S3 selection", () => {
    enableTestS3();
    const s3Data = createDefaultData("s3");
    localStorage.setItem(SELECTED_SEASON_KEY, "s3");
    localStorage.setItem(S3_STORAGE_KEY, JSON.stringify(s3Data));

    render(<App />);

    expect(screen.getByLabelText("赛季")).toHaveValue("s3");
    expect(screen.getByRole("heading", { name: "S3 捕捉计数器" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /苞米仔/ })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: /猴麦仔/ })).not.toBeInTheDocument();
  });

  it("switches seasons without saving old-season data into the new key", async () => {
    enableTestS3();
    const user = userEvent.setup();
    const s2Data = createDefaultData("s2");
    localStorage.setItem(S2_STORAGE_KEY, JSON.stringify(s2Data));

    render(<App />);
    await user.click(screen.getByRole("button", { name: "新增精灵" }));
    expect(screen.getByLabelText("名称")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("赛季"), "s2");

    expect(screen.queryByLabelText("名称")).not.toBeInTheDocument();
    expect(localStorage.getItem(SELECTED_SEASON_KEY)).toBe("s2");
    expect(screen.getByRole("heading", { name: "S2 捕捉计数器" })).toBeInTheDocument();
    const savedS3 = JSON.parse(localStorage.getItem(S3_STORAGE_KEY) ?? "null") as AppData;
    expect(savedS3.creatures[0].name).toBe("苞米仔");
    const savedS2 = JSON.parse(localStorage.getItem(S2_STORAGE_KEY) ?? "null") as AppData;
    expect(savedS2.creatures[0].name).toBe("猴麦仔");
  });

  it("increments S3 creatures without mutating S2 storage", async () => {
    enableTestS3();
    const user = userEvent.setup();
    const s2Data = createDefaultData("s2");
    localStorage.setItem(S2_STORAGE_KEY, JSON.stringify(s2Data));

    render(<App />);
    await user.click(screen.getAllByRole("button", { name: "+1" })[0]);

    expect(localStorage.getItem(S2_STORAGE_KEY)).toBe(JSON.stringify(s2Data));
    const savedS3 = JSON.parse(localStorage.getItem(S3_STORAGE_KEY) ?? "null") as AppData;
    expect(savedS3.creatures[0]).toMatchObject({ id: "s3-adventure-baomizai", currentEncounters: 1, totalEncounters: 1 });
  });

  it("exports the selected season file name", async () => {
    enableTestS3();
    const user = userEvent.setup();
    const createElement = document.createElement.bind(document);
    const link = createElement("a") as HTMLAnchorElement;
    const clickSpy = vi.spyOn(link, "click").mockImplementation(() => {});
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => tagName === "a" ? link : createElement(tagName));
    vi.stubGlobal("URL", { createObjectURL: vi.fn(() => "blob:url"), revokeObjectURL: vi.fn() });

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "导出 JSON" }));
    expect(link.download).toBe("s3-capture-counter-backup.json");

    await user.selectOptions(screen.getByLabelText("赛季"), "s2");
    fireEvent.click(screen.getByRole("button", { name: "导出 JSON" }));
    expect(link.download).toBe("s2-capture-counter-backup.json");
    expect(clickSpy).toHaveBeenCalledTimes(2);
  });

  it("manual upload writes the selected season gist file", async () => {
    enableTestS3();
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({ id: "gist-created" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await user.selectOptions(screen.getByLabelText("赛季"), "s2");
    await user.click(screen.getByRole("button", { name: "展开多端同步" }));
    await user.type(screen.getByLabelText("GitHub Token"), "token-1");
    await user.click(screen.getByRole("button", { name: "上传本机数据" }));

    const body = JSON.parse(fetchMock.mock.calls[0][1]?.body as string);
    expect(body.files["s2-capture-counter.json"]).toBeDefined();
    expect(body.files["s3-capture-counter.json"]).toBeUndefined();
  });

  it("ignores manual pull results after switching seasons", async () => {
    enableTestS3();
    const user = userEvent.setup();
    const s2Cloud: AppData = {
      ...createDefaultData("s2"),
      creatures: [{ ...createDefaultData("s2").creatures[0], name: "云端 S2", currentEncounters: 5, totalEncounters: 5 }],
    };
    let resolvePull: (response: Response) => void = () => {};
    const pullResponse = new Promise<Response>((resolve) => {
      resolvePull = resolve;
    });
    vi.stubGlobal("fetch", vi.fn((_input: RequestInfo | URL, _init?: RequestInit) => pullResponse));

    render(<App />);
    await user.click(screen.getByRole("button", { name: "展开多端同步" }));
    await user.type(screen.getByLabelText("GitHub Token"), "token-1");
    await user.type(screen.getByLabelText("Gist ID"), "gist-1");
    await user.click(screen.getByRole("button", { name: "拉取云端数据" }));
    await user.selectOptions(screen.getByLabelText("赛季"), "s2");

    resolvePull(new Response(JSON.stringify({ files: { "s3-capture-counter.json": { content: JSON.stringify(s2Cloud) } } }), { status: 200 }));
    await act(async () => {});

    expect(screen.getByRole("heading", { name: "S2 捕捉计数器" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /猴麦仔/ })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: /云端 S2/ })).not.toBeInTheDocument();
    expect(localStorage.getItem(S2_STORAGE_KEY) ?? "").not.toContain("云端 S2");
  });

  it("ignores imported data after switching seasons before the file finishes reading", async () => {
    enableTestS3();
    const user = userEvent.setup();
    const s2Import: AppData = {
      ...createDefaultData("s2"),
      creatures: [{ ...createDefaultData("s2").creatures[0], name: "导入 S2", currentEncounters: 3, totalEncounters: 3 }],
    };
    let resolveText: (value: string) => void = () => {};
    const textPromise = new Promise<string>((resolve) => {
      resolveText = resolve;
    });
    const file = new File(["pending"], "s2-backup.json", { type: "application/json" });
    Object.defineProperty(file, "text", { value: vi.fn(() => textPromise) });

    render(<App />);
    fireEvent.change(screen.getByLabelText("导入 JSON"), { target: { files: [file] } });
    await user.selectOptions(screen.getByLabelText("赛季"), "s2");

    resolveText(JSON.stringify(s2Import));
    await act(async () => {});

    expect(screen.getByRole("heading", { name: "S2 捕捉计数器" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /猴麦仔/ })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: /导入 S2/ })).not.toBeInTheDocument();
    expect(localStorage.getItem(S2_STORAGE_KEY) ?? "").not.toContain("导入 S2");
  });

  it("switches and persists the color theme", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    expect(screen.getByLabelText("主题")).toHaveValue("fantasy");
    expect(screen.getByRole("main")).toHaveAttribute("data-theme", "fantasy");

    await user.selectOptions(screen.getByLabelText("主题"), "sunset");

    expect(screen.getByRole("main")).toHaveAttribute("data-theme", "sunset");
    expect(localStorage.getItem("s2-capture-counter:theme")).toBe("sunset");

    unmount();
    render(<App />);

    expect(screen.getByLabelText("主题")).toHaveValue("sunset");
    expect(screen.getByRole("main")).toHaveAttribute("data-theme", "sunset");
    expect(screen.getByRole("option", { name: "森野薄荷" })).toHaveValue("forest");
    expect(screen.getByRole("option", { name: "落日橙粉" })).toHaveValue("sunset");
    expect(screen.getByRole("option", { name: "纸白墨黑" })).toHaveValue("mono");
  });

  it("saves optional sync configuration without affecting local use", async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole("button", { name: "展开多端同步" }));

    await user.type(screen.getByLabelText("GitHub Token"), "token-1");
    await user.type(screen.getByLabelText("Gist ID"), "gist-1");
    await user.click(screen.getByRole("button", { name: "保存同步配置" }));

    expect(sessionStorage.getItem("s2-capture-counter:github-token")).toBe("token-1");
    expect(localStorage.getItem("s2-capture-counter:gist-id")).toBe("gist-1");
    expect(screen.getByText("同步配置已保存。本机离线数据仍会继续保存。")).toBeInTheDocument();
  });

  it("does not upload immediately after saving sync configuration", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "展开多端同步" }));
    fireEvent.change(screen.getByLabelText("GitHub Token"), { target: { value: "token-1" } });
    fireEvent.change(screen.getByLabelText("Gist ID"), { target: { value: "gist-1" } });
    fireEvent.click(screen.getByRole("button", { name: "保存同步配置" }));

    await vi.advanceTimersByTimeAsync(800);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("pushes current data to a private gist and stores the new gist id", async () => {
    const user = userEvent.setup();
    vi.setSystemTime(new Date(2026, 5, 11, 10, 32, 18));
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "gist-created" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "展开多端同步" }));
    await user.type(screen.getByLabelText("GitHub Token"), "token-1");
    await user.click(screen.getByRole("button", { name: "上传本机数据" }));

    expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/gists", expect.objectContaining({ method: "POST" }));
    expect(localStorage.getItem("s2-capture-counter:gist-id")).toBe("gist-created");
    expect(screen.getByRole("status")).toHaveTextContent("上传成功。已保存 Gist ID。");
    expect(screen.getByText("上次同步：2026/6/11 10:32:18")).toBeInTheDocument();
  });

  it("does not automatically upload again after a manual push saves the gist id", async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "gist-created" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "展开多端同步" }));
    fireEvent.change(screen.getByLabelText("GitHub Token"), { target: { value: "token-1" } });
    fireEvent.click(screen.getByRole("button", { name: "上传本机数据" }));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => {});
    expect(screen.getByRole("status")).toHaveTextContent("上传成功。已保存 Gist ID。");

    await vi.advanceTimersByTimeAsync(800);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("checks saved sync on startup and applies cloud data with a higher total", async () => {
    sessionStorage.setItem("s2-capture-counter:github-token", "token-1");
    localStorage.setItem("s2-capture-counter:gist-id", "gist-1");
    const cloudData: AppData = {
      version: 5,
      creatures: [
        { id: "cloud-creature", name: "云端精灵", targetCount: 80, currentEncounters: 4, totalEncounters: 4, location: "", notes: "", isDefault: false },
      ],
      records: [],
      giftedRecords: [],
      fairyTaleBookRecords: [],
      currentRound: null,
      settings: { sortMode: "default" },
      meta: { lastModifiedAt: "2026-08-10T00:00:00.000Z", lastModifiedBy: "computer" },
    };
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      files: { "s3-capture-counter.json": { content: JSON.stringify(cloudData) } },
    }), { status: 200 })));

    render(<App />);

    expect(await screen.findByRole("listitem", { name: /云端精灵/ })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("云端数据总抓取数更高，已自动更新本机数据。");
  });

  it("checks saved sync on startup and keeps local data when local total is not lower", async () => {
    sessionStorage.setItem("s2-capture-counter:github-token", "token-1");
    localStorage.setItem("s2-capture-counter:gist-id", "gist-1");
    const localData: AppData = {
      version: 5,
      creatures: [
        { id: "local-creature", name: "本机精灵", targetCount: 80, currentEncounters: 5, totalEncounters: 5, location: "", notes: "", isDefault: false },
      ],
      records: [],
      giftedRecords: [],
      fairyTaleBookRecords: [],
      currentRound: null,
      settings: { sortMode: "default" },
      meta: { lastModifiedAt: "2026-08-10T00:00:00.000Z", lastModifiedBy: "computer" },
    };
    const cloudData: AppData = {
      ...localData,
      creatures: [{ ...localData.creatures[0], id: "cloud-creature", name: "云端精灵", currentEncounters: 1, totalEncounters: 1 }],
    };
    localStorage.setItem("s3-capture-counter:data", JSON.stringify(localData));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      files: { "s3-capture-counter.json": { content: JSON.stringify(cloudData) } },
    }), { status: 200 })));

    render(<App />);

    expect(await screen.findByRole("status")).toHaveTextContent("本机数据总抓取数不低于云端，已保留本机数据。");
    expect(screen.getByRole("listitem", { name: /本机精灵/ })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: /云端精灵/ })).not.toBeInTheDocument();
  });

  it("warns when totals are equal but content differs", async () => {
    sessionStorage.setItem("s2-capture-counter:github-token", "token-1");
    localStorage.setItem("s2-capture-counter:gist-id", "gist-1");
    const localData: AppData = {
      version: 5,
      creatures: [
        { id: "local-creature", name: "本机精灵", targetCount: 80, currentEncounters: 5, totalEncounters: 5, location: "", notes: "", isDefault: false },
      ],
      records: [],
      giftedRecords: [],
      fairyTaleBookRecords: [],
      currentRound: null,
      settings: { sortMode: "default" },
      meta: { lastModifiedAt: "2026-08-10T00:00:00.000Z", lastModifiedBy: "computer" },
    };
    const cloudData: AppData = {
      ...localData,
      creatures: [{ ...localData.creatures[0], id: "cloud-creature", name: "云端精灵", currentEncounters: 5, totalEncounters: 5 }],
    };
    localStorage.setItem("s3-capture-counter:data", JSON.stringify(localData));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      files: { "s3-capture-counter.json": { content: JSON.stringify(cloudData) } },
    }), { status: 200 })));

    render(<App />);

    expect(await screen.findByRole("status")).toHaveTextContent("云端与本机总抓取数相同但内容不同，已保留本机数据；下次本机上传会自动合并两端记录。");
    expect(screen.getByRole("listitem", { name: /本机精灵/ })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: /云端精灵/ })).not.toBeInTheDocument();
  });

  it("automatically uploads local changes after a short delay when sync is configured", async () => {
    vi.useFakeTimers();
    sessionStorage.setItem("s2-capture-counter:github-token", "token-1");
    localStorage.setItem("s2-capture-counter:gist-id", "gist-1");
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") {
        return new Response(JSON.stringify({ id: "gist-1" }), { status: 200 });
      }
      return new Response(JSON.stringify({
        files: { "s3-capture-counter.json": { content: JSON.stringify({
          version: 5,
          creatures: [],
          records: [],
          giftedRecords: [],
          currentRound: null,
          settings: { sortMode: "default" },
      meta: { lastModifiedAt: "2026-08-10T00:00:00.000Z", lastModifiedBy: "computer" },
        }) } },
      }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    await act(async () => {});
    expect(screen.getByRole("status")).toBeInTheDocument();
    fetchMock.mockClear();

    fireEvent.click(screen.getAllByRole("button", { name: "+1" })[0]);
    await vi.advanceTimersByTimeAsync(799);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const patchCall = fetchMock.mock.calls[1];
    expect(patchCall[1]?.method).toBe("PATCH");
    await act(async () => {});
    expect(screen.getByRole("status")).toHaveTextContent("本机数据已自动上传到云端。");

    await vi.advanceTimersByTimeAsync(800);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("uploads a local edit made before startup sync hydration keeps local data", async () => {
    vi.useFakeTimers();
    sessionStorage.setItem("s2-capture-counter:github-token", "token-1");
    localStorage.setItem("s2-capture-counter:gist-id", "gist-1");
    const localData: AppData = {
      version: 5,
      creatures: [
        { id: "local-creature", name: "本机精灵", targetCount: 80, currentEncounters: 5, totalEncounters: 5, location: "", notes: "", isDefault: false },
      ],
      records: [],
      giftedRecords: [],
      fairyTaleBookRecords: [],
      currentRound: null,
      settings: { sortMode: "default" },
      meta: { lastModifiedAt: "2026-08-10T00:00:00.000Z", lastModifiedBy: "computer" },
    };
    const cloudData: AppData = {
      ...localData,
      creatures: [{ ...localData.creatures[0], id: "cloud-creature", name: "云端精灵", currentEncounters: 4, totalEncounters: 4 }],
    };
    localStorage.setItem("s3-capture-counter:data", JSON.stringify(localData));

    let resolveStartupGet: (response: Response) => void = () => {};
    const startupGet = new Promise<Response>((resolve) => {
      resolveStartupGet = resolve;
    });
    const fetchMock = vi.fn((url: string, init?: RequestInit) => {
      if (init?.method === "PATCH") return Promise.resolve(new Response(JSON.stringify({ id: "gist-1" }), { status: 200 }));
      return startupGet;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("listitem", { name: /本机精灵/ }).querySelector("button")!);
    fetchMock.mockClear();

    resolveStartupGet(new Response(JSON.stringify({
      files: { "s3-capture-counter.json": { content: JSON.stringify(cloudData) } },
    }), { status: 200 }));
    await act(async () => {});

    expect(screen.getByRole("status")).toHaveTextContent("本机数据总抓取数不低于云端，已保留本机数据。");
    await vi.advanceTimersByTimeAsync(799);
    expect(fetchMock).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const patchCall = fetchMock.mock.calls[1];
    expect(patchCall[1]?.method).toBe("PATCH");
    const patchBody = JSON.parse(patchCall[1]?.body as string);
    const uploadedData = JSON.parse(patchBody.files["s3-capture-counter.json"].content) as AppData;
    expect(uploadedData.creatures[0]).toMatchObject({ id: "local-creature", totalEncounters: 6 });
  });

  it("manual pull compares totals instead of overwriting higher local data", async () => {
    const user = userEvent.setup();
    const localData: AppData = {
      version: 5,
      creatures: [
        { id: "local-creature", name: "本机精灵", targetCount: 80, currentEncounters: 7, totalEncounters: 7, location: "", notes: "", isDefault: false },
      ],
      records: [],
      giftedRecords: [],
      fairyTaleBookRecords: [],
      currentRound: null,
      settings: { sortMode: "default" },
      meta: { lastModifiedAt: "2026-08-10T00:00:00.000Z", lastModifiedBy: "computer" },
    };
    const cloudData: AppData = {
      ...localData,
      creatures: [{ ...localData.creatures[0], id: "cloud-creature", name: "云端精灵", currentEncounters: 1, totalEncounters: 1 }],
    };
    localStorage.setItem("s3-capture-counter:data", JSON.stringify(localData));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      files: { "s3-capture-counter.json": { content: JSON.stringify(cloudData) } },
    }), { status: 200 })));

    render(<App />);
    await user.click(screen.getByRole("button", { name: "展开多端同步" }));
    await user.type(screen.getByLabelText("GitHub Token"), "token-1");
    await user.type(screen.getByLabelText("Gist ID"), "gist-1");
    await user.click(screen.getByRole("button", { name: "拉取云端数据" }));

    expect(await screen.findByRole("status")).toHaveTextContent("本机数据总抓取数不低于云端，已保留本机数据。");
    expect(screen.getByRole("listitem", { name: /本机精灵/ })).toBeInTheDocument();
    expect(screen.queryByRole("listitem", { name: /云端精灵/ })).not.toBeInTheDocument();
  });

  it("separates creature names from the counter controls", () => {
    render(<App />);

    const firstRow = screen.getByRole("listitem", { name: /苞米仔/ });
    expect(firstRow.querySelector(".creatureNamePane")?.textContent).toContain("苞米仔");
    expect(firstRow.querySelector(".creatureNamePane")?.textContent).toContain("奇遇");
    expect(firstRow.querySelector(".counterPane")?.textContent).toContain("本轮 0");
    expect(firstRow.querySelector(".counterPane")?.textContent).toContain("+1");
  });

  it("increments a creature encounter count", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "+1" })[0]);

    expect(screen.getByText("本轮 1")).toBeInTheDocument();
    expect(screen.getByText("历史 1")).toBeInTheDocument();
    expect(screen.getByText("本轮合计 1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开当前轮次" })).toBeInTheDocument();
  });

  it("sorts creature rows by current round count from high to low", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "+1" })[1]);

    const rows = screen.getAllByRole("listitem");
    expect(rows[0]).toHaveAccessibleName("守夜烛");
    expect(rows[1]).toHaveAccessibleName("苞米仔");
  });

  it("adds a custom creature", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "新增精灵" }));
    await user.type(screen.getByLabelText("名称"), "新精灵");
    expect(screen.getByLabelText("目标次数")).toHaveValue(80);
    expect(screen.queryByLabelText("地点/活动")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("备注")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("目标次数"));
    await user.type(screen.getByLabelText("目标次数"), "300");
    await user.click(screen.getByRole("button", { name: "保存精灵" }));

    expect(screen.getByRole("listitem", { name: /新精灵/ })).toBeInTheDocument();
  });

  it("updates editor fields when switching directly between creatures", async () => {
    const user = userEvent.setup();
    render(<App />);

    const editButtons = screen.getAllByRole("button", { name: "编辑" });
    await user.click(editButtons[0]);
    expect(screen.getByLabelText("名称")).toHaveValue("苞米仔");

    await user.click(editButtons[1]);

    expect(screen.getByLabelText("名称")).toHaveValue("守夜烛");
  });

  it("records acquisition with current round total and second-level time", async () => {
    const user = userEvent.setup();
    render(<App />);
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLDivElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });
    await user.click(screen.getByRole("button", { name: "展开当前轮次" }));

    await user.click(screen.getAllByRole("button", { name: "+1" })[0]);
    await user.click(screen.getAllByRole("button", { name: "+1" })[1]);
    const roundPanel = screen.getByRole("region", { name: "当前轮次" });
    expect(within(roundPanel).getByText("本轮合计 2")).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "记录获得" })[0]);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });

    expect(screen.getByLabelText("时间")).toHaveAttribute("step", "1");
    expect(screen.queryByLabelText("地点/活动")).not.toBeInTheDocument();
    await user.clear(screen.getByLabelText("时间"));
    await user.type(screen.getByLabelText("时间"), "2026-05-22T08:09:10");
    await user.type(screen.getByLabelText("备注"), "手动记录备注");
    await user.click(screen.getByRole("button", { name: "保存记录" }));

    expect(screen.getByText("手动记录备注")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "获得历史" }).closest("section")).toHaveTextContent("2026-05-22 08:09:10");
    expect(screen.getByText("本轮 2")).toBeInTheDocument();
    expect(screen.getByText(/明细/)).toHaveTextContent("苞米仔 1 / 守夜烛 1");
    expect(screen.getByRole("listitem", { name: /苞米仔/ }).querySelector(".counterPane")?.textContent).toContain("本轮 0");
    expect(screen.getByRole("listitem", { name: /守夜烛/ }).querySelector(".counterPane")?.textContent).toContain("本轮 0");
  });

  it("hides zero-count entries in acquisition breakdowns", () => {
    const record: AcquisitionRecord = {
      id: "record-1",
      creatureId: "s3-adventure-baomizai",
      creatureName: "苞米仔",
      date: "2026-05-22T08:09:10",
      acquisitionNumber: 1,
      roundEncounters: 4,
      roundBreakdown: [
        { creatureId: "s3-adventure-baomizai", creatureName: "苞米仔", encounters: 3 },
        { creatureId: "s3-adventure-shouyezhu", creatureName: "守夜烛", encounters: 1 },
        { creatureId: "s3-adventure-shizikedou", creatureName: "十字蝌蚪", encounters: 0 },
        { creatureId: "other", creatureName: "其它", encounters: 0 },
      ],
      isOffTarget: false,
      targetCreatureId: "s3-adventure-baomizai",
      targetCreatureName: "苞米仔",
      targetRoundEncounters: 4,
      totalEncountersAtRecord: 4,
      location: "",
      notes: "",
    };

    render(<HistoryList records={[record]} fairyTaleBookRecords={[]} />);

    const history = screen.getByRole("heading", { name: "获得历史" }).closest("section");
    expect(screen.getByText(/明细/)).toHaveTextContent("苞米仔 3 / 守夜烛 1");
    expect(history).not.toBeNull();
    if (!history) throw new Error("history section missing");
    expect(history).not.toHaveTextContent("十字蝌蚪 0");
    expect(history).not.toHaveTextContent("其它 0");
  });

  it("marks a target and records off-target acquisitions without changing the round", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "展开当前轮次" }));
    await user.selectOptions(screen.getByLabelText("正在抓"), "s3-adventure-baomizai");
    await user.click(screen.getAllByRole("button", { name: "+1" })[0]);
    await user.click(screen.getAllByRole("button", { name: "+1" })[0]);

    await user.click(screen.getAllByRole("button", { name: "记录获得" })[1]);
    expect(screen.getByLabelText("获得类型")).toHaveValue("offTarget");
    await user.click(screen.getByRole("button", { name: "保存记录" }));

    expect(screen.getByRole("heading", { name: "获得历史" }).closest("section")).toHaveTextContent(/记录抓.*苞米仔.*2只时歪出/);
    expect(screen.getByRole("listitem", { name: /苞米仔/ }).querySelector(".counterPane")?.textContent).toContain("本轮 2");
    expect(screen.getByRole("listitem", { name: /守夜烛/ }).querySelector(".counterPane")?.textContent).toContain("本轮 0");
  });

  it("keeps current round when manually choosing off-target for the same creature", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "+1" })[0]);
    await user.click(screen.getAllByRole("button", { name: "记录获得" })[0]);
    await user.selectOptions(screen.getByLabelText("获得类型"), "offTarget");
    await user.click(screen.getByRole("button", { name: "保存记录" }));

    expect(screen.getByRole("heading", { name: "获得历史" }).closest("section")).toHaveTextContent(/记录抓.*苞米仔.*1只时歪出/);
    expect(screen.getByRole("listitem", { name: /苞米仔/ }).querySelector(".counterPane")?.textContent).toContain("本轮 1");
  });

  it("records gifted captures without affecting own capture stats", async () => {
    const user = userEvent.setup();
    render(<App />);
    const scrollIntoView = vi.fn();
    Object.defineProperty(HTMLDivElement.prototype, "scrollIntoView", { configurable: true, value: scrollIntoView });

    await user.click(screen.getAllByRole("button", { name: "+1" })[0]);
    await user.click(screen.getAllByRole("button", { name: "记录赠送" })[0]);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "start" });
    await user.clear(screen.getByLabelText("时间"));
    await user.type(screen.getByLabelText("时间"), "2026-05-22T08:09:10");
    await user.type(screen.getByLabelText("来源/赠送人"), "朋友");
    await user.type(screen.getByLabelText("备注"), "送的");
    await user.click(screen.getByRole("button", { name: "保存赠送记录" }));

    expect(screen.getByRole("heading", { name: "获得历史" }).closest("section")).toHaveTextContent("还没有记录。");
    expect(screen.getByRole("heading", { name: "别人赠送记录" }).closest("section")).toHaveTextContent("朋友");
    expect(screen.getByRole("heading", { name: "别人赠送记录" }).closest("section")).toHaveTextContent("送的");
    expect(screen.getByRole("listitem", { name: /苞米仔/ }).querySelector(".counterPane")?.textContent).toContain("本轮 1");
    expect(screen.getByText("赠送记录").previousSibling).toHaveTextContent("1");
  });

  it("backs up corrupt storage and shows the recovery message", () => {
    localStorage.setItem(S3_STORAGE_KEY, "not json");

    render(<App />);

    expect(screen.getByRole("status")).toHaveTextContent("检测到本机数据损坏，已恢复默认数据；原始数据已备份到 s3-capture-counter:data-corrupt。");
    expect(localStorage.getItem("s3-capture-counter:data-corrupt")).toBe("not json");
  });

  it("backs up corrupt storage when switching into a season and shows the recovery message", async () => {
    const user = userEvent.setup();
    localStorage.setItem(S3_STORAGE_KEY, JSON.stringify(createDefaultData("s3")));
    localStorage.setItem(S2_STORAGE_KEY, "broken json");

    render(<App />);
    await user.selectOptions(screen.getByLabelText("赛季"), "s2");

    expect(screen.getByRole("status")).toHaveTextContent("检测到本机数据损坏，已恢复默认数据；原始数据已备份到 s2-capture-counter:data-corrupt。");
    expect(localStorage.getItem("s2-capture-counter:data-corrupt")).toBe("broken json");
  });
});
