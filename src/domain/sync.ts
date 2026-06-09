import { migrateAppData } from "./migration";
import type { AppData } from "./types";

const GIST_API_URL = "https://api.github.com/gists";
const GIST_FILE_NAME = "s2-capture-counter.json";
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

export function loadSyncConfig(): SyncConfig {
  return {
    token: localStorage.getItem(TOKEN_STORAGE_KEY) ?? "",
    gistId: localStorage.getItem(GIST_ID_STORAGE_KEY) ?? "",
  };
}

export function saveSyncConfig(config: SyncConfig): void {
  const token = config.token.trim();
  const gistId = config.gistId.trim();

  if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else localStorage.removeItem(TOKEN_STORAGE_KEY);

  if (gistId) localStorage.setItem(GIST_ID_STORAGE_KEY, gistId);
  else localStorage.removeItem(GIST_ID_STORAGE_KEY);
}

export function clearSyncConfig(): void {
  localStorage.removeItem(TOKEN_STORAGE_KEY);
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

async function parseGistData(response: Response): Promise<AppData | null> {
  const payload = await response.json() as { files?: Record<string, { content?: string }> };
  const content = payload.files?.[GIST_FILE_NAME]?.content;
  if (typeof content !== "string") return null;
  try {
    return migrateAppData(JSON.parse(content));
  } catch {
    return null;
  }
}

export type PushSyncResult = { ok: true; gistId: string } | { ok: false; error: string };

export async function pullFromGist(config: SyncConfig): Promise<SyncResult> {
  const token = config.token.trim();
  const gistId = config.gistId.trim();
  if (!token || !gistId) return { ok: false, error: "请先填写 GitHub Token 和 Gist ID。" };

  try {
    const response = await fetch(`${GIST_API_URL}/${gistId}`, { headers: authHeaders(token) });
    if (!response.ok) return { ok: false, error: syncError("拉取", response.status) };

    const data = await parseGistData(response);
    if (!data) return { ok: false, error: "拉取失败：Gist 中没有有效的计数器数据。" };
    return { ok: true, data };
  } catch {
    return { ok: false, error: "拉取失败：无法连接 GitHub。" };
  }
}

export async function pushToGist(data: AppData, config: SyncConfig): Promise<PushSyncResult> {
  const token = config.token.trim();
  const gistId = config.gistId.trim();
  if (!token) return { ok: false, error: "请先填写 GitHub Token。" };

  const body = JSON.stringify({
    description: "S2 capture counter backup",
    public: false,
    files: {
      [GIST_FILE_NAME]: {
        content: JSON.stringify(data, null, 2),
      },
    },
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
