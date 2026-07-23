import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    const securityHeaders = [
      {
        key: "Strict-Transport-Security",
        value: "max-age=31536000; includeSubDomains",
      },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=()",
      },
    ];
    const privateHeaders = [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Referrer-Policy", value: "same-origin" },
    ];
    return [
      { source: "/(.*)", headers: securityHeaders },
      { source: "/target", headers: privateHeaders },
      { source: "/target-judge", headers: privateHeaders },
      { source: "/target-control", headers: privateHeaders },
      { source: "/rocket-control", headers: privateHeaders },
      { source: "/api/target-pilot-entry", headers: privateHeaders },
      { source: "/api/target-preview/access", headers: privateHeaders },
      { source: "/api/target-judge", headers: privateHeaders },
      { source: "/api/target-control", headers: privateHeaders },
      { source: "/api/rocket-beta-control", headers: privateHeaders },
      { source: "/api/tournaments/:id/teams", headers: privateHeaders },
    ];
  },
  async redirects() {
    return [
      { source: "/rankings", destination: "/power-rankings", permanent: true },
      { source: "/how-it-works", destination: "/how-to-play", permanent: true },
      { source: "/events", destination: "/tournaments", permanent: true },
    ];
  },
};

export default nextConfig;
