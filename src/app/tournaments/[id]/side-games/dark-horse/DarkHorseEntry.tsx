"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatGBP } from "@/lib/ui";

interface PlayerOption {
  id: string;
  name: string;
  rank: number | null;
  country: string | null;
}

export default function DarkHorseEntry({
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
      setError("Please pick a dark horse");
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
          type: "dark_horse",
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

  const selectedPlayer = players.find((p) => p.id === selected);

  return (
    <div className="mb-6 rounded-2xl border-2 border-fuchsia-300 bg-fuchsia-50/50 dark:bg-fuchsia-950/10 p-5">
      <h2 className="mb-1 text-lg font-bold text-fuchsia-700 dark:text-fuchsia-400">
        Pick Your Dark Horse
      </h2>
      <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
        Choose ONE Tier 5 golfer (rank 51+) you think will outperform.
        Entry: <strong>{formatGBP(entryFee)}</strong>
      </p>

      {/* Player Grid */}
      <div className="flex flex-wrap gap-2">
        {players.map((p) => (
          <button
            key={p.id}
            onClick={() => setSelected(p.id)}
            className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition ${
              selected === p.id
                ? "border-fuchsia-500 bg-fuchsia-600 text-white shadow"
                : "border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-fuchsia-400"
            }`}
          >
            {p.name}
            {p.country && (
              <span className="ml-1 text-xs opacity-60">{p.country}</span>
            )}
          </button>
        ))}
      </div>

      {players.length === 0 && (
        <p className="text-sm text-zinc-500">No Tier 5 players available.</p>
      )}

      {/* Selected display */}
      {selectedPlayer && (
        <div className="mt-4 rounded-lg border border-fuchsia-300 bg-white dark:bg-zinc-900 px-4 py-2">
          <p className="text-sm">
            <span className="text-zinc-500">Your pick: </span>
            <span className="font-bold text-fuchsia-700 dark:text-fuchsia-400">
              ⚡ {selectedPlayer.name}
            </span>
            <span className="ml-2 text-xs text-zinc-500">
              Rank {selectedPlayer.rank ?? "?"}
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
        className="mt-4 w-full rounded-full bg-fuchsia-600 px-6 py-2.5 text-sm font-bold text-white shadow transition hover:bg-fuchsia-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {submitting
          ? "Entering..."
          : `Enter for ${formatGBP(entryFee)}`}
      </button>
    </div>
  );
}
