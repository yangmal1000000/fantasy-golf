import { prisma } from "@/lib/prisma";
import { formatGBP } from "@/lib/ui";
import Link from "next/link";
import DashboardActions from "./DashboardActions";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [tournaments, teams, users] = await Promise.all([
    prisma.tournament.findMany({
      orderBy: { startDate: "desc" },
      include: {
        _count: { select: { teams: true } },
        teams: {
          where: { paid: true },
          select: { id: true },
        },
      },
    }),
    prisma.team.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        user: true,
        tournament: { select: { name: true, entryFee: true } },
      },
    }),
    prisma.user.count(),
  ]);

  // Calculate totals
  const totalTeams = tournaments.reduce(
    (sum, t) => sum + t._count.teams,
    0
  );
  const totalRevenue = tournaments.reduce(
    (sum, t) => sum + t.teams.length * t.entryFee,
    0
  );
  const activeTournaments = tournaments.filter(
    (t) => t.status === "entries_open" || t.status === "in_progress"
  ).length;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Overview of your fantasy golf competitions
          </p>
        </div>
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
          ADMIN MODE
        </span>
      </div>

      {/* Overview cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatGBP(totalRevenue)}
          icon="💰"
          accent="bg-green-50 text-green-700 border-green-200"
        />
        <StatCard
          label="Total Teams"
          value={totalTeams.toString()}
          icon="👥"
          accent="bg-blue-50 text-blue-700 border-blue-200"
        />
        <StatCard
          label="Total Users"
          value={users.toString()}
          icon="👤"
          accent="bg-purple-50 text-purple-700 border-purple-200"
        />
        <StatCard
          label="Active Tournaments"
          value={activeTournaments.toString()}
          icon="🏆"
          accent="bg-orange-50 text-orange-700 border-orange-200"
        />
      </div>

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent entries */}
        <div className="lg:col-span-2">
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="font-semibold text-zinc-900">Recent Entries</h2>
              <p className="text-xs text-zinc-500">Latest 10 teams entered</p>
            </div>
            {teams.length === 0 ? (
              <div className="px-5 py-12 text-center text-sm text-zinc-400">
                No teams entered yet.
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {teams.map((team) => (
                  <div
                    key={team.id}
                    className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold ${
                          team.paid
                            ? "bg-green-100 text-green-700"
                            : "bg-zinc-100 text-zinc-500"
                        }`}
                      >
                        {team.paid ? "✓" : "⏳"}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {team.name}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {team.user?.name ?? team.user?.email} ·{" "}
                          {team.tournament.name}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-zinc-400">
                        {team.createdAt.toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "short",
                        })}
                      </p>
                      <p
                        className={`text-xs font-semibold ${
                          team.paid ? "text-green-600" : "text-orange-500"
                        }`}
                      >
                        {team.paid
                          ? formatGBP(team.tournament.entryFee)
                          : "Unpaid"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Quick actions + tournament list */}
        <div className="space-y-6">
          <DashboardActions tournaments={tournaments.map(t => ({ id: t.id, name: t.name, status: t.status }))} />

          {/* Tournaments summary */}
          <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="font-semibold text-zinc-900">Tournaments</h2>
            </div>
            <div className="divide-y divide-zinc-100">
              {tournaments.map((t) => (
                <Link
                  key={t.id}
                  href={`/admin/tournaments/${t.id}/players`}
                  className="flex items-center justify-between px-5 py-3 hover:bg-zinc-50"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-900">
                      {t.name}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {t._count.teams} teams · {t.teams.length} paid
                    </p>
                  </div>
                  <StatusBadge status={t.status} />
                </Link>
              ))}
              {tournaments.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-zinc-400">
                  No tournaments yet.
                </div>
              )}
            </div>
            <div className="border-t border-zinc-200 p-3">
              <Link
                href="/admin/tournaments"
                className="block rounded-lg bg-zinc-100 py-2 text-center text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200"
              >
                Manage Tournaments →
              </Link>
            </div>
          </div>

          {/* Content & Engagement Links */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <h2 className="font-semibold text-zinc-900">Content &amp; Engagement</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                href="/power-rankings"
                className="rounded-lg border border-zinc-200 px-3 py-2 text-center text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                📈 Power Rankings
              </Link>
              <Link
                href="/achievements"
                className="rounded-lg border border-zinc-200 px-3 py-2 text-center text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                🏆 Achievements
              </Link>
              <Link
                href="/blog"
                className="rounded-lg border border-zinc-200 px-3 py-2 text-center text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                📰 Blog
              </Link>
              <Link
                href="/referrals"
                className="rounded-lg border border-zinc-200 px-3 py-2 text-center text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50"
              >
                🤝 Referrals
              </Link>
            </div>
          </div>
        </div>
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
  value: string;
  icon: string;
  accent: string;
}) {
  return (
    <div
      className={`rounded-xl border p-5 shadow-sm ${accent}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-0.5 text-xs font-medium opacity-70">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    upcoming: "bg-zinc-100 text-zinc-600",
    entries_open: "bg-green-100 text-green-700",
    in_progress: "bg-orange-100 text-orange-700",
    completed: "bg-blue-100 text-blue-700",
  };
  const labels: Record<string, string> = {
    upcoming: "Upcoming",
    entries_open: "Open",
    in_progress: "Live",
    completed: "Done",
  };
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
        styles[status] ?? styles.upcoming
      }`}
    >
      {labels[status] ?? status}
    </span>
  );
}
