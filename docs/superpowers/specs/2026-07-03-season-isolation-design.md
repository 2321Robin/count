# Season Isolation Design

## Goal

Prepare the counter for S3 without losing or mixing existing S2 data.

When S3 starts, the app should use a new default list of 18 S3 creatures and every S3 counter should start from zero. Existing S2 creatures, encounter totals, current-round counts, acquisition records, gifted records, local backups, and cloud sync data must remain accessible as S2 data.

## Current Context

The app is currently a single-season Vite/React local-first counter.

Relevant current behavior:

- `src/domain/defaultData.ts` contains the built-in 18 S2 creatures.
- `AppData` in `src/domain/types.ts` represents one complete counter dataset: creatures, own acquisition records, gifted records, current round, and settings.
- `src/domain/storage.ts` stores one dataset under `localStorage` key `s2-capture-counter:data`.
- `src/domain/sync.ts` syncs one Gist file named `s2-capture-counter.json` and stores GitHub Token / Gist ID separately.
- `src/domain/importExport.ts` imports and exports one `AppData` object.
- Counter, current-round, acquisition, gifted-record, statistics, import validation, storage migration, and sync comparison logic are all written around one active `AppData` object.

This is a good boundary: keep `AppData` as the data shape for one season and add season selection around it.

## Scope

In scope:

- Add explicit S2/S3 season identity.
- Keep S2 data under the existing storage key.
- Add a separate S3 storage key.
- Use separate default creature lists for S2 and S3.
- Let the user switch between S2 and S3 in the UI.
- Make local persistence, reset defaults, import, export, and Gist sync operate only on the currently selected season.
- Keep S3 counters and histories empty when S3 data is first created.
- Preserve existing S2 data without migration into S3.

Out of scope:

- Merging S2 and S3 into one combined history.
- Carrying S2 counts, current-round state, records, or gifted records into S3.
- Rewriting counter semantics.
- Adding analytics, charts, or cross-season totals.
- Creating fake S3 creature names. If the real S3 18-creature list is not available at implementation time, the isolation framework can be prepared, but S3 should not be presented as complete with placeholder names.

## User-Facing Behavior

The app should expose a small season switch, likely in the header near the theme selector.

Expected behavior:

- Selecting `S2` loads the existing S2 counter.
- Selecting `S3` loads the S3 counter.
- If S3 has no saved data, it initializes from the S3 default 18-creature list with all counters at zero.
- Switching seasons should not mutate the season being left.
- The header copy should reflect the selected season, for example `Roco World S2` / `S2 捕捉计数器` and `Roco World S3` / `S3 捕捉计数器`.
- Existing counter buttons, current-round panel, record dialogs, gifted record dialog, history lists, data management, and sync controls should continue to work the same way inside the selected season.

## Season Model

Introduce a small season configuration module, for example `src/domain/seasons.ts`.

Core types:

```ts
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
};
```

Required config values:

```ts
s2.storageKey = "s2-capture-counter:data";
s2.syncFileName = "s2-capture-counter.json";
s2.exportFileName = "s2-capture-counter-backup.json";

s3.storageKey = "s3-capture-counter:data";
s3.syncFileName = "s3-capture-counter.json";
s3.exportFileName = "s3-capture-counter-backup.json";
```

The existing S2 storage key must not change. That key is the compatibility anchor for existing users.

Recommended helpers:

```ts
export const SEASON_IDS: SeasonId[] = ["s2", "s3"];
export const DEFAULT_SEASON_ID: SeasonId = "s2"; // Change to "s3" only at the S3 cutover.
export const seasons: Record<SeasonId, SeasonConfig> = { s2, s3 };

export function isSeasonId(value: string | null): value is SeasonId;
export function getSeasonConfig(seasonId: SeasonId): SeasonConfig;
```

Default landing season is a product decision:

- Before S3 officially starts, default to `s2` so current behavior remains unchanged.
- At S3 cutover, default to `s3` so new visits land on S3 while S2 remains selectable.

## Default Creature Data

`createDefaultData` should become season-aware:

```ts
export function createDefaultData(seasonId: SeasonId = DEFAULT_SEASON_ID): AppData;
```

It should still return the same `AppData` shape:

```ts
{
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
}
```

S2 default list:

- Keep the existing 18 S2 creatures exactly as they are today.
- Preserve existing IDs, names, order, `targetCount: 80`, empty location, and empty notes.

S3 default list:

- Add exactly 18 real S3 creatures when known.
- Every S3 default ID should be stable and season-scoped, for example `s3-limited-shiny-<slug>`.
- Do not reuse S2 IDs for S3, even if a display name repeats. Records and current-round state reference creatures by ID.
- All S3 default creatures start with `currentEncounters: 0` and `totalEncounters: 0`.

## AppData Versioning

Keep `AppData.version = 3` if the persisted single-season data shape stays unchanged.

Reason: season isolation lives outside `AppData`, in the selected season's storage key, sync file name, export file name, and default list. The internal object still means “one season of counter data.”

Only introduce `version: 4` if implementation decides to persist `seasonId` inside every `AppData` file. That is not necessary for the requested behavior and would increase migration scope.

## Local Storage

Make storage APIs season-aware:

```ts
export function loadAppData(seasonId: SeasonId): AppData;
export function saveAppData(seasonId: SeasonId, data: AppData): void;
```

Storage behavior:

- `loadAppData("s2")` reads `s2-capture-counter:data`.
- `saveAppData("s2", data)` writes `s2-capture-counter:data`.
- `loadAppData("s3")` reads `s3-capture-counter:data`.
- `saveAppData("s3", data)` writes `s3-capture-counter:data`.
- If selected-season storage is empty or malformed, fall back to `createDefaultData(seasonId)`.
- S3 must not read S2 data as fallback.

This gives the clean isolation the user wants: S2 remains exactly where it was, S3 starts as a separate blank dataset.

## Migration

Current migration should remain responsible for validating and upgrading one `AppData` object.

Update migration to accept a season context:

```ts
export function migrateAppData(value: unknown, seasonId: SeasonId = DEFAULT_SEASON_ID): AppData | null;
```

Use selected-season defaults when repairing default creature metadata:

```ts
const defaultById = new Map(createDefaultData(seasonId).creatures.map((creature) => [creature.id, creature]));
```

Expected migration behavior:

- Old S2 v1/v2/v3 data under `s2-capture-counter:data` migrates as S2.
- S3 data under `s3-capture-counter:data` migrates as S3.
- Missing S3 data creates fresh S3 defaults at zero.
- No migration copies S2 records, gifted records, totals, or current-round state into S3.

## Current Round and Records

No semantic changes are needed.

Because current round and records are already stored inside `AppData`, season isolation naturally separates them once storage is separated.

S2 current-round state remains in S2 data.
S3 current-round state starts as `null` and evolves independently.
S2 acquisition and gifted histories remain in S2 data.
S3 acquisition and gifted histories start empty.

## Import and Export

Import/export should operate on the active season.

Export behavior:

- Export current selected season only.
- Use `getSeasonConfig(seasonId).exportFileName`.
- S2 export file: `s2-capture-counter-backup.json`.
- S3 export file: `s3-capture-counter-backup.json`.

Import behavior:

- Import into the current selected season.
- Validate and migrate with the selected season context.
- On success, replace only the selected season's in-memory data and saved storage.
- On failure, do not overwrite existing selected-season data.

Optional safety check:

- If `AppData` does not include `seasonId`, the app cannot perfectly prove that a backup file belongs to S2 or S3.
- To avoid accidental user confusion, UI copy should say “导入会覆盖当前选中的赛季数据”.
- A future `version: 4` could embed `seasonId` for stronger import validation, but this is not required for the current isolation goal.

## Gist Sync

Token and Gist ID can remain shared.

Reason: credentials identify the same GitHub account and optionally the same Gist container. The season data must be isolated by file name inside the Gist.

Keep existing credential keys:

```ts
TOKEN_STORAGE_KEY = "s2-capture-counter:github-token";
GIST_ID_STORAGE_KEY = "s2-capture-counter:gist-id";
```

Make Gist data file name season-specific:

- S2: `s2-capture-counter.json`
- S3: `s3-capture-counter.json`

Update sync APIs to accept a season or file name:

```ts
export async function pullFromGist(config: SyncConfig, seasonId: SeasonId): Promise<SyncResult>;
export async function pushToGist(data: AppData, config: SyncConfig, seasonId: SeasonId): Promise<PushSyncResult>;
```

Sync behavior:

- Manual upload uploads only the current season's `AppData` to the current season's Gist file.
- Manual pull reads only the current season's Gist file.
- Startup auto-pull reads only the selected season's Gist file.
- Debounced auto-upload uploads only the selected season's data.
- Existing total-count conflict rule remains per season: compare local current-season total to cloud current-season total.
- S2 and S3 totals must never be compared against each other.

If one Gist contains both files, that is acceptable. If the user uses different Gists per season, the current shared Gist ID model would not support that without expanding sync config. The recommended first implementation keeps one Gist ID and multiple files.

## Selected Season Persistence

Persist the user's selected season separately from data.

Recommended key:

```ts
const SELECTED_SEASON_KEY = "s2-capture-counter:selected-season";
```

Behavior:

- On startup, read selected season from this key.
- If missing or invalid, use `DEFAULT_SEASON_ID`.
- When the user changes seasons, save the new selection.
- Selected season persistence must not affect S2 or S3 `AppData` storage.

## React App Wiring

`App.tsx` should own:

- `selectedSeason: SeasonId`
- `data: AppData` for the selected season
- existing UI state such as dialogs, messages, sync config, busy state, and theme

When selected season changes:

1. Close season-specific transient UI such as record dialogs and creature editor.
2. Load `loadAppData(nextSeason)`.
3. Update header copy from the season config.
4. Keep theme and sync credentials unchanged.
5. Ensure subsequent save/import/export/sync actions use the new selected season.

The existing save effect should become season-aware:

```ts
useEffect(() => saveAppData(selectedSeason, data), [selectedSeason, data]);
```

Implementation should avoid accidentally saving old-season data into the new-season key during a switch. A safe pattern is to load the next season data inside the same event handler that updates `selectedSeason`, or to key the app data state by season.

## Data Manager Copy

`DataManager` should make season scope visible.

Examples:

- Heading can remain `数据管理与多端同步`.
- Add copy such as `当前操作仅影响 S3 数据，不会修改 S2 记录。`
- Import warning should say the import replaces the currently selected season.
- Sync copy should say cloud sync uses a separate file for each season.

This reduces the risk of the user thinking S2 backup/export/sync affects S3 or vice versa.

## Data Loss Safety

Required safety properties:

- S2 `localStorage` key is never renamed.
- S3 initialization never overwrites S2 storage.
- Reset defaults affects only the selected season.
- Clear all data affects only the selected season.
- Import affects only the selected season.
- Sync pull affects only the selected season.
- Sync push writes only the selected season's Gist file.
- Season switch does not run counter mutations.

Destructive confirmations should mention the selected season, for example:

- `确定清空 S3 的所有数据？此操作不会影响 S2，但不可撤销。`
- `确定将 S3 重置为默认数据？当前 S3 记录会被清空。`

## Testing Strategy

Domain tests:

- `createDefaultData("s2")` returns the existing 18 S2 defaults.
- `createDefaultData("s3")` returns exactly 18 S3 defaults once the real list is available.
- S2 and S3 default IDs do not overlap.
- Every default creature starts at zero counters.
- `loadAppData("s2")` reads the existing `s2-capture-counter:data` key.
- `loadAppData("s3")` reads only `s3-capture-counter:data`.
- Empty S3 storage returns fresh S3 defaults, not S2 data.
- S2 and S3 saves write different keys.
- Migration uses selected-season default metadata.
- Import validation uses selected-season migration.
- Sync push/pull uses `s2-capture-counter.json` for S2 and `s3-capture-counter.json` for S3.
- Sync total-count comparison remains scoped to one season.

UI tests:

- Existing S2 storage appears when S2 is selected.
- Switching to S3 shows S3 defaults with zero totals.
- Incrementing a S3 creature does not change S2 UI after switching back.
- Reset defaults in S3 does not reset S2.
- Import while S3 is selected does not replace S2.
- Export while S3 is selected uses the S3 file name.
- Manual sync while S3 is selected reads/writes the S3 Gist file.
- Header title and explanatory copy update when switching seasons.

Manual verification:

- Seed localStorage with existing S2 data, open app, confirm S2 data is still visible.
- Switch to S3, confirm 18 S3 creatures and all totals are zero.
- Add counts and a record in S3, switch to S2, confirm S2 counts and records are unchanged.
- Switch back to S3, confirm S3 counts and records persisted.
- Export S2 and S3 separately and confirm file names differ.
- If sync is configured, upload/pull S2 and S3 and confirm Gist file names differ.

## Rollout Plan

Recommended rollout in two cuts:

1. Infrastructure cut before S3 names are final:
   - Add season config, storage isolation, selected-season handling, and tests.
   - Keep default landing season as S2.
   - Do not expose incomplete S3 defaults with fake names.

2. S3 cutover:
   - Add the real 18 S3 creatures.
   - Enable S3 in the switcher if it was hidden.
   - Change default landing season to S3 if desired.
   - Update README and visible copy from S2-only wording to season-aware wording.

If S3 names are already available during implementation, both cuts can happen together.

## Open Decisions

1. Real S3 default creature list: needs the exact 18 names, stable IDs/slugs, and whether all default target counts remain `80`.
2. Default landing season at deployment time: keep `S2` until S3 starts, or switch immediately to `S3`.
3. S3 availability before cutover: hide S3 until the real list is ready, or show S3 only after names are added.
4. Import strictness: keep selected-season import only, or introduce a future `version: 4` with embedded `seasonId` for stronger backup mismatch detection.

## Acceptance Criteria

The design is implemented correctly when:

- Existing S2 users keep their S2 data under `s2-capture-counter:data`.
- S3 creates and stores a separate zeroed dataset under `s3-capture-counter:data`.
- S2 and S3 counters, current round, acquisition history, gifted history, import/export, reset, clear, and Gist sync do not affect each other.
- The UI clearly shows which season is active.
- Tests cover both the domain isolation and the visible season-switch behavior.
