# S3 童话绘本记录功能设计

## 背景

S3 赛季捕捉精灵新增了一个特殊机制"童话绘本"：每次触发时有 10 只精灵出现，其中必定有至少一只异色。这 10 只精灵不算入保底机制，不影响正常计数。

当前计数器缺少记录童话绘本出现的功能，用户需要手动记录每次童话绘本的触发情况。

## 目标

在现有 S3 计数器中增加童话绘本记录功能，满足：
1. 记录每次童话绘本中出现的精灵及次数
2. 标记其中哪些是异色
3. 在获得历史模块中可切换查看
4. 记录童话绘本不影响当前正在进行的一轮计数

## 范围

本次实现范围：
- 新增童话绘本记录的数据模型和业务逻辑
- 新增记录对话框 UI
- 修改获得历史模块支持切换显示
- 修改统计显示
- 固定使用 S3 默认 20 只精灵中排除"足尖元件"和"咬咬小子"后的 18 只
- 仅在 S3 赛季显示相关功能

不涉及：
- 不修改现有获得记录的数据模型和逻辑
- 不修改本轮计数机制
- 不修改 S2 赛季

## 技术方案

### 数据模型

在 `types.ts` 中新增：

```typescript
export type FairyTaleBookCreatureEntry = {
  creatureId: string;
  creatureName: string;
  count: number;
};

export type FairyTaleBookRecord = {
  id: string;
  date: string;
  entries: FairyTaleBookCreatureEntry[];
  shinyCreatureIds: string[];
  notes: string;
};
```

`AppData` 新增字段：
- `fairyTaleBookRecords: FairyTaleBookRecord[]`
- `version` 从 `3` 升到 `4`

`AppStats` 新增字段：
- `fairyTaleBookRecordCount: number`

### 固定精灵列表

在 `seasons.ts` 中定义：

```typescript
export const FAIRY_TALE_BOOK_CREATURE_IDS = [
  "s3-adventure-baomizai",
  "s3-adventure-shouyezhu",
  "s3-adventure-shizikedou",
  "s3-adventure-lishu",
  "s3-adventure-hudietaotao",
  "s3-adventure-daocaoren",
  "s3-adventure-miguohai",
  "s3-adventure-kabo",
  "s3-normal-yibeier",
  "s3-normal-keliji",
  "s3-normal-doudingyu",
  "s3-normal-haikuichong-original",
  "s3-normal-haikuichong-worn",
  "s3-normal-dishu-dry",
  "s3-normal-dishu-water",
  "s3-normal-xiaocaochong",
  "s3-normal-xiaoyu",
  "s3-normal-banban",
];
```

来自 S3 默认精灵列表，排除 `s3-battlepass-zujianyuanjian`（足尖元件）和 `s3-battlepass-yaoyaoxiaozi`（咬咬小子）。

### 业务逻辑

在 `counter.ts` 中新增纯函数 `recordFairyTaleBook(data, input)`：
- 接受当前 AppData 和 FairyTaleBookRecordInput
- 创建 FairyTaleBookRecord（自动生成 id、使用当前时间）
- 将记录 prepend 到 `fairyTaleBookRecords` 数组
- **不修改**任何 `creature.currentEncounters`、`creature.totalEncounters`、`currentRound`
- 返回新的 AppData

```typescript
export type FairyTaleBookRecordInput = {
  date: string;
  entries: { creatureId: string; count: number }[];
  shinyCreatureIds: string[];
  notes: string;
};
```

### 数据迁移

在 `migration.ts` 中：
- v3 → v4 迁移：添加 `fairyTaleBookRecords: []`
- `isRawAppData` 验证新增 v4 支持
- `migrateAppData` 输出 version 4

### 存储

`storage.ts` 无需修改——`saveAppData`/`loadAppData` 已通用处理所有 AppData 字段。

### UI 变更

#### CurrentRoundPanel
- 在面板内新增"记录童话绘本"按钮
- 仅在 `seasonId === "s3"` 时显示

#### FairyTaleBookDialog（新增组件）
- 显示 18 只固定精灵的网格
- 每只精灵显示名称，带 +/- 按钮调整出现次数（最小 0）
- 每只精灵带一个 checkbox 标记是否为异色
- 至少选择一只异色才能提交
- 日期选择器（默认当前时间）
- 备注文本框
- 确认/取消按钮
- 确认后调用 `onSave(input)`，不修改本轮数据

#### HistoryList 改造
- 增加 Tab 切换："获得历史" / "童话绘本"
- "获得历史"显示原有的 `AcquisitionRecord` 列表（不变）
- "童话绘本"显示 `FairyTaleBookRecord` 列表：

  每条记录显示：
  - 日期
  - 精灵出现明细：`苞米仔 ×3 / 守夜烛 ×2 / ...`
  - 异色标记：`✨ 异色：苞米仔、伊贝儿`
  - 备注（如有）

#### HeaderStats
- 在"获得记录"旁边新增"童话绘本 X"
- 即统计区显示：`获得记录 15` `童话绘本 3`

### 核心约束

`recordFairyTaleBook` 是纯日志操作：
- 不调用 `incrementEncounter` / `decrementEncounter`
- 不修改 `creature.currentEncounters`
- 不修改 `creature.totalEncounters`
- 不修改 `currentRound`
- 不影响 `getCurrentRoundTotal` / `getCurrentRoundBreakdown` 的结果

## 组件树变更

```
App
├── ...
├── CurrentRoundPanel
│   └── [新增] "记录童话绘本" 按钮 (S3 only)
├── ...
├── HeaderStats
│   └── [修改] 新增童话绘本统计
├── [新增] FairyTaleBookDialog (条件渲染)
├── ...
├── HistoryList
│   └── [修改] Tab 切换: "获得历史" / "童话绘本"
│       ├── [原] 获得历史列表
│       └── [新增] 童话绘本列表
└── ...
```

## 测试策略

业务逻辑层单元测试：
- `recordFairyTaleBook` 不修改本轮数据
- `recordFairyTaleBook` 正确追加记录
- `calculateStats` 正确返回童话绘本记录数
- 迁移测试：v3 数据迁移到 v4 后包含空 `fairyTaleBookRecords`

UI 组件测试（可选）：
- Dialog 渲染、交互
- HistoryList Tab 切换

## 开放细节

- 对话框中的精灵列表按 S3 默认顺序排列（奇遇在前，普通在后）
- FairyTaleBookDialog 的精灵名称直接从 seasons.ts 的默认数据中获取显示名
- 日期格式与现有记录一致（datetime-local）
