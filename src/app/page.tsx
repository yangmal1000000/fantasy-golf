import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import {
  ROCKET_BETA_ENTRY_CLOSES_AT,
  ROCKET_BETA_TOURNAMENT_ID,
  getRocketBetaStateForUser,
} from "@/lib/rocket-beta";
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
  const [tournament, user] = await Promise.all([
    prisma.tournament.findUnique({
      where: { id: ROCKET_BETA_TOURNAMENT_ID },
      include: { _count: { select: { players: true, teams: true } } },
    }),
    getCurrentUser(),
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

  const primaryHref =
    beta?.passState === "REDEEMED" && beta.teamId
      ? `/tournaments/rocket-classic/teams/${beta.teamId}`
      : beta?.passState === "UNLOCKED" && beta.fieldReady
        ? beta.enterHref
        : beta?.passState === "UNLOCKED"
          ? beta.tournamentHref
        : beta?.approved
          ? beta.targetHref
          : beta?.tournamentHref ?? "/tournaments/rocket-classic";
  const primaryLabel =
    beta?.passState === "REDEEMED"
      ? "View my Rocket team"
      : beta?.passState === "UNLOCKED"
        ? beta.fieldReady && tournament._count.players > 0
          ? "Build my Rocket team"
          : "View field review"
        : beta?.approved
          ? "Start Target"
          : "View the test flight";
  const targetComplete = beta?.passState === "UNLOCKED" || beta?.passState === "REDEEMED";
  const teamComplete = beta?.passState === "REDEEMED";

  return (
    <div className="bg-[#f6f4ee] dark:bg-[#0d0f0e]">
      <section className="relative overflow-hidden bg-[#071f16] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_16%,rgba(221,199,127,.24),transparent_25%),radial-gradient(circle_at_13%_90%,rgba(76,155,103,.32),transparent_30%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:py-20 lg:grid-cols-[1.2fr_.8fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e4cc85]/30 bg-[#e4cc85]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#f0d986]">
              <ShieldIcon className="h-3.5 w-3.5" /> Closed test flight · Detroit
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
              Read the target.
              <br />
              Build the team.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/68 sm:text-lg">
              Invited testers complete three Target decisions, unlock one
              account-bound Test Pass and choose a five-player Rocket Classic
              team for the full live rehearsal.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                href={primaryHref}
                className="rounded-xl bg-[#c8a951] px-5 py-3 text-sm font-black text-[#17251d] transition hover:bg-[#ddc77f]"
              >
                {primaryLabel} →
              </Link>
              <Link
                href="/tournaments/rocket-classic"
                className="rounded-xl border border-white/20 bg-white/8 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
              >
                Rocket Classic hub
              </Link>
            </div>
            <p className="mt-4 text-xs font-semibold text-white/45">
              Invitation only · no payment · no cash value · no prize
            </p>
          </div>

          <div className="rounded-3xl border border-white/12 bg-white/8 p-5 backdrop-blur sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#e4cc85]">
              Event brief
            </p>
            <h2 className="mt-3 text-2xl font-black">{tournament.name}</h2>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-white/65">
              <MapPinIcon className="h-4 w-4 text-[#d7bc6a]" />
              Detroit Golf Club · Detroit, Michigan
            </p>
            <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
              <EventFact label="Dates" value="30 Jul–2 Aug" />
              <EventFact label="Course" value="7,328 yds" />
              <EventFact label="Par" value="70" />
              <EventFact
                label="Team lock"
                value={ROCKET_BETA_ENTRY_CLOSES_AT.toLocaleString("en-GB", {
                  timeZone: "Europe/London",
                  weekday: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              />
            </dl>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        {beta?.approved && (
          <section className="mb-8 overflow-hidden rounded-3xl border border-[#c8a951]/40 bg-white shadow-sm dark:bg-zinc-900">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-[#0a3d2a] p-5 text-white sm:p-6">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#e4cc85]">
                  Your beta status
                </p>
                <h2 className="mt-2 text-xl font-black">
                  {teamComplete
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
                Continue →
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
                title="Use Test Pass"
                detail={teamComplete ? "Redeemed once" : targetComplete ? "Ready for Rocket" : "Unlocks after Target"}
                complete={teamComplete}
              />
              <StatusStep
                number="3"
                title="Follow live"
                detail={teamComplete ? "Team and standing ready" : "Starts after team confirmation"}
                complete={false}
              />
            </div>
          </section>
        )}

        <section>
          <div className="max-w-2xl">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
              The rehearsal journey
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
              One smooth route from judgement to live golf
            </h2>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <JourneyCard
              icon={<TargetIcon className="h-6 w-6" />}
              number="01"
              title="Place three targets"
              text="Read each supplied golf situation and place the intended landing centre. Completion—not score—unlocks beta access."
            />
            <JourneyCard
              icon={<TicketIcon className="h-6 w-6" />}
              number="02"
              title="Receive one Test Pass"
              text="The pass is created atomically against the same approved account. It cannot be transferred, copied or used twice."
            />
            <JourneyCard
              icon={<UsersIcon className="h-6 w-6" />}
              number="03"
              title="Choose five golfers"
              text="Pick one player from each frozen tier, confirm the team before lock and follow its standing through all four rounds."
            />
          </div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.15fr_.85fr]">
          <div className="rounded-3xl bg-[#0a3d2a] p-6 text-white sm:p-8">
            <GolfFlagIcon className="h-9 w-9 text-[#d7bc6a]" />
            <h2 className="mt-5 text-2xl font-black">Rocket field preparation</h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/68">
              The full field and all five tiers are reviewed as one frozen
              snapshot before team entry opens. Withdrawals, the cut and final
              scoring then follow one published beta rule set.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold">
              <span className="rounded-full bg-white/10 px-3 py-1.5">
                {tournament._count.players > 0
                  ? `${tournament._count.players} players staged`
                  : "Field staging in progress"}
              </span>
              <span className="rounded-full bg-white/10 px-3 py-1.5">
                {tournament._count.teams} confirmed team{tournament._count.teams === 1 ? "" : "s"}
              </span>
            </div>
          </div>
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <CheckCircleIcon className="h-9 w-9 text-[#0a3d2a] dark:text-green-400" />
            <h2 className="mt-5 text-xl font-black text-zinc-900 dark:text-white">
              What this beta proves
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              <li>Verified invited-account access</li>
              <li>One Target, one Test Pass, one team</li>
              <li>Mobile team selection and confirmation</li>
              <li>Live provisional standings and final result</li>
            </ul>
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
