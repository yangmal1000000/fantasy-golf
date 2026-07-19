import { prisma } from "@/lib/prisma";
import { getPlayerScoreSummary } from "@/lib/scoring";

// ---------- Types ----------

export interface TopGolferStanding {
  sideBetId: string;
  userId: string;
  userName: string;
  playerId: string;
  playerName: string;
  totalStrokes: number;
  roundsPlayed: number;
  madeCut: boolean | null;
  position: number;
}

export interface BestRoundResult {
  round: number;
  teamId: string;
  teamName: string;
  ownerName: string;
  roundTotal: number;
  vsPar: number;
}

export interface DarkHorseStanding {
  sideBetId: string;
  userId: string;
  userName: string;
  playerId: string;
  playerName: string;
  totalStrokes: number;
  roundsPlayed: number;
  madeCut: boolean | null;
  position: number;
}

// ---------- Side Pot Helpers ----------

export async function getSidePots(tournamentId: string) {
  return prisma.tournamentSidePot.findMany({
    where: { tournamentId },
  });
}

export async function getSidePot(
  tournamentId: string,
  type: string
) {
  return prisma.tournamentSidePot.findFirst({
    where: { tournamentId, type },
  });
}

export async function getSideBetCount(
  tournamentId: string,
  type: string
): Promise<number> {
  return prisma.sideBet.count({
    where: { tournamentId, type },
  });
}

export async function getUserSideBets(
  tournamentId: string,
  userId: string,
  type?: string
) {
  return prisma.sideBet.findMany({
    where: { tournamentId, userId, ...(type ? { type } : {}) },
  });
}

// ---------- Ensure Default Side Pots ----------

/**
 * Ensures that the three default side pots exist for a tournament.
 * Called lazily when a side games page is visited.
 */
export async function ensureDefaultSidePots(tournamentId: string): Promise<void> {
  const existing = await prisma.tournamentSidePot.findMany({
    where: { tournamentId },
  });

  const defaults = [
    {
      type: "top_golfer",
      description: "Pick ONE golfer you think will shoot the lowest 4-round total",
      entryFee: 500,
    },
    {
      type: "best_round",
      description: "Lowest TEAM score for a single round wins — entered per round",
      entryFee: 500,
    },
    {
      type: "dark_horse",
      description: "Pick a Tier 5 (rank 51+) golfer to outperform the field",
      entryFee: 500,
    },
  ];

  for (const d of defaults) {
    if (!existing.some((e) => e.type === d.type)) {
      await prisma.tournamentSidePot.create({
        data: { tournamentId, ...d },
      });
    }
  }
}

// ---------- Top Golfer Standings ----------

export async function getTopGolferStandings(
  tournamentId: string
): Promise<TopGolferStanding[]> {
  const sideBets = await prisma.sideBet.findMany({
    where: { tournamentId, type: "top_golfer" },
    include: { tournament: true },
  });

  const results: TopGolferStanding[] = [];

  for (const bet of sideBets) {
    if (!bet.playerId) continue;

    const [user, summary] = await Promise.all([
      prisma.user.findUnique({ where: { id: bet.userId } }),
      getPlayerScoreSummary(bet.playerId, tournamentId),
    ]);

    results.push({
      sideBetId: bet.id,
      userId: bet.userId,
      userName: user?.name ?? user?.email ?? "Unknown",
      playerId: bet.playerId,
      playerName: summary.playerName,
      totalStrokes: summary.totalStrokes,
      roundsPlayed: summary.roundsPlayed,
      madeCut: summary.madeCut,
      position: 0,
    });
  }

  // Sort by total strokes ascending (lower = better)
  results.sort((a, b) => a.totalStrokes - b.totalStrokes);

  // Assign positions
  for (let i = 0; i < results.length; i++) {
    if (i > 0 && results[i].totalStrokes === results[i - 1].totalStrokes) {
      results[i].position = results[i - 1].position;
    } else {
      results[i].position = i + 1;
    }
  }

  return results;
}

// ---------- Best Round Standings ----------

export async function getBestRoundStandings(
  tournamentId: string
): Promise<BestRoundResult[]> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament) return [];

  const teams = await prisma.team.findMany({
    where: { tournamentId },
    include: {
      user: true,
      selections: {
        include: {
          tournamentPlayer: true,
        },
      },
    },
  });

  const results: BestRoundResult[] = [];

  for (const team of teams) {
    // "Best round" = lowest single-round team total
    // Calculate each round individually
    const roundTotals: Record<number, number> = {};

    for (const selection of team.selections) {
      const scores = await prisma.score.findMany({
        where: {
          tournamentId,
          playerId: selection.tournamentPlayer.playerId,
        },
      });
      for (const score of scores) {
        if (score.strokes != null) {
          roundTotals[score.round] = (roundTotals[score.round] ?? 0) + score.strokes;
        }
      }
    }

    // Find the best (lowest) round
    let bestRound = 0;
    let bestTotal = Infinity;
    for (const [round, total] of Object.entries(roundTotals)) {
      if (total < bestTotal) {
        bestTotal = total;
        bestRound = parseInt(round);
      }
    }

    if (bestRound > 0) {
      const par = tournament.par * team.selections.length;
      results.push({
        round: bestRound,
        teamId: team.id,
        teamName: team.name,
        ownerName: team.user?.name ?? team.user?.email ?? "Unknown",
        roundTotal: bestTotal,
        vsPar: bestTotal - par,
      });
    }
  }

  // Sort by best round total ascending
  results.sort((a, b) => a.roundTotal - b.roundTotal);

  return results;
}

/**
 * Get best team score per round (for the best-round page showing all rounds)
 */
export async function getBestPerRound(
  tournamentId: string
): Promise<{ round: number; bestTeam: BestRoundResult | null; allTeams: { teamId: string; teamName: string; ownerName: string; roundTotal: number; vsPar: number }[] }[]> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament) return [];

  const maxRound = Math.max(tournament.currentRound, 0);
  if (maxRound === 0) return [];

  const teams = await prisma.team.findMany({
    where: { tournamentId },
    include: {
      user: true,
      selections: {
        include: {
          tournamentPlayer: true,
        },
      },
    },
  });

  const result: { round: number; bestTeam: BestRoundResult | null; allTeams: { teamId: string; teamName: string; ownerName: string; roundTotal: number; vsPar: number }[] }[] = [];

  for (let round = 1; round <= maxRound; round++) {
    const roundEntries: { teamId: string; teamName: string; ownerName: string; roundTotal: number; vsPar: number }[] = [];

    for (const team of teams) {
      let roundTotal = 0;
      let allPlayed = true;

      for (const selection of team.selections) {
        const score = await prisma.score.findUnique({
          where: {
            tournamentId_playerId_round: {
              tournamentId,
              playerId: selection.tournamentPlayer.playerId,
              round,
            },
          },
        });

        if (score?.strokes != null) {
          roundTotal += score.strokes;
        } else {
          allPlayed = false;
        }
      }

      if (allPlayed && team.selections.length > 0) {
        const par = tournament.par * team.selections.length;
        roundEntries.push({
          teamId: team.id,
          teamName: team.name,
          ownerName: team.user?.name ?? team.user?.email ?? "Unknown",
          roundTotal,
          vsPar: roundTotal - par,
        });
      }
    }

    roundEntries.sort((a, b) => a.roundTotal - b.roundTotal);

    result.push({
      round,
      bestTeam: roundEntries[0] ? {
        round,
        teamId: roundEntries[0].teamId,
        teamName: roundEntries[0].teamName,
        ownerName: roundEntries[0].ownerName,
        roundTotal: roundEntries[0].roundTotal,
        vsPar: roundEntries[0].vsPar,
      } : null,
      allTeams: roundEntries,
    });
  }

  return result;
}

// ---------- Dark Horse Standings ----------

export async function getDarkHorseStandings(
  tournamentId: string
): Promise<DarkHorseStanding[]> {
  const sideBets = await prisma.sideBet.findMany({
    where: { tournamentId, type: "dark_horse" },
  });

  const results: DarkHorseStanding[] = [];

  for (const bet of sideBets) {
    if (!bet.playerId) continue;

    const [user, summary] = await Promise.all([
      prisma.user.findUnique({ where: { id: bet.userId } }),
      getPlayerScoreSummary(bet.playerId, tournamentId),
    ]);

    results.push({
      sideBetId: bet.id,
      userId: bet.userId,
      userName: user?.name ?? user?.email ?? "Unknown",
      playerId: bet.playerId,
      playerName: summary.playerName,
      totalStrokes: summary.totalStrokes,
      roundsPlayed: summary.roundsPlayed,
      madeCut: summary.madeCut,
      position: 0,
    });
  }

  results.sort((a, b) => a.totalStrokes - b.totalStrokes);

  for (let i = 0; i < results.length; i++) {
    if (i > 0 && results[i].totalStrokes === results[i - 1].totalStrokes) {
      results[i].position = results[i - 1].position;
    } else {
      results[i].position = i + 1;
    }
  }

  return results;
}

/**
 * Get all Tier 5 players for a tournament with their scores
 */
export async function getT5Players(tournamentId: string) {
  const tournamentPlayers = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, tier: "T51_PLUS", withdrew: false },
    include: { player: true },
  });

  const players = [];
  for (const tp of tournamentPlayers) {
    const summary = await getPlayerScoreSummary(tp.playerId, tournamentId);
    players.push({
      playerId: tp.playerId,
      playerName: tp.player.name,
      country: tp.player.country,
      dataGolfRank: tp.player.dataGolfRank,
      totalStrokes: summary.totalStrokes,
      roundsPlayed: summary.roundsPlayed,
      madeCut: summary.madeCut,
    });
  }

  players.sort((a, b) => a.totalStrokes - b.totalStrokes);
  return players;
}

/**
 * Get all individual players in a tournament with their 4-round totals
 */
export async function getAllPlayersWithScores(tournamentId: string) {
  const tournamentPlayers = await prisma.tournamentPlayer.findMany({
    where: { tournamentId, withdrew: false },
    include: { player: true },
  });

  const players = [];
  for (const tp of tournamentPlayers) {
    const summary = await getPlayerScoreSummary(tp.playerId, tournamentId);
    players.push({
      playerId: tp.playerId,
      playerName: tp.player.name,
      country: tp.player.country,
      dataGolfRank: tp.player.dataGolfRank,
      tier: tp.tier,
      totalStrokes: summary.totalStrokes,
      roundsPlayed: summary.roundsPlayed,
      madeCut: summary.madeCut,
      roundScores: summary.roundScores,
    });
  }

  players.sort((a, b) => a.totalStrokes - b.totalStrokes);
  return players;
}
