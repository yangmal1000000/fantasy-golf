import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { calculateTeamScore } from "@/lib/scoring";
import { formatDateRange, STATUS_CONFIG } from "@/lib/ui";
import TierBadge from "@/components/TierBadge";
import { Suspense } from "react";
import { TournamentListSkeleton } from "@/components/Skeletons";
import SignInPrompt from "@/components/SignInPrompt";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "My Teams — Fantasy Golf",
  description: "View all your fantasy golf team entries, scores, and positions across every tournament.",
};

export default async function MyTeamsPage() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Suspense fallback={<TournamentListSkeleton />}>
        <SignInPrompt
          title="My Teams"
          message="Sign in with Google to view and manage your fantasy golf teams."
        />
      </Suspense>
    );
  }

  const teams = await prisma.team.findMany({
    where: { userId: user.id },
    include: {
      tournament: true,
      selections: {
        include: {
          tournamentPlayer: {
            include: { player: true },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Calculate scores for each team
  const teamData = await Promise.all(
    teams.map(async (team) => {
      let scoreResult: Awaited<ReturnType<typeof calculateTeamScore>> | null = null;
      try {
        scoreResult = await calculateTeamScore(team.id);
      } catch {
        // scores not available
      }
      return { team, scoreResult };
    })
  );

  return (
    <Suspense fallback={<TournamentListSkeleton />}>
    <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
      {/* Header */}
      <h1 className="text-xl font-bold tracking-tight text-[#0a3d2a] dark:text-green-400 sm:text-2xl">My Teams</h1>
      <p className="mt-0.5 text-xs text-zinc-500">All your fantasy golf entries</p>

      {teamData.length === 0 ? (
        /* Empty state */
        <div className="rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center sm:p-12">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[#0a3d2a]/10 text-3xl">
            ⛳
          </div>
          <p className="text-lg font-semibold text-zinc-700">
            No teams yet
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Enter a tournament to build your first team!
          </p>
          <Link
            href="/tournaments"
            className="mt-5 inline-block rounded-full bg-[#0a3d2a] px-6 py-2.5 text-sm font-bold text-white transition hover:bg-[#0a3d2a] touch-target"
          >
            Browse Tournaments →
          </Link>
        </div>
      ) : (
        <div className="grid gap-2 sm:gap-3">
          {teamData.map(({ team, scoreResult }) => {
            const tournament = team.tournament;
            const status = STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.upcoming;

            // Sort selections by tier order
            const tierOrder: Record<string, number> = {
              T1_10: 1, T11_20: 2, T21_30: 3, T31_50: 4, T51_PLUS: 5,
            };
            const sortedSelections = [...team.selections].sort(
              (a, b) =>
                (tierOrder[a.tournamentPlayer.tier] ?? 99) -
                (tierOrder[b.tournamentPlayer.tier] ?? 99)
            );

            const totalPar = tournament.par * 4 * 5;
            const vsPar = scoreResult ? scoreResult.totalStrokes - totalPar : 0;

            return (
              <div
                key={team.id}
                className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition hover:border-zinc-300 dark:hover:border-zinc-700"
              >
                {/* Card header */}
                <div className="flex items-center justify-between bg-[#0a3d2a] px-3 py-2 text-white sm:px-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${status.badgeClass}`}>{status.label}</span>
                      {scoreResult && (
                        <span className="text-[11px] text-white/60 tabular">{formatDateRange(tournament.startDate, tournament.endDate)}</span>
                      )}
                    </div>
                    <h2 className="mt-1 text-sm font-bold sm:text-base">{tournament.name}</h2>
                    <p className="mt-0 text-[11px] text-white/70">{tournament.course ?? "TBD"}</p>
                  </div>
                  {scoreResult && (
                    <div className="text-center shrink-0">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold sm:h-10 sm:w-10 ${
                        scoreResult.position === 1
                          ? "bg-[#c8a951] text-[#1a1a1a]"
                          : "bg-white/15 text-white"
                      }`}>
                        {scoreResult.position || "—"}
                      </div>
                      <p className="mt-0.5 text-xs text-white/60">Pos</p>
                    </div>
                  )}
                </div>

                {/* Team name + score */}
                <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 px-4 py-3 sm:px-5">
                  <div className="min-w-0">
                    <p className="text-xs text-zinc-500">Team</p>
                    <Link
                      href={`/tournaments/${tournament.id}/teams/${team.id}`}
                      className="font-bold text-[#0a3d2a] hover:underline dark:text-green-400"
                    >
                      {team.name}
                    </Link>
                  </div>
                  {scoreResult && (
                    <div className="text-right shrink-0">
                      <p className="text-xl font-bold tabular text-[#0a3d2a] dark:text-green-400 sm:text-2xl">
                        {scoreResult.totalStrokes}
                      </p>
                      <p className={`text-xs font-medium ${
                        vsPar < 0 ? "text-red-500" : vsPar === 0 ? "text-zinc-500" : "text-zinc-400"
                      }`}>
                        {vsPar > 0 ? "+" : ""}{vsPar === 0 ? "E" : vsPar} vs par
                      </p>
                    </div>
                  )}
                </div>

                {/* Players */}
                <div className="p-4 sm:p-5">
                  {/* Horizontal scroll on mobile, wrap on desktop */}
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap sm:overflow-visible">
                    {sortedSelections.map((sel) => {
                      const tier = sel.tournamentPlayer.tier;
                      const playerScore = scoreResult?.players.find(
                        (p) => p.playerId === sel.tournamentPlayer.playerId
                      );
                      return (
                        <Link
                          key={sel.id}
                          href={`/players/${sel.tournamentPlayer.playerId}`}
                          className="group flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 transition hover:shadow-sm"
                          style={{ borderColor: 'transparent' }}
                        >
                          <TierBadge tier={tier} size="sm" />
                          <span className="whitespace-nowrap text-sm font-medium text-zinc-800 group-hover:text-[#0a3d2a] dark:text-zinc-200 dark:group-hover:text-green-400">
                            {sel.tournamentPlayer.player.name}
                          </span>
                          {playerScore && (
                            <span className="text-xs text-zinc-500">
                              {playerScore.totalStrokes > 0 ? playerScore.totalStrokes : "—"}
                            </span>
                          )}
                        </Link>
                      );
                    })}
                  </div>

                  {/* Actions — full width on mobile */}
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <Link
                      href={`/tournaments/${tournament.id}/teams/${team.id}`}
                      className="flex-1 rounded-xl bg-[#0a3d2a] py-2.5 text-center text-sm font-semibold text-white transition hover:bg-[#0a3d2a] touch-target"
                    >
                      View Team →
                    </Link>
                    <Link
                      href={`/tournaments/${tournament.id}/leaderboard`}
                      className="flex-1 rounded-xl border border-zinc-200 dark:border-zinc-700 py-2.5 text-center text-sm font-semibold text-zinc-700 dark:text-zinc-300 transition hover:bg-zinc-50 dark:hover:bg-zinc-800 touch-target"
                    >
                      Leaderboard
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    </Suspense>
  );
}
