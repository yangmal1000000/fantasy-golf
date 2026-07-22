import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function AutoSubsMonitor({
  searchParams,
}: {
  searchParams: Promise<{ tournament?: string }>;
}) {
  const filterTournamentId = (await searchParams).tournament;

  // Build where clause for sub logs
  const where = filterTournamentId
    ? { team: { tournamentId: filterTournamentId } }
    : {};

  const [subLogs, tournaments] = await Promise.all([
    prisma.teamSubLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            tournamentId: true,
            user: { select: { name: true, email: true } },
            tournament: { select: { name: true, startDate: true } },
          },
        },
      },
    }),
    prisma.tournament.findMany({
      where: {
        teams: { some: { subLogs: { some: {} } } },
      },
      select: { id: true, name: true, startDate: true },
      orderBy: { startDate: "desc" },
    }),
  ]);

  // Resolve player names for old/new players
  const playerIds = new Set<string>();
  subLogs.forEach((log) => {
    playerIds.add(log.oldPlayerId);
    playerIds.add(log.newPlayerId);
  });

  const players = await prisma.player.findMany({
    where: { id: { in: [...playerIds] } },
    select: { id: true, name: true, country: true, dataGolfRank: true },
  });
  const playerMap = new Map(players.map((p) => [p.id, p]));

  // Get WD players with unresolved subs (no TeamSubLog entry but withdrew=true and no scores)
  const allWdPlayers = await prisma.tournamentPlayer.findMany({
    where: { withdrew: true },
    include: {
      tournament: { select: { id: true, name: true, startDate: true } },
      player: { select: { name: true, country: true } },
    },
  });

  // Filter to find unresolved WDs: players who withdrew, have no scores, and no sub log
  const wdPlayerIds = allWdPlayers.map((wd) => wd.playerId);
  const wdScores = await prisma.score.findMany({
    where: {
      tournamentId: { in: allWdPlayers.map((wd) => wd.tournamentId) },
      playerId: { in: wdPlayerIds },
    },
    select: { tournamentId: true, playerId: true },
  });
  const scoreKeySet = new Set(
    wdScores.map((s) => `${s.tournamentId}:${s.playerId}`)
  );

  // Check which WDs have been resolved (have a sub log)
  const resolvedKeySet = new Set(
    subLogs.map((log) => {
      // We can't directly map oldPlayerId to tournamentPlayer, but we can check team.tournamentId
      return `${log.team.tournamentId}:${log.oldPlayerId}`;
    })
  );

  const unresolvedWds = allWdPlayers.filter((wd) => {
    const hasScore = scoreKeySet.has(`${wd.tournamentId}:${wd.playerId}`);
    const isResolved = resolvedKeySet.has(`${wd.tournamentId}:${wd.playerId}`);
    return !hasScore && !isResolved;
  });

  // Stats
  const totalSubs = subLogs.length;
  const tournamentsAffected = new Set(subLogs.map((l) => l.team.tournamentId)).size;
  const teamsAffected = new Set(subLogs.map((l) => l.teamId)).size;
  const unresolvedCount = unresolvedWds.length;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Auto-Sub Monitor</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Track automatic player replacements from withdrawals across all tournaments
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-8">
        <StatCard label="Total Subs" value={totalSubs} icon="🔄" accent="bg-blue-50 text-blue-700 border-blue-200" />
        <StatCard label="Tournaments" value={tournamentsAffected} icon="🏆" accent="bg-purple-50 text-purple-700 border-purple-200" />
        <StatCard label="Teams Affected" value={teamsAffected} icon="👥" accent="bg-orange-50 text-orange-700 border-orange-200" />
        <StatCard label="Unresolved WDs" value={unresolvedCount} icon="⚠️" accent={unresolvedCount > 0 ? "bg-red-50 text-red-700 border-red-200" : "bg-green-50 text-green-700 border-green-200"} />
      </div>

      {/* Tournament filter */}
      {tournaments.length > 0 && (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-zinc-600">Filter:</span>
          <Link
            href="/admin/auto-subs"
            className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
              !filterTournamentId
                ? "bg-[#0f3d20] text-white"
                : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
            }`}
          >
            All Tournaments
          </Link>
          {tournaments.map((t) => (
            <Link
              key={t.id}
              href={`/admin/auto-subs?tournament=${t.id}`}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                filterTournamentId === t.id
                  ? "bg-[#0f3d20] text-white"
                  : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
              }`}
            >
              {t.name}
            </Link>
          ))}
        </div>
      )}

      {/* Unresolved WDs */}
      {unresolvedWds.length > 0 && (
        <div className="mb-8 rounded-xl border border-amber-300 bg-amber-50 shadow-sm">
          <div className="border-b border-amber-200 px-5 py-4">
            <h2 className="flex items-center gap-2 font-semibold text-amber-900">
              ⚠️ Unresolved Withdrawals ({unresolvedWds.length})
            </h2>
            <p className="text-xs text-amber-700">
              Players who withdrew but have no auto-sub logged. These may need manual attention.
            </p>
          </div>
          <div className="divide-y divide-amber-100">
            {unresolvedWds.map((wd) => (
              <div key={wd.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                    🚫
                  </div>
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {wd.player.name}
                      {wd.player.country && (
                        <span className="ml-2 text-xs text-zinc-500">{wd.player.country}</span>
                      )}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {wd.tournament.name} · WD
                    </p>
                  </div>
                </div>
                <Link
                  href={`/admin/tournaments/${wd.tournamentId}/players`}
                  className="rounded-lg bg-amber-200 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-300"
                >
                  View Tournament →
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sub Log Table */}
      <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h2 className="font-semibold text-zinc-900">
            Substitution History {filterTournamentId && "(Filtered)"}
          </h2>
          <p className="text-xs text-zinc-500">
            All automatic player replacements, most recent first
          </p>
        </div>

        {subLogs.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <span className="text-4xl">✅</span>
            <p className="mt-3 text-sm font-medium text-zinc-500">
              No auto-subs triggered yet
            </p>
            <p className="text-xs text-zinc-400">
              Withdrawals will be detected automatically during ESPN sync
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs uppercase tracking-wider text-zinc-400">
                  <th className="px-5 py-3 text-left font-semibold">Tournament</th>
                  <th className="px-5 py-3 text-left font-semibold">Team</th>
                  <th className="px-5 py-3 text-left font-semibold">Out (WD)</th>
                  <th className="px-5 py-3 text-left font-semibold">In (Sub)</th>
                  <th className="px-5 py-3 text-left font-semibold">Tier</th>
                  <th className="px-5 py-3 text-left font-semibold">Reason</th>
                  <th className="px-5 py-3 text-left font-semibold">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-50">
                {subLogs.map((log) => {
                  const oldPlayer = playerMap.get(log.oldPlayerId);
                  const newPlayer = playerMap.get(log.newPlayerId);
                  return (
                    <tr key={log.id} className="hover:bg-zinc-50">
                      <td className="px-5 py-3">
                        <Link
                          href={`/admin/tournaments/${log.team.tournamentId}/players`}
                          className="font-medium text-zinc-900 hover:underline"
                        >
                          {log.team.tournament.name}
                        </Link>
                      </td>
                      <td className="px-5 py-3">
                        <Link
                          href={`/tournaments/${log.team.tournamentId}/teams/${log.team.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {log.team.name}
                        </Link>
                        <p className="text-xs text-zinc-400">
                          {log.team.user?.name ?? log.team.user?.email}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-red-600">➖</span>
                          <div>
                            <p className="font-medium text-zinc-900">
                              {oldPlayer?.name ?? "Unknown"}
                            </p>
                            {oldPlayer?.dataGolfRank && (
                              <p className="text-xs text-zinc-400">
                                Rank #{oldPlayer.dataGolfRank}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-green-600">➕</span>
                          <div>
                            <p className="font-medium text-zinc-900">
                              {newPlayer?.name ?? "Unknown"}
                            </p>
                            {newPlayer?.dataGolfRank && (
                              <p className="text-xs text-zinc-400">
                                Rank #{newPlayer.dataGolfRank}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <TierBadge tier={log.tier} />
                      </td>
                      <td className="px-5 py-3">
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
                          {formatReason(log.reason)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-zinc-500">
                        {log.createdAt.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                        <br />
                        <span className="text-zinc-400">
                          {log.createdAt.toLocaleTimeString("en-GB", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: string;
  accent: string;
}) {
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${accent}`}>
      <span className="text-2xl">{icon}</span>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs font-medium opacity-70">{label}</p>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const styles: Record<string, string> = {
    A: "bg-red-100 text-red-700",
    B: "bg-orange-100 text-orange-700",
    C: "bg-yellow-100 text-yellow-700",
    D: "bg-green-100 text-green-700",
    E: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-bold ${styles[tier] ?? "bg-zinc-100 text-zinc-600"}`}>
      Tier {tier}
    </span>
  );
}

function formatReason(reason: string): string {
  const labels: Record<string, string> = {
    pre_round_wd: "Pre-Round WD",
    no_show: "No Show",
    dns: "Did Not Start",
  };
  return labels[reason] ?? reason;
}
