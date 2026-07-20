import type { Creature, CreatureCategory } from "./types";

export type SeasonId = "s2" | "s3";

export type DefaultCreatureSeed = Pick<Creature, "id" | "name" | "targetCount" | "location" | "notes" | "category">;

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

const s3DefaultCreatures: DefaultCreatureSeed[] = [
  { id: "s3-adventure-baomizai", name: "苞米仔", targetCount: 80, location: "", notes: "", category: "奇遇" },
  { id: "s3-adventure-shouyezhu", name: "守夜烛", targetCount: 80, location: "", notes: "", category: "奇遇" },
  { id: "s3-adventure-shizikedou", name: "十字蝌蚪", targetCount: 80, location: "", notes: "", category: "奇遇" },
  { id: "s3-adventure-lishu", name: "栗鼠", targetCount: 80, location: "", notes: "", category: "奇遇" },
  { id: "s3-adventure-hudietaotao", name: "蝴蝶陶陶", targetCount: 80, location: "", notes: "", category: "奇遇" },
  { id: "s3-adventure-daocaoren", name: "稻草人", targetCount: 80, location: "", notes: "", category: "奇遇" },
  { id: "s3-adventure-miguohai", name: "蜜果骸", targetCount: 80, location: "", notes: "", category: "奇遇" },
  { id: "s3-adventure-kabo", name: "卡波", targetCount: 80, location: "", notes: "", category: "奇遇" },
  { id: "s3-normal-yibeier", name: "伊贝儿", targetCount: 80, location: "", notes: "", category: "普通" },
  { id: "s3-normal-keliji", name: "可立鸡", targetCount: 80, location: "", notes: "", category: "普通" },
  { id: "s3-normal-doudingyu", name: "豆丁鱼", targetCount: 80, location: "", notes: "", category: "普通" },
  { id: "s3-normal-haikuichong-original", name: "海盔虫（本来的样子）", targetCount: 80, location: "", notes: "", category: "普通" },
  { id: "s3-normal-haikuichong-worn", name: "海盔虫（磨损的样子）", targetCount: 80, location: "", notes: "", category: "普通" },
  { id: "s3-normal-dishu-dry", name: "地鼠（枯水期的样子）", targetCount: 80, location: "", notes: "", category: "普通" },
  { id: "s3-normal-dishu-water", name: "地鼠（储水时的样子）", targetCount: 80, location: "", notes: "", category: "普通" },
  { id: "s3-normal-xiaocaochong", name: "小草虫", targetCount: 80, location: "", notes: "", category: "普通" },
  { id: "s3-normal-xiaoyu", name: "小鹬", targetCount: 80, location: "", notes: "", category: "普通" },
  { id: "s3-normal-banban", name: "斑斑", targetCount: 80, location: "", notes: "", category: "普通" },
  { id: "s3-battlepass-zujianyuanjian", name: "足尖元件", targetCount: 80, location: "", notes: "", category: "战令" },
  { id: "s3-battlepass-yaoyaoxiaozi", name: "咬咬小子", targetCount: 80, location: "", notes: "", category: "战令" },
];

const s3: SeasonConfig = {
  id: "s3",
  label: "S3",
  eyebrow: "Roco World S3",
  title: "S3 捕捉计数器",
  description: "按精灵记录遭遇次数、本轮进度和获得历史。",
  storageKey: "s3-capture-counter:data",
  syncFileName: "s3-capture-counter.json",
  exportFileName: "s3-capture-counter-backup.json",
  defaultCreatures: s3DefaultCreatures,
  isAvailable: true,
};

export const DEFAULT_SEASON_ID: SeasonId = "s3";
export const SEASON_IDS: SeasonId[] = ["s2", "s3"];
export const SELECTED_SEASON_KEY = "s2-capture-counter:selected-season";
export const seasons: Record<SeasonId, SeasonConfig> = { s2, s3 };

export function isSeasonId(value: string | null): value is SeasonId {
  return value === "s2" || value === "s3";
}

export function getSeasonConfig(seasonId: SeasonId): SeasonConfig {
  return seasons[seasonId];
}

export const FAIRY_TALE_BOOK_CREATURES: { id: string; name: string }[] = [
  { id: "s3-adventure-baomizai", name: "苞米仔" },
  { id: "s3-adventure-shouyezhu", name: "守夜烛" },
  { id: "s3-adventure-shizikedou", name: "十字蝌蚪" },
  { id: "s3-adventure-lishu", name: "栗鼠" },
  { id: "s3-adventure-hudietaotao", name: "蝴蝶陶陶" },
  { id: "s3-adventure-daocaoren", name: "稻草人" },
  { id: "s3-adventure-miguohai", name: "蜜果骸" },
  { id: "s3-adventure-kabo", name: "卡波" },
  { id: "s3-normal-yibeier", name: "伊贝儿" },
  { id: "s3-normal-keliji", name: "可立鸡" },
  { id: "s3-normal-doudingyu", name: "豆丁鱼" },
  { id: "s3-normal-haikuichong-original", name: "海盔虫（本来的样子）" },
  { id: "s3-normal-haikuichong-worn", name: "海盔虫（磨损的样子）" },
  { id: "s3-normal-dishu-dry", name: "地鼠（枯水期的样子）" },
  { id: "s3-normal-dishu-water", name: "地鼠（储水时的样子）" },
  { id: "s3-normal-xiaocaochong", name: "小草虫" },
  { id: "s3-normal-xiaoyu", name: "小鹬" },
  { id: "s3-normal-banban", name: "斑斑" },
];

export function getAvailableSeasonIds(): SeasonId[] {
  return SEASON_IDS.filter((seasonId) => seasons[seasonId].isAvailable);
}
