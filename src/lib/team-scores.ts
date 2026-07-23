import { prisma } from "./prisma";
import { calculateLeaderboard } from "./scoring";

/**
 * Pre-compute team scores and positions for a tournament.
 * Writes results to Team.totalScore and Team.position.
 * 
 * Call this after scores are synced or manually updated.
 * Pages then read stored values instead of recalculating on every request.
 */
export async function recalculateTeamScores(tournamentId: string): Promise<void> {
  const results = await calculateLeaderboard(tournamentId);
  if (results.length === 0) return;
  await prisma.$transaction(
    results.map((result) =>
      prisma.team.update({
        where: { id: result.teamId },
        data: {
          totalScore: result.totalStrokes,
          position: result.position || null,
        },
      }),
    ),
  );
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
