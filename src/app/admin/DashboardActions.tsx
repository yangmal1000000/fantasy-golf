"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

interface TournamentRef {
  id: string;
  name: string;
  status: string;
}

export default function DashboardActions({
  tournaments,
}: {
  tournaments: TournamentRef[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  // Pick the first entries_open or in_progress tournament
  const activeTournament =
    tournaments.find((t) => t.status === "entries_open") ??
    tournaments.find((t) => t.status === "in_progress") ??
    tournaments[0];

  async function quickAction(
    action: "open" | "close" | "fetch",
    tournamentId: string
  ) {
    setFeedback(null);
    try {
      if (action === "fetch") {
        const res = await fetch(
          `/api/scores/refresh?tournamentId=${tournamentId}`,
          { method: "POST" }
        );
        const data = await res.json();
        if (data.success) {
          setFeedback(
            `✅ Fetched: ${data.updated} updated, ${data.created} created`
          );
        } else {
          setFeedback(`⚠️ ${data.error ?? "Fetch failed"}`);
        }
      } else {
        const newStatus = action === "open" ? "entries_open" : "in_progress";
        const res = await fetch("/api/admin/tournament", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tournamentId, status: newStatus }),
        });
        if (res.ok) {
          setFeedback(
            `✅ Entries ${action === "open" ? "opened" : "closed"} for tournament`
          );
          startTransition(() => router.refresh());
        } else {
          setFeedback("❌ Failed to update");
        }
      }
    } catch {
      setFeedback("❌ Network error");
    }
  }

  return (
    <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
      <h2 className="font-semibold text-zinc-900">Quick Actions</h2>
      <div className="mt-3 space-y-2">
        {tournaments.length === 0 ? (
          <p className="text-xs text-zinc-400">
            Create a tournament first.
          </p>
        ) : (
          <>
            <button
              onClick={() =>
                activeTournament && quickAction("open", activeTournament.id)
              }
              className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              🟢 Open Entries
            </button>
            <button
              onClick={() =>
                activeTournament && quickAction("close", activeTournament.id)
              }
              className="w-full rounded-lg bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
            >
              🔴 Close Entries
            </button>
            <button
              onClick={() =>
                activeTournament && quickAction("fetch", activeTournament.id)
              }
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              📡 Fetch Scores
            </button>
            <p className="pt-1 text-xs text-zinc-400">
              Target: {activeTournament?.name ?? "—"}
            </p>
          </>
        )}
      </div>
      {feedback && (
        <div className="mt-3 rounded-lg bg-zinc-50 p-2 text-xs text-zinc-700">
          {feedback}
        </div>
      )}
    </div>
  );
}
