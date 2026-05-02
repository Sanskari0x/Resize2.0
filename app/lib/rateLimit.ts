/**
 * In-memory sliding-window rate limiter.
 * Works per-IP per-route.  Replace with Redis for multi-instance deployments.
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowEntry>();

// Flush stale keys every 5 min so memory doesn't grow unbounded
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    store.forEach((v, k) => { if (v.resetAt < now) store.delete(k); });
  }, 5 * 60 * 1000);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
  retryAfter: number; // seconds
}

/**
 * @param key      Unique key, e.g. `${ip}:resize`
 * @param limit    Max requests per window
 * @param windowMs Window length in milliseconds
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true, remaining: limit - 1, resetAt: entry.resetAt, retryAfter: 0 };
  }

  entry.count++;
  const remaining = Math.max(0, limit - entry.count);
  const allowed   = entry.count <= limit;
  const retryAfter = allowed ? 0 : Math.ceil((entry.resetAt - now) / 1000);

  return { allowed, remaining, resetAt: entry.resetAt, retryAfter };
}

/**
 * Extract real IP from Next.js request headers (handles proxies/Vercel).
 */
export function getClientIp(req: Request): string {
  const h = (name: string) => req.headers.get(name) ?? "";
  return (
    h("x-real-ip") ||
    h("x-forwarded-for").split(",")[0].trim() ||
    "unknown"
  );
}
