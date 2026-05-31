import type { AppData, Creature } from "./types";
import { formatDateTimeInput } from "./dateTime";

const defaultCreatures: Array<Pick<Creature, "id" | "name" | "targetCount" | "location" | "notes">> = [
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

export function createDefaultData(): AppData {
  return {
    version: 2,
    creatures: defaultCreatures.map((creature) => ({
      ...creature,
      currentEncounters: 0,
      totalEncounters: 0,
      isDefault: true,
    })),
    records: [],
    giftedRecords: [],
    currentRound: null,
    settings: { sortMode: "default" },
  };
}

export function createCurrentRound(creatureIds: string[]): AppData["currentRound"] {
  return creatureIds.length === 0 ? null : { creatureIds, updatedAt: formatDateTimeInput() };
}
