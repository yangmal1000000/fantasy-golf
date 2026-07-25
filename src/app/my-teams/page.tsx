import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { formatDateRange, STATUS_CONFIG, TIER_ORDER } from "@/lib/ui";
import TierBadge from "@/components/TierBadge";
import { Suspense } from "react";
import { TournamentListSkeleton } from "@/components/Skeletons";
import SignInPrompt from "@/components/SignInPrompt";
import {
  ROCKET_BETA_CAMPAIGN_SLUG,
  ROCKET_BETA_TOURNAMENT_ID,
} from "@/lib/rocket-beta";
import { isRocketBetaFieldOpen } from "@/lib/rocket-beta-access";
import { parseRocketDraft } from "@/lib/rocket-draft";
import { rocketTierCopy } from "@/lib/rocket-tiers";
import PendingLinkLabel from "@/components/PendingLinkLabel";
import { SavedTeamsSection, SaveAsTemplateButton } from "./SavedTeamsClient";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "My Teams — Fantasy Golf",
  description:
    "View all your fantasy golf team entries, saved templates, and scores.",
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

  // Fetch saved teams and entered teams in parallel
  const [savedTeams, teams, rocketPass] = await Promise.all([
    prisma.savedTeam.findMany({
      where: { userId: user.id },
      include: {
        players: {
          include: {
            player: {
              select: {
                id: true,
                name: true,
                country: true,
                photoUrl: true,
                dataGolfRank: true,
              },
            },
          },
          orderBy: { tier: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.team.findMany({
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
    }),
    prisma.rocketBetaPass.findFirst({
      where: {
        userId: user.id,
        campaign: { slug: ROCKET_BETA_CAMPAIGN_SLUG },
      },
      select: {
        status: true,
        teamId: true,
        draftTeam: true,
        draftUpdatedAt: true,
        campaign: {
          select: {
            fieldFrozenAt: true,
            fieldHash: true,
            provisionalFieldReadyAt: true,
          },
        },
      },
    }),
  ]);
  const hasRocketTeam = teams.some(
    (team) => team.tournamentId === ROCKET_BETA_TOURNAMENT_ID,
  );
  const showRocketPassCard =
    rocketPass?.status === "UNLOCKED" && !hasRocketTeam;
  const rocketFieldReady = rocketPass
    ? isRocketBetaFieldOpen({
        fieldFrozenAt: rocketPass.campaign.fieldFrozenAt,
        fieldHash: rocketPass.campaign.fieldHash,
      })
    : false;
  const rocketProvisionalFieldReady = Boolean(
    rocketPass?.campaign.provisionalFieldReadyAt &&
    rocketPass.campaign.fieldHash,
  );
  const rocketDraft = parseRocketDraft(rocketPass?.draftTeam);
  const hasRocketDraft = Boolean(rocketDraft);
  const rocketDraftPicks = rocketDraft
    ? [...rocketDraft.picks].sort(
        (left, right) =>
          TIER_ORDER.indexOf(left.tier) - TIER_ORDER.indexOf(right.tier),
      )
    : [];

  // Serialize saved teams for client component
  const savedTeamsData = savedTeams.map((st) => ({
    id: st.id,
    name: st.name,
    createdAt: st.createdAt.toISOString(),
    players: st.players.map((p) => ({
      playerId: p.playerId,
      tier: p.tier,
      player: {
        id: p.player.id,
        name: p.player.name,
        country: p.player.country,
        photoUrl: p.player.photoUrl,
        dataGolfRank: p.player.dataGolfRank,
      },
    })),
  }));

  return (
    <Suspense fallback={<TournamentListSkeleton />}>
      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6">
        {/* Header */}
        <h1 className="text-xl font-bold tracking-tight text-[#0a3d2a] dark:text-green-400 sm:text-2xl">
          My Teams
        </h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          Saved drafts, templates &amp; tournament entries
        </p>

        {/* Saved Teams Section */}
        <SavedTeamsSection initialSavedTeams={savedTeamsData} />

        {showRocketPassCard ? (
          <div className="mt-6 rounded-2xl border border-[#c8a951]/60 bg-[#fffaf0] p-5 dark:border-[#c8a951]/30 dark:bg-[#c8a951]/10 sm:p-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9b7b25] dark:text-[#d7bc6a]">
              Rocket Test Pass ready
            </p>
            <h2 className="mt-2 text-lg font-black text-[#0a3d2a] dark:text-green-400">
              {rocketFieldReady
                ? hasRocketDraft
                  ? "Your Rocket team is being finalised"
                  : "Build your real Rocket team"
                : rocketProvisionalFieldReady
                  ? hasRocketDraft
                    ? "Entry saved — no action needed"
                    : "Start your provisional Rocket draft"
                  : "Your real team will appear here after confirmation"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {rocketFieldReady
                ? "The reviewed final field is open. Saved drafts are fixed automatically; new entrants can still confirm one golfer from every tier before first tee."
                : rocketProvisionalFieldReady
                  ? hasRocketDraft
                    ? "Your five picks are saved. You do not need to do anything else. We will make your team official automatically after Monday’s verified final field and notify you if anything changes."
                    : "The official initial field is available. Save five weekend picks now; the verified final field will fix the draft automatically."
                  : "The official initial field has not been published yet. Your Test Pass remains unlocked."}
            </p>

            {rocketDraft ? (
              <section
                className="mt-4 overflow-hidden rounded-2xl border border-[#c8a951]/35 bg-white/80 shadow-sm dark:border-[#c8a951]/25 dark:bg-black/20"
                aria-label="Saved Rocket entry"
              >
                <div className="flex items-start justify-between gap-3 border-b border-[#c8a951]/20 px-4 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-zinc-500 dark:text-zinc-400">
                      Saved entry
                    </p>
                    <h3 className="mt-0.5 truncate text-base font-black text-zinc-900 dark:text-white">
                      {rocketDraft.teamName}
                    </h3>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-black text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                    <span aria-hidden="true">✓</span> No action needed
                  </span>
                </div>

                <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {rocketDraftPicks.map((pick) => (
                    <div
                      key={pick.tier}
                      className="flex min-h-12 items-center gap-3 px-4 py-2.5"
                    >
                      <TierBadge
                        tier={pick.tier}
                        size="md"
                        fieldRelative
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-zinc-900 dark:text-white">
                          {pick.playerName}
                        </p>
                        <p className="truncate text-[11px] text-zinc-500 dark:text-zinc-400">
                          {rocketTierCopy(pick.tier)?.label ??
                            pick.tier.replaceAll("_", " ")}
                        </p>
                      </div>
                      <span className="shrink-0 text-xs font-semibold tabular text-zinc-500 dark:text-zinc-400">
                        {pick.rank ? `World #${pick.rank}` : "Unranked"}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 border-t border-[#c8a951]/20 bg-[#fffaf0]/80 px-3 py-3 text-center dark:bg-[#c8a951]/5">
                  <div>
                    <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white">
                      ✓
                    </span>
                    <p className="mt-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                      Saved now
                    </p>
                  </div>
                  <div>
                    <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#c8a951] bg-white text-[10px] font-black text-[#8a6d1d] dark:bg-zinc-900 dark:text-[#d7bc6a]">
                      2
                    </span>
                    <p className="mt-1 text-[10px] font-bold text-zinc-600 dark:text-zinc-300">
                      Field checked Monday
                    </p>
                  </div>
                  <div>
                    <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full border-2 border-zinc-300 bg-white text-[10px] font-black text-zinc-400 dark:border-zinc-700 dark:bg-zinc-900">
                      3
                    </span>
                    <p className="mt-1 text-[10px] font-bold text-zinc-500 dark:text-zinc-400">
                      Official automatically
                    </p>
                  </div>
                </div>
              </section>
            ) : null}

            <Link
              href="/tournaments/rocket-classic/enter"
              className="press-feedback mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-[#0a3d2a] px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-[#12563c] sm:w-auto"
            >
              <PendingLinkLabel
                idle={
                  rocketFieldReady
                    ? hasRocketDraft
                      ? "Check team status →"
                      : "Build Rocket team →"
                    : rocketProvisionalFieldReady
                      ? hasRocketDraft
                        ? "Change saved picks →"
                        : "Start provisional draft →"
                      : "View entry status →"
                }
                pending={
                  rocketFieldReady
                    ? "Opening team review…"
                    : rocketProvisionalFieldReady
                      ? "Opening your draft…"
                      : "Checking entry status…"
                }
              />
            </Link>
          </div>
        ) : null}

        {/* Entered Teams */}
        {teams.length === 0 ? (
          savedTeams.length === 0 && !showRocketPassCard ? (
            /* Empty state — only show if no saved teams either */
            <div className="mt-6 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 p-8 text-center sm:p-12">
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
          ) : null
        ) : (
          <div className="mt-6">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-zinc-500">
              Tournament Entries
            </h2>
            <div className="grid gap-2 sm:gap-3">
              {teams.map((team) => {
                const tournament = team.tournament;
                const status =
                  STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.upcoming;

                // Sort selections by tier order
                const sortedSelections = [...team.selections].sort(
                  (a, b) =>
                    (TIER_ORDER.indexOf(a.tournamentPlayer.tier) ?? 99) -
                    (TIER_ORDER.indexOf(b.tournamentPlayer.tier) ?? 99),
                );

                // Use stored values instead of calculateTeamScore
                const totalScore = team.totalScore;
                const position = team.position;
                const totalPar = tournament.par * 4 * 5;
                const vsPar = totalScore ? totalScore - totalPar : 0;

                return (
                  <div
                    key={team.id}
                    className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 transition hover:border-zinc-300 dark:hover:border-zinc-700"
                  >
                    {/* Card header */}
                    <div className="flex items-center justify-between bg-[#0a3d2a] px-3 py-2 text-white sm:px-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${status.badgeClass}`}
                          >
                            {status.label}
                          </span>
                          {totalScore > 0 && (
                            <span className="text-[11px] text-white/60 tabular">
                              {formatDateRange(
                                tournament.startDate,
                                tournament.endDate,
                              )}
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1 text-sm font-bold sm:text-base">
                          {tournament.name}
                        </h3>
                        <p className="mt-0 text-[11px] text-white/70">
                          {tournament.course ?? "TBD"}
                        </p>
                      </div>
                      {position && (
                        <div className="text-center shrink-0">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold sm:h-10 sm:w-10 ${
                              position === 1
                                ? "bg-[#c8a951] text-[#1a1a1a]"
                                : "bg-white/15 text-white"
                            }`}
                          >
                            {position}
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
                      {totalScore > 0 && (
                        <div className="text-right shrink-0">
                          <p className="text-xl font-bold tabular text-[#0a3d2a] dark:text-green-400 sm:text-2xl">
                            {totalScore}
                          </p>
                          <p
                            className={`text-xs font-medium ${
                              vsPar < 0
                                ? "text-red-500"
                                : vsPar === 0
                                  ? "text-zinc-500"
                                  : "text-zinc-400"
                            }`}
                          >
                            {vsPar > 0 ? "+" : ""}
                            {vsPar === 0 ? "E" : vsPar} vs par
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Players */}
                    <div className="p-4 sm:p-5">
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 sm:flex-wrap sm:overflow-visible">
                        {sortedSelections.map((sel) => (
                          <Link
                            key={sel.id}
                            href={`/players/${sel.tournamentPlayer.playerId}`}
                            className="group flex shrink-0 items-center gap-2 rounded-xl border px-3 py-2 transition hover:shadow-sm"
                            style={{ borderColor: "transparent" }}
                          >
                            <TierBadge
                              tier={sel.tournamentPlayer.tier}
                              size="sm"
                            />
                            <span className="whitespace-nowrap text-sm font-medium text-zinc-800 group-hover:text-[#0a3d2a] dark:text-zinc-200 dark:group-hover:text-green-400">
                              {sel.tournamentPlayer.player.name}
                            </span>
                          </Link>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
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
                        {/* Save as Template button */}
                        <SaveAsTemplateButton
                          players={sortedSelections.map((sel) => ({
                            playerId: sel.tournamentPlayer.playerId,
                            tier: sel.tournamentPlayer.tier,
                          }))}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </Suspense>
  );
}
