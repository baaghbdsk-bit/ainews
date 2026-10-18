import { withReticle } from '@reticlehq/next';
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    // Public, anonymous content only: the browser revalidates (max-age=0) while
    // the CDN may serve cached HTML/RSC for 10 minutes. Listed explicitly so
    // cron APIs and editor routes can never match by accident.
    const cacheHeaders = [
      {
        key: "Cache-Control",
        value: "public, max-age=0, s-maxage=600, stale-while-revalidate=300",
      },
    ];
    const publicPages = ["/", "/story/:slug*", "/topic/:slug*", "/sitemap.xml", "/robots.txt"];
    return publicPages.map((source) => ({ source, headers: cacheHeaders }));
  },
};

export default withReticle(nextConfig);
