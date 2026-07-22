"use client";

import { useState } from "react";
import Link from "next/link";
import { TIER_CONFIG, TIER_ORDER } from "@/lib/ui";

// ===== Types =====

interface SavedTeamPlayerData {
  playerId: string;
  tier: string;
  player: {
    id: string;
    name: string;
    country: string | null;
    photoUrl: string | null;
    dataGolfRank: number | null;
  };
}

export interface SavedTeamData {
  id: string;
  name: string;
  createdAt: string;
  players: SavedTeamPlayerData[];
}

// ===== Tier dot =====

function TierDot({ tier }: { tier: string }) {
  const config = TIER_CONFIG[tier];
  const color = config?.gradFrom ?? "#6b7280";
  return (
    <span
      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      title={config?.label ?? tier}
    />
  );
}

// ===== Saved Teams Section =====

interface SavedTeamsSectionProps {
  initialSavedTeams: SavedTeamData[];
}

export function SavedTeamsSection({ initialSavedTeams }: SavedTeamsSectionProps) {
  const [savedTeams, setSavedTeams] = useState(initialSavedTeams);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(id: string) {
    setDeleting(id);
    try {
      const res = await fetch(`/api/saved-teams/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      setSavedTeams((prev) => prev.filter((t) => t.id !== id));
    } catch {
      alert("Failed to delete saved team. Please try again.");
    } finally {
      setDeleting(null);
    }
  }

  if (savedTeams.length === 0) return null;

  return (
    <div className="mt-5">
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">
          Saved Templates
        </h2>
        <span className="rounded-full bg-[#0a3d2a]/10 px-2 py-0.5 text-xs font-bold text-[#0a3d2a] dark:bg-green-400/10 dark:text-green-400">
          {savedTeams.length}/5
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        {savedTeams.map((team) => {
          const sortedPlayers = [...team.players].sort(
            (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
          );

          return (
            <div
              key={team.id}
              className="group relative rounded-xl border border-zinc-200 bg-white p-3 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
            >
              {/* Name + delete */}
              <div className="mb-2 flex items-start justify-between gap-2">
                <h3 className="text-sm font-bold text-[#0a3d2a] dark:text-green-400">
                  {team.name}
                </h3>
                <button
                  onClick={() => handleDelete(team.id)}
                  disabled={deleting === team.id}
                  className="shrink-0 rounded-lg p-1 text-zinc-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-40 dark:hover:bg-red-900/20"
                  title="Delete template"
                  aria-label="Delete template"
                >
                  {deleting === team.id ? (
                    <svg
                      className="h-3.5 w-3.5 animate-spin"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="h-3.5 w-3.5"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  )}
                </button>
              </div>

              {/* Player chips */}
              <div className="flex flex-wrap gap-1.5">
                {sortedPlayers.map((slot) => {
                  const lastName = slot.player.name
                    .split(" ")
                    .slice(-1)[0];
                  return (
                    <Link
                      key={slot.playerId}
                      href={`/players/${slot.playerId}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-xs font-medium text-zinc-700 transition hover:border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                    >
                      <TierDot tier={slot.tier} />
                      {lastName}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== Save As Template Button =====

interface SaveAsTemplateButtonProps {
  players: { playerId: string; tier: string }[];
}

export function SaveAsTemplateButton({ players }: SaveAsTemplateButtonProps) {
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle",
  );

  async function handleSave() {
    setState("saving");
    try {
      const res = await fetch("/api/saved-teams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      setState("saved");
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to save team");
      setState("idle");
    }
  }

  return (
    <button
      onClick={handleSave}
      disabled={state === "saving" || state === "saved"}
      className="flex items-center justify-center gap-1.5 rounded-xl border border-[#c8a951]/40 bg-[#c8a951]/10 py-2.5 px-3 text-center text-sm font-semibold text-[#8a6f1e] transition hover:bg-[#c8a951]/20 disabled:opacity-50 touch-target"
    >
      {state === "saving" ? (
        <>
          <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Saving...
        </>
      ) : state === "saved" ? (
        "✓ Saved!"
      ) : (
        <>
          <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
          Save as Template
        </>
      )}
    </button>
  );
}
