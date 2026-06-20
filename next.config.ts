import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
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