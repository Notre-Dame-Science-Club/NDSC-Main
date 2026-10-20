import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Notre Dame Science Club",
    short_name: "NDSC",
    description:
      "Official app of Notre Dame Science Club (NDSC) — activities, olympiad, member dashboard and more.",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#020810",
    theme_color: "#020810",
    lang: "en",
    categories: ["education"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Dashboard", url: "/dashboard", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Olympiad", url: "/olympiad", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Activities", url: "/activities", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
