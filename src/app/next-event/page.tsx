import type { Metadata } from "next";
import Link from "next/link";
import NextEventNotificationOptIn from "@/components/NextEventNotificationOptIn";
import {
  CheckCircleIcon,
  GolfFlagIcon,
  ShieldIcon,
  TargetIcon,
  TicketIcon,
  UsersIcon,
} from "@/components/icons";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Next Test Flight — Fantasy Golf",
  description:
    "Prepare your Fantasy Golf account and browser for the next free test flight without guessing its event or dates.",
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NextEventPage() {
  const user = await getCurrentUser();

  return (
    <div className="bg-[#f6f4ee] dark:bg-[#0d0f0e]">
      <section className="relative overflow-hidden bg-[#071f16] text-white">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_82%_10%,rgba(221,199,127,.22),transparent_28%),radial-gradient(circle_at_8%_90%,rgba(76,155,103,.3),transparent_32%)]" />
        <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:py-18 lg:grid-cols-[1.12fr_.88fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#e4cc85]/30 bg-[#e4cc85]/10 px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.2em] text-[#f0d986]">
              <ShieldIcon className="h-3.5 w-3.5" /> Next test flight · preparing
            </div>
            <h1 className="mt-5 max-w-3xl text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl">
              Be ready when the
              <br />
              next field opens.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 sm:text-lg">
              The event, course and dates have not been announced. Prepare your
              account now, choose whether this browser may alert you, and see
              the exact path into the next five-player team.
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="#get-ready"
                className="rounded-xl bg-[#c8a951] px-5 py-3 text-sm font-black text-[#17251d] transition hover:bg-[#ddc77f]"
              >
                Get ready →
              </a>
              <Link
                href="/tournaments/rocket-classic/leaderboard"
                className="rounded-xl border border-white/20 bg-white/8 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/15"
              >
                See the sealed first result
              </Link>
            </div>
            <p className="mt-4 text-xs font-semibold text-white/45">
              No event entry is open · no payment requested · alerts are optional
            </p>
          </div>

          <div className="rounded-3xl border border-white/12 bg-white/8 p-5 backdrop-blur sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#e4cc85]">
              Honest event preview
            </p>
            <h2 className="mt-2 text-2xl font-black">Announcement pending</h2>
            <dl className="mt-5 grid grid-cols-2 gap-4 border-t border-white/10 pt-5">
              <PreviewFact label="Event" value="To be announced" />
              <PreviewFact label="Dates" value="Not confirmed" />
              <PreviewFact label="Field" value="Published before entry" />
              <PreviewFact label="Status" value="Lifecycle checks first" />
            </dl>
            <p className="mt-5 rounded-2xl bg-black/15 p-4 text-xs leading-5 text-white/62">
              Team entry will stay closed until the event identity, official
              field, rules and lock time are ready to publish together.
            </p>
          </div>
        </div>
      </section>

      <main id="get-ready" className="mx-auto max-w-6xl px-4 py-10 sm:py-14">
        <section className="grid gap-5 lg:grid-cols-[.92fr_1.08fr]">
          <NextEventNotificationOptIn />
          <div className="rounded-3xl bg-[#0a3d2a] p-5 text-white sm:p-6">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#e4cc85]">
              Your readiness
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {user ? "Your account is ready" : "Start with one account"}
            </h2>
            <p className="mt-2 text-sm leading-6 text-white/68">
              {user
                ? "You are signed in. Event alerts are optional; Target and team entry will appear only when the next test actually opens."
                : "Use one Google sign-in so Target progress, a Test Pass and the final team all stay bound to the same account."}
            </p>
            <div className="mt-5 grid gap-2">
              <ReadinessRow
                complete={Boolean(user)}
                title="Fantasy Golf account"
                detail={user ? "Signed in and ready" : "Sign in from the alert card"}
              />
              <ReadinessRow
                complete={false}
                title="Next Target"
                detail="Appears only when a real event opens"
              />
              <ReadinessRow
                complete={false}
                title="Five-player team"
                detail="Unlocks after Target and field publication"
              />
            </div>
          </div>
        </section>

        <section className="mt-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
            The next journey
          </p>
          <h2 className="mt-2 max-w-2xl text-3xl font-black tracking-tight text-zinc-900 dark:text-white">
            Four clear steps, unlocked in order
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <JourneyStep
              number="01"
              icon={<ShieldIcon className="h-6 w-6" />}
              title="Confirm the event"
              text="We publish the event, dates, field status and lock rule together—never as placeholders."
            />
            <JourneyStep
              number="02"
              icon={<TargetIcon className="h-6 w-6" />}
              title="Complete Target"
              text="Make three course-strategy decisions. Completion unlocks one account-bound Test Pass."
            />
            <JourneyStep
              number="03"
              icon={<TicketIcon className="h-6 w-6" />}
              title="Use one Test Pass"
              text="The pass opens the frozen field and one pick from each of five clear tiers."
            />
            <JourneyStep
              number="04"
              icon={<UsersIcon className="h-6 w-6" />}
              title="Save and follow"
              text="Review the five golfers, save once, then follow provisional scoring through a sealed final."
            />
          </div>
        </section>

        <section className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900 sm:p-8">
            <GolfFlagIcon className="h-9 w-9 text-[#0a3d2a] dark:text-green-400" />
            <h2 className="mt-5 text-2xl font-black text-zinc-900 dark:text-white">
              What we will publish before entry
            </h2>
            <ul className="mt-4 space-y-3 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              <li>Confirmed event identity, course and playing dates</li>
              <li>Official field status and five frozen selection tiers</li>
              <li>Exact entry close and first-tee lock rule</li>
              <li>Withdrawal, cut, DQ and finalisation scoring policy</li>
            </ul>
          </div>
          <div className="rounded-3xl bg-[#0a3d2a] p-6 text-white sm:p-8">
            <CheckCircleIcon className="h-9 w-9 text-[#e4cc85]" />
            <h2 className="mt-5 text-2xl font-black">Learn the game now</h2>
            <p className="mt-2 text-sm leading-6 text-white/68">
              See the five-tier format, scoring rules and mobile team flow
              without entering an event or changing your account.
            </p>
            <Link
              href="/how-to-play"
              className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-[#c8a951] px-4 py-2.5 text-sm font-black text-[#17251d]"
            >
              How Fantasy Golf works →
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

function PreviewFact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wide text-white/40">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-black text-white">{value}</dd>
    </div>
  );
}

function ReadinessRow({
  complete,
  title,
  detail,
}: {
  complete: boolean;
  title: string;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/8 px-3 py-3">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-black ${
          complete ? "bg-[#c8a951] text-[#17251d]" : "bg-white/10 text-white/45"
        }`}
      >
        {complete ? "✓" : "—"}
      </span>
      <div>
        <p className="text-sm font-black">{title}</p>
        <p className="mt-0.5 text-xs text-white/55">{detail}</p>
      </div>
    </div>
  );
}

function JourneyStep({
  number,
  icon,
  title,
  text,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <article className="relative rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <span className="absolute right-5 top-5 text-xs font-black text-zinc-300 dark:text-zinc-700">
        {number}
      </span>
      <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#0a3d2a] text-[#e4cc85]">
        {icon}
      </span>
      <h3 className="mt-5 text-lg font-black text-zinc-900 dark:text-white">
        {title}
      </h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
        {text}
      </p>
    </article>
  );
}
