import { useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "../domain/serverSync";

type Props = {
  session: Session | null;
  busy: boolean;
  onLogin: (username: string, password: string) => Promise<string | null>;
  onRegister: (username: string, password: string) => Promise<string | null>;
  onLogout: () => Promise<void>;
  onResetPassword: (username: string, newPassword: string) => Promise<string | null>;
};

export function LoginDialog({ session, busy, onLogin, onRegister, onLogout, onResetPassword }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const result = mode === "login" ? await onLogin(username.trim(), password) : await onRegister(username.trim(), password);
    if (result) {
      setError(result);
    } else {
      setUsername("");
      setPassword("");
    }
  }

  async function submitReset(event: FormEvent) {
    event.preventDefault();
    setError("");
    const result = await onResetPassword(resetUsername.trim(), resetPassword);
    if (result) {
      setError(result);
    } else {
      setResetUsername("");
      setResetPassword("");
      setResetOpen(false);
    }
  }

  return (
    <section className="panel accountPanel">
      <div className="sectionHeader">
        <div>
          <h2>账号</h2>
          <p>登录后数据按账号保存到云端，换设备登录同一账号即可继续。</p>
        </div>
      </div>
      {session ? (
        <div className="accountInfo">
          <p>已登录为 <strong>{session.username}</strong>{session.isAdmin ? "（管理员）" : ""}</p>
          <button type="button" className="ghost" disabled={busy} onClick={() => { setError(""); void onLogout(); }}>退出登录</button>
          {session.isAdmin && (
            <details open={resetOpen} onToggle={(event) => setResetOpen(event.currentTarget.open)}>
              <summary>重置用户密码</summary>
              <form onSubmit={submitReset} className="row">
                <input aria-label="重置密码的用户名" value={resetUsername} placeholder="用户名" onChange={(event) => setResetUsername(event.target.value)} />
                <input aria-label="重置密码的新密码" type="password" value={resetPassword} placeholder="新密码（至少 8 位）" autoComplete="new-password" onChange={(event) => setResetPassword(event.target.value)} />
                <button type="submit" disabled={busy}>重置密码</button>
              </form>
            </details>
          )}
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="row">
            <input aria-label="用户名" value={username} placeholder="用户名（2–32 位）" autoComplete="username" onChange={(event) => setUsername(event.target.value)} />
            <input aria-label="密码" type="password" value={password} placeholder="密码（至少 8 位）" autoComplete={mode === "login" ? "current-password" : "new-password"} onChange={(event) => setPassword(event.target.value)} />
            <button type="submit" disabled={busy}>{mode === "login" ? "登录" : "注册"}</button>
          </div>
          <p className="muted">
            <button type="button" className="linkButton" onClick={() => { setError(""); setMode(mode === "login" ? "register" : "login"); }}>
              {mode === "login" ? "没有账号？注册一个" : "已有账号？直接登录"}
            </button>
          </p>
        </form>
      )}
      {error && <p className="message" role="status">{error}</p>}
    </section>
  );
}
