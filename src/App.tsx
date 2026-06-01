import { useEffect, useRef, useState } from "react";
import { CreatureEditor } from "./components/CreatureEditor";
import { CreatureGrid } from "./components/CreatureGrid";
import { CurrentRoundPanel } from "./components/CurrentRoundPanel";
import { DataManager } from "./components/DataManager";
import { HeaderStats } from "./components/HeaderStats";
import { GiftedHistoryList } from "./components/GiftedHistoryList";
import { GiftedRecordDialog } from "./components/GiftedRecordDialog";
import { HistoryList } from "./components/HistoryList";
import { SyncPanel } from "./components/SyncPanel";
import { RecordDialog } from "./components/RecordDialog";
import { addCreature, calculateStats, decrementEncounter, incrementEncounter, recordAcquisition, recordGiftedCapture, removeCreature, resetCurrentRoundCounts, setCurrentRoundTargets, startNewRound, updateCreature } from "./domain/counter";
import { createDefaultData } from "./domain/defaultData";
import { exportAppData, parseImportedData } from "./domain/importExport";
import { loadAppData, saveAppData } from "./domain/storage";
import { clearSyncConfig, loadSyncConfig, pullFromGist, pushToGist, saveSyncConfig } from "./domain/sync";
import type { SyncConfig } from "./domain/sync";
import type { AppData, Creature, CreatureInput, GiftedRecordInput, RecordInput } from "./domain/types";

const THEME_KEY = "s2-capture-counter:theme";
type Theme = "navy" | "fantasy" | "neon";

function loadTheme(): Theme {
  const theme = localStorage.getItem(THEME_KEY);
  return theme === "fantasy" || theme === "neon" || theme === "navy" ? theme : "navy";
}

export default function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [editing, setEditing] = useState<Creature | null | "new">(null);
  const [recording, setRecording] = useState<Creature | null>(null);
  const [recordingGift, setRecordingGift] = useState<Creature | null>(null);
  const [message, setMessage] = useState("");
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => loadSyncConfig());
  const [syncBusy, setSyncBusy] = useState(false);
  const recordDialogRef = useRef<HTMLDivElement>(null);
  const giftedRecordDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => saveAppData(data), [data]);
  useEffect(() => localStorage.setItem(THEME_KEY, theme), [theme]);

  useEffect(() => {
    if (recording) recordDialogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [recording]);

  useEffect(() => {
    if (recordingGift) giftedRecordDialogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [recordingGift]);

  function apply(next: AppData) {
    setData(next);
    setMessage("");
  }

  function saveCreature(input: CreatureInput) {
    if (editing && editing !== "new") apply(updateCreature(data, editing.id, input));
    else apply(addCreature(data, input));
    setEditing(null);
  }

  function saveRecord(input: RecordInput) {
    if (recording) apply(recordAcquisition(data, recording.id, input));
    setRecording(null);
  }

  function saveGiftedRecord(input: GiftedRecordInput) {
    apply(recordGiftedCapture(data, input));
    setRecordingGift(null);
  }

  function openRecordDialog(creature: Creature) {
    setRecording(creature);
    setRecordingGift(null);
  }

  function openGiftedRecordDialog(creature: Creature) {
    setRecording(null);
    setRecordingGift(creature);
  }

  function updateSyncConfig(config: SyncConfig) {
    saveSyncConfig(config);
    setSyncConfig(config);
    setMessage("同步配置已保存。本机离线数据仍会继续保存。");
  }

  async function pushSync(config: SyncConfig) {
    setSyncBusy(true);
    const result = await pushToGist(data, config);
    setSyncBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const nextConfig = { token: config.token.trim(), gistId: result.gistId ?? config.gistId.trim() };
    saveSyncConfig(nextConfig);
    setSyncConfig(nextConfig);
    setMessage("上传成功。已保存 Gist ID。");
  }

  async function pullSync(config: SyncConfig) {
    if (!window.confirm("拉取云端数据会覆盖本机当前数据。建议先导出 JSON 备份。确定继续？")) return;
    setSyncBusy(true);
    const result = await pullFromGist(config);
    setSyncBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    setData(result.data);
    setMessage("拉取成功，本机数据已更新。");
  }

  function disconnectSync() {
    clearSyncConfig();
    setSyncConfig({ token: "", gistId: "" });
    setMessage("已退出同步。本机数据不会删除。");
  }

  function exportData() {
    const blob = new Blob([exportAppData(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "s2-capture-counter-backup.json";
    link.click();
    URL.revokeObjectURL(url);
    setMessage("导出成功。");
  }

  async function importData(file: File) {
    const result = parseImportedData(await file.text());
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    apply(result.data);
    setMessage("导入成功。");
  }

  function clearData() {
    if (window.confirm("确定清空所有数据？此操作不可撤销。")) apply({ version: 2, creatures: [], records: [], giftedRecords: [], currentRound: null, settings: { sortMode: "default" } });
  }

  function resetData() {
    if (window.confirm("确定重置为默认数据？当前记录会被清空。")) apply(createDefaultData());
  }

  function removeCustomCreature(id: string) {
    if (window.confirm("确定删除这个自定义精灵？相关记录也会被删除。")) apply(removeCreature(data, id));
  }

  return (
    <main className="app" data-theme={theme}>
      <header className="hero">
        <div>
          <p className="eyebrow">Roco World S2</p>
          <h1>S2 捕捉计数器</h1>
          <p>按精灵记录遭遇次数、本轮进度和获得历史。</p>
        </div>
        <div className="heroActions">
          <label className="themePicker">主题
            <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
              <option value="navy">深蓝夜航</option>
              <option value="fantasy">洛克幻想</option>
              <option value="neon">霓虹赛季</option>
            </select>
          </label>
          <button type="button" onClick={() => setEditing("new")}>新增精灵</button>
        </div>
      </header>
      <SyncPanel config={syncConfig} busy={syncBusy} onSaveConfig={updateSyncConfig} onPush={pushSync} onPull={pullSync} onDisconnect={disconnectSync} />
      <CurrentRoundPanel data={data} onSetTargets={(ids) => apply(setCurrentRoundTargets(data, ids))} onStartNew={(ids) => apply(startNewRound(data, ids))} onReset={() => apply(resetCurrentRoundCounts(data))} />
      <HeaderStats stats={calculateStats(data)} />
      {editing && <CreatureEditor key={editing === "new" ? "new" : editing.id} creature={editing === "new" ? null : editing} onSave={saveCreature} onCancel={() => setEditing(null)} />}
      {recording && <div ref={recordDialogRef}><RecordDialog creature={recording} onSave={saveRecord} onCancel={() => setRecording(null)} /></div>}
      {recordingGift && <div ref={giftedRecordDialogRef}><GiftedRecordDialog creatures={data.creatures} initialCreatureId={recordingGift.id} onSave={saveGiftedRecord} onCancel={() => setRecordingGift(null)} /></div>}
      <CreatureGrid
        creatures={data.creatures}
        onIncrement={(id) => apply(incrementEncounter(data, id))}
        onDecrement={(id) => apply(decrementEncounter(data, id))}
        onEdit={setEditing}
        onRecord={openRecordDialog}
        onRecordGift={openGiftedRecordDialog}
        onRemove={removeCustomCreature}
      />
      <DataManager message={message} onExport={exportData} onImport={importData} onClear={clearData} onReset={resetData} />
      <HistoryList records={data.records} />
      <GiftedHistoryList records={data.giftedRecords} />
    </main>
  );
}
