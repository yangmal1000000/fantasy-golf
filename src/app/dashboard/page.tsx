import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getRocketBetaStateForUser } from "@/lib/rocket-beta";
import { calculateTeamScore } from "@/lib/scoring";
import { calculateUserWinnings } from "@/lib/winnings";
import { formatGBP, STATUS_CONFIG } from "@/lib/ui";
import PlayerAvatar from "@/components/PlayerAvatar";
import { Suspense } from "react";
import { TournamentListSkeleton } from "@/components/Skeletons";
import SignInPrompt from "@/components/SignInPrompt";
import {
  TrophyIcon,
  ChartBarIcon,
  PoundIcon,
  StarIcon,
  CrownIcon,
  BoltIcon,
  UsersIcon,
  TargetIcon,
  TicketIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Dashboard — Fantasy Golf",
  description: "Your fantasy golf dashboard — stats, teams, achievements, and performance.",
};

export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Suspense fallback={<TournamentListSkeleton />}>
        <SignInPrompt
          title="Your Dashboard"
          message="Sign in with Google to view your fantasy golf dashboard, stats, and teams."
        />
      </Suspense>
    );
  }
  const rocketBeta = await getRocketBetaStateForUser(user);

  // Fetch everything in parallel
  const [teams, leagueMembers, earnedAchievements, savedTeamCount, winnings] = await Promise.all([
    prisma.team.findMany({
      where: { userId: user.id },
      include: {
        tournament: { select: { id: true, name: true, status: true, startDate: true, endDate: true, course: true, par: true, category: true, entryFee: true } },
        selections: {
          include: {
            tournamentPlayer: {
              include: { player: { select: { id: true, name: true, country: true, photoUrl: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.leagueMember.findMany({
      where: { userId: user.id },
      include: { league: { select: { id: true, name: true } } },
    }),
    prisma.$queryRawUnsafe<{ type: string; "earnedAt": Date }[]>(
      `SELECT type, "earnedAt" FROM "UserAchievement" WHERE "userId" = $1`,
      user.id
    ).catch(() => []),
    prisma.savedTeam.count({ where: { userId: user.id } }),
    calculateUserWinnings(user.id),
  ]);

  // Calculate scores for completed/live teams
  const teamData = await Promise.all(
    teams.map(async (team) => {
      let score: Awaited<ReturnType<typeof calculateTeamScore>> | null = null;
      try {
        score = await calculateTeamScore(team.id);
      } catch {}
      return { team, score };
    })
  );

  // --- Compute stats ---
  const totalEntries = teams.length;
  const completedTeams = teamData.filter((t) => t.score && t.team.tournament.status === "completed");
  const liveTeams = teamData.filter((t) => t.score && t.team.tournament.status === "in_progress");
  const upcomingTeams = teamData.filter((t) => t.team.tournament.status === "entries_open" || t.team.tournament.status === "upcoming");

  const totalWon = winnings.totalWon;
  const netProfit = winnings.netProfit;

  // Best position
  const positions = completedTeams
    .map((t) => t.score?.position)
    .filter((p): p is number => p != null && p > 0);
  const bestPosition = positions.length > 0 ? Math.min(...positions) : null;
  const wins = positions.filter((p) => p === 1).length;
  const podiums = positions.filter((p) => p <= 3).length;

  // Average position
  const avgPosition = positions.length > 0
    ? Math.round((positions.reduce((a, b) => a + b, 0) / positions.length) * 10) / 10
    : null;

  // Favorite players (most picked)
  const pickCount = new Map<string, { name: string; country: string | null; photoUrl: string | null; count: number }>();
  for (const t of teamData) {
    for (const sel of t.team.selections) {
      const p = sel.tournamentPlayer.player;
      const existing = pickCount.get(p.id);
      if (existing) {
        existing.count++;
      } else {
        pickCount.set(p.id, { name: p.name, country: p.country, photoUrl: p.photoUrl, count: 1 });
      }
    }
  }
  const topPlayers = [...pickCount.values()].sort((a, b) => b.count - a.count).slice(0, 5);

  return (
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      {/* ===== Profile Header ===== */}
      <div className="overflow-hidden rounded-2xl bg-gradient-to-br from-[#0a3d2a] via-[#0a3d2a] to-[#1a5c3e] p-5 text-white shadow-lg">
        <div className="flex items-center gap-4">
          {user.avatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.avatar} alt={user.name ?? ""} className="h-16 w-16 rounded-full border-2 border-[#c8a951] object-cover" />
          ) : (
            <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#c8a951] bg-white/10 text-2xl font-bold">
              {(user.name ?? user.email)[0].toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">{user.name ?? "Player"}</h1>
            <p className="truncate text-xs text-white/60">{user.email}</p>
            <div className="mt-1 flex flex-wrap gap-2">
              <span className="rounded-full bg-[#c8a951]/20 px-2.5 py-0.5 text-[11px] font-semibold text-[#c8a951]">
                {totalEntries} {totalEntries === 1 ? "Entry" : "Entries"}
              </span>
              {wins > 0 && (
                <span className="rounded-full bg-[#c8a951]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#c8a951]">
                  🏆 {wins} {wins === 1 ? "Win" : "Wins"}
                </span>
              )}
              {podiums > 0 && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/80">
                  {podiums} Podiums
                </span>
              )}
              {savedTeamCount > 0 && (
                <Link href="/my-teams" className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/80 transition hover:bg-white/20">
                  📋 {savedTeamCount} {savedTeamCount === 1 ? "Template" : "Templates"}
                </Link>
              )}
              {earnedAchievements.length > 0 && (
                <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold text-white/80">
                  ⭐ {earnedAchievements.length} Badges
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {rocketBeta.approved && (
        <section className="mt-4 overflow-hidden rounded-2xl border border-[#c8a951]/40 bg-white shadow-sm dark:bg-zinc-900">
          <div className="bg-[radial-gradient(circle_at_90%_10%,rgba(221,199,127,.25),transparent_28%),linear-gradient(120deg,#071f16,#0a3d2a)] p-5 text-white">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#e4cc85]">
                  Rocket Classic · free test flight
                </p>
                <h2 className="mt-2 text-xl font-black">
                  {rocketBeta.passState === "REDEEMED"
                    ? "Your team is confirmed"
                    : rocketBeta.passState === "UNLOCKED"
                      ? "Your Test Pass is ready"
                      : "Complete Target to unlock your pass"}
                </h2>
                <p className="mt-1 text-sm text-white/65">
                  Detroit Golf Club · 30 July–2 August · no payment or prize
                </p>
              </div>
              <Link
                href={
                  rocketBeta.passState === "REDEEMED" && rocketBeta.teamId
                    ? `/tournaments/rocket-classic/teams/${rocketBeta.teamId}`
                    : rocketBeta.passState === "UNLOCKED" && rocketBeta.fieldReady
                      ? rocketBeta.enterHref
                      : rocketBeta.passState === "UNLOCKED"
                        ? rocketBeta.tournamentHref
                      : rocketBeta.targetHref
                }
                className="rounded-xl bg-[#c8a951] px-4 py-2.5 text-sm font-black text-[#17251d]"
              >
                {rocketBeta.passState === "REDEEMED"
                  ? "View my team →"
                  : rocketBeta.passState === "UNLOCKED"
                    ? rocketBeta.fieldReady
                      ? "Build my team →"
                      : "View field review →"
                    : "Start Target →"}
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 divide-x divide-zinc-100 dark:divide-zinc-800">
            <div className="p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">
                1 · Target
              </p>
              <p className="mt-1 text-sm font-bold text-zinc-800 dark:text-zinc-100">
                {rocketBeta.passState === "LOCKED" ? "Not completed" : "Completed"}
              </p>
            </div>
            <div className="p-4">
              <p className="text-[10px] font-black uppercase tracking-wide text-zinc-400">
                2 · Rocket team
              </p>
              <p className="mt-1 text-sm font-bold text-zinc-800 dark:text-zinc-100">
                {rocketBeta.passState === "REDEEMED" ? "Confirmed" : "Waiting"}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ===== Stats Grid ===== */}
      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-5 sm:gap-3">
        <StatCard
          icon={<TicketIcon className="h-4 w-4" />}
          label="Tournaments"
          value={totalEntries.toString()}
          sub={`${completedTeams.length} completed`}
          accent="text-[#0a3d2a] dark:text-green-400"
        />
        <StatCard
          icon={<CrownIcon className="h-4 w-4" />}
          label="Best Finish"
          value={bestPosition ? `#${bestPosition}` : "—"}
          sub={bestPosition === 1 ? "Winner!" : bestPosition && bestPosition <= 3 ? "Podium" : undefined}
          accent={bestPosition === 1 ? "text-[#c8a951]" : "text-[#0a3d2a] dark:text-green-400"}
        />
        <StatCard
          icon={<ChartBarIcon className="h-4 w-4" />}
          label="Avg Position"
          value={avgPosition ? `#${avgPosition}` : "—"}
          sub={positions.length > 0 ? `from ${positions.length} events` : undefined}
          accent="text-[#0a3d2a] dark:text-green-400"
        />
        {rocketBeta.approved ? (
          <StatCard
            icon={<TicketIcon className="h-4 w-4" />}
            label="Test Pass"
            value={
              rocketBeta.passState === "REDEEMED"
                ? "Used"
                : rocketBeta.passState === "UNLOCKED"
                  ? "Ready"
                  : "Locked"
            }
            sub="Rocket Classic beta"
            accent="text-[#c8a951]"
          />
        ) : (
          <StatCard
            icon={<PoundIcon className="h-4 w-4" />}
            label="Net P/L"
            value={netProfit === 0 ? formatGBP(0) : `${netProfit < 0 ? "-" : "+"}${formatGBP(Math.abs(netProfit))}`}
            sub={`${formatGBP(totalWon)} won`}
            accent={netProfit > 0 ? "text-green-600" : netProfit < 0 ? "text-red-500" : "text-[#c8a951]"}
          />
        )}
        <StatCard
          icon={<StarIcon className="h-4 w-4" />}
          label="Templates"
          value={savedTeamCount.toString()}
          sub={savedTeamCount === 5 ? "Max reached" : `${5 - savedTeamCount} slots left`}
          accent="text-[#0a3d2a] dark:text-green-400"
        />
      </div>

      {/* ===== Active Tournaments ===== */}
      {(liveTeams.length > 0 || upcomingTeams.length > 0) && (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <BoltIcon className="h-3.5 w-3.5 text-[#c44545]" />
            Active
          </h2>
          <div className="space-y-2">
            {[...liveTeams, ...upcomingTeams].map(({ team, score }) => {
              const t = team.tournament;
              const status = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.upcoming;
              const isLive = t.status === "in_progress";
              return (
                <Link
                  key={team.id}
                  href={`/tournaments/${t.id}/teams/${team.id}`}
                  className={`flex items-center gap-3 rounded-xl border p-3 transition hover:shadow-md ${
                    isLive
                      ? "border-[#c44545]/30 bg-gradient-to-r from-[#c44545]/5 to-transparent"
                      : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${status.badgeClass}`}>{status.label}</span>
                      <span className="truncate text-sm font-bold text-zinc-900 dark:text-white">{t.name}</span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">{team.name} · {t.course ?? "TBD"}</p>
                  </div>
                  {score && score.roundsScored > 0 && (
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold tabular text-[#0a3d2a] dark:text-green-400">
                        {score.totalStrokes}
                      </p>
                      <p className="text-[11px] text-zinc-500">
                        Pos #{score.position || "—"}
                      </p>
                    </div>
                  )}
                  {(!score || score.roundsScored === 0) && (
                    <span className="shrink-0 text-xs font-semibold text-[#c8a951]">View Team →</span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== Recent Results ===== */}
      {completedTeams.length > 0 && (
        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <TrophyIcon className="h-3.5 w-3.5 text-[#c8a951]" />
              Recent Results
            </h2>
            <Link href="/my-teams" className="text-xs font-medium text-[#0a3d2a] hover:underline dark:text-green-400">
              All teams →
            </Link>
          </div>
          <div className="space-y-2">
            {completedTeams.slice(0, 4).map(({ team, score }) => {
              const t = team.tournament;
              const isWin = score?.position === 1;
              const isPodium = score?.position && score.position <= 3;
              return (
                <Link
                  key={team.id}
                  href={`/tournaments/${t.id}/teams/${team.id}`}
                  className="flex items-center gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 transition hover:border-zinc-300 dark:hover:border-zinc-700"
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      isWin
                        ? "bg-[#c8a951] text-[#1a1a1a]"
                        : isPodium
                          ? "bg-[#0a3d2a] text-white"
                          : "bg-zinc-100 dark:bg-zinc-800 text-zinc-500"
                    }`}
                  >
                    {score?.position ?? "—"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">{t.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {team.selections.slice(0, 5).map((sel) => (
                        <PlayerAvatar
                          key={sel.id}
                          name={sel.tournamentPlayer.player.name}
                          country={sel.tournamentPlayer.player.country}
                          photoUrl={sel.tournamentPlayer.player.photoUrl}
                          size="sm"
                        />
                      ))}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-base font-bold tabular text-[#0a3d2a] dark:text-green-400">
                      {score?.totalStrokes ?? "—"}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      {score ? (score.vsPar < 0 ? `${score.vsPar} vs par` : score.vsPar === 0 ? "E" : `+${score.vsPar}`) : ""}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== Two column: Favorite Players + Leagues ===== */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {/* Favorite Players */}
        {topPlayers.length > 0 && (
          <section>
            <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              <StarIcon className="h-3.5 w-3.5 text-[#c8a951]" />
              Most Picked
            </h2>
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
              <div className="space-y-2">
                {topPlayers.map((p, i) => (
                  <div key={i} className="flex items-center gap-2.5">
                    <span className="w-4 text-right text-xs font-bold tabular text-zinc-400">{i + 1}</span>
                    <PlayerAvatar name={p.name} country={p.country} photoUrl={p.photoUrl} size="sm" />
                    <Link
                      href={`/players/${[...pickCount.entries()].find(([, v]) => v.name === p.name)?.[0] ?? ""}`}
                      className="flex-1 truncate text-sm font-medium text-zinc-800 hover:text-[#0a3d2a] dark:text-zinc-200 dark:hover:text-green-400"
                    >
                      {p.name}
                    </Link>
                    <span className="rounded-full bg-[#0a3d2a]/10 px-2 py-0.5 text-xs font-bold tabular text-[#0a3d2a] dark:bg-green-950/30 dark:text-green-400">
                      {p.count}×
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Leagues */}
        <section>
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <UsersIcon className="h-3.5 w-3.5 text-[#0a3d2a] dark:text-green-400" />
            Leagues
          </h2>
          {leagueMembers.length > 0 ? (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
              <div className="space-y-2">
                {leagueMembers.map((lm) => (
                  <Link
                    key={lm.id}
                    href={`/leagues/${lm.league.id}`}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{lm.league.name}</span>
                    <span className="text-xs text-zinc-400">View →</span>
                  </Link>
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-zinc-300 dark:border-zinc-700 p-4 text-center">
              <p className="text-xs text-zinc-500">No leagues joined yet</p>
              <Link href="/leagues" className="mt-2 inline-block text-xs font-semibold text-[#0a3d2a] dark:text-green-400">
                Join or create →
              </Link>
            </div>
          )}
        </section>
      </div>

      {/* ===== Achievements Preview ===== */}
      <section className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            <TargetIcon className="h-3.5 w-3.5 text-purple-500" />
            Achievements
          </h2>
          <Link href="/achievements" className="text-xs font-medium text-[#0a3d2a] hover:underline dark:text-green-400">
            View all →
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {earnedAchievements.length > 0 ? (
            earnedAchievements.slice(0, 6).map((a) => (
              <span
                key={a.type}
                className="inline-flex items-center gap-1 rounded-full border border-[#c8a951]/30 bg-[#c8a951]/10 px-3 py-1 text-xs font-semibold text-[#c8a951]"
              >
                ⭐ {a.type.replace(/_/g, " ")}
              </span>
            ))
          ) : (
            <p className="text-xs text-zinc-400">No badges earned yet — enter tournaments to unlock achievements!</p>
          )}
        </div>
      </section>

      {/* ===== Quick Actions ===== */}
      <section className="mt-6 grid grid-cols-3 gap-2 sm:grid-cols-5">
        <Link
          href="/tournaments"
          className="flex flex-col items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 transition hover:border-zinc-300 dark:hover:border-zinc-700"
        >
          <TicketIcon className="h-5 w-5 text-[#0a3d2a] dark:text-green-400" />
          <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Enter</span>
        </Link>
        <Link
          href="/my-teams"
          className="flex flex-col items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 transition hover:border-zinc-300 dark:hover:border-zinc-700"
        >
          <UsersIcon className="h-5 w-5 text-[#0a3d2a] dark:text-green-400" />
          <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">My Teams</span>
        </Link>
        <Link
          href="/leagues"
          className="flex flex-col items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 transition hover:border-zinc-300 dark:hover:border-zinc-700"
        >
          <TrophyIcon className="h-5 w-5 text-[#0a3d2a] dark:text-green-400" />
          <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Leagues</span>
        </Link>
        <Link
          href="/achievements"
          className="flex flex-col items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 transition hover:border-zinc-300 dark:hover:border-zinc-700"
        >
          <TargetIcon className="h-5 w-5 text-purple-500" />
          <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Badges</span>
        </Link>
        <Link
          href="/stats"
          className="flex flex-col items-center gap-1 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 transition hover:border-zinc-300 dark:hover:border-zinc-700"
        >
          <ChartBarIcon className="h-5 w-5 text-[#0a3d2a] dark:text-green-400" />
          <span className="text-[11px] font-semibold text-zinc-700 dark:text-zinc-300">Stats</span>
        </Link>
      </section>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  sub,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent: string;
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-center shadow-sm">
      <div className={`mx-auto mb-1 flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 ${accent}`}>
        {icon}
      </div>
      <p className={`text-lg font-bold tabular sm:text-xl ${accent}`}>{value}</p>
      <p className="text-[10px] font-medium text-zinc-500">{label}</p>
      {sub && <p className="text-[9px] text-zinc-400">{sub}</p>}
    </div>
  );
}
