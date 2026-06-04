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

function createRound(data: AppData, creatureIds: string[], targetCreatureId = data.currentRound?.targetCreatureId ?? null, keepEmpty = false): AppData["currentRound"] {
  const ids = uniqueExistingCreatureIds(data, creatureIds).filter((id) => data.creatures.some((creature) => creature.id === id && creature.currentEncounters > 0));
  const targetId = targetCreatureId && data.creatures.some((creature) => creature.id === targetCreatureId) ? targetCreatureId : null;
  return ids.length === 0 && !targetId && !keepEmpty ? null : { creatureIds: ids, targetCreatureId: targetId, updatedAt: formatDateTimeInput() };
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
  const configuredIds = uniqueExistingCreatureIds(data, data.currentRound?.creatureIds ?? []).filter((id) => data.creatures.some((creature) => creature.id === id && creature.currentEncounters > 0));
  if (data.currentRound) return configuredIds;
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
  return ids.flatMap((id) => {
    const creature = byId.get(id)!;
    return creature.currentEncounters > 0 ? [{
      creatureId: creature.id,
      creatureName: creature.name,
      encounters: creature.currentEncounters,
    }] : [];
  });
}

export function setCurrentRoundTargets(data: AppData, creatureIds: string[], targetCreatureId = data.currentRound?.targetCreatureId ?? null): AppData {
  return { ...data, currentRound: createRound(data, creatureIds, targetCreatureId, true) };
}

export function getCurrentRoundTarget(data: AppData): Creature | null {
  const targetCreatureId = data.currentRound?.targetCreatureId;
  return targetCreatureId ? data.creatures.find((creature) => creature.id === targetCreatureId) ?? null : null;
}

export function setCurrentRoundTarget(data: AppData, targetCreatureId: string | null): AppData {
  return { ...data, currentRound: createRound(data, currentRoundCreatureIds(data), targetCreatureId, true) };
}

export function startNewRound(data: AppData, creatureIds: string[], targetCreatureId = data.currentRound?.targetCreatureId ?? null): AppData {
  const resetData = {
    ...data,
    creatures: data.creatures.map((creature) => ({ ...creature, currentEncounters: 0 })),
  };
  return { ...resetData, currentRound: createRound(resetData, creatureIds, targetCreatureId, true) };
}

export function resetCurrentRoundCounts(data: AppData): AppData {
  const ids = new Set(currentRoundCreatureIds(data));
  if (ids.size === 0) return data;

  const resetData = {
    ...data,
    creatures: data.creatures.map((creature) => (ids.has(creature.id) ? { ...creature, currentEncounters: 0 } : creature)),
  };
  return { ...resetData, currentRound: createRound(resetData, [...ids], undefined, true) };
}

export function incrementEncounter(data: AppData, creatureId: string): AppData {
  if (!data.creatures.some((creature) => creature.id === creatureId)) return data;
  const currentIds = currentRoundCreatureIds(data);
  const nextRoundIds = currentIds.includes(creatureId) ? currentIds : [...currentIds, creatureId];
  const nextData = updateCreatureById(data, creatureId, (creature) => ({
    ...creature,
    currentEncounters: creature.currentEncounters + 1,
    totalEncounters: creature.totalEncounters + 1,
  }));

  return { ...nextData, currentRound: createRound(nextData, nextRoundIds, undefined, Boolean(data.currentRound)) };
}

export function decrementEncounter(data: AppData, creatureId: string): AppData {
  const creature = data.creatures.find((item) => item.id === creatureId);
  if (!creature) return data;
  const currentIds = currentRoundCreatureIds(data);
  const nextData = creature.currentEncounters === 0
    ? data
    : updateCreatureById(data, creatureId, (item) => ({
        ...item,
        currentEncounters: item.currentEncounters - 1,
        totalEncounters: Math.max(0, item.totalEncounters - 1),
      }));

  return { ...nextData, currentRound: createRound(nextData, currentIds, undefined, Boolean(data.currentRound)) };
}

export function recordAcquisition(data: AppData, creatureId: string, input: RecordInput): AppData {
  const creature = data.creatures.find((item) => item.id === creatureId);
  if (!creature) return data;

  const targetCreature = getCurrentRoundTarget(data) ?? creature;
  const requestedOffTarget = input.isOffTarget ?? targetCreature.id !== creatureId;
  const isOffTarget = requestedOffTarget && targetCreature.id !== creatureId;
  const roundBreakdown = getCurrentRoundBreakdown(data, isOffTarget ? targetCreature.id : creatureId);
  const roundCreatureIds = new Set(roundBreakdown.map((item) => item.creatureId));
  const roundEncounters = roundBreakdown.reduce((sum, item) => sum + item.encounters, 0);
  const acquisitionNumber = data.records.filter((record) => record.creatureId === creatureId).length + 1;
  const record = {
    id: createId("record"),
    creatureId,
    creatureName: creature.name,
    date: normalizeRecordDate(input.date),
    acquisitionNumber,
    roundEncounters,
    roundBreakdown,
    isOffTarget,
    targetCreatureId: targetCreature.id,
    targetCreatureName: targetCreature.name,
    targetRoundEncounters: roundEncounters,
    totalEncountersAtRecord: creature.totalEncounters,
    location: input.location,
    notes: input.notes,
  };

  if (isOffTarget) return { ...data, records: [record, ...data.records] };

  const resetData = {
    ...data,
    creatures: data.creatures.map((item) => (roundCreatureIds.has(item.id) ? { ...item, currentEncounters: 0 } : item)),
  };

  return {
    ...resetData,
    currentRound: createRound(resetData, currentRoundCreatureIds(data).filter((id) => !roundCreatureIds.has(id)), undefined, true),
    records: [record, ...data.records],
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
  const nextTargetId = data.currentRound?.targetCreatureId === creatureId ? null : data.currentRound?.targetCreatureId ?? null;
  return {
    ...data,
    currentRound: createRound(data, nextRoundIds, nextTargetId, true),
    creatures: data.creatures.filter((creature) => creature.id !== creatureId),
    records: data.records.filter((record) => record.creatureId !== creatureId && record.targetCreatureId !== creatureId),
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
