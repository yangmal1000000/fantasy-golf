import { prisma } from "./prisma";

/**
 * Pre-compute team scores and positions for a tournament.
 * Writes results to Team.totalScore and Team.position.
 * 
 * Call this after scores are synced or manually updated.
 * Pages then read stored values instead of recalculating on every request.
 */
export async function recalculateTeamScores(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) return;

  const [teams, allScores] = await Promise.all([
    prisma.team.findMany({
      where: { tournamentId },
      include: {
        selections: {
          include: {
            tournamentPlayer: {
              include: { player: true },
            },
          },
        },
      },
    }),
    prisma.score.findMany({ where: { tournamentId } }),
  ]);

  if (teams.length === 0) return;

  // Build score lookup: playerId -> total strokes
  const playerTotals = new Map<string, number>();
  for (const s of allScores) {
    if (s.strokes === null) continue;
    const current = playerTotals.get(s.playerId) ?? 0;
    playerTotals.set(s.playerId, current + s.strokes);
  }

  // Calculate each team's total
  const results: { teamId: string; totalStrokes: number }[] = [];

  for (const team of teams) {
    let total = 0;
    for (const sel of team.selections) {
      const playerId = sel.tournamentPlayer.playerId;
      total += playerTotals.get(playerId) ?? 0;
    }
    results.push({ teamId: team.id, totalStrokes: total });
  }

  // Sort by total ascending
  results.sort((a, b) => a.totalStrokes - b.totalStrokes);

  // Assign positions (handle ties) and write to DB
  let pos = 1;
  for (let i = 0; i < results.length; i++) {
    if (i > 0 && results[i].totalStrokes !== results[i - 1].totalStrokes) {
      pos = i + 1;
    }
    await prisma.team.update({
      where: { id: results[i].teamId },
      data: {
        totalScore: results[i].totalStrokes,
        position: pos,
      },
    });
  }
}

/**
 * Get teams with pre-computed scores (fast — single query, no calculation).
 * Returns teams sorted by position with player selections.
 */
export async function getTeamsWithScores(tournamentId: string) {
  return prisma.team.findMany({
    where: { tournamentId },
    orderBy: [{ position: "asc" }, { totalScore: "asc" }],
    include: {
      user: { select: { name: true, email: true } },
      selections: {
        include: {
          tournamentPlayer: {
            include: {
              player: { select: { id: true, name: true, country: true, photoUrl: true } },
            },
          },
        },
      },
    },
  });
}

/**
 * Get a single team with pre-computed score (fast).
 */
export async function getTeamWithScore(teamId: string) {
  return prisma.team.findUnique({
    where: { id: teamId },
    include: {
      user: true,
      tournament: true,
      selections: {
        include: {
          tournamentPlayer: {
            include: { player: true },
          },
        },
      },
    },
  });
}

/**
 * Get all teams for a user with tournament info (fast — uses stored scores).
 */
export async function getUserTeamsFast(userId: string) {
  return prisma.team.findMany({
    where: { userId },
    include: {
      tournament: true,
      selections: {
        include: {
          tournamentPlayer: {
            include: { player: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });
}
