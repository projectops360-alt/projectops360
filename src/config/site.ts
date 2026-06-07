/**
 * ProjectOps360° — Brand & Site Constants
 * Inspired by Ascendia's soft green palette
 */

export const siteConfig = {
  name: "ProjectOps360°",
  shortName: "POps360",
  description: "Project Operations Management Platform",
  url: "https://projectops360.com",
  locale: {
    default: "en",
    supported: ["en", "es"] as const,
  },
} as const;

export const brandColors = {
  /** Primary soft green palette */
  brand: {
    50: "#ecfdf5",
    100: "#d1fae5",
    200: "#a7f3d0",
    300: "#6ee7b7",
    400: "#34d399",
    500: "#10b981",
    600: "#059669",
    700: "#047857",
    800: "#065f46",
    900: "#064e3b",
    950: "#022c22",
  },
} as const;

export type Locale = (typeof siteConfig.locale.supported)[number];