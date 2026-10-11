import type { MetadataRoute } from "next";

// Lets people add SafeSight to their home screen, where it opens full screen
// like an app, on the site's paper color.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SafeSight",
    short_name: "SafeSight",
    description: "Check a room for things that may confuse or trip someone living with dementia, and see the cheapest way to fix each one.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f4ede4",
    theme_color: "#f4ede4",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
