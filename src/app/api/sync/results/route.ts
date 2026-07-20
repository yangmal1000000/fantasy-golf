import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/sync/results
 * Fetches tournament results from ESPN's hidden API and syncs scores into the DB.
 * Called by Vercel cron (daily at 10pm) or manually from admin.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { tournamentId } = body;

  // If tournamentId provided, sync just that tournament
  // Otherwise, sync all in-progress or recently completed tournaments
  const where = tournamentId
    ? { id: tournamentId }
    : {
        status: { in: ["in_progress", "completed"] },
      };

  const tournaments = await prisma.tournament.findMany({ where });

  if (tournaments.length === 0) {
    return NextResponse.json({ message: "No tournaments to sync" });
  }

  // Fetch ESPN scoreboard
  const espnRes = await fetch(
    "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard",
    { headers: { "User-Agent": "FantasyGolf/1.0" } }
  );

  if (!espnRes.ok) {
    return NextResponse.json({ error: "ESPN API unreachable" }, { status: 502 });
  }

  const espnData = await espnRes.json();
  const events = espnData.events || [];

  let totalSynced = 0;
  let totalPlayers = 0;
  const results: string[] = [];

  for (const tournament of tournaments) {
    // Match tournament to ESPN event by name (fuzzy)
    const espnEvent = events.find((e: any) => {
      const espnName = e.name.toLowerCase();
      const dbName = tournament.name.toLowerCase();
      return (
        espnName === dbName ||
        espnName.includes(dbName) ||
        dbName.includes(espnName) ||
        // Common nickname matching
        (espnName.includes("open") && dbName.includes("open") &&
         espnName.split(" ").some((w: string) => w.length > 4 && dbName.includes(w)))
      );
    });

    if (!espnEvent) {
      results.push(`${tournament.name}: no ESPN match`);
      continue;
    }

    // Get competition data
    const competition = espnEvent.competitions?.[0];
    if (!competition) {
      results.push(`${tournament.name}: no competition data`);
      continue;
    }

    const competitors: any[] = competition.competitors || [];
    const par = tournament.par;
    let tournamentSynced = 0;

    // Get existing TournamentPlayer records for this tournament
    const tournamentPlayers = await prisma.tournamentPlayer.findMany({
      where: { tournamentId: tournament.id },
      include: { player: true },
    });

    // Build name → playerId map
    const nameMap = new Map<string, string>();
    for (const tp of tournamentPlayers) {
      nameMap.set(tp.player.name.toLowerCase(), tp.playerId);
      // Also map last name only for fuzzy matching
      const lastName = tp.player.name.split(" ").slice(-1)[0]?.toLowerCase();
      if (lastName) nameMap.set(lastName, tp.playerId);
    }

    for (const comp of competitors) {
      const athleteName: string = comp.athlete?.displayName || "";
      if (!athleteName) continue;

      // Try to match player
      let playerId = nameMap.get(athleteName.toLowerCase());
      if (!playerId) {
        const lastName = athleteName.split(" ").slice(-1)[0]?.toLowerCase();
        playerId = nameMap.get(lastName);
      }

      if (!playerId) {
        // Try to find in Player table
        const dbPlayer = await prisma.player.findFirst({
          where: { name: { contains: athleteName, mode: "insensitive" } },
        });
        if (dbPlayer) playerId = dbPlayer.id;
      }

      if (!playerId) continue; // Skip unmatched

      // Parse round scores from linescores
      const linescores: any[] = comp.linescores || [];
      const rounds: (number | null)[] = [null, null, null, null];
      let roundIdx = 0;
      for (const ls of linescores) {
        if (roundIdx < 4) {
          const val = ls.value ? parseInt(ls.value) : null;
          rounds[roundIdx] = val;
          roundIdx++;
        }
      }

      // Upsert scores
      for (let r = 0; r < 4; r++) {
        if (rounds[r] !== null) {
          await prisma.score.upsert({
            where: {
              tournamentId_playerId_round: {
                tournamentId: tournament.id,
                playerId,
                round: r + 1,
              },
            },
            update: { strokes: rounds[r], isEstimated: false, updatedAt: new Date() },
            create: {
              tournamentId: tournament.id,
              playerId,
              round: r + 1,
              strokes: rounds[r],
              isEstimated: false,
            },
          });
          tournamentSynced++;
        }
      }

      // Update madeCut based on rounds played
      const roundsPlayed = rounds.filter((r) => r !== null).length;
      await prisma.tournamentPlayer.updateMany({
        where: { tournamentId: tournament.id, playerId },
        data: { madeCut: roundsPlayed >= 3 },
      });
    }

    // Update tournament status if ESPN says it's final
    if (espnEvent.status?.type?.state === "post" && tournament.status !== "completed") {
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: { status: "completed", currentRound: 4 },
      });
    }

    totalSynced += tournamentSynced;
    totalPlayers += competitors.length;
    results.push(`${tournament.name}: ${tournamentSynced} scores synced from ${competitors.length} players`);
  }

  // Update feed status
  await prisma.feedStatus.updateMany({
    where: { feedType: "results", feedSource: "espn" },
    data: {
      status: "success",
      lastRunAt: new Date(),
      recordsSynced: totalSynced,
      recordsTotal: totalPlayers,
      errorCount: 0,
      lastError: null,
      lastMessage: results.join("; "),
      updatedAt: new Date(),
    },
  });

  return NextResponse.json({
    synced: totalSynced,
    total: totalPlayers,
    results,
  });
}
