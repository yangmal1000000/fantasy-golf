import { prisma } from "@/lib/prisma";
import DataFeedsClient from "./DataFeedsClient";

export const dynamic = "force-dynamic";

export default async function DataFeedsPage() {
  const [feeds, players] = await Promise.all([
    prisma.feedStatus.findMany({
      orderBy: { feedType: "asc" },
    }),
    prisma.player.findMany({
      select: {
        id: true,
        photoUrl: true,
        bio: true,
        dateOfBirth: true,
        college: true,
        careerEarnings: true,
        enrichedAt: true,
      },
    }),
  ]);

  // Data quality metrics
  const total = players.length;
  const withPhoto = players.filter((p) => p.photoUrl).length;
  const withBio = players.filter((p) => p.bio).length;
  const withDob = players.filter((p) => p.dateOfBirth).length;
  const withCollege = players.filter((p) => p.college).length;
  const withEarnings = players.filter((p) => p.careerEarnings).length;
  const enriched = players.filter((p) => p.enrichedAt).length;

  const metrics = {
    total,
    withPhoto,
    withBio,
    withDob,
    withCollege,
    withEarnings,
    enriched,
    photoPct: total > 0 ? Math.round((withPhoto / total) * 100) : 0,
    bioPct: total > 0 ? Math.round((withBio / total) * 100) : 0,
    enrichedPct: total > 0 ? Math.round((enriched / total) * 100) : 0,
  };

  return <DataFeedsClient feeds={JSON.parse(JSON.stringify(feeds))} metrics={metrics} />;
}
