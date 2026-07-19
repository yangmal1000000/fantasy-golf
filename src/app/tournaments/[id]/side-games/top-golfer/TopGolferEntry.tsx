"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatGBP, tierBadgeClass, tierLabel } from "@/lib/ui";

interface PlayerOption {
  id: string;
  name: string;
  tier: string;
  rank: number | null;
}

export default function TopGolferEntry({
  tournamentId,
  userId,
  entryFee,
  players,
}: {
  tournamentId: string;
  userId: string;
  entryFee: number;
  players: PlayerOption[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    if (!selected) {
      setError("Please pick a golfer");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/side-games/enter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          userId,
          type: "top_golfer",
          playerId: selected,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to enter");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  // Group players by tier for the dropdown
  const byTier: Record<string, PlayerOption[]> = {};
  for (const p of players) {
    if (!byTier[p.tier]) byTier[p.tier] = [];
    byTier[p.tier].push(p);
  }

  const tierOrder = ["T1_10", "T11_20", "T21_30", "T31_50", "T51_PLUS"];
  const selectedPlayer = players.find((p) => p.id === selected);

  return (
    <div className="mb-6 rounded-2xl border-2 border-purple-300 bg-purple-50/50 dark:bg-purple-950/10 p-5">
      <h2 className="mb-1 text-lg font-bold text-purple-700 dark:text-purple-400">
        Pick Your Top Golfer
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Choose ONE golfer you think will have the lowest 4-round total.
        Entry: <strong>{formatGBP(entryFee)}</strong>
      </p>

      {/* Player Grid */}
      <div className="space-y-3">
        {tierOrder
          .filter((t) => byTier[t])
          .map((tier) => (
            <div key={tier}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {tierLabel(tier)}
              </p>
              <div className="flex flex-wrap gap-2">
                {byTier[tier].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setSelected(p.id)}
                    className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
                      selected === p.id
                        ? "border-purple-500 bg-purple-600 text-white shadow"
                        : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-purple-400"
                    }`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>

      {/* Selected display */}
      {selectedPlayer && (
        <div className="mt-4 rounded-lg border border-purple-300 bg-white dark:bg-zinc-900 px-4 py-2">
          <p className="text-sm">
            <span className="text-zinc-500">Your pick: </span>
            <span className="font-bold text-purple-700 dark:text-purple-400">
              {selectedPlayer.name}
            </span>
            <span
              className={`ml-2 rounded-full border px-1.5 py-0.5 text-xs ${tierBadgeClass(selectedPlayer.tier)}`}
            >
              {tierLabel(selectedPlayer.tier).split("·")[0].trim()}
            </span>
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!selected || submitting}
        className="mt-4 w-full rounded-full bg-purple-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Entering..."
          : `Enter for ${formatGBP(entryFee)}`}
      </button>
    </div>
  );
}
