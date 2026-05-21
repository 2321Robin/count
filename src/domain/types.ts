export type AppData = {
  version: 1;
  creatures: Creature[];
  records: AcquisitionRecord[];
  settings: AppSettings;
};

export type Creature = {
  id: string;
  name: string;
  targetCount: number;
  currentEncounters: number;
  totalEncounters: number;
  location: string;
  notes: string;
  isDefault: boolean;
};

export type AcquisitionRecord = {
  id: string;
  creatureId: string;
  creatureName: string;
  date: string;
  roundEncounters: number;
  totalEncountersAtRecord: number;
  location: string;
  notes: string;
};

export type AppSettings = {
  sortMode: "default";
};

export type CreatureInput = {
  name: string;
  targetCount: number;
  location: string;
  notes: string;
};

export type RecordInput = {
  date: string;
  location: string;
  notes: string;
};

export type AppStats = {
  creatureCount: number;
  currentRoundTotal: number;
  historicalTotal: number;
  recordCount: number;
};
