import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://projectops360.com";
  const lastModified = new Date("2026-08-21T00:00:00Z");

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
  ];
}
