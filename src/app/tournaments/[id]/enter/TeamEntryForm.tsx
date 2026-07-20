"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { TIER_CONFIG, TIER_ORDER, formatGBP } from "@/lib/ui";
import SelectionWheel from "@/components/SelectionWheel";
import Confetti from "@/components/Confetti";
import PlayerAvatar from "@/components/PlayerAvatar";
import Flag from "@/components/Flag";

interface TierPlayer {
  tournamentPlayerId: string;
  playerId: string;
  name: string;
  country: string | null;
  photoUrl: string | null;
  dataGolfRank: number | null;
  tier: string;
}

interface TeamEntryFormProps {
  tournamentId: string;
  entryFee: number;
  userId: string;
  playersByTier: Record<string, TierPlayer[]>;
}

export default function TeamEntryForm({
  tournamentId,
  entryFee,
  userId,
  playersByTier,
}: TeamEntryFormProps) {
  const router = useRouter();
  const [teamName, setTeamName] = useState("");
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [openTiers, setOpenTiers] = useState<Set<string>>(new Set(TIER_ORDER));

  const selectedCount = Object.keys(selections).length;
  const allTiersFilled = TIER_ORDER.every((t) => selections[t]);

  function toggleSelect(tier: string, tournamentPlayerId: string) {
    setSelections((prev) => {
      if (prev[tier] === tournamentPlayerId) {
        const next = { ...prev };
        delete next[tier];
        return next;
      }
      return { ...prev, [tier]: tournamentPlayerId };
    });
  }

  function toggleTier(tier: string) {
    setOpenTiers((prev) => {
      const next = new Set(prev);
      if (next.has(tier)) {
        next.delete(tier);
      } else {
        next.add(tier);
      }
      return next;
    });
  }

  // Auto-collapse tier when a selection is made (mobile nicety)
  useEffect(() => {
    if (allTiersFilled) {
      // Keep all open so user can review
      return;
    }
  }, [allTiersFilled]);

  async function handleSubmit() {
    setError(null);

    if (!teamName.trim()) {
      setError("Please enter a team name");
      return;
    }

    if (!allTiersFilled) {
      setError("You must pick one player from each tier");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/tournaments/${tournamentId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamName: teamName.trim(),
          userId,
          selections: Object.values(selections),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create team");
      }

      const data = await res.json();
      // Show confetti before redirecting
      setShowConfetti(true);
      setTimeout(() => {
        router.push(`/tournaments/${tournamentId}/teams/${data.teamId}`);
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="pb-24 sm:pb-0">
      {/* Confetti burst on success */}
      {showConfetti && <Confetti />}

      {/* Selection progress — sticky bar with wheel */}
      <div className="sticky top-[52px] z-30 -mx-4 mb-6 border-b border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 px-4 py-2.5 backdrop-blur sm:top-[57px] sm:py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <SelectionWheel selectedCount={selectedCount} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#0a3d2a] dark:text-green-400">
                {selectedCount === 5 ? "Team Complete!" : `${selectedCount}/5 Selected`}
              </p>
              <div className="mt-1 flex gap-1">
                {TIER_ORDER.map((t) => (
                  <div
                    key={t}
                    className={`h-2 w-6 rounded-full transition sm:w-8 ${
                      selections[t]
                        ? "bg-[#0a3d2a] dark:bg-green-600"
                        : "bg-zinc-200 dark:bg-zinc-700"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          {/* Submit button — hidden on mobile (fixed at bottom instead) */}
          <button
            onClick={handleSubmit}
            disabled={!allTiersFilled || submitting || showConfetti}
            className="hidden rounded-full bg-[#c8a951] px-6 py-2 text-sm font-bold text-[#1a1a1a] shadow transition enabled:hover:bg-[#d4b76a] disabled:cursor-not-allowed disabled:opacity-40 sm:block"
          >
            {submitting ? "Submitting..." : showConfetti ? "✓ Submitted!" : "Submit Team →"}
          </button>
        </div>
      </div>

      {/* Team name */}
      <div className="mb-6">
        <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
          Team Name
        </label>
        <input
          type="text"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          placeholder="e.g. Fairway Finders FC"
          maxLength={40}
          className="w-full rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-4 py-3 text-base outline-none focus:border-[#0a3d2a] focus:ring-2 focus:ring-[#0a3d2a]/20 dark:text-white"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-xl border border-red-300 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      {/* Tier sections — accordion on mobile */}
      <div className="space-y-3 sm:space-y-8">
        {TIER_ORDER.map((tier) => {
          const config = TIER_CONFIG[tier];
          const players = playersByTier[tier] || [];
          const selectedId = selections[tier];
          const isOpen = openTiers.has(tier);
          const selectedPlayer = players.find((p) => p.tournamentPlayerId === selectedId);

          return (
            <div key={tier} className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700 sm:border-0 sm:overflow-visible">
              {/* Tier header — clickable on mobile to toggle */}
              <div className="sm:mb-3 sm:flex sm:items-center sm:gap-2">
                <button
                  onClick={() => toggleTier(tier)}
                  className="flex w-full items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2.5 sm:hidden"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block rounded-full border px-3 py-0.5 text-xs font-semibold ${config.badgeClass}`}
                    >
                      {config.label}
                    </span>
                    {selectedPlayer ? (
                      <span className="text-xs text-[#0a3d2a] dark:text-green-400 font-medium">
                        ✓ {selectedPlayer.name.split(" ").slice(-1)[0]}
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">Tap to select</span>
                    )}
                  </div>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className={`h-4 w-4 text-zinc-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {/* Desktop header */}
                <div className="hidden sm:flex sm:items-center sm:gap-2">
                  <span
                    className={`inline-block rounded-full border px-3 py-0.5 text-xs font-semibold ${config.badgeClass}`}
                  >
                    {config.label}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {config.description}
                  </span>
                </div>
              </div>

              {/* Player cards — always visible on desktop, toggle on mobile */}
              <div className={`${isOpen ? "block" : "hidden"} sm:block`}>
                <div className="grid gap-2 sm:grid-cols-2">
                  {players.map((p) => {
                    const isSelected = selectedId === p.tournamentPlayerId;
                    return (
                      <button
                        key={p.tournamentPlayerId}
                        onClick={() => toggleSelect(tier, p.tournamentPlayerId)}
                        className={`flex items-center justify-between rounded-xl border-2 p-3 text-left transition ${
                          isSelected
                            ? `${config.cardClass} ring-2 ring-[#0a3d2a]/30`
                            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-600"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 sm:gap-3">
                          <PlayerAvatar name={p.name} country={p.country} photoUrl={p.photoUrl} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                              {p.name}
                            </p>
                            <div className="flex items-center gap-1.5">
                              <Flag countryCode={p.country} size="sm" />
                              {p.dataGolfRank && (
                                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                                  #{p.dataGolfRank}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        {isSelected && (
                          <span className="shrink-0 text-lg text-[#0a3d2a]">✓</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Bottom submit bar — fixed on mobile, inline on desktop */}
      {/* Mobile fixed bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Entry: <span className="font-bold text-[#0a3d2a] dark:text-green-400">{formatGBP(entryFee)}</span>
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {selectedCount}/5 selected
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!allTiersFilled || !teamName.trim() || submitting || showConfetti}
            className="shrink-0 rounded-full bg-[#0a3d2a] px-6 py-3 text-sm font-bold text-white shadow transition enabled:hover:bg-[#0a3d2a] disabled:cursor-not-allowed disabled:opacity-40 touch-target"
          >
            {submitting ? "..." : showConfetti ? "✓" : "Submit "}
          </button>
        </div>
      </div>

      {/* Desktop inline submit */}
      <div className="mt-8 hidden rounded-xl bg-zinc-50 dark:bg-zinc-800/50 p-4 sm:block">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Entry fee: <span className="font-bold text-[#0a3d2a] dark:text-green-400">{formatGBP(entryFee)}</span>
            </p>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {selectedCount}/5 players selected
            </p>
          </div>
          <button
            onClick={handleSubmit}
            disabled={!allTiersFilled || !teamName.trim() || submitting || showConfetti}
            className="rounded-full bg-[#0a3d2a] px-8 py-3 text-sm font-bold text-white shadow transition enabled:hover:bg-[#0a3d2a] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Submitting..." : showConfetti ? "✓ Done!" : "Submit Team "}
          </button>
        </div>
      </div>
    </div>
  );
}
