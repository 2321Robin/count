import { createDefaultData } from "./defaultData";
import { getSeasonConfig } from "./seasons";
import { migrateAppData } from "./migration";
import type { SeasonId } from "./seasons";
import type { AppData } from "./types";

export const S2_STORAGE_KEY = "s2-capture-counter:data";
export const S3_STORAGE_KEY = "s3-capture-counter:data";
export const STORAGE_KEY = S2_STORAGE_KEY;

export function loadAppData(seasonId: SeasonId): AppData {
  try {
    const { storageKey } = getSeasonConfig(seasonId);
    const raw = localStorage.getItem(storageKey);
    if (!raw) return createDefaultData(seasonId);

    const parsed: unknown = JSON.parse(raw);
    return migrateAppData(parsed, seasonId) ?? createDefaultData(seasonId);
  } catch {
    return createDefaultData(seasonId);
  }
}

export function saveAppData(seasonId: SeasonId, data: AppData): void {
  const { storageKey } = getSeasonConfig(seasonId);
  localStorage.setItem(storageKey, JSON.stringify(data));
}
