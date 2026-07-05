import type { Creature } from "./types";

export type SeasonId = "s2" | "s3";

export type DefaultCreatureSeed = Pick<Creature, "id" | "name" | "targetCount" | "location" | "notes">;

export type SeasonConfig = {
  id: SeasonId;
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  storageKey: string;
  syncFileName: string;
  exportFileName: string;
  defaultCreatures: DefaultCreatureSeed[];
  isAvailable: boolean;
};

const s2DefaultCreatures: DefaultCreatureSeed[] = [
  { id: "limited-shiny-houmaizai", name: "猴麦仔", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-yanhuatuan", name: "烟花团", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-jiayouhaikui", name: "加油海葵", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-xuanguangdidi", name: "炫光迪迪", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-gugumao", name: "咕咕帽", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-xiaochoudoudou", name: "小丑豆豆", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-xiaoguxiang", name: "小鼓象", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-qianxianmouou", name: "牵线木偶", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-gongpingge", name: "公平鸽", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-linghu", name: "灵狐", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-xiaodujiaoshou", name: "小独角兽", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-dudubao", name: "嘟嘟煲", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-juhuali", name: "菊花梨", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-youyingshu", name: "幽影树", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-xiaoye", name: "小夜", targetCount: 80, location: "", notes: "" },
  { id: "limited-shiny-emoding", name: "恶魔叮", targetCount: 80, location: "", notes: "" },
  { id: "other-shiny-baoyanpenpen", name: "爆焰喷喷", targetCount: 80, location: "", notes: "" },
  { id: "other-shiny-xueguai", name: "雪怪", targetCount: 80, location: "", notes: "" },
];

const s2: SeasonConfig = {
  id: "s2",
  label: "S2",
  eyebrow: "Roco World S2",
  title: "S2 捕捉计数器",
  description: "按精灵记录遭遇次数、本轮进度和获得历史。",
  storageKey: "s2-capture-counter:data",
  syncFileName: "s2-capture-counter.json",
  exportFileName: "s2-capture-counter-backup.json",
  defaultCreatures: s2DefaultCreatures,
  isAvailable: true,
};

const s3: SeasonConfig = {
  id: "s3",
  label: "S3",
  eyebrow: "Roco World S3",
  title: "S3 捕捉计数器",
  description: "S3 精灵名单确认后启用；计数会从 0 独立开始。",
  storageKey: "s3-capture-counter:data",
  syncFileName: "s3-capture-counter.json",
  exportFileName: "s3-capture-counter-backup.json",
  defaultCreatures: [],
  isAvailable: false,
};

export const DEFAULT_SEASON_ID: SeasonId = "s2";
export const SEASON_IDS: SeasonId[] = ["s2", "s3"];
export const SELECTED_SEASON_KEY = "s2-capture-counter:selected-season";
export const seasons: Record<SeasonId, SeasonConfig> = { s2, s3 };

export function isSeasonId(value: string | null): value is SeasonId {
  return value === "s2" || value === "s3";
}

export function getSeasonConfig(seasonId: SeasonId): SeasonConfig {
  return seasons[seasonId];
}

export function getAvailableSeasonIds(): SeasonId[] {
  return SEASON_IDS.filter((seasonId) => seasons[seasonId].isAvailable);
}
