import { createDefaultData } from "./defaultData";
import { getSeasonConfig } from "./seasons";
import { migrateAppData } from "./migration";
import type { SeasonId } from "./seasons";
import type { AppData } from "./types";

export const S2_STORAGE_KEY = "s2-capture-counter:data";
export const S3_STORAGE_KEY = "s3-capture-counter:data";
export const STORAGE_KEY = S2_STORAGE_KEY;

export type LoadAppDataResult = { data: AppData; recovered: boolean };

/**
 * 读取赛季数据。JSON 解析失败或迁移失败时，先把原始字符串备份到 `<storageKey>-corrupt`
 * 再返回默认数据并标记 recovered，避免后续保存静默覆写销毁原始数据。
 */
export function seasonStorageKey(seasonId: SeasonId, userId: number | null): string {
  const base = getSeasonConfig(seasonId).storageKey; // "s2-capture-counter:data"
  if (userId === null) return base;
  const prefix = base.slice(0, -":data".length);
  return `${prefix}:${userId}:data`;
}

export function loadAppData(seasonId: SeasonId, userId: number | null = null): LoadAppDataResult {
  const storageKey = seasonStorageKey(seasonId, userId);
  const raw = localStorage.getItem(storageKey);
  if (!raw) return { data: createDefaultData(seasonId), recovered: false };

  try {
    const parsed: unknown = JSON.parse(raw);
    const data = migrateAppData(parsed, seasonId);
    if (!data) {
      backupCorruptData(storageKey, raw);
      return { data: createDefaultData(seasonId), recovered: true };
    }
    return { data, recovered: false };
  } catch {
    backupCorruptData(storageKey, raw);
    return { data: createDefaultData(seasonId), recovered: true };
  }
}

function backupCorruptData(storageKey: string, raw: string): void {
  try {
    localStorage.setItem(`${storageKey}-corrupt`, raw);
  } catch {
    // 备份写入失败不影响回退默认数据的流程。
  }
}

export function saveAppData(seasonId: SeasonId, data: AppData, userId: number | null = null): void {
  localStorage.setItem(seasonStorageKey(seasonId, userId), JSON.stringify(data));
}
