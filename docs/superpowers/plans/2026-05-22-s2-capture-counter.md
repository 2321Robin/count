# S2 Capture Counter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a deployable Vite + React + TypeScript app for tracking S2 creature encounter counts, history, and local backups.

**Architecture:** The app is a browser-only SPA. Pure TypeScript modules own the data model, counter operations, storage, import/export validation, and aggregate stats; React components consume those functions and render the dashboard. Data persists as one versioned JSON object in `localStorage`.

**Tech Stack:** Vite, React, TypeScript, Vitest, Testing Library, localStorage.

---

## File Structure

- Create: `package.json` - npm scripts and dependencies.
- Create: `index.html` - Vite entry HTML.
- Create: `tsconfig.json` - TypeScript config.
- Create: `tsconfig.node.json` - TypeScript config for Vite/Vitest config files.
- Create: `vite.config.ts` - Vite and Vitest config.
- Create: `src/main.tsx` - React entrypoint.
- Create: `src/App.tsx` - top-level app state and composition.
- Create: `src/App.test.tsx` - UI smoke and interaction tests.
- Create: `src/styles.css` - minimal responsive UI styling.
- Create: `src/domain/types.ts` - persisted data types.
- Create: `src/domain/defaultData.ts` - default S2 creature seed data.
- Create: `src/domain/counter.ts` - pure counter/history/stat operations.
- Create: `src/domain/counter.test.ts` - unit tests for counter/history/stat operations.
- Create: `src/domain/storage.ts` - localStorage helpers.
- Create: `src/domain/storage.test.ts` - unit tests for storage fallback and persistence.
- Create: `src/domain/importExport.ts` - JSON import/export validation.
- Create: `src/domain/importExport.test.ts` - unit tests for import/export validation.
- Create: `src/components/HeaderStats.tsx` - aggregate stat display.
- Create: `src/components/CreatureGrid.tsx` - card grid.
- Create: `src/components/CreatureCard.tsx` - per-creature display and actions.
- Create: `src/components/CreatureEditor.tsx` - add/edit form.
- Create: `src/components/RecordDialog.tsx` - acquisition recording form.
- Create: `src/components/DataManager.tsx` - backup, import, clear, reset controls.
- Create: `src/components/HistoryList.tsx` - acquisition history.
- Create: `src/test/setup.ts` - test setup.

## Task 1: Scaffold Vite React TypeScript App

**Files:**
- Create: `package.json`
- Create: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `src/main.tsx`
- Create: `src/test/setup.ts`

- [ ] **Step 1: Create project files**

Create `package.json`:

```json
{
  "name": "s2-capture-counter",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "typescript": "latest",
    "react": "latest",
    "react-dom": "latest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "jsdom": "latest",
    "vitest": "latest"
  }
}
```

Create `index.html`:

```html
<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>S2 捕捉计数器</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

Create `vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

Create `src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Create `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: dependencies install and `package-lock.json` is created.

- [ ] **Step 3: Run initial build and expect missing app files**

Run: `npm run build`

Expected: FAIL because `src/App.tsx` and `src/styles.css` do not exist yet.

- [ ] **Step 4: Commit scaffold if this directory is a git repo**

Run: `git status --short`

Expected in current workspace: this may fail because the directory was not a git repo during planning. If it is a git repo during execution, commit with:

```bash
git add package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts src/main.tsx src/test/setup.ts
git commit -m "chore: scaffold vite react app"
```

## Task 2: Add Domain Types, Defaults, and Counter Logic

**Files:**
- Create: `src/domain/types.ts`
- Create: `src/domain/defaultData.ts`
- Create: `src/domain/counter.ts`
- Create: `src/domain/counter.test.ts`

- [ ] **Step 1: Write failing counter tests**

Create `src/domain/counter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultData } from "./defaultData";
import {
  addCreature,
  calculateStats,
  decrementEncounter,
  incrementEncounter,
  recordAcquisition,
  removeCreature,
  updateCreature,
} from "./counter";

describe("counter domain", () => {
  it("creates default data with S2 creatures", () => {
    const data = createDefaultData();

    expect(data.version).toBe(1);
    expect(data.creatures.length).toBeGreaterThan(0);
    expect(data.creatures[0]).toMatchObject({
      currentEncounters: 0,
      totalEncounters: 0,
      isDefault: true,
    });
  });

  it("increments current and total encounters", () => {
    const data = createDefaultData();
    const creatureId = data.creatures[0].id;

    const next = incrementEncounter(data, creatureId);

    expect(next.creatures[0].currentEncounters).toBe(1);
    expect(next.creatures[0].totalEncounters).toBe(1);
  });

  it("decrements counts without going below zero", () => {
    const data = createDefaultData();
    const creatureId = data.creatures[0].id;

    const next = decrementEncounter(data, creatureId);

    expect(next.creatures[0].currentEncounters).toBe(0);
    expect(next.creatures[0].totalEncounters).toBe(0);
  });

  it("records acquisition and resets current round only", () => {
    const data = createDefaultData();
    const creatureId = data.creatures[0].id;
    const counted = incrementEncounter(incrementEncounter(data, creatureId), creatureId);

    const next = recordAcquisition(counted, creatureId, {
      date: "2026-05-22",
      location: "S2 活动区",
      notes: "测试记录",
    });

    expect(next.records).toHaveLength(1);
    expect(next.records[0]).toMatchObject({
      creatureId,
      roundEncounters: 2,
      totalEncountersAtRecord: 2,
      location: "S2 活动区",
      notes: "测试记录",
    });
    expect(next.creatures[0].currentEncounters).toBe(0);
    expect(next.creatures[0].totalEncounters).toBe(2);
  });

  it("adds, updates, and removes custom creatures", () => {
    const data = createDefaultData();
    const added = addCreature(data, {
      name: "自定义精灵",
      targetCount: 500,
      location: "自定义地点",
      notes: "自定义备注",
    });
    const custom = added.creatures.at(-1)!;

    expect(custom).toMatchObject({ name: "自定义精灵", isDefault: false });

    const updated = updateCreature(added, custom.id, {
      name: "更新精灵",
      targetCount: 600,
      location: "更新地点",
      notes: "更新备注",
    });

    expect(updated.creatures.at(-1)).toMatchObject({
      name: "更新精灵",
      targetCount: 600,
    });

    const removed = removeCreature(updated, custom.id);
    expect(removed.creatures.some((creature) => creature.id === custom.id)).toBe(false);
  });

  it("calculates aggregate stats", () => {
    const data = createDefaultData();
    const creatureId = data.creatures[0].id;
    const counted = incrementEncounter(incrementEncounter(data, creatureId), creatureId);
    const recorded = recordAcquisition(counted, creatureId, {
      date: "2026-05-22",
      location: "",
      notes: "",
    });

    expect(calculateStats(recorded)).toEqual({
      creatureCount: recorded.creatures.length,
      currentRoundTotal: 0,
      historicalTotal: 2,
      recordCount: 1,
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/domain/counter.test.ts`

Expected: FAIL because domain modules do not exist.

- [ ] **Step 3: Add domain implementation**

Create `src/domain/types.ts`:

```ts
export type AppData = {
  version: 1;
  creatures: Creature[];
  records: AcquisitionRecord[];
  settings: AppSettings;
};

export type Creature = {
  id: string;
  name: string;
  targetCount: number;
  currentEncounters: number;
  totalEncounters: number;
  location: string;
  notes: string;
  isDefault: boolean;
};

export type AcquisitionRecord = {
  id: string;
  creatureId: string;
  creatureName: string;
  date: string;
  roundEncounters: number;
  totalEncountersAtRecord: number;
  location: string;
  notes: string;
};

export type AppSettings = {
  sortMode: "default";
};

export type CreatureInput = {
  name: string;
  targetCount: number;
  location: string;
  notes: string;
};

export type RecordInput = {
  date: string;
  location: string;
  notes: string;
};

export type AppStats = {
  creatureCount: number;
  currentRoundTotal: number;
  historicalTotal: number;
  recordCount: number;
};
```

Create `src/domain/defaultData.ts`:

```ts
import type { AppData, Creature } from "./types";

const defaultCreatures: Array<Pick<Creature, "id" | "name" | "targetCount" | "location" | "notes">> = [
  { id: "s2-creature-1", name: "S2 精灵 1", targetCount: 500, location: "S2 区域", notes: "等待替换为正式名称" },
  { id: "s2-creature-2", name: "S2 精灵 2", targetCount: 500, location: "S2 区域", notes: "等待替换为正式名称" },
  { id: "s2-creature-3", name: "S2 精灵 3", targetCount: 500, location: "S2 区域", notes: "等待替换为正式名称" },
];

export function createDefaultData(): AppData {
  return {
    version: 1,
    creatures: defaultCreatures.map((creature) => ({
      ...creature,
      currentEncounters: 0,
      totalEncounters: 0,
      isDefault: true,
    })),
    records: [],
    settings: { sortMode: "default" },
  };
}
```

Create `src/domain/counter.ts`:

```ts
import type { AppData, AppStats, Creature, CreatureInput, RecordInput } from "./types";

function createId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function updateCreatureById(data: AppData, creatureId: string, updater: (creature: Creature) => Creature): AppData {
  return {
    ...data,
    creatures: data.creatures.map((creature) => (creature.id === creatureId ? updater(creature) : creature)),
  };
}

export function incrementEncounter(data: AppData, creatureId: string): AppData {
  return updateCreatureById(data, creatureId, (creature) => ({
    ...creature,
    currentEncounters: creature.currentEncounters + 1,
    totalEncounters: creature.totalEncounters + 1,
  }));
}

export function decrementEncounter(data: AppData, creatureId: string): AppData {
  return updateCreatureById(data, creatureId, (creature) => ({
    ...creature,
    currentEncounters: Math.max(0, creature.currentEncounters - 1),
    totalEncounters: Math.max(0, creature.totalEncounters - 1),
  }));
}

export function recordAcquisition(data: AppData, creatureId: string, input: RecordInput): AppData {
  const creature = data.creatures.find((item) => item.id === creatureId);
  if (!creature) return data;

  return {
    ...data,
    creatures: data.creatures.map((item) =>
      item.id === creatureId ? { ...item, currentEncounters: 0 } : item,
    ),
    records: [
      {
        id: createId("record"),
        creatureId,
        creatureName: creature.name,
        date: input.date,
        roundEncounters: creature.currentEncounters,
        totalEncountersAtRecord: creature.totalEncounters,
        location: input.location,
        notes: input.notes,
      },
      ...data.records,
    ],
  };
}

export function addCreature(data: AppData, input: CreatureInput): AppData {
  return {
    ...data,
    creatures: [
      ...data.creatures,
      {
        id: createId("creature"),
        name: input.name,
        targetCount: input.targetCount,
        currentEncounters: 0,
        totalEncounters: 0,
        location: input.location,
        notes: input.notes,
        isDefault: false,
      },
    ],
  };
}

export function updateCreature(data: AppData, creatureId: string, input: CreatureInput): AppData {
  return updateCreatureById(data, creatureId, (creature) => ({ ...creature, ...input }));
}

export function removeCreature(data: AppData, creatureId: string): AppData {
  return {
    ...data,
    creatures: data.creatures.filter((creature) => creature.id !== creatureId),
    records: data.records.filter((record) => record.creatureId !== creatureId),
  };
}

export function calculateStats(data: AppData): AppStats {
  return {
    creatureCount: data.creatures.length,
    currentRoundTotal: data.creatures.reduce((sum, creature) => sum + creature.currentEncounters, 0),
    historicalTotal: data.creatures.reduce((sum, creature) => sum + creature.totalEncounters, 0),
    recordCount: data.records.length,
  };
}
```

- [ ] **Step 4: Run counter tests**

Run: `npm test -- src/domain/counter.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit domain logic if this directory is a git repo**

```bash
git add src/domain/types.ts src/domain/defaultData.ts src/domain/counter.ts src/domain/counter.test.ts
git commit -m "feat: add counter domain logic"
```

## Task 3: Add Storage and Import/Export Validation

**Files:**
- Create: `src/domain/storage.ts`
- Create: `src/domain/storage.test.ts`
- Create: `src/domain/importExport.ts`
- Create: `src/domain/importExport.test.ts`

- [ ] **Step 1: Write failing storage and import/export tests**

Create `src/domain/storage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultData } from "./defaultData";
import { loadAppData, saveAppData, STORAGE_KEY } from "./storage";

describe("storage", () => {
  beforeEach(() => localStorage.clear());

  it("loads defaults when storage is empty", () => {
    const data = loadAppData();

    expect(data.version).toBe(1);
    expect(data.creatures.length).toBeGreaterThan(0);
  });

  it("saves and loads app data", () => {
    const data = createDefaultData();
    const changed = { ...data, creatures: [{ ...data.creatures[0], name: "已保存" }] };

    saveAppData(changed);

    expect(loadAppData().creatures[0].name).toBe("已保存");
  });

  it("falls back to defaults for malformed storage", () => {
    localStorage.setItem(STORAGE_KEY, "not json");

    expect(loadAppData().version).toBe(1);
  });
});
```

Create `src/domain/importExport.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDefaultData } from "./defaultData";
import { exportAppData, parseImportedData } from "./importExport";

describe("import export", () => {
  it("exports formatted JSON", () => {
    const json = exportAppData(createDefaultData());

    expect(JSON.parse(json).version).toBe(1);
    expect(json).toContain("\n");
  });

  it("parses valid imported data", () => {
    const data = createDefaultData();
    const result = parseImportedData(JSON.stringify(data));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data.creatures).toHaveLength(data.creatures.length);
  });

  it("rejects malformed JSON", () => {
    const result = parseImportedData("not json");

    expect(result).toEqual({ ok: false, error: "导入文件不是有效的 JSON。" });
  });

  it("rejects data with missing required fields", () => {
    const result = parseImportedData(JSON.stringify({ version: 1, creatures: [] }));

    expect(result).toEqual({ ok: false, error: "导入数据结构不完整。" });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test -- src/domain/storage.test.ts src/domain/importExport.test.ts`

Expected: FAIL because storage and import/export modules do not exist.

- [ ] **Step 3: Add storage and import/export implementation**

Create `src/domain/importExport.ts`:

```ts
import type { AppData, Creature } from "./types";

export type ImportResult = { ok: true; data: AppData } | { ok: false; error: string };

function isCreature(value: unknown): value is Creature {
  if (!value || typeof value !== "object") return false;
  const creature = value as Record<string, unknown>;
  return (
    typeof creature.id === "string" &&
    typeof creature.name === "string" &&
    typeof creature.targetCount === "number" &&
    typeof creature.currentEncounters === "number" &&
    typeof creature.totalEncounters === "number" &&
    typeof creature.location === "string" &&
    typeof creature.notes === "string" &&
    typeof creature.isDefault === "boolean"
  );
}

export function isAppData(value: unknown): value is AppData {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return (
    data.version === 1 &&
    Array.isArray(data.creatures) &&
    data.creatures.every(isCreature) &&
    Array.isArray(data.records) &&
    Boolean(data.settings) &&
    typeof data.settings === "object"
  );
}

export function parseImportedData(raw: string): ImportResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "导入文件不是有效的 JSON。" };
  }

  if (!isAppData(parsed)) {
    return { ok: false, error: "导入数据结构不完整。" };
  }

  return { ok: true, data: parsed };
}

export function exportAppData(data: AppData): string {
  return JSON.stringify(data, null, 2);
}
```

Create `src/domain/storage.ts`:

```ts
import { createDefaultData } from "./defaultData";
import { isAppData } from "./importExport";
import type { AppData } from "./types";

export const STORAGE_KEY = "s2-capture-counter:data";

export function loadAppData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultData();

    const parsed: unknown = JSON.parse(raw);
    return isAppData(parsed) ? parsed : createDefaultData();
  } catch {
    return createDefaultData();
  }
}

export function saveAppData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
```

- [ ] **Step 4: Run storage and import/export tests**

Run: `npm test -- src/domain/storage.test.ts src/domain/importExport.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit storage/import logic if this directory is a git repo**

```bash
git add src/domain/storage.ts src/domain/storage.test.ts src/domain/importExport.ts src/domain/importExport.test.ts
git commit -m "feat: add local backup data handling"
```

## Task 4: Build React UI Components

**Files:**
- Create: `src/App.tsx`
- Create: `src/components/HeaderStats.tsx`
- Create: `src/components/CreatureGrid.tsx`
- Create: `src/components/CreatureCard.tsx`
- Create: `src/components/CreatureEditor.tsx`
- Create: `src/components/RecordDialog.tsx`
- Create: `src/components/DataManager.tsx`
- Create: `src/components/HistoryList.tsx`
- Create: `src/styles.css`

- [ ] **Step 1: Write failing UI tests**

Create `src/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";

describe("App", () => {
  beforeEach(() => localStorage.clear());

  it("renders the counter dashboard", () => {
    render(<App />);

    expect(screen.getByRole("heading", { name: "S2 捕捉计数器" })).toBeInTheDocument();
    expect(screen.getByText("S2 精灵 1")).toBeInTheDocument();
  });

  it("increments a creature encounter count", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getAllByRole("button", { name: "+1" })[0]);

    expect(screen.getByText("本轮 1")).toBeInTheDocument();
    expect(screen.getByText("历史 1")).toBeInTheDocument();
  });

  it("adds a custom creature", async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole("button", { name: "新增精灵" }));
    await user.type(screen.getByLabelText("名称"), "新精灵");
    await user.clear(screen.getByLabelText("目标次数"));
    await user.type(screen.getByLabelText("目标次数"), "300");
    await user.click(screen.getByRole("button", { name: "保存精灵" }));

    expect(screen.getByText("新精灵")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run UI tests to verify failure**

Run: `npm test -- src/App.test.tsx`

Expected: FAIL because UI files do not exist.

- [ ] **Step 3: Add UI component implementation**

Create `src/components/HeaderStats.tsx`:

```tsx
import type { AppStats } from "../domain/types";

type Props = { stats: AppStats };

export function HeaderStats({ stats }: Props) {
  return (
    <section className="stats" aria-label="总体统计">
      <div><span>{stats.creatureCount}</span><small>精灵</small></div>
      <div><span>{stats.currentRoundTotal}</span><small>本轮遭遇</small></div>
      <div><span>{stats.historicalTotal}</span><small>历史遭遇</small></div>
      <div><span>{stats.recordCount}</span><small>获得记录</small></div>
    </section>
  );
}
```

Create `src/components/CreatureCard.tsx`:

```tsx
import type { Creature } from "../domain/types";

type Props = {
  creature: Creature;
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onEdit: (creature: Creature) => void;
  onRecord: (creature: Creature) => void;
  onRemove: (id: string) => void;
};

export function CreatureCard({ creature, onIncrement, onDecrement, onEdit, onRecord, onRemove }: Props) {
  const percent = creature.targetCount > 0 ? Math.min(100, Math.round((creature.currentEncounters / creature.targetCount) * 100)) : 0;

  return (
    <article className="card">
      <div className="cardHeader">
        <div>
          <h2>{creature.name}</h2>
          <p>{creature.location || "未设置地点/活动"}</p>
        </div>
        <button type="button" className="ghost" onClick={() => onEdit(creature)}>编辑</button>
      </div>
      <div className="numbers">
        <strong>本轮 {creature.currentEncounters}</strong>
        <span>历史 {creature.totalEncounters}</span>
        <span>目标 {creature.targetCount}</span>
      </div>
      <div className="progress" aria-label={`${creature.name} 进度 ${percent}%`}>
        <div style={{ width: `${percent}%` }} />
      </div>
      {creature.notes && <p className="notes">{creature.notes}</p>}
      <div className="actions">
        <button type="button" className="primary" onClick={() => onIncrement(creature.id)}>+1</button>
        <button type="button" onClick={() => onDecrement(creature.id)}>-1</button>
        <button type="button" onClick={() => onRecord(creature)}>记录获得</button>
        {!creature.isDefault && <button type="button" className="danger" onClick={() => onRemove(creature.id)}>删除</button>}
      </div>
    </article>
  );
}
```

Create `src/components/CreatureGrid.tsx`:

```tsx
import type { Creature } from "../domain/types";
import { CreatureCard } from "./CreatureCard";

type Props = {
  creatures: Creature[];
  onIncrement: (id: string) => void;
  onDecrement: (id: string) => void;
  onEdit: (creature: Creature) => void;
  onRecord: (creature: Creature) => void;
  onRemove: (id: string) => void;
};

export function CreatureGrid(props: Props) {
  return (
    <section className="grid" aria-label="精灵计数列表">
      {props.creatures.map((creature) => (
        <CreatureCard key={creature.id} creature={creature} {...props} />
      ))}
    </section>
  );
}
```

Create `src/components/CreatureEditor.tsx`:

```tsx
import { useState } from "react";
import type { Creature, CreatureInput } from "../domain/types";

type Props = {
  creature: Creature | null;
  onSave: (input: CreatureInput) => void;
  onCancel: () => void;
};

export function CreatureEditor({ creature, onSave, onCancel }: Props) {
  const [name, setName] = useState(creature?.name ?? "");
  const [targetCount, setTargetCount] = useState(String(creature?.targetCount ?? 500));
  const [location, setLocation] = useState(creature?.location ?? "");
  const [notes, setNotes] = useState(creature?.notes ?? "");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onSave({
      name: name.trim() || "未命名精灵",
      targetCount: Math.max(1, Number(targetCount) || 1),
      location: location.trim(),
      notes: notes.trim(),
    });
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>{creature ? "编辑精灵" : "新增精灵"}</h2>
      <label>名称<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>目标次数<input type="number" min="1" value={targetCount} onChange={(event) => setTargetCount(event.target.value)} /></label>
      <label>地点/活动<input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
      <label>备注<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <div className="row"><button type="submit">保存精灵</button><button type="button" onClick={onCancel}>取消</button></div>
    </form>
  );
}
```

Create `src/components/RecordDialog.tsx`:

```tsx
import { useState } from "react";
import type { Creature, RecordInput } from "../domain/types";

type Props = {
  creature: Creature;
  onSave: (input: RecordInput) => void;
  onCancel: () => void;
};

export function RecordDialog({ creature, onSave, onCancel }: Props) {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [location, setLocation] = useState(creature.location);
  const [notes, setNotes] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    onSave({ date, location: location.trim(), notes: notes.trim() });
  }

  return (
    <form className="panel" onSubmit={submit}>
      <h2>记录获得：{creature.name}</h2>
      <p>本轮 {creature.currentEncounters}，历史 {creature.totalEncounters}</p>
      <label>日期<input type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
      <label>地点/活动<input value={location} onChange={(event) => setLocation(event.target.value)} /></label>
      <label>备注<textarea value={notes} onChange={(event) => setNotes(event.target.value)} /></label>
      <div className="row"><button type="submit">保存记录</button><button type="button" onClick={onCancel}>取消</button></div>
    </form>
  );
}
```

Create `src/components/DataManager.tsx`:

```tsx
type Props = {
  message: string;
  onExport: () => void;
  onImport: (file: File) => void;
  onClear: () => void;
  onReset: () => void;
};

export function DataManager({ message, onExport, onImport, onClear, onReset }: Props) {
  return (
    <section className="panel">
      <h2>数据管理</h2>
      <div className="row">
        <button type="button" onClick={onExport}>导出 JSON</button>
        <label className="fileButton">导入 JSON<input type="file" accept="application/json" onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onImport(file);
          event.currentTarget.value = "";
        }} /></label>
        <button type="button" className="danger" onClick={onClear}>清空所有数据</button>
        <button type="button" onClick={onReset}>重置默认数据</button>
      </div>
      {message && <p className="message">{message}</p>}
    </section>
  );
}
```

Create `src/components/HistoryList.tsx`:

```tsx
import type { AcquisitionRecord } from "../domain/types";

type Props = { records: AcquisitionRecord[] };

export function HistoryList({ records }: Props) {
  return (
    <section className="panel">
      <h2>获得历史</h2>
      {records.length === 0 ? <p>还没有记录。</p> : (
        <ul className="history">
          {records.map((record) => (
            <li key={record.id}>
              <strong>{record.creatureName}</strong>
              <span>{record.date}</span>
              <span>本轮 {record.roundEncounters}</span>
              <span>历史 {record.totalEncountersAtRecord}</span>
              {record.location && <span>{record.location}</span>}
              {record.notes && <em>{record.notes}</em>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```

Create `src/App.tsx`:

```tsx
import { useEffect, useState } from "react";
import { CreatureEditor } from "./components/CreatureEditor";
import { CreatureGrid } from "./components/CreatureGrid";
import { DataManager } from "./components/DataManager";
import { HeaderStats } from "./components/HeaderStats";
import { HistoryList } from "./components/HistoryList";
import { RecordDialog } from "./components/RecordDialog";
import { addCreature, calculateStats, decrementEncounter, incrementEncounter, recordAcquisition, removeCreature, updateCreature } from "./domain/counter";
import { createDefaultData } from "./domain/defaultData";
import { exportAppData, parseImportedData } from "./domain/importExport";
import { loadAppData, saveAppData } from "./domain/storage";
import type { AppData, Creature, CreatureInput, RecordInput } from "./domain/types";

export default function App() {
  const [data, setData] = useState<AppData>(() => loadAppData());
  const [editing, setEditing] = useState<Creature | null | "new">(null);
  const [recording, setRecording] = useState<Creature | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => saveAppData(data), [data]);

  function apply(next: AppData) {
    setData(next);
    setMessage("");
  }

  function saveCreature(input: CreatureInput) {
    if (editing && editing !== "new") apply(updateCreature(data, editing.id, input));
    else apply(addCreature(data, input));
    setEditing(null);
  }

  function saveRecord(input: RecordInput) {
    if (recording) apply(recordAcquisition(data, recording.id, input));
    setRecording(null);
  }

  function exportData() {
    const blob = new Blob([exportAppData(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "s2-capture-counter-backup.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  async function importData(file: File) {
    const result = parseImportedData(await file.text());
    if (!result.ok) {
      setMessage(result.error);
      return;
    }
    apply(result.data);
    setMessage("导入成功。");
  }

  function clearData() {
    if (window.confirm("确定清空所有数据？此操作不可撤销。")) apply({ version: 1, creatures: [], records: [], settings: { sortMode: "default" } });
  }

  function resetData() {
    if (window.confirm("确定重置为默认数据？当前记录会被清空。")) apply(createDefaultData());
  }

  return (
    <main className="app">
      <header className="hero">
        <div>
          <p className="eyebrow">Roco World S2</p>
          <h1>S2 捕捉计数器</h1>
          <p>按精灵记录遭遇次数、本轮进度和获得历史。</p>
        </div>
        <button type="button" onClick={() => setEditing("new")}>新增精灵</button>
      </header>
      <HeaderStats stats={calculateStats(data)} />
      {editing && <CreatureEditor creature={editing === "new" ? null : editing} onSave={saveCreature} onCancel={() => setEditing(null)} />}
      {recording && <RecordDialog creature={recording} onSave={saveRecord} onCancel={() => setRecording(null)} />}
      <CreatureGrid
        creatures={data.creatures}
        onIncrement={(id) => apply(incrementEncounter(data, id))}
        onDecrement={(id) => apply(decrementEncounter(data, id))}
        onEdit={setEditing}
        onRecord={setRecording}
        onRemove={(id) => apply(removeCreature(data, id))}
      />
      <DataManager message={message} onExport={exportData} onImport={importData} onClear={clearData} onReset={resetData} />
      <HistoryList records={data.records} />
    </main>
  );
}
```

Create `src/styles.css`:

```css
:root { color: #172033; background: #f6f7f9; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
* { box-sizing: border-box; }
body { margin: 0; }
button, input, textarea { font: inherit; }
button, .fileButton { border: 1px solid #cfd6e4; border-radius: 12px; background: #fff; color: #172033; padding: 0.7rem 0.9rem; cursor: pointer; }
button:hover, .fileButton:hover { border-color: #7a8aa0; }
.primary { background: #172033; color: #fff; border-color: #172033; font-size: 1.2rem; font-weight: 800; }
.ghost { background: transparent; }
.danger { color: #b42318; border-color: #f1b8b2; }
.app { width: min(1120px, calc(100% - 24px)); margin: 0 auto; padding: 24px 0 48px; }
.hero, .stats, .panel, .card { background: #fff; border: 1px solid #e2e7ef; border-radius: 20px; box-shadow: 0 10px 30px rgba(23, 32, 51, 0.06); }
.hero { display: flex; justify-content: space-between; gap: 16px; align-items: center; padding: 24px; margin-bottom: 16px; }
.hero h1 { margin: 0; font-size: clamp(2rem, 5vw, 3.5rem); }
.hero p { margin: 0.35rem 0 0; color: #5d6b82; }
.eyebrow { color: #52637a; text-transform: uppercase; letter-spacing: 0.14em; font-size: 0.75rem; font-weight: 800; }
.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1px; overflow: hidden; margin-bottom: 16px; }
.stats div { padding: 18px; background: #fff; }
.stats span { display: block; font-size: 1.7rem; font-weight: 900; }
.stats small { color: #66758c; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; margin: 16px 0; }
.card { padding: 18px; }
.cardHeader { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
.card h2, .panel h2 { margin: 0 0 8px; }
.card p { margin: 0; color: #66758c; }
.numbers { display: grid; gap: 6px; margin: 18px 0; }
.numbers strong { font-size: 2rem; }
.numbers span { color: #4c5a70; }
.progress { height: 10px; background: #edf1f6; border-radius: 999px; overflow: hidden; margin-bottom: 12px; }
.progress div { height: 100%; background: #172033; }
.notes { border-left: 3px solid #d9e0ea; padding-left: 10px; }
.actions, .row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.panel { padding: 18px; margin: 16px 0; }
.panel label { display: grid; gap: 6px; margin-bottom: 12px; color: #4c5a70; }
.panel input, .panel textarea { width: 100%; border: 1px solid #d8deea; border-radius: 12px; padding: 0.75rem; }
.panel textarea { min-height: 88px; resize: vertical; }
.fileButton input { display: none; }
.message { color: #335c0f; }
.history { list-style: none; padding: 0; margin: 0; display: grid; gap: 10px; }
.history li { display: flex; flex-wrap: wrap; gap: 10px; padding: 12px; border: 1px solid #e2e7ef; border-radius: 14px; }
.history span, .history em { color: #66758c; }
@media (max-width: 720px) { .hero { align-items: stretch; flex-direction: column; } .stats { grid-template-columns: repeat(2, 1fr); } .actions button { flex: 1 1 42%; } }
```

- [ ] **Step 4: Run UI tests**

Run: `npm test -- src/App.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit UI if this directory is a git repo**

```bash
git add src/App.tsx src/App.test.tsx src/components src/styles.css
git commit -m "feat: build counter dashboard ui"
```

## Task 5: Full Verification and Deployment Readiness

**Files:**
- Modify only if verification exposes failures in files created above.

- [ ] **Step 1: Run all tests**

Run: `npm test`

Expected: PASS for `counter.test.ts`, `storage.test.ts`, `importExport.test.ts`, and `App.test.tsx`.

- [ ] **Step 2: Run production build**

Run: `npm run build`

Expected: PASS and `dist/` is created.

- [ ] **Step 3: Preview production build**

Run: `npm run preview`

Expected: Vite prints a local preview URL. Open it and verify the page renders.

- [ ] **Step 4: Manual browser verification**

Verify these flows in the preview page:

- Click `+1` on the first creature twice; current round and history both show 2.
- Click `-1`; current round and history both show 1.
- Add a custom creature named `测试精灵` with target `300`; it appears in the grid.
- Edit `测试精灵` to target `400`; the card shows target 400.
- Click `记录获得`; save with today's date; history contains the record and current round resets.
- Export JSON; the downloaded file contains `version`, `creatures`, `records`, and `settings`.
- Import the exported JSON; UI remains usable and shows imported data.
- Try importing invalid JSON; existing data remains unchanged and an error message appears.
- Use `清空所有数据`; confirmation appears before clearing.
- Use `重置默认数据`; confirmation appears before restoring default creatures.
- Resize to mobile width; cards, buttons, and forms remain usable.

- [ ] **Step 5: Commit verification fixes if this directory is a git repo**

If files changed during verification, run:

```bash
git add src package.json package-lock.json index.html tsconfig.json tsconfig.node.json vite.config.ts
git commit -m "fix: polish s2 counter verification issues"
```

If no files changed, do not create an empty commit.

## Self-Review

- Spec coverage: The plan covers Vite + React + TypeScript, browser-only storage, per-creature encounter tracking, default and custom creatures, current and historical counts, acquisition records, JSON import/export, clear/reset actions, minimal responsive UI, and tests.
- Placeholder scan: The plan contains no open implementation markers requiring later decisions. Default S2 creature entries are intentionally generic seed data matching the approved design until exact names are provided.
- Type consistency: `AppData`, `Creature`, `AcquisitionRecord`, `CreatureInput`, `RecordInput`, and `AppStats` are defined once in `types.ts` and reused consistently by domain and UI tasks.
