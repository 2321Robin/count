import { useState } from "react";
import type { FormEvent } from "react";
import type { SyncConfig } from "../domain/sync";

type Props = {
  config: SyncConfig;
  busy: boolean;
  onSaveConfig: (config: SyncConfig) => void;
  onPush: (config: SyncConfig) => void;
  onPull: (config: SyncConfig) => void;
  onDisconnect: () => void;
};

export function SyncPanel({ config, busy, onSaveConfig, onPush, onPull, onDisconnect }: Props) {
  const [token, setToken] = useState(config.token);
  const [gistId, setGistId] = useState(config.gistId);
  const trimmedConfig = { token: token.trim(), gistId: gistId.trim() };
  const [isOpen, setIsOpen] = useState(false);

  function submit(event: FormEvent) {
    event.preventDefault();
    onSaveConfig(trimmedConfig);
  }

  return (
    <section className="panel syncPanel">
      <div className="sectionHeader">
        <div>
          <h2>多端同步（可选）</h2>
          {isOpen ? (
            <p>不配置也能照常离线使用。个人使用推荐 GitHub 私密 Gist：只保存这一份 JSON，Token 只需要 gist 权限。</p>
          ) : (
            <p>默认收起；不配置也能照常离线使用。</p>
          )}
        </div>
        <button type="button" className="ghost" aria-expanded={isOpen} aria-controls="sync-panel-details" onClick={() => setIsOpen((value) => !value)}>
          {isOpen ? "收起多端同步" : "展开多端同步"}
        </button>
      </div>
      {isOpen && (
        <div id="sync-panel-details">
          <form onSubmit={submit}>
            <label>GitHub Token<input type="password" value={token} placeholder="ghp_..." autoComplete="off" onChange={(event) => setToken(event.target.value)} /></label>
            <label>Gist ID<input value={gistId} placeholder="第一次上传可留空，成功后会自动保存" onChange={(event) => setGistId(event.target.value)} /></label>
            <div className="row">
              <button type="submit" disabled={busy}>保存同步配置</button>
              <button type="button" disabled={busy || !token.trim()} onClick={() => onPush(trimmedConfig)}>上传本机数据</button>
              <button type="button" disabled={busy || !token.trim() || !gistId.trim()} onClick={() => onPull(trimmedConfig)}>拉取云端数据</button>
              <button type="button" disabled={busy} onClick={onDisconnect}>退出同步</button>
            </div>
          </form>
          <p className="muted">冲突处理保持简单：上传会覆盖 Gist，拉取会覆盖本机。覆盖前建议先导出 JSON 备份。</p>
        </div>
      )}
    </section>
  );
}
