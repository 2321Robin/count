import { migrateAppData } from "./migration";
import { DEFAULT_SEASON_ID, getSeasonConfig } from "./seasons";
import type { SeasonId } from "./seasons";
import type { AppData } from "./types";

const GIST_API_URL = "https://api.github.com/gists";
const TOKEN_STORAGE_KEY = "s2-capture-counter:github-token";
const GIST_ID_STORAGE_KEY = "s2-capture-counter:gist-id";

export type SyncConfig = {
  token: string;
  gistId: string;
};

export type SyncResult = { ok: true; data: AppData; gistId?: string } | { ok: false; error: string };

export type SyncDataSource = "local" | "cloud" | "equal";

export type SyncDataSelection = {
  selected: AppData;
  source: SyncDataSource;
  localTotal: number;
  cloudTotal: number;
};

function totalEncounters(data: AppData): number {
  return data.creatures.reduce((sum, creature) => sum + creature.totalEncounters, 0);
}

export function selectHigherTotalData(localData: AppData, cloudData: AppData): SyncDataSelection {
  const localTotal = totalEncounters(localData);
  const cloudTotal = totalEncounters(cloudData);

  if (cloudTotal > localTotal) return { selected: cloudData, source: "cloud", localTotal, cloudTotal };
  if (localTotal > cloudTotal) return { selected: localData, source: "local", localTotal, cloudTotal };
  return { selected: localData, source: "equal", localTotal, cloudTotal };
}

/**
 * 按 id 合并本地与云端数据：两端共有的精灵计数取大，云端独有内容追加到本地末尾。
 * 两端各自满足 currentEncounters <= totalEncounters，逐字段取最大值后不变式依然成立。
 */
export function mergeAppData(localData: AppData, cloudData: AppData): AppData {
  // creatures：按 id 并集；两端都有的精灵 totalEncounters / currentEncounters 取最大值，
  // 其余字段（name、targetCount、location、notes、isDefault、category）保留本地值。
  const cloudById = new Map(cloudData.creatures.map((creature) => [creature.id, creature]));
  const localIds = new Set(localData.creatures.map((creature) => creature.id));
  const mergedCreatures = localData.creatures.map((localCreature) => {
    const cloudCreature = cloudById.get(localCreature.id);
    if (!cloudCreature) return localCreature;
    return {
      ...localCreature,
      totalEncounters: Math.max(localCreature.totalEncounters, cloudCreature.totalEncounters),
      currentEncounters: Math.max(localCreature.currentEncounters, cloudCreature.currentEncounters),
    };
  });
  // 仅云端有的精灵追加到本地列表末尾，保持本地顺序。
  for (const cloudCreature of cloudData.creatures) {
    if (!localIds.has(cloudCreature.id)) mergedCreatures.push(cloudCreature);
  }

  // 记录类：按 id 去重并集，保持本地顺序，云端独有记录追加到末尾。
  const mergeById = <T extends { id: string }>(localItems: T[], cloudItems: T[]): T[] => {
    const localItemIds = new Set(localItems.map((item) => item.id));
    return [...localItems, ...cloudItems.filter((item) => !localItemIds.has(item.id))];
  };

  return {
    ...localData, // currentRound、settings 取本地；version 保持 4
    creatures: mergedCreatures,
    records: mergeById(localData.records, cloudData.records),
    giftedRecords: mergeById(localData.giftedRecords, cloudData.giftedRecords),
    fairyTaleBookRecords: mergeById(localData.fairyTaleBookRecords, cloudData.fairyTaleBookRecords),
  };
}

export function loadSyncConfig(): SyncConfig {
  return {
    // Token 只保留在当前浏览器会话内，降低脚本注入与中间人窃取风险。
    token: sessionStorage.getItem(TOKEN_STORAGE_KEY) ?? "",
    gistId: localStorage.getItem(GIST_ID_STORAGE_KEY) ?? "",
  };
}

export function saveSyncConfig(config: SyncConfig): void {
  const token = config.token.trim();
  const gistId = config.gistId.trim();

  if (token) sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
  else sessionStorage.removeItem(TOKEN_STORAGE_KEY);

  if (gistId) localStorage.setItem(GIST_ID_STORAGE_KEY, gistId);
  else localStorage.removeItem(GIST_ID_STORAGE_KEY);
}

export function clearSyncConfig(): void {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  localStorage.removeItem(GIST_ID_STORAGE_KEY);
}

function authHeaders(token: string): HeadersInit {
  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

function syncError(prefix: string, status: number): string {
  if (status === 401 || status === 403) return `${prefix}失败：GitHub Token 无效或没有 gist 权限。`;
  if (status === 404) return `${prefix}失败：找不到这个 Gist。`;
  return `${prefix}失败：GitHub 返回 ${status}。`;
}

async function parseGistData(response: Response, seasonId: SeasonId): Promise<AppData | null> {
  const payload = await response.json() as { files?: Record<string, { content?: string }> };
  const { syncFileName } = getSeasonConfig(seasonId);
  const content = payload.files?.[syncFileName]?.content;
  if (typeof content !== "string") return null;
  try {
    return migrateAppData(JSON.parse(content), seasonId);
  } catch {
    return null;
  }
}

export type PushSyncResult = { ok: true; gistId: string } | { ok: false; error: string };

export async function pullFromGist(config: SyncConfig, seasonId: SeasonId = DEFAULT_SEASON_ID): Promise<SyncResult> {
  const token = config.token.trim();
  const gistId = config.gistId.trim();
  if (!token || !gistId) return { ok: false, error: "请先填写 GitHub Token 和 Gist ID。" };

  try {
    const response = await fetch(`${GIST_API_URL}/${gistId}`, { headers: authHeaders(token) });
    if (!response.ok) return { ok: false, error: syncError("拉取", response.status) };

    const data = await parseGistData(response, seasonId);
    if (!data) return { ok: false, error: "拉取失败：Gist 中没有有效的计数器数据。" };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "拉取失败：无法连接 GitHub。" };
  }
}

export async function pushToGist(data: AppData, config: SyncConfig, seasonId: SeasonId = DEFAULT_SEASON_ID): Promise<PushSyncResult> {
  const token = config.token.trim();
  const gistId = config.gistId.trim();
  if (!token) return { ok: false, error: "请先填写 GitHub Token。" };
  const { label, syncFileName } = getSeasonConfig(seasonId);

  // gist 已存在时先预拉取云端当前赛季文件，按 id 合并后再上传，避免整文件覆盖丢失云端独有记录。
  let uploadContent = JSON.stringify(data, null, 2);
  if (gistId) {
    try {
      const cloudResponse = await fetch(`${GIST_API_URL}/${gistId}`, { headers: authHeaders(token) });
      if (cloudResponse.ok) {
        const cloudData = await parseGistData(cloudResponse, seasonId);
        if (cloudData) uploadContent = JSON.stringify(mergeAppData(data, cloudData), null, 2);
      }
    } catch {
      // 预拉取失败（网络错误、非 2xx、解析失败）静默降级为直接上传本地数据。
    }
  }

  const body = JSON.stringify({
    description: `${label} capture counter backup`,
    public: false,
    files: {
      [syncFileName]: {
        content: uploadContent,
      },
    }
  });

  try {
    const response = await fetch(gistId ? `${GIST_API_URL}/${gistId}` : GIST_API_URL, {
      method: gistId ? "PATCH" : "POST",
      headers: authHeaders(token),
      body,
    });
    if (!response.ok) return { ok: false, error: syncError("上传", response.status) };

    const payload = await response.json() as { id?: string };
    return { ok: true, gistId: typeof payload.id === "string" ? payload.id : gistId };
  } catch {
    return { ok: false, error: "上传失败：无法连接 GitHub。" };
  }
}
