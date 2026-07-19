import { prisma } from "@/lib/prisma";
import { getCurrentUserId } from "@/lib/auth";
import { calculateTeamScore, calculateLeaderboard } from "@/lib/scoring";
import type { TeamScoreResult, PlayerScoreSummary } from "@/lib/scoring";
import { notFound } from "next/navigation";
import Link from "next/link";
import LiveTrackerClient from "./LiveTrackerClient";

export const dynamic = "force-dynamic";

export default async function LiveMatchTrackerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();

  const tournament = await prisma.tournament.findUnique({ where: { id } });
  if (!tournament) notFound();

  // Find user's team
  let myTeamId: string | null = null;
  if (userId) {
    const team = await prisma.team.findFirst({
      where: { tournamentId: id, userId },
      orderBy: { createdAt: "asc" },
    });
    myTeamId = team?.id ?? null;
  }

  const allScores = await prisma.score.findMany({ where: { tournamentId: id } });

  // Build score lookup: playerId -> round -> strokes
  const scoreMap = new Map<string, Record<number, number | null>>();
  for (const s of allScores) {
    if (!scoreMap.has(s.playerId)) scoreMap.set(s.playerId, {});
    scoreMap.get(s.playerId)![s.round] = s.strokes;
  }

  // Build leaderboard entries for the mini leaderboard
  const leaderboard = await calculateLeaderboard(id).catch(() => []);

  // Build player list for client (only user's team players for the detail view,
  // plus all players for the "thrilling moments" feed)
  let teamPlayers: PlayerScoreSummary[] = [];
  let teamScore: TeamScoreResult | null = null;
  let teamPosition: number | null = null;
  if (myTeamId) {
    try {
      teamScore = await calculateTeamScore(myTeamId);
      teamPlayers = teamScore.players;
      teamPosition = leaderboard.find((r) => r.teamId === myTeamId)?.position ?? null;
    } catch {
      /* ignore */
    }
  }

  // Thrilling moments — eagles, birdies, albatrosses from user's team
  // Computed from per-round scores: a "thrilling" score is <= par-1 for the round
  const thrillingMoments: Array<{
    playerName: string;
    round: number;
    strokes: number;
    diff: number;
  }> = [];
  if (teamScore) {
    for (const p of teamScore.players) {
      for (let r = 0; r < 4; r++) {
        const s = p.roundScores[r];
        if (s == null) continue;
        const diff = s - tournament.par;
        if (diff <= -2) {
          thrillingMoments.push({
            playerName: p.playerName,
            round: r + 1,
            strokes: s,
            diff,
          });
        }
      }
    }
  }
  thrillingMoments.sort((a, b) => a.diff - b.diff);

  return (
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
      <div className="mb-4 text-xs">
        <Link
          href={`/tournaments/${id}/leaderboard`}
          className="text-zinc-500 hover:text-[#1a6b3c]"
        >
          ← Leaderboard
        </Link>
      </div>

      {/* Header */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f3d20] to-[#1a6b3c] p-5 text-white shadow-lg">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
          </span>
          <h1 className="text-xl font-bold">Live Match Tracker</h1>
        </div>
        <p className="mt-1 text-sm text-white/70">{tournament.name}</p>
        <p className="text-xs text-white/65">
          Round {tournament.currentRound || "—"} · Par {tournament.par}
        </p>
      </div>

      {!myTeamId || !teamScore ? (
        <div className="mt-6 rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-3xl">⛳</p>
          <p className="mt-2 text-sm text-zinc-600">
            You don&apos;t have a team in this tournament yet.
          </p>
          <Link
            href={`/tournaments/${id}/enter`}
            className="mt-4 inline-block rounded-full bg-[#1a6b3c] px-6 py-2 text-sm font-bold text-white hover:bg-[#0f3d20]"
          >
            Enter a Team →
          </Link>
        </div>
      ) : (
        <LiveTrackerClient
          tournamentId={id}
          tournamentName={tournament.name}
          par={tournament.par}
          currentRound={tournament.currentRound}
          teamName={teamScore.teamName}
          teamTotal={teamScore.totalStrokes}
          teamPosition={teamPosition ?? 0}
          players={teamPlayers.map((p) => ({
            playerId: p.playerId,
            playerName: p.playerName,
            tier: p.tier,
            roundScores: p.roundScores,
            totalStrokes: p.totalStrokes,
          }))}
          miniLeaderboard={leaderboard.slice(0, 5).map((r) => ({
            teamId: r.teamId,
            teamName: r.teamName,
            position: r.position,
            totalStrokes: r.totalStrokes,
          }))}
          thrillingMoments={thrillingMoments}
        />
      )}
    </div>
  );
}
