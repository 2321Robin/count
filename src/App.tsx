import { useEffect, useRef, useState } from "react";
import { CreatureEditor } from "./components/CreatureEditor";
import { CreatureGrid } from "./components/CreatureGrid";
import { CurrentRoundPanel } from "./components/CurrentRoundPanel";
import { DataManager } from "./components/DataManager";
import { FairyTaleBookDialog } from "./components/FairyTaleBookDialog";
import { HeaderStats } from "./components/HeaderStats";
import { GiftedHistoryList } from "./components/GiftedHistoryList";
import { GiftedRecordDialog } from "./components/GiftedRecordDialog";
import { HistoryList } from "./components/HistoryList";
import { LoginDialog } from "./components/LoginDialog";
import { MigrationWizard } from "./components/MigrationWizard";
import { RecordDialog } from "./components/RecordDialog";
import { addCreature, calculateStats, decrementEncounter, getCurrentRoundTarget, incrementEncounter, recordAcquisition, recordFairyTaleBook, recordGiftedCapture, removeCreature, resetCurrentRoundCounts, setCurrentRoundTarget, setCurrentRoundTargets, startNewRound, updateCreature } from "./domain/counter";
import { createDefaultData } from "./domain/defaultData";
import { formatMetaStamp } from "./domain/dateTime";
import { detectDeviceKind } from "./domain/device";
import { exportAppData, parseImportedData } from "./domain/importExport";
import { DEFAULT_SEASON_ID, getAvailableSeasonIds, getSeasonConfig, isSeasonId, SELECTED_SEASON_KEY } from "./domain/seasons";
import type { SeasonId } from "./domain/seasons";
import {
  adminResetPassword,
  clearSession,
  fetchMe,
  loadSession,
  loadLastServerUpdatedAt,
  loginAccount,
  logoutAccount,
  pullFromServer,
  pushToServer,
  registerAccount,
  saveLastServerUpdatedAt,
  saveSession,
} from "./domain/serverSync";
import type { MigrationState, Session } from "./domain/serverSync";
import { loadAppData, saveAppData, seasonStorageKey } from "./domain/storage";
import { clearSyncConfig, loadSyncConfig, pullFromGist, pushToGist, saveSyncConfig, selectHigherTotalData } from "./domain/sync";
import type { SyncConfig } from "./domain/sync";
import type { AppData, Creature, CreatureInput, FairyTaleBookRecordInput, GiftedRecordInput, RecordInput } from "./domain/types";

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
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [loginOpen, setLoginOpen] = useState(false);
  const [migration, setMigration] = useState<MigrationState | null>(null);
  const wizardPromptedRef = useRef(false);
  const accountPanelRef = useRef<HTMLDivElement>(null);
  const [initialLoad] = useState(() => loadAppData(seasonId, session?.userId ?? null));
  const [data, setData] = useState<AppData>(initialLoad.data);
  const [theme, setTheme] = useState<Theme>(() => loadTheme());
  const [editing, setEditing] = useState<Creature | null | "new">(null);
  const [recording, setRecording] = useState<Creature | null>(null);
  const [recordingGift, setRecordingGift] = useState<Creature | null>(null);
  const [recordingFairyTaleBook, setRecordingFairyTaleBook] = useState(false);
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
    saveAppData(seasonId, data, session?.userId ?? null);
  }, [seasonId, data, session]);
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
    if (loginOpen) accountPanelRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  }, [loginOpen]);

  useEffect(() => {
    if (!session) {
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
    }

    let cancelled = false;
    setSyncBusy(true);
    pullFromServer(seasonId).then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        if (result.error === "拉取失败：登录已过期，请重新登录。") {
          restoreAnonymousView("登录已过期，已退回本地模式。");
          return;
        }
        setMessage(result.error);
        hasHydratedRef.current = true;
        if (preHydrationDirtyRef.current) setHydrationRevision((revision) => revision + 1);
        return;
      }
      const anonymousData = loadAppData(seasonId).data;
      const hasRealAnonymousData = JSON.stringify(anonymousData) !== JSON.stringify(createDefaultData(seasonId));
      const accountLoad = loadAppData(seasonId, session.userId);
      const accountHasData = !accountLoad.recovered && JSON.stringify(accountLoad.data) !== JSON.stringify(createDefaultData(seasonId));
      if (result.empty) {
        if (hasRealAnonymousData && !accountHasData && !wizardPromptedRef.current) {
          wizardPromptedRef.current = true;
          setMigration({ kind: "upload-local" });
          return; // 等迁移向导决定后再完成水合
        }
      } else if (hasRealAnonymousData && !accountHasData && !wizardPromptedRef.current) {
        wizardPromptedRef.current = true;
        setMigration({
          kind: "choose",
          cloudUpdatedAt: result.updatedAt,
          localModifiedAt: anonymousData.meta.lastModifiedAt,
        });
        return;
      } else {
        const last = loadLastServerUpdatedAt(seasonId, session.userId);
        if (last === null || result.updatedAt > last) {
          skipNextAutoUploadRef.current = true;
          setData(result.data);
          saveLastServerUpdatedAt(seasonId, session.userId, result.updatedAt);
          markSynced();
          setMessage("已同步云端数据。");
        }
      }
      hasHydratedRef.current = true;
      if (preHydrationDirtyRef.current) setHydrationRevision((revision) => revision + 1);
    }).finally(() => {
      if (!cancelled) setSyncBusy(false);
    });

    return () => {
      cancelled = true;
    };
  }, [seasonId, session]);

  useEffect(() => {
    if (skipNextAutoUploadRef.current) {
      skipNextAutoUploadRef.current = false;
      return;
    }
    if (!hasHydratedRef.current) return;
    if (!session && (!syncConfig.token.trim() || !syncConfig.gistId.trim())) return;

    let cancelled = false;
    const uploadSeasonId = seasonId;
    const timeoutId = window.setTimeout(() => {
      if (session) {
        pushToServer(dataRef.current, uploadSeasonId).then((result) => {
          if (cancelled) return;
          if (!result.ok) {
            if (result.error === "上传失败：登录已过期，请重新登录。") {
              restoreAnonymousView("登录已过期，已退回本地模式。");
              return;
            }
            setMessage(result.error);
            return;
          }
          saveLastServerUpdatedAt(uploadSeasonId, session.userId, result.updatedAt);
          setMessage("本机数据已自动上传到云端。");
          markSynced();
        });
      } else {
        const config = syncConfig;
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
      }
    }, AUTO_SYNC_UPLOAD_DELAY_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [data, syncConfig, hydrationRevision, seasonId, session]);

  function apply(next: AppData) {
    // 所有用户修改（+1/-1、记录、编辑、导入、清空、重置）统一在此打点；
    // 拉取云端/水合/切赛季走 setData，不经过这里，因此不会覆盖云端或本地已有的 meta。
    setData({ ...next, meta: { lastModifiedAt: new Date().toISOString(), lastModifiedBy: detectDeviceKind() } });
    setMessage("");
  }

  // 挂载时若检测到本机数据损坏，提示用户已备份并恢复默认。
  useEffect(() => {
    if (initialLoad.recovered) {
      setMessage("检测到本机数据损坏，已恢复默认数据；原始数据已备份到 " + getSeasonConfig(seasonId).storageKey + "-corrupt。");
    }
  }, []);

  // 会话恢复校验：本地有会话时向服务器确认，失效则退回匿名视图。
  useEffect(() => {
    if (!loadSession()) return;
    let cancelled = false;
    fetchMe().then((me) => {
      if (cancelled) return;
      if (me) {
        setSession(me);
      } else {
        restoreAnonymousView();
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function switchSeason(nextSeasonId: SeasonId) {
    const nextSeason = getSeasonConfig(nextSeasonId);
    if (!nextSeason.isAvailable || nextSeasonId === seasonId) return;

    saveAppData(seasonId, dataRef.current, session?.userId ?? null);
    localStorage.setItem(SELECTED_SEASON_KEY, nextSeasonId);
    skipNextSaveRef.current = true;
    skipNextAutoUploadRef.current = true;
    hasHydratedRef.current = false;
    hasTrackedInitialDataRef.current = false;
    preHydrationDirtyRef.current = false;
    setEditing(null);
    setRecording(null);
    setRecordingGift(null);
    setRecordingFairyTaleBook(false);
    setSyncBusy(false);
    setMessage("");
    setSeasonId(nextSeasonId);
    const result = loadAppData(nextSeasonId, session?.userId ?? null);
    setData(result.data);
    if (result.recovered) {
      setMessage("检测到本机数据损坏，已恢复默认数据；原始数据已备份到 " + seasonStorageKey(nextSeasonId, session?.userId ?? null) + "-corrupt。");
    }
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

  function saveFairyTaleBookRecord(input: FairyTaleBookRecordInput) {
    apply(recordFairyTaleBook(data, input));
    setRecordingFairyTaleBook(false);
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

  function restoreAnonymousView(messageText?: string) {
    clearSession();
    skipNextSaveRef.current = true;
    skipNextAutoUploadRef.current = true;
    hasHydratedRef.current = false;
    preHydrationDirtyRef.current = false;
    wizardPromptedRef.current = false;
    setMigration(null);
    setLoginOpen(false);
    const result = loadAppData(seasonId);
    setData(result.data);
    if (result.recovered) {
      setMessage("检测到本机数据损坏，已恢复默认数据；原始数据已备份到 " + getSeasonConfig(seasonId).storageKey + "-corrupt。");
    } else if (messageText) {
      setMessage(messageText);
    }
    setSession(null);
    setHydrationRevision((revision) => revision + 1);
  }

  function handleLoggedIn(user: Session) {
    saveSession(user);
    skipNextSaveRef.current = true;
    skipNextAutoUploadRef.current = true;
    hasHydratedRef.current = false;
    preHydrationDirtyRef.current = false;
    wizardPromptedRef.current = false;
    setMigration(null);
    setSession(user);
    setHydrationRevision((revision) => revision + 1);
  }

  async function handleLogout() {
    setSyncBusy(true);
    try {
      await logoutAccount();
    } finally {
      restoreAnonymousView("已退出登录。本机匿名数据保持不变。");
      setSyncBusy(false);
    }
  }

  async function finishMigration(choice: "upload-local" | "discard-local" | "use-cloud" | "use-local") {
    const currentSession = session;
    if (!currentSession) return;
    setSyncBusy(true);
    try {
      if (choice === "upload-local" || choice === "use-local") {
        const localData = dataRef.current; // 向导展示期间 data 即匿名数据（水合在向导路径未覆盖云端），dataRef 含向导期间的编辑
        const push = await pushToServer(localData, seasonId);
        if (!push.ok) {
          setMessage(push.error);
          return;
        }
        saveLastServerUpdatedAt(seasonId, currentSession.userId, push.updatedAt);
        saveAppData(seasonId, localData, currentSession.userId); // 立即写入账号命名空间缓存，避免刷新后回退为空数据
      }
      if (choice === "use-cloud") {
        const pull = await pullFromServer(seasonId);
        if (pull.ok && !pull.empty) {
          setData(pull.data);
          saveAppData(seasonId, pull.data, currentSession.userId); // 写入账号命名空间缓存，避免刷新后回退为空数据
          saveLastServerUpdatedAt(seasonId, currentSession.userId, pull.updatedAt);
        } else if (!pull.ok) {
          setMessage(pull.error);
          return;
        }
      }
      if (choice === "discard-local") {
        setData(createDefaultData(seasonId));
      }
      skipNextSaveRef.current = true;
      skipNextAutoUploadRef.current = true;
      wizardPromptedRef.current = true;
      setMigration(null);
      hasHydratedRef.current = true;
      setMessage(
        choice === "upload-local" || choice === "use-local" ? "已把本机数据上传到账号。" :
        choice === "use-cloud" ? "已采用云端数据。" : "账号已从空数据开始。"
      );
      setHydrationRevision((revision) => revision + 1);
    } finally {
      setSyncBusy(false);
    }
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

    // 等值但内容不同：不再静默，提示用户下次本机上传会自动合并两端记录。
    if (selection.source === "equal" && JSON.stringify(selection.selected) !== JSON.stringify(cloudData)) {
      setMessage("云端与本机总抓取数相同但内容不同，已保留本机数据；下次本机上传会自动合并两端记录。");
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
    if (window.confirm(`确定清空 ${season.label} 的所有数据？此操作不会影响其它赛季，但不可撤销。`)) apply({ version: 5, creatures: [], records: [], giftedRecords: [], fairyTaleBookRecords: [], currentRound: null, settings: { sortMode: "default" }, meta: { lastModifiedAt: new Date().toISOString(), lastModifiedBy: "unknown" } });
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
          <p className="lastModified">上次修改：{formatMetaStamp(data.meta.lastModifiedAt, data.meta.lastModifiedBy)}</p>
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
          <button type="button" onClick={() => setLoginOpen((open) => !open)}>{session ? session.username : "登录 / 注册"}</button>
        </div>
      </header>
      <CurrentRoundPanel data={data} onSetTargets={(ids) => apply(setCurrentRoundTargets(data, ids))} onSetTarget={(id) => apply(setCurrentRoundTarget(data, id))} onStartNew={(ids) => apply(startNewRound(data, ids))} onReset={() => apply(resetCurrentRoundCounts(data))} onRecordFairyTaleBook={() => setRecordingFairyTaleBook(true)} isS3Season={seasonId === "s3"} />
      <HeaderStats stats={calculateStats(data)} />
      {editing && <CreatureEditor key={editing === "new" ? "new" : editing.id} creature={editing === "new" ? null : editing} onSave={saveCreature} onCancel={() => setEditing(null)} />}
      {recording && <div ref={recordDialogRef}><RecordDialog creature={recording} targetCreature={getCurrentRoundTarget(data)} onSave={saveRecord} onCancel={() => setRecording(null)} /></div>}
      {recordingGift && <div ref={giftedRecordDialogRef}><GiftedRecordDialog creatures={data.creatures} initialCreatureId={recordingGift.id} onSave={saveGiftedRecord} onCancel={() => setRecordingGift(null)} /></div>}
      {recordingFairyTaleBook && <FairyTaleBookDialog onSave={saveFairyTaleBookRecord} onCancel={() => setRecordingFairyTaleBook(false)} />}
      <CreatureGrid
        creatures={data.creatures}
        onIncrement={(id) => apply(incrementEncounter(data, id))}
        onDecrement={(id) => apply(decrementEncounter(data, id))}
        onEdit={setEditing}
        onRecord={openRecordDialog}
        onRecordGift={openGiftedRecordDialog}
        onRemove={removeCustomCreature}
      />
      <DataManager
        seasonLabel={season.label}
        message={message}
        lastSyncAt={lastSyncAt}
        syncConfig={syncConfig}
        syncBusy={syncBusy}
        session={session}
        onLoginClick={() => setLoginOpen(true)}
        onSaveSyncConfig={updateSyncConfig}
        onPushSync={pushSync}
        onPullSync={pullSync}
        onDisconnectSync={disconnectSync}
        onExport={exportData}
        onImport={importData}
        onClear={clearData}
        onReset={resetData}
      />
      {loginOpen && (
        <div ref={accountPanelRef}>
          <LoginDialog
            session={session}
            busy={syncBusy}
            onLogin={async (username, password) => {
              const result = await loginAccount(username, password);
              if (result.ok) handleLoggedIn(result.session);
              return result.ok ? null : result.error;
            }}
            onRegister={async (username, password) => {
              const result = await registerAccount(username, password);
              if (result.ok) handleLoggedIn(result.session);
              return result.ok ? null : result.error;
            }}
            onLogout={handleLogout}
            onResetPassword={async (username, newPassword) => {
              const result = await adminResetPassword(username, newPassword);
              return result.ok ? null : result.error;
            }}
          />
        </div>
      )}
      {migration && (
        <MigrationWizard state={migration} seasonLabel={season.label} busy={syncBusy} onChoice={(choice) => { void finishMigration(choice); }} />
      )}
      <HistoryList records={data.records} fairyTaleBookRecords={data.fairyTaleBookRecords} />
      <GiftedHistoryList records={data.giftedRecords} />
    </main>
  );
}
