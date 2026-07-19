import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { calculateLeaderboard, type TeamScoreResult } from "@/lib/scoring";
import { calculateProjectedStandings } from "@/lib/predictions";

// Cache leaderboard for 30 seconds (ISR) — instant for most visitors
export const revalidate = 30;
export const metadata: Metadata = {
  title: "Leaderboard — Fantasy Golf",
  description: "Live tournament leaderboard with real-time scoring, projected cut line, and side game standings.",
};
import { formatGBP } from "@/lib/ui";
import {
  ensureDefaultSidePots,
  getTopGolferStandings,
  getDarkHorseStandings,
  getBestPerRound,
} from "@/lib/sidegames";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import PositionIndicator from "@/components/PositionIndicator";
import PlayerAvatar from "@/components/PlayerAvatar";
import Flag from "@/components/Flag";
import TierBadge from "@/components/TierBadge";
import MiniLeaderboard, { type MiniLeaderboardEntry } from "@/components/MiniLeaderboard";
import { LeaderboardSkeleton } from "@/components/Skeletons";
import LeaderboardRefresh from "./LeaderboardRefresh";

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      _count: { select: { teams: true } },
    },
  });

  if (!tournament) notFound();

  // Run scoring, predictions, and player data IN PARALLEL
  const [resultsResult, projected, tournamentPlayers] = await Promise.all([
    calculateLeaderboard(id)
      .then((data): { data: TeamScoreResult[]; error: string | null } => ({
        data,
        error: null,
      }))
      .catch((err): { data: TeamScoreResult[]; error: string | null } => ({
        data: [],
        error: err instanceof Error ? err.message : "Failed to calculate scores",
      })),
    calculateProjectedStandings(id).catch(() => null),
    prisma.tournamentPlayer.findMany({
      where: { tournamentId: id },
      include: { player: { select: { country: true } } },
    }),
  ]);

  const results = resultsResult.data;
  const calcError = resultsResult.error;
  const countryMap = new Map<string, string | null>();
  for (const tp of tournamentPlayers) {
    countryMap.set(tp.playerId, tp.player.country);
  }

  const isLive = tournament.status === "in_progress";
  const potTotal = tournament._count.teams * tournament.entryFee;

  // Build projected position lookup: teamId -> projectedPosition
  const projectedMap = new Map<string, number>();
  if (projected) {
    for (const t of projected.teams) {
      projectedMap.set(t.teamId, t.projectedPosition);
    }
  }

  // Build MiniLeaderboard data
  const miniEntries: MiniLeaderboardEntry[] = results.slice(0, 5).map((r) => ({
    teamId: r.teamId,
    teamName: r.teamName,
    position: r.position,
    totalStrokes: r.totalStrokes,
    vsPar: r.vsPar,
  }));

  // --- Side Games mini data ---
  await ensureDefaultSidePots(id);
  const [, topGolferStandings, darkHorseStandings, bestPerRound] =
    await Promise.all([
      prisma.tournamentSidePot.findMany({ where: { tournamentId: id } }),
      getTopGolferStandings(id),
      getDarkHorseStandings(id),
      getBestPerRound(id),
    ]);

  const sideGameCards = [
    {
      type: "top_golfer",
      title: "Top Golfer",
      icon: "",
      href: `/tournaments/${id}/side-games/top-golfer`,
      leader: topGolferStandings[0]?.playerName ?? null,
      leaderName: topGolferStandings[0]?.userName ?? null,
      entries: topGolferStandings.length,
      accent: "purple" as const,
    },
    {
      type: "best_round",
      title: "Best Round",
      icon: "",
      href: `/tournaments/${id}/side-games/best-round`,
      leader: bestPerRound.find((r) => r.bestTeam)?.bestTeam?.teamName ?? null,
      leaderName: bestPerRound.find((r) => r.bestTeam)?.bestTeam?.ownerName ?? null,
      entries: bestPerRound.filter((r) => r.bestTeam).length,
      accent: "amber" as const,
    },
    {
      type: "dark_horse",
      title: "Dark Horse",
      icon: "",
      href: `/tournaments/${id}/side-games/dark-horse`,
      leader: darkHorseStandings[0]?.playerName ?? null,
      leaderName: darkHorseStandings[0]?.userName ?? null,
      entries: darkHorseStandings.length,
      accent: "fuchsia" as const,
    },
  ];

  const sideGamesActive = sideGameCards.some((g) => g.entries > 0);

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Header */}
      <div className="mb-3">
        <Link href="/tournaments" className="text-xs text-zinc-500 hover:text-[#0a3d2a] dark:hover:text-green-400">← Tournaments</Link>
        <h1 className="mt-1 text-lg font-bold text-[#0a3d2a] dark:text-green-400 sm:text-xl">Leaderboard</h1>
        <p className="text-xs text-zinc-500">{tournament.name}</p>
      </div>

      {/* Stats bar — compact */}
      <div className="mb-3 grid grid-cols-3 gap-1.5 sm:gap-2">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 text-center">
          <p className="text-base font-bold tabular text-[#0a3d2a] dark:text-green-400 sm:text-lg">{tournament._count.teams}</p>
          <p className="text-[10px] text-zinc-500">Teams</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-3 text-center shadow-sm sm:p-4">
          <p className="text-lg font-bold tabular text-[#c8a951] sm:text-xl">
            {potTotal > 0 ? formatGBP(potTotal) : "—"}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Total Pot</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-3 text-center shadow-sm sm:p-4">
          <p className="text-lg font-bold tabular text-[#1a5c3e] dark:text-green-500 sm:text-xl">
            {tournament.par}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Par</p>
        </div>
      </div>

      {isLive && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-orange-300 bg-orange-50 px-3 py-2 dark:bg-orange-950/30 dark:border-orange-700">
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-orange-500" />
          </span>
          <span className="text-sm font-semibold text-orange-700 dark:text-orange-400">
            LIVE · Round {tournament.currentRound} · Auto-refreshing
          </span>
        </div>
      )}

      {/* Projected Standings */}
      {projected && projected.teams.length > 0 && (
        <details className="mb-4 sm:mb-6 overflow-hidden rounded-2xl border-2 border-[#c8a951]/30 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-zinc-900 shadow-md group" >
          <summary className="cursor-pointer bg-gradient-to-r from-[#c8a951]/20 to-transparent px-4 py-3 sm:px-5 list-none">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔮</span>
              <h2 className="text-base font-bold text-[#0a3d2a] dark:text-green-400 sm:text-lg">Projected Standings</h2>
              <span className="ml-auto text-xs text-zinc-400 group-open:hidden sm:hidden">Show</span>
              <span className="ml-auto hidden text-xs text-zinc-400 group-open:inline sm:hidden">Hide</span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Live estimates based on current scores
            </p>
          </summary>

          <div className="px-4 sm:px-5">
            {/* Cut line */}
            {projected.projectedCutLine != null && (
              <div className="border-b border-amber-200/50 dark:border-amber-800/30 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 sm:text-sm">
                    ✂️ Projected Cut
                  </span>
                  <span className="text-base font-bold text-[#0a3d2a] dark:text-green-400 sm:text-lg">
                    {projected.projectedCutLine > 0 ? "+" : ""}
                    {projected.projectedCutLine - (tournament.par * 2) === 0
                      ? "E"
                      : (projected.projectedCutLine - (tournament.par * 2) > 0 ? "+" : "") +
                        (projected.projectedCutLine - (tournament.par * 2))}
                  </span>
                  <span className="hidden text-xs text-zinc-500 dark:text-zinc-400 sm:inline">
                    ({projected.projectedCutLine} strokes)
                  </span>
                </div>
              </div>
            )}

            {/* Team projections */}
            <div className="divide-y divide-amber-100/50 dark:divide-amber-900/20">
              {projected.teams.slice(0, 10).map((t) => {
                const hasAtRisk = t.playersAtRisk.length > 0;
                const posChange = t.position - t.projectedPosition;
                return (
                  <div key={t.teamId} className="py-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          t.projectedPosition === 1
                            ? "bg-[#c8a951] text-[#1a1a1a]"
                            : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                        }`}>
                          {t.projectedPosition}
                        </span>
                        <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                          {t.teamName}
                        </span>
                        {posChange !== 0 && t.position > 0 && (
                          <span className={`text-xs font-medium ${
                            posChange > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"
                          }`}>
                            {posChange > 0 ? "▲" : "▼"} {Math.abs(posChange)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {hasAtRisk && (
                          <span className="rounded-full bg-red-100 dark:bg-red-950/40 px-2 py-0.5 text-xs font-semibold text-red-600 dark:text-red-400">
                            ⚠ {t.playersAtRisk.length}
                          </span>
                        )}
                        <span className="text-sm font-bold text-[#0a3d2a] dark:text-green-400">
                          {t.totalStrokes}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {projected.teams.length > 10 && (
              <div className="border-t border-amber-200/50 dark:border-amber-800/30 bg-amber-50/50 dark:bg-amber-950/10 py-2 text-center text-xs text-zinc-500 dark:text-zinc-400">
                + {projected.teams.length - 10} more teams below
              </div>
            )}
          </div>
        </details>
      )}

      {calcError ? (
        <div className="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-700 p-4 text-sm text-red-700 dark:text-red-400">
          {calcError}
        </div>
      ) : results.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-12 text-center">
          <p className="text-lg font-semibold text-zinc-700 dark:text-zinc-300">No teams yet</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Be the first to enter!
          </p>
          <Link
            href={`/tournaments/${id}/enter`}
            className="mt-4 inline-block rounded-full bg-[#0a3d2a] px-6 py-2 text-sm font-bold text-white hover:bg-[#0a3d2a]"
          >
            Enter Team →
          </Link>
        </div>
      ) : (
        <Suspense fallback={<LeaderboardSkeleton />}>
          {/* Leaderboard table */}
          <div className="overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-md">
            {/* Desktop table */}
            <table className="hidden w-full text-sm sm:table">
              <thead className="bg-[#0a3d2a] text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    Pos
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide">
                    Team
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide">
                    Players
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                    Total
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide">
                    vs Par
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {results.map((r) => {
                  const vsPar = r.vsPar;
                  const parClass =
                    vsPar < 0
                      ? "text-red-500 font-bold"
                      : vsPar === 0
                        ? "text-zinc-600 dark:text-zinc-400"
                        : "text-zinc-500 dark:text-zinc-500";

                  return (
                    <tr key={r.teamId} className="transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                      {/* Position with PositionIndicator */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                              r.position === 1
                                ? "bg-[#c8a951] text-[#1a1a1a]"
                                : r.position <= 3
                                  ? "bg-[#0a3d2a] text-white"
                                  : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                            }`}
                          >
                            {r.position}
                          </span>
                          <PositionIndicator
                            currentPosition={r.position}
                            projectedPosition={projectedMap.get(r.teamId)}
                          />
                        </div>
                      </td>

                      {/* Team name */}
                      <td className="px-4 py-3">
                        <Link
                          href={`/tournaments/${id}/teams/${r.teamId}`}
                          className="font-semibold text-[#0a3d2a] hover:underline dark:text-green-400"
                        >
                          {r.teamName}
                        </Link>
                        <p className="text-xs text-zinc-500 dark:text-zinc-400">{r.ownerName}</p>
                      </td>

                      {/* Players with avatars, flags, and tier badges */}
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap justify-center gap-2">
                          {r.players.map((p) => {
                            const country = countryMap.get(p.playerId) ?? null;
                            return (
                              <div
                                key={p.playerId}
                                className="flex items-center gap-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1"
                                title={`${p.playerName} (${p.tier}): ${p.roundScores.filter((s) => s != null).join(", ") || "no scores"}`}
                              >
                                <PlayerAvatar name={p.playerName} country={country} size="sm" />
                                <div className="flex flex-col">
                                  <div className="flex items-center gap-1">
                                    <Flag countryCode={country} size="sm" />
                                    <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
                                      {p.playerName.split(" ").slice(-1)[0]?.slice(0, 3)}
                                    </span>
                                  </div>
                                  <TierBadge tier={p.tier} size="sm" />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </td>

                      {/* Total strokes */}
                      <td className="px-4 py-3 text-right text-base font-bold tabular text-[#0a3d2a] dark:text-green-400">
                        {r.totalStrokes}
                      </td>

                      {/* vs Par */}
                      <td className={`px-4 py-3 text-right text-sm ${parClass}`}>
                        {vsPar > 0 ? "+" : ""}
                        {vsPar === 0 ? "E" : vsPar}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Mobile cards */}
            <div className="divide-y divide-zinc-100 dark:divide-zinc-800 sm:hidden">
              {results.map((r) => {
                const vsPar = r.vsPar;
                return (
                  <Link
                    key={r.teamId}
                    href={`/tournaments/${id}/teams/${r.teamId}`}
                    className="block p-3 transition active:bg-zinc-50 dark:active:bg-zinc-800"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="flex flex-col items-center gap-0.5">
                        <span
                          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                            r.position === 1
                              ? "bg-[#c8a951] text-[#1a1a1a]"
                              : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                          }`}
                        >
                          {r.position}
                        </span>
                        <PositionIndicator
                          currentPosition={r.position}
                          projectedPosition={projectedMap.get(r.teamId)}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#0a3d2a] dark:text-green-400">
                          {r.teamName}
                        </p>
                        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {r.ownerName}
                        </p>
                        {/* Player chips — compact row */}
                        <div className="mt-1 flex gap-1 overflow-x-auto no-scrollbar">
                          {r.players.map((p) => {
                            const country = countryMap.get(p.playerId) ?? null;
                            return (
                              <span
                                key={p.playerId}
                                className="inline-flex shrink-0 items-center gap-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5"
                              >
                                <PlayerAvatar name={p.playerName} country={country} size="sm" />
                                <TierBadge tier={p.tier} size="sm" />
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-base font-bold tabular text-[#0a3d2a] dark:text-green-400">
                          {r.totalStrokes}
                        </p>
                        <p className={`text-xs font-semibold ${
                          vsPar < 0 ? "text-red-500" :
                          vsPar === 0 ? "text-zinc-500 dark:text-zinc-400" :
                          "text-zinc-500 dark:text-zinc-400"
                        }`}>
                          {vsPar > 0 ? "+" : ""}
                          {vsPar === 0 ? "E" : vsPar}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        </Suspense>
      )}

      {/* Auto-refresh for live tournaments */}
      {isLive && <LeaderboardRefresh />}

      {/* Side Games Section */}
      {sideGamesActive && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-lg">🎰</span>
            <h2 className="text-lg font-bold text-purple-700 dark:text-purple-400">
              Side Games
            </h2>
            <span className="rounded-full border border-purple-300 bg-purple-100 px-2 py-0.5 text-xs font-semibold text-purple-700">
              Side Bets
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {sideGameCards
              .filter((g) => g.entries > 0)
              .map((game) => {
                const accentMap: Record<string, { border: string; bg: string; text: string; badge: string }> = {
                  purple: {
                    border: "border-purple-300",
                    bg: "bg-purple-50/50",
                    text: "text-purple-700 dark:text-purple-400",
                    badge: "bg-purple-100 text-purple-700 border-purple-300",
                  },
                  amber: {
                    border: "border-amber-300",
                    bg: "bg-amber-50/50",
                    text: "text-amber-700 dark:text-amber-400",
                    badge: "bg-amber-100 text-amber-700 border-amber-300",
                  },
                  fuchsia: {
                    border: "border-fuchsia-300",
                    bg: "bg-fuchsia-50/50",
                    text: "text-fuchsia-700 dark:text-fuchsia-400",
                    badge: "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-300",
                  },
                };
                const c = accentMap[game.accent];
                return (
                  <Link
                    key={game.type}
                    href={game.href}
                    className={`block rounded-xl border ${c.border} ${c.bg} dark:bg-zinc-900 p-4 transition hover:shadow-md`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-xl">{game.icon}</span>
                      <span className={`text-sm font-bold ${c.text}`}>
                        {game.title}
                      </span>
                    </div>
                    {game.leader ? (
                      <div className="mt-2">
                        <p className="text-xs text-zinc-500">Current Leader</p>
                        <p className={`text-sm font-semibold ${c.text}`}>
                          {game.leader}
                        </p>
                        <p className="text-xs text-zinc-400">
                          {game.leaderName}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-xs text-zinc-400">
                        No scores yet
                      </p>
                    )}
                    <div className="mt-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${c.badge}`}
                      >
                        {game.entries} {game.entries === 1 ? "entry" : "entries"}
                      </span>
                    </div>
                  </Link>
                );
              })}
          </div>

          <div className="mt-2 text-center">
            <Link
              href={`/tournaments/${id}/side-games`}
              className="text-xs font-medium text-purple-600 hover:underline"
            >
              View all side games →
            </Link>
          </div>
        </div>
      )}

      {/* Floating Mini Leaderboard during live tournaments */}
      {isLive && miniEntries.length > 0 && (
        <MiniLeaderboard
          tournamentId={id}
          entries={miniEntries}
        />
      )}
    </div>
  );
}
