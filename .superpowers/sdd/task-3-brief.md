### Task 3: 记录级时间戳（counter.ts stamp）

**Files:**
- Modify: `src/domain/counter.ts`（`recordAcquisition` / `recordGiftedCapture` / `recordFairyTaleBook`）
- Test: `src/domain/counter.test.ts`（新增 3 例）

**Interfaces:**
- Consumes: Task 1 的 `detectDeviceKind()`；Task 2 的记录可选字段。
- Produces: 三个 record 函数的新记录带 `updatedAt`（ISO 字符串）与 `updatedBy`（DeviceKind 四值之一）。Task 6 的组件显示依赖。

- [ ] **Step 1: 写失败测试**

在 `src/domain/counter.test.ts` 的 `it("prepends new fairy tale book records to the list", ...)` 之后新增 3 例：

```ts
it("stamps acquisition records with the modification time and device", () => {
  const data = createDefaultData();
  const counted = incrementEncounter(data, data.creatures[0].id);

  const next = recordAcquisition(counted, data.creatures[0].id, {
    date: "2026-05-22",
    location: "",
    notes: "",
  });

  expect(next.records[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  expect(["computer", "phone", "tablet", "unknown"]).toContain(next.records[0].updatedBy);
});

it("stamps gifted records with the modification time and device", () => {
  const data = createDefaultData();

  const next = recordGiftedCapture(data, {
    creatureId: data.creatures[0].id,
    date: "2026-05-22T08:09:10",
    giftedBy: "朋友",
    notes: "",
  });

  expect(next.giftedRecords[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  expect(["computer", "phone", "tablet", "unknown"]).toContain(next.giftedRecords[0].updatedBy);
});

it("stamps fairy tale book records with the modification time and device", () => {
  const data = createDefaultData();
  const baomizai = data.creatures.find((c) => c.id === "s3-adventure-baomizai")!;

  const next = recordFairyTaleBook(data, {
    date: "2026-07-20T12:00:00",
    entries: [{ creatureId: baomizai.id, count: 1 }],
    shinyCreatureIds: [baomizai.id],
    notes: "",
  });

  expect(next.fairyTaleBookRecords[0].updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  expect(["computer", "phone", "tablet", "unknown"]).toContain(next.fairyTaleBookRecords[0].updatedBy);
});
```

- [ ] **Step 2: 运行确认失败（红）**

Run: `npx vitest run src/domain/counter.test.ts`
Expected: 新增 3 例 FAIL（`updatedAt` / `updatedBy` undefined），其余通过。

- [ ] **Step 3: 实现 stamp**

`src/domain/counter.ts`：

1. import 区（`./dateTime` 之后）加：

```ts
import { detectDeviceKind } from "./device";
```

2. `recordFairyTaleBook` 的 record 对象（`notes: input.notes,` 后）加：

```ts
    updatedAt: new Date().toISOString(),
    updatedBy: detectDeviceKind(),
```

3. `recordAcquisition` 的 record 对象（`notes: input.notes,` 后）加：

```ts
    updatedAt: new Date().toISOString(),
    updatedBy: detectDeviceKind(),
```

4. `recordGiftedCapture` 的 giftedRecords 对象（`notes: input.notes,` 后）加：

```ts
        updatedAt: new Date().toISOString(),
        updatedBy: detectDeviceKind(),
```

- [ ] **Step 4: 运行确认通过（绿）**

Run: `npx vitest run src/domain/counter.test.ts`
Expected: 全部通过（22 例；node 环境下 `detectDeviceKind` 返回 `"unknown"`，断言集合包含它）。

- [ ] **Step 5: 提交**

```bash
git add src/domain/counter.ts src/domain/counter.test.ts
git commit -m "feat: 获得/赠送/绘本记录创建时写入修改时间与设备"
```

---
