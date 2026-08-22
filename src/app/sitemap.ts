import type { MetadataRoute } from "next";

const buyerIntentPaths = [
  "/project-bottleneck-detection-software",
  "/ai-project-blocker-detection",
  "/project-delay-root-cause-analysis",
  "/project-dependency-impact-analysis",
  "/project-rework-detection",
  "/project-execution-intelligence-software",
  "/transformation-management-office-software",
  "/pmo-systemic-bottleneck-analysis",
  "/planned-vs-actual-project-execution",
  "/sap-transformation-bottleneck-detection",
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://projectops360.com";
  const lastModified = new Date("2026-08-22T00:00:00Z");

  return [
    {
      url: `${base}/landing`,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/project-friction-intelligence`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.95,
    },
    {
      url: `${base}/how-to-detect-project-friction`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/process-mining-for-pmo`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/ai-pmo-portfolio-risk-management`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    {
      url: `${base}/sap-transformation-project-intelligence`,
      lastModified,
      changeFrequency: "weekly",
      priority: 0.9,
    },
    ...buyerIntentPaths.map((path) => ({
      url: `${base}${path}`,
      lastModified,
      changeFrequency: "weekly" as const,
      priority: 0.85,
    })),
  ];
}
