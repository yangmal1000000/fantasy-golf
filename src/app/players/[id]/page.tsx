import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import { TIER_CONFIG, tierBadgeClass, tierLabel, formatDateRange, STATUS_CONFIG } from "@/lib/ui";
import TierBadge from "@/components/TierBadge";
import PlayerAvatar from "@/components/PlayerAvatar";
import Flag from "@/components/Flag";
import Sparkline from "@/components/Sparkline";

export const dynamic = "force-dynamic";

export default async function PlayerStatsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const player = await prisma.player.findUnique({
    where: { id },
    include: {
      tournaments: {
        include: {
          tournament: true,
          selections: {
            include: { team: { include: { user: true } } },
          },
        },
      },
      scores: {
        include: { tournament: true },
        orderBy: [{ tournamentId: "asc" }, { round: "asc" }],
      },
    },
  });

  if (!player) notFound();

  // Group scores by tournament
  const scoresByTournament: Record<string, { tournament: typeof player.scores[0]["tournament"]; rounds: (number | null)[] }> = {};
  for (const score of player.scores) {
    if (!scoresByTournament[score.tournamentId]) {
      scoresByTournament[score.tournamentId] = {
        tournament: score.tournament,
        rounds: [null, null, null, null],
      };
    }
    if (score.round >= 1 && score.round <= 4) {
      scoresByTournament[score.tournamentId].rounds[score.round - 1] = score.strokes;
    }
  }

  // Calculate stats
  const allRoundScores = player.scores
    .map((s) => s.strokes)
    .filter((s): s is number => s != null);

  const bestRound = allRoundScores.length > 0 ? Math.min(...allRoundScores) : null;
  const worstRound = allRoundScores.length > 0 ? Math.max(...allRoundScores) : null;
  const avgRound = allRoundScores.length > 0
    ? Math.round((allRoundScores.reduce((a, b) => a + b, 0) / allRoundScores.length) * 10) / 10
    : null;

  // Count teams that picked this player
  const teamCount = player.tournaments.reduce(
    (sum, tp) => sum + tp.selections.length,
    0
  );

  // Get tournament-player info map
  const tpMap = new Map(player.tournaments.map((tp) => [tp.tournamentId, tp]));

  return (
    <div className="mx-auto max-w-3xl px-3 py-6 sm:px-4 sm:py-8">
      {/* Back link */}
      <div className="mb-3 sm:mb-4">
        <Link href="/tournaments" className="text-sm text-zinc-500 hover:text-[#0a3d2a] dark:text-zinc-400 dark:hover:text-green-400">
          ← Back
        </Link>
      </div>

      {/* Player header */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-r from-[#0a3d2a] to-[#0a3d2a] p-5 text-white shadow-lg sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <PlayerAvatar name={player.name} country={player.country} size="md" />
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">{player.name}</h1>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <Flag countryCode={player.country} size="sm" showName />
              {player.dataGolfRank && (
                <span className="text-sm text-white/70"> · World #{player.dataGolfRank}</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats — 2 cols on mobile, 4 on desktop */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-6 sm:grid-cols-4 sm:gap-3">
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-3 text-center shadow-sm sm:p-4">
          <p className="text-lg font-bold text-[#0a3d2a] dark:text-green-400 sm:text-xl">
            {player.tournaments.length}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Tournaments</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-3 text-center shadow-sm sm:p-4">
          <p className="text-lg font-bold text-[#c8a951] sm:text-xl">
            {teamCount}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Times Picked</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-3 text-center shadow-sm sm:p-4">
          <p className="text-lg font-bold text-[#1a5c3e] dark:text-green-500 sm:text-xl">
            {bestRound ?? "—"}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Best Round</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-3 text-center shadow-sm sm:p-4">
          <p className="text-lg font-bold text-red-400 sm:text-xl">
            {worstRound ?? "—"}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Worst Round</p>
        </div>
      </div>

      {/* Average round bar */}
      {avgRound != null && (
        <div className="mt-3 rounded-xl bg-white dark:bg-zinc-900 p-3 shadow-sm sm:p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Average Round Score</span>
            <span className="text-lg font-bold text-[#0a3d2a] dark:text-green-400">{avgRound}</span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#0a3d2a] to-[#1a5c3e]"
              style={{
                width: `${Math.min(100, Math.max(0, ((avgRound - 60) / (80 - 60)) * 100))}%`,
              }}
            />
          </div>
          <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">Scale: 60–80 strokes</p>
        </div>
      )}

      {/* Tournament history */}
      <div className="mt-6 sm:mt-8">
        <h2 className="mb-3 text-lg font-bold text-[#0a3d2a] dark:text-green-400 sm:mb-4">
          Tournament History
        </h2>

        {player.tournaments.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-6 text-center">
            <p className="text-sm text-zinc-500 dark:text-zinc-400">Not entered in any tournaments yet.</p>
          </div>
        ) : (
          <div className="space-y-3 sm:space-y-4">
            {Object.entries(scoresByTournament).map(([tournamentId, data]) => {
              const tp = tpMap.get(tournamentId);
              const tier = tp?.tier ?? "T51_PLUS";
              const tierCfg = TIER_CONFIG[tier] ?? TIER_CONFIG.T51_PLUS;
              const status = STATUS_CONFIG[data.tournament.status] ?? STATUS_CONFIG.upcoming;
              const totalStrokes = data.rounds.reduce<number>((sum, s) => sum + (s ?? 0), 0);
              const roundsPlayed = data.rounds.filter((s) => s != null).length;

              return (
                <div
                  key={tournamentId}
                  className={`rounded-2xl border-2 p-3 sm:p-4 ${tierCfg.cardClass}`}
                >
                  <div className="flex items-start justify-between gap-2 sm:gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <TierBadge tier={tier} size="sm" showLabel />
                        <span className={`inline-block rounded-full border px-2 py-0.5 text-xs font-semibold ${status.badgeClass}`}>
                          {status.label}
                        </span>
                      </div>
                      <Link
                        href={`/tournaments/${tournamentId}/leaderboard`}
                        className="mt-1.5 block font-bold text-zinc-900 hover:underline dark:text-white"
                      >
                        {data.tournament.name}
                      </Link>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        📍 {data.tournament.course ?? "TBD"} · {formatDateRange(data.tournament.startDate, data.tournament.endDate)}
                      </p>
                    </div>
                    {roundsPlayed > 0 && (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <p className="text-base font-bold text-zinc-900 dark:text-white sm:text-lg">{totalStrokes}</p>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{roundsPlayed} rds</p>
                        <Sparkline scores={data.rounds} par={data.tournament.par} />
                      </div>
                    )}
                  </div>

                  {/* Round scores */}
                  {roundsPlayed > 0 && (
                    <div className="mt-3 grid grid-cols-4 gap-1.5 sm:gap-2">
                      {[0, 1, 2, 3].map((i) => {
                        const score = data.rounds[i];
                        const par = data.tournament.par;
                        const diff = score != null ? score - par : null;
                        return (
                          <div key={i} className="rounded-lg bg-white/70 dark:bg-zinc-800/50 p-1.5 text-center sm:p-2">
                            <p className="text-xs text-zinc-500 dark:text-zinc-400">R{i + 1}</p>
                            <p className="text-base font-bold text-zinc-900 dark:text-white">
                              {score ?? "—"}
                            </p>
                            {diff != null && (
                              <p className={`text-xs font-medium ${
                                diff < 0 ? "text-red-500" : diff === 0 ? "text-zinc-500 dark:text-zinc-400" : "text-zinc-400 dark:text-zinc-500"
                              }`}>
                                {diff > 0 ? "+" : ""}{diff === 0 ? "E" : diff}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Cut/withdrawn status */}
                  {tp?.madeCut === false && (
                    <p className="mt-2 text-xs font-semibold text-orange-600">✗ Missed Cut</p>
                  )}
                  {tp?.madeCut === true && (
                    <p className="mt-2 text-xs font-semibold text-green-600">✓ Made Cut</p>
                  )}
                  {tp?.withdrew && (
                    <p className="mt-2 text-xs font-semibold text-red-500">WD — Withdrew</p>
                  )}

                  {/* Teams that picked in this tournament */}
                  {tp && tp.selections.length > 0 && (
                    <div className="mt-3 border-t border-white/50 dark:border-zinc-700/50 pt-2">
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        Picked by{" "}
                        <span className="font-bold text-zinc-700 dark:text-zinc-300">{tp.selections.length}</span>{" "}
                        {tp.selections.length === 1 ? "team" : "teams"}:
                      </p>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {tp.selections.map((sel) => (
                          <Link
                            key={sel.id}
                            href={`/tournaments/${tournamentId}/teams/${sel.team.id}`}
                            className="rounded-full bg-white/60 dark:bg-zinc-800/60 px-2 py-0.5 text-xs text-zinc-700 dark:text-zinc-300 transition hover:bg-white dark:hover:bg-zinc-700"
                          >
                            {sel.team.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
