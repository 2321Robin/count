import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import type { SyncConfig } from "../domain/sync";

type Props = {
  message: string;
  syncConfig: SyncConfig;
  syncBusy: boolean;
  onSaveSyncConfig: (config: SyncConfig) => void;
  onPushSync: (config: SyncConfig) => void;
  onPullSync: (config: SyncConfig) => void;
  onDisconnectSync: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onClear: () => void;
  onReset: () => void;
};

export function DataManager({ message, syncConfig, syncBusy, onSaveSyncConfig, onPushSync, onPullSync, onDisconnectSync, onExport, onImport, onClear, onReset }: Props) {
  const [token, setToken] = useState(syncConfig.token);
  const [gistId, setGistId] = useState(syncConfig.gistId);
  const [isSyncOpen, setIsSyncOpen] = useState(false);
  const trimmedConfig = { token: token.trim(), gistId: gistId.trim() };

  useEffect(() => setToken(syncConfig.token), [syncConfig.token]);
  useEffect(() => setGistId(syncConfig.gistId), [syncConfig.gistId]);

  function submitSync(event: FormEvent) {
    event.preventDefault();
    onSaveSyncConfig(trimmedConfig);
  }

  return (
    <section className="panel syncPanel">
      <div className="sectionHeader">
        <div>
          <h2>数据管理与多端同步</h2>
          <p>导入导出、本地重置和 GitHub Gist 多端同步集中在这里。</p>
        </div>
        <button type="button" className="ghost" aria-expanded={isSyncOpen} aria-controls="sync-panel-details" onClick={() => setIsSyncOpen((value) => !value)}>
          {isSyncOpen ? "收起多端同步" : "展开多端同步"}
        </button>
      </div>
      <div className="row">
        <button type="button" onClick={onExport}>导出 JSON</button>
        <label className="fileButton">导入 JSON<input className="visuallyHidden" type="file" accept="application/json" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImport(file);
          event.currentTarget.value = "";
        }} /></label>
        <button type="button" className="danger" onClick={onClear}>清空所有数据</button>
        <button type="button" onClick={onReset}>重置默认数据</button>
      </div>
      <p className="muted">导出前建议先保存一份备份；导入会自动兼容旧版数据并升级到新版结构。</p>
      {isSyncOpen && (
        <div id="sync-panel-details">
          <form onSubmit={submitSync}>
            <label>GitHub Token<input type="password" value={token} placeholder="ghp_..." autoComplete="off" onChange={(event) => setToken(event.target.value)} /></label>
            <label>Gist ID<input value={gistId} placeholder="第一次上传可留空，成功后会自动保存" onChange={(event) => setGistId(event.target.value)} /></label>
            <div className="row">
              <button type="submit" disabled={syncBusy}>保存同步配置</button>
              <button type="button" disabled={syncBusy || !token.trim()} onClick={() => onPushSync(trimmedConfig)}>上传本机数据</button>
              <button type="button" disabled={syncBusy || !token.trim() || !gistId.trim()} onClick={() => onPullSync(trimmedConfig)}>拉取云端数据</button>
              <button type="button" disabled={syncBusy} onClick={onDisconnectSync}>退出同步</button>
            </div>
          </form>
          <p className="muted">不配置也能照常离线使用。上传会覆盖 Gist，拉取会覆盖本机；覆盖前建议先导出 JSON 备份。</p>
        </div>
      )}
      {message && <p className="message" role="status">{message}</p>}
    </section>
  );
}
