### Task 5: 全局打点与 hero 显示（App.tsx + dateTime.ts + styles.css）

**Files:**
- Modify: `src/domain/dateTime.ts`（`DEVICE_LABELS` + `formatMetaStamp`）
- Modify: `src/App.tsx`（`apply` 打点 + hero 小字；import 两处）
- Modify: `src/styles.css`（`.lastModified`）
- Test: `src/App.test.tsx`（新增 2 例）

**Interfaces:**
- Consumes: Task 1 的 `detectDeviceKind()`；Task 2 的 `AppData.meta`；`formatMetaStamp`（本 Task 产出）。
- Produces: `formatMetaStamp(updatedAt: string | undefined, updatedBy: DeviceKind | undefined): string | null`（`dateTime.ts` 导出）——Task 6 的三个组件复用；`apply(next)` 现在为每次用户修改写入全局 meta。

- [ ] **Step 1: 写失败测试**

在 `src/App.test.tsx` 的 `it("increments a creature encounter count", ...)` 之后新增 2 例：

```ts
it("shows the last modified time and device in the hero after an edit", async () => {
  const user = userEvent.setup();
  vi.setSystemTime(new Date(2026, 7, 10, 14, 32, 18));
  vi.stubGlobal("navigator", {
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    maxTouchPoints: 0,
  });
  render(<App />);

  await user.click(screen.getAllByRole("button", { name: "+1" })[0]);

  const expectedTime = new Date(2026, 7, 10, 14, 32, 18).toLocaleString("zh-CN", { hour12: false });
  expect(screen.getByText(`上次修改：电脑 · ${expectedTime}`)).toBeInTheDocument();
});

it("shows an unknown device for fresh default data", () => {
  render(<App />);

  expect(screen.getByText(/上次修改：未知设备 · /)).toBeInTheDocument();
});
```

（`expectedTime` 用与实现相同的 `toLocaleString` 动态计算，测试不依赖机器时区。）

- [ ] **Step 2: 运行确认失败（红）**

Run: `npx vitest run src/App.test.tsx`
Expected: 新增 2 例 FAIL（页面无"上次修改"文本），其余通过。

- [ ] **Step 3: 实现**

1. `src/domain/dateTime.ts` 末尾追加：

```ts
import type { DeviceKind } from "./device";

export const DEVICE_LABELS: Record<DeviceKind, string> = {
  computer: "电脑",
  phone: "手机",
  tablet: "平板",
  unknown: "未知设备",
};

/**
 * 记录/数据的修改时间与设备展示文案。旧数据无 updatedAt 时返回 null（调用方不渲染）；
 * 有时间但缺设备信息时显示"未知设备"。时间显示格式与 DataManager 的"上次同步"一致。
 */
export function formatMetaStamp(updatedAt: string | undefined, updatedBy: DeviceKind | undefined): string | null {
  if (!updatedAt) return null;
  const device = updatedBy ? DEVICE_LABELS[updatedBy] : "未知设备";
  return `${device} · ${new Date(updatedAt).toLocaleString("zh-CN", { hour12: false })}`;
}
```

（import 语句放在文件顶部与现有导出不冲突；TypeScript 允许文件内任意位置 import 提升，但为整洁把 `import type { DeviceKind } from "./device";` 放在文件第一行。）

2. `src/App.tsx`：

- import 区加：

```ts
import { detectDeviceKind } from "./domain/device";
```

- `formatDateTimeInput` 同文件的 import 行扩展（现有 `import { formatDateTimeInput, normalizeRecordDate } from "./domain/dateTime";` 不存在于 App.tsx——App.tsx 目前不 import dateTime，改为新增一行）：

```ts
import { formatMetaStamp } from "./domain/dateTime";
```

- `apply` 改为：

```ts
  function apply(next: AppData) {
    // 所有用户修改（+1/-1、记录、编辑、导入、清空、重置）统一在此打点；
    // 拉取云端/水合/切赛季走 setData，不经过这里，因此不会覆盖云端或本地已有的 meta。
    setData({ ...next, meta: { lastModifiedAt: new Date().toISOString(), lastModifiedBy: detectDeviceKind() } });
    setMessage("");
  }
```

- hero 区块（`<p>{season.description}</p>` 之后）加：

```jsx
          <p className="lastModified">上次修改：{formatMetaStamp(data.meta.lastModifiedAt, data.meta.lastModifiedBy)}</p>
```

3. `src/styles.css`（`.eyebrow` 规则之后，约 148 行）加：

```css
.lastModified { margin-top: 0.5rem; font-size: 0.8rem; }
```

（`.hero p` 已提供 `color: var(--muted)` 与基础边距，此处仅强调字号与间距。）

- [ ] **Step 4: 运行确认通过（绿）**

Run: `npx vitest run src/App.test.tsx`
Expected: 新增 2 例通过（"电脑" + 固定时间；"未知设备"），全部 31 例通过。

- [ ] **Step 5: 提交**

```bash
git add src/domain/dateTime.ts src/App.tsx src/styles.css src/App.test.tsx
git commit -m "feat: 页面顶部显示最后修改时间与设备"
```

---
