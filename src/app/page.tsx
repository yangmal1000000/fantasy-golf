import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { formatGBP, formatDateRange, STATUS_CONFIG, courseImage } from "@/lib/ui";
import CountdownTimer from "@/components/CountdownTimer";
import { TrophyIcon, MapPinIcon, UsersIcon, PoundIcon, FlagIcon } from "@/components/icons";

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
      {/* ===== Hero — Compact dashboard header ===== */}
      <section className="relative overflow-hidden bg-[#0a3d2a] py-6 sm:py-8">
        <div className="absolute inset-0 opacity-20">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/hero-main.jpg" alt="" className="h-full w-full object-cover" />
        </div>
        <div className="relative mx-auto max-w-5xl px-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#c8a951]">Major Sweepstake</p>
          <h1 className="mt-1 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">Fantasy Golf</h1>
          <p className="mt-1 text-sm text-white/80">Pick 5 pros. Pay £15. Beat your mates.</p>
          <div className="mt-3 flex gap-2">
            {tournament && (
              <Link href={`/tournaments/${tournament.id}/enter`} className="rounded-lg bg-[#c8a951] px-5 py-2 text-sm font-bold text-[#1a1a1a] transition hover:bg-[#d4b76a]">Build Your Team →</Link>
            )}
            <Link href="/tournaments" className="rounded-lg bg-white/10 px-4 py-2 text-sm font-semibold text-white border border-white/20 transition hover:bg-white/20">Browse</Link>
          </div>
        </div>
      </section>

      {/* ===== Trust Bar — Inline ===== */}
      <section className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#1a1d1c] py-2">
        <div className="mx-auto flex max-w-5xl items-center justify-center gap-4 px-4 text-xs font-medium text-zinc-500">
          <span className="inline-flex items-center gap-1"><TrophyIcon className="h-3 w-3 text-[#c8a951]" />1,000+ Players</span>
          <span className="text-zinc-300">·</span>
          <span className="inline-flex items-center gap-1"><PoundIcon className="h-3 w-3 text-[#c8a951]" />£25k+ Pots</span>
          <span className="text-zinc-300">·</span>
          <span className="inline-flex items-center gap-1"><FlagIcon className="h-3 w-3 text-[#c8a951]" />15 Events</span>
        </div>
      </section>

      {/* ===== Live Tournament Widget ===== */}
      {liveTournament && (
        <section className="mx-auto mt-6 w-full max-w-5xl px-4 sm:mt-8">
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
        <section className="mx-auto mt-4 w-full max-w-5xl px-4 sm:mt-6">
          <div className="flex items-center gap-3 rounded-2xl border border-[#c8a951]/20 bg-gradient-to-r from-[#c8a951]/10 to-transparent p-4 shadow-sm dark:border-[#c8a951]/15">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#c8a951]">
              <TrophyIcon className="h-5 w-5 text-[#1a1a1a]" />
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

      {/* ===== How It Works — Compact inline ===== */}
      <section className="mx-auto w-full max-w-5xl px-4 py-6 sm:py-8">
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-center">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#0a3d2a]">
              <UsersIcon className="h-4 w-4 text-white" />
            </div>
            <h3 className="mt-2 text-xs font-bold text-[#0a3d2a] dark:text-green-400 sm:text-sm">Pick 5</h3>
            <p className="mt-1 text-[11px] text-zinc-500">One from each tier</p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-center">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#c8a951]">
              <PoundIcon className="h-4 w-4 text-[#1a1a1a]" />
            </div>
            <h3 className="mt-2 text-xs font-bold text-[#0a3d2a] dark:text-green-400 sm:text-sm">Pay £15</h3>
            <p className="mt-1 text-[11px] text-zinc-500">Winner takes all</p>
          </div>
          <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3 text-center">
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full bg-[#1a5c3e]">
              <TrophyIcon className="h-4 w-4 text-white" />
            </div>
            <h3 className="mt-2 text-xs font-bold text-[#0a3d2a] dark:text-green-400 sm:text-sm">Win</h3>
            <p className="mt-1 text-[11px] text-zinc-500">Lowest score wins</p>
          </div>
        </div>
      </section>

      {/* ===== Featured Tournament — Compact ===== */}
      {tournament && (
        <section className="mx-auto w-full max-w-5xl px-4 pb-6 sm:pb-8">
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden">
            <div className="relative h-28 overflow-hidden sm:h-36">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={courseImage(tournament.id)} alt={tournament.course || tournament.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a3d2a]/90 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                <div className="flex items-center justify-between">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${statusInfo?.badgeClass}`}>{statusInfo?.label}</span>
                  <span className="text-[11px] text-white/80 tabular">Par {tournament.par}</span>
                </div>
                <h3 className="mt-1 text-base font-bold sm:text-lg">{tournament.name}</h3>
                <p className="text-[11px] text-white/90">{tournament.course} · {formatDateRange(tournament.startDate, tournament.endDate)}</p>
              </div>
            </div>
            <div className="flex items-center justify-between p-3">
              <div className="flex items-center gap-4 text-xs">
                <span className="inline-flex items-center gap-1"><UsersIcon className="h-3 w-3 text-zinc-400" /><span className="font-bold tabular">{tournament._count.teams}</span><span className="text-zinc-400">teams</span></span>
                <span className="inline-flex items-center gap-1"><PoundIcon className="h-3 w-3 text-[#c8a951]" /><span className="font-bold tabular text-[#c8a951]">{formatGBP(tournament.entryFee)}</span></span>
                <span className="text-zinc-400 tabular">{tournament._count.players} players</span>
              </div>
              <Link href={`/tournaments/${tournament.id}/enter`} className="rounded-lg bg-[#0a3d2a] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#1a5c3e]">Enter →</Link>
            </div>
            {(tournament.status === "entries_open" || tournament.status === "upcoming") && (
              <div className="border-t border-zinc-100 dark:border-zinc-800 px-3 py-2"><CountdownTimer startDate={tournament.startDate} /></div>
            )}
          </div>
        </section>
      )}

      {/* ===== Upcoming Tournaments — Compact list ===== */}
      {upcomingTournaments.length > 0 && (
        <section className="mx-auto w-full max-w-5xl px-4 pb-6 sm:pb-8">
          <h2 className="mb-2 text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">Coming Up</h2>
          <div className="space-y-1">
            {upcomingTournaments.map((t) => (
              <Link key={t.id} href={`/tournaments/${t.id}/enter`} className="group flex items-center gap-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2 py-1.5 transition hover:border-zinc-300 dark:hover:border-zinc-700">
                <div className="h-[48px] w-[48px] shrink-0 overflow-hidden rounded-md">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={courseImage(t.id)} alt={t.course || t.name} loading="lazy" className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-bold text-zinc-900 dark:text-white">{t.name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-zinc-500">
                    <span className="truncate">{t.course ?? "TBD"}</span>
                    <span className="text-zinc-300">·</span>
                    <span className="whitespace-nowrap tabular">{formatDateRange(t.startDate, t.endDate)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] font-bold tabular text-[#c8a951]">{formatGBP(t.entryFee)}</p>
                  <p className="text-[10px] text-zinc-400 tabular">{t._count.teams} teams</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ===== Social Proof — Compact testimonials ===== */}
      <section className="bg-[#f3f1ee] py-6 dark:bg-[#252827] sm:py-8">
        <div className="mx-auto max-w-5xl px-4">
          <h2 className="mb-3 text-sm font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wide">What Players Say</h2>
          <div className="grid gap-2 sm:gap-3 sm:grid-cols-3">
            <Testimonial
              quote="Won £900 at The Masters! Best £15 I ever spent."
              name="James M."
              detail="Major Champion Winner"
            />
            <Testimonial
              quote="Our office runs a league every major. 20+ guys picking teams. Brilliant format."
              name="Sarah T."
              detail="League Commissioner, 12 members"
            />
            <Testimonial
              quote="The tier system is genius. You need real strategy with your long shots."
              name="David K."
              detail="3x podium finishes"
            />
          </div>
        </div>
      </section>

      {/* ===== Final CTA — Compact ===== */}
      <section className="bg-gradient-to-r from-[#0a3d2a] to-[#1a5c3e] py-8 text-center text-white sm:py-10">
        <div className="mx-auto max-w-2xl px-4">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Ready to play?</h2>
          <p className="mt-1 text-sm text-white/80">Build your dream team and compete for the prize pot.</p>
          <Link href="/tournaments" className="mt-4 inline-block rounded-lg bg-[#c8a951] px-8 py-2.5 text-sm font-bold text-[#1a1a1a] transition hover:bg-[#d4b76a]">Get Started →</Link>
        </div>
      </section>

      {/* Footer is rendered globally by RootLayout */}

      {/* JSON-LD structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SportsActivityLocation",
            name: "Fantasy Golf",
            description: "Pick 5 pros across 5 tiers. Pay £15. Beat your mates across all 4 majors.",
            url: "https://fantasy-golf-phi.vercel.app",
            sport: "Golf",
            offers: {
              "@type": "Offer",
              price: "15",
              priceCurrency: "GBP",
              availability: "https://schema.org/InStock",
            },
          }),
        }}
      />
    </div>
  );
}

// ===== Icon components imported from @/components/icons =====
// (TrophyIcon, PoundIcon, FlagIcon, UsersIcon removed — now in icons.tsx)

function Testimonial({ quote, name, detail }: { quote: string; name: string; detail: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white p-3 dark:bg-[#1a1d1c]">
      <div className="mb-1.5 flex gap-0.5 text-[#c8a951]">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        ))}
      </div>
      <blockquote className="text-xs text-[#1a1a1a] dark:text-[#f0f0f0]">&ldquo;{quote}&rdquo;</blockquote>
      <p className="mt-2 text-xs font-bold text-[#0a3d2a] dark:text-[#3da06a]">{name}</p>
      <p className="text-[10px] text-zinc-500">{detail}</p>
    </div>
  );
}
