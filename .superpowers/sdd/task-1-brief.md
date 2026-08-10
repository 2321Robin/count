### Task 1: 设备检测模块（device.ts）

**Files:**
- Create: `src/domain/device.ts`
- Test: `src/domain/device.test.ts`

**Interfaces:**
- Consumes: 无（全新模块）。
- Produces: `type DeviceKind = "computer" | "phone" | "tablet" | "unknown"`、`classifyDeviceKind(ua: string, maxTouchPoints: number): DeviceKind`、`detectDeviceKind(): DeviceKind`。Task 2（types.ts meta 字段）、Task 3（counter stamp）、Task 5（App.tsx apply 打点）依赖。

- [ ] **Step 1: 写失败测试（新文件）**

创建 `src/domain/device.test.ts`：

```ts
// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { classifyDeviceKind, detectDeviceKind } from "./device";

describe("device", () => {
  it("classifies phone user agents", () => {
    expect(classifyDeviceKind("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", 5)).toBe("phone");
    expect(classifyDeviceKind("Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Mobile Safari/537.36", 5)).toBe("phone");
  });

  it("classifies desktop user agents", () => {
    expect(classifyDeviceKind("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36", 0)).toBe("computer");
    expect(classifyDeviceKind("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36", 0)).toBe("computer");
  });

  it("classifies iPads as tablets", () => {
    expect(classifyDeviceKind("Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", 5)).toBe("tablet");
  });

  it("treats Macintosh user agents with touch as tablets (desktop-class iPad Safari)", () => {
    expect(classifyDeviceKind("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15", 5)).toBe("tablet");
  });

  it("treats Macintosh user agents without touch as computers", () => {
    expect(classifyDeviceKind("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15", 0)).toBe("computer");
  });

  it("classifies Android tablets without the Mobile marker", () => {
    expect(classifyDeviceKind("Mozilla/5.0 (Linux; Android 13; SM-X900) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36", 5)).toBe("tablet");
  });

  it("returns unknown for unrecognizable user agents", () => {
    expect(classifyDeviceKind("", 0)).toBe("unknown");
    expect(classifyDeviceKind("curl/8.0", 0)).toBe("unknown");
  });

  it("prefers navigator.userAgentData.mobile", () => {
    vi.stubGlobal("navigator", { userAgent: "", userAgentData: { mobile: true, platform: "Android" }, maxTouchPoints: 0 });

    expect(detectDeviceKind()).toBe("phone");
  });

  it("uses userAgentData.platform for tablets and computers", () => {
    vi.stubGlobal("navigator", { userAgent: "", userAgentData: { mobile: false, platform: "Android" }, maxTouchPoints: 5 });
    expect(detectDeviceKind()).toBe("tablet");

    vi.stubGlobal("navigator", { userAgent: "", userAgentData: { mobile: false, platform: "Windows" }, maxTouchPoints: 0 });
    expect(detectDeviceKind()).toBe("computer");
  });

  it("falls back to the user agent when userAgentData is missing", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148", maxTouchPoints: 5 });

    expect(detectDeviceKind()).toBe("phone");
  });

  it("returns unknown when navigator is unavailable", () => {
    vi.stubGlobal("navigator", undefined);

    expect(detectDeviceKind()).toBe("unknown");
  });
});
```

- [ ] **Step 2: 运行确认失败（红）**

Run: `npx vitest run src/domain/device.test.ts`
Expected: FAIL——`Cannot find module './device'`（文件不存在），或全部用例报函数未定义。

- [ ] **Step 3: 写最小实现**

创建 `src/domain/device.ts`：

```ts
export type DeviceKind = "computer" | "phone" | "tablet" | "unknown";

const PHONE_PATTERN = /Android|iPhone|iPod|Mobile|Opera Mini/;
const COMPUTER_PATTERN = /Windows|Macintosh|Mac OS X|Linux|X11|CrOS/;

/**
 * 纯函数设备分类：按 UA 与触摸能力把访问端归类为电脑/手机/平板。
 * 顺序敏感：iPad 优先，Macintosh+触摸判平板（iPad 桌面版网页伪装成 Mac），
 * 安卓无 Mobile 标记判平板，其余按手机/桌面特征兜底，无法识别返回 unknown。
 */
export function classifyDeviceKind(ua: string, maxTouchPoints: number): DeviceKind {
  if (/iPad/.test(ua)) return "tablet";
  if (/Macintosh|Mac OS X/.test(ua) && maxTouchPoints > 1) return "tablet";
  if (/Android/.test(ua) && !/Mobile/.test(ua)) return "tablet";
  if (PHONE_PATTERN.test(ua)) return "phone";
  if (COMPUTER_PATTERN.test(ua)) return "computer";
  return "unknown";
}

type UserAgentDataLike = { mobile?: boolean; platform?: string };

/**
 * 浏览器环境封装：优先 navigator.userAgentData（现代 Chromium），降级 UA 正则。
 * 不缓存：apply 是低频用户操作，重复检测开销可忽略，且避免测试间状态污染。
 * 无 navigator（node 测试环境）或读取失败时返回 unknown，不向上抛。
 */
export function detectDeviceKind(): DeviceKind {
  const nav = typeof navigator === "undefined" ? undefined : navigator;
  if (!nav) return "unknown";

  try {
    const uad = (nav as Navigator & { userAgentData?: UserAgentDataLike }).userAgentData;
    if (uad) {
      if (uad.mobile) return "phone";
      if (uad.platform === "Android") return "tablet";
      if (uad.platform === "Windows" || uad.platform === "macOS" || uad.platform === "Linux" || uad.platform === "Chrome OS") return "computer";
    }
    const ua = nav.userAgent ?? "";
    const maxTouchPoints = typeof nav.maxTouchPoints === "number" ? nav.maxTouchPoints : 0;
    return classifyDeviceKind(ua, maxTouchPoints);
  } catch {
    return "unknown";
  }
}
```

- [ ] **Step 4: 运行确认通过（绿）**

Run: `npx vitest run src/domain/device.test.ts`
Expected: 全部通过（12 例）。

- [ ] **Step 5: 提交**

```bash
git add src/domain/device.ts src/domain/device.test.ts
git commit -m "feat: 新增设备类型检测模块（电脑/手机/平板）"
```

---
