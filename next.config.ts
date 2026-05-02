import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ── Next.js 16: serverExternalPackages is now top-level (moved out of experimental) ──
  serverExternalPackages: ["sharp"],

  // ── Turbopack is now the default bundler — no flag needed ──
  // next dev and next build both use Turbopack automatically.
  // Use `next dev --webpack` or `next build --webpack` to opt back to Webpack.

  // ── Image config ──
  images: {
    // Next.js 16 changed default qualities to [75]. Restore broader range:
    qualities: [50, 75, 85, 95, 100],
    // Allow local IPs in development (Next.js 16 blocks by default for security)
    dangerouslyAllowLocalIP: process.env.NODE_ENV === "development",
    formats: ["image/avif", "image/webp"],
  },

  // ── Security headers (complement middleware/proxy) ──
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-DNS-Prefetch-Control",  value: "on" },
          { key: "X-Content-Type-Options",  value: "nosniff" },
          { key: "X-Frame-Options",         value: "DENY" },
          { key: "X-XSS-Protection",        value: "1; mode=block" },
          { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
        ],
      },
      {
        source: "/api/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "Pragma",        value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
