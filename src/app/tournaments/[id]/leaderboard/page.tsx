import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { calculateLeaderboard } from "@/lib/scoring";
import { ROCKET_BETA_TOURNAMENT_ID } from "@/lib/rocket-beta";
import { majorTheme } from "@/lib/ui";
import { notFound } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Leaderboard — Fantasy Golf",
};

export default async function LeaderboardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const tournament = await prisma.tournament.findUnique({
    where: { id },
    include: { _count: { select: { teams: true } } },
  });

  if (!tournament) notFound();

  const isRocketBeta = tournament.id === ROCKET_BETA_TOURNAMENT_ID;
  const theme = majorTheme(tournament.id);
  const potTotal = tournament._count.teams * tournament.entryFee;
  const teams = await calculateLeaderboard(id);
  const hasFantasyTeams = teams.length > 0;

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      <Link href="/tournaments" className="text-xs text-zinc-500 hover:text-[#0a3d2a] dark:hover:text-green-400">← Tournaments</Link>
      <div className="flex items-center gap-2 mt-1">
        <h1 className="text-lg font-bold text-[#0a3d2a] dark:text-green-400 sm:text-xl">Leaderboard</h1>
        {theme && <span className={`rounded-md border px-2 py-0.5 text-[10px] font-bold ${theme.badgeClass}`}>{theme.name}</span>}
      </div>
      <p className="text-xs text-zinc-500">{tournament.name}</p>

      {/* Stats bar */}
      <div className="mb-3 mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 text-center">
          <p className="text-base font-bold tabular text-[#0a3d2a] dark:text-green-400">{tournament._count.teams}</p>
          <p className="text-[10px] text-zinc-500">Teams</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 text-center">
          <p className="text-base font-bold tabular text-[#c8a951]">
            {isRocketBeta ? "Test" : potTotal > 0 ? `£${(potTotal / 100).toFixed(0)}` : "—"}
          </p>
          <p className="text-[10px] text-zinc-500">{isRocketBeta ? "No-prize beta" : "Pot"}</p>
        </div>
        <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 text-center">
          <p className="text-base font-bold tabular text-[#0a3d2a] dark:text-green-400">{tournament.par}</p>
          <p className="text-[10px] text-zinc-500">Par</p>
        </div>
      </div>

      {/* Fantasy team standings */}
      {hasFantasyTeams ? (
        <div className="overflow-hidden rounded-xl bg-white dark:bg-zinc-900 shadow-sm border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-[#0a3d2a] text-white">
              <tr>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase">Pos</th>
                <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase">Team</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase">Total</th>
                <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase">vs Par</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {teams.map((team) => {
                return (
                  <tr key={team.teamId} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                    <td className="px-3 py-2.5">
                      <span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                        team.position === 1 ? "bg-[#c8a951] text-[#1a1a1a]" : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                      }`}>{team.position || "—"}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <Link href={`/tournaments/${id}/teams/${team.teamId}`} className="font-semibold text-[#0a3d2a] hover:underline dark:text-green-400">
                        {team.teamName}
                      </Link>
                      <p className="text-xs text-zinc-500">
                        {team.ownerName} · {team.roundsScored}/20 rounds scored
                      </p>
                      {/* Player chips */}
                      <div className="mt-1 flex gap-1">
                        {team.players.map((player) => (
                          <span key={player.playerId} className="inline-flex items-center gap-0.5 rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                            {player.tier.replace("_", " ").replace("PLUS", "+")} · {player.playerName.split(" ").slice(-1)[0]}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-right font-bold tabular text-[#0a3d2a] dark:text-green-400">
                      {team.roundsScored > 0 ? team.totalStrokes : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular text-zinc-600 dark:text-zinc-400">
                      {team.roundsScored === 0
                        ? "—"
                        : team.vsPar === 0
                          ? "E"
                          : team.vsPar > 0
                            ? `+${team.vsPar}`
                            : team.vsPar}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-8 text-center">
          <p className="text-sm text-zinc-500">No fantasy teams with scores yet.</p>
          <Link href={isRocketBeta ? `/tournaments/${id}` : `/tournaments/${id}/enter`} className="mt-3 inline-block rounded-full bg-[#0a3d2a] px-5 py-2 text-sm font-bold text-white hover:bg-[#1a5c3e]">
            {isRocketBeta ? "View beta journey →" : "Enter Team →"}
          </Link>
        </div>
      )}
    </div>
  );
}
