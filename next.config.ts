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
  // Ensure the Product Intelligence Center server route can read the
  // Product Intelligence™ markdown at runtime on Vercel. These files live
  // outside src/ and would otherwise not be traced into the function bundle.
  outputFileTracingIncludes: {
    "/[locale]/(app)/product-intelligence": ["./docs/product-brain/**/*.md"],
    "/[locale]/(app)/product-intelligence/**": ["./docs/product-brain/**/*.md"],
  },
};

export default withNextIntl(nextConfig);