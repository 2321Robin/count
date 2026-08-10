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
