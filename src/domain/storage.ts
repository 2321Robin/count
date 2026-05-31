import { createDefaultData } from "./defaultData";
import { migrateAppData } from "./migration";
import type { AppData } from "./types";

export const STORAGE_KEY = "s2-capture-counter:data";

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultData();

    const parsed: unknown = JSON.parse(raw);
    return migrateAppData(parsed) ?? createDefaultData();
  } catch {
    return createDefaultData();
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
