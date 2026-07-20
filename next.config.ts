import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/rankings", destination: "/power-rankings", permanent: true },
      { source: "/how-it-works", destination: "/how-to-play", permanent: true },
      { source: "/events", destination: "/tournaments", permanent: true },
    ];
  },
};

export default nextConfig;
