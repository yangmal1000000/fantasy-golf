import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatGBP, formatDateRange, STATUS_CONFIG, courseImage } from "@/lib/ui";
import CountdownTimer from "@/components/CountdownTimer";
import StatusRibbon from "@/components/StatusRibbon";

export default async function Home() {
  let tournament: {
    id: string;
    name: string;
    course: string | null;
    startDate: Date;
    endDate: Date;
    status: string;
    par: number;
    entryFee: number;
    _count: { teams: number; players: number };
  } | null = null;

  let liveTournament: {
    id: string;
    name: string;
    course: string | null;
    status: string;
    currentRound: number;
    _count: { teams: number };
  } | null = null;

  let upcomingTournaments: {
    id: string;
    name: string;
    course: string | null;
    startDate: Date;
    endDate: Date;
    status: string;
    par: number;
    entryFee: number;
    category: string;
    _count: { teams: number };
  }[] = [];

  let lastCompleted: {
    id: string;
    name: string;
    course: string | null;
    _count: { teams: number };
    entryFee: number;
  } | null = null;

  try {
    tournament = await prisma.tournament.findFirst({
      where: {
        status: { in: ["entries_open", "upcoming"] },
      },
      orderBy: { startDate: "asc" },
      include: {
        _count: { select: { teams: true, players: true } },
      },
    });

    liveTournament = await prisma.tournament.findFirst({
      where: { status: "in_progress" },
      include: {
        _count: { select: { teams: true } },
      },
    });

    upcomingTournaments = (await prisma.tournament.findMany({
      where: {
        status: { in: ["entries_open", "upcoming"] },
        startDate: { gte: new Date() },
      },
      orderBy: { startDate: "asc" },
      take: 4,
      include: {
        _count: { select: { teams: true } },
      },
    })) as typeof upcomingTournaments;

    lastCompleted = await prisma.tournament.findFirst({
      where: { status: "completed" },
      orderBy: { endDate: "desc" },
      include: {
        _count: { select: { teams: true } },
      },
    });
  } catch {
    // DB might not be seeded yet — render with null
  }

  const statusInfo = tournament
    ? STATUS_CONFIG[tournament.status] ?? STATUS_CONFIG.upcoming
    : null;

  return (
    <div className="flex flex-col">
      {/* ===== Hero Section ===== */}
      <section className="relative h-[55vh] min-h-[360px] w-full overflow-hidden sm:h-[60vh] sm:min-h-[400px]">
        <Image
          src="/hero-main.jpg"
          alt="Fantasy Golf"
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-[#0a3d2a]" />
        <div className="absolute inset-0 flex items-center">
          <div className="mx-auto w-full max-w-5xl px-4 text-center text-white">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.3em] text-[#c8a951] sm:mb-3 sm:text-sm">
              The 2026 Major Sweepstake
            </p>
            <h1 className="text-4xl font-extrabold tracking-tight drop-shadow-2xl sm:text-5xl md:text-7xl">
              Fantasy Golf
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-white/90 drop-shadow-lg sm:mt-5 sm:text-lg md:text-xl">
              Pick 5 pros. Pay £15. Beat your mates across all 4 majors.
            </p>
            <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
              {tournament && (
                <Link
                  href={`/tournaments/${tournament.id}/enter`}
                  className="rounded-full bg-[#c8a951] px-8 py-3.5 text-center text-base font-bold text-[#1a1a1a] shadow-xl transition hover:scale-105 hover:bg-[#d4b76a] sm:px-10"
                >
                  Build Your Team →
                </Link>
              )}
              <Link
                href="/how-to-play"
                className="rounded-full border-2 border-white/50 bg-white/5 px-8 py-3 text-center text-base font-semibold text-white backdrop-blur-sm transition hover:bg-white/15"
              >
                How to Play
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ===== Trust Bar ===== */}
      <section className="border-b border-[#e5e2dc] bg-[#ffffff] py-4 dark:border-[#2a2d2c] dark:bg-[#1a1d1c]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-6 gap-y-2 px-4 text-center text-sm font-semibold text-[#6b6b6b] dark:text-[#999999]">
          <span className="inline-flex items-center gap-1.5">
            <TrophyIcon className="h-4 w-4 text-[#c8a951]" />
            1,000+ Players
          </span>
          <span className="text-[#e5e2dc] dark:text-[#2a2d2c]">·</span>
          <span className="inline-flex items-center gap-1.5">
            <PoundIcon className="h-4 w-4 text-[#c8a951]" />
            £25,000+ Prize Pools
          </span>
          <span className="text-[#e5e2dc] dark:text-[#2a2d2c]">·</span>
          <span className="inline-flex items-center gap-1.5">
            <FlagIcon className="h-4 w-4 text-[#c8a951]" />
            15 Tournaments
          </span>
        </div>
      </section>

      {/* ===== Live Tournament Widget ===== */}
      {liveTournament && (
        <section className="mx-auto mt-6 w-full max-w-3xl px-4 sm:mt-8">
          <Link
            href={`/tournaments/${liveTournament.id}/leaderboard`}
            className="flex items-center justify-between rounded-2xl border border-[#c44545]/30 bg-gradient-to-r from-[#c44545]/10 to-transparent p-4 shadow-sm transition card-hover dark:border-[#c44545]/20"
          >
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#c44545] opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-[#c44545]" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wide text-[#c44545]">LIVE NOW</p>
                <p className="text-sm font-bold text-[#1a1a1a] dark:text-[#f0f0f0]">
                  {liveTournament.name}
                </p>
                <p className="text-xs text-[#6b6b6b] dark:text-[#999999]">
                  Round {liveTournament.currentRound} · {liveTournament._count.teams} teams competing
                </p>
              </div>
            </div>
            <span className="shrink-0 text-sm font-bold text-[#0a3d2a] dark:text-[#3da06a]">
              View →
            </span>
          </Link>
        </section>
      )}

      {/* ===== Recent Winner Spotlight ===== */}
      {lastCompleted && (
        <section className="mx-auto mt-4 w-full max-w-3xl px-4 sm:mt-6">
          <div className="flex items-center gap-3 rounded-2xl border border-[#c8a951]/20 bg-gradient-to-r from-[#c8a951]/10 to-transparent p-4 shadow-sm dark:border-[#c8a951]/15">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c8a951] text-lg">
              🏆
            </span>
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-[#6b6b6b] dark:text-[#999999]">
                Last Winner
              </p>
              <p className="truncate text-sm font-bold text-[#1a1a1a] dark:text-[#f0f0f0]">
                {lastCompleted._count.teams} teams entered ·{" "}
                <span className="text-[#c8a951]">
                  {formatGBP(lastCompleted.entryFee * lastCompleted._count.teams)} pot
                </span>{" "}
                at {lastCompleted.name}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ===== How It Works — Refined cards with SVG icons ===== */}
      <section className="mx-auto w-full max-w-5xl px-4 py-10 sm:py-16">
        <h2 className="text-center text-2xl font-bold tracking-tight text-[#0a3d2a] dark:text-[#3da06a] sm:text-3xl">
          How It works
        </h2>
        <div className="mt-8 grid gap-4 sm:gap-6 md:grid-cols-3">
          {/* Step 1 */}
          <div className="rounded-2xl bg-white p-5 text-center shadow-md card-hover dark:bg-[#1a1d1c] sm:p-6"
               style={{ boxShadow: "var(--shadow-md)" }}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#0a3d2a] sm:h-14 sm:w-14">
              <UsersIcon className="h-6 w-6 text-white sm:h-7 sm:w-7" />
            </div>
            <h3 className="mt-3 text-base font-bold tracking-tight text-[#0a3d2a] dark:text-[#3da06a] sm:mt-4 sm:text-lg">
              Pick 5
            </h3>
            <p className="mt-2 text-sm text-[#6b6b6b] dark:text-[#999999]">
              Choose one golfer from each of the 5 tiers. From world #1 to
              long-shot underdogs. Strategy matters — pick wisely.
            </p>
          </div>
          {/* Step 2 */}
          <div className="rounded-2xl bg-white p-5 text-center shadow-md card-hover dark:bg-[#1a1d1c] sm:p-6"
               style={{ boxShadow: "var(--shadow-md)" }}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#c8a951] sm:h-14 sm:w-14">
              <PoundIcon className="h-6 w-6 text-[#1a1a1a] sm:h-7 sm:w-7" />
            </div>
            <h3 className="mt-3 text-base font-bold tracking-tight text-[#0a3d2a] dark:text-[#3da06a] sm:mt-4 sm:text-lg">
              Pay £15
            </h3>
            <p className="mt-2 text-sm text-[#6b6b6b] dark:text-[#999999]">
              {tournament
                ? `${formatGBP(tournament.entryFee)} entry fee per team. The more entries, the bigger the pot.`
                : "£15 entry fee per team. The more entries, the bigger the pot."}
            </p>
          </div>
          {/* Step 3 */}
          <div className="rounded-2xl bg-white p-5 text-center shadow-md card-hover dark:bg-[#1a1d1c] sm:p-6"
               style={{ boxShadow: "var(--shadow-md)" }}>
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#1a5c3e] sm:h-14 sm:w-14">
              <TrophyIcon className="h-6 w-6 text-white sm:h-7 sm:w-7" />
            </div>
            <h3 className="mt-3 text-base font-bold tracking-tight text-[#0a3d2a] dark:text-[#3da06a] sm:mt-4 sm:text-lg">
              Win
            </h3>
            <p className="mt-2 text-sm text-[#6b6b6b] dark:text-[#999999]">
              Lowest combined score wins! If your player misses the cut, you get
              their estimated average. Every shot counts.
            </p>
          </div>
        </div>
      </section>

      {/* ===== Featured Tournament ===== */}
      {tournament && (
        <section className="mx-auto w-full max-w-3xl px-4 pb-10 sm:pb-16">
          <h2 className="mb-4 text-center text-xl font-bold tracking-tight text-[#0a3d2a] dark:text-[#3da06a] sm:mb-6 sm:text-2xl">
            Featured Tournament
          </h2>
          <div className="overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-[#1a1d1c]"
               style={{ boxShadow: "var(--shadow-lg)" }}>
            {/* Course Banner */}
            <div className="relative h-36 overflow-hidden sm:h-48">
              <Image
                src={courseImage(tournament.id)}
                alt={tournament.course || tournament.name}
                fill
                loading="lazy"
                className="object-cover"
                sizes="(max-width: 640px) 100vw, 768px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a3d2a]/90 via-[#0a3d2a]/40 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-4 text-white sm:p-6">
                <div className="flex items-center justify-between">
                  <span
                    className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusInfo?.badgeClass}`}
                  >
                    {statusInfo?.label}
                  </span>
                  <span className="text-xs text-white/80 sm:text-sm tabular">Par {tournament.par}</span>
                </div>
                <h3 className="mt-1.5 text-lg font-bold drop-shadow sm:mt-2 sm:text-2xl">{tournament.name}</h3>
                <p className="mt-0.5 text-xs text-white/90 drop-shadow sm:text-sm">
                  📍 {tournament.course} · {formatDateRange(tournament.startDate, tournament.endDate)}
                </p>
              </div>
            </div>
            {/* Stats */}
            <div className="grid grid-cols-3 divide-x divide-[#e5e2dc] dark:divide-[#2a2d2c] p-4 sm:p-6">
              <div className="text-center">
                <p className="text-xl font-bold tabular text-[#0a3d2a] dark:text-[#3da06a] sm:text-2xl">
                  {tournament._count.players}
                </p>
                <p className="text-xs text-[#6b6b6b] dark:text-[#999999]">Players</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold tabular text-[#c8a951] sm:text-2xl">
                  {tournament._count.teams}
                </p>
                <p className="text-xs text-[#6b6b6b] dark:text-[#999999]">Entries</p>
              </div>
              <div className="text-center">
                <p className="text-xl font-bold tabular text-[#1a5c3e] dark:text-[#3da06a] sm:text-2xl">
                  {formatGBP(tournament.entryFee)}
                </p>
                <p className="text-xs text-[#6b6b6b] dark:text-[#999999]">Entry</p>
              </div>
            </div>
            {/* Countdown timer */}
            {(tournament.status === "entries_open" || tournament.status === "upcoming") && (
              <div className="flex justify-center border-t border-[#e5e2dc] dark:border-[#2a2d2c] px-4 py-3 sm:px-6">
                <CountdownTimer startDate={tournament.startDate} />
              </div>
            )}
            {/* CTA */}
            <div className="border-t border-[#e5e2dc] dark:border-[#2a2d2c] p-4">
              <Link
                href={`/tournaments/${tournament.id}/enter`}
                className="block w-full rounded-xl bg-[#0a3d2a] py-3 text-center font-bold text-white transition hover:bg-[#1a5c3e] touch-target"
              >
                Enter Your Team →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ===== Upcoming Tournaments Strip ===== */}
      {upcomingTournaments.length > 0 && (
        <section className="mx-auto w-full max-w-5xl px-4 pb-10 sm:pb-16">
          <h2 className="mb-4 text-center text-xl font-bold tracking-tight text-[#0a3d2a] dark:text-[#3da06a] sm:mb-6 sm:text-2xl">
            Coming Up
          </h2>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2">
            {upcomingTournaments.map((t) => (
              <Link
                key={t.id}
                href={`/tournaments/${t.id}/enter`}
                className="group min-w-[200px] max-w-[220px] shrink-0 overflow-hidden rounded-2xl bg-white shadow-md card-hover dark:bg-[#1a1d1c]"
                style={{ boxShadow: "var(--shadow-md)" }}
              >
                <div className="relative h-24 overflow-hidden">
                  <Image
                    src={courseImage(t.id)}
                    alt={t.course || t.name}
                    fill
                    loading="lazy"
                    className="object-cover transition group-hover:scale-105"
                    sizes="220px"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0a3d2a]/80 to-transparent" />
                  <p className="absolute bottom-1.5 left-3 right-3 truncate text-sm font-bold text-white">
                    {t.name}
                  </p>
                </div>
                <div className="p-3">
                  <p className="truncate text-xs text-[#6b6b6b] dark:text-[#999999]">
                    {formatDateRange(t.startDate, t.endDate)}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#0a3d2a] dark:text-[#3da06a] tabular">
                      {t._count.teams} teams
                    </span>
                    <span className="text-xs font-bold text-[#c8a951] tabular">
                      {formatGBP(t.entryFee)}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ===== Social Proof — Testimonials ===== */}
      <section className="bg-[#f3f1ee] py-10 dark:bg-[#252827] sm:py-16">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="text-center text-2xl font-bold tracking-tight text-[#0a3d2a] dark:text-[#3da06a] sm:text-3xl">
            What Players Say
          </h2>
          <div className="mt-8 grid gap-4 sm:gap-6 md:grid-cols-3">
            <Testimonial
              quote="Won £900 at The Masters! Best £15 I ever spent. The live leaderboard had me on the edge of my seat all weekend."
              name="James M."
              detail="Masters 2025 Winner"
            />
            <Testimonial
              quote="Our office runs a league every major. 20+ guys all picking teams — the WhatsApp banter is relentless. Brilliant format."
              name="Sarah T."
              detail="League Commissioner, 12 members"
            />
            <Testimonial
              quote="The tier system is genius. You can't just pick the top 5 — you need a real strategy with your long shots."
              name="David K."
              detail="3x podium finishes"
            />
          </div>
        </div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="bg-gradient-to-r from-[#0a3d2a] to-[#1a5c3e] py-12 text-center text-white sm:py-16">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
            Ready to play?
          </h2>
          <p className="mt-2 text-white/80">
            Build your dream team and compete for the prize pot.
          </p>
          <Link
            href="/tournaments"
            className="mt-6 inline-block rounded-full bg-[#c8a951] px-10 py-3.5 text-base font-bold text-[#1a1a1a] shadow-xl transition hover:scale-105 hover:bg-[#d4b76a] touch-target"
          >
            Get Started →
          </Link>
        </div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="bg-[#0a3d2a] py-8 text-center text-sm text-white/50">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs">
            <Link href="/how-to-play" className="transition hover:text-[#c8a951]">How to Play</Link>
            <span className="text-white/20">·</span>
            <Link href="/tournaments" className="transition hover:text-[#c8a951]">Tournaments</Link>
            <span className="text-white/20">·</span>
            <Link href="/leagues" className="transition hover:text-[#c8a951]">Leagues</Link>
            <span className="text-white/20">·</span>
            <a href="mailto:support@fantasygolf.app" className="transition hover:text-[#c8a951]">Contact</a>
          </div>
          <p className="mt-3 text-xs">Fantasy Golf · The Open Championship 2026 · Royal Birkdale</p>
          <p className="mt-1 text-xs text-white/30">For entertainment purposes only. Not affiliated with the R&A, PGA Tour, or DP World Tour.</p>
          <p className="mt-1 text-xs text-white/25">Course images are artistic impressions, not actual photographs.</p>
        </div>
      </footer>
    </div>
  );
}

// ===== Inline SVG Icon Components =====

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
    </svg>
  );
}

function PoundIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m9.758 9.758L19 19M12 4H5a2 2 0 00-2 2v12a2 2 0 002 2h14a2 2 0 002-2v-5m-2-7l-3-3m0 0L17 4m3 3h-3" />
    </svg>
  );
}

function FlagIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 4 3 4h-8.5l-1-1H5a2 2 0 00-2 2z" />
    </svg>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function Testimonial({ quote, name, detail }: { quote: string; name: string; detail: string }) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-md dark:bg-[#1a1d1c]"
         style={{ boxShadow: "var(--shadow-md)" }}>
      <div className="mb-2 flex gap-0.5 text-[#c8a951]">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <blockquote className="text-sm text-[#1a1a1a] dark:text-[#f0f0f0]">
        &ldquo;{quote}&rdquo;
      </blockquote>
      <p className="mt-3 text-sm font-bold text-[#0a3d2a] dark:text-[#3da06a]">{name}</p>
      <p className="text-xs text-[#6b6b6b] dark:text-[#999999]">{detail}</p>
    </div>
  );
}
