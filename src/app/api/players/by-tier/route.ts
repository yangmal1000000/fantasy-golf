import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { tierForRank } from "@/lib/tournament-templates";
import { TIER_ORDER } from "@/lib/ui";

export const dynamic = "force-dynamic";

// GET — return all players grouped by tier (for saved team editor picker)
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Sign in required" }, { status: 401 });
    }

    const players = await prisma.player.findMany({
      where: {
        // Only players with a rank — unranked players go to T51_PLUS but
        // we include them so long as they exist in the DB
        OR: [
          { tournaments: { some: {} } }, // appeared in at least one tournament
        ],
      },
      select: {
        id: true,
        name: true,
        country: true,
        photoUrl: true,
        dataGolfRank: true,
        wtRank: true,
      },
      orderBy: { dataGolfRank: "asc" },
    });

    // Group by tier
    const byTier: Record<string, typeof players> = {};
    for (const tier of TIER_ORDER) {
      byTier[tier] = [];
    }

    for (const p of players) {
      const tier = tierForRank(p.dataGolfRank);
      if (!byTier[tier]) byTier[tier] = [];
      byTier[tier].push(p);
    }

    return NextResponse.json({ byTier });
  } catch (err) {
    console.error("Players by-tier GET error:", err);
    return NextResponse.json({ error: "Failed to fetch players" }, { status: 500 });
  }
}
