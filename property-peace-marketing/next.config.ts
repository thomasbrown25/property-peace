import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  devIndicators: false,
  // Explicitly set the root directory to prevent Next.js from inferring the parent directory
  outputFileTracingRoot: path.join(__dirname),
  // Enable static export for Azure Static Web Apps
  output: 'export',
  // Disable image optimization (required for static export)
  images: {
    unoptimized: true,
  },
  // Add trailing slash for better Azure Static Web Apps routing compatibility
  trailingSlash: true,
};

export default nextConfig;
