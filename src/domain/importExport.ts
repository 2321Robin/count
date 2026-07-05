import { migrateAppData } from "./migration";
import { DEFAULT_SEASON_ID } from "./seasons";
import type { SeasonId } from "./seasons";
import type { AppData } from "./types";

export type ImportResult = { ok: true; data: AppData } | { ok: false; error: string };

export function parseImportedData(raw: string, seasonId: SeasonId = DEFAULT_SEASON_ID): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "导入文件不是有效的 JSON。" };
  }

  const data = migrateAppData(parsed, seasonId);
  if (!data) {
    return { ok: false, error: "导入数据结构不完整。" };
  }

  return { ok: true, data };
}

export function exportAppData(data: AppData): string {
  return JSON.stringify(data, null, 2);
}
