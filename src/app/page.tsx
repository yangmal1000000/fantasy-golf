import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  ROCKET_BETA_TOURNAMENT_ID,
  getRocketBetaStateForUser,
} from "@/lib/rocket-beta";
import {
  ROCKET_BETA_ENTRY_CLOSES_AT,
  ROCKET_BETA_ENTRY_DEADLINE_CONFIRMED,
  formatRocketBetaEntryDeadline,
} from "@/lib/rocket-beta-config";
import { verifyRocketFinalResult } from "@/lib/rocket-finalization-core";
import { buildRocketFinalRecap } from "@/lib/rocket-customer-journey";
import {
  CheckCircleIcon,
  GolfFlagIcon,
  MapPinIcon,
  ShieldIcon,
  TargetIcon,
  TicketIcon,
  UsersIcon,
} from "@/components/icons";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const [tournament, user, campaign] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: ROCKET_BETA_TOURNAMENT_ID },
      include: { _count: { select: { players: true, teams: true } } },
    }),
    getCurrentUser(),
    prisma.rocketBetaCampaign.findUnique({
      where: { tournamentId: ROCKET_BETA_TOURNAMENT_ID },
      select: {
        finalizedAt: true,
        results: true,
        resultsHash: true,
      },
    }),
  ]);
  const beta = user ? await getRocketBetaStateForUser(user) : null;

  if (!tournament) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-20 text-center">
        <h1 className="text-3xl font-black text-[#0a3d2a]">Fantasy Golf</h1>
        <p className="mt-3 text-zinc-500">The next test flight is being prepared.</p>
      </main>
    );
  }

  const finalVerification = campaign?.finalizedAt
    ? verifyRocketFinalResult({
        value: campaign.results,
        expectedHash: campaign.resultsHash,
        expectedTournamentId: tournament.id,
      })
    : null;
  const resultIsFinal = finalVerification?.ok === true;
  const finalIntegrityFailed = Boolean(
    campaign?.finalizedAt && !finalVerification?.ok,
  );
  const finalRecap = finalVerification?.ok
    ? buildRocketFinalRecap(finalVerification.result, beta?.teamId)
    : null;
  const personalFinal = finalRecap?.personalTeam ?? null;
  const eventComplete = tournament.status === "completed";

  const primaryHref =
    eventComplete && personalFinal
      ? `/tournaments/rocket-classic/teams/${personalFinal.teamId}`
      : eventComplete && resultIsFinal
        ? "/tournaments/rocket-classic/leaderboard"
        : eventComplete
          ? "/tournaments/rocket-classic"
    : beta?.passState === "REDEEMED" && beta.teamId
      ? `/tournaments/rocket-classic/teams/${beta.teamId}`
      : beta?.passState === "UNLOCKED" && beta.fieldReady
        ? beta.enterHref
        : beta?.passState === "UNLOCKED"
          ? beta.tournamentHref
        : beta?.approved
          ? beta.targetHref
          : "/target";
  const primaryLabel =
    eventComplete && personalFinal
      ? "View my final recap"
      : eventComplete && resultIsFinal
        ? "See the final leaderboard"
        : eventComplete
          ? "View result status"
    : beta?.passState === "REDEEMED"
      ? "View my Rocket team"
      : beta?.passState === "UNLOCKED"
        ? beta.fieldReady && tournament._count.players > 0
          ? "Build my Rocket team"
          : "View field review"
        : beta?.approved
          ? "Start Target"
          : "Join the free test flight";
  const targetComplete = beta?.passState === "UNLOCKED" || beta?.passState === "REDEEMED";
  const teamComplete = beta?.passState === "REDEEMED";

  return (
    <div className="bg-[#f6f4ee] dark:bg-[#0d0f0e]">
      <section className="relative overflow-hidden bg-[#071f16] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_16%,rgba(221,199,127,.24),transparent_25%),radial-gradient(circle_at_13%_90%,rgba(76,155,103,.32),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e4cc85]/30 bg-[#e4cc85]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#f0d986]">
              <ShieldIcon className="h-3.5 w-3.5" />{" "}
              {eventComplete
                ? resultIsFinal
                  ? "Final test result · sealed"
                  : "Test flight complete · result check"
                : "Free test flight · Detroit"}
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
              {eventComplete ? (
                personalFinal ? (
                  <>
                    Your team finished
                    <br />
                    {finalRecap?.personalPlacement}.
                  </>
                ) : (
                  <>
                    The first test flight
                    <br />
                    is complete.
                  </>
                )
              ) : (
                <>
                  Read the target.
                  <br />
                  Build the team.
                </>
              )}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
              {eventComplete
                ? personalFinal
                  ? `${personalFinal.teamName} closed at ${finalRecap?.personalScore} across 20 scored rounds. The sealed leaderboard is now your permanent event record.`
                  : resultIsFinal
                    ? `${finalRecap?.teamCount} teams completed the Rocket Classic beta. See the sealed result, then learn how the next test flight will work.`
                    : "The Rocket Classic beta has ended. The final result is temporarily hidden while its sealed record is checked."
                : "Join with Google, complete three Target decisions, unlock one account-bound Test Pass and choose a five-player Rocket Classic team for the full live test flight."}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={primaryHref}
                className="rounded-xl bg-[#c8a951] px-5 py-3 text-sm font-black text-[#17251d] transition hover:bg-[#ddc77f]"
              >
                {primaryLabel} →
              </Link>
              <Link
                href={
                  eventComplete
                    ? personalFinal
                      ? "/tournaments/rocket-classic/leaderboard"
                      : "/next-event"
                    : "/tournaments/rocket-classic"
                }
                className="rounded-xl border border-white/20 bg-white/8 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
              >
                {eventComplete
                  ? personalFinal
                    ? "Final leaderboard"
                    : "Prepare for the next test"
                  : "Rocket Classic hub"}
              </Link>
            </div>
            <p className="mt-4 text-xs font-semibold text-white/45">
              {eventComplete
                ? resultIsFinal
                  ? `Result ${campaign?.resultsHash?.slice(0, 12)} · no payment · no cash value · no prize`
                  : "Result verification in progress · no payment · no cash value · no prize"
                : "Open to signed-up users · no payment · no cash value · no prize"}
            </p>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/12 bg-white/8 backdrop-blur">
            <div className="relative h-40 sm:h-44">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/courses/detroit-gc.jpg"
                alt="Artistic aerial impression of Detroit Golf Club"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#071f16] via-[#071f16]/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-5">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#e4cc85]">
                  {eventComplete
                    ? "Rocket Classic · final"
                    : "Rocket Classic · Detroit"}
                </p>
                <h2 className="mt-1 text-2xl font-black">{tournament.name}</h2>
              </div>
            </div>
            <div className="p-5 sm:p-6">
              <p className="inline-flex items-center gap-2 text-sm text-white/65">
                <MapPinIcon className="h-4 w-4 text-[#d7bc6a]" />
                Detroit Golf Club · Detroit, Michigan
              </p>
              <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
                <EventFact label="Dates" value="30 Jul–2 Aug" />
                {eventComplete && finalRecap ? (
                  <>
                    <EventFact
                      label="Winner"
                      value={`${finalRecap.winners[0]?.teamName ?? "Finalists"} · ${finalRecap.winnerScore}`}
                    />
                    <EventFact label="Teams" value={`${finalRecap.teamCount} complete`} />
                    <EventFact label="Status" value="Final result sealed" />
                  </>
                ) : (
                  <>
                    <EventFact label="Course" value="7,328 yds" />
                    <EventFact label="Par" value="70" />
                    <EventFact
                      label="Team lock"
                      value={formatRocketBetaEntryDeadline({
                        closesAt: ROCKET_BETA_ENTRY_CLOSES_AT,
                        confirmed: ROCKET_BETA_ENTRY_DEADLINE_CONFIRMED,
                      })}
                    />
                  </>
                )}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        {finalIntegrityFailed && (
          <section className="mb-8 rounded-2xl border border-red-300 bg-red-50 p-5 text-red-950 dark:border-red-900/60 dark:bg-red-950/20 dark:text-red-200">
            <p className="text-sm font-black">Final result verification unavailable</p>
            <p className="mt-1 text-xs leading-5">
              Winner and position details are hidden because the stored result
              did not reproduce its sealed hash. Operations review is required.
            </p>
          </section>
        )}
        {beta?.approved && (
          <section className="mb-8 overflow-hidden rounded-3xl border border-[#c8a951]/40 bg-white shadow-sm dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0a3d2a] p-5 text-white sm:p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#e4cc85]">
                  {eventComplete ? "Your final result" : "Your beta status"}
                </p>
                <h2 className="mt-2 text-xl font-black">
                  {eventComplete && personalFinal
                    ? `${personalFinal.teamName} · ${finalRecap?.personalScore}`
                    : eventComplete
                      ? resultIsFinal
                        ? "Test flight complete"
                        : "Final result being checked"
                      : teamComplete
                        ? "Team confirmed"
                        : targetComplete
                          ? "Test Pass unlocked"
                          : "Target ready"}
                </h2>
              </div>
              <Link
                href={primaryHref}
                className="rounded-xl bg-[#c8a951] px-4 py-2.5 text-sm font-black text-[#17251d]"
              >
                {eventComplete ? "Open recap →" : "Continue →"}
              </Link>
            </div>
            <div className="grid gap-px bg-zinc-100 dark:bg-zinc-800 sm:grid-cols-3">
              <StatusStep
                number="1"
                title="Complete Target"
                detail={targetComplete ? "Locked to your account" : "Three decisions · 20 minutes"}
                complete={targetComplete}
              />
              <StatusStep
                number="2"
                title={eventComplete ? "Confirm team" : "Use Test Pass"}
                detail={teamComplete ? "Five golfers confirmed" : targetComplete ? "Ready for Rocket" : "Unlocks after Target"}
                complete={teamComplete}
              />
              <StatusStep
                number="3"
                title={eventComplete ? "Final result" : "Follow live"}
                detail={
                  eventComplete
                    ? resultIsFinal
                      ? `${finalRecap?.personalPlacement ?? "Leaderboard"} · sealed`
                      : "Verification in progress"
                    : teamComplete
                      ? "Team and standing ready"
                      : "Starts after team confirmation"
                }
                complete={eventComplete && resultIsFinal}
              />
            </div>
          </section>
        )}

        <section>
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
              {eventComplete ? "What the beta proved" : "The test-flight journey"}
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
              {eventComplete
                ? "One complete route from judgement to a sealed result"
                : "One smooth route from judgement to live golf"}
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <JourneyCard
              icon={<TargetIcon className="h-6 w-6" />}
              number="01"
              title={eventComplete ? "Target unlocked entry" : "Place three targets"}
              text={
                eventComplete
                  ? "Three course decisions unlocked one account-bound Test Pass without payment or prize mechanics."
                  : "Use each supplied golfer profile and course situation to place the best expected finish centre. Completion—not score—unlocks beta access."
              }
            />
            <JourneyCard
              icon={<TicketIcon className="h-6 w-6" />}
              number="02"
              title={eventComplete ? "Each pass became one team" : "Receive one Test Pass"}
              text={
                eventComplete
                  ? "Every redeemed pass stayed bound to one verified account and one five-player team through finalisation."
                  : "The pass is created atomically against the same verified account. It cannot be transferred, copied or used twice."
              }
            />
            <JourneyCard
              icon={<UsersIcon className="h-6 w-6" />}
              number="03"
              title={eventComplete ? "Every team reached 20/20" : "Choose five golfers"}
              text={
                eventComplete
                  ? "Cut, withdrawal and non-starter rules completed every team before the winner was sealed."
                  : "Pick one player from each frozen tier, confirm the team before lock and follow its standing through all four rounds."
              }
            />
          </div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-3xl bg-[#0a3d2a] p-6 text-white sm:p-8">
            <GolfFlagIcon className="h-9 w-9 text-[#d7bc6a]" />
            <h2 className="mt-5 text-2xl font-black">
              {eventComplete ? "Result integrity" : "Rocket field preparation"}
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/68">
              {eventComplete
                ? "The public final now comes from one verified sealed manifest. All 15 teams have 20 scored rounds, and mutable live rows cannot rewrite the result."
                : "The full field and all five tiers are reviewed as one frozen snapshot before team entry opens. Withdrawals, the cut and final scoring then follow one published beta rule set."}
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/10 px-3 py-1.5">
                {eventComplete && finalRecap
                  ? `${finalRecap.teamCount} complete teams`
                  : tournament._count.players > 0
                  ? `${tournament._count.players} players staged`
                  : "Field staging in progress"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">
                {eventComplete && campaign?.resultsHash
                  ? `Result ${campaign.resultsHash.slice(0, 12)}`
                  : `${tournament._count.teams} confirmed team${tournament._count.teams === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <CheckCircleIcon className="h-9 w-9 text-[#0a3d2a] dark:text-green-400" />
            <h2 className="mt-5 text-xl font-black text-zinc-900 dark:text-white">
              {eventComplete ? "What happens next" : "What this beta proves"}
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {eventComplete ? (
                <>
                  <li>Use the first-flight feedback to simplify onboarding</li>
                  <li>Keep the five-tier mobile builder for the next field</li>
                  <li>Notify players clearly about field and score changes</li>
                  <li>Open the next test only when its event lifecycle is ready</li>
                </>
              ) : (
                <>
                  <li>Open verified-account registration</li>
                  <li>One Target, one Test Pass, one team</li>
                  <li>Mobile team selection and confirmation</li>
                  <li>Live provisional standings and final result</li>
                </>
              )}
            </ul>
            {eventComplete && (
              <Link
                href="/next-event"
                className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#0a3d2a] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#174f39]"
              >
                Prepare for the next test →
              </Link>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

function EventFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-white/40">{label}</dt>
      <dd className="mt-1 text-sm font-black text-white">{value}</dd>
    </div>
  );
}

function StatusStep({
  number,
  title,
  detail,
  complete,
}: {
  number: string;
  title: string;
  detail: string;
  complete: boolean;
}) {
  return (
    <div className="bg-white p-5 dark:bg-zinc-900">
      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black ${complete ? "bg-[#0a3d2a] text-white" : "bg-[#c8a951]/20 text-[#7a5e16]"}`}>
        {complete ? "✓" : number}
      </span>
      <p className="mt-3 font-black text-zinc-900 dark:text-white">{title}</p>
      <p className="mt-1 text-xs leading-5 text-zinc-500">{detail}</p>
    </div>
  );
}

function JourneyCard({
  icon,
  number,
  title,
  text,
}: {
  icon: React.ReactNode;
  number: string;
  title: string;
  text: string;
}) {
  return (
    <article className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between">
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0a3d2a] text-[#e4cc85]">
          {icon}
        </span>
        <span className="font-mono text-xs font-black text-zinc-300 dark:text-zinc-700">{number}</span>
      </div>
      <h3 className="mt-5 text-xl font-black text-zinc-900 dark:text-white">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">{text}</p>
    </article>
  );
}
