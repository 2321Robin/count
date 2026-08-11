import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginDialog } from "./LoginDialog";

describe("LoginDialog", () => {
  afterEach(() => {
    cleanup();
  });

  it("submits registration with trimmed username and shows errors", async () => {
    const onRegister = vi.fn(async () => "用户名已被注册。");
    render(<LoginDialog session={null} busy={false} onLogin={vi.fn()} onRegister={onRegister} onLogout={vi.fn()} onResetPassword={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "没有账号？注册一个" }));
    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "  alice  " } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: /^注册$/ }));

    expect(onRegister).toHaveBeenCalledWith("alice", "password1");
    expect(await screen.findByRole("status")).toHaveTextContent("用户名已被注册。");
  });

  it("toggles between login and register modes", () => {
    render(<LoginDialog session={null} busy={false} onLogin={vi.fn()} onRegister={vi.fn()} onLogout={vi.fn()} onResetPassword={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^登录$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "没有账号？注册一个" }));
    expect(screen.getByRole("button", { name: /^注册$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "已有账号？直接登录" }));
    expect(screen.getByRole("button", { name: /^登录$/ })).toBeInTheDocument();
  });

  it("shows the account menu with admin reset when logged in", () => {
    const onResetPassword = vi.fn(async () => null);
    render(<LoginDialog session={{ userId: 1, username: "alice", isAdmin: true }} busy={false} onLogin={vi.fn()} onRegister={vi.fn()} onLogout={vi.fn()} onResetPassword={onResetPassword} />);
    expect(screen.getByText((_content, element) => element?.textContent?.includes("已登录为 alice") ?? false, { selector: "p" })).toBeInTheDocument();
    fireEvent.click(screen.getByText("重置用户密码"));
    fireEvent.change(screen.getByLabelText("重置密码的用户名"), { target: { value: "bob" } });
    fireEvent.change(screen.getByLabelText("重置密码的新密码"), { target: { value: "brand-new-3" } });
    fireEvent.click(screen.getByRole("button", { name: "重置密码" }));
    expect(onResetPassword).toHaveBeenCalledWith("bob", "brand-new-3");
    expect(screen.queryByRole("button", { name: /^登录$/ })).not.toBeInTheDocument();
  });
});
