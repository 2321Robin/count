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

  it("increments a creature encounter count", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "+1" })[0]);

    expect(screen.getByText("本轮 1")).toBeInTheDocument();
    expect(screen.getByText("历史 1")).toBeInTheDocument();
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
  });
});
