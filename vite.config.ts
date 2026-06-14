import { defineConfig } from "vite";

// Static SPA for Cloudflare Pages. Assets in /public are served as-is; large GLBs
// get long-lived immutable caching via _headers (see public/_headers).
export default defineConfig({
  base: "/",
  build: {
    target: "es2022",
    sourcemap: false,
    assetsInlineLimit: 0, // never inline GLB/PNG — keep them cacheable files
  },
  server: { host: true },
});
