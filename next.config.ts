import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dynamically rendered routes (searchParams pages) read these JSON files at
  // request time on Vercel, so they must be traced into the serverless bundle.
  outputFileTracingIncludes: {
    "/*": ["./data/normalized/**", "./data/manifest.json", "./data/players.json"],
  },
};

export default nextConfig;
