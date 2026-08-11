export type RateLimitOptions = { limit: number; windowMs: number };

export function createRateLimiter(options: RateLimitOptions) {
  const hits = new Map<string, { count: number; resetAt: number }>();
  return (key: string): { allowed: boolean; retryAfterSec: number } => {
    const now = Date.now();
    if (hits.size > 1024) {
      for (const [k, entry] of hits) {
        if (entry.resetAt <= now) hits.delete(k);
      }
    }
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
