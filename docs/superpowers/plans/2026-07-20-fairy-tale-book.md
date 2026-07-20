# S3 童话绘本记录功能实现计划

> **For agentic workers:** Implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 S3 计数器中增加童话绘本记录功能，包含数据模型、业务逻辑、UI 对话框、历史切换显示和统计。

**Architecture:** 纯函数业务层（counter.ts）新增 `recordFairyTaleBook`，不触碰本轮数据；UI 层新增 `FairyTaleBookDialog`、改造 `HistoryList` 支持 Tab 切换。

---

## 涉及文件

| 操作 | 文件 |
|------|------|
| 修改 | `src/domain/types.ts` |
| 修改 | `src/domain/seasons.ts` |
| 修改 | `src/domain/counter.ts` |
| 修改 | `src/domain/counter.test.ts` |
| 修改 | `src/domain/migration.ts` |
| 修改 | `src/domain/defaultData.ts` |
| 修改 | `src/App.tsx` |
| 修改 | `src/App.test.tsx` |
| 修改 | `src/components/HeaderStats.tsx` |
| 修改 | `src/components/CurrentRoundPanel.tsx` |
| 修改 | `src/components/HistoryList.tsx` |
| 新增 | `src/components/FairyTaleBookDialog.tsx` |
| 新增 | `src/components/FairyTaleBookHistory.tsx` |
| 新增 | `docs/superpowers/specs/2026-07-20-fairy-tale-book-design.md` |

---

## Task 1: 数据模型定义

**文件:** `src/domain/types.ts`

- 新增 `FairyTaleBookCreatureEntry` 类型
- 新增 `FairyTaleBookRecord` 类型
- 新增 `FairyTaleBookRecordInput` 类型
- `AppData` 新增 `fairyTaleBookRecords: FairyTaleBookRecord[]`
- `AppData.version` 从 `3` 升到 `4`
- `AppStats` 新增 `fairyTaleBookRecordCount: number`

## Task 2: 固定精灵列表常量

**文件:** `src/domain/seasons.ts`

- 新增 `FAIRY_TALE_BOOK_CREATURES` 常量数组（18 只固定精灵的 id 和 name）
- 从 S3 默认精灵中排除 `s3-battlepass-zujianyuanjian` 和 `s3-battlepass-yaoyaoxiaozi`

## Task 3: 业务逻辑

**文件:** `src/domain/counter.ts`

- 新增 `recordFairyTaleBook(data, input)` 纯函数
  - 生成 ID，使用输入日期
  - 根据 input.entries 查找 creatureName 填入
  - prepend 到 `fairyTaleBookRecords`
  - 不修改 currentEncounters、totalEncounters、currentRound
- 更新 `calculateStats` 返回 `fairyTaleBookRecordCount`

## Task 4: 数据迁移

**文件:** `src/domain/migration.ts`

- `isRawAppData` 支持 version 4
- `migrateAppData` 输出 version 4，添加 `fairyTaleBookRecords: []`
- `RawAppData` 类型更新

## Task 5: 默认数据

**文件:** `src/domain/defaultData.ts`

- `createDefaultData` 返回 `fairyTaleBookRecords: []`

## Task 6: 单元测试

**文件:** `src/domain/counter.test.ts`

- 测试 `recordFairyTaleBook` 正确创建记录
- 测试 `recordFairyTaleBook` 不修改本轮数据（currentEncounters、currentRound 不变）
- 测试 `calculateStats` 返回正确 fairyTaleBookRecordCount

**文件:** `src/App.test.tsx`（如需要）

- 集成测试：记录童话绘本后本轮计数不变
- 集成测试：历史切换显示

## Task 7: FairyTaleBookDialog 组件

**文件:** `src/components/FairyTaleBookDialog.tsx`

- Props: `onSave(FairyTaleBookRecordInput)`, `onCancel()`
- 显示 18 只精灵网格
- 每只精灵：名称、+/- 按钮调 count、异色 checkbox
- 日期选择器（默认当前时间）
- 备注文本框
- 校验：至少选一只异色才能提交
- 确认/取消按钮

## Task 8: FairyTaleBookHistory 组件

**文件:** `src/components/FairyTaleBookHistory.tsx`

- Props: `records: FairyTaleBookRecord[]`
- 渲染每条童话绘本记录：
  - 日期
  - 精灵出现明细（条目 / 条目 / ...）
  - 异色标记
  - 备注（如有）
  - 空状态："还没有童话绘本记录。"

## Task 9: 修改 HeaderStats

**文件:** `src/components/HeaderStats.tsx`

- 在"获得记录"旁边新增"童话绘本 X"显示

## Task 10: 修改 CurrentRoundPanel

**文件:** `src/components/CurrentRoundPanel.tsx`

- Props 新增 `onRecordFairyTaleBook?: () => void`、`isS3Season?: boolean`
- 在面板内添加"记录童话绘本"按钮
- 仅在 `isS3Season` 时渲染

## Task 11: 修改 HistoryList

**文件:** `src/components/HistoryList.tsx`

- Props 新增 `fairyTaleBookRecords: FairyTaleBookRecord[]`
- 添加 Tab 切换按钮："获得历史" / "童话绘本"
- 根据激活 Tab 渲染对应列表
- 使用 FairyTaleBookHistory 渲染童话绘本视图

## Task 12: 修改 App.tsx

**文件:** `src/App.tsx`

- 新增状态 `fairyTaleBookRecording: boolean`
- 新增 handler `recordFairyTaleBook(input)` 调用 `counter.recordFairyTaleBook`
- 条件渲染 `FairyTaleBookDialog`
- 传递 `fairyTaleBookRecords` 到 `HistoryList`
- 传递 `onRecordFairyTaleBook` 和 seasonId 到 `CurrentRoundPanel`
- 传递 `fairyTaleBookRecordCount` 到 `HeaderStats`

## Task 13: 运行测试验证

```bash
npx vitest run
```
