// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
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
    vi.useFakeTimers();
    try {
      const check = createRateLimiter({ limit: 1, windowMs: 1_000 });
      expect(check("ip-1").allowed).toBe(true);
      expect(check("ip-1").allowed).toBe(false);
      vi.advanceTimersByTime(1_000);
      expect(check("ip-1").allowed).toBe(true); // 1s 窗口已过
    } finally {
      vi.useRealTimers();
    }
  });
});
