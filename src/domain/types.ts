import type { DeviceKind } from "./device";

export type AppData = {
  version: 5;
  creatures: Creature[];
  records: AcquisitionRecord[];
  giftedRecords: GiftedCaptureRecord[];
  fairyTaleBookRecords: FairyTaleBookRecord[];
  currentRound: CurrentRound | null;
  settings: AppSettings;
  meta: { lastModifiedAt: string; lastModifiedBy: DeviceKind };
};

export type CreatureCategory = "奇遇" | "普通" | "战令";

export type Creature = {
  id: string;
  name: string;
  targetCount: number;
  currentEncounters: number;
  totalEncounters: number;
  location: string;
  notes: string;
  isDefault: boolean;
  category?: CreatureCategory;
};

export type CurrentRound = {
  creatureIds: string[];
  targetCreatureId: string | null;
  updatedAt: string;
};

export type RoundEncounterSnapshot = {
  creatureId: string;
  creatureName: string;
  encounters: number;
};

export type AcquisitionRecord = {
  id: string;
  creatureId: string;
  creatureName: string;
  date: string;
  acquisitionNumber: number;
  roundEncounters: number;
  roundBreakdown: RoundEncounterSnapshot[];
  isOffTarget: boolean;
  targetCreatureId: string;
  targetCreatureName: string;
  targetRoundEncounters: number;
  totalEncountersAtRecord: number;
  location: string;
  notes: string;
  updatedAt?: string;
  updatedBy?: DeviceKind;
};

export type GiftedCaptureRecord = {
  id: string;
  creatureId: string;
  creatureName: string;
  receivedAt: string;
  giftedBy: string;
  notes: string;
  updatedAt?: string;
  updatedBy?: DeviceKind;
};

export type FairyTaleBookCreatureEntry = {
  creatureId: string;
  creatureName: string;
  count: number;
};

export type FairyTaleBookRecord = {
  id: string;
  date: string;
  entries: FairyTaleBookCreatureEntry[];
  shinyCreatureIds: string[];
  notes: string;
  updatedAt?: string;
  updatedBy?: DeviceKind;
};

export type FairyTaleBookRecordInput = {
  date: string;
  entries: { creatureId: string; count: number }[];
  shinyCreatureIds: string[];
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
  isOffTarget?: boolean;
};

export type GiftedRecordInput = {
  creatureId: string;
  date: string;
  giftedBy: string;
  notes: string;
};

export type AppStats = {
  creatureCount: number;
  currentRoundTotal: number;
  historicalTotal: number;
  recordCount: number;
  giftedRecordCount: number;
  fairyTaleBookRecordCount: number;
};
