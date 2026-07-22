"use client";

import { useState, useEffect, useCallback } from "react";
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

interface TierPlayer {
  id: string;
  name: string;
  country: string | null;
  photoUrl: string | null;
  dataGolfRank: number | null;
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

// ===== Spinner =====
function MiniSpinner({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={`${className} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ===== Player Search Select =====
// A searchable dropdown for picking a player within a tier

interface PlayerSearchSelectProps {
  tier: string;
  players: TierPlayer[];
  selectedPlayerId: string | null;
  onSelect: (playerId: string) => void;
}

function PlayerSearchSelect({ tier, players, selectedPlayerId, onSelect }: PlayerSearchSelectProps) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const filtered = players.filter((p) =>
    p.name.toLowerCase().includes(query.toLowerCase()),
  );

  const selected = players.find((p) => p.id === selectedPlayerId);

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800">
        <TierDot tier={tier} />
        {selected ? (
          <div className="flex flex-1 items-center justify-between">
            <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
              {selected.name}
            </span>
            {selected.dataGolfRank && (
              <span className="text-xs text-zinc-400">#{selected.dataGolfRank}</span>
            )}
          </div>
        ) : (
          <span className="flex-1 text-sm text-zinc-400">Pick a player...</span>
        )}
      </div>

      {/* Search + list */}
      <div className="mt-1.5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder="Search players..."
          className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-700 outline-none transition focus:border-[#0a3d2a] focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:focus:border-green-400"
        />
        {focused && (
          <div className="mt-1 max-h-52 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-zinc-400">No players found</p>
            ) : (
              filtered.slice(0, 50).map((p) => (
                <button
                  key={p.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    onSelect(p.id);
                    setQuery("");
                    setFocused(false);
                  }}
                  className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm transition hover:bg-[#0a3d2a]/5 dark:hover:bg-zinc-700 ${
                    p.id === selectedPlayerId ? "bg-[#0a3d2a]/5 dark:bg-zinc-700" : ""
                  }`}
                >
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">{p.name}</span>
                  {p.dataGolfRank && (
                    <span className="text-xs text-zinc-400">#{p.dataGolfRank}</span>
                  )}
                </button>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Editable Saved Team Card =====

interface EditableSavedTeamCardProps {
  team: SavedTeamData;
  tierPlayers: Record<string, TierPlayer[]>;
  onDelete: (id: string) => void;
  onUpdate: (id: string, updated: SavedTeamData) => void;
}

function EditableSavedTeamCard({ team, tierPlayers, onDelete, onUpdate }: EditableSavedTeamCardProps) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(team.name);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize selections from team data
  useEffect(() => {
    setName(team.name);
    const initSelections: Record<string, string> = {};
    for (const slot of team.players) {
      initSelections[slot.tier] = slot.playerId;
    }
    setSelections(initSelections);
  }, [team]);

  const hasChanges = (() => {
    if (name.trim() !== team.name) return true;
    for (const slot of team.players) {
      if (selections[slot.tier] !== slot.playerId) return true;
    }
    return false;
  })();

  const handleSave = useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      // Build players array — only tiers that exist in the template
      const players = Object.entries(selections)
        .filter(([, pid]) => pid)
        .map(([tier, pid]) => ({ playerId: pid, tier }));

      const res = await fetch(`/api/saved-teams/${team.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), players }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to save");
      }

      const data = await res.json();
      // Update parent state with returned data
      const updated: SavedTeamData = {
        id: data.savedTeam.id,
        name: data.savedTeam.name,
        createdAt: data.savedTeam.createdAt,
        players: data.savedTeam.players.map((p: SavedTeamPlayerData & { player: { dataGolfRank: number | null } }) => ({
          playerId: p.playerId,
          tier: p.tier,
          player: {
            id: p.player.id,
            name: p.player.name,
            country: p.player.country,
            photoUrl: p.player.photoUrl,
            dataGolfRank: p.player.dataGolfRank,
          },
        })),
      };
      onUpdate(team.id, updated);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [selections, name, team, onUpdate]);

  const handleCancel = () => {
    setName(team.name);
    const initSelections: Record<string, string> = {};
    for (const slot of team.players) {
      initSelections[slot.tier] = slot.playerId;
    }
    setSelections(initSelections);
    setError(null);
    setEditing(false);
  };

  const sortedPlayers = [...team.players].sort(
    (a, b) => TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  );

  // Tiers present in this template
  const templateTiers = sortedPlayers.map((p) => p.tier);

  return (
    <div
      className={`group relative rounded-xl border p-3 transition ${
        editing
          ? "border-[#0a3d2a] dark:border-green-400 shadow-md"
          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
      }`}
    >
      {/* View Mode */}
      {!editing && (
        <>
          <div className="mb-2 flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold text-[#0a3d2a] dark:text-green-400">
              {team.name}
            </h3>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={() => setEditing(true)}
                className="rounded-lg p-1 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800"
                title="Edit template"
                aria-label="Edit template"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              </button>
              <button
                onClick={() => onDelete(team.id)}
                disabled={saving}
                className="shrink-0 rounded-lg p-1 text-zinc-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20"
                title="Delete template"
                aria-label="Delete template"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Player chips */}
          <div className="flex flex-wrap gap-1.5">
            {sortedPlayers.map((slot) => {
              const lastName = slot.player.name.split(" ").slice(-1)[0];
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
        </>
      )}

      {/* Edit Mode */}
      {editing && (
        <div className="space-y-2.5">
          {/* Name input */}
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Team Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 outline-none transition focus:border-[#0a3d2a] dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:focus:border-green-400"
              placeholder="Team name..."
            />
          </div>

          {/* Player selectors per tier */}
          <div className="space-y-2">
            {templateTiers.map((tier) => {
              const currentSlot = sortedPlayers.find((s) => s.tier === tier);
              const tierConfig = TIER_CONFIG[tier];
              return (
                <div key={tier}>
                  <div className="mb-1 flex items-center gap-1.5">
                    <TierDot tier={tier} />
                    <span className="text-xs font-semibold text-zinc-500">
                      {tierConfig?.short ?? tier}
                    </span>
                    <span className="text-xs text-zinc-400">
                      {tierConfig?.label}
                    </span>
                  </div>
                  <PlayerSearchSelect
                    tier={tier}
                    players={tierPlayers[tier] || []}
                    selectedPlayerId={selections[tier] ?? currentSlot?.playerId ?? null}
                    onSelect={(pid) =>
                      setSelections((prev) => ({ ...prev, [tier]: pid }))
                    }
                  />
                </div>
              );
            })}
          </div>

          {/* Error */}
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-900/20 dark:text-red-400">
              {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={!hasChanges || saving}
              className="flex-1 rounded-lg bg-[#0a3d2a] py-2 text-sm font-bold text-white transition hover:bg-[#0a3d2a]/90 disabled:opacity-40 dark:bg-green-600 dark:hover:bg-green-500"
            >
              {saving ? <MiniSpinner className="mx-auto h-4 w-4" /> : "Save Changes"}
            </button>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ===== Saved Teams Section =====

interface SavedTeamsSectionProps {
  initialSavedTeams: SavedTeamData[];
}

export function SavedTeamsSection({ initialSavedTeams }: SavedTeamsSectionProps) {
  const [savedTeams, setSavedTeams] = useState(initialSavedTeams);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [tierPlayers, setTierPlayers] = useState<Record<string, TierPlayer[]> | null>(null);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  // Fetch tier-grouped players when there are saved teams
  useEffect(() => {
    if (savedTeams.length === 0 || tierPlayers) return;
    setLoadingPlayers(true);
    fetch("/api/players/by-tier")
      .then((r) => r.json())
      .then((data) => {
        if (data.byTier) setTierPlayers(data.byTier);
      })
      .catch((err) => console.error("Failed to load tier players:", err))
      .finally(() => setLoadingPlayers(false));
  }, [savedTeams.length, tierPlayers]);

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

  function handleUpdate(id: string, updated: SavedTeamData) {
    setSavedTeams((prev) => prev.map((t) => (t.id === id ? updated : t)));
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
        <span className="text-xs text-zinc-400">
          ✏️ Click edit to rename or swap players
        </span>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 sm:gap-3">
        {savedTeams.map((team) => (
          <EditableSavedTeamCard
            key={team.id}
            team={team}
            tierPlayers={tierPlayers ?? {}}
            onDelete={handleDelete}
            onUpdate={handleUpdate}
          />
        ))}
      </div>

      {loadingPlayers && savedTeams.length > 0 && (
        <p className="mt-2 text-xs text-zinc-400">Loading player database...</p>
      )}
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
          <MiniSpinner />
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
