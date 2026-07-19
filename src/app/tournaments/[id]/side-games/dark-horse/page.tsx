import { prisma } from "@/lib/prisma";
import {
  ensureDefaultSidePots,
  getDarkHorseStandings,
  getT5Players,
} from "@/lib/sidegames";
import { formatGBP } from "@/lib/ui";
import { getCurrentUserId } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import DarkHorseEntry from "./DarkHorseEntry";

export const metadata = {
  title: "Dark Horse Challenge · Side Games",
};

export default async function DarkHorsePage({
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
    where: { tournamentId: id, type: "dark_horse" },
  });

  const [standings, t5Players, allSideBets] = await Promise.all([
    getDarkHorseStandings(id),
    getT5Players(id),
    prisma.sideBet.findMany({
      where: { tournamentId: id, type: "dark_horse" },
    }),
  ]);

  const userId = await getCurrentUserId();

  const userEntry = userId
    ? allSideBets.find((b) => b.userId === userId)
    : undefined;
  const entryFee = sidePot?.entryFee ?? 500;
  const prizePool = allSideBets.length * entryFee;

  // Map: playerId -> entrant names
  const pickMap: Record<string, string[]> = {};
  for (const bet of allSideBets) {
    if (bet.playerId) {
      const user = await prisma.user.findUnique({ where: { id: bet.userId } });
      const name = user?.name ?? user?.email ?? "Unknown";
      if (!pickMap[bet.playerId]) pickMap[bet.playerId] = [];
      pickMap[bet.playerId].push(name);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      {/* Breadcrumb */}
      <div className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        <Link href={`/tournaments/${id}/side-games`} className="hover:text-fuchsia-600">
          ← Side Games
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-fuchsia-700 text-xl shadow">
            ⚡
          </div>
          <div>
            <h1 className="text-2xl font-bold text-fuchsia-700 dark:text-fuchsia-400">
              Dark Horse Challenge
            </h1>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Pick a Tier 5 golfer (rank 51+) to outperform the field
            </p>
          </div>
        </div>
        <span className="mt-2 inline-block rounded-full border border-fuchsia-300 bg-fuchsia-100 px-2.5 py-0.5 text-xs font-semibold text-fuchsia-700">
          Side Bet · {formatGBP(entryFee)} entry
        </span>
      </div>

      {/* Stats Bar */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 text-center shadow-sm">
          <p className="text-xl font-bold text-fuchsia-700 dark:text-fuchsia-400">
            {allSideBets.length}
          </p>
          <p className="text-xs text-zinc-500">Entries</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 text-center shadow-sm">
          <p className="text-xl font-bold text-fuchsia-700 dark:text-fuchsia-400">
            {prizePool > 0 ? formatGBP(prizePool) : "—"}
          </p>
          <p className="text-xs text-zinc-500">Prize Pool</p>
        </div>
        <div className="rounded-xl bg-white dark:bg-zinc-900 p-4 text-center shadow-sm">
          <p className="text-xl font-bold text-fuchsia-700 dark:text-fuchsia-400">
            {t5Players.length}
          </p>
          <p className="text-xs text-zinc-500">T5 Golfers</p>
        </div>
      </div>

      {/* Entry or Your Pick */}
      {!userEntry ? (
        <DarkHorseEntry
          tournamentId={id}
          userId={userId ?? ""}
          entryFee={entryFee}
          players={t5Players.map((p) => ({
            id: p.playerId,
            name: p.playerName,
            rank: p.dataGolfRank,
            country: p.country,
          }))}
        />
      ) : (
        <div className="mb-6 rounded-xl border-2 border-fuchsia-300 bg-fuchsia-50 dark:bg-fuchsia-950/20 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-fuchsia-600">
            Your Dark Horse
          </p>
          {(() => {
            const pick = t5Players.find((p) => p.playerId === userEntry.playerId);
            return pick ? (
              <div className="mt-1 flex items-center gap-3">
                <span className="text-2xl">⚡</span>
                <div>
                  <p className="font-bold text-zinc-800 dark:text-zinc-200">
                    {pick.playerName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Rank {pick.dataGolfRank ?? "?"} ·{" "}
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
        <div className="mb-8 overflow-hidden rounded-2xl bg-white dark:bg-zinc-900 shadow-md">
          <div className="bg-fuchsia-700 px-4 py-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-white">
              🏆 Dark Horse Standings
            </h2>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-fuchsia-50 dark:bg-fuchsia-950/30">
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
                      ? "bg-fuchsia-50/50 dark:bg-fuchsia-950/10"
                      : ""
                  } hover:bg-zinc-50 dark:hover:bg-zinc-800/50`}
                >
                  <td className="px-4 py-3">
                    <span
                      className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${
                        s.position === 1
                          ? "bg-fuchsia-600 text-white"
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
                  <td className="px-4 py-3 text-right font-bold text-fuchsia-700 dark:text-fuchsia-400">
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
        <div className="mb-8 rounded-xl border-2 border-dashed border-fuchsia-300 dark:border-fuchsia-800 bg-fuchsia-50/30 dark:bg-fuchsia-950/10 p-8 text-center">
          <p className="text-lg font-semibold text-zinc-600 dark:text-zinc-400">
            No entries yet
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Be the first to pick your dark horse!
          </p>
        </div>
      )}

      {/* All T5 Players */}
      <div>
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">
          Tier 5 Golfers (Rank 51+)
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
                  Rank
                </th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-zinc-500">
                  Picked by
                </th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-zinc-500">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {t5Players.map((p, idx) => (
                <tr key={p.playerId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                  <td className="px-3 py-2 text-zinc-400">{idx + 1}</td>
                  <td className="px-3 py-2 font-medium text-zinc-800 dark:text-zinc-200">
                    {p.playerName}
                  </td>
                  <td className="px-3 py-2 text-zinc-500">
                    {p.dataGolfRank ?? "?"}
                  </td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {pickMap[p.playerId]?.join(", ") ?? <span className="text-zinc-300">No one</span>}
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-zinc-700 dark:text-zinc-300">
                    {p.totalStrokes > 0 ? p.totalStrokes : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
