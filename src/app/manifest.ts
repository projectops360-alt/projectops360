import type { MetadataRoute } from "next";

/**
 * Served by Next at /manifest.webmanifest. Together with the service worker in
 * public/sw.js this is what makes browsers offer "Install app".
 *
 * Installability checklist (Chromium): name, short_name, start_url, an icon at
 * 192px and one at 512px, display "standalone", and a registered service worker
 * with a fetch handler.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ProjectOps360°",
    short_name: "ProjectOps360",
    description: "Project Operations Management Platform",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#ffffff",
    theme_color: "#022826",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
