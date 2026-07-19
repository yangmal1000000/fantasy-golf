import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import Link from "next/link";
import TierBadge from "@/components/TierBadge";
import DraftBoardClient from "./DraftBoardClient";

export const dynamic = "force-dynamic";

export default async function DraftBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: {
      players: {
        include: { player: true },
        orderBy: { selectionCount: "desc" },
      },
      _count: { select: { teams: true } },
    },
  });

  if (!tournament) notFound();

  const totalTeams = tournament._count.teams;

  // Build draft board data
  const boardData = tournament.players
    .filter((tp) => !tp.withdrew)
    .map((tp) => ({
      tournamentPlayerId: tp.id,
      playerId: tp.playerId,
      name: tp.player.name,
      country: tp.player.country,
      dataGolfRank: tp.player.dataGolfRank,
      tier: tp.tier,
      selectionCount: tp.selectionCount,
      pickPercentage: totalTeams > 0
        ? Math.round((tp.selectionCount / totalTeams) * 100)
        : 0,
    }));

  // Sorted by selection count desc (already from query, but ensure)
  boardData.sort((a, b) => b.selectionCount - a.selectionCount);

  // Max picks for bar chart scaling
  const maxPicks = Math.max(...boardData.map((p) => p.selectionCount), 1);

  // Hidden gems — least picked (with at least 1 pick or 0)
  const hiddenGems = [...boardData]
    .sort((a, b) => a.selectionCount - b.selectionCount)
    .slice(0, 10);

  // Top 10 most picked
  const topPicks = boardData.slice(0, 10);

  // Group by tier for tier filter
  const byTier: Record<string, typeof boardData> = {};
  for (const p of boardData) {
    if (!byTier[p.tier]) byTier[p.tier] = [];
    byTier[p.tier].push(p);
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          <Link href={`/tournaments/${id}`} className="hover:text-[#0a3d2a] dark:hover:text-green-400">
            ← Tournament
          </Link>
          <span>/</span>
          <Link href={`/tournaments/${id}/leaderboard`} className="hover:text-[#0a3d2a] dark:hover:text-green-400">
            Leaderboard
          </Link>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-[#0a3d2a] dark:text-green-400">
          📋 Draft Board
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {tournament.name} · See who everyone is picking
        </p>
      </div>

      {/* Stats bar */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 text-center shadow-sm">
          <p className="text-xl font-bold text-[#0a3d2a] dark:text-green-400">{tournament.players.length}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Players</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 text-center shadow-sm">
          <p className="text-xl font-bold text-[#c8a951]">{totalTeams}</p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Teams Entered</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 text-center shadow-sm">
          <p className="text-xl font-bold text-[#1a5c3e] dark:text-green-500">
            {boardData.filter((p) => p.selectionCount > 0).length}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Players Picked</p>
        </div>
      </div>

      {/* Top 10 Most Picked — Visual Bar Chart */}
      <div className="mb-8 rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-md">
        <h2 className="mb-4 text-lg font-bold text-[#0a3d2a] dark:text-green-400">
          🔥 Most Picked Players
        </h2>
        {totalTeams === 0 ? (
          <p className="py-8 text-center text-sm text-zinc-400 dark:text-zinc-500">
            No teams entered yet. Draft data will appear here.
          </p>
        ) : (
          <div className="space-y-2">
            {topPicks.map((p, idx) => {
              const barWidth = maxPicks > 0 ? (p.selectionCount / maxPicks) * 100 : 0;
              return (
                <Link
                  key={p.tournamentPlayerId}
                  href={`/players/${p.playerId}`}
                  className="block"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 shrink-0 text-right text-sm font-bold text-zinc-400 dark:text-zinc-500">
                      {idx + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                            {p.name}
                          </span>
                          <TierBadge tier={p.tier} size="sm" />
                        </div>
                        <span className="shrink-0 text-sm font-bold text-[#0a3d2a] dark:text-green-400">
                          {p.pickPercentage}%
                        </span>
                      </div>
                      <div className="mt-1 h-3 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-[#0a3d2a] to-[#1a5c3e] transition-all duration-500"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </div>
                    <span className="w-12 shrink-0 text-right text-xs text-zinc-500 dark:text-zinc-400">
                      {p.selectionCount} {p.selectionCount === 1 ? "pick" : "picks"}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Hidden Gems */}
      <div className="mb-8 rounded-2xl border-2 border-[#c8a951]/30 bg-gradient-to-br from-amber-50 to-white dark:from-amber-950/20 dark:to-zinc-900 p-5 shadow-sm">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl">💎</span>
          <h2 className="text-lg font-bold text-[#0a3d2a] dark:text-green-400">Hidden Gems</h2>
        </div>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          Least-picked players — high upside, contrarian picks
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {hiddenGems.map((p) => {
            return (
              <Link
                key={p.tournamentPlayerId}
                href={`/players/${p.playerId}`}
                className="flex items-center justify-between rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 p-3 transition hover:shadow-sm"
              >
                <div className="flex items-center gap-2">
                  <TierBadge tier={p.tier} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{p.name}</p>
                    {p.dataGolfRank && (
                      <p className="text-xs text-zinc-400 dark:text-zinc-500">World #{p.dataGolfRank}</p>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
                    {p.pickPercentage}%
                  </p>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500">
                    {p.selectionCount} {p.selectionCount === 1 ? "pick" : "picks"}
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Full board with tier filter */}
      <div className="rounded-2xl bg-white dark:bg-zinc-900 p-5 shadow-md">
        <h2 className="mb-4 text-lg font-bold text-[#0a3d2a] dark:text-green-400">
          All Players
        </h2>
        <DraftBoardClient boardData={boardData} totalTeams={totalTeams} />
      </div>
    </div>
  );
}
