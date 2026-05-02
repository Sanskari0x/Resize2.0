/**
 * proxy.ts — Next.js 16 network boundary layer
 *
 * In Next.js 16, middleware.ts was renamed to proxy.ts and the exported
 * function was renamed from `middleware` to `proxy`. This file handles:
 *  - Per-IP rate limiting (sliding window, in-process)
 *  - Security headers on every response
 *  - API method enforcement (POST-only)
 *
 * Runs on the Node.js runtime (not Edge) — full Map persistence per process.
 * For multi-instance deployments, swap the in-process store with Upstash Redis.
 */

import { NextRequest, NextResponse } from "next/server";

// ─── Rate limit config ────────────────────────────────────────────────────────
const LIMITS: Record<string, { limit: number; windowSec: number }> = {
  "/api/resize":   { limit: 20, windowSec: 60 },  // 20 resize ops / min / IP
  "/api/metadata": { limit: 60, windowSec: 60 },  // 60 metadata reads / min / IP
};

// In-process sliding-window store — fully persistent for single-node/Docker
const ipStore = new Map<string, { count: number; resetAt: number }>();
setInterval(() => {
  const now = Date.now();
  ipStore.forEach((v, k) => { if (v.resetAt < now) ipStore.delete(k); });
}, 30_000);

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-real-ip") ||
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    "unknown"
  );
}

function checkRateLimit(
  ip: string,
  route: string,
  limit: number,
  windowSec: number
): { allowed: boolean; remaining: number; retryAfter: number } {
  const key  = `${ip}:${route}`;
  const now  = Date.now();
  let entry  = ipStore.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowSec * 1000 };
    ipStore.set(key, entry);
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  entry.count++;
  const allowed    = entry.count <= limit;
  const remaining  = Math.max(0, limit - entry.count);
  const retryAfter = allowed ? 0 : Math.ceil((entry.resetAt - now) / 1000);
  return { allowed, remaining, retryAfter };
}

// ─── Security headers ─────────────────────────────────────────────────────────
function applySecurityHeaders(res: NextResponse): NextResponse {
  const h   = res.headers;
  const dev = process.env.NODE_ENV === "development";

  h.set("X-Content-Type-Options",  "nosniff");
  h.set("X-Frame-Options",         "DENY");
  h.set("X-XSS-Protection",        "1; mode=block");
  h.set("Referrer-Policy",         "strict-origin-when-cross-origin");
  h.set("Permissions-Policy",      "camera=(), microphone=(), geolocation=(), payment=(), usb=()");
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  h.set("Content-Security-Policy", [
    "default-src 'self'",
    dev ? "script-src 'self' 'unsafe-eval' 'unsafe-inline'" : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "base-uri 'self'",
  ].join("; "));

  // Remove server fingerprinting
  h.delete("X-Powered-By");
  h.delete("Server");

  return res;
}

// ─── proxy (Next.js 16 export name) ──────────────────────────────────────────
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // 1. API-only POST enforcement
  if (pathname.startsWith("/api/") && req.method !== "POST") {
    return applySecurityHeaders(
      NextResponse.json(
        { error: "Method not allowed" },
        { status: 405, headers: { Allow: "POST" } }
      )
    );
  }

  // 2. Rate limiting
  const routeEntry = Object.entries(LIMITS).find(([route]) =>
    pathname.startsWith(route)
  );

  if (routeEntry) {
    const [route, { limit, windowSec }] = routeEntry;
    const ip = getIp(req);
    const { allowed, remaining, retryAfter } = checkRateLimit(ip, route, limit, windowSec);

    if (!allowed) {
      const res = NextResponse.json(
        { error: "Too many requests — please wait before retrying.", retryAfter },
        { status: 429 }
      );
      res.headers.set("Retry-After",          String(retryAfter));
      res.headers.set("X-RateLimit-Limit",    String(limit));
      res.headers.set("X-RateLimit-Remaining","0");
      return applySecurityHeaders(res);
    }

    const res = NextResponse.next();
    res.headers.set("X-RateLimit-Limit",     String(limit));
    res.headers.set("X-RateLimit-Remaining", String(remaining));
    res.headers.set("X-RateLimit-Reset",     String(Math.ceil(Date.now() / 1000 + windowSec)));
    return applySecurityHeaders(res);
  }

  // 3. Security headers on all other routes
  return applySecurityHeaders(NextResponse.next());
}

// ─── Matcher config ───────────────────────────────────────────────────────────
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js)).*)",
  ],
};
