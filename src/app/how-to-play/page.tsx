import type { Metadata } from "next";
import Link from "next/link";
import { TIER_CONFIG, TIER_ORDER } from "@/lib/ui";
import TierBadge from "@/components/TierBadge";

export const metadata: Metadata = {
  title: "How to Play — Fantasy Golf",
  description: "Learn how Fantasy Golf works: pick 5 players from 5 tiers, pay £15 entry, lowest combined strokes wins. Cut logic, scoring examples, and prize distribution explained.",
};

export default function HowToPlayPage() {
  return (
    <div className="mx-auto max-w-5xl px-3 py-6 sm:px-4 sm:py-8">
      <h1 className="text-lg font-bold text-[#0a3d2a] dark:text-green-400 sm:text-3xl">How to Play</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 sm:text-base">
        Everything you need to know about Fantasy Golf.
      </p>

      {/* Quick Rules */}
      <section className="mt-6 sm:mt-8">
        <h2 className="text-lg font-bold text-[#0a3d2a] dark:text-green-400 sm:text-xl">The Basics</h2>
        <div className="mt-4 space-y-3">
          <div className="flex gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-900">
            <span className="text-2xl shrink-0">1️⃣</span>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">Pick 5 Players</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Choose one golfer from each of the 5 tiers. Tiers are based on
                DataGolf world rankings — from the elite (#1–10) to the long
                shots (#51+).
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-900">
            <span className="text-2xl shrink-0">2️⃣</span>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">Pay £15 Entry</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                £15 per team. You can enter multiple teams. The entire pot goes
                to the prize pool — top 3 teams win.
              </p>
            </div>
          </div>
          <div className="flex gap-3 rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-900">
            <span className="text-2xl shrink-0">3️⃣</span>
            <div>
              <h3 className="font-semibold text-zinc-900 dark:text-white">Lowest Score Wins</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Your team&apos;s total is the sum of all 5 players&apos; strokes
                across all 4 rounds. Lowest combined score takes the crown.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Tier System */}
      <section className="mt-8 sm:mt-10">
        <h2 className="text-lg font-bold text-[#0a3d2a] dark:text-green-400 sm:text-xl">The Tier System</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
          Every golfer in the tournament field is assigned to one of 5 tiers
          based on their DataGolf ranking. You pick{" "}
          <strong>exactly one</strong> from each tier. This keeps teams balanced
          — nobody can stack 5 top-10 players.
        </p>

        <div className="mt-4 space-y-2">
          {TIER_ORDER.map((tier) => {
            const config = TIER_CONFIG[tier];
            return (
              <div
                key={tier}
                className={`flex items-center gap-3 rounded-xl border-2 p-3 ${config.cardClass}`}
              >
                <TierBadge tier={tier} size="md" />
                <span className="text-sm text-zinc-600 dark:text-zinc-400">
                  {config.description}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* Cut Logic */}
      <section className="mt-8 sm:mt-10">
        <h2 className="text-lg font-bold text-[#0a3d2a] dark:text-green-400 sm:text-xl">Cut Logic</h2>
        <div className="mt-3 rounded-xl bg-white p-4 shadow-sm dark:bg-zinc-900 sm:p-5">
          <p className="text-sm text-zinc-700 dark:text-zinc-300">
            After Round 2, the tournament cut is applied. Players who
            don&apos;t make the cut are <strong>eliminated</strong> from the
            weekend rounds (R3 and R4).
          </p>
          <div className="mt-4 rounded-lg bg-orange-50 dark:bg-orange-950/30 p-4">
            <p className="font-semibold text-orange-800 dark:text-orange-400">
              📐 Estimated Scores
            </p>
            <p className="mt-1 text-sm text-orange-700 dark:text-orange-400">
              If one of your players misses the cut, their R3 and R4 scores are{" "}
              <strong>estimated</strong> as the average of their R1 and R2
              scores (rounded to the nearest whole number). This ensures every
              team always has a full 4-round total.
            </p>
          </div>
          <div className="mt-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 p-4">
            <p className="text-xs font-semibold uppercase text-zinc-500">
              Example
            </p>
            <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
              <strong>Player A</strong> shoots 72 (R1) and 74 (R2), then misses
              the cut. Their estimated R3 = R4 = (72 + 74) / 2 ={" "}
              <strong>73</strong>. Final total: 72 + 74 + 73 + 73 ={" "}
              <strong>292</strong>.
            </p>
          </div>
        </div>
      </section>

      {/* Scoring Example — horizontal scroll on mobile */}
      <section className="mt-8 sm:mt-10">
        <h2 className="text-lg font-bold text-[#0a3d2a] dark:text-green-400 sm:text-xl">Scoring Example</h2>
        <div className="mt-3 overflow-x-auto rounded-xl bg-white shadow-sm dark:bg-zinc-900">
          <table className="w-full min-w-[500px] text-sm">
            <thead className="bg-[#0a3d2a] text-white">
              <tr>
                <th className="px-4 py-2 text-left">Player</th>
                <th className="px-2 py-2 text-center">Tier</th>
                <th className="px-2 py-2 text-center">R1</th>
                <th className="px-2 py-2 text-center">R2</th>
                <th className="px-2 py-2 text-center">R3</th>
                <th className="px-2 py-2 text-center">R4</th>
                <th className="px-4 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              <tr>
                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-white">Scottie Scheffler</td>
                <td className="px-2 py-2 text-center">
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">T1</span>
                </td>
                <td className="px-2 py-2 text-center">68</td>
                <td className="px-2 py-2 text-center">70</td>
                <td className="px-2 py-2 text-center">67</td>
                <td className="px-2 py-2 text-center">69</td>
                <td className="px-4 py-2 text-right font-bold">274</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-white">Tyrrell Hatton</td>
                <td className="px-2 py-2 text-center">
                  <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800">T2</span>
                </td>
                <td className="px-2 py-2 text-center">71</td>
                <td className="px-2 py-2 text-center">73</td>
                <td className="px-2 py-2 text-center">70</td>
                <td className="px-2 py-2 text-center">72</td>
                <td className="px-4 py-2 text-right font-bold">286</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-white">Min Woo Lee</td>
                <td className="px-2 py-2 text-center">
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">T3</span>
                </td>
                <td className="px-2 py-2 text-center">69</td>
                <td className="px-2 py-2 text-center">75</td>
                <td className="px-2 py-2 text-center text-orange-500">72*</td>
                <td className="px-2 py-2 text-center text-orange-500">72*</td>
                <td className="px-4 py-2 text-right font-bold">288</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-white">Adam Scott</td>
                <td className="px-2 py-2 text-center">
                  <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs text-purple-800">T4</span>
                </td>
                <td className="px-2 py-2 text-center">70</td>
                <td className="px-2 py-2 text-center">71</td>
                <td className="px-2 py-2 text-center">73</td>
                <td className="px-2 py-2 text-center">70</td>
                <td className="px-4 py-2 text-right font-bold">284</td>
              </tr>
              <tr>
                <td className="px-4 py-2 font-medium text-zinc-900 dark:text-white">Daniel Brown</td>
                <td className="px-2 py-2 text-center">
                  <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700">T5</span>
                </td>
                <td className="px-2 py-2 text-center">67</td>
                <td className="px-2 py-2 text-center">71</td>
                <td className="px-2 py-2 text-center">68</td>
                <td className="px-2 py-2 text-center">73</td>
                <td className="px-4 py-2 text-right font-bold">279</td>
              </tr>
              <tr className="bg-[#0a3d2a] font-bold text-white">
                <td className="px-4 py-3" colSpan={6}>
                  Team Total
                </td>
                <td className="px-4 py-3 text-right text-lg">1,411</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          * <span className="text-orange-500">Orange</span> = estimated score
          (missed cut). Min Woo Lee missed the cut after R2 (69+75=144), so R3
          and R4 are estimated as (69+75)/2 = 72 each.
        </p>
      </section>

      {/* Prize Distribution */}
      <section className="mt-8 sm:mt-10">
        <h2 className="text-lg font-bold text-[#0a3d2a] dark:text-green-400 sm:text-xl">Prize Distribution</h2>
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between rounded-xl bg-amber-50 dark:bg-amber-950/30 p-4">
            <span className="font-semibold text-amber-800 dark:text-amber-400">🥇 1st Place</span>
            <span className="font-bold text-amber-700 dark:text-amber-400">60% of pot</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-4">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">🥈 2nd Place</span>
            <span className="font-bold text-zinc-600 dark:text-zinc-400">25% of pot</span>
          </div>
          <div className="flex items-center justify-between rounded-xl bg-orange-50 dark:bg-orange-950/30 p-4">
            <span className="font-semibold text-orange-700 dark:text-orange-400">🥉 3rd Place</span>
            <span className="font-bold text-orange-600 dark:text-orange-400">15% of pot</span>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mt-8 sm:mt-10 rounded-2xl bg-gradient-to-r from-[#0a3d2a] to-[#1a5c3e] p-6 text-center text-white sm:p-8">
        <h2 className="text-lg font-bold sm:text-xl">Ready to play?</h2>
        <p className="mt-1 text-white/80">
          Build your dream team for The Open 2026.
        </p>
        <Link
          href="/tournaments"
          className="mt-4 inline-block rounded-full bg-[#c8a951] px-8 py-3 font-bold text-[#1a1a1a] transition hover:bg-[#d4b76a] touch-target"
        >
          Get Started →
        </Link>
      </section>
    </div>
  );
}
