import { prisma } from "@/lib/prisma";
import { getCurrentUserId, getCurrentUser } from "@/lib/auth";
import { calculateLeaderboard, calculateTeamScore } from "@/lib/scoring";
import { notFound } from "next/navigation";
import Link from "next/link";
import { formatDateRange } from "@/lib/ui";
import ShareRoundButton from "./ShareRoundButton";

export const dynamic = "force-dynamic";

function scoreEmoji(strokes: number | null, par: number): string {
  if (strokes == null) return "⚪";
  const diff = strokes - par;
  if (diff <= -2) return "🔴"; // eagle or better
  if (diff === -1) return "🟢"; // birdie-ish (under par for the round vs course par)
  if (diff === 0) return "🟡"; // par
  if (diff === 1) return "🟠"; // bogey
  return "🔵"; // double+
}

function roundScoreLabel(strokes: number | null, par: number): string {
  if (strokes == null) return "—";
  const diff = strokes - par;
  if (diff === 0) return `${strokes} (E)`;
  return `${strokes} (${diff > 0 ? "+" : ""}${diff})`;
}

export default async function RoundReportPage({
  params,
}: {
  params: Promise<{ id: string; round: string }>;
}) {
  const { id: tournamentId, round: roundStr } = await params;
  const round = parseInt(roundStr, 10);
  if (!Number.isFinite(round) || round < 1 || round > 4) notFound();

  const [tournament, userId, user] = await Promise.all([
    prisma.tournament.findUnique({ where: { id: tournamentId } }),
    getCurrentUserId(),
    getCurrentUser(),
  ]);
  if (!tournament) notFound();

  // Find the user's team (first paid team if multiple)
  let myTeam: { id: string } | null = null;
  let myScore: Awaited<ReturnType<typeof calculateTeamScore>> | null = null;
  if (userId) {
    myTeam = await prisma.team.findFirst({
      where: { tournamentId, userId },
      orderBy: { createdAt: "asc" },
    });
    if (myTeam) {
      try {
        myScore = await calculateTeamScore(myTeam.id);
      } catch {
        /* ignore */
      }
    }
  }

  // Build leaderboard to find position, leader, and player-of-round
  const leaderboard = await calculateLeaderboard(tournamentId).catch(() => []);
  const leader = leaderboard[0];
  const myPosition = myScore
    ? leaderboard.find((r) => r.teamId === myScore!.teamId)?.position ?? null
    : null;

  // Previous round position (estimate via total strokes through previous round)
  let prevPosition: number | null = null;
  if (myScore && round > 1) {
    // Recompute totals using only rounds 1..(round-1) for all teams
    const partial = leaderboard
      .map((r) => {
        const subtotal = r.players.reduce((sum, p) => {
          return sum + p.roundScores.slice(0, round - 1).reduce<number>((s, v) => s + (v ?? 0), 0);
        }, 0);
        return { teamId: r.teamId, subtotal };
      })
      .sort((a, b) => a.subtotal - b.subtotal);
    const idx = partial.findIndex((p) => p.teamId === myScore!.teamId);
    if (idx >= 0) prevPosition = idx + 1;
  }

  // Player of the Round — lowest single-round score across ALL teams
  let potrScore: number | null = null;
  let potrPlayers: { name: string; teamName: string; tier: string }[] = [];
  for (const entry of leaderboard) {
    for (const p of entry.players) {
      const s = p.roundScores[round - 1];
      if (s == null) continue;
      if (potrScore == null || s < potrScore) {
        potrScore = s;
        potrPlayers = [{ name: p.playerName, teamName: entry.teamName, tier: p.tier }];
      } else if (s === potrScore) {
        potrPlayers.push({ name: p.playerName, teamName: entry.teamName, tier: p.tier });
      }
    }
  }

  if (!myTeam || !myScore) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8">
        <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-3xl">📋</p>
          <p className="mt-2 text-sm text-zinc-600">
            You don&apos;t have a team in this tournament.
          </p>
          <Link
            href={`/tournaments/${tournamentId}/enter`}
            className="mt-4 inline-block rounded-full bg-[#1a6b3c] px-6 py-2 text-sm font-bold text-white hover:bg-[#0f3d20]"
          >
            Enter a Team
          </Link>
        </div>
      </div>
    );
  }

  // Best/worst performer on user's team this round
  const playedThisRound = myScore.players.filter((p) => p.roundScores[round - 1] != null);
  const sortedByRound = [...playedThisRound].sort(
    (a, b) => (a.roundScores[round - 1] as number) - (b.roundScores[round - 1] as number),
  );
  const best = sortedByRound[0];
  const worst = sortedByRound[sortedByRound.length - 1];

  const posChange = prevPosition != null && myPosition != null ? prevPosition - myPosition : null;
  const strokesBehind = leader && myScore ? myScore.totalStrokes - leader.totalStrokes : null;

  const shareText = `Round ${round} report at ${tournament.name}: ${myScore.teamName} is ${myPosition ? `#${myPosition}` : "unranked"}${posChange ? ` (${posChange > 0 ? "▲" : "▼"}${Math.abs(posChange)})` : ""}. ${best ? `Top scorer: ${best.playerName} (${best.roundScores[round - 1]}).` : ""}`;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <div className="mb-4 text-xs">
        <Link href={`/tournaments/${tournamentId}/leaderboard`} className="text-zinc-500 hover:text-[#1a6b3c]">
          ← Leaderboard
        </Link>
      </div>

      {/* Header */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#0f3d20] to-[#1a6b3c] p-6 text-white shadow-lg">
        <p className="text-xs uppercase tracking-wide text-white/60">
          {tournament.course ?? "TBD"} · {formatDateRange(tournament.startDate, tournament.endDate)}
        </p>
        <h1 className="mt-1 text-2xl font-bold">Round {round} Report</h1>
        <p className="text-sm text-white/70">{tournament.name}</p>
      </div>

      {/* Your Team Performance */}
      <div className="mt-6 rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-[#0f3d20]">Your Team Performance</h2>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-zinc-50 p-3 text-center">
            <p className="text-xs text-zinc-500">Total</p>
            <p className="text-lg font-bold text-[#0f3d20]">{myScore.totalStrokes}</p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 text-center">
            <p className="text-xs text-zinc-500">Position</p>
            <p className="text-lg font-bold text-[#0f3d20]">
              {myPosition ? `#${myPosition}` : "—"}
            </p>
          </div>
          <div className="rounded-xl bg-zinc-50 p-3 text-center">
            <p className="text-xs text-zinc-500">Change</p>
            <p className={`text-lg font-bold ${
              posChange == null ? "text-zinc-400" :
              posChange > 0 ? "text-green-600" :
              posChange < 0 ? "text-red-500" :
              "text-zinc-500"
            }`}>
              {posChange == null ? "—" :
                posChange > 0 ? `▲${posChange}` :
                posChange < 0 ? `▼${Math.abs(posChange)}` :
                "—"}
            </p>
          </div>
        </div>

        {strokesBehind != null && strokesBehind > 0 && leader && (
          <p className="mt-3 text-center text-sm text-zinc-600">
            You&apos;re <span className="font-bold text-[#1a6b3c]">{strokesBehind} strokes</span> behind 1st place ({leader.teamName}).
          </p>
        )}
        {strokesBehind != null && strokesBehind <= 0 && (
          <p className="mt-3 text-center text-sm font-bold text-[#d4a843]">
            You&apos;re leading the field!
          </p>
        )}
      </div>

      {/* Player Scores */}
      <div className="mt-6 rounded-2xl bg-white shadow-sm">
        <h2 className="border-b border-zinc-100 p-4 text-base font-bold text-[#0f3d20]">
          Player Scores — Round {round}
        </h2>
        <div className="divide-y divide-zinc-50">
          {myScore.players.map((p) => {
            const s = p.roundScores[round - 1];
            return (
              <div key={p.playerId} className="flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{scoreEmoji(s, tournament.par)}</span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-800">{p.playerName}</p>
                    <p className="text-xs text-zinc-400">{p.tier.replace("_", " ")}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${s == null ? "text-zinc-300" : "text-[#0f3d20]"}`}>
                  {roundScoreLabel(s, tournament.par)}
                </span>
              </div>
            );
          })}
        </div>

        {best && worst && best.playerId !== worst.playerId && (
          <div className="grid grid-cols-2 gap-px bg-zinc-100">
            <div className="bg-green-50 p-3 text-center">
              <p className="text-xs text-green-700">🌟 Best Performer</p>
              <p className="text-sm font-bold text-green-800">{best.playerName}</p>
              <p className="text-xs text-green-600">
                {roundScoreLabel(best.roundScores[round - 1] ?? null, tournament.par)}
              </p>
            </div>
            <div className="bg-red-50 p-3 text-center">
              <p className="text-xs text-red-700">😅 Tough Round</p>
              <p className="text-sm font-bold text-red-800">{worst.playerName}</p>
              <p className="text-xs text-red-600">
                {roundScoreLabel(worst.roundScores[round - 1] ?? null, tournament.par)}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Player of the Round */}
      {potrScore != null && potrPlayers.length > 0 && (
        <div className="mt-6 overflow-hidden rounded-2xl border-2 border-[#d4a843]/40 bg-gradient-to-br from-amber-50 to-white shadow-sm">
          <div className="bg-[#d4a843]/20 px-4 py-2">
            <h2 className="text-base font-bold text-[#0f3d20]">Player of the Round</h2>
          </div>
          <div className="p-4">
            <p className="text-3xl font-extrabold text-[#0f3d20]">{potrScore}</p>
            <p className="mt-1 text-sm text-zinc-600">
              {potrScore < tournament.par
                ? `${tournament.par - potrScore} under par`
                : potrScore === tournament.par
                  ? "Even par"
                  : `${potrScore - tournament.par} over par`}
            </p>
            <div className="mt-2 space-y-1">
              {potrPlayers.map((p, i) => (
                <p key={i} className="text-sm font-semibold text-zinc-700">
                  {p.name} <span className="text-xs text-zinc-400">({p.teamName})</span>
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Share */}
      <div className="mt-6">
        <ShareRoundButton
          tournamentId={tournamentId}
          text={shareText}
        />
      </div>

      <div className="mt-6 text-center text-xs text-zinc-400">
        Signed in as {user?.name ?? user?.email ?? "guest"} ·{" "}
        <Link href={`/tournaments/${tournamentId}/leaderboard`} className="hover:underline">
          Back to leaderboard
        </Link>
      </div>
    </div>
  );
}
