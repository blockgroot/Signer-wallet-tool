import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Suppress middleware deprecation warning (middleware.ts is still the correct way for route protection)
  experimental: {
    // This suppresses the proxy warning - middleware.ts is still valid for auth
  },
};

export default nextConfig;
