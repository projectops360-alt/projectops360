import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Build identity, frozen at build time and readable from both the server and
 * the client bundle. An installed PWA compares the id baked into its bundle
 * against the one the server reports; when they differ, a new version is live.
 *
 * On Vercel the commit SHA is the natural id. Locally it falls back to a
 * constant so `npm run dev` never reports itself as perpetually stale.
 */
const BUILD_ID =
  process.env.VERCEL_GIT_COMMIT_SHA ??
  process.env.NEXT_PUBLIC_BUILD_ID ??
  "development";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  env: {
    NEXT_PUBLIC_BUILD_ID: BUILD_ID,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self), payment=(), usb=()" },
        ],
      },
    ];
  },
  images: {
    // Prefer modern formats; Next serves AVIF/WebP when the browser supports it.
    formats: ["image/avif", "image/webp"],
  },
  compiler: {
    // Strip console.* in production (keep errors for diagnostics).
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error"] } : false,
  },
  experimental: {
    // Tree-shake named icon imports from lucide-react so only used icons ship.
    optimizePackageImports: ["lucide-react"],
  },
};

export default withNextIntl(nextConfig);
