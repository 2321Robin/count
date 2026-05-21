import { createDefaultData } from "./defaultData";
import { isAppData } from "./importExport";
import type { AppData } from "./types";

export const STORAGE_KEY = "s2-capture-counter:data";

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultData();

    const parsed: unknown = JSON.parse(raw);
    return isAppData(parsed) ? parsed : createDefaultData();
  } catch {
    return createDefaultData();
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
