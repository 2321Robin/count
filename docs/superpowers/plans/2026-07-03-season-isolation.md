# Season Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add S2/S3 season isolation so existing S2 data remains intact and selectable while S3 can start from an independent zeroed 18-creature dataset.

**Architecture:** Keep `AppData` as the data model for one season. Add a season configuration layer that supplies each season's default creatures, storage key, Gist file name, export file name, and UI copy. `src/App.tsx` owns the selected season and routes load/save/reset/import/export/sync actions to that season only; counter, current-round, acquisition, gifted-record, and stats logic remain season-agnostic.

**Tech Stack:** React, TypeScript, Vite, Vitest, Testing Library, localStorage, GitHub Gist REST API through `fetch`.

---

## Spec Alignment

This plan implements `docs/superpowers/specs/2026-07-03-season-isolation-design.md`.

Required safety properties:

- Keep S2 under the existing `s2-capture-counter:data` localStorage key.
- Add S3 under `s3-capture-counter:data`.
- Do not copy S2 counts, current-round state, acquisition records, or gifted records into S3.
- Keep `AppData.version = 3` because the one-season persisted object shape does not change.
- Keep GitHub Token and Gist ID shared, but isolate synced data by Gist file name.
- Persist selected season separately under `s2-capture-counter:selected-season`.
- Do not expose fake S3 defaults. If the real S3 18-creature list is not present during implementation, complete the isolation infrastructure with S3 unavailable in the switcher, then enable S3 in the cutover task with the real list.

---

## File Structure

- Create `src/domain/seasons.ts`: season IDs, config objects, S2 defaults, S3 availability, selected-season helpers, storage keys, Gist file names, export file names, and UI copy.
- Modify `src/domain/defaultData.ts`: create default `AppData` from the selected season config.
- Modify `src/domain/storage.ts`: load/save one season's `AppData` by season-specific storage key.
- Modify `src/domain/migration.ts`: validate/migrate one `AppData` object using selected-season default metadata.
- Modify `src/domain/importExport.ts`: parse imported JSON using selected-season migration; keep export shape as one `AppData` object.
- Modify `src/domain/sync.ts`: read/write selected-season Gist file names while keeping Token and Gist ID shared.
- Modify `src/App.tsx`: own selected-season state, avoid cross-season saves during switching, update header copy, confirmations, import/export, reset, clear, sync, startup pull, and debounced upload wiring.
- Modify `src/components/DataManager.tsx`: make current-season scope visible in data management and sync copy.
- Modify `src/styles.css`: style the season picker only if existing header layout needs spacing.
- Modify `src/domain/counter.test.ts`: cover S2 defaults, zero counters, no ID overlap, and S3 defaults after cutover.
- Modify `src/domain/storage.test.ts`: cover S2 compatibility key and S3 isolated key behavior.
- Modify `src/domain/importExport.test.ts`: cover selected-season import migration and unchanged single-season export shape.
- Modify `src/domain/sync.test.ts`: cover season-specific Gist file names and missing selected-season file behavior.
- Modify `src/App.test.tsx`: cover visible season switching, no cross-season localStorage writes, import/export file names, reset/clear scope, and sync wiring.
- Modify `README.md`: update user docs after behavior is implemented and verified.

---

## Data Contract

### Season IDs

Use a narrow union everywhere season identity is needed:

```ts
export type SeasonId = "s2" | "s3";
```

### Season Config

Create `src/domain/seasons.ts` with this shape:

```ts
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
```

Required constant values:

```ts
export const SELECTED_SEASON_KEY = "s2-capture-counter:selected-season";

s2.storageKey = "s2-capture-counter:data";
s2.syncFileName = "s2-capture-counter.json";
s2.exportFileName = "s2-capture-counter-backup.json";

s3.storageKey = "s3-capture-counter:data";
s3.syncFileName = "s3-capture-counter.json";
s3.exportFileName = "s3-capture-counter-backup.json";
```

Keep sync credential keys shared in `src/domain/sync.ts`:

```ts
TOKEN_STORAGE_KEY = "s2-capture-counter:github-token";
GIST_ID_STORAGE_KEY = "s2-capture-counter:gist-id";
```

### Default Season

Use:

```ts
export const DEFAULT_SEASON_ID: SeasonId = "s2";
```

Keep S2 as the default landing season until the S3 cutover. At S3 cutover, changing this constant to `"s3"` is the only default-season change.

### S2 Default List

Move the existing `defaultCreatures` array from `src/domain/defaultData.ts` into the S2 config without changing IDs, names, order, `targetCount`, location, or notes:

```ts
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
```

### S3 Availability Rule

Before the real S3 creature list is present, configure S3 with `isAvailable: false` and an empty `defaultCreatures` array. `getSeasonConfig("s3")` still exists so storage, sync, import/export, and tests can be wired against S3 keys, but the UI must not offer S3 as a selectable season while it is unavailable.

At cutover, set `isAvailable: true` and replace the empty S3 defaults with the real 18 entries. Every S3 default ID must be stable and season-scoped, and no S3 ID may overlap any S2 ID.

---

## Task 1: Add Season Configuration And Default Data

**Files:**

- Create: `src/domain/seasons.ts`
- Modify: `src/domain/defaultData.ts`
- Test: `src/domain/counter.test.ts`

- [ ] **Step 1: Write failing default-data tests**

Update `src/domain/counter.test.ts` so default-data coverage is explicit:

```ts
it("creates S2 default data from the existing creature list", () => {
  const data = createDefaultData("s2");
  expect(data.version).toBe(3);
  expect(data.creatures.map((creature) => creature.name)).toEqual([
    "猴麦仔", "烟花团", "加油海葵", "炫光迪迪", "咕咕帽", "小丑豆豆", "小鼓象", "牵线木偶", "公平鸽", "灵狐", "小独角兽", "嘟嘟煲", "菊花梨", "幽影树", "小夜", "恶魔叮", "爆焰喷喷", "雪怪",
  ]);
  expect(data.creatures.every((creature) => creature.currentEncounters === 0 && creature.totalEncounters === 0 && creature.isDefault)).toBe(true);
  expect(data.records).toEqual([]);
  expect(data.giftedRecords).toEqual([]);
  expect(data.currentRound).toBeNull();
});

it("does not expose S3 defaults before S3 is available", () => {
  expect(getSeasonConfig("s3").isAvailable).toBe(false);
  expect(getSeasonConfig("s3").defaultCreatures).toEqual([]);
});
```

When the S3 cutover task is executed, replace the second test with assertions for the real 18 S3 names, zero counters, and no ID overlap with S2.

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
npm test -- src/domain/counter.test.ts
```

Expected: FAIL because `createDefaultData` does not accept a season ID and `getSeasonConfig` does not exist.

- [ ] **Step 3: Implement `src/domain/seasons.ts`**

Create the module using the contract above. Export:

```ts
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
```

- [ ] **Step 4: Make default data season-aware**

Change `src/domain/defaultData.ts`:

```ts
export function createDefaultData(seasonId: SeasonId = DEFAULT_SEASON_ID): AppData {
  const season = getSeasonConfig(seasonId);
  return {
    version: 3,
    creatures: season.defaultCreatures.map((creature) => ({
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
```

Keep `createCurrentRound` unchanged.

- [ ] **Step 5: Run focused test and verify pass**

Run:

```bash
npm test -- src/domain/counter.test.ts
```

Expected: PASS for existing counter behavior and the new season default-data tests.

---

## Task 2: Isolate Storage And Migration By Season

**Files:**

- Modify: `src/domain/storage.ts`
- Modify: `src/domain/migration.ts`
- Test: `src/domain/storage.test.ts`

- [ ] **Step 1: Write failing storage tests**

Add tests that prove:

1. `loadAppData("s2")` reads `s2-capture-counter:data`.
2. `saveAppData("s2", data)` writes only `s2-capture-counter:data`.
3. `loadAppData("s3")` reads `s3-capture-counter:data`.
4. `saveAppData("s3", data)` writes only `s3-capture-counter:data`.
5. Empty S3 storage returns `createDefaultData("s3")`; it never falls back to S2 data.
6. Malformed selected-season storage falls back to that season's defaults.

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
npm test -- src/domain/storage.test.ts
```

Expected: FAIL because storage functions are not season-aware.

- [ ] **Step 3: Update storage API**

Change `src/domain/storage.ts` to:

```ts
export const S2_STORAGE_KEY = "s2-capture-counter:data";
export const S3_STORAGE_KEY = "s3-capture-counter:data";

export function loadAppData(seasonId: SeasonId): AppData {
  try {
    const { storageKey } = getSeasonConfig(seasonId);
    const raw = localStorage.getItem(storageKey);
    if (!raw) return createDefaultData(seasonId);

    const parsed: unknown = JSON.parse(raw);
    return migrateAppData(parsed, seasonId) ?? createDefaultData(seasonId);
  } catch {
    return createDefaultData(seasonId);
  }
}

export function saveAppData(seasonId: SeasonId, data: AppData): void {
  const { storageKey } = getSeasonConfig(seasonId);
  localStorage.setItem(storageKey, JSON.stringify(data));
}
```

- [ ] **Step 4: Update migration API**

Change `src/domain/migration.ts`:

```ts
export function migrateAppData(value: unknown, seasonId: SeasonId = DEFAULT_SEASON_ID): AppData | null {
  if (!isRawAppData(value)) return null;

  const defaultById = new Map(createDefaultData(seasonId).creatures.map((creature) => [creature.id, creature]));
  const creatures = value.creatures.map((creature) => migrateCreature(creature, defaultById));
  return {
    version: 3,
    creatures,
    records: migrateRecords(value.records),
    giftedRecords: value.version !== 1 ? migrateGiftedRecords(value.giftedRecords) : [],
    currentRound: migrateCurrentRound(value, creatures),
    settings: value.settings,
  };
}
```

Do not add `seasonId` to `AppData`.

- [ ] **Step 5: Run focused storage tests**

Run:

```bash
npm test -- src/domain/storage.test.ts
```

Expected: PASS. Existing v1/v2/v3 migration cases remain covered under S2.

---

## Task 3: Isolate Import And Export By Season

**Files:**

- Modify: `src/domain/importExport.ts`
- Test: `src/domain/importExport.test.ts`

- [ ] **Step 1: Write failing import tests**

Add tests that prove:

1. `parseImportedData(raw, "s2")` migrates valid S2 v1/v2/v3 data.
2. `parseImportedData(raw, "s3")` calls selected-season migration and returns fresh season-correct metadata for default creatures present in the import.
3. Invalid JSON still returns `导入文件不是有效的 JSON。`.
4. Invalid structure still returns `导入数据结构不完整。`.
5. `exportAppData(data)` still returns formatted JSON for one `AppData`, not a multi-season envelope.

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
npm test -- src/domain/importExport.test.ts
```

Expected: FAIL because `parseImportedData` does not accept `seasonId`.

- [ ] **Step 3: Update import parser signature**

Change `src/domain/importExport.ts`:

```ts
export function parseImportedData(raw: string, seasonId: SeasonId): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "导入文件不是有效的 JSON。" };
  }

  const data = migrateAppData(parsed, seasonId);
  if (!data) return { ok: false, error: "导入数据结构不完整。" };
  return { ok: true, data };
}
```

Keep:

```ts
export function exportAppData(data: AppData): string {
  return JSON.stringify(data, null, 2);
}
```

- [ ] **Step 4: Run focused import/export tests**

Run:

```bash
npm test -- src/domain/importExport.test.ts
```

Expected: PASS.

---

## Task 4: Isolate Gist Sync By Season

**Files:**

- Modify: `src/domain/sync.ts`
- Test: `src/domain/sync.test.ts`

- [ ] **Step 1: Write failing sync tests**

Add tests that prove:

1. `pushToGist(data, config, "s2")` writes a file named `s2-capture-counter.json`.
2. `pushToGist(data, config, "s3")` writes a file named `s3-capture-counter.json`.
3. `pullFromGist(config, "s2")` reads only `s2-capture-counter.json`.
4. `pullFromGist(config, "s3")` reads only `s3-capture-counter.json`.
5. Pulling S3 from a Gist that only contains the S2 file returns the existing invalid-cloud-data error instead of falling back to S2.
6. `selectHigherTotalData` remains unchanged and compares only the two `AppData` objects passed to it.

- [ ] **Step 2: Run focused test and verify failure**

Run:

```bash
npm test -- src/domain/sync.test.ts
```

Expected: FAIL because sync functions do not accept `seasonId`.

- [ ] **Step 3: Update pull API**

Change:

```ts
export async function pullFromGist(config: SyncConfig, seasonId: SeasonId): Promise<SyncResult>
```

Inside Gist parsing, use:

```ts
const { syncFileName } = getSeasonConfig(seasonId);
const file = data.files?.[syncFileName];
```

Call:

```ts
migrateAppData(parsed, seasonId)
```

- [ ] **Step 4: Update push API**

Change:

```ts
export async function pushToGist(data: AppData, config: SyncConfig, seasonId: SeasonId): Promise<PushSyncResult>
```

When constructing the Gist payload, use:

```ts
const { syncFileName } = getSeasonConfig(seasonId);
files: { [syncFileName]: { content: JSON.stringify(data, null, 2) } }
```

Do not change Token or Gist ID storage keys.

- [ ] **Step 5: Run focused sync tests**

Run:

```bash
npm test -- src/domain/sync.test.ts
```

Expected: PASS. Existing auth, push, pull, and total-selection tests still pass.

---

## Task 5: Add Season Switching In The App

**Files:**

- Modify: `src/App.tsx`
- Modify: `src/components/DataManager.tsx`
- Modify: `src/styles.css` if needed
- Test: `src/App.test.tsx`

- [ ] **Step 1: Write failing UI tests for selected-season persistence and switching**

Add tests that prove:

1. Existing S2 data under `s2-capture-counter:data` appears when S2 is selected.
2. The selected season is read from `s2-capture-counter:selected-season`.
3. Selecting S3 loads `s3-capture-counter:data` and updates hero copy when S3 is available.
4. Switching seasons closes record dialogs and creature editor.
5. Switching seasons does not save previous-season `data` into the new season key.
6. Theme and sync config stay shared across season changes.

- [ ] **Step 2: Write failing UI tests for scoped data operations**

Add tests that prove:

1. Incrementing a S3 creature writes only `s3-capture-counter:data` and leaves S2 storage unchanged.
2. Reset defaults while S3 is selected resets only S3.
3. Clear all data while S2 is selected clears only S2.
4. Import while S3 is selected updates only S3.
5. Export while S2 is selected uses `s2-capture-counter-backup.json`.
6. Export while S3 is selected uses `s3-capture-counter-backup.json`.
7. Startup sync while S3 is selected reads `s3-capture-counter.json`.
8. Manual upload while S2 is selected writes `s2-capture-counter.json`.
9. Manual upload while S3 is selected writes `s3-capture-counter.json`.

- [ ] **Step 3: Run focused UI tests and verify failure**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: FAIL because `App` is still single-season.

- [ ] **Step 4: Add selected-season loading helpers**

In `src/App.tsx`, add:

```ts
function loadSelectedSeason(): SeasonId {
  const saved = localStorage.getItem(SELECTED_SEASON_KEY);
  if (isSeasonId(saved) && getSeasonConfig(saved).isAvailable) return saved;
  return DEFAULT_SEASON_ID;
}
```

Then initialize:

```ts
const [seasonId, setSeasonId] = useState<SeasonId>(() => loadSelectedSeason());
const season = getSeasonConfig(seasonId);
const [data, setData] = useState<AppData>(() => loadAppData(seasonId));
```

- [ ] **Step 5: Add a safe season switch handler**

Use a handler that updates `seasonId` and `data` together:

```ts
function switchSeason(nextSeasonId: SeasonId) {
  const nextSeason = getSeasonConfig(nextSeasonId);
  if (!nextSeason.isAvailable) return;
  localStorage.setItem(SELECTED_SEASON_KEY, nextSeasonId);
  skipNextSaveRef.current = true;
  skipNextAutoUploadRef.current = true;
  setEditing(null);
  setRecording(null);
  setRecordingGift(null);
  setMessage("");
  setSeasonId(nextSeasonId);
  setData(loadAppData(nextSeasonId));
  hasHydratedRef.current = false;
  preHydrationDirtyRef.current = false;
  setHydrationRevision((revision) => revision + 1);
}
```

Use a save effect guarded against cross-season writes:

```ts
useEffect(() => {
  if (skipNextSaveRef.current) {
    skipNextSaveRef.current = false;
    return;
  }
  saveAppData(seasonId, data);
}, [seasonId, data]);
```

- [ ] **Step 6: Pass season ID to all data operations**

Update call sites:

```ts
saveAppData(seasonId, data);
parseImportedData(await file.text(), seasonId);
pullFromGist(config, seasonId);
pushToGist(dataRef.current, config, seasonId);
pushToGist(data, config, seasonId);
createDefaultData(seasonId);
```

Export name:

```ts
link.download = season.exportFileName;
```

Clear confirmation:

```ts
window.confirm(`确定清空 ${season.label} 的所有数据？此操作不会影响其它赛季，但不可撤销。`)
```

Reset confirmation:

```ts
window.confirm(`确定将 ${season.label} 重置为默认数据？当前 ${season.label} 记录会被清空，不会影响其它赛季。`)
```

- [ ] **Step 7: Add season switch UI and season copy**

In the hero actions area, render only available seasons:

```tsx
<label className="seasonPicker">赛季
  <select value={seasonId} onChange={(event) => switchSeason(event.target.value as SeasonId)}>
    {getAvailableSeasonIds().map((id) => (
      <option key={id} value={id}>{getSeasonConfig(id).label}</option>
    ))}
  </select>
</label>
```

Hero copy must come from the selected config:

```tsx
<p className="eyebrow">{season.eyebrow}</p>
<h1>{season.title}</h1>
<p>{season.description}</p>
```

- [ ] **Step 8: Update DataManager props and copy**

Add props:

```ts
seasonLabel: string;
```

Update helper copy to include:

- `当前操作仅影响 {seasonLabel} 数据，不会修改其它赛季记录。`
- `导入会覆盖当前选中的赛季数据。`
- `同步只处理当前赛季的云端文件。`

- [ ] **Step 9: Run focused UI tests**

Run:

```bash
npm test -- src/App.test.tsx
```

Expected: PASS. Existing UI tests still pass.

---

## Task 6: S3 Cutover With Real Creature List

**Files:**

- Modify: `src/domain/seasons.ts`
- Modify: `src/domain/counter.test.ts`
- Modify: `src/App.test.tsx`

- [ ] **Step 1: Add the real S3 list**

Replace the empty S3 default list with the real 18 S3 creatures. Each entry must use this shape:

```ts
{ id: "s3-limited-shiny-unique-slug", name: "精灵名", targetCount: 80, location: "", notes: "" }
```

Use the actual game names and stable slugs supplied for the S3 release. Do not derive IDs from display names at runtime.

- [ ] **Step 2: Enable S3**

Set:

```ts
s3.isAvailable = true;
```

If S3 should be the landing season at release, also set:

```ts
export const DEFAULT_SEASON_ID: SeasonId = "s3";
```

If release happens before S3 starts, keep `DEFAULT_SEASON_ID` as `"s2"`.

- [ ] **Step 3: Replace pre-cutover tests**

Replace the pre-cutover unavailable-S3 test with assertions that:

1. `createDefaultData("s3")` returns exactly 18 creatures.
2. Every S3 creature starts with `currentEncounters: 0`, `totalEncounters: 0`, and `isDefault: true`.
3. S3 IDs do not overlap S2 IDs.
4. The S3 season option is visible in the UI.
5. Switching to S3 shows `S3 捕捉计数器` and the S3 defaults.

- [ ] **Step 4: Run cutover tests**

Run:

```bash
npm test -- src/domain/counter.test.ts src/App.test.tsx
```

Expected: PASS.

---

## Task 7: Update Documentation After Behavior Works

**Files:**

- Modify: `README.md`

- [ ] **Step 1: Update title and intro**

Change the README title from S2-only wording to season-aware wording:

```md
# 捕捉计数器使用说明
```

Intro must state that S2 and S3 data are separate, S2 historical records are retained, and S3 starts from zero with its own default creature list once enabled.

- [ ] **Step 2: Add season switching section**

Add a section explaining:

- `S2` and `S3` data are stored separately.
- Switching season changes the creature list, current round, history, gifted records, totals, import/export target, and sync file.
- Theme and GitHub Token/Gist ID are shared.
- Switching to S3 does not delete or reset S2.

- [ ] **Step 3: Update data management docs**

Clarify:

- Export exports only the current season.
- Import imports into only the current season.
- Clear/reset affect only the current season.
- Before S3 cutover, export an S2 backup once for safety.

- [ ] **Step 4: Update sync docs**

Clarify:

- One Gist can contain separate files for seasons.
- S2 uses `s2-capture-counter.json`.
- S3 uses `s3-capture-counter.json`.
- Pull/upload only applies to the selected season.
- The higher-total rule compares only the selected season's local/cloud data.

- [ ] **Step 5: Add changelog entry**

Add a dated release entry at the top of the changelog. Use the implementation date:

```md
### v0.3.0（2026-07-03）

- 增加 S2/S3 赛季切换。
- S2 和 S3 的默认精灵、计数、当前轮次、获得历史、赠送记录、本地备份和同步文件相互隔离。
- S3 从 0 开始，不覆盖 S2 历史数据。
```

---

## Task 8: Final Verification

**Files:**

- No source edits unless verification finds a bug.

- [ ] **Step 1: Run changed focused tests**

Run:

```bash
npm test -- src/domain/counter.test.ts src/domain/storage.test.ts src/domain/importExport.test.ts src/domain/sync.test.ts src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Manual smoke test in browser**

Start the app:

```bash
npm run dev
```

Then verify:

1. Open the app with existing S2 data in localStorage.
2. Select S2; confirm S2 title/list/history/totals match old data.
3. Select S3 after S3 is enabled; confirm S3 title/list appears and totals are zero.
4. Click `+1` on one S3 creature; confirm S3 total increments.
5. Switch back to S2; confirm S2 totals did not change.
6. Switch to S3 again; confirm the S3 increment persisted.
7. Export S2 and S3; confirm file names differ.
8. If sync is configured, upload S2 and S3; confirm the Gist contains `s2-capture-counter.json` and `s3-capture-counter.json` and neither overwrites the other.

- [ ] **Step 4: Final implementation notes**

Before yielding after implementation, report:

- Whether S3 was enabled in this implementation.
- The S3 default creature list source, if S3 was enabled.
- Final `DEFAULT_SEASON_ID` value and why.
- Exact focused tests run and results.
- Build result.
- Manual smoke test result or the specific reason a manual sync smoke test was not run.

---

## Risk Checklist

- S2 backward compatibility: `s2-capture-counter:data` must remain the S2 key.
- Selected season key: use `s2-capture-counter:selected-season`, not a new unrelated namespace.
- No cross-season saves: switching seasons must not save previous `data` into the next season's key.
- No cross-season sync: selected season must determine the Gist file name for both pull and push.
- No ID reuse: S3 default IDs must not overlap S2 IDs.
- No fake S3 list: do not ship invented creature names as real defaults.
- Current round isolation: `currentRound` is part of each season's `AppData`; do not store it globally.
- Records isolation: `records` and `giftedRecords` are part of each season's `AppData`; do not filter a shared array by season.
- Import safety: import affects only the selected season.
- Reset/clear safety: confirmation copy includes the selected season label.
- Sync conflict safety: higher-total comparison compares only local/cloud data for the selected season.

---

## Expected End State

- Existing users keep S2 data under `s2-capture-counter:data` without migration loss.
- S3 uses `s3-capture-counter:data` and starts from `createDefaultData("s3")` at zero after real S3 defaults are enabled.
- UI can switch between all available seasons.
- S2 and S3 have separate default creature lists, current-round state, totals, acquisition history, gifted history, import/export files, and Gist JSON files.
- Theme and GitHub sync credentials remain shared.
- Tests prove storage, import/export, sync, and UI switching do not cross-write seasons.
