### Task 6: 历史列表条目显示记录 meta（三个组件）

**Files:**
- Modify: `src/components/HistoryList.tsx`（获得记录条目）
- Modify: `src/components/GiftedHistoryList.tsx`（赠送记录条目）
- Modify: `src/components/FairyTaleBookHistory.tsx`（绘本记录条目）
- Test: `src/App.test.tsx`（新增 5 例，沿用现有直接 render 组件的惯例）

**Interfaces:**
- Consumes: Task 5 的 `formatMetaStamp`；Task 2 的记录可选字段；Task 3 的 stamp 行为。
- Produces: 三类历史条目的 `<span className="metaStamp">`（无 `updatedAt` 时不渲染）。

- [ ] **Step 1: 写失败测试**

在 `src/App.test.tsx` 的 `it("hides zero-count entries in acquisition breakdowns", ...)` 之后新增 5 例：

```ts
it("shows the recorded device and time on acquisition history entries", () => {
  const record: AcquisitionRecord = {
    id: "record-meta",
    creatureId: "s3-adventure-baomizai",
    creatureName: "苞米仔",
    date: "2026-05-22T08:09:10",
    acquisitionNumber: 1,
    roundEncounters: 1,
    roundBreakdown: [],
    isOffTarget: false,
    targetCreatureId: "s3-adventure-baomizai",
    targetCreatureName: "苞米仔",
    targetRoundEncounters: 1,
    totalEncountersAtRecord: 1,
    location: "",
    notes: "",
    updatedAt: "2026-08-10T06:32:18.000Z",
    updatedBy: "phone",
  };

  render(<HistoryList records={[record]} fairyTaleBookRecords={[]} />);

  const expectedTime = new Date("2026-08-10T06:32:18.000Z").toLocaleString("zh-CN", { hour12: false });
  expect(screen.getByText(`手机 · ${expectedTime}`)).toBeInTheDocument();
});

it("does not render a meta stamp for records without timestamps", () => {
  const record: AcquisitionRecord = {
    id: "record-legacy",
    creatureId: "s3-adventure-baomizai",
    creatureName: "苞米仔",
    date: "2026-05-22T08:09:10",
    acquisitionNumber: 1,
    roundEncounters: 1,
    roundBreakdown: [],
    isOffTarget: false,
    targetCreatureId: "s3-adventure-baomizai",
    targetCreatureName: "苞米仔",
    targetRoundEncounters: 1,
    totalEncountersAtRecord: 1,
    location: "",
    notes: "",
  };

  render(<HistoryList records={[record]} fairyTaleBookRecords={[]} />);

  expect(document.querySelector(".metaStamp")).toBeNull();
});

it("shows an unknown device when the record has a timestamp but no device", () => {
  const record: AcquisitionRecord = {
    id: "record-no-device",
    creatureId: "s3-adventure-baomizai",
    creatureName: "苞米仔",
    date: "2026-05-22T08:09:10",
    acquisitionNumber: 1,
    roundEncounters: 1,
    roundBreakdown: [],
    isOffTarget: false,
    targetCreatureId: "s3-adventure-baomizai",
    targetCreatureName: "苞米仔",
    targetRoundEncounters: 1,
    totalEncountersAtRecord: 1,
    location: "",
    notes: "",
    updatedAt: "2026-08-10T06:32:18.000Z",
  };

  render(<HistoryList records={[record]} fairyTaleBookRecords={[]} />);

  const stamp = document.querySelector(".metaStamp");
  expect(stamp).not.toBeNull();
  expect(stamp?.textContent).toContain("未知设备");
});

it("shows the recorded device on gifted history entries", () => {
  render(<GiftedHistoryList records={[{
    id: "gift-meta",
    creatureId: "s3-adventure-baomizai",
    creatureName: "苞米仔",
    receivedAt: "2026-05-22T08:09:10",
    giftedBy: "朋友",
    notes: "",
    updatedAt: "2026-08-10T06:32:18.000Z",
    updatedBy: "computer",
  }]} />);

  const expectedTime = new Date("2026-08-10T06:32:18.000Z").toLocaleString("zh-CN", { hour12: false });
  expect(screen.getByText(`电脑 · ${expectedTime}`)).toBeInTheDocument();
});

it("shows the recorded device on fairy tale book history entries", () => {
  render(<FairyTaleBookHistory records={[{
    id: "book-meta",
    date: "2026-07-20T12:00:00",
    entries: [{ creatureId: "s3-adventure-baomizai", creatureName: "苞米仔", count: 1 }],
    shinyCreatureIds: [],
    notes: "",
    updatedAt: "2026-08-10T06:32:18.000Z",
    updatedBy: "tablet",
  }]} />);

  const expectedTime = new Date("2026-08-10T06:32:18.000Z").toLocaleString("zh-CN", { hour12: false });
  expect(screen.getByText(`平板 · ${expectedTime}`)).toBeInTheDocument();
});
```

同时更新 `src/App.test.tsx` 顶部 import（现有 `import { HistoryList } from "./components/HistoryList";` 之后加两行）：

```ts
import { FairyTaleBookHistory } from "./components/FairyTaleBookHistory";
import { GiftedHistoryList } from "./components/GiftedHistoryList";
```

- [ ] **Step 2: 运行确认失败（红）**

Run: `npx vitest run src/App.test.tsx`
Expected: 新增 5 例 FAIL（无 `.metaStamp` 元素/文本），其余通过。

- [ ] **Step 3: 实现**

1. `src/components/HistoryList.tsx`：

- import 区（`formatRecordDate` 之后）加：

```ts
import { formatMetaStamp } from "../domain/dateTime";
```

- records map 回调改为（在 `const roundBreakdownText = ...` 之后加一行，并在 `{record.notes && ...}` 之前插入 span）：

```tsx
            {records.map((record) => {
              const roundBreakdownText = formatVisibleRoundBreakdown(record);
              const metaStamp = formatMetaStamp(record.updatedAt, record.updatedBy);
              return (
                <li key={record.id}>
                  <strong>{record.creatureName}</strong>
                  <span>第 {record.acquisitionNumber} 只</span>
                  <span>{formatRecordDate(record.date)}</span>
                  {record.isOffTarget ? (
                    <span>记录抓“{record.targetCreatureName}”{record.targetRoundEncounters}只时歪出</span>
                  ) : (
                    <span>本轮 {record.roundEncounters}</span>
                  )}
                  {!record.isOffTarget && roundBreakdownText && <span>明细 {roundBreakdownText}</span>}
                  <span>历史 {record.totalEncountersAtRecord}</span>
                  {record.notes && <em>{record.notes}</em>}
                  {metaStamp && <span className="metaStamp">{metaStamp}</span>}
                </li>
              );
            })}
```

2. `src/components/GiftedHistoryList.tsx`：

- import 区加：

```ts
import { formatMetaStamp } from "../domain/dateTime";
```

- map 回调改为：

```tsx
          {records.map((record) => {
            const metaStamp = formatMetaStamp(record.updatedAt, record.updatedBy);
            return (
              <li key={record.id}>
                <strong>{record.creatureName}</strong>
                <span>{formatRecordDate(record.receivedAt)}</span>
                {record.giftedBy && <span>来源 {record.giftedBy}</span>}
                {record.notes && <em>{record.notes}</em>}
                {metaStamp && <span className="metaStamp">{metaStamp}</span>}
              </li>
            );
          })}
```

3. `src/components/FairyTaleBookHistory.tsx`：

- import 区（`formatRecordDate` 之后）加：

```ts
import { formatMetaStamp } from "../domain/dateTime";
```

- map 回调改为（`const shinyNames = ...` 之后加一行，`{record.notes && ...}` 之后插 span）：

```tsx
            {records.map((record) => {
              const entriesText = record.entries
                .filter((e) => e.count > 0)
                .map((e) => `${e.creatureName} ×${e.count}`)
                .join(" / ");
              const shinyNames = record.shinyCreatureIds
                .map((id) => nameById.get(id) ?? id)
                .join("、");
              const metaStamp = formatMetaStamp(record.updatedAt, record.updatedBy);
              return (
                <li key={record.id}>
                  <span>{formatRecordDate(record.date)}</span>
                  <span>{entriesText}</span>
                  <span>✨ 异色：{shinyNames}</span>
                  {record.notes && <em>{record.notes}</em>}
                  {metaStamp && <span className="metaStamp">{metaStamp}</span>}
                </li>
              );
            })}
```

4. `src/styles.css`（`.lastModified` 规则之后）加：

```css
.metaStamp { color: var(--muted); font-size: 0.8rem; }
```

- [ ] **Step 4: 运行确认通过（绿）**

Run: `npx vitest run src/App.test.tsx`
Expected: 新增 5 例通过，全部 36 例通过。

- [ ] **Step 5: 提交**

```bash
git add src/components/HistoryList.tsx src/components/GiftedHistoryList.tsx src/components/FairyTaleBookHistory.tsx src/styles.css src/App.test.tsx
git commit -m "feat: 历史列表条目显示记录时间与设备"
```

---
