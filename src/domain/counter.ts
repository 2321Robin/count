import { formatDateTimeInput, normalizeRecordDate } from "./dateTime";
import type {
  AppData,
  AppStats,
  Creature,
  CreatureInput,
  GiftedRecordInput,
  RecordInput,
  RoundEncounterSnapshot,
} from "./types";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function createRound(creatureIds: string[]): AppData["currentRound"] {
  return creatureIds.length === 0 ? null : { creatureIds, updatedAt: formatDateTimeInput() };
}

function uniqueExistingCreatureIds(data: AppData, creatureIds: string[]): string[] {
  const existingIds = new Set(data.creatures.map((creature) => creature.id));
  const seenIds = new Set<string>();
  const result: string[] = [];

  for (const creatureId of creatureIds) {
    if (!existingIds.has(creatureId) || seenIds.has(creatureId)) continue;
    seenIds.add(creatureId);
    result.push(creatureId);
  }

  return result;
}

function currentRoundCreatureIds(data: AppData): string[] {
  const configuredIds = uniqueExistingCreatureIds(data, data.currentRound?.creatureIds ?? []);
  if (configuredIds.length > 0) return configuredIds;
  return data.creatures.filter((creature) => creature.currentEncounters > 0).map((creature) => creature.id);
}

function recordRoundCreatureIds(data: AppData, creatureId: string): string[] {
  const configuredIds = currentRoundCreatureIds(data);
  return configuredIds.includes(creatureId) ? configuredIds : uniqueExistingCreatureIds(data, [creatureId]);
}

function updateCreatureById(data: AppData, creatureId: string, updater: (creature: Creature) => Creature): AppData {
  return {
    ...data,
    creatures: data.creatures.map((creature) => (creature.id === creatureId ? updater(creature) : creature)),
  };
}

export function getCurrentRoundTotal(data: AppData): number {
  const ids = new Set(currentRoundCreatureIds(data));
  return data.creatures.reduce((sum, creature) => sum + (ids.has(creature.id) ? creature.currentEncounters : 0), 0);
}

export function getCurrentRoundBreakdown(data: AppData, creatureId?: string): RoundEncounterSnapshot[] {
  const ids = creatureId ? recordRoundCreatureIds(data, creatureId) : currentRoundCreatureIds(data);
  const byId = new Map(data.creatures.map((creature) => [creature.id, creature]));

  return ids.map((id) => {
    const creature = byId.get(id)!;
    return {
      creatureId: creature.id,
      creatureName: creature.name,
      encounters: creature.currentEncounters,
    };
  });
}

export function setCurrentRoundTargets(data: AppData, creatureIds: string[]): AppData {
  const ids = uniqueExistingCreatureIds(data, creatureIds);
  return { ...data, currentRound: createRound(ids) };
}

export function startNewRound(data: AppData, creatureIds: string[]): AppData {
  const ids = uniqueExistingCreatureIds(data, creatureIds);
  return {
    ...data,
    currentRound: createRound(ids),
    creatures: data.creatures.map((creature) => ({ ...creature, currentEncounters: 0 })),
  };
}

export function resetCurrentRoundCounts(data: AppData): AppData {
  const ids = new Set(currentRoundCreatureIds(data));
  if (ids.size === 0) return data;

  return {
    ...data,
    currentRound: createRound([...ids]),
    creatures: data.creatures.map((creature) => (ids.has(creature.id) ? { ...creature, currentEncounters: 0 } : creature)),
  };
}

export function incrementEncounter(data: AppData, creatureId: string): AppData {
  if (!data.creatures.some((creature) => creature.id === creatureId)) return data;
  const currentIds = currentRoundCreatureIds(data);
  const nextRoundIds = currentIds.includes(creatureId) ? currentIds : [...currentIds, creatureId];

  return {
    ...updateCreatureById(data, creatureId, (creature) => ({
      ...creature,
      currentEncounters: creature.currentEncounters + 1,
      totalEncounters: creature.totalEncounters + 1,
    })),
    currentRound: createRound(nextRoundIds),
  };
}

export function decrementEncounter(data: AppData, creatureId: string): AppData {
  return updateCreatureById(data, creatureId, (creature) =>
    creature.currentEncounters === 0
      ? creature
      : {
          ...creature,
          currentEncounters: creature.currentEncounters - 1,
          totalEncounters: Math.max(0, creature.totalEncounters - 1),
        },
  );
}

export function recordAcquisition(data: AppData, creatureId: string, input: RecordInput): AppData {
  const creature = data.creatures.find((item) => item.id === creatureId);
  if (!creature) return data;

  const roundBreakdown = getCurrentRoundBreakdown(data, creatureId);
  const roundCreatureIds = new Set(roundBreakdown.map((item) => item.creatureId));
  const acquisitionNumber = data.records.filter((record) => record.creatureId === creatureId).length + 1;

  return {
    ...data,
    currentRound: createRound([...roundCreatureIds]),
    creatures: data.creatures.map((item) =>
      roundCreatureIds.has(item.id) ? { ...item, currentEncounters: 0 } : item,
    ),
    records: [
      {
        id: createId("record"),
        creatureId,
        creatureName: creature.name,
        date: normalizeRecordDate(input.date),
        acquisitionNumber,
        roundEncounters: roundBreakdown.reduce((sum, item) => sum + item.encounters, 0),
        roundBreakdown,
        totalEncountersAtRecord: creature.totalEncounters,
        location: input.location,
        notes: input.notes,
      },
      ...data.records,
    ],
  };
}

export function recordGiftedCapture(data: AppData, input: GiftedRecordInput): AppData {
  const creature = data.creatures.find((item) => item.id === input.creatureId);
  if (!creature) return data;

  return {
    ...data,
    giftedRecords: [
      {
        id: createId("gift"),
        creatureId: creature.id,
        creatureName: creature.name,
        receivedAt: normalizeRecordDate(input.date),
        giftedBy: input.giftedBy,
        notes: input.notes,
      },
      ...data.giftedRecords,
    ],
  };
}

export function addCreature(data: AppData, input: CreatureInput): AppData {
  return {
    ...data,
    creatures: [
      ...data.creatures,
      {
        id: createId("creature"),
        name: input.name,
        targetCount: input.targetCount,
        currentEncounters: 0,
        totalEncounters: 0,
        location: input.location,
        notes: input.notes,
        isDefault: false,
      },
    ],
  };
}

export function updateCreature(data: AppData, creatureId: string, input: CreatureInput): AppData {
  return updateCreatureById(data, creatureId, (creature) => ({ ...creature, ...input }));
}

export function removeCreature(data: AppData, creatureId: string): AppData {
  const nextRoundIds = uniqueExistingCreatureIds(data, data.currentRound?.creatureIds.filter((id) => id !== creatureId) ?? []);
  return {
    ...data,
    currentRound: createRound(nextRoundIds),
    creatures: data.creatures.filter((creature) => creature.id !== creatureId),
    records: data.records.filter((record) => record.creatureId !== creatureId),
    giftedRecords: data.giftedRecords.filter((record) => record.creatureId !== creatureId),
  };
}

export function calculateStats(data: AppData): AppStats {
  return {
    creatureCount: data.creatures.length,
    currentRoundTotal: getCurrentRoundTotal(data),
    historicalTotal: data.creatures.reduce((sum, creature) => sum + creature.totalEncounters, 0),
    recordCount: data.records.length,
    giftedRecordCount: data.giftedRecords.length,
  };
}
