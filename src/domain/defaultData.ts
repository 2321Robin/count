import type { AppData } from "./types";
import { formatDateTimeInput } from "./dateTime";
import { DEFAULT_SEASON_ID, getSeasonConfig } from "./seasons";
import type { SeasonId } from "./seasons";


export function createDefaultData(seasonId: SeasonId = DEFAULT_SEASON_ID): AppData {
  const season = getSeasonConfig(seasonId);
  return {
    version: 5,
    creatures: season.defaultCreatures.map((creature) => ({
      ...creature,
      currentEncounters: 0,
      totalEncounters: 0,
      isDefault: true,
    })),
    records: [],
    giftedRecords: [],
    fairyTaleBookRecords: [],
    currentRound: null,
    settings: { sortMode: "default" },
    meta: { lastModifiedAt: new Date().toISOString(), lastModifiedBy: "unknown" },
  };
}

export function createCurrentRound(creatureIds: string[]): AppData["currentRound"] {
  return creatureIds.length === 0 ? null : { creatureIds, targetCreatureId: null, updatedAt: formatDateTimeInput() };
}
