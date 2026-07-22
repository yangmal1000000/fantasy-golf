import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const privateHeaders = [
      { key: "Cache-Control", value: "private, no-store, max-age=0" },
      { key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" },
      { key: "Referrer-Policy", value: "same-origin" },
    ];
    return [
      { source: "/target-judge", headers: privateHeaders },
      { source: "/target-control", headers: privateHeaders },
      { source: "/api/target-judge", headers: privateHeaders },
      { source: "/api/target-control", headers: privateHeaders },
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
