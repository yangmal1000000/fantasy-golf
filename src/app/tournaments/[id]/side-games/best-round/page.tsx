import { prisma } from "@/lib/prisma";
import {
  ensureDefaultSidePots,
  getBestPerRound,
} from "@/lib/sidegames";
import { formatGBP } from "@/lib/ui";
import { notFound } from "next/navigation";
import Link from "next/link";

export const metadata = {
  title: "Best Round Prize · Side Games",
};

export default async function BestRoundPage({
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
    where: { tournamentId: id, type: "best_round" },
  });

  const [perRoundData, allSideBets] = await Promise.all([
    getBestPerRound(id),
    prisma.sideBet.findMany({
      where: { tournamentId: id, type: "best_round" },
    }),
  ]);

  const entryFee = sidePot?.entryFee ?? 500;
  const prizePool = allSideBets.length * entryFee;

  // Track cumulative wins per team
  const cumulativeWins: Record<string, { teamName: string; ownerName: string; wins: number }> = {};
  for (const roundData of perRoundData) {
    if (roundData.bestTeam) {
      const key = roundData.bestTeam.teamId;
      if (!cumulativeWins[key]) {
        cumulativeWins[key] = {
          teamName: roundData.bestTeam.teamName,
          ownerName: roundData.bestTeam.ownerName,
          wins: 0,
        };
      }
      cumulativeWins[key].wins++;
    }
  }

  const cumulativeRanked = Object.entries(cumulativeWins)
    .map(([teamId, data]) => ({ teamId, ...data }))
    .sort((a, b) => b.wins - a.wins);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href={`/tournaments/${id}/side-games`} className="hover:text-amber-600">
          ← Side Games
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 text-xl shadow">
            
          </div>
          <div>
            <h1 className="text-2xl font-bold text-amber-700 dark:text-amber-400">
              Best Round Prize
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Lowest team score in a single round wins
            </p>
          </div>
        </div>
        <span className="mt-2 inline-block rounded-full border border-amber-300 bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">
          Side Bet · {formatGBP(entryFee)}/round
        </span>
      </div>

      {/* Stats Bar */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 text-center shadow-sm">
          <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
            {allSideBets.length}
          </p>
          <p className="text-xs text-zinc-500">Entries</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 text-center shadow-sm">
          <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
            {prizePool > 0 ? formatGBP(prizePool) : "—"}
          </p>
          <p className="text-xs text-zinc-500">Prize Pool</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 text-center shadow-sm">
          <p className="text-xl font-bold text-amber-700 dark:text-amber-400">
            {perRoundData.length}
          </p>
          <p className="text-xs text-zinc-500">Rounds Played</p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="mb-6 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4">
        <p className="text-sm text-zinc-700 dark:text-zinc-300">
          <strong>How it works:</strong> Each round, the team with the lowest
          combined score across all 5 players wins that round. The team with the
          most round wins takes the pot!
        </p>
      </div>

      {/* Per-Round Results */}
      {perRoundData.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
            Round-by-Round Results
          </h2>

          {perRoundData.map((roundData) => (
            <div
              key={roundData.round}
              className="overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-800 bg-white dark:bg-zinc-900 shadow-sm"
            >
              {/* Round header */}
              <div className="flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-transparent px-5 py-3">
                <h3 className="text-lg font-bold text-amber-700 dark:text-amber-400">
                  Round {roundData.round}
                </h3>
                {roundData.bestTeam && (
                  <div className="text-right">
                    <p className="text-xs text-zinc-500">Best Score</p>
                    <p className="font-bold text-amber-700 dark:text-amber-400">
                      {roundData.bestTeam.roundTotal}
                      <span className="ml-1 text-xs text-zinc-500">
                        ({roundData.bestTeam.vsPar > 0 ? "+" : ""}
                        {roundData.bestTeam.vsPar === 0 ? "E" : roundData.bestTeam.vsPar})
                      </span>
                    </p>
                  </div>
                )}
              </div>

              {/* Winner banner */}
              {roundData.bestTeam && (
                <div className="flex items-center gap-3 border-b border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/10 px-5 py-3">
                  <span className="text-2xl"></span>
                  <div className="flex-1">
                    <p className="font-bold text-zinc-800 dark:text-zinc-200">
                      {roundData.bestTeam.teamName}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {roundData.bestTeam.ownerName}
                    </p>
                  </div>
                  <span className="rounded-full bg-amber-600 px-3 py-1 text-xs font-bold text-white">
                    WINNER
                  </span>
                </div>
              )}

              {/* All teams for this round */}
              {roundData.allTeams.length > 1 && (
                <table className="w-full text-sm">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                        Pos
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                        Team
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-zinc-500">
                        Score
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-zinc-500">
                        vs Par
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {roundData.allTeams.slice(0, 10).map((team, idx) => (
                      <tr
                        key={team.teamId}
                        className={idx === 0 ? "bg-amber-50/30 dark:bg-amber-950/10" : ""}
                      >
                        <td className="px-4 py-2 text-zinc-400">{idx + 1}</td>
                        <td className="px-4 py-2 font-medium text-zinc-800 dark:text-zinc-200">
                          {team.teamName}
                          <span className="ml-1 text-xs text-zinc-400">
                            ({team.ownerName})
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right font-bold text-zinc-700 dark:text-zinc-300">
                          {team.roundTotal}
                        </td>
                        <td className="px-4 py-2 text-right text-xs text-zinc-500">
                          {team.vsPar > 0 ? "+" : ""}
                          {team.vsPar === 0 ? "E" : team.vsPar}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {!roundData.bestTeam && (
                <div className="px-5 py-4 text-center text-sm text-zinc-500">
                  No scores recorded for this round yet
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-amber-300 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10 p-8 text-center">
          <p className="text-lg font-semibold text-zinc-600 dark:text-zinc-400">
            No rounds played yet
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Best round results will appear here once the tournament begins.
          </p>
        </div>
      )}

      {/* Cumulative Winners */}
      {cumulativeRanked.length > 0 && (
        <div className="mt-8 overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-md">
          <div className="bg-amber-600 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">
              Cumulative Round Wins
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-amber-50 dark:bg-amber-950/30">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                  Pos
                </th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-zinc-500">
                  Team
                </th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-zinc-500">
                  Round Wins
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {cumulativeRanked.map((team, idx) => (
                <tr key={team.teamId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-4 py-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        idx === 0
                          ? "bg-amber-500 text-white"
                          : "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                      }`}
                    >
                      {idx + 1}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-zinc-800 dark:text-zinc-200">
                      {team.teamName}
                    </p>
                    <p className="text-xs text-zinc-400">{team.ownerName}</p>
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-amber-700 dark:text-amber-400">
                    {team.wins}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
