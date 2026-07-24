import type { NextConfig } from "next";

// Baseline security headers applied to every response. Defense-in-depth that
// costs nothing and cannot break the app: no Content-Security-Policy is set
// here yet because the theme-bootstrap inline script in app/layout.tsx and the
// Vercel analytics scripts would need nonces/hashes first (tracked as a
// follow-up). Permissions-Policy only disables sensors we never use and leaves
// fullscreen (the atlas map) alone.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  experimental: {
    // Litematica uploads for the build planner go through a Server Action; the
    // default 1 MB cap is too small for schematic files.
    serverActions: { bodySizeLimit: "26mb" },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
