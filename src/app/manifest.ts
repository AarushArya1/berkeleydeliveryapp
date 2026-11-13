import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Dart",
    short_name: "Dart",
    description: "Berkeley students pick up what you need on trips they're already making.",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#f4fbe6",
    icons: [
      { src: "/pwa-icon/192", sizes: "192x192", type: "image/png" },
      { src: "/pwa-icon/512", sizes: "512x512", type: "image/png" },
      { src: "/pwa-icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
