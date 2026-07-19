import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://fantasy-golf-phi.vercel.app";
  const lastModified = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified, changeFrequency: "daily", priority: 1.0 },
    { url: `${base}/tournaments`, lastModified, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/players`, lastModified, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/leagues`, lastModified, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/my-teams`, lastModified, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/how-to-play`, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/blog`, lastModified, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/power-rankings`, lastModified, changeFrequency: "weekly", priority: 0.6 },
    { url: `${base}/achievements`, lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/referrals`, lastModified, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/contact`, lastModified, changeFrequency: "monthly", priority: 0.3 },
  ];

  return staticRoutes;
}
