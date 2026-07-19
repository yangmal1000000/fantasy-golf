import { prisma } from "@/lib/prisma";
import { TIER_CONFIG } from "@/lib/ui";

export const dynamic = "force-dynamic";

export interface ProjectedData {
  projectedCutLine: number | null;
  teams: {
    teamId: string;
    teamName: string;
    ownerName: string;
    totalStrokes: number;
    position: number;
    projectedPosition: number;
    playersAtRisk: { name: string; tier: string; currentTotal: number; wouldMissCut: boolean }[];
  }[];
}

/**
 * Calculate projected standings based on current scores.
 * - Estimates projected cut line from current R1+R2 scoring data
 * - Projects final team positions
 * - Identifies players at risk of missing the cut
 */
export async function calculateProjectedStandings(
  tournamentId: string
): Promise<ProjectedData | null> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament) return null;

  const [tournamentPlayers, scores, teams] = await Promise.all([
    prisma.tournamentPlayer.findMany({
      where: { tournamentId },
      include: { player: true },
    }),
    prisma.score.findMany({
      where: { tournamentId },
      orderBy: { round: "asc" },
    }),
    prisma.team.findMany({
      where: { tournamentId },
      include: {
        user: true,
        selections: {
          include: {
            tournamentPlayer: {
              include: { player: true },
            },
          },
        },
      },
    }),
  ]);

  if (teams.length === 0) return null;

  const par = tournament.par;

  // Build score lookup: { [playerId]: { 1: strokes, 2: strokes, ... } }
  const scoreMap: Record<string, Record<number, number | null>> = {};
  for (const s of scores) {
    if (!scoreMap[s.playerId]) scoreMap[s.playerId] = {};
    scoreMap[s.playerId][s.round] = s.strokes;
  }

  // Calculate per-player current totals through played rounds
  const playerData = tournamentPlayers.map((tp) => {
    const sm = scoreMap[tp.playerId] ?? {};
    const r1 = sm[1] ?? null;
    const r2 = sm[2] ?? null;
    const r3 = sm[3] ?? null;
    const r4 = sm[4] ?? null;
    const playedRounds = [r1, r2, r3, r4].filter((s) => s != null);
    const playedTotal = playedRounds.reduce<number>((sum, s) => sum + (s ?? 0), 0);
    const r1r2Total = (r1 ?? 0) + (r2 ?? 0);
    const hasR1R2 = r1 != null && r2 != null;

    return {
      playerId: tp.playerId,
      name: tp.player.name,
      tier: tp.tier,
      madeCut: tp.madeCut,
      r1, r2, r3, r4,
      playedTotal,
      roundsPlayed: playedRounds.length,
      r1r2Total,
      hasR1R2,
    };
  });

  // Estimate projected cut line from R1+R2 data
  // Standard rule: top 70 (or in our case ~30 of 50) and ties after 2 rounds
  let projectedCutLine: number | null = tournament.cutLine;

  if (projectedCutLine == null) {
    const withR1R2 = playerData
      .filter((p) => p.hasR1R2)
      .sort((a, b) => a.r1r2Total - b.r1r2Total);

    if (withR1R2.length > 0) {
      // Default cut: top 60% of players and ties
      const cutIdx = Math.floor(withR1R2.length * 0.6);
      const cutScore = withR1R2[Math.min(cutIdx, withR1R2.length - 1)]?.r1r2Total;
      if (cutScore != null) {
        projectedCutLine = cutScore;
      }
    }
  }

  // For each team, compute current total and at-risk players
  const teamProjections = teams.map((team) => {
    let totalStrokes = 0;
    const playersAtRisk: {
      name: string;
      tier: string;
      currentTotal: number;
      wouldMissCut: boolean;
    }[] = [];

    for (const sel of team.selections) {
      const tp = sel.tournamentPlayer;
      const pd = playerData.find((p) => p.playerId === tp.playerId);
      if (!pd) continue;

      // Estimate: if cut has not been applied yet, project whether they'd miss
      const playerStrokes = pd.playedTotal;
      totalStrokes += playerStrokes;

      // At-risk: has R1+R2 scores and would miss projected cut
      if (
        pd.hasR1R2 &&
        projectedCutLine != null &&
        pd.r1r2Total > projectedCutLine &&
        tp.madeCut == null // cut not yet officially applied
      ) {
        playersAtRisk.push({
          name: pd.name,
          tier: pd.tier,
          currentTotal: pd.r1r2Total,
          wouldMissCut: true,
        });
      }

      // Already missed cut
      if (tp.madeCut === false) {
        playersAtRisk.push({
          name: pd.name,
          tier: pd.tier,
          currentTotal: pd.r1r2Total,
          wouldMissCut: true,
        });
      }
    }

    return {
      teamId: team.id,
      teamName: team.name,
      ownerName: team.user?.name ?? team.user?.email ?? "Unknown",
      totalStrokes,
      position: team.position ?? 0,
      projectedPosition: 0, // assigned below
      playersAtRisk,
    };
  });

  // Sort by total and assign projected positions
  teamProjections.sort((a, b) => a.totalStrokes - b.totalStrokes);
  let pos = 1;
  for (let i = 0; i < teamProjections.length; i++) {
    if (i > 0 && teamProjections[i].totalStrokes === teamProjections[i - 1].totalStrokes) {
      teamProjections[i].projectedPosition = teamProjections[i - 1].projectedPosition;
    } else {
      teamProjections[i].projectedPosition = pos;
    }
    pos = i + 1;
  }

  return {
    projectedCutLine,
    teams: teamProjections,
  };
}
