import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

describe("App", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders the counter dashboard", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "S2 捕捉计数器" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "数据管理与多端同步" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开当前轮次" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "展开多端同步" })).toBeInTheDocument();
    expect(screen.getByRole("listitem", { name: /猴麦仔/ })).toBeInTheDocument();
    expect(screen.getAllByText("目标 80")[0]).toBeInTheDocument();
    expect(screen.queryByText("限定异色精灵")).not.toBeInTheDocument();
    expect(screen.queryByText("Past")).not.toBeInTheDocument();
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

    expect(localStorage.getItem("s2-capture-counter:github-token")).toBe("token-1");
    expect(localStorage.getItem("s2-capture-counter:gist-id")).toBe("gist-1");
    expect(screen.getByText("同步配置已保存。本机离线数据仍会继续保存。")).toBeInTheDocument();
  });

  it("pushes current data to a private gist and stores the new gist id", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ id: "gist-created" }), { status: 201 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);

    await user.click(screen.getByRole("button", { name: "展开多端同步" }));
    await user.type(screen.getByLabelText("GitHub Token"), "token-1");
    await user.click(screen.getByRole("button", { name: "上传本机数据" }));

    expect(fetchMock).toHaveBeenCalledWith("https://api.github.com/gists", expect.objectContaining({ method: "POST" }));
    expect(localStorage.getItem("s2-capture-counter:gist-id")).toBe("gist-created");
    expect(screen.getByText("上传成功。已保存 Gist ID。")).toBeInTheDocument();
  });

  it("separates creature names from the counter controls", () => {
    render(<App />);

    const firstRow = screen.getByRole("listitem", { name: /猴麦仔/ });
    expect(firstRow.querySelector(".creatureNamePane")?.textContent).toContain("猴麦仔");
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
    expect(rows[0]).toHaveAccessibleName("烟花团");
    expect(rows[1]).toHaveAccessibleName("猴麦仔");
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
    expect(screen.getByLabelText("名称")).toHaveValue("猴麦仔");

    await user.click(editButtons[1]);

    expect(screen.getByLabelText("名称")).toHaveValue("烟花团");
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
    expect(screen.getByText(/明细/)).toHaveTextContent("猴麦仔 1 / 烟花团 1");
    expect(screen.getByRole("listitem", { name: /猴麦仔/ }).querySelector(".counterPane")?.textContent).toContain("本轮 0");
    expect(screen.getByRole("listitem", { name: /烟花团/ }).querySelector(".counterPane")?.textContent).toContain("本轮 0");
  });

  it("marks a target and records off-target acquisitions without changing the round", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "展开当前轮次" }));
    await user.selectOptions(screen.getByLabelText("正在抓"), "limited-shiny-houmaizai");
    await user.click(screen.getAllByRole("button", { name: "+1" })[0]);
    await user.click(screen.getAllByRole("button", { name: "+1" })[0]);

    await user.click(screen.getAllByRole("button", { name: "记录获得" })[1]);
    expect(screen.getByLabelText("获得类型")).toHaveValue("offTarget");
    await user.click(screen.getByRole("button", { name: "保存记录" }));

    expect(screen.getByRole("heading", { name: "获得历史" }).closest("section")).toHaveTextContent("记录抓“猴麦仔”2只时歪出");
    expect(screen.getByRole("listitem", { name: /猴麦仔/ }).querySelector(".counterPane")?.textContent).toContain("本轮 2");
    expect(screen.getByRole("listitem", { name: /烟花团/ }).querySelector(".counterPane")?.textContent).toContain("本轮 0");
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
    expect(screen.getByRole("listitem", { name: /猴麦仔/ }).querySelector(".counterPane")?.textContent).toContain("本轮 1");
    expect(screen.getByText("赠送记录").previousSibling).toHaveTextContent("1");
  });
});
