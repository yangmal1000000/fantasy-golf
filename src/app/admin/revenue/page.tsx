import { prisma } from "@/lib/prisma";
import { formatGBP, formatDateRange } from "@/lib/ui";

export const dynamic = "force-dynamic";

export default async function RevenuePage() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startDate: "desc" },
    include: {
      teams: {
        select: {
          id: true,
          paid: true,
          createdAt: true,
          user: { select: { name: true, email: true } },
          name: true,
        },
      },
    },
  });

  // Calculate per-tournament stats
  const tournamentStats = tournaments.map((t) => {
    const paidTeams = t.teams.filter((tm) => tm.paid);
    const unpaidTeams = t.teams.filter((tm) => !tm.paid);
    return {
      id: t.id,
      name: t.name,
      status: t.status,
      entryFee: t.entryFee,
      startDate: t.startDate,
      endDate: t.endDate,
      totalTeams: t.teams.length,
      paidCount: paidTeams.length,
      unpaidCount: unpaidTeams.length,
      revenue: paidTeams.length * t.entryFee,
      potentialRevenue: t.teams.length * t.entryFee,
    };
  });

  const totalRevenue = tournamentStats.reduce((s, t) => s + t.revenue, 0);
  const totalTeams = tournamentStats.reduce((s, t) => s + t.totalTeams, 0);
  const totalPaid = tournamentStats.reduce((s, t) => s + t.paidCount, 0);
  const totalUnpaid = tournamentStats.reduce((s, t) => s + t.unpaidCount, 0);
  const potentialRevenue = tournamentStats.reduce(
    (s, t) => s + t.potentialRevenue,
    0
  );

  // Monthly breakdown
  const monthlyMap = new Map<string, { revenue: number; teams: number }>();
  for (const t of tournaments) {
    for (const team of t.teams) {
      if (!team.paid) continue;
      const monthKey = new Date(team.createdAt).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      });
      const existing = monthlyMap.get(monthKey) ?? {
        revenue: 0,
        teams: 0,
      };
      monthlyMap.set(monthKey, {
        revenue: existing.revenue + t.entryFee,
        teams: existing.teams + 1,
      });
    }
  }
  const monthly = Array.from(monthlyMap.entries())
    .map(([month, data]) => ({ month, ...data }))
    .reverse();

  const maxMonthlyRevenue = Math.max(...monthly.map((m) => m.revenue), 1);

  // Outstanding unpaid entries
  const unpaidEntries: Array<{
    teamName: string;
    userName: string;
    tournamentName: string;
    entryFee: number;
  }> = [];

  for (const t of tournaments) {
    for (const team of t.teams) {
      if (!team.paid) {
        unpaidEntries.push({
          teamName: team.name,
          userName: team.user?.name ?? team.user?.email ?? "Unknown",
          tournamentName: t.name,
          entryFee: t.entryFee,
        });
      }
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Revenue</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Financial overview across all tournaments
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl bg-green-50 p-5 shadow-sm ring-1 ring-green-200">
          <p className="text-2xl">💰</p>
          <p className="mt-2 text-2xl font-bold text-green-800">
            {formatGBP(totalRevenue)}
          </p>
          <p className="text-xs text-green-700">Collected Revenue</p>
        </div>
        <div className="rounded-xl bg-orange-50 p-5 shadow-sm ring-1 ring-orange-200">
          <p className="text-2xl">⏳</p>
          <p className="mt-2 text-2xl font-bold text-orange-800">
            {formatGBP(potentialRevenue - totalRevenue)}
          </p>
          <p className="text-xs text-orange-700">Outstanding ({totalUnpaid} unpaid)</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-5 shadow-sm ring-1 ring-blue-200">
          <p className="text-2xl">🎯</p>
          <p className="mt-2 text-2xl font-bold text-blue-800">
            {formatGBP(potentialRevenue)}
          </p>
          <p className="text-xs text-blue-700">Potential (if all paid)</p>
        </div>
        <div className="rounded-xl bg-purple-50 p-5 shadow-sm ring-1 ring-purple-200">
          <p className="text-2xl">👥</p>
          <p className="mt-2 text-2xl font-bold text-purple-800">
            {totalTeams}
          </p>
          <p className="text-xs text-purple-700">Total Entries ({totalPaid} paid)</p>
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Monthly chart */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <h3 className="mb-4 font-semibold text-zinc-900">
              Revenue by Month
            </h3>
            {monthly.length === 0 ? (
              <p className="py-8 text-center text-sm text-zinc-400">
                No revenue data yet.
              </p>
            ) : (
              <div className="space-y-2">
                {monthly.map((m) => (
                  <div key={m.month} className="flex items-center gap-3">
                    <div className="w-20 text-xs font-medium text-zinc-500">
                      {m.month}
                    </div>
                    <div className="flex-1">
                      <div className="relative h-8 overflow-hidden rounded-lg bg-zinc-100">
                        <div
                          className="absolute inset-y-0 left-0 flex items-center justify-end rounded-lg bg-gradient-to-r from-green-500 to-green-600 pr-2 transition-all"
                          style={{
                            width: `${
                              (m.revenue / maxMonthlyRevenue) * 100
                            }%`,
                          }}
                        >
                          <span className="text-xs font-bold text-white">
                            {formatGBP(m.revenue)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="w-16 text-right text-xs text-zinc-500">
                      {m.teams} entr{m.teams !== 1 ? "ies" : "y"}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Outstanding entries */}
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h3 className="font-semibold text-zinc-900">Unpaid Entries</h3>
            <p className="text-xs text-zinc-500">
              {unpaidEntries.length} outstanding
            </p>
          </div>
          {unpaidEntries.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-400">
              All entries paid. 🎉
            </div>
          ) : (
            <div className="max-h-96 divide-y divide-zinc-100 overflow-y-auto">
              {unpaidEntries.map((entry, i) => (
                <div key={i} className="px-5 py-3">
                  <p className="text-sm font-medium text-zinc-900">
                    {entry.teamName}
                  </p>
                  <p className="text-xs text-zinc-500">
                    {entry.userName} · {entry.tournamentName}
                  </p>
                  <p className="text-xs font-semibold text-orange-600">
                    {formatGBP(entry.entryFee)} outstanding
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Per-tournament breakdown */}
      <div className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
        <div className="border-b border-zinc-200 px-5 py-4">
          <h3 className="font-semibold text-zinc-900">Per-Tournament Breakdown</h3>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 text-left">Tournament</th>
              <th className="px-4 py-3 text-center">Status</th>
              <th className="px-4 py-3 text-center">Paid / Total</th>
              <th className="px-4 py-3 text-right">Entry Fee</th>
              <th className="px-4 py-3 text-right">Collected</th>
              <th className="px-4 py-3 text-right">Potential</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {tournamentStats.map((t, i) => (
              <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}>
                <td className="px-4 py-3">
                  <a
                    href={`/admin/tournaments/${t.id}/teams`}
                    className="font-medium text-[#1a6b3c] hover:underline"
                  >
                    {t.name}
                  </a>
                  <p className="text-xs text-zinc-500">
                    {formatDateRange(t.startDate, t.endDate)}
                  </p>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold capitalize">
                    {t.status.replace("_", " ")}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-medium text-green-700">
                    {t.paidCount}
                  </span>
                  <span className="text-zinc-400"> / {t.totalTeams}</span>
                </td>
                <td className="px-4 py-3 text-right text-zinc-700">
                  {formatGBP(t.entryFee)}
                </td>
                <td className="px-4 py-3 text-right font-semibold text-green-700">
                  {formatGBP(t.revenue)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-500">
                  {formatGBP(t.potentialRevenue)}
                </td>
              </tr>
            ))}
            {tournamentStats.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-400">
                  No tournaments yet.
                </td>
              </tr>
            )}
          </tbody>
          {tournamentStats.length > 0 && (
            <tfoot className="bg-zinc-50">
              <tr className="border-t-2 border-zinc-300 font-semibold">
                <td className="px-4 py-3" colSpan={2}>
                  Total
                </td>
                <td className="px-4 py-3 text-center">
                  {totalPaid} / {totalTeams}
                </td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right text-green-700">
                  {formatGBP(totalRevenue)}
                </td>
                <td className="px-4 py-3 text-right text-zinc-600">
                  {formatGBP(potentialRevenue)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
