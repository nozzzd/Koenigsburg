import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Litematica uploads for the build planner go through a Server Action; the
    // default 1 MB cap is too small for schematic files.
    serverActions: { bodySizeLimit: "26mb" },
  },
};

export default nextConfig;
