import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => cleanup());

  it("renders the counter dashboard", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "S2 捕捉计数器" })).toBeInTheDocument();
    expect(screen.getByText("猴麦仔")).toBeInTheDocument();
    expect(screen.getAllByText("目标 80")[0]).toBeInTheDocument();
    expect(screen.queryByText("限定异色精灵")).not.toBeInTheDocument();
    expect(screen.queryByText("Past")).not.toBeInTheDocument();
  });

  it("switches and persists the color theme", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<App />);

    expect(screen.getByLabelText("主题")).toHaveValue("navy");
    expect(screen.getByRole("main")).toHaveAttribute("data-theme", "navy");

    await user.selectOptions(screen.getByLabelText("主题"), "neon");

    expect(screen.getByRole("main")).toHaveAttribute("data-theme", "neon");
    expect(localStorage.getItem("s2-capture-counter:theme")).toBe("neon");

    unmount();
    render(<App />);

    expect(screen.getByLabelText("主题")).toHaveValue("neon");
    expect(screen.getByRole("main")).toHaveAttribute("data-theme", "neon");
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

    expect(screen.getByText("新精灵")).toBeInTheDocument();
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

  it("keeps notes only when recording an acquisition", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "+1" })[0]);
    await user.click(screen.getAllByRole("button", { name: "记录获得" })[0]);

    expect(screen.queryByLabelText("地点/活动")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("备注"), "手动记录备注");
    await user.click(screen.getByRole("button", { name: "保存记录" }));

    expect(screen.getByText("手动记录备注")).toBeInTheDocument();
    expect(screen.getByText("第 1 只")).toBeInTheDocument();
  });
});
