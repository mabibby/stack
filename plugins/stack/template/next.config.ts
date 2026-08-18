import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Node-native packages out of the bundler; they run server-side only.
  serverExternalPackages: ["pino", "pino-pretty", "pg-boss"],
  // Fail the build on type errors — never ship red.
  typescript: { ignoreBuildErrors: false },
};

export default nextConfig;
