import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  poweredByHeader: false,
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
