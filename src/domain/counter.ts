import type { AppData, AppStats, Creature, CreatureInput, RecordInput } from "./types";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function updateCreatureById(data: AppData, creatureId: string, updater: (creature: Creature) => Creature): AppData {
  return {
    ...data,
    creatures: data.creatures.map((creature) => (creature.id === creatureId ? updater(creature) : creature)),
  };
}

export function incrementEncounter(data: AppData, creatureId: string): AppData {
  return updateCreatureById(data, creatureId, (creature) => ({
    ...creature,
    currentEncounters: creature.currentEncounters + 1,
    totalEncounters: creature.totalEncounters + 1,
  }));
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
  const acquisitionNumber = data.records.filter((record) => record.creatureId === creatureId).length + 1;

  return {
    ...data,
    creatures: data.creatures.map((item) =>
      item.id === creatureId ? { ...item, currentEncounters: 0 } : item,
    ),
    records: [
      {
        id: createId("record"),
        creatureId,
        creatureName: creature.name,
        date: input.date,
        acquisitionNumber,
        roundEncounters: creature.currentEncounters,
        totalEncountersAtRecord: creature.totalEncounters,
        location: input.location,
        notes: input.notes,
      },
      ...data.records,
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
  return {
    ...data,
    creatures: data.creatures.filter((creature) => creature.id !== creatureId),
    records: data.records.filter((record) => record.creatureId !== creatureId),
  };
}

export function calculateStats(data: AppData): AppStats {
  return {
    creatureCount: data.creatures.length,
    currentRoundTotal: data.creatures.reduce((sum, creature) => sum + creature.currentEncounters, 0),
    historicalTotal: data.creatures.reduce((sum, creature) => sum + creature.totalEncounters, 0),
    recordCount: data.records.length,
  };
}
