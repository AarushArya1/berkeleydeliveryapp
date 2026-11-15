import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // cacheComponents / partialPrefetching are left off: they rely on Node.js
  // timer behaviour the Cloudflare Workers runtime doesn't have, and every
  // page using them hangs there (500). Nothing in the app uses "use cache".
  experimental: {
    // Item/receipt and drop-off photos are uploaded through server actions
    // (shrunk on the phone first, but leave headroom).
    serverActions: { bodySizeLimit: "10mb" },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
