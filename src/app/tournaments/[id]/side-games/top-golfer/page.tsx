import { prisma } from "@/lib/prisma";
import {
  ensureDefaultSidePots,
  getTopGolferStandings,
  getAllPlayersWithScores,
} from "@/lib/sidegames";
import { formatGBP, tierBadgeClass, tierLabel } from "@/lib/ui";
import { getCurrentUserId } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import TopGolferEntry from "./TopGolferEntry";

export const metadata = {
  title: "Top Golfer Challenge · Side Games",
};

export default async function TopGolferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
  });

  if (!tournament) notFound();

  await ensureDefaultSidePots(id);

  const sidePot = await prisma.tournamentSidePot.findFirst({
    where: { tournamentId: id, type: "top_golfer" },
  });

  const [standings, allPlayers, allSideBets] = await Promise.all([
    getTopGolferStandings(id),
    getAllPlayersWithScores(id),
    prisma.sideBet.findMany({
      where: { tournamentId: id, type: "top_golfer" },
    }),
  ]);

  const userId = await getCurrentUserId();

  const userEntry = userId
    ? allSideBets.find((b) => b.userId === userId)
    : undefined;
  const entryFee = sidePot?.entryFee ?? 500;
  const prizePool = allSideBets.length * entryFee;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href={`/tournaments/${id}/side-games`} className="hover:text-purple-600">
          ← Side Games
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-700 text-xl shadow">
            
          </div>
          <div>
            <h1 className="text-2xl font-bold text-purple-700 dark:text-purple-400">
              Top Golfer Challenge
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Pick one golfer — lowest 4-round total wins
            </p>
          </div>
        </div>
        <span className="mt-2 inline-block rounded-full border border-purple-300 bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
          Side Bet · {formatGBP(entryFee)} entry
        </span>
      </div>

      {/* Stats Bar */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 text-center shadow-sm">
          <p className="text-xl font-bold text-purple-700 dark:text-purple-400">
            {allSideBets.length}
          </p>
          <p className="text-xs text-zinc-500">Entries</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 text-center shadow-sm">
          <p className="text-xl font-bold text-purple-700 dark:text-purple-400">
            {prizePool > 0 ? formatGBP(prizePool) : "—"}
          </p>
          <p className="text-xs text-zinc-500">Prize Pool</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 text-center shadow-sm">
          <p className="text-xl font-bold text-purple-700 dark:text-purple-400">
            {userEntry ? "✓" : "—"}
          </p>
          <p className="text-xs text-zinc-500">Your Entry</p>
        </div>
      </div>

      {/* Entry or Your Pick */}
      {!userEntry ? (
        <TopGolferEntry
          tournamentId={id}
          userId={userId ?? ""}
          entryFee={entryFee}
          players={allPlayers.map((p) => ({
            id: p.playerId,
            name: p.playerName,
            tier: p.tier,
            rank: p.dataGolfRank,
          }))}
        />
      ) : (
        <div className="mb-6 rounded-xl border-2 border-purple-300 bg-purple-50 dark:bg-purple-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-purple-600">
            Your Pick
          </p>
          {(() => {
            const pick = allPlayers.find((p) => p.playerId === userEntry.playerId);
            return pick ? (
              <div className="mt-1 flex items-center gap-3">
                <span className="text-2xl"></span>
                <div>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">
                    {pick.playerName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {tierLabel(pick.tier)} ·{" "}
                    {pick.totalStrokes > 0 ? `${pick.totalStrokes} strokes` : "No scores yet"}
                    {pick.madeCut === false && " · MC"}
                  </p>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm text-zinc-500">Player data unavailable</p>
            );
          })()}
        </div>
      )}

      {/* Leaderboard */}
      {standings.length > 0 ? (
        <div className="overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-md">
          <div className="bg-purple-700 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">
              Top Golfer Standings
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-purple-50 dark:bg-purple-950/30">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                  Pos
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                  Entrant
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                  Picked
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-zinc-500">
                  Total
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-zinc-500">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {standings.map((s) => (
                <tr
                  key={s.sideBetId}
                  className={`${
                    s.userId === userId
                      ? "bg-purple-50/50 dark:bg-purple-950/10"
                      : ""
                  } hover:bg-zinc-50 dark:hover:bg-zinc-800/50`}
                >
                  <td className="px-4 py-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        s.position === 1
                          ? "bg-purple-600 text-white"
                          : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      {s.position}
                    </span>
                  </td>
                  <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                    {s.userName}
                  </td>
                  <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">
                    {s.playerName}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-purple-700 dark:text-purple-400">
                    {s.totalStrokes > 0 ? s.totalStrokes : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-xs">
                    {s.madeCut === false ? (
                      <span className="rounded-full bg-red-100 dark:bg-red-950/40 px-2 py-0.5 text-red-600">
                        MC
                      </span>
                    ) : s.roundsPlayed > 0 ? (
                      <span className="rounded-full bg-green-100 dark:bg-green-950/40 px-2 py-0.5 text-green-600">
                        {s.roundsPlayed}/4
                      </span>
                    ) : (
                      <span className="text-zinc-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-purple-300 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-950/10 p-8 text-center">
          <p className="text-lg font-semibold text-zinc-600 dark:text-zinc-400">
            No entries yet
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Be the first to pick your top golfer!
          </p>
        </div>
      )}

      {/* All Players Reference */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">
          All Golfers (Reference)
        </h2>
        <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                  #
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                  Golfer
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                  Tier
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {allPlayers.slice(0, 20).map((p, idx) => (
                <tr key={p.playerId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-3 py-2 text-zinc-400">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">
                    {p.playerName}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded-full border px-1.5 py-0.5 text-xs ${tierBadgeClass(p.tier)}`}
                    >
                      {tierLabel(p.tier).split("·")[0].trim()}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">
                    {p.totalStrokes > 0 ? p.totalStrokes : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {allPlayers.length > 20 && (
            <div className="border-t border-zinc-100 dark:border-zinc-800 px-3 py-2 text-center text-xs text-zinc-400">
              + {allPlayers.length - 20} more golfers
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
