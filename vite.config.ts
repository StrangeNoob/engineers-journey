import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  base: "/",
  build: { target: "es2022", sourcemap: false, assetsInlineLimit: 0 },
  server: { host: true },
  plugins: [
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["assets/models/*.glb", "assets/img/*.png", "draco/*"],
      workbox: {
        globPatterns: ["**/*.{js,css,html}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/assets/") || url.pathname.startsWith("/draco/"),
            handler: "CacheFirst",
            options: { cacheName: "world-assets", expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 90 } },
          },
        ],
      },
      manifest: {
        name: "An Engineer's Journey",
        short_name: "Journey",
        theme_color: "#e7decb",
        background_color: "#cdd6d3",
        display: "standalone",
        icons: [],
      },
    }),
  ],
});
