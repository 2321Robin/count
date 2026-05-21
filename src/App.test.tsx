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
    expect(screen.getByText("S2 精灵 1")).toBeInTheDocument();
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
    expect(screen.getByLabelText("名称")).toHaveValue("S2 精灵 1");

    await user.click(editButtons[1]);

    expect(screen.getByLabelText("名称")).toHaveValue("S2 精灵 2");
  });
});
