"use client";

/**
 * MiniLeaderboard — Floating bottom-right card showing top 5 + your position.
 * Only visible during live tournaments. Collapsible.
 * Smaller on mobile, positioned above bottom nav.
 */

import { useState } from "react";
import Link from "next/link";

export interface MiniLeaderboardEntry {
  teamId: string;
  teamName: string;
  position: number;
  totalStrokes: number;
  vsPar: number;
  isYou?: boolean;
}

interface MiniLeaderboardProps {
  tournamentId: string;
  entries: MiniLeaderboardEntry[];
  yourEntry?: MiniLeaderboardEntry;
}

export default function MiniLeaderboard({
  tournamentId,
  entries,
  yourEntry,
}: MiniLeaderboardProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const top5 = entries.slice(0, 5);
  const youInTop5 = top5.some((e) => e.isYou);
  const showYouRow = yourEntry && !youInTop5;

  if (collapsed) {
    return (
      <div className="mini-leaderboard">
        <button
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-2 rounded-full bg-[#0a3d2a] px-3 py-2.5 text-white shadow-lg transition hover:bg-[#0a3d2a] touch-target"
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
          </span>
          <span className="text-xs font-bold">
            {yourEntry ? `#${yourEntry.position}` : "Live"}
          </span>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className="mini-leaderboard">
      <div className="w-56 overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl sm:w-64">
        {/* Header */}
        <div className="flex items-center justify-between bg-[#0a3d2a] px-3 py-2 text-white">
          <div className="flex items-center gap-1.5">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500" />
            </span>
            <span className="text-xs font-bold uppercase tracking-wide">
              Live
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCollapsed(true)}
              className="rounded p-1 text-white/70 hover:text-white"
              aria-label="Collapse"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <button
              onClick={() => setDismissed(true)}
              className="rounded p-1 text-white/70 hover:text-white"
              aria-label="Dismiss"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3.5 w-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Top 5 rows */}
        <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
          {top5.map((entry) => (
            <Link
              key={entry.teamId}
              href={`/tournaments/${tournamentId}/teams/${entry.teamId}`}
              className={`flex items-center justify-between px-3 py-2 transition hover:bg-zinc-50 dark:hover:bg-zinc-800 ${
                entry.isYou ? "bg-amber-50 dark:bg-amber-950/30" : ""
              }`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                    entry.position === 1
                      ? "bg-[#c8a951] text-[#1a1a1a]"
                      : "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                  }`}
                >
                  {entry.position}
                </span>
                <span className="truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  {entry.teamName}
                </span>
              </div>
              <span className="text-xs font-bold tabular-nums text-[#0a3d2a] dark:text-green-400">
                {entry.totalStrokes}
              </span>
            </Link>
          ))}
        </div>

        {/* Your position if outside top 5 */}
        {showYouRow && (
          <>
            <div className="border-t-2 border-dashed border-zinc-200 dark:border-zinc-700" />
            <Link
              href={`/tournaments/${tournamentId}/teams/${yourEntry!.teamId}`}
              className="flex items-center justify-between bg-amber-50 dark:bg-amber-950/30 px-3 py-2 transition hover:bg-amber-100 dark:hover:bg-amber-950/50"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#c8a951] text-[10px] font-bold text-[#1a1a1a]">
                  {yourEntry!.position}
                </span>
                <span className="truncate text-xs font-semibold text-[#0a3d2a] dark:text-green-400">
                  Your Team
                </span>
              </div>
              <span className="text-xs font-bold tabular-nums text-[#0a3d2a] dark:text-green-400">
                {yourEntry!.totalStrokes}
              </span>
            </Link>
          </>
        )}

        {/* Footer link */}
        <Link
          href={`/tournaments/${tournamentId}/leaderboard`}
          className="block bg-zinc-50 dark:bg-zinc-800/50 py-2 text-center text-[10px] font-semibold text-[#0a3d2a] dark:text-green-400 transition hover:bg-zinc-100 dark:hover:bg-zinc-800"
        >
          Full Leaderboard →
        </Link>
      </div>
    </div>
  );
}
