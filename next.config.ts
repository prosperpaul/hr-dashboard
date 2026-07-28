import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Cache page data in the browser after you visit (or prefetch) a page, so
    // navigating back to it — or to a prefetched page — is INSTANT instead of
    // re-fetching from the server every time. Big win when the database is far.
    //   dynamic: seconds to keep data-driven pages cached client-side
    //   static:  seconds to keep static pages cached
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
};

export default nextConfig;
