### Task 2: 类型升级 v5、默认数据、迁移与全仓库适配

**Files:**
- Modify: `src/domain/types.ts`（AppData version 5 + meta；三类记录加可选字段）
- Modify: `src/domain/defaultData.ts`（version 5 + meta）
- Modify: `src/domain/migration.ts`（接受 version 5、meta 兜底）
- Modify: `src/App.tsx:327`（clearData 内联对象）
- Modify: `src/domain/counter.test.ts:26`、`src/domain/importExport.test.ts:22,64`、`src/domain/storage.test.ts:25,84`、`src/domain/sync.test.ts:150,303`（version 断言 → 5）
- Modify: `src/App.test.tsx`（6 处 fixture：约 290/314/344/380/416/467 行）
- Test: `src/domain/storage.test.ts`（新增 2 个迁移用例）

**Interfaces:**
- Consumes: Task 1 的 `DeviceKind`。
- Produces: `AppData.version: 5` 与必填 `meta`；`AcquisitionRecord/GiftedCaptureRecord/FairyTaleBookRecord.updatedAt?/updatedBy?`；`migrateAppData` 对 1–5 版本输入均输出 version 5 且 meta 必有值。Task 3–7 依赖。

- [ ] **Step 1: 写失败测试（migration 兜底）**

在 `src/domain/storage.test.ts` 的 `it("reports no recovery when storage is empty", ...)` 之前新增 2 个用例：

```ts
it("migrates v4 data by adding a fallback meta stamp", () => {
  // 手工构造 v4 数据：createDefaultData 已是 v5，用 JSON 往返降级
  const v4 = JSON.parse(JSON.stringify({ ...createDefaultData("s2"), version: 4 }));
  localStorage.setItem(S2_STORAGE_KEY, JSON.stringify(v4));

  const result = loadAppData("s2");

  expect(result.recovered).toBe(false);
  expect(result.data.version).toBe(5);
  expect(result.data.meta.lastModifiedBy).toBe("unknown");
  expect(typeof result.data.meta.lastModifiedAt).toBe("string");
});

it("backs up a fallback meta for v5 data missing meta", () => {
  const v5NoMeta = JSON.parse(JSON.stringify(createDefaultData("s2")));
  delete v5NoMeta.meta;
  localStorage.setItem(S2_STORAGE_KEY, JSON.stringify(v5NoMeta));

  const result = loadAppData("s2");

  expect(result.recovered).toBe(false);
  expect(result.data.version).toBe(5);
  expect(result.data.meta.lastModifiedBy).toBe("unknown");
  expect(typeof result.data.meta.lastModifiedAt).toBe("string");
});
```

- [ ] **Step 2: 运行确认失败（红）**

Run: `npx vitest run src/domain/storage.test.ts`
Expected: 新增 2 例 FAIL（`result.data.version` 是 4；第二例 `migrateAppData` 对无 meta 数据走旧路径后 meta 访问 undefined 或版本仍 4），其余通过。仅跑本文件，避免中间态编译问题。

- [ ] **Step 3: 实现类型、默认数据与迁移**

1. `src/domain/types.ts` 顶部加：

```ts
import type { DeviceKind } from "./device";
```

`AppData` 改为：

```ts
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
```

`AcquisitionRecord`、`GiftedCaptureRecord`、`FairyTaleBookRecord` 类型末尾（`notes` 字段后）各加：

```ts
  updatedAt?: string;
  updatedBy?: DeviceKind;
```

2. `src/domain/defaultData.ts`：`version: 4` → `version: 5`，并在 `settings` 后加：

```ts
    meta: { lastModifiedAt: new Date().toISOString(), lastModifiedBy: "unknown" },
```

3. `src/domain/migration.ts`：

- import 区加 `import type { DeviceKind } from "./device";`
- `RawVersionedAppData` 改为（Omit 列表加 `"meta"`，version 扩为 `2 | 3 | 4 | 5`，末尾加可选 meta）：

```ts
type RawVersionedAppData = Omit<AppData, "version" | "records" | "giftedRecords" | "fairyTaleBookRecords" | "currentRound" | "meta"> & {
  version: 2 | 3 | 4 | 5;
  records: RawRecord[];
  giftedRecords: GiftedCaptureRecord[];
  fairyTaleBookRecords?: FairyTaleBookRecord[];
  currentRound: RawCurrentRound | null;
  meta?: { lastModifiedAt: string; lastModifiedBy: DeviceKind };
};
```

- `isRawAppData` 版本检查改为：

```ts
    (data.version === 1 || data.version === 2 || data.version === 3 || data.version === 4 || data.version === 5) &&
```

- `migrateAppData` 输出改为：

```ts
  const migrated: AppData = {
    version: 5,
    creatures,
    records: migrateRecords(value.records),
    giftedRecords: value.version !== 1 ? migrateGiftedRecords(value.giftedRecords) : [],
    fairyTaleBookRecords: (value.version === 4 || value.version === 5 ? (value as RawVersionedAppData).fairyTaleBookRecords : undefined) ?? [],
    currentRound: migrateCurrentRound(value, creatures),
    settings: value.settings,
    // 旧数据无法追溯修改时间/设备，兜底为升级时刻 + unknown；v5 数据缺 meta 时同样兜底。
    meta: (value as RawVersionedAppData).meta ?? { lastModifiedAt: new Date().toISOString(), lastModifiedBy: "unknown" },
  };
```

4. `src/App.tsx` `clearData` 内联对象改为：

```ts
    if (window.confirm(`确定清空 ${season.label} 的所有数据？此操作不会影响其它赛季，但不可撤销。`)) apply({ version: 5, creatures: [], records: [], giftedRecords: [], fairyTaleBookRecords: [], currentRound: null, settings: { sortMode: "default" }, meta: { lastModifiedAt: new Date().toISOString(), lastModifiedBy: "unknown" } });
```

- [ ] **Step 4: 适配既有版本断言与 App fixture（机械）**

1. `src/domain/counter.test.ts:26`：`expect(data.version).toBe(4);` → `expect(data.version).toBe(5);`
2. `src/domain/importExport.test.ts:22`：`expect(JSON.parse(json).version).toBe(4);` → `expect(JSON.parse(json).version).toBe(5);`
3. `src/domain/importExport.test.ts:64`（v1 迁移用例）：`expect(result.data.version).toBe(4);` → `expect(result.data.version).toBe(5);`
4. `src/domain/storage.test.ts:25`（"loads defaults"）：`expect(result.data.version).toBe(4);` → `expect(result.data.version).toBe(5);`
5. `src/domain/storage.test.ts:84`（v1 迁移用例）：`expect(loaded.data.version).toBe(4);` → `expect(loaded.data.version).toBe(5);`
6. `src/domain/sync.test.ts:150`（pull 用例）：`if (result.ok) expect(result.data?.version).toBe(4);` → `if (result.ok) expect(result.data?.version).toBe(5);`
7. `src/domain/sync.test.ts:303`（merge currentRound 用例）：`expect(merged.version).toBe(4);` → `expect(merged.version).toBe(5);`
8. `src/App.test.tsx` 6 处 fixture：把每处 `version: 4,` 改为 `version: 5,`，并在该对象的 `settings: { sortMode: "default" },` 后加一行 `meta: { lastModifiedAt: "2026-08-10T00:00:00.000Z", lastModifiedBy: "computer" },`。位置：
   - `it("checks saved sync on startup and applies cloud data with a higher total", ...)` 的 `cloudData`（约 290 行）；
   - `it("checks saved sync on startup and keeps local data when local total is not lower", ...)` 的 `localData`（约 314 行）；
   - `it("warns when totals are equal but content differs", ...)` 的 `localData`（约 344 行）；
   - `it("automatically uploads local changes after a short delay when sync is configured", ...)` 内联 JSON 字符串（约 380 行，`version: 4,` 改 `version: 5,` 并同样补 meta 行）；
   - `it("uploads a local edit made before startup sync hydration keeps local data", ...)` 的 `localData`（约 416 行）；
   - `it("manual pull compares totals instead of overwriting higher local data", ...)` 的 `localData`（约 467 行）。

- [ ] **Step 5: 运行确认通过（绿）**

Run: `npx vitest run src/domain/counter.test.ts src/domain/storage.test.ts src/domain/sync.test.ts src/domain/importExport.test.ts src/App.test.tsx`
Expected: 全部通过（含 Step 1 新增 2 例；storage 现 12 例、sync 15 例、App 29 例、counter 19 例、importExport 17 例）。

- [ ] **Step 6: 提交**

```bash
git add src/domain/types.ts src/domain/defaultData.ts src/domain/migration.ts src/App.tsx src/domain/counter.test.ts src/domain/storage.test.ts src/domain/sync.test.ts src/domain/importExport.test.ts src/App.test.tsx
git commit -m "feat: AppData 升级到 v5 并增加最后修改 meta 字段"
```

---
