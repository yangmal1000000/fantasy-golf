"use client";

import { useState } from "react";
import { TIER_CONFIG, tierBadgeClass, TIER_ORDER } from "@/lib/ui";
import TierBadge from "@/components/TierBadge";
import Link from "next/link";

interface BoardPlayer {
  tournamentPlayerId: string;
  playerId: string;
  name: string;
  country: string | null;
  dataGolfRank: number | null;
  tier: string;
  selectionCount: number;
  pickPercentage: number;
}

export default function DraftBoardClient({
  boardData,
  totalTeams: _totalTeams,
}: {
  boardData: BoardPlayer[];
  totalTeams: number;
}) {
  const [activeTier, setActiveTier] = useState<string>("ALL");
  const [sortBy, setSortBy] = useState<"picks" | "rank" | "name">("picks");

  // Filter
  const filtered = activeTier === "ALL"
    ? boardData
    : boardData.filter((p) => p.tier === activeTier);

  // Sort
  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === "picks") return b.selectionCount - a.selectionCount;
    if (sortBy === "rank") return (a.dataGolfRank ?? 999) - (b.dataGolfRank ?? 999);
    return a.name.localeCompare(b.name);
  });

  const maxPicks = Math.max(...boardData.map((p) => p.selectionCount), 1);

  return (
    <div>
      {/* Filter + sort controls */}
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-2">
        {/* Tier filter — horizontal scroll on mobile */}
        <div className="flex gap-1 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          <button
            onClick={() => setActiveTier("ALL")}
            className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition touch-target ${
              activeTier === "ALL"
                ? "border-[#0a3d2a] bg-[#0a3d2a] text-white"
                : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
            }`}
          >
            All Tiers
          </button>
          {TIER_ORDER.map((tier) => {
            return (
              <button
                key={tier}
                onClick={() => setActiveTier(tier)}
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-semibold transition touch-target ${
                  activeTier === tier
                    ? tierBadgeClass(tier) + " ring-2 ring-[#0a3d2a]/30"
                    : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-700"
                }`}
              >
                {TIER_CONFIG[tier]?.label.split("·")[0].trim() ?? tier}
              </button>
            );
          })}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1 sm:ml-auto">
          <span className="text-xs text-zinc-400">Sort:</span>
          {([
            ["picks", "Picks"],
            ["rank", "Rank"],
            ["name", "A–Z"],
          ] as const).map(([val, label]) => (
            <button
              key={val}
              onClick={() => setSortBy(val)}
              className={`rounded-md px-2 py-1.5 text-xs font-medium transition ${
                sortBy === val
                  ? "bg-zinc-800 text-white dark:bg-zinc-200 dark:text-zinc-900"
                  : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Player list with bars */}
      <div className="space-y-1">
        {sorted.map((p, idx) => {
          const barWidth = (p.selectionCount / maxPicks) * 100;
          return (
            <Link
              key={p.tournamentPlayerId}
              href={`/players/${p.playerId}`}
              className="block rounded-lg p-2 transition hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center gap-2 sm:gap-3">
                <span className="w-5 shrink-0 text-right text-xs font-medium text-zinc-400 dark:text-zinc-500">
                  {idx + 1}
                </span>
                <div className="hidden sm:block">
                  <TierBadge tier={p.tier} size="sm" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="truncate text-sm font-medium text-zinc-800 dark:text-zinc-200">
                        {p.name}
                      </span>
                      {p.dataGolfRank && (
                        <span className="ml-2 text-xs text-zinc-400 dark:text-zinc-500">
                          #{p.dataGolfRank}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                      {/* Bar — visible on all sizes but smaller on mobile */}
                      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 sm:h-2 sm:w-24">
                        <div
                          className="h-full rounded-full bg-[#1a5c3e]"
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                      <span className="w-9 text-right text-xs font-bold text-[#0a3d2a] dark:text-green-400">
                        {p.pickPercentage}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-zinc-400">
          No players in this tier.
        </p>
      )}
    </div>
  );
}
