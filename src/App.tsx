import { useEffect, useRef, useState } from "react";
import { CreatureEditor } from "./components/CreatureEditor";
import { CreatureGrid } from "./components/CreatureGrid";
import { CurrentRoundPanel } from "./components/CurrentRoundPanel";
import { DataManager } from "./components/DataManager";
import { HeaderStats } from "./components/HeaderStats";
import { GiftedHistoryList } from "./components/GiftedHistoryList";
import { GiftedRecordDialog } from "./components/GiftedRecordDialog";
import { HistoryList } from "./components/HistoryList";
import { RecordDialog } from "./components/RecordDialog";
import { addCreature, calculateStats, decrementEncounter, getCurrentRoundTarget, incrementEncounter, recordAcquisition, recordGiftedCapture, removeCreature, resetCurrentRoundCounts, setCurrentRoundTarget, setCurrentRoundTargets, startNewRound, updateCreature } from "./domain/counter";
import { createDefaultData } from "./domain/defaultData";
import { exportAppData, parseImportedData } from "./domain/importExport";
import { DEFAULT_SEASON_ID, getAvailableSeasonIds, getSeasonConfig, isSeasonId, SELECTED_SEASON_KEY } from "./domain/seasons";
import type { SeasonId } from "./domain/seasons";
import { loadAppData, saveAppData } from "./domain/storage";
import { clearSyncConfig, loadSyncConfig, pullFromGist, pushToGist, saveSyncConfig, selectHigherTotalData } from "./domain/sync";
import type { SyncConfig } from "./domain/sync";
import type { AppData, Creature, CreatureInput, GiftedRecordInput, RecordInput } from "./domain/types";

const THEME_KEY = "s2-capture-counter:theme";
const LAST_SYNC_AT_KEY = "s2-capture-counter:last-sync-at";
const AUTO_SYNC_UPLOAD_DELAY_MS = 800;
type Theme = "fantasy" | "navy" | "neon" | "forest" | "sunset" | "mono";

function isTheme(value: string | null): value is Theme {
  return value === "fantasy" || value === "navy" || value === "neon" || value === "forest" || value === "sunset" || value === "mono";
}

function loadTheme(): Theme {
  const theme = localStorage.getItem(THEME_KEY);
  return isTheme(theme) ? theme : "fantasy";
}

function loadSelectedSeason(): SeasonId {
  const saved = localStorage.getItem(SELECTED_SEASON_KEY);
  if (isSeasonId(saved) && getSeasonConfig(saved).isAvailable) return saved;
  return DEFAULT_SEASON_ID;
}

export default function App() {
  const [seasonId, setSeasonId] = useState<SeasonId>(() => loadSelectedSeason());
  const season = getSeasonConfig(seasonId);
  const [data, setData] = useState<AppData>(() => loadAppData(seasonId));
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [editing, setEditing] = useState<Creature | null | "new">(null);
  const [recording, setRecording] = useState<Creature | null>(null);
  const [recordingGift, setRecordingGift] = useState<Creature | null>(null);
  const [message, setMessage] = useState("");
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => localStorage.getItem(LAST_SYNC_AT_KEY));
  const [syncConfig, setSyncConfig] = useState<SyncConfig>(() => loadSyncConfig());
  const [syncBusy, setSyncBusy] = useState(false);
  const recordDialogRef = useRef<HTMLDivElement>(null);
  const giftedRecordDialogRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef(data);
  const seasonIdRef = useRef(seasonId);
  const hasHydratedRef = useRef(false);
  const hasTrackedInitialDataRef = useRef(false);
  const preHydrationDirtyRef = useRef(false);
  const skipNextAutoUploadRef = useRef(false);
  const skipNextSaveRef = useRef(false);
  const [hydrationRevision, setHydrationRevision] = useState(0);

  useEffect(() => {
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }
    saveAppData(seasonId, data);
  }, [seasonId, data]);
  useEffect(() => localStorage.setItem(THEME_KEY, theme), [theme]);
  useEffect(() => localStorage.setItem(SELECTED_SEASON_KEY, seasonId), [seasonId]);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    seasonIdRef.current = seasonId;
  }, [seasonId]);

  useEffect(() => {
    if (!hasTrackedInitialDataRef.current) {
      hasTrackedInitialDataRef.current = true;
      return;
    }
    if (!hasHydratedRef.current) preHydrationDirtyRef.current = true;
  }, [data]);

  useEffect(() => {
    if (recording) recordDialogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [recording]);

  useEffect(() => {
    if (recordingGift) giftedRecordDialogRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [recordingGift]);

  useEffect(() => {
    const config = syncConfig;
    if (!config.token.trim() || !config.gistId.trim()) {
      hasHydratedRef.current = true;
      return;
    }

    let cancelled = false;
    setSyncBusy(true);
    pullFromGist(config, seasonId).then((result) => {
      if (cancelled) return;
      if (result.ok) applyPulledData(result.data);
      else setMessage(result.error);
    }).finally(() => {
      if (!cancelled) {
        setSyncBusy(false);
        hasHydratedRef.current = true;
        if (preHydrationDirtyRef.current) setHydrationRevision((revision) => revision + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [seasonId]);

  useEffect(() => {
    if (!hasHydratedRef.current) return;
    if (skipNextAutoUploadRef.current) {
      skipNextAutoUploadRef.current = false;
      return;
    }

    const config = syncConfig;
    if (!config.token.trim() || !config.gistId.trim()) return;

    let cancelled = false;
    const uploadSeasonId = seasonId;
    const timeoutId = window.setTimeout(() => {
      pushToGist(dataRef.current, config, uploadSeasonId).then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        const nextConfig = { token: config.token.trim(), gistId: result.gistId ?? config.gistId.trim() };
        if (nextConfig.token !== config.token.trim() || nextConfig.gistId !== config.gistId.trim()) {
          saveSyncConfig(nextConfig);
          setSyncConfig(nextConfig);
        }
        setMessage("本机数据已自动上传到云端。");
        markSynced();
      });
    }, AUTO_SYNC_UPLOAD_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [data, syncConfig, hydrationRevision, seasonId]);

  function apply(next: AppData) {
    setData(next);
    setMessage("");
  }

  function switchSeason(nextSeasonId: SeasonId) {
    const nextSeason = getSeasonConfig(nextSeasonId);
    if (!nextSeason.isAvailable || nextSeasonId === seasonId) return;

    saveAppData(seasonId, dataRef.current);
    localStorage.setItem(SELECTED_SEASON_KEY, nextSeasonId);
    skipNextSaveRef.current = true;
    skipNextAutoUploadRef.current = true;
    hasHydratedRef.current = false;
    hasTrackedInitialDataRef.current = false;
    preHydrationDirtyRef.current = false;
    setEditing(null);
    setRecording(null);
    setRecordingGift(null);
    setSyncBusy(false);
    setMessage("");
    setSeasonId(nextSeasonId);
    setData(loadAppData(nextSeasonId));
    setHydrationRevision((revision) => revision + 1);
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
    skipNextAutoUploadRef.current = true;
    setSyncConfig(config);
    hasHydratedRef.current = true;
    setMessage("同步配置已保存。本机离线数据仍会继续保存。");
  }

  function markSynced() {
    const timestamp = new Date().toISOString();
    localStorage.setItem(LAST_SYNC_AT_KEY, timestamp);
    setLastSyncAt(timestamp);
  }

  function applyPulledData(cloudData: AppData) {
    const selection = selectHigherTotalData(dataRef.current, cloudData);
    if (selection.source === "cloud") {
      preHydrationDirtyRef.current = false;
      skipNextAutoUploadRef.current = true;
      setData(selection.selected);
      setMessage("云端数据总抓取数更高，已自动更新本机数据。");
      markSynced();
      return;
    }

    setMessage("本机数据总抓取数不低于云端，已保留本机数据。");
    markSynced();
  }

  async function pushSync(config: SyncConfig) {
    setSyncBusy(true);
    const result = await pushToGist(data, config, seasonId);
    setSyncBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    const nextConfig = { token: config.token.trim(), gistId: result.gistId ?? config.gistId.trim() };
    saveSyncConfig(nextConfig);
    skipNextAutoUploadRef.current = true;
    setSyncConfig(nextConfig);
    setMessage("上传成功。已保存 Gist ID。");
    markSynced();
  }

  async function pullSync(config: SyncConfig) {
    const requestedSeasonId = seasonId;
    setSyncBusy(true);
    const result = await pullFromGist(config, requestedSeasonId);
    if (requestedSeasonId !== seasonIdRef.current) return;
    setSyncBusy(false);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    applyPulledData(result.data);
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
    link.download = season.exportFileName;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("导出成功。");
  }

  async function importData(file: File) {
    const requestedSeasonId = seasonId;
    const raw = await file.text();
    if (requestedSeasonId !== seasonIdRef.current) return;
    const result = parseImportedData(raw, requestedSeasonId);
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    apply(result.data);
    setMessage("导入成功。");
  }

  function clearData() {
    if (window.confirm(`确定清空 ${season.label} 的所有数据？此操作不会影响其它赛季，但不可撤销。`)) apply({ version: 3, creatures: [], records: [], giftedRecords: [], currentRound: null, settings: { sortMode: "default" } });
  }

  function resetData() {
    if (window.confirm(`确定将 ${season.label} 重置为默认数据？当前 ${season.label} 记录会被清空，不会影响其它赛季。`)) apply(createDefaultData(seasonId));
  }

  function removeCustomCreature(id: string) {
    if (window.confirm("确定删除这个自定义精灵？相关记录也会被删除。")) apply(removeCreature(data, id));
  }

  return (
    <main className="app" data-theme={theme}>
      <header className="hero">
        <div>
          <p className="eyebrow">{season.eyebrow}</p>
          <h1>{season.title}</h1>
          <p>{season.description}</p>
        </div>
        <div className="heroActions">
          <label className="seasonPicker">赛季
            <select value={seasonId} onChange={(event) => switchSeason(event.target.value as SeasonId)}>
              {getAvailableSeasonIds().map((id) => (
                <option key={id} value={id}>{getSeasonConfig(id).label}</option>
              ))}
            </select>
          </label>
          <label className="themePicker">主题
            <select value={theme} onChange={(event) => setTheme(event.target.value as Theme)}>
              <option value="fantasy">洛克幻想</option>
              <option value="navy">深蓝夜航</option>
              <option value="neon">霓虹赛季</option>
              <option value="forest">森野薄荷</option>
              <option value="sunset">落日橙粉</option>
              <option value="mono">纸白墨黑</option>
            </select>
          </label>
          <button type="button" onClick={() => setEditing("new")}>新增精灵</button>
        </div>
      </header>
      <CurrentRoundPanel data={data} onSetTargets={(ids) => apply(setCurrentRoundTargets(data, ids))} onSetTarget={(id) => apply(setCurrentRoundTarget(data, id))} onStartNew={(ids) => apply(startNewRound(data, ids))} onReset={() => apply(resetCurrentRoundCounts(data))} />
      <HeaderStats stats={calculateStats(data)} />
      {editing && <CreatureEditor key={editing === "new" ? "new" : editing.id} creature={editing === "new" ? null : editing} onSave={saveCreature} onCancel={() => setEditing(null)} />}
      {recording && <div ref={recordDialogRef}><RecordDialog creature={recording} targetCreature={getCurrentRoundTarget(data)} onSave={saveRecord} onCancel={() => setRecording(null)} /></div>}
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
      <DataManager seasonLabel={season.label} message={message} lastSyncAt={lastSyncAt} syncConfig={syncConfig} syncBusy={syncBusy} onSaveSyncConfig={updateSyncConfig} onPushSync={pushSync} onPullSync={pullSync} onDisconnectSync={disconnectSync} onExport={exportData} onImport={importData} onClear={clearData} onReset={resetData} />
      <HistoryList records={data.records} />
      <GiftedHistoryList records={data.giftedRecords} />
    </main>
  );
}
