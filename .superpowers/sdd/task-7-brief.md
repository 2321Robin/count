### Task 7: README 更新日志与全量验证

**Files:**
- Modify: `README.md`（更新日志加 v0.4.0）

**Interfaces:**
- Consumes: 全部前置 Task 的产出。

- [ ] **Step 1: 更新 README 更新日志**

在 `README.md` 的 `## 更新日志` 段落顶部（`### v0.3.0（2026-07-03）` 之前）插入：

```md
### v0.4.0（2026-08-10）

- 页面顶部显示当前赛季数据最后修改时间与修改设备（电脑/手机/平板），多端同步时随数据一起同步。
- 获得记录、赠送记录、童话绘本记录条目显示各自的记录时间与设备。
- 历史记录无法追溯修改设备，显示"未知设备"。
```

- [ ] **Step 2: 全量测试**

Run: `npm test`
Expected: 全部通过（src 下约 99 例：App 36、counter 22、device 12、importExport 17、storage 12、sync 17；本地报告若含 `.worktrees/` 用例不影响判定，以 src 为准）。

- [ ] **Step 3: 构建验证**

Run: `npm run build`
Expected: `tsc -b` 与 `vite build` 均成功，无类型错误。

- [ ] **Step 4: 范围自查**

Run: `git diff --stat`
Expected: 改动文件仅限：`src/domain/device.ts`（新）、`src/domain/device.test.ts`（新）、`src/domain/types.ts`、`src/domain/migration.ts`、`src/domain/defaultData.ts`、`src/domain/counter.ts`、`src/domain/sync.ts`、`src/domain/dateTime.ts`、`src/App.tsx`、`src/styles.css`、`src/components/HistoryList.tsx`、`src/components/GiftedHistoryList.tsx`、`src/components/FairyTaleBookHistory.tsx`、`src/App.test.tsx`、`src/domain/counter.test.ts`、`src/domain/sync.test.ts`、`src/domain/storage.test.ts`、`src/domain/importExport.test.ts`、`README.md`。确认无 `.worktrees/`、无同步协议/选择逻辑/默认数据/主题改动。

- [ ] **Step 5: 提交**

```bash
git add README.md
git commit -m "docs: README 更新日志 v0.4.0"
```

- [ ] **Step 6: 完成报告**

按 Task 列出：每个 Task 改动的文件、新增/修改的测试用例名（对照 spec 第 6 节测试矩阵 T1-1 至 T7-2）、既有断言调整清单（version 断言 9 处 + App fixture 6 处）。
