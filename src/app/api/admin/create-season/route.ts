import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  TOURNAMENT_TEMPLATES,
  resolveTemplate,
  tierForRank,
} from "@/lib/tournament-templates";

/**
 * POST /api/admin/create-season
 * Body: { year: number }
 *
 * Creates all 15 tournaments for the given year using template data.
 * Links existing players to each tournament based on their dataGolfRank
 * and assigns tiers automatically.
 *
 * Idempotent: running twice for the same year will upsert (not duplicate).
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const year: number = Number(body.year);

    if (!year || year < 2024 || year > 2100) {
      return NextResponse.json(
        { ok: false, error: "Invalid year. Provide a year between 2024 and 2100." },
        { status: 400 }
      );
    }

    // Ensure schema columns exist (mirrors seed-tournaments idempotency)
    await prisma.$executeRaw`ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT 'major'`;
    await prisma.$executeRaw`ALTER TABLE "Tournament" ADD COLUMN IF NOT EXISTS "tour" TEXT DEFAULT 'pga'`;

    // Load all existing players once, split by gender prefix
    const allPlayers = await prisma.player.findMany({
      select: { id: true, dataGolfRank: true },
    });

    const mensPlayers = allPlayers.filter((p) => p.id.startsWith("player-"));
    const womensPlayers = allPlayers.filter((p) => p.id.startsWith("wplayer-"));

    const created: string[] = [];
    const skipped: string[] = [];
    let totalLinksCreated = 0;
    const tournamentSummaries: Array<{
      id: string;
      name: string;
      startDate: string;
      endDate: string;
      category: string;
      tour: string;
      playersLinked: number;
      status: "created" | "exists";
    }> = [];

    for (const template of TOURNAMENT_TEMPLATES) {
      const resolved = resolveTemplate(template, year);

      // Check if tournament already exists
      const existing = await prisma.tournament.findUnique({
        where: { id: resolved.id },
        select: { id: true },
      });

      // Upsert the tournament record (idempotent)
      await prisma.$executeRaw`
        INSERT INTO "Tournament" (id, name, course, "startDate", "endDate", status, par, "entryFee", "currentRound", "prizePool", category, tour, "createdAt")
        VALUES (
          ${resolved.id},
          ${resolved.name},
          ${resolved.course},
          ${resolved.startDate}::timestamptz,
          ${resolved.endDate}::timestamptz,
          'upcoming',
          ${resolved.par},
          ${resolved.entryFee},
          0,
          0,
          ${resolved.category},
          ${resolved.tour},
          NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
          name       = EXCLUDED.name,
          course     = EXCLUDED.course,
          par        = EXCLUDED.par,
          category   = EXCLUDED.category,
          tour       = EXCLUDED.tour,
          "entryFee" = EXCLUDED."entryFee"
      `;

      if (existing) {
        skipped.push(resolved.id);
      } else {
        created.push(resolved.id);
      }

      // Link players to this tournament based on gender
      const playerPool = resolved.gender === "womens" ? womensPlayers : mensPlayers;
      let linksForThis = 0;

      for (const player of playerPool) {
        const tier = tierForRank(player.dataGolfRank);
        const result = await prisma.$executeRaw`
          INSERT INTO "TournamentPlayer" (id, "tournamentId", "playerId", tier, "selectionCount", "withdrew")
          VALUES (gen_random_uuid(), ${resolved.id}, ${player.id}, ${tier}, 0, false)
          ON CONFLICT ("tournamentId", "playerId") DO NOTHING
        `;
        // $executeRaw returns number of affected rows
        if (result > 0) linksForThis++;
      }
      totalLinksCreated += linksForThis;

      tournamentSummaries.push({
        id: resolved.id,
        name: resolved.name,
        startDate: resolved.startDate.toISOString(),
        endDate: resolved.endDate.toISOString(),
        category: resolved.category,
        tour: resolved.tour,
        playersLinked: playerPool.length,
        status: existing ? "exists" : "created",
      });
    }

    return NextResponse.json({
      ok: true,
      year,
      created: created.length,
      skipped: skipped.length,
      totalTournaments: TOURNAMENT_TEMPLATES.length,
      totalLinksCreated,
      mensPlayersAvailable: mensPlayers.length,
      womensPlayersAvailable: womensPlayers.length,
      tournaments: tournamentSummaries,
    });
  } catch (e) {
    console.error("create-season error:", e);
    return NextResponse.json(
      { ok: false, error: String(e).slice(0, 500) },
      { status: 500 }
    );
  }
}
