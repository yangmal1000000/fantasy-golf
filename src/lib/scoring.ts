import { prisma } from "@/lib/prisma";
import {
  applyFantasyScorePolicy,
  compareTeamScoreKeys,
  deriveCutLine,
  fantasyScoreState,
  sameTeamScorePosition,
  type FantasyScoreState,
} from "@/lib/scoring-core";

// ---------- Types ----------

export interface PlayerScoreSummary {
  playerId: string;
  playerName: string;
  country: string | null;
  photoUrl: string | null;
  tier: string;
  roundScores: (number | null)[]; // [R1, R2, R3, R4]
  totalStrokes: number;
  roundsPlayed: number;
  vsPar: number;
  madeCut: boolean | null;
  withdrew: boolean;
  isEstimated: boolean[];
}

export interface TeamScoreResult {
  teamId: string;
  teamName: string;
  ownerName: string;
  players: PlayerScoreSummary[];
  totalStrokes: number;
  vsPar: number;
  roundsScored: number;
  scoreState: FantasyScoreState;
  position: number;
}

// ---------- Core Helpers ----------

export function getEstimatedScore(
  r1: number | null,
  r2: number | null
): number | null {
  if (r1 == null && r2 == null) return null;
  const scores = [r1, r2].filter((s): s is number => s != null);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
}

const TIER_ORDER: Record<string, number> = {
  T1_10: 1, T11_20: 2, T21_30: 3, T31_50: 4, T51_PLUS: 5,
};

// ---------- Batched Leaderboard (FAST) ----------

/**
 * Calculate the full leaderboard for a tournament in just 3 queries.
 * Replaces the old N+1 approach that took 5+ seconds.
 */
export async function calculateLeaderboard(
  tournamentId: string
): Promise<TeamScoreResult[]> {
  // Query 1: Tournament
  const tournament = await prisma.tournament.findUnique({ where: { id: tournamentId } });
  if (!tournament) throw new Error(`Tournament ${tournamentId} not found`);

  // Query 2: All teams with selections, players, users in one go
  const teams = await prisma.team.findMany({
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
  });

  if (teams.length === 0) return [];

  // Query 3: ALL scores for this tournament in one shot
  const allScores = await prisma.score.findMany({
    where: { tournamentId },
  });

  // Build a lookup: playerId -> round -> strokes
  const scoreMap = new Map<string, Map<number, { strokes: number | null; isEstimated: boolean }>>();
  for (const s of allScores) {
    if (!scoreMap.has(s.playerId)) scoreMap.set(s.playerId, new Map());
    scoreMap.get(s.playerId)!.set(s.round, { strokes: s.strokes, isEstimated: s.isEstimated });
  }

  // Calculate each team's score in memory (no more DB calls)
  const results: TeamScoreResult[] = teams.map((team) => {
    const playerSummaries: PlayerScoreSummary[] = team.selections.map((sel) => {
      const tp = sel.tournamentPlayer;
      const player = tp.player;
      const madeCut = tp.madeCut ?? null;
      const withdrew = tp.withdrew ?? false;

      const roundScores: (number | null)[] = [null, null, null, null];
      const isEstimated: boolean[] = [false, false, false, false];

      const pScores = scoreMap.get(player.id);
      if (pScores) {
        for (const [round, data] of pScores) {
          if (round >= 1 && round <= 4) {
            roundScores[round - 1] = data.strokes;
            isEstimated[round - 1] = data.isEstimated;
          }
        }
      }

      const scored = applyFantasyScorePolicy({
        scores: roundScores,
        estimates: isEstimated,
        par: tournament.par,
        madeCut,
        withdrew,
      });

      return {
        playerId: player.id,
        playerName: player.name,
        country: player.country,
        photoUrl: player.photoUrl,
        tier: tp.tier,
        roundScores: scored.roundScores,
        totalStrokes: scored.totalStrokes,
        roundsPlayed: scored.roundsScored,
        vsPar: scored.vsPar,
        madeCut,
        withdrew,
        isEstimated: scored.isEstimated,
      };
    });

    // Sort by tier
    playerSummaries.sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99));

    const totalStrokes = playerSummaries.reduce((sum, p) => sum + p.totalStrokes, 0);
    const roundsScored = playerSummaries.reduce((sum, p) => sum + p.roundsPlayed, 0);
    const vsPar = playerSummaries.reduce((sum, p) => sum + p.vsPar, 0);

    return {
      teamId: team.id,
      teamName: team.name,
      ownerName: team.user?.name ?? team.user?.email ?? "Unknown",
      players: playerSummaries,
      totalStrokes,
      vsPar,
      roundsScored,
      scoreState: fantasyScoreState(roundsScored, playerSummaries.length * 4),
      position: 0,
    };
  });

  results.sort(compareTeamScoreKeys);

  // Assign positions (handle ties)
  for (let i = 0; i < results.length; i++) {
    if (results[i].roundsScored === 0) {
      results[i].position = 0;
    } else if (i > 0 && sameTeamScorePosition(results[i], results[i - 1])) {
      results[i].position = results[i - 1].position;
    } else {
      results[i].position = i + 1;
    }
  }

  // NOTE: Removed $transaction write-back — was causing serverless timeouts on Vercel.
  // Positions are computed in-memory on every request instead.

  return results;
}

// ---------- Single Team Score (for team detail page) ----------

export async function calculateTeamScore(
  teamId: string
): Promise<TeamScoreResult> {
  const team = await prisma.team.findUnique({
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

  if (!team) throw new Error(`Team ${teamId} not found`);

  // Get all scores for this tournament in one query
  const allScores = await prisma.score.findMany({
    where: { tournamentId: team.tournamentId },
  });

  const scoreMap = new Map<string, Map<number, { strokes: number | null; isEstimated: boolean }>>();
  for (const s of allScores) {
    if (!scoreMap.has(s.playerId)) scoreMap.set(s.playerId, new Map());
    scoreMap.get(s.playerId)!.set(s.round, { strokes: s.strokes, isEstimated: s.isEstimated });
  }

  const playerSummaries: PlayerScoreSummary[] = team.selections.map((sel) => {
    const tp = sel.tournamentPlayer;
    const player = tp.player;
    const madeCut = tp.madeCut ?? null;
    const withdrew = tp.withdrew ?? false;

    const roundScores: (number | null)[] = [null, null, null, null];
    const isEstimated: boolean[] = [false, false, false, false];

    const pScores = scoreMap.get(player.id);
    if (pScores) {
      for (const [round, data] of pScores) {
        if (round >= 1 && round <= 4) {
          roundScores[round - 1] = data.strokes;
          isEstimated[round - 1] = data.isEstimated;
        }
      }
    }

    const scored = applyFantasyScorePolicy({
      scores: roundScores,
      estimates: isEstimated,
      par: team.tournament.par,
      madeCut,
      withdrew,
    });

    return {
      playerId: player.id,
      playerName: player.name,
      country: player.country,
      photoUrl: player.photoUrl,
      tier: tp.tier,
      roundScores: scored.roundScores,
      totalStrokes: scored.totalStrokes,
      roundsPlayed: scored.roundsScored,
      vsPar: scored.vsPar,
      madeCut,
      withdrew,
      isEstimated: scored.isEstimated,
    };
  });

  playerSummaries.sort((a, b) => (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99));

  const totalStrokes = playerSummaries.reduce((sum, p) => sum + p.totalStrokes, 0);
  const roundsScored = playerSummaries.reduce((sum, p) => sum + p.roundsPlayed, 0);
  const vsPar = playerSummaries.reduce((sum, p) => sum + p.vsPar, 0);

  return {
    teamId: team.id,
    teamName: team.name,
    ownerName: team.user?.name ?? team.user?.email ?? "Unknown",
    players: playerSummaries,
    totalStrokes,
    vsPar,
    roundsScored,
    scoreState: fantasyScoreState(roundsScored, playerSummaries.length * 4),
    position: team.position ?? 0,
  };
}

// ---------- Single Player Score (for side games) ----------

export async function getPlayerScoreSummary(
  playerId: string,
  tournamentId: string
): Promise<PlayerScoreSummary> {
  const [tournamentPlayer, tournament, player, scores] = await Promise.all([
    prisma.tournamentPlayer.findUnique({
      where: { tournamentId_playerId: { tournamentId, playerId } },
    }),
    prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { par: true },
    }),
    prisma.player.findUnique({ where: { id: playerId } }),
    prisma.score.findMany({ where: { tournamentId, playerId }, orderBy: { round: "asc" } }),
  ]);

  const tier = tournamentPlayer?.tier ?? "T51_PLUS";
  const madeCut = tournamentPlayer?.madeCut ?? null;
  const withdrew = tournamentPlayer?.withdrew ?? false;

  const roundScores: (number | null)[] = [null, null, null, null];
  const isEstimated: boolean[] = [false, false, false, false];

  for (const score of scores) {
    if (score.round >= 1 && score.round <= 4) {
      roundScores[score.round - 1] = score.strokes;
      isEstimated[score.round - 1] = score.isEstimated;
    }
  }

  const scored = applyFantasyScorePolicy({
    scores: roundScores,
    estimates: isEstimated,
    par: tournament?.par ?? 72,
    madeCut,
    withdrew,
  });

  return { playerId, playerName: player?.name ?? "Unknown", country: player?.country ?? null, photoUrl: player?.photoUrl ?? null, tier, roundScores: scored.roundScores, totalStrokes: scored.totalStrokes, roundsPlayed: scored.roundsScored, vsPar: scored.vsPar, madeCut, withdrew, isEstimated: scored.isEstimated };
}

// ---------- Cut Logic ----------

export async function applyCutLogic(tournamentId: string): Promise<void> {
  const tournament = await prisma.tournament.findUnique({
    where: { id: tournamentId },
  });
  if (!tournament) throw new Error(`Tournament ${tournamentId} not found`);

  const [tournamentPlayers, r1r2Scores] = await Promise.all([
    prisma.tournamentPlayer.findMany({
      where: { tournamentId, withdrew: false },
    }),
    prisma.score.findMany({
      where: { tournamentId, round: { in: [1, 2] } },
    }),
  ]);

  const scoreMap = new Map<string, { r1: number | null; r2: number | null }>();
  for (const s of r1r2Scores) {
    if (!scoreMap.has(s.playerId)) scoreMap.set(s.playerId, { r1: null, r2: null });
    if (s.round === 1) scoreMap.get(s.playerId)!.r1 = s.strokes;
    if (s.round === 2) scoreMap.get(s.playerId)!.r2 = s.strokes;
  }

  const playerTotals = tournamentPlayers
    .map((tp) => {
      const scores = scoreMap.get(tp.playerId) ?? { r1: null, r2: null };
      const total = (scores.r1 ?? 0) + (scores.r2 ?? 0);
      return {
        tournamentPlayerId: tp.id,
        playerId: tp.playerId,
        total,
        hasBoth: scores.r1 != null && scores.r2 != null,
      };
    })
    .filter((p) => p.hasBoth)
    .sort((a, b) => a.total - b.total);

  if (playerTotals.length === 0) return;

  let cutLine = tournament.cutLine;
  if (cutLine == null) {
    cutLine = deriveCutLine(playerTotals.map((player) => player.total));
  }
  if (cutLine == null) return;

  // Batch update all at once
  const updates = tournamentPlayers.map((tp) => {
    const scores = scoreMap.get(tp.playerId) ?? { r1: null, r2: null };
    const total = (scores.r1 ?? 0) + (scores.r2 ?? 0);
    const hasBoth = scores.r1 != null && scores.r2 != null;
    return prisma.tournamentPlayer.update({
      where: { id: tp.id },
      data: { madeCut: hasBoth ? total <= cutLine! : null },
    });
  });

  await prisma.$transaction(updates);
}
