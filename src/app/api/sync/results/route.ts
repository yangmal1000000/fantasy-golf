import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recalculateTeamScores } from "@/lib/team-scores";
import { processAutoSubs } from "@/lib/auto-sub";

/**
 * POST /api/sync/results
 * Fetches tournament results from ESPN's hidden API and syncs scores into the DB.
 * Handles both PGA and LPGA tours.
 * Called by Vercel cron (daily at 10pm) or manually from admin.
 */

const ESPN_ENDPOINTS = {
  pga: "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard",
  lpga: "https://site.api.espn.com/apis/site/v2/sports/golf/lpga/scoreboard",
} as const;

async function fetchEspnScoreboard(tour: "pga" | "lpga"): Promise<any[]> {
  try {
    const res = await fetch(ESPN_ENDPOINTS[tour], {
      headers: { "User-Agent": "FantasyGolf/1.0" },
      next: { revalidate: 0 },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.events || [];
  } catch {
    return [];
  }
}

/**
 * Fuzzy-match a DB tournament to an ESPN event by name.
 * Handles abbreviations and partial matches.
 */
function matchEspnEvent(tournamentName: string, events: any[]): any | null {
  const dbName = tournamentName.toLowerCase().trim();

  // Direct + substring match
  let match = events.find((e: any) => {
    const espnName = (e.name || "").toLowerCase().trim();
    return espnName === dbName || espnName.includes(dbName) || dbName.includes(espnName);
  });
  if (match) return match;

  // Word-based fuzzy match for "Open" tournaments etc.
  match = events.find((e: any) => {
    const espnName = (e.name || "").toLowerCase().trim();
    if (espnName.includes("open") && dbName.includes("open")) {
      return espnName.split(" ").some((w: string) => w.length > 4 && dbName.includes(w));
    }
    // Match on significant words (length > 3)
    const dbWords = dbName.split(" ").filter((w: string) => w.length > 3);
    const espnWords = espnName.split(" ").filter((w: string) => w.length > 3);
    const overlap = dbWords.filter((w: string) => espnWords.includes(w));
    return overlap.length >= 2;
  });
  return match ?? null;
}

/**
 * Parse ESPN competitor linescores into [R1, R2, R3, R4].
 */
function parseRounds(comp: any): (number | null)[] {
  const linescores: any[] = comp.linescores || [];
  const rounds: (number | null)[] = [null, null, null, null];
  let roundIdx = 0;
  for (const ls of linescores) {
    if (roundIdx >= 4) break;
    const val = ls.value ? parseInt(ls.value) : null;
    rounds[roundIdx] = val;
    roundIdx++;
  }
  return rounds;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const { tournamentId } = body;

  // If tournamentId provided, sync just that tournament
  // Otherwise, sync all in-progress or recently completed tournaments
  const where = tournamentId
    ? { id: tournamentId }
    : { status: { in: ["in_progress", "completed"] } };

  const tournaments = await prisma.tournament.findMany({ where });

  if (tournaments.length === 0) {
    return NextResponse.json({ message: "No tournaments to sync" });
  }

  // Fetch both tours in parallel
  const [pgaEvents, lpgaEvents] = await Promise.all([
    fetchEspnScoreboard("pga"),
    fetchEspnScoreboard("lpga"),
  ]);

  let totalSynced = 0;
  let totalPlayers = 0;
  let totalMatched = 0;
  const results: string[] = [];

  for (const tournament of tournaments) {
    // Pick the right tour events
    const isLpga = tournament.tour === "lpga" || tournament.category === "lpga_major";
    const events = isLpga ? lpgaEvents : pgaEvents;

    // If we got no events for the expected tour, try the other as fallback
    const espnEvent = matchEspnEvent(tournament.name, events)
      ?? (isLpga ? matchEspnEvent(tournament.name, pgaEvents) : matchEspnEvent(tournament.name, lpgaEvents));

    if (!espnEvent) {
      results.push(`${tournament.name}: no ESPN match (${isLpga ? "LPGA" : "PGA"})`);
      continue;
    }

    totalMatched++;

    const competition = espnEvent.competitions?.[0];
    if (!competition) {
      results.push(`${tournament.name}: no competition data`);
      continue;
    }

    const competitors: any[] = competition.competitors || [];
    let tournamentSynced = 0;

    // Get existing TournamentPlayer records
    const tournamentPlayers = await prisma.tournamentPlayer.findMany({
      where: { tournamentId: tournament.id },
      include: { player: true },
    });

    // Build name → playerId map (full name + last name)
    const nameMap = new Map<string, string>();
    for (const tp of tournamentPlayers) {
      nameMap.set(tp.player.name.toLowerCase(), tp.playerId);
      const lastName = tp.player.name.split(" ").slice(-1)[0]?.toLowerCase();
      if (lastName) nameMap.set(lastName, tp.playerId);
    }

    for (const comp of competitors) {
      const athleteName: string = comp.athlete?.displayName || "";
      if (!athleteName) continue;

      // Match player: exact → last name → DB search
      let playerId = nameMap.get(athleteName.toLowerCase());
      if (!playerId) {
        const lastName = athleteName.split(" ").slice(-1)[0]?.toLowerCase();
        playerId = nameMap.get(lastName);
      }
      if (!playerId) {
        const dbPlayer = await prisma.player.findFirst({
          where: { name: { contains: athleteName, mode: "insensitive" } },
        });
        if (dbPlayer) playerId = dbPlayer.id;
      }
      if (!playerId) continue;

      const rounds = parseRounds(comp);

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

      // Update madeCut
      const roundsPlayed = rounds.filter((r) => r !== null).length;
      await prisma.tournamentPlayer.updateMany({
        where: { tournamentId: tournament.id, playerId },
        data: { madeCut: roundsPlayed >= 3 },
      });
    }

    // Update tournament status if ESPN says final
    if (espnEvent.status?.type?.state === "post" && tournament.status !== "completed") {
      await prisma.tournament.update({
        where: { id: tournament.id },
        data: { status: "completed", currentRound: 4 },
      });
    }

    totalSynced += tournamentSynced;
    totalPlayers += competitors.length;
    results.push(`${tournament.name}: ${tournamentSynced} scores from ${competitors.length} players (${isLpga ? "LPGA" : "PGA"})`);
  }

  // Recalculate team scores for all synced tournaments
  for (const tournament of tournaments) {
    // Process auto-subs BEFORE recalculating scores so teams have valid players
    const subResult = await processAutoSubs(tournament.id);
    if (subResult.subsProcessed > 0) {
      results.push(
        `${tournament.name}: ${subResult.subsProcessed} auto-subs processed`,
      );
    }
    await recalculateTeamScores(tournament.id);
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
    matched: totalMatched,
    pgaEvents: pgaEvents.length,
    lpgaEvents: lpgaEvents.length,
    results,
  });
}
