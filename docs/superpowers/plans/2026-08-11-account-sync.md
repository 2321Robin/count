# 账号登录与按账号多端同步 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为《捕捉计数器》增加用户名+密码账号系统：数据按账号存到自有服务器（SQLite），登录后多端自动同步，匿名本地模式与 GitHub Gist 同步原样保留。

**Architecture:** 同仓库新增 `server/` 目录（Hono + better-sqlite3 + bcryptjs），与现有静态站同源部署（Nginx `/api` 反代）。前端登录后 localStorage 切换为按用户命名空间，同步层新增 server 路径并复用 App.tsx 现有 hydration/debounce 逻辑；GitHub Gist 路径（`sync.ts`）一行不改。

**Tech Stack:** Hono（`@hono/node-server`）、better-sqlite3、bcryptjs、tsx（开发运行）、React（现有）、vitest（现有，server 测试用 `// @vitest-environment node`）。

## Global Constraints

1. 提交信息沿用仓库惯例：`feat:` / `fix:` / `test:` / `docs:` 前缀 + 中文描述。
2. 每个 Task 结束时 `npm test`（vitest run）与 `npm run build`（`tsc -b && tsc -p server && vite build`）必须通过（Task 内各步允许只跑单文件测试，任务末跑全量）。
3. 不修改 `.worktrees/` 目录下任何文件。
4. 现有匿名 localStorage key（`s2-capture-counter:data` / `s3-capture-counter:data`）不变；`src/domain/sync.ts`（Gist 路径）一行不改。
5. UI 文案一律中文；时间显示统一 `new Date(...).toLocaleString("zh-CN", { hour12: false })`。
6. 数据 API 单次请求体上限 2MB；会话有效期 30 天；注册/登录按 IP 限流默认 5 次/分钟。
7. server 测试文件第一行必须是 `// @vitest-environment node`（根 vitest 默认 jsdom）。
8. 设计规格：`docs/superpowers/specs/2026-08-11-account-sync-design.md`（已提交，commit `d1a4194`）。

---

### Task 1: server 脚手架与数据库层

**Files:**
- Modify: `package.json`（依赖与脚本）
- Create: `server/tsconfig.json`
- Create: `server/db.ts`
- Test: `server/db.test.ts`

**Interfaces:**
- Consumes: 无（本仓库第一个 server 文件）
- Produces:
  - `export type Db = Database.Database`（better-sqlite3 实例类型）
  - `export function createDb(filename: string): Db`（`:memory:` 或文件路径；文件路径自动创建父目录）
  - `export function initSchema(db: Db): void`（建三张表，幂等）
  - 根 package.json 新增脚本：`build` 追加 `tsc -p server`；新增 `dev:server` / `start:server`

- [ ] **Step 1: 安装依赖并更新脚本**

Run:
```bash
npm install hono @hono/node-server better-sqlite3 bcryptjs
npm install -D @types/better-sqlite3 tsx
```
Expected: 安装成功，`package-lock.json` 更新。

把 `package.json` 的 scripts 改为：

```json
"scripts": {
  "dev": "vite",
  "dev:server": "tsx watch server/index.ts",
  "build": "tsc -b && tsc -p server && vite build",
  "preview": "vite preview",
  "start:server": "node server/dist/index.js",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 2: 写 server tsconfig**

Create `server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "types": ["node"],
    "sourceMap": false,
    "declaration": false
  },
  "include": ["**/*.ts"],
  "exclude": ["dist", "**/*.test.ts"]
}
```

- [ ] **Step 3: 写失败测试**

Create `server/db.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createDb, initSchema } from "./db.js";
import type { Db } from "./db.js";

function freshDb(): Db {
  return createDb(":memory:");
}

describe("db schema", () => {
  it("creates the three tables", () => {
    const db = freshDb();
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as { name: string }[];
    expect(tables.map((row) => row.name)).toEqual(["sessions", "season_data", "users"]);
  });

  it("enforces one row per user per season", () => {
    const db = freshDb();
    const insert = db.prepare("INSERT INTO season_data (user_id, season_id, data_json, updated_at, revision) VALUES (?, ?, ?, ?, 1)");
    insert.run(1, "s2", "{}", "2026-08-11T00:00:00.000Z");
    expect(() => insert.run(1, "s2", "{}", "2026-08-11T00:00:00.000Z")).toThrow();
    insert.run(1, "s3", "{}", "2026-08-11T00:00:00.000Z");
    insert.run(2, "s2", "{}", "2026-08-11T00:00:00.000Z");
  });

  it("initializes the schema idempotently", () => {
    const db = freshDb();
    initSchema(db);
    initSchema(db);
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all() as { name: string }[];
    expect(tables.some((row) => row.name === "users")).toBe(true);
  });

  it("creates the parent directory for a file database", () => {
    const db = createDb("counter-data/test-dir/db.sqlite");
    db.close();
  });
});
```

- [ ] **Step 4: 运行测试确认失败**

Run: `npx vitest run server/db.test.ts`
Expected: FAIL（`Cannot find module './db.js'` 或模块不存在）。

- [ ] **Step 5: 实现 db.ts**

Create `server/db.ts`:

```ts
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type Db = Database.Database;

export function initSchema(db: Db): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      is_admin      INTEGER NOT NULL DEFAULT 0,
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL REFERENCES users(id),
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS season_data (
      user_id    INTEGER NOT NULL REFERENCES users(id),
      season_id  TEXT NOT NULL,
      data_json  TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      revision   INTEGER NOT NULL DEFAULT 1,
      PRIMARY KEY (user_id, season_id)
    );
  `);
}

export function createDb(filename: string): Db {
  if (filename !== ":memory:") mkdirSync(dirname(filename), { recursive: true });
  const db = new Database(filename);
  initSchema(db);
  return db;
}
```

注意：Task 3 Step 4 会新增 `counter-data/` 到 `.gitignore`（本地开发冒烟用的 db 文件不入库）。

- [ ] **Step 6: 运行测试确认通过**

Run: `npx vitest run server/db.test.ts`
Expected: PASS（4 个用例）。

- [ ] **Step 7: 全量验证 + 提交**

Run: `npm test && npm run build`
Expected: 全部通过（server/dist 生成）。

```bash
git add package.json package-lock.json server/tsconfig.json server/db.ts server/db.test.ts
git commit -m "feat: server 脚手架与 SQLite 数据库层"
```

---

### Task 2: 认证与限流

**Files:**
- Create: `server/rateLimit.ts`
- Create: `server/auth.ts`
- Test: `server/rateLimit.test.ts`、`server/auth.test.ts`

**Interfaces:**
- Consumes: `Db`、`initSchema`（Task 1）
- Produces:
  - `export type RateLimitOptions = { limit: number; windowMs: number }`
  - `export function createRateLimiter(options: RateLimitOptions): (key: string) => { allowed: boolean; retryAfterSec: number }`
  - `export type UserRow`、`export type PublicUser = { userId: number; username: string; isAdmin: boolean }`
  - `export function validateUsername(username: string): string | null`（2–32 位字母/数字/下划线/中文）
  - `export function validatePassword(password: string): string | null`（8–72 位）
  - `export async function hashPassword(password: string): Promise<string>`、`verifyPassword(password: string, passwordHash: string): Promise<boolean>`
  - `export function createSessionToken(): string`、`hashSessionToken(token: string): string`
  - `export async function registerUser(db: Db, username: string, password: string): Promise<{ ok: true; user: PublicUser } | { ok: false; error: string }>`
  - `export async function verifyLogin(db: Db, username: string, password: string): Promise<PublicUser | null>`
  - `export function insertSession(db: Db, userId: number): string`（返回原始 token，库里只存哈希；30 天过期）
  - `export function getUserBySessionToken(db: Db, token: string): PublicUser | null`
  - `export function deleteSession(db: Db, token: string): void`
  - `export async function resetUserPassword(db: Db, username: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }>`（顺带踢掉该用户所有会话）

- [ ] **Step 1: 写失败测试**

Create `server/rateLimit.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rateLimit.js";

describe("rate limiter", () => {
  it("allows requests within the window and blocks after the limit", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 60_000 });
    expect(check("ip-1").allowed).toBe(true);
    expect(check("ip-1").allowed).toBe(true);
    const blocked = check("ip-1");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("tracks different keys independently", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 60_000 });
    expect(check("ip-1").allowed).toBe(true);
    expect(check("ip-2").allowed).toBe(true);
    expect(check("ip-1").allowed).toBe(false);
  });

  it("resets after the window elapses", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 1_000 });
    expect(check("ip-1").allowed).toBe(true);
    expect(check("ip-1").allowed).toBe(false);
    expect(check("ip-1").allowed).toBe(true); // 1s 窗口已过
  });
});
```

Create `server/auth.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createDb } from "./db.js";
import type { Db } from "./db.js";
import {
  deleteSession,
  getUserBySessionToken,
  hashSessionToken,
  insertSession,
  registerUser,
  resetUserPassword,
  validatePassword,
  validateUsername,
  verifyLogin,
} from "./auth.js";

function freshDb(): Db {
  return createDb(":memory:");
}

describe("auth", () => {
  it("rejects invalid usernames and passwords", () => {
    expect(validateUsername("a")).not.toBeNull();
    expect(validateUsername("")).not.toBeNull();
    expect(validateUsername("ab cd")).not.toBeNull();
    expect(validateUsername("阿伟")).not.toBeNull();
    expect(validateUsername("alice_123")).toBeNull();
    expect(validatePassword("short")).not.toBeNull();
    expect(validatePassword("password1")).toBeNull();
    expect(validatePassword("x".repeat(73))).not.toBeNull();
  });

  it("registers a user and rejects duplicates", async () => {
    const db = freshDb();
    const first = await registerUser(db, "alice", "password1");
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.user).toEqual({ userId: 1, username: "alice", isAdmin: false });
    const dup = await registerUser(db, "alice", "password1");
    expect(dup).toEqual({ ok: false, error: "用户名已被注册。" });
    const invalid = await registerUser(db, "a", "password1");
    expect(invalid.ok).toBe(false);
  });

  it("logs in with the right password only", async () => {
    const db = freshDb();
    await registerUser(db, "alice", "password1");
    expect(await verifyLogin(db, "alice", "password1")).not.toBeNull();
    expect(await verifyLogin(db, "alice", "wrong")).toBeNull();
    expect(await verifyLogin(db, "nobody", "password1")).toBeNull();
  });

  it("creates sessions that round-trip through the token hash and expire", async () => {
    const db = freshDb();
    await registerUser(db, "alice", "password1");
    const token = insertSession(db, 1);
    expect(token.length).toBeGreaterThanOrEqual(32);
    const user = getUserBySessionToken(db, token);
    expect(user).toEqual({ userId: 1, username: "alice", isAdmin: false });
    expect(getUserBySessionToken(db, hashSessionToken(token))).toBeNull(); // 传哈希当 token 无效
    expect(getUserBySessionToken(db, "bogus")).toBeNull();
    expect(getUserBySessionToken(db, "")).toBeNull();

    db.prepare("UPDATE sessions SET expires_at = ?").run(new Date(Date.now() - 1000).toISOString());
    expect(getUserBySessionToken(db, token)).toBeNull();

    deleteSession(db, token);
    expect(getUserBySessionToken(db, token)).toBeNull();
  });

  it("resets a password and revokes existing sessions", async () => {
    const db = freshDb();
    await registerUser(db, "alice", "password1");
    const token = insertSession(db, 1);
    const result = await resetUserPassword(db, "alice", "new-password-2");
    expect(result).toEqual({ ok: true });
    expect(await verifyLogin(db, "alice", "new-password-2")).not.toBeNull();
    expect(await verifyLogin(db, "alice", "password1")).toBeNull();
    expect(getUserBySessionToken(db, token)).toBeNull();
    const missing = await resetUserPassword(db, "nobody", "new-password-2");
    expect(missing).toEqual({ ok: false, error: "找不到该用户。" });
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run server/rateLimit.test.ts server/auth.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 rateLimit.ts**

Create `server/rateLimit.ts`:

```ts
export type RateLimitOptions = { limit: number; windowMs: number };

export function createRateLimiter(options: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): { allowed: boolean; retryAfterSec: number } => {
    const now = Date.now();
    const entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs });
      return { allowed: true, retryAfterSec: 0 };
    }
    if (entry.count >= options.limit) {
      return { allowed: false, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
    }
    entry.count += 1;
    return { allowed: true, retryAfterSec: 0 };
  };
}
```

- [ ] **Step 4: 实现 auth.ts**

Create `server/auth.ts`:

```ts
import { compare, hash } from "bcryptjs";
import { createHash, randomBytes } from "node:crypto";
import type { Db } from "./db.js";

export type UserRow = { id: number; username: string; password_hash: string; is_admin: number; created_at: string };
export type PublicUser = { userId: number; username: string; isAdmin: boolean };

const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const USERNAME_PATTERN = /^[\p{L}\p{N}_-]{2,32}$/u;

export function validateUsername(username: string): string | null {
  if (!USERNAME_PATTERN.test(username)) return "用户名需为 2–32 位字母、数字、下划线或中文。";
  return null;
}

export function validatePassword(password: string): string | null {
  if (password.length < 8) return "密码至少 8 位。";
  if (password.length > 72) return "密码不能超过 72 位。";
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export type RegisterResult = { ok: true; user: PublicUser } | { ok: false; error: string };

export async function registerUser(db: Db, username: string, password: string): Promise<RegisterResult> {
  const name = username.trim();
  const nameError = validateUsername(name);
  if (nameError) return { ok: false, error: nameError };
  const pwError = validatePassword(password);
  if (pwError) return { ok: false, error: pwError };
  const existing = db.prepare("SELECT id FROM users WHERE username = ?").get(name);
  if (existing) return { ok: false, error: "用户名已被注册。" };
  const passwordHash = await hashPassword(password);
  const createdAt = new Date().toISOString();
  const result = db.prepare("INSERT INTO users (username, password_hash, is_admin, created_at) VALUES (?, ?, 0, ?)").run(name, passwordHash, createdAt);
  return { ok: true, user: { userId: Number(result.lastInsertRowid), username: name, isAdmin: false } };
}

export async function verifyLogin(db: Db, username: string, password: string): Promise<PublicUser | null> {
  const row = db.prepare("SELECT id, username, is_admin, password_hash FROM users WHERE username = ?").get(username.trim()) as UserRow | undefined;
  if (!row) return null;
  if (!(await verifyPassword(password, row.password_hash))) return null;
  return { userId: row.id, username: row.username, isAdmin: row.is_admin === 1 };
}

export function insertSession(db: Db, userId: number): string {
  const token = createSessionToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS).toISOString();
  db.prepare("INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .run(hashSessionToken(token), userId, now.toISOString(), expiresAt);
  return token;
}

export function getUserBySessionToken(db: Db, token: string): PublicUser | null {
  if (!token) return null;
  const row = db.prepare(
    `SELECT u.id AS id, u.username AS username, u.is_admin AS is_admin
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ?`
  ).get(hashSessionToken(token), new Date().toISOString()) as { id: number; username: string; is_admin: number } | undefined;
  if (!row) return null;
  return { userId: row.id, username: row.username, isAdmin: row.is_admin === 1 };
}

export function deleteSession(db: Db, token: string): void {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(hashSessionToken(token));
}

export type ResetResult = { ok: true } | { ok: false; error: string };

export async function resetUserPassword(db: Db, username: string, newPassword: string): Promise<ResetResult> {
  const pwError = validatePassword(newPassword);
  if (pwError) return { ok: false, error: pwError };
  const row = db.prepare("SELECT id FROM users WHERE username = ?").get(username.trim()) as { id: number } | undefined;
  if (!row) return { ok: false, error: "找不到该用户。" };
  const passwordHash = await hashPassword(newPassword);
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(passwordHash, row.id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(row.id);
  return { ok: true };
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run server/rateLimit.test.ts server/auth.test.ts`
Expected: PASS。

- [ ] **Step 6: 全量验证 + 提交**

Run: `npm test && npm run build`
Expected: 全部通过。

```bash
git add server/rateLimit.ts server/rateLimit.test.ts server/auth.ts server/auth.test.ts
git commit -m "feat: server 认证模块与登录限流"
```

---

### Task 3: 数据 API 与 HTTP 入口

**Files:**
- Create: `server/app.ts`
- Create: `server/index.ts`
- Test: `server/app.test.ts`
- Modify: `vite.config.ts`（dev 代理）、`.gitignore`（`counter-data/`）

**Interfaces:**
- Consumes: `Db`/`initSchema`（Task 1）、auth 全部导出（Task 2）、`createRateLimiter`（Task 2）
- Produces:
  - `export type AppOptions = { rateLimit?: { limit: number; windowMs: number } }`
  - `export function createApp(db: Db, options?: AppOptions): Hono`（7 个端点；cookie 名 `counter_session`；`NODE_ENV=production` 时 cookie 加 `Secure`）
  - `server/index.ts`：`COUNTER_DB_PATH`（默认 `counter-data/db.sqlite`）、`PORT`（默认 8787），`tsx watch server/index.ts` 开发运行
  - API 契约（供 Task 4 客户端实现）：
    - `POST /api/register` / `POST /api/login`：body `{username, password}`；成功 201/200 返回 `{userId, username, isAdmin}` 并 Set-Cookie；失败 400/401/429 返回 `{error}`
    - `POST /api/logout`：204
    - `GET /api/me`：200 `{userId, username, isAdmin}`；未登录 401 `{error:"未登录。"}`
    - `GET /api/data/:season`：200 `{data: AppData | null, updatedAt: string | null, revision: number | null}`；需登录
    - `PUT /api/data/:season`：body 为 AppData JSON；成功 200 `{updatedAt, revision}`；体超 2MB 413；非 JSON 或不含 `version: number` + `creatures: Array` 400；需登录
    - `POST /api/admin/reset-password`：body `{username, newPassword}`；仅管理员，成功 200 `{ok:true}`，否则 401/403/400 `{error}`

- [ ] **Step 1: 写失败测试**

Create `server/app.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { createDb } from "./db.js";
import type { Db } from "./db.js";

function freshApp(rateLimit?: { limit: number; windowMs: number }) {
  const db = createDb(":memory:");
  return { db, app: createApp(db, { rateLimit: rateLimit ?? { limit: 1000, windowMs: 60_000 } }) };
}

function sessionTokenFrom(response: Response): string {
  const match = /counter_session=([^;]+)/.exec(response.headers.get("set-cookie") ?? "");
  if (!match) throw new Error("no session cookie in response");
  return match[1];
}

function authHeaders(token: string): Record<string, string> {
  return { Cookie: `counter_session=${token}` };
}

const VALID_DATA = {
  version: 5,
  creatures: [{ id: "c1", name: "精灵一号", targetCount: 80, currentEncounters: 3, totalEncounters: 3, location: "", notes: "", isDefault: true }],
  records: [],
  giftedRecords: [],
  fairyTaleBookRecords: [],
  currentRound: null,
  settings: { sortMode: "default" },
  meta: { lastModifiedAt: "2026-08-11T00:00:00.000Z", lastModifiedBy: "computer" },
};

describe("counter api", () => {
  it("registers, reads /api/me, and logs out", async () => {
    const { app } = freshApp();
    const register = await app.request("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "alice", password: "password1" }),
    });
    expect(register.status).toBe(201);
    const token = sessionTokenFrom(register);

    const me = await app.request("/api/me", { headers: authHeaders(token) });
    expect(me.status).toBe(200);
    expect(await me.json()).toEqual({ userId: 1, username: "alice", isAdmin: false });

    const logout = await app.request("/api/logout", { method: "POST", headers: authHeaders(token) });
    expect(logout.status).toBe(204);
    expect((await app.request("/api/me", { headers: authHeaders(token) })).status).toBe(401);
  });

  it("rejects duplicate registration and bad credentials", async () => {
    const { app } = freshApp();
    const body = JSON.stringify({ username: "alice", password: "password1" });
    const headers = { "Content-Type": "application/json" };
    expect((await app.request("/api/register", { method: "POST", headers, body })).status).toBe(201);
    const dup = await app.request("/api/register", { method: "POST", headers, body });
    expect(dup.status).toBe(400);
    expect((await dup.json() as { error: string }).error).toBe("用户名已被注册。");

    const badLogin = await app.request("/api/login", { method: "POST", headers, body: JSON.stringify({ username: "alice", password: "wrong-pass" }) });
    expect(badLogin.status).toBe(401);

    const goodLogin = await app.request("/api/login", { method: "POST", headers, body });
    expect(goodLogin.status).toBe(200);
    expect(sessionTokenFrom(goodLogin).length).toBeGreaterThan(0);
  });

  it("round-trips season data per user", async () => {
    const { app } = freshApp();
    const headers = { "Content-Type": "application/json" };
    const token = sessionTokenFrom(await app.request("/api/register", { method: "POST", headers, body: JSON.stringify({ username: "alice", password: "password1" }) }));
    const auth = authHeaders(token);

    const empty = await app.request("/api/data/s3", { headers: auth });
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ data: null, updatedAt: null, revision: null });

    const put = await app.request("/api/data/s3", { method: "PUT", headers: { ...headers, ...auth }, body: JSON.stringify(VALID_DATA) });
    expect(put.status).toBe(200);
    const putBody = await put.json() as { updatedAt: string; revision: number };
    expect(putBody.revision).toBe(1);

    const get = await app.request("/api/data/s3", { headers: auth });
    const getBody = await get.json() as { data: unknown; updatedAt: string; revision: number };
    expect(getBody.revision).toBe(1);
    expect(getBody.data).toEqual(VALID_DATA);

    const put2 = await app.request("/api/data/s3", { method: "PUT", headers: { ...headers, ...auth }, body: JSON.stringify({ ...VALID_DATA, meta: { ...VALID_DATA.meta, lastModifiedAt: "2026-08-11T01:00:00.000Z" } }) });
    expect(((await put2.json()) as { revision: number }).revision).toBe(2);

    // 赛季隔离：s2 为空
    const s2 = await app.request("/api/data/s2", { headers: auth });
    expect(((await s2.json()) as { data: unknown }).data).toBeNull();

    // 用户隔离：bob 看不到 alice 的数据
    const bobToken = sessionTokenFrom(await app.request("/api/register", { method: "POST", headers, body: JSON.stringify({ username: "bob", password: "password1" }) }));
    const bobGet = await app.request("/api/data/s3", { headers: authHeaders(bobToken) });
    expect(((await bobGet.json()) as { data: unknown }).data).toBeNull();
  });

  it("rejects invalid seasons, bodies, and oversized payloads", async () => {
    const { app } = freshApp();
    const headers = { "Content-Type": "application/json" };
    const token = sessionTokenFrom(await app.request("/api/register", { method: "POST", headers, body: JSON.stringify({ username: "alice", password: "password1" }) }));
    const auth = authHeaders(token);

    expect((await app.request("/api/data/s4", { headers: auth })).status).toBe(400);
    expect((await app.request("/api/data/s3", { method: "PUT", headers: { ...headers, ...auth }, body: "not json" })).status).toBe(400);
    expect((await app.request("/api/data/s3", { method: "PUT", headers: { ...headers, ...auth }, body: JSON.stringify({ version: 5 }) })).status).toBe(400);
    expect((await app.request("/api/data/s3", { method: "PUT", headers: { ...headers, ...auth }, body: JSON.stringify({ version: 5, creatures: [] }, null, 0).padEnd(2_000_001, "x") })).status).toBe(413);
  });

  it("requires login for data endpoints", async () => {
    const { app } = freshApp();
    expect((await app.request("/api/data/s3")).status).toBe(401);
    expect((await app.request("/api/data/s3", { method: "PUT", body: "{}" })).status).toBe(401);
    expect((await app.request("/api/admin/reset-password", { method: "POST", body: "{}" })).status).toBe(401);
  });

  it("lets an admin reset another user's password", async () => {
    const { app, db } = freshApp();
    const headers = { "Content-Type": "application/json" };
    const register = async (username: string) => {
      const res = await app.request("/api/register", { method: "POST", headers, body: JSON.stringify({ username, password: "password1" }) });
      return sessionTokenFrom(res);
    };
    const aliceToken = await register("alice");
    await register("bob");
    db.prepare("UPDATE users SET is_admin = 1 WHERE username = 'alice'").run();

    const denied = await app.request("/api/admin/reset-password", { method: "POST", headers: { ...headers, ...authHeaders(await register("carol")) }, body: JSON.stringify({ username: "bob", newPassword: "brand-new-3" }) });
    expect(denied.status).toBe(403);

    const ok = await app.request("/api/admin/reset-password", { method: "POST", headers: { ...headers, ...authHeaders(aliceToken) }, body: JSON.stringify({ username: "bob", newPassword: "brand-new-3" }) });
    expect(ok.status).toBe(200);

    const login = await app.request("/api/login", { method: "POST", headers, body: JSON.stringify({ username: "bob", password: "brand-new-3" }) });
    expect(login.status).toBe(200);
  });

  it("rate limits register and login", async () => {
    const { app } = freshApp({ limit: 2, windowMs: 60_000 });
    const headers = { "Content-Type": "application/json" };
    const body = JSON.stringify({ username: "alice", password: "password1" });
    expect((await app.request("/api/register", { method: "POST", headers, body })).status).toBe(201);
    expect((await app.request("/api/register", { method: "POST", headers, body })).status).toBe(400); // 重复用户名，仍计数
    const third = await app.request("/api/register", { method: "POST", headers, body });
    expect(third.status).toBe(429);
    expect((await third.json() as { error: string }).error).toContain("操作太频繁");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run server/app.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 app.ts**

Create `server/app.ts`:

```ts
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { Context, Next } from "hono";
import { deleteSession, getUserBySessionToken, insertSession, registerUser, resetUserPassword, verifyLogin } from "./auth.js";
import { createRateLimiter } from "./rateLimit.js";
import type { Db } from "./db.js";

const SEASON_IDS = ["s2", "s3"] as const;
type SeasonId = (typeof SEASON_IDS)[number];
function isSeasonId(value: string): value is SeasonId {
  return value === "s2" || value === "s3";
}

type AppDataShape = { version: number; creatures: unknown[]; [key: string]: unknown };
function isAppDataShape(value: unknown): value is AppDataShape {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.version === "number" && Array.isArray(record.creatures);
}

const SESSION_COOKIE = "counter_session";
const MAX_DATA_BYTES = 2_000_000;
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export type AppOptions = { rateLimit?: { limit: number; windowMs: number } };

type Env = { Variables: { userId: number; isAdmin: boolean } };

export function createApp(db: Db, options: AppOptions = {}) {
  const app = new Hono<Env>();
  const rateLimit = createRateLimiter(options.rateLimit ?? { limit: 5, windowMs: 60_000 });
  const isProd = process.env.NODE_ENV === "production";

  function clientIp(c: Context): string {
    return c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  }

  const requireUser = async (c: Context<Env>, next: Next) => {
    const user = getUserBySessionToken(db, getCookie(c, SESSION_COOKIE) ?? "");
    if (!user) return c.json({ error: "未登录。" }, 401);
    c.set("userId", user.userId);
    c.set("isAdmin", user.isAdmin);
    await next();
  };

  app.get("/api/me", (c) => {
    const user = getUserBySessionToken(db, getCookie(c, SESSION_COOKIE) ?? "");
    if (!user) return c.json({ error: "未登录。" }, 401);
    return c.json({ userId: user.userId, username: user.username, isAdmin: user.isAdmin });
  });

  app.post("/api/register", async (c) => {
    const check = rateLimit(clientIp(c));
    if (!check.allowed) return c.json({ error: `操作太频繁，请 ${check.retryAfterSec} 秒后再试。` }, 429);
    const body = await c.req.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
    const username = typeof body?.username === "string" ? body.username : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const result = await registerUser(db, username, password);
    if (!result.ok) return c.json({ error: result.error }, 400);
    const token = insertSession(db, result.user.userId);
    setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: "Lax", secure: isProd, maxAge: SESSION_MAX_AGE, path: "/" });
    return c.json({ userId: result.user.userId, username: result.user.username, isAdmin: result.user.isAdmin }, 201);
  });

  app.post("/api/login", async (c) => {
    const check = rateLimit(clientIp(c));
    if (!check.allowed) return c.json({ error: `操作太频繁，请 ${check.retryAfterSec} 秒后再试。` }, 429);
    const body = await c.req.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
    const username = typeof body?.username === "string" ? body.username : "";
    const password = typeof body?.password === "string" ? body.password : "";
    const user = await verifyLogin(db, username, password);
    if (!user) return c.json({ error: "用户名或密码错误。" }, 401);
    const token = insertSession(db, user.userId);
    setCookie(c, SESSION_COOKIE, token, { httpOnly: true, sameSite: "Lax", secure: isProd, maxAge: SESSION_MAX_AGE, path: "/" });
    return c.json({ userId: user.userId, username: user.username, isAdmin: user.isAdmin });
  });

  app.post("/api/logout", (c) => {
    deleteSession(db, getCookie(c, SESSION_COOKIE) ?? "");
    deleteCookie(c, SESSION_COOKIE);
    return c.body(null, 204);
  });

  app.use("/api/data/*", requireUser);
  app.use("/api/admin/*", requireUser);

  app.get("/api/data/:season", (c) => {
    const season = c.req.param("season");
    if (!isSeasonId(season)) return c.json({ error: "无效的赛季。" }, 400);
    const row = db.prepare("SELECT data_json, updated_at, revision FROM season_data WHERE user_id = ? AND season_id = ?")
      .get(c.get("userId"), season) as { data_json: string; updated_at: string; revision: number } | undefined;
    if (!row) return c.json({ data: null, updatedAt: null, revision: null });
    return c.json({ data: JSON.parse(row.data_json), updatedAt: row.updated_at, revision: row.revision });
  });

  app.put("/api/data/:season", async (c) => {
    const season = c.req.param("season");
    if (!isSeasonId(season)) return c.json({ error: "无效的赛季。" }, 400);
    const raw = await c.req.text();
    if (raw.length > MAX_DATA_BYTES) return c.json({ error: "数据过大。" }, 413);
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return c.json({ error: "数据格式错误。" }, 400);
    }
    if (!isAppDataShape(parsed)) return c.json({ error: "数据格式错误。" }, 400);
    const userId = c.get("userId");
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO season_data (user_id, season_id, data_json, updated_at, revision) VALUES (?, ?, ?, ?, 1)
       ON CONFLICT(user_id, season_id) DO UPDATE SET data_json = excluded.data_json, updated_at = excluded.updated_at, revision = season_data.revision + 1`
    ).run(userId, season, raw, now);
    const row = db.prepare("SELECT revision FROM season_data WHERE user_id = ? AND season_id = ?").get(userId, season) as { revision: number };
    return c.json({ updatedAt: now, revision: row.revision });
  });

  app.post("/api/admin/reset-password", async (c) => {
    if (!c.get("isAdmin")) return c.json({ error: "没有权限。" }, 403);
    const body = await c.req.json().catch(() => null) as { username?: unknown; newPassword?: unknown } | null;
    const username = typeof body?.username === "string" ? body.username : "";
    const newPassword = typeof body?.newPassword === "string" ? body.newPassword : "";
    const result = await resetUserPassword(db, username, newPassword);
    if (!result.ok) return c.json({ error: result.error }, 400);
    return c.json({ ok: true });
  });

  return app;
}
```

- [ ] **Step 4: 实现 index.ts 与开发代理**

Create `server/index.ts`:

```ts
import { serve } from "@hono/node-server";
import { createApp } from "./app.js";
import { createDb } from "./db.js";

const dbPath = process.env.COUNTER_DB_PATH ?? "counter-data/db.sqlite";
const port = Number(process.env.PORT ?? 8787);

const db = createDb(dbPath);
const app = createApp(db);

serve({ fetch: app.fetch, port });
console.log(`counter-api listening on http://127.0.0.1:${port} (db: ${dbPath})`);
```

修改 `vite.config.ts` 为：

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": "http://127.0.0.1:8787",
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts",
  },
});
```

在 `.gitignore` 末尾追加一行：`counter-data/`

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run server/app.test.ts`
Expected: PASS（6 个用例）。

- [ ] **Step 6: 手动冒烟**

Run:
```bash
npm run dev:server
```
另开终端：`npm run dev`，浏览器打开 `http://localhost:5173/`，在地址栏直接访问 `http://localhost:5173/api/me`。
Expected: `{"error":"未登录。"}`（说明代理与 server 连通）。用 `curl -X POST http://localhost:5173/api/register -H "Content-Type: application/json" -d '{"username":"smoke","password":"password1"}'` 应返回 201 + Set-Cookie。验证后 Ctrl+C 停掉 `dev:server`，并删除本地 `counter-data/` 目录（冒烟产物）。

- [ ] **Step 7: 全量验证 + 提交**

Run: `npm test && npm run build`
Expected: 全部通过。

```bash
git add server/app.ts server/app.test.ts server/index.ts vite.config.ts .gitignore
git commit -m "feat: server 数据 API 与 HTTP 入口"
```

---

### Task 4: 前端 serverSync 客户端

**Files:**
- Create: `src/domain/serverSync.ts`
- Test: `src/domain/serverSync.test.ts`

**Interfaces:**
- Consumes: Task 3 的 API 契约；`AppData`、`SeasonId`（src/domain/types.ts、seasons.ts）；`migrateAppData`（migration.ts）
- Produces（Task 6/7 消费）:
  - `export type Session = { userId: number; username: string; isAdmin: boolean }`
  - `export type MigrationState = { kind: "upload-local" } | { kind: "choose"; cloudUpdatedAt: string; localModifiedAt: string }`
  - `export function loadSession(): Session | null`、`saveSession(session: Session): void`、`clearSession(): void`（localStorage key `s2-capture-counter:session`）
  - `export async function registerAccount(username: string, password: string): Promise<AuthResult>`、`loginAccount(...)`、`logoutAccount(): Promise<void>`、`fetchMe(): Promise<Session | null>`、`adminResetPassword(username: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }>`
  - `export type AuthResult = { ok: true; session: Session } | { ok: false; error: string }`
  - `export type ServerDataPull = { ok: true; empty: false; data: AppData; updatedAt: string } | { ok: true; empty: true } | { ok: false; error: string }`
  - `export async function pullFromServer(seasonId: SeasonId): Promise<ServerDataPull>`（云端 JSON 用 `migrateAppData` 升级）
  - `export type ServerDataPush = { ok: true; updatedAt: string } | { ok: false; error: string }`
  - `export async function pushToServer(data: AppData, seasonId: SeasonId): Promise<ServerDataPush>`
  - `export function loadLastServerUpdatedAt(seasonId: SeasonId, userId: number): string | null`、`saveLastServerUpdatedAt(...)`、`clearLastServerUpdatedAt(...)`（key `s2-capture-counter:<userId>:last-server-updated-at:<seasonId>`）

- [ ] **Step 1: 写失败测试**

Create `src/domain/serverSync.test.ts`：

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  adminResetPassword,
  clearLastServerUpdatedAt,
  clearSession,
  fetchMe,
  loadLastServerUpdatedAt,
  loadSession,
  loginAccount,
  logoutAccount,
  pullFromServer,
  pushToServer,
  registerAccount,
  saveLastServerUpdatedAt,
  saveSession,
} from "./serverSync";
import type { AppData } from "./types";

const DATA: AppData = {
  version: 5,
  creatures: [{ id: "c1", name: "精灵一号", targetCount: 80, currentEncounters: 3, totalEncounters: 3, location: "", notes: "", isDefault: true }],
  records: [],
  giftedRecords: [],
  fairyTaleBookRecords: [],
  currentRound: null,
  settings: { sortMode: "default" },
  meta: { lastModifiedAt: "2026-08-11T00:00:00.000Z", lastModifiedBy: "computer" },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

describe("serverSync", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    localStorage.clear();
    vi.stubGlobal("fetch", vi.fn());
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
```

（`DATA` 对象加 `: AppData` 类型标注并通过 `import type { AppData } from "./types"` 引入，避免 `records: []` 等被推断为 `never[]` 导致断言不通过。）

```ts
  it("registers and returns the session", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ userId: 7, username: "alice", isAdmin: false }, 201)));
    const result = await registerAccount("alice", "password1");
    expect(result).toEqual({ ok: true, session: { userId: 7, username: "alice", isAdmin: false } });
    expect(fetch).toHaveBeenCalledWith("/api/register", expect.objectContaining({ method: "POST", body: expect.stringContaining("alice") }));
  });

  it("maps auth errors from the server", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "用户名已被注册。" }, 400)));
    const result = await registerAccount("alice", "password1");
    expect(result).toEqual({ ok: false, error: "用户名已被注册。" });
  });

  it("maps login failures and network errors", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "用户名或密码错误。" }, 401)));
    expect(await loginAccount("alice", "wrong")).toEqual({ ok: false, error: "用户名或密码错误。" });
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network"); }));
    expect(await loginAccount("alice", "password1")).toEqual({ ok: false, error: "无法连接服务器，请检查网络。" });
  });

  it("keeps the session in localStorage and fetches /api/me", async () => {
    const session = { userId: 1, username: "alice", isAdmin: false };
    saveSession(session);
    expect(loadSession()).toEqual(session);
    clearSession();
    expect(loadSession()).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ userId: 1, username: "alice", isAdmin: false })));
    expect(await fetchMe()).toEqual(session);
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "未登录。" }, 401)));
    expect(await fetchMe()).toBeNull();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network"); }));
    expect(await fetchMe()).toBeNull();
  });

  it("logs out and resets passwords", async () => {
    const logoutFetch = vi.fn(async () => new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", logoutFetch);
    await logoutAccount();
    expect(logoutFetch).toHaveBeenCalledWith("/api/logout", expect.objectContaining({ method: "POST" }));

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ ok: true })));
    expect(await adminResetPassword("bob", "brand-new-3")).toEqual({ ok: true });
  });

  it("pulls empty and populated cloud data, migrating old versions", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: null, updatedAt: null, revision: null })));
    expect(await pullFromServer("s3")).toEqual({ ok: true, empty: true });

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ data: DATA, updatedAt: "2026-08-11T02:00:00.000Z", revision: 2 })));
    const pull = await pullFromServer("s3");
    expect(pull).toMatchObject({ ok: true, empty: false, updatedAt: "2026-08-11T02:00:00.000Z" });
    if (pull.ok && !pull.empty) expect(pull.data.creatures[0].name).toBe("精灵一号");

    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ error: "未登录。" }, 401)));
    expect(await pullFromServer("s3")).toEqual({ ok: false, error: "拉取失败：登录已过期，请重新登录。" });
  });

  it("pushes data and returns the server timestamp", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ updatedAt: "2026-08-11T03:00:00.000Z", revision: 3 })));
    expect(await pushToServer(DATA, "s3")).toEqual({ ok: true, updatedAt: "2026-08-11T03:00:00.000Z" });
    expect(fetch).toHaveBeenCalledWith("/api/data/s3", expect.objectContaining({ method: "PUT" }));

    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("network"); }));
    expect(await pushToServer(DATA, "s3")).toEqual({ ok: false, error: "上传失败：无法连接服务器，请检查网络。" });
  });

  it("stores the last server updated-at per user and season", () => {
    saveLastServerUpdatedAt("s2", 1, "2026-08-11T00:00:00.000Z");
    saveLastServerUpdatedAt("s3", 1, "2026-08-11T01:00:00.000Z");
    expect(loadLastServerUpdatedAt("s2", 1)).toBe("2026-08-11T00:00:00.000Z");
    expect(loadLastServerUpdatedAt("s3", 1)).toBe("2026-08-11T01:00:00.000Z");
    expect(loadLastServerUpdatedAt("s2", 2)).toBeNull();
    clearLastServerUpdatedAt("s2", 1);
    expect(loadLastServerUpdatedAt("s2", 1)).toBeNull();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/domain/serverSync.test.ts`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 serverSync.ts**

Create `src/domain/serverSync.ts`:

```ts
import { migrateAppData } from "./migration";
import type { SeasonId } from "./seasons";
import type { AppData } from "./types";

export type Session = { userId: number; username: string; isAdmin: boolean };

export type MigrationState =
  | { kind: "upload-local" }
  | { kind: "choose"; cloudUpdatedAt: string; localModifiedAt: string };

const SESSION_STORAGE_KEY = "s2-capture-counter:session";

export function loadSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const record = parsed as Record<string, unknown>;
    if (typeof record.userId !== "number" || typeof record.username !== "string" || typeof record.isAdmin !== "boolean") return null;
    return { userId: record.userId, username: record.username, isAdmin: record.isAdmin };
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_STORAGE_KEY);
}

export type AuthResult = { ok: true; session: Session } | { ok: false; error: string };

function authError(prefix: string, status: number): string {
  if (status === 401) return `${prefix}失败：用户名或密码错误，或登录已过期。`;
  if (status === 429) return `${prefix}失败：操作太频繁，请稍后再试。`;
  return `${prefix}失败：服务器返回 ${status}。`;
}

async function authRequest(path: string, username: string, password: string, prefix: string): Promise<AuthResult> {
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password }),
    });
    const payload = await response.json().catch(() => null) as { error?: unknown; userId?: unknown; username?: unknown; isAdmin?: unknown } | null;
    if (!response.ok) return { ok: false, error: typeof payload?.error === "string" ? payload.error : authError(prefix, response.status) };
    if (typeof payload?.userId !== "number" || typeof payload.username !== "string") return { ok: false, error: "服务器返回异常。" };
    return { ok: true, session: { userId: payload.userId, username: payload.username, isAdmin: payload.isAdmin === true } };
  } catch {
    return { ok: false, error: "无法连接服务器，请检查网络。" };
  }
}

export function registerAccount(username: string, password: string): Promise<AuthResult> {
  return authRequest("/api/register", username, password, "注册");
}

export function loginAccount(username: string, password: string): Promise<AuthResult> {
  return authRequest("/api/login", username, password, "登录");
}

export async function logoutAccount(): Promise<void> {
  try {
    await fetch("/api/logout", { method: "POST", credentials: "same-origin" });
  } catch {
    // 网络失败也继续清除本地会话；服务端会话会自然过期。
  }
}

export async function fetchMe(): Promise<Session | null> {
  try {
    const response = await fetch("/api/me", { credentials: "same-origin" });
    if (!response.ok) return null;
    const payload = await response.json() as { userId?: unknown; username?: unknown; isAdmin?: unknown };
    if (typeof payload.userId !== "number" || typeof payload.username !== "string") return null;
    return { userId: payload.userId, username: payload.username, isAdmin: payload.isAdmin === true };
  } catch {
    return null;
  }
}

export async function adminResetPassword(username: string, newPassword: string): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const response = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, newPassword }),
    });
    const payload = await response.json().catch(() => null) as { error?: unknown } | null;
    if (!response.ok) return { ok: false, error: typeof payload?.error === "string" ? payload.error : "重置失败：服务器返回 " + response.status + "。" };
    return { ok: true };
  } catch {
    return { ok: false, error: "无法连接服务器，请检查网络。" };
  }
}

export type ServerDataPull =
  | { ok: true; empty: false; data: AppData; updatedAt: string }
  | { ok: true; empty: true }
  | { ok: false; error: string };

function dataError(prefix: string, status: number): string {
  if (status === 401) return `${prefix}失败：登录已过期，请重新登录。`;
  if (status === 429) return `${prefix}失败：操作太频繁，请稍后再试。`;
  return `${prefix}失败：服务器返回 ${status}。`;
}

export async function pullFromServer(seasonId: SeasonId): Promise<ServerDataPull> {
  try {
    const response = await fetch(`/api/data/${seasonId}`, { credentials: "same-origin" });
    if (!response.ok) return { ok: false, error: dataError("拉取", response.status) };
    const payload = await response.json() as { data?: unknown; updatedAt?: unknown };
    if (payload.data === null || payload.data === undefined) return { ok: true, empty: true };
    if (typeof payload.updatedAt !== "string") return { ok: false, error: "服务器返回异常。" };
    const data = migrateAppData(payload.data, seasonId);
    if (!data) return { ok: false, error: "拉取失败：云端数据格式无效。" };
    return { ok: true, empty: false, data, updatedAt: payload.updatedAt };
  } catch {
    return { ok: false, error: "拉取失败：无法连接服务器，请检查网络。" };
  }
}

export type ServerDataPush = { ok: true; updatedAt: string } | { ok: false; error: string };

export async function pushToServer(data: AppData, seasonId: SeasonId): Promise<ServerDataPush> {
  try {
    const response = await fetch(`/api/data/${seasonId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(data),
    });
    if (!response.ok) return { ok: false, error: dataError("上传", response.status) };
    const payload = await response.json() as { updatedAt?: unknown };
    if (typeof payload.updatedAt !== "string") return { ok: false, error: "服务器返回异常。" };
    return { ok: true, updatedAt: payload.updatedAt };
  } catch {
    return { ok: false, error: "上传失败：无法连接服务器，请检查网络。" };
  }
}

export function lastServerUpdatedAtKey(seasonId: SeasonId, userId: number): string {
  return `s2-capture-counter:${userId}:last-server-updated-at:${seasonId}`;
}

export function loadLastServerUpdatedAt(seasonId: SeasonId, userId: number): string | null {
  return localStorage.getItem(lastServerUpdatedAtKey(seasonId, userId));
}

export function saveLastServerUpdatedAt(seasonId: SeasonId, userId: number, updatedAt: string): void {
  localStorage.setItem(lastServerUpdatedAtKey(seasonId, userId), updatedAt);
}

export function clearLastServerUpdatedAt(seasonId: SeasonId, userId: number): void {
  localStorage.removeItem(lastServerUpdatedAtKey(seasonId, userId));
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/domain/serverSync.test.ts`
Expected: PASS。

- [ ] **Step 5: 全量验证 + 提交**

Run: `npm test && npm run build`
Expected: 全部通过。

```bash
git add src/domain/serverSync.ts src/domain/serverSync.test.ts
git commit -m "feat: 前端账号与云端数据客户端"
```

---

### Task 5: 存储命名空间

**Files:**
- Modify: `src/domain/storage.ts`
- Test: `src/domain/storage.test.ts`

**Interfaces:**
- Consumes: `getSeasonConfig`、`SeasonId`、`migrateAppData`、`AppData`（现有）
- Produces:
  - `export function seasonStorageKey(seasonId: SeasonId, userId: number | null): string`（匿名 → 现有 key；登录 → `s2-capture-counter:<userId>:data` / `s3-capture-counter:<userId>:data`）
  - `loadAppData(seasonId: SeasonId, userId?: number | null): LoadAppDataResult`（第二个参数默认 `null`，现有调用不变）
  - `saveAppData(seasonId: SeasonId, data: AppData, userId?: number | null): void`

- [ ] **Step 1: 写失败测试**

在 `src/domain/storage.test.ts` 顶部把 import 行改为：

```ts
import { loadAppData, saveAppData, S2_STORAGE_KEY, S3_STORAGE_KEY, seasonStorageKey } from "./storage";
```

在 `src/domain/storage.test.ts` 文件末尾（现有 describe 闭合之后）追加：

```ts
describe("account namespace", () => {
  beforeEach(() => {
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      clear: () => storage.clear(),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
      setItem: (key: string, value: string) => storage.set(key, value),
    });
    localStorage.clear();
  });

  it("builds anonymous and per-user storage keys", () => {
    expect(seasonStorageKey("s2", null)).toBe("s2-capture-counter:data");
    expect(seasonStorageKey("s3", null)).toBe("s3-capture-counter:data");
    expect(seasonStorageKey("s2", 7)).toBe("s2-capture-counter:7:data");
    expect(seasonStorageKey("s3", 7)).toBe("s3-capture-counter:7:data");
  });

  it("loads and saves per-user data without touching the anonymous key", () => {
    const userData = createDefaultData("s2");
    saveAppData("s2", userData, 7);
    expect(localStorage.getItem("s2-capture-counter:data")).toBeNull();
    expect(loadAppData("s2", 7).data).toEqual(userData);
    expect(loadAppData("s2").data).toEqual(createDefaultData("s2"));
  });
});
```

（`createDefaultData` 与 `vi` 已在文件顶部 import。）

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/domain/storage.test.ts`
Expected: FAIL（`seasonStorageKey` 未导出）。

- [ ] **Step 3: 实现命名空间**

修改 `src/domain/storage.ts`（替换 `loadAppData`/`saveAppData` 并新增 `seasonStorageKey`）：

```ts
export function seasonStorageKey(seasonId: SeasonId, userId: number | null): string {
  const base = getSeasonConfig(seasonId).storageKey; // "s2-capture-counter:data"
  if (userId === null) return base;
  const prefix = base.slice(0, -":data".length);
  return `${prefix}:${userId}:data`;
}

export function loadAppData(seasonId: SeasonId, userId: number | null = null): LoadAppDataResult {
  const storageKey = seasonStorageKey(seasonId, userId);
  const raw = localStorage.getItem(storageKey);
  if (!raw) return { data: createDefaultData(seasonId), recovered: false };

  try {
    const parsed: unknown = JSON.parse(raw);
    const data = migrateAppData(parsed, seasonId);
    if (!data) {
      backupCorruptData(storageKey, raw);
      return { data: createDefaultData(seasonId), recovered: true };
    }
    return { data, recovered: false };
  } catch {
    backupCorruptData(storageKey, raw);
    return { data: createDefaultData(seasonId), recovered: true };
  }
}

export function saveAppData(seasonId: SeasonId, data: AppData, userId: number | null = null): void {
  localStorage.setItem(seasonStorageKey(seasonId, userId), JSON.stringify(data));
}
```

（`backupCorruptData` 与 `S2_STORAGE_KEY`/`S3_STORAGE_KEY`/`STORAGE_KEY` 常量保持不变。）

- [ ] **Step 4: 运行测试确认通过**

Run: `npx vitest run src/domain/storage.test.ts`
Expected: PASS。

- [ ] **Step 5: 全量验证 + 提交**

Run: `npm test && npm run build`
Expected: 全部通过。

```bash
git add src/domain/storage.ts src/domain/storage.test.ts
git commit -m "feat: 存储按账号命名空间隔离"
```

---

### Task 6: 登录与迁移 UI 组件

**Files:**
- Create: `src/components/LoginDialog.tsx`
- Create: `src/components/MigrationWizard.tsx`
- Test: `src/components/LoginDialog.test.tsx`、`src/components/MigrationWizard.test.tsx`

**Interfaces:**
- Consumes: `Session`、`MigrationState`（Task 4）
- Produces:
  - `LoginDialog` props：`{ session: Session | null; busy: boolean; onLogin(username, password): Promise<string | null>; onRegister(username, password): Promise<string | null>; onLogout(): Promise<void>; onResetPassword(username, newPassword): Promise<string | null> }`（回调返回 `null` = 成功，否则错误文案）
  - `MigrationWizard` props：`{ state: MigrationState; seasonLabel: string; busy: boolean; onChoice(choice: "upload-local" | "discard-local" | "use-cloud" | "use-local"): void }`

- [ ] **Step 1: 写失败测试**

Create `src/components/LoginDialog.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LoginDialog } from "./LoginDialog";

describe("LoginDialog", () => {
  it("submits registration with trimmed username and shows errors", async () => {
    const onRegister = vi.fn(async () => "用户名已被注册。");
    render(<LoginDialog session={null} busy={false} onLogin={vi.fn()} onRegister={onRegister} onLogout={vi.fn()} onResetPassword={vi.fn()} />);

    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "  alice  " } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: /^注册$/ }));

    expect(onRegister).toHaveBeenCalledWith("alice", "password1");
    expect(await screen.findByRole("status")).toHaveTextContent("用户名已被注册。");
  });

  it("toggles between login and register modes", () => {
    render(<LoginDialog session={null} busy={false} onLogin={vi.fn()} onRegister={vi.fn()} onLogout={vi.fn()} onResetPassword={vi.fn()} />);
    expect(screen.getByRole("button", { name: /^登录$/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "没有账号？注册一个" }));
    expect(screen.getByRole("button", { name: /^注册$/ })).toBeInTheDocument();
  });

  it("shows the account menu with admin reset when logged in", () => {
    render(<LoginDialog session={{ userId: 1, username: "alice", isAdmin: true }} busy={false} onLogin={vi.fn()} onRegister={vi.fn()} onLogout={vi.fn()} onResetPassword={vi.fn()} />);
    expect(screen.getByText(/已登录为 alice/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "重置用户密码" }));
    fireEvent.change(screen.getByLabelText("重置密码的用户名"), { target: { value: "bob" } });
    fireEvent.change(screen.getByLabelText("重置密码的新密码"), { target: { value: "brand-new-3" } });
    fireEvent.click(screen.getByRole("button", { name: "重置密码" }));
    expect(screen.getByRole("button", { name: /^登录$/ })).not.toBeInTheDocument();
  });
});
```

Create `src/components/MigrationWizard.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MigrationWizard } from "./MigrationWizard";

describe("MigrationWizard", () => {
  it("asks to upload local data when the cloud is empty", () => {
    const onChoice = vi.fn();
    render(<MigrationWizard state={{ kind: "upload-local" }} seasonLabel="S2" busy={false} onChoice={onChoice} />);
    expect(screen.getByText(/把本机数据上传到账号/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "上传本机数据" }));
    expect(onChoice).toHaveBeenCalledWith("upload-local");
  });

  it("asks which side to keep when both sides have data", () => {
    const onChoice = vi.fn();
    render(<MigrationWizard state={{ kind: "choose", cloudUpdatedAt: "2026-08-11T02:00:00.000Z", localModifiedAt: "2026-08-10T14:32:00.000Z" }} seasonLabel="S3" busy={false} onChoice={onChoice} />);
    expect(screen.getByText(/本机和云端都有数据/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "用云端数据" }));
    expect(onChoice).toHaveBeenCalledWith("use-cloud");
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `npx vitest run src/components/LoginDialog.test.tsx src/components/MigrationWizard.test.tsx`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 LoginDialog.tsx**

Create `src/components/LoginDialog.tsx`:

```tsx
import { useState } from "react";
import type { FormEvent } from "react";
import type { Session } from "../domain/serverSync";

type Props = {
  session: Session | null;
  busy: boolean;
  onLogin: (username: string, password: string) => Promise<string | null>;
  onRegister: (username: string, password: string) => Promise<string | null>;
  onLogout: () => Promise<void>;
  onResetPassword: (username: string, newPassword: string) => Promise<string | null>;
};

export function LoginDialog({ session, busy, onLogin, onRegister, onLogout, onResetPassword }: Props) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const result = mode === "login" ? await onLogin(username.trim(), password) : await onRegister(username.trim(), password);
    if (result) {
      setError(result);
    } else {
      setUsername("");
      setPassword("");
    }
  }

  async function submitReset(event: FormEvent) {
    event.preventDefault();
    setError("");
    const result = await onResetPassword(resetUsername.trim(), resetPassword);
    if (result) {
      setError(result);
    } else {
      setResetUsername("");
      setResetPassword("");
      setResetOpen(false);
    }
  }

  return (
    <section className="panel accountPanel">
      <div className="sectionHeader">
        <div>
          <h2>账号</h2>
          <p>登录后数据按账号保存到云端，换设备登录同一账号即可继续。</p>
        </div>
      </div>
      {session ? (
        <div className="accountInfo">
          <p>已登录为 <strong>{session.username}</strong>{session.isAdmin ? "（管理员）" : ""}</p>
          <button type="button" className="ghost" disabled={busy} onClick={() => { void onLogout(); }}>退出登录</button>
          {session.isAdmin && (
            <details open={resetOpen} onToggle={(event) => setResetOpen(event.currentTarget.open)}>
              <summary>重置用户密码</summary>
              <form onSubmit={submitReset} className="row">
                <input aria-label="重置密码的用户名" value={resetUsername} placeholder="用户名" onChange={(event) => setResetUsername(event.target.value)} />
                <input aria-label="重置密码的新密码" type="password" value={resetPassword} placeholder="新密码（至少 8 位）" autoComplete="new-password" onChange={(event) => setResetPassword(event.target.value)} />
                <button type="submit" disabled={busy}>重置密码</button>
              </form>
            </details>
          )}
        </div>
      ) : (
        <form onSubmit={submit}>
          <div className="row">
            <input aria-label="用户名" value={username} placeholder="用户名（2–32 位）" autoComplete="username" onChange={(event) => setUsername(event.target.value)} />
            <input aria-label="密码" type="password" value={password} placeholder="密码（至少 8 位）" autoComplete={mode === "login" ? "current-password" : "new-password"} onChange={(event) => setPassword(event.target.value)} />
            <button type="submit" disabled={busy}>{mode === "login" ? "登录" : "注册"}</button>
          </div>
          <p className="muted">
            <button type="button" className="linkButton" onClick={() => setMode(mode === "login" ? "register" : "login")}>
              {mode === "login" ? "没有账号？注册一个" : "已有账号？直接登录"}
            </button>
          </p>
        </form>
      )}
      {error && <p className="message" role="status">{error}</p>}
    </section>
  );
}
```

- [ ] **Step 4: 实现 MigrationWizard.tsx**

Create `src/components/MigrationWizard.tsx`:

```tsx
import type { MigrationState } from "../domain/serverSync";

type Props = {
  state: MigrationState;
  seasonLabel: string;
  busy: boolean;
  onChoice: (choice: "upload-local" | "discard-local" | "use-cloud" | "use-local") => void;
};

export function MigrationWizard({ state, seasonLabel, busy, onChoice }: Props) {
  return (
    <section className="panel migrationPanel" role="dialog" aria-label="迁移本机数据">
      {state.kind === "upload-local" ? (
        <>
          <h2>把本机数据上传到账号？</h2>
          <p>本机还保存着未登录时的 {seasonLabel} 数据，云端账号数据为空。上传后这台设备继续使用同一份数据。</p>
          <div className="row">
            <button type="button" disabled={busy} onClick={() => onChoice("upload-local")}>上传本机数据</button>
            <button type="button" className="ghost" disabled={busy} onClick={() => onChoice("discard-local")}>弃用本机数据，从空开始</button>
          </div>
        </>
      ) : (
        <>
          <h2>本机和云端都有数据，用哪边？</h2>
          <p>本机最后修改：{new Date(state.localModifiedAt).toLocaleString("zh-CN", { hour12: false })}；云端最后修改：{new Date(state.cloudUpdatedAt).toLocaleString("zh-CN", { hour12: false })}。</p>
          <div className="row">
            <button type="button" disabled={busy} onClick={() => onChoice("use-cloud")}>用云端数据</button>
            <button type="button" disabled={busy} onClick={() => onChoice("use-local")}>用本机数据覆盖云端</button>
          </div>
        </>
      )}
    </section>
  );
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `npx vitest run src/components/LoginDialog.test.tsx src/components/MigrationWizard.test.tsx`
Expected: PASS。

- [ ] **Step 6: 全量验证 + 提交**

Run: `npm test && npm run build`
Expected: 全部通过。

```bash
git add src/components/LoginDialog.tsx src/components/LoginDialog.test.tsx src/components/MigrationWizard.tsx src/components/MigrationWizard.test.tsx
git commit -m "feat: 登录对话框与首次登录迁移向导"
```

---

### Task 7: App 接线与数据管理面板

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/DataManager.tsx`
- Modify: `src/App.test.tsx`（新增账号流程用例；现有用例应保持全绿）

**Interfaces:**
- Consumes: Task 4/5/6 全部导出；现有 `sync.ts` 全部导出（不动）
- Produces: 最终行为——登录态走账号同步，匿名态走原 GitHub 流程；首次登录弹迁移向导；登出恢复匿名视图；`DataManager` 登录态隐藏 GitHub 表单

- [ ] **Step 1: DataManager 增加账号区**

修改 `src/components/DataManager.tsx`：

Props 类型追加两个字段：

```tsx
import type { Session } from "../domain/serverSync";
```

```tsx
type Props = {
  seasonLabel: string;
  message: string;
  lastSyncAt: string | null;
  syncConfig: SyncConfig;
  syncBusy: boolean;
  session: Session | null;
  onLoginClick: () => void;
  onSaveSyncConfig: (config: SyncConfig) => void;
  onPushSync: (config: SyncConfig) => void;
  onPullSync: (config: SyncConfig) => void;
  onDisconnectSync: () => void;
  onExport: () => void;
  onImport: (file: File) => void;
  onClear: () => void;
  onReset: () => void;
};
```

解构参数追加 `session, onLoginClick`。把 sectionHeader 描述改为：

```tsx
<p>登录账号或配置 GitHub Gist 后，打开页面会自动检查云端数据，并在本机数据变化后自动上传。</p>
```

`isSyncOpen` 折叠区内，在 `<form onSubmit={submitSync}>` 之前插入账号区：

```tsx
{session ? (
  <div className="accountStatus">
    <p className="muted">已登录为 {session.username}，当前使用账号同步：本机数据变化后自动上传到账号云端。</p>
    <p className="muted">GitHub 同步在登录状态下隐藏；退出登录后恢复。</p>
  </div>
) : (
  <div className="row">
    <button type="button" className="ghost" onClick={onLoginClick}>登录 / 注册（多端同步）</button>
  </div>
)}
```

注意保留 `<form>` 及其后所有现有内容原样。

- [ ] **Step 2: 改 App.tsx —— 状态与导入**

在 `src/App.tsx` 顶部 import 区追加：

```tsx
import { LoginDialog } from "./components/LoginDialog";
import { MigrationWizard } from "./components/MigrationWizard";
import {
  adminResetPassword,
  clearSession,
  fetchMe,
  loadSession,
  loadLastServerUpdatedAt,
  loginAccount,
  logoutAccount,
  pullFromServer,
  pushToServer,
  registerAccount,
  saveLastServerUpdatedAt,
  saveSession,
} from "./domain/serverSync";
import type { MigrationState, Session } from "./domain/serverSync";
```

在 `App` 组件内、`const [initialLoad] = useState(...)` 之前插入：

```tsx
const [session, setSession] = useState<Session | null>(() => loadSession());
const [loginOpen, setLoginOpen] = useState(false);
const [migration, setMigration] = useState<MigrationState | null>(null);
const wizardPromptedRef = useRef(false);
const accountPanelRef = useRef<HTMLDivElement>(null);
```

把 `initialLoad` 改为：

```tsx
const [initialLoad] = useState(() => loadAppData(seasonId, session?.userId ?? null));
```

（session 的 useState 必须先于 initialLoad 声明。）

- [ ] **Step 3: 改 App.tsx —— 保存/水合/自动上传三处 effect**

把保存 effect 改为：

```tsx
useEffect(() => {
  if (skipNextSaveRef.current) {
    skipNextSaveRef.current = false;
    return;
  }
  saveAppData(seasonId, data, session?.userId ?? null);
}, [seasonId, data, session]);
```

把水合 effect 整体替换为（原 GitHub 分支行为不变，仅包进 `if (!session)`）：

```tsx
useEffect(() => {
  if (!session) {
    const config = syncConfig;
    if (!config.token.trim() || !config.gistId.trim()) {
      hasHydratedRef.current = true;
      return;
    }

    let cancelled = false;
    setSyncBusy(true);
    pullFromGist(config, seasonId).then((result) => {
      if (cancelled) return;
      if (result.ok) applyPulledData(result.data);
      else setMessage(result.error);
    }).finally(() => {
      if (!cancelled) {
        setSyncBusy(false);
        hasHydratedRef.current = true;
        if (preHydrationDirtyRef.current) setHydrationRevision((revision) => revision + 1);
      }
    });

    return () => {
      cancelled = true;
    };
  }

  let cancelled = false;
  setSyncBusy(true);
  pullFromServer(seasonId).then((result) => {
    if (cancelled) return;
    if (!result.ok) {
      setMessage(result.error);
      hasHydratedRef.current = true;
      if (preHydrationDirtyRef.current) setHydrationRevision((revision) => revision + 1);
      return;
    }
    const anonymousData = loadAppData(seasonId).data;
    const hasRealAnonymousData = JSON.stringify(anonymousData) !== JSON.stringify(createDefaultData(seasonId));
    if (result.empty) {
      if (hasRealAnonymousData && !wizardPromptedRef.current) {
        wizardPromptedRef.current = true;
        setMigration({ kind: "upload-local" });
        return; // 等迁移向导决定后再完成水合
      }
    } else if (hasRealAnonymousData && !wizardPromptedRef.current) {
      wizardPromptedRef.current = true;
      setMigration({
        kind: "choose",
        cloudUpdatedAt: result.updatedAt,
        localModifiedAt: anonymousData.meta.lastModifiedAt,
      });
      return;
    } else {
      const last = loadLastServerUpdatedAt(seasonId, session.userId);
      if (last === null || result.updatedAt > last) {
        skipNextAutoUploadRef.current = true;
        setData(result.data);
        saveLastServerUpdatedAt(seasonId, session.userId, result.updatedAt);
        markSynced();
        setMessage("已同步云端数据。");
      }
    }
    hasHydratedRef.current = true;
    if (preHydrationDirtyRef.current) setHydrationRevision((revision) => revision + 1);
  }).finally(() => {
    if (!cancelled) setSyncBusy(false);
  });

  return () => {
    cancelled = true;
  };
}, [seasonId, session]);
```

把自动上传 effect 整体替换为（GitHub 分支行为不变）：

```tsx
useEffect(() => {
  if (!hasHydratedRef.current) return;
  if (skipNextAutoUploadRef.current) {
    skipNextAutoUploadRef.current = false;
    return;
  }
  if (!session && (!syncConfig.token.trim() || !syncConfig.gistId.trim())) return;

  let cancelled = false;
  const uploadSeasonId = seasonId;
  const timeoutId = window.setTimeout(() => {
    if (session) {
      pushToServer(dataRef.current, uploadSeasonId).then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        saveLastServerUpdatedAt(uploadSeasonId, session.userId, result.updatedAt);
        setMessage("本机数据已自动上传到云端。");
        markSynced();
      });
    } else {
      const config = syncConfig;
      pushToGist(dataRef.current, config, uploadSeasonId).then((result) => {
        if (cancelled) return;
        if (!result.ok) {
          setMessage(result.error);
          return;
        }
        const nextConfig = { token: config.token.trim(), gistId: result.gistId ?? config.gistId.trim() };
        if (nextConfig.token !== config.token.trim() || nextConfig.gistId !== config.gistId.trim()) {
          saveSyncConfig(nextConfig);
          setSyncConfig(nextConfig);
        }
        setMessage("本机数据已自动上传到云端。");
        markSynced();
      });
    }
  }, AUTO_SYNC_UPLOAD_DELAY_MS);

  return () => {
    cancelled = true;
    window.clearTimeout(timeoutId);
  };
}, [data, syncConfig, hydrationRevision, seasonId, session]);
```

- [ ] **Step 4: 改 App.tsx —— 会话与迁移处理函数**

在 `markSynced` 之后追加：

```tsx
function restoreAnonymousView(messageText?: string) {
  clearSession();
  skipNextSaveRef.current = true;
  skipNextAutoUploadRef.current = true;
  hasHydratedRef.current = false;
  preHydrationDirtyRef.current = false;
  wizardPromptedRef.current = false;
  setMigration(null);
  setLoginOpen(false);
  const result = loadAppData(seasonId);
  setData(result.data);
  if (result.recovered) {
    setMessage("检测到本机数据损坏，已恢复默认数据；原始数据已备份到 " + getSeasonConfig(seasonId).storageKey + "-corrupt。");
  } else if (messageText) {
    setMessage(messageText);
  }
  setSession(null);
  setHydrationRevision((revision) => revision + 1);
}

function handleLoggedIn(user: Session) {
  saveSession(user);
  skipNextSaveRef.current = true;
  skipNextAutoUploadRef.current = true;
  hasHydratedRef.current = false;
  preHydrationDirtyRef.current = false;
  wizardPromptedRef.current = false;
  setMigration(null);
  setSession(user);
  setHydrationRevision((revision) => revision + 1);
}

async function handleLogout() {
  setSyncBusy(true);
  await logoutAccount();
  restoreAnonymousView("已退出登录。本机匿名数据保持不变。");
  setSyncBusy(false);
}

async function finishMigration(choice: "upload-local" | "discard-local" | "use-cloud" | "use-local") {
  const currentSession = session;
  if (!currentSession) return;
  setSyncBusy(true);
  try {
    if (choice === "upload-local" || choice === "use-local") {
      const localData = loadAppData(seasonId).data;
      const push = await pushToServer(localData, seasonId);
      if (!push.ok) {
        setMessage(push.error);
        return;
      }
      saveLastServerUpdatedAt(seasonId, currentSession.userId, push.updatedAt);
      saveAppData(seasonId, localData, currentSession.userId); // 立即写入账号命名空间缓存，避免刷新后回退为空数据
    }
    if (choice === "use-cloud") {
      const pull = await pullFromServer(seasonId);
      if (pull.ok && !pull.empty) {
        setData(pull.data);
        saveLastServerUpdatedAt(seasonId, currentSession.userId, pull.updatedAt);
      } else if (!pull.ok) {
        setMessage(pull.error);
        return;
      }
    }
    if (choice === "discard-local") {
      setData(createDefaultData(seasonId));
    }
    skipNextSaveRef.current = true;
    skipNextAutoUploadRef.current = true;
    wizardPromptedRef.current = true;
    setMigration(null);
    hasHydratedRef.current = true;
    setMessage(
      choice === "upload-local" || choice === "use-local" ? "已把本机数据上传到账号。" :
      choice === "use-cloud" ? "已采用云端数据。" : "账号已从空数据开始。"
    );
    setHydrationRevision((revision) => revision + 1);
  } finally {
    setSyncBusy(false);
  }
}
```

在 `switchSeason` 中把两处存储调用改为带命名空间：

```tsx
saveAppData(seasonId, dataRef.current, session?.userId ?? null);
...
const result = loadAppData(nextSeasonId, session?.userId ?? null);
```

在组件挂载后追加会话校验 effect（放在现有"挂载时检测本机数据损坏"effect 之后）：

```tsx
// 会话恢复校验：本地有会话时向服务器确认，失效则退回匿名视图。
useEffect(() => {
  if (!loadSession()) return;
  let cancelled = false;
  fetchMe().then((me) => {
    if (cancelled) return;
    if (me) {
      setSession(me);
    } else {
      restoreAnonymousView();
    }
  });
  return () => {
    cancelled = true;
  };
}, []);
```

（`fetchMe` 返回的 session 对象每次都是新引用，会触发水合 effect 重跑一次拉取；拉取是幂等只读操作，可接受。）

- [ ] **Step 5: 改 App.tsx —— 渲染**

顶部操作区 `.heroActions` 末尾追加：

```tsx
<button type="button" onClick={() => setLoginOpen((open) => !open)}>{session ? session.username : "登录 / 注册"}</button>
```

`<DataManager ...>` 处改为传入新 props 并追加两个面板：

```tsx
<DataManager
  seasonLabel={season.label}
  message={message}
  lastSyncAt={lastSyncAt}
  syncConfig={syncConfig}
  syncBusy={syncBusy}
  session={session}
  onLoginClick={() => setLoginOpen(true)}
  onSaveSyncConfig={updateSyncConfig}
  onPushSync={pushSync}
  onPullSync={pullSync}
  onDisconnectSync={disconnectSync}
  onExport={exportData}
  onImport={importData}
  onClear={clearData}
  onReset={resetData}
/>
{loginOpen && (
  <div ref={accountPanelRef}>
    <LoginDialog
      session={session}
      busy={syncBusy}
      onLogin={async (username, password) => {
        const result = await loginAccount(username, password);
        if (result.ok) handleLoggedIn(result.session);
        return result.ok ? null : result.error;
      }}
      onRegister={async (username, password) => {
        const result = await registerAccount(username, password);
        if (result.ok) handleLoggedIn(result.session);
        return result.ok ? null : result.error;
      }}
      onLogout={handleLogout}
      onResetPassword={async (username, newPassword) => {
        const result = await adminResetPassword(username, newPassword);
        return result.ok ? null : result.error;
      }}
    />
  </div>
)}
{migration && (
  <MigrationWizard state={migration} seasonLabel={season.label} busy={syncBusy} onChoice={(choice) => { void finishMigration(choice); }} />
)}
```

追加滚动 effect（放在其它 effect 附近）：

```tsx
useEffect(() => {
  if (loginOpen) accountPanelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
}, [loginOpen]);
```

- [ ] **Step 6: 新增 App 账号流程用例**

在 `src/App.test.tsx` 末尾追加（复用文件顶部的 `AppData` 等 import；若未导入 `createDefaultData` 则加一行）：

```tsx
describe("account login", () => {
  function accountFetchMock() {
    return vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      if (url === "/api/register") return new Response(JSON.stringify({ userId: 7, username: "alice", isAdmin: false }), { status: 201 });
      if (url === "/api/login") return new Response(JSON.stringify({ userId: 7, username: "alice", isAdmin: false }), { status: 200 });
      if (url === "/api/logout") return new Response(null, { status: 204 });
      if (url === "/api/data/s3" && method === "PUT") return new Response(JSON.stringify({ updatedAt: "2026-08-11T02:00:00.000Z", revision: 2 }), { status: 200 });
      if (url === "/api/data/s3") return new Response(JSON.stringify({ data: null, updatedAt: null, revision: null }), { status: 200 });
      return new Response(JSON.stringify({ error: "not found" }), { status: 404 });
    });
  }

  it("registers, counts in the account namespace, and auto-uploads", async () => {
    vi.useFakeTimers();
    const fetchMock = accountFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "登录 / 注册" }));
    await act(async () => {});
    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: /^注册$/ }));
    await act(async () => {});

    expect(fetchMock).toHaveBeenCalledWith("/api/register", expect.objectContaining({ method: "POST" }));
    expect(localStorage.getItem("s2-capture-counter:session")).toContain("alice");
    expect(screen.getByText(/已登录为 alice/)).toBeInTheDocument();

    const card = screen.getByRole("listitem", { name: /本机精灵/ });
    fireEvent.click(card.querySelector("button")!); // +1
    await act(async () => {});
    await vi.advanceTimersByTimeAsync(800);
    await act(async () => {});

    const accountData = JSON.parse(localStorage.getItem("s3-capture-counter:7:data")!) as AppData;
    expect(accountData.creatures.reduce((sum, creature) => sum + creature.totalEncounters, 0)).toBe(1); // +1 进了账号命名空间
    const anonymousData = JSON.parse(localStorage.getItem("s3-capture-counter:data")!) as AppData;
    expect(anonymousData.creatures.every((creature) => creature.totalEncounters === 0)).toBe(true); // 匿名命名空间未被污染
    expect(fetchMock).toHaveBeenCalledWith("/api/data/s3", expect.objectContaining({ method: "PUT" }));
    expect(screen.getByText("本机数据已自动上传到云端。")).toBeInTheDocument();
  });

  it("asks to upload anonymous data on first login and keeps it after logout", async () => {
    vi.useFakeTimers();
    const anonymousData = createDefaultData("s3");
    anonymousData.creatures[0] = { ...anonymousData.creatures[0], totalEncounters: 1, currentEncounters: 1 }; // 有真实使用痕迹，才会触发迁移向导
    localStorage.setItem("s3-capture-counter:data", JSON.stringify(anonymousData));
    const fetchMock = accountFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "登录 / 注册" }));
    await act(async () => {});
    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: /^注册$/ }));
    await act(async () => {});

    expect(screen.getByText(/把本机数据上传到账号/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "上传本机数据" }));
    await act(async () => {});
    expect(fetchMock).toHaveBeenCalledWith("/api/data/s3", expect.objectContaining({ method: "PUT", body: expect.stringContaining("version") }));

    fireEvent.click(screen.getByRole("button", { name: "退出登录" }));
    await act(async () => {});
    expect(screen.getByRole("button", { name: "登录 / 注册" })).toBeInTheDocument();
    expect(localStorage.getItem("s3-capture-counter:data")).not.toBeNull(); // 匿名数据原样保留
    expect(localStorage.getItem("s3-capture-counter:7:data")).not.toBeNull(); // 账号数据缓存也保留
  });

  it("hides the GitHub sync form while logged in", async () => {
    vi.useFakeTimers();
    const fetchMock = accountFetchMock();
    vi.stubGlobal("fetch", fetchMock);
    render(<App />);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "登录 / 注册" }));
    await act(async () => {});
    fireEvent.change(screen.getByLabelText("用户名"), { target: { value: "alice" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password1" } });
    fireEvent.click(screen.getByRole("button", { name: /^注册$/ }));
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "展开多端同步" }));
    expect(screen.queryByLabelText("GitHub Token")).not.toBeInTheDocument();
    expect(screen.getByText(/当前使用账号同步/)).toBeInTheDocument();
  });
});
```

注意：若 `src/App.test.tsx` 顶部未 import `createDefaultData`，追加 `import { createDefaultData } from "./domain/defaultData";`。

- [ ] **Step 7: 运行全量测试并修适配**

Run: `npm test`
Expected: 全部通过，包括现有用例（若个别现有用例因 fetch 调用次数断言受影响，按"会话恢复校验只在本地有 session 时发请求"的机制确认后修正该用例的断言）。

- [ ] **Step 8: 手动冒烟**

Run: `npm run dev:server` + `npm run dev`（另开终端）。浏览器验证：
1. 点「登录 / 注册」→ 注册新账号；
2. 点击 +1 → 等约 1 秒 → 提示"本机数据已自动上传到云端"；
3. 刷新页面 → 数据仍在（账号命名空间缓存 + 水合拉取）；
4. 换隐身窗口登录同一账号 → 云端数据拉取成功；
5. 退出登录 → 恢复匿名视图，GitHub 面板重新出现。
验证后停掉两个进程，删除本地 `counter-data/`。

- [ ] **Step 9: 构建验证 + 提交**

Run: `npm run build`
Expected: 通过。

```bash
git add src/App.tsx src/components/DataManager.tsx src/App.test.tsx
git commit -m "feat: App 接入账号同步与迁移向导"
```

---

### Task 8: 部署与文档

**Files:**
- Modify: `.github/workflows/deploy.yml`（新增 deploy-api job）
- Create: `server/deploy/counter-api.service`、`server/deploy/nginx-api.conf`、`server/deploy/backup.cron`、`server/deploy/README.md`
- Modify: `README.md`（账号章节 + 常见问题 + 更新日志 v0.5.0）

**Interfaces:**
- Consumes: Task 3 的 `server/dist`、根 `package.json`/`package-lock.json`
- Produces: 可重复执行的部署链路（rsync + `npm ci --omit=dev` + systemctl restart）与一次性初始化手册

- [ ] **Step 1: 新增部署 job**

在 `.github/workflows/deploy.yml` 的 `deploy` job 之后追加（复用现有 SSH secrets；新增 `API_DEPLOY_PATH` secret，如 `/home/www/counter-api`）：

```yaml
  deploy-api:
    runs-on: ubuntu-latest
    needs: deploy

    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Build server
        run: npx tsc -p server

      - name: Prepare SSH key
        run: |
          mkdir -p ~/.ssh
          printf '%s\n' "${{ secrets.SSH_KEY }}" > ~/.ssh/deploy_key
          chmod 600 ~/.ssh/deploy_key
          printf '%s\n' "${{ secrets.SSH_KNOWN_HOSTS }}" > ~/.ssh/known_hosts

      - name: Sync server files
        run: |
          ssh -i ~/.ssh/deploy_key -p "${{ secrets.SSH_PORT }}" "${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}" \
            "mkdir -p '${{ secrets.API_DEPLOY_PATH }}/server/dist'"
          rsync -az \
            -e "ssh -i ~/.ssh/deploy_key -p ${{ secrets.SSH_PORT }}" \
            server/dist/ \
            "${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:${{ secrets.API_DEPLOY_PATH }}/server/dist/"
          rsync -az \
            -e "ssh -i ~/.ssh/deploy_key -p ${{ secrets.SSH_PORT }}" \
            package.json package-lock.json \
            "${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}:${{ secrets.API_DEPLOY_PATH }}/"

      - name: Install production dependencies and restart
        run: |
          ssh -i ~/.ssh/deploy_key -p "${{ secrets.SSH_PORT }}" "${{ secrets.SSH_USER }}@${{ secrets.SSH_HOST }}" \
            "cd '${{ secrets.API_DEPLOY_PATH }}' && npm ci --omit=dev && (systemctl restart counter-api || sudo systemctl restart counter-api)"
```

- [ ] **Step 2: 编写一次性初始化文件**

Create `server/deploy/counter-api.service`:

```ini
[Unit]
Description=Capture Counter API
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/www/counter-api
Environment=NODE_ENV=production
Environment=PORT=8787
Environment=COUNTER_DB_PATH=/home/www/counter-data/db.sqlite
ExecStart=/usr/bin/node /home/www/counter-api/server/dist/index.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
```

Create `server/deploy/nginx-api.conf`（片段，合并进站点 server 块）：

```nginx
location /api {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $remote_addr;
}
```

Create `server/deploy/backup.cron`（每行一条；`%` 在 crontab 中需转义为 `\%`）：

```
0 3 * * * sqlite3 /home/www/counter-data/db.sqlite ".backup '/home/www/counter-data/backups/db-$(date +\%F-\%H\%M).sqlite'" >> /home/www/counter-data/backups/backup.log 2>&1
0 3 * * * find /home/www/counter-data/backups -name 'db-*.sqlite' -mtime +30 -delete
```

Create `server/deploy/README.md`：

```markdown
# 首次部署初始化（一次性，root 执行）

前置：已按 deploy.yml 配置 `API_DEPLOY_PATH`（如 `/home/www/counter-api`），站点 Nginx 配置存在。

1. 安装 sqlite3 CLI（备份用）：
   apt install -y sqlite3

2. 创建数据与备份目录、目录属主（进程以 www-data 运行）：
   mkdir -p /home/www/counter-data/backups
   chown -R www-data:www-data /home/www/counter-data

3. 安装 systemd 服务（改好 unit 里的路径后）：
   cp counter-api.service /etc/systemd/system/
   systemctl daemon-reload
   systemctl enable --now counter-api
   systemctl status counter-api

4. 把 nginx-api.conf 的 location 片段合并进站点 server 块，然后：
   nginx -t && systemctl reload nginx

5. 配置备份：
   crontab -e  # 粘贴 backup.cron 的内容
   mkdir -p /home/www/counter-data/backups

6. 手动触发一次备份验证：
   sqlite3 /home/www/counter-data/db.sqlite ".backup '/home/www/counter-data/backups/db-manual.sqlite'"

7. 首次推送代码触发 deploy.yml 的 deploy-api job 后，验证：
   curl http://127.0.0.1:8787/api/me   # 期望 {"error":"未登录。"}
```

- [ ] **Step 3: 更新 README.md**

在「数据管理与多端同步」章节的 GitHub 步骤之前插入账号章节：

```markdown
### 账号登录（推荐）

不想碰 GitHub 也没关系，注册一个账号就能多端同步：

1. 点击页面顶部右侧的 `登录 / 注册`，或展开「数据管理与多端同步」后点击 `登录 / 注册（多端同步）`。
2. 注册：用户名 2–32 位（支持中文），密码至少 8 位。注册后自动登录。
3. 第一次登录时，如果本机有未登录时的数据，会询问是否上传到账号；如果账号云端已有数据，会让你选择用哪边。
4. 登录后数据按账号保存到云端：本机数据变化后自动上传，打开页面自动检查云端更新。S2 和 S3 仍然分开保存。
5. 忘记密码？找管理员（账号信息旁有「重置用户密码」功能的人）重置。

账号数据与匿名本地数据互相隔离：退出登录后回到匿名本地数据，两者都不会被删除。
```

在「常见问题」追加：

```markdown
### 登录后还能用 GitHub 同步吗？

登录状态下使用账号同步，GitHub 配置区会隐藏；退出登录后恢复，原 GitHub Token / Gist ID 配置仍然保留。

### 朋友忘记密码了怎么办？

找管理员（登录菜单里显示「（管理员）」的人）重置密码即可，不需要邮箱。
```

在「更新日志」顶部追加：

```markdown
### v0.5.0（2026-08-11）

- 新增账号系统：注册 / 登录后数据按账号保存到自有服务器云端，多设备自动同步，不再需要 GitHub Token。
- 首次登录提供匿名数据迁移向导（上传本机数据 / 采用云端数据）。
- 匿名本地模式与 GitHub Gist 同步原样保留，登录时 GitHub 配置区折叠。
```

- [ ] **Step 4: 全量验证 + 提交**

Run: `npm test && npm run build`
Expected: 全部通过。

```bash
git add .github/workflows/deploy.yml server/deploy README.md
git commit -m "feat: 账号后端部署链路与使用文档"
```

---

## 自检记录

- **规格覆盖**：R1 注册/登录/登出 → Task 2/3/4/6/7；R2 账号同步 → Task 3/4/7；R3 匿名与 Gist 保留 → Task 7（`if (!session)` 分支、DataManager 折叠）、全局约束 4；R4 迁移向导 → Task 6/7。规格 §5 三张表 → Task 1；§6 七个端点 → Task 3；§7 LWW 与启动拉取 → Task 7 水合 effect；§8 命名空间 → Task 5；§9 部署 → Task 8；§10 安全（bcrypt cost 10、token 哈希、HttpOnly/SameSite/Secure、参数化 SQL、限流、管理员重置）→ Task 2/3；§11 测试 → 各 Task 测试步骤；§12 依赖（hono/better-sqlite3/bcryptjs）→ Task 1。
- **占位符扫描**：无 TBD/TODO；所有代码步骤含完整实现。
- **类型一致性**：`createApp`/`pullFromServer`/`pushToServer`/`Session`/`MigrationState`/`seasonStorageKey`/`loadAppData(seasonId, userId)` 在定义与消费 Task 中签名一致；cookie 名、错误文案、存储 key 格式前后一致。