### Task 4: 同步合并保留较新的全局 meta（sync.ts）

**Files:**
- Modify: `src/domain/sync.ts`（`mergeAppData`）
- Test: `src/domain/sync.test.ts`（新增 2 例）

**Interfaces:**
- Consumes: Task 2 的 `AppData.meta`。
- Produces: `mergeAppData` 返回数据的 `meta` 为两端 `lastModifiedAt` 更晚的一侧（相等取 localData）。Task 5 不直接依赖，但自动上传路径（`pushToGist` 预拉取合并）从此携带正确 meta。

- [ ] **Step 1: 写失败测试**

在 `src/domain/sync.test.ts` 的 `it("keeps local currentRound, settings, and version", ...)` 之后新增 2 例：

```ts
it("keeps the newer global meta after merging", () => {
  const local: AppData = { ...createDefaultData("s2"), meta: { lastModifiedAt: "2026-08-10T06:00:00.000Z", lastModifiedBy: "phone" } };
  const cloud: AppData = { ...createDefaultData("s2"), meta: { lastModifiedAt: "2026-08-10T07:00:00.000Z", lastModifiedBy: "computer" } };

  expect(mergeAppData(local, cloud).meta).toEqual(cloud.meta);
  expect(mergeAppData(cloud, local).meta).toEqual(cloud.meta);
});

it("keeps local meta when timestamps are equal or local is newer", () => {
  const local: AppData = { ...createDefaultData("s2"), meta: { lastModifiedAt: "2026-08-10T08:00:00.000Z", lastModifiedBy: "phone" } };
  const cloud: AppData = { ...createDefaultData("s2"), meta: { lastModifiedAt: "2026-08-10T07:00:00.000Z", lastModifiedBy: "computer" } };

  expect(mergeAppData(local, cloud).meta).toEqual(local.meta);
  expect(mergeAppData(local, local).meta).toEqual(local.meta);
});
```

- [ ] **Step 2: 运行确认失败（红）**

Run: `npx vitest run src/domain/sync.test.ts`
Expected: 新增 2 例 FAIL（合并结果 meta 仍是 localData 的旧值），其余通过。

- [ ] **Step 3: 实现**

`src/domain/sync.ts` 的 `mergeAppData` 返回对象改为（`...localData` 后加 meta 行）：

```ts
  return {
    ...localData, // currentRound、settings 取本地；version 保持 5
    meta: localData.meta.lastModifiedAt >= cloudData.meta.lastModifiedAt ? localData.meta : cloudData.meta,
    creatures: mergedCreatures,
    records: mergeById(localData.records, cloudData.records),
    giftedRecords: mergeById(localData.giftedRecords, cloudData.giftedRecords),
    fairyTaleBookRecords: mergeById(localData.fairyTaleBookRecords, cloudData.fairyTaleBookRecords),
  };
```

同时把该函数上方的 doc 注释追加一句：`// 全局 meta 取 lastModifiedAt 更晚的一侧；记录级 meta 随记录本体保留。`

- [ ] **Step 4: 运行确认通过（绿）**

Run: `npx vitest run src/domain/sync.test.ts`
Expected: 全部通过（17 例）。

- [ ] **Step 5: 提交**

```bash
git add src/domain/sync.ts src/domain/sync.test.ts
git commit -m "feat: 同步合并时保留较新的全局修改 meta"
```

---
