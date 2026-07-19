"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TIER_CONFIG, TIER_ORDER } from "@/lib/ui";

interface PlayerRow {
  id: string;
  playerId: string;
  tier: string;
  madeCut: boolean | null;
  withdrew: boolean;
  selectionCount: number;
  name: string;
  country: string | null;
  dataGolfRank: number | null;
}

interface AvailablePlayer {
  id: string;
  name: string;
  country: string | null;
  dataGolfRank: number | null;
}

export default function PlayerManager({
  tournamentId,
  tournamentName,
  players,
  availablePlayers,
}: {
  tournamentId: string;
  tournamentName: string;
  players: PlayerRow[];
  availablePlayers: AvailablePlayer[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [grouped, setGrouped] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [addingPlayer, setAddingPlayer] = useState("");

  // Filter
  const filtered = players.filter((p) => {
    if (search) {
      const q = search.toLowerCase();
      if (
        !p.name.toLowerCase().includes(q) &&
        !(p.country ?? "").toLowerCase().includes(q)
      )
        return false;
    }
    if (tierFilter !== "all" && p.tier !== tierFilter) return false;
    return true;
  });

  // Group by tier
  const groupedPlayers: Record<string, PlayerRow[]> = {};
  for (const tier of TIER_ORDER) {
    groupedPlayers[tier] = filtered.filter((p) => p.tier === tier);
  }

  async function updatePlayer(
    playerId: string,
    changes: Record<string, unknown>
  ) {
    setFeedback("Saving…");
    try {
      const res = await fetch("/api/admin/tournament-player", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentPlayerId: playerId, ...changes }),
      });
      if (res.ok) {
        setFeedback("✅ Updated");
        startTransition(() => router.refresh());
        setTimeout(() => setFeedback(null), 2000);
      } else {
        setFeedback("❌ Update failed");
      }
    } catch {
      setFeedback("❌ Network error");
    }
  }

  async function handleAddPlayer() {
    if (!addingPlayer) return;
    setFeedback("Adding…");
    try {
      // Find the player to get default tier based on rank
      const player = availablePlayers.find((p) => p.id === addingPlayer);
      if (!player) return;

      let defaultTier = "T51_PLUS";
      const rank = player.dataGolfRank;
      if (rank != null) {
        if (rank <= 10) defaultTier = "T1_10";
        else if (rank <= 20) defaultTier = "T11_20";
        else if (rank <= 30) defaultTier = "T21_30";
        else if (rank <= 50) defaultTier = "T31_50";
      }

      const res = await fetch("/api/admin/tournament-player/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId,
          playerId: addingPlayer,
          tier: defaultTier,
        }),
      });

      if (res.ok) {
        setFeedback(`✅ Added ${player.name}`);
        setAddingPlayer("");
        setShowAdd(false);
        startTransition(() => router.refresh());
      } else {
        const data = await res.json();
        setFeedback(`❌ ${data.error ?? "Failed to add"}`);
      }
    } catch {
      setFeedback("❌ Network error");
    }
  }

  async function handleRemovePlayer(playerId: string, name: string) {
    if (!confirm(`Remove "${name}" from this tournament?`)) return;
    setFeedback("Removing…");
    try {
      const res = await fetch(
        `/api/admin/tournament-player?tournamentPlayerId=${playerId}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setFeedback(`✅ Removed ${name}`);
        startTransition(() => router.refresh());
      } else {
        setFeedback("❌ Failed to remove");
      }
    } catch {
      setFeedback("❌ Network error");
    }
  }

  function renderPlayerRow(p: PlayerRow) {
    return (
      <tr key={p.id} className="hover:bg-zinc-50">
        <td className="px-3 py-2 text-zinc-500">
          {p.dataGolfRank ?? "—"}
        </td>
        <td className="px-3 py-2">
          <span className="font-medium text-zinc-900">{p.name}</span>
          {p.country && (
            <span className="ml-1 text-xs text-zinc-400">{p.country}</span>
          )}
        </td>
        <td className="px-3 py-2">
          <select
            value={p.tier}
            onChange={(e) => updatePlayer(p.id, { tier: e.target.value })}
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold outline-none cursor-pointer ${
              TIER_CONFIG[p.tier]?.badgeClass ?? "bg-zinc-100"
            }`}
          >
            {TIER_ORDER.map((t) => (
              <option key={t} value={t}>
                {TIER_CONFIG[t]?.label ?? t}
              </option>
            ))}
          </select>
        </td>
        <td className="px-3 py-2 text-center text-zinc-500">
          {p.selectionCount > 0 ? p.selectionCount : "—"}
        </td>
        <td className="px-3 py-2 text-center">
          <button
            onClick={() =>
              updatePlayer(p.id, {
                madeCut: p.madeCut === true ? null : true,
              })
            }
            className={`rounded px-2 py-0.5 text-xs font-semibold ${
              p.madeCut === true
                ? "bg-green-100 text-green-700"
                : "bg-zinc-100 text-zinc-500 hover:bg-green-50"
            }`}
          >
            {p.madeCut === true ? "✓ Cut" : "Set Cut"}
          </button>
        </td>
        <td className="px-3 py-2 text-center">
          <button
            onClick={() => updatePlayer(p.id, { withdrew: !p.withdrew })}
            className={`rounded px-2 py-0.5 text-xs font-semibold ${
              p.withdrew
                ? "bg-red-100 text-red-700"
                : "bg-zinc-100 text-zinc-500 hover:bg-red-50"
            }`}
          >
            {p.withdrew ? "WD" : "—"}
          </button>
        </td>
        <td className="px-3 py-2 text-center">
          <button
            onClick={() => handleRemovePlayer(p.id, p.name)}
            className="rounded px-2 py-0.5 text-xs text-red-500 hover:bg-red-50"
          >
            Remove
          </button>
        </td>
      </tr>
    );
  }

  return (
    <div>
      {feedback && (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
          {feedback}
        </div>
      )}

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input
          type="search"
          placeholder="Search players…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
        />
        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
        >
          <option value="all">All Tiers</option>
          {TIER_ORDER.map((t) => (
            <option key={t} value={t}>
              {TIER_CONFIG[t]?.label ?? t}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-zinc-600">
          <input
            type="checkbox"
            checked={grouped}
            onChange={(e) => setGrouped(e.target.checked)}
          />
          Group by tier
        </label>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="rounded-lg bg-[#1a6b3c] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[#0f3d20]"
        >
          {showAdd ? "Cancel" : "+ Add Player"}
        </button>
      </div>

      {/* Add player form */}
      {showAdd && (
        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
          <h3 className="mb-3 font-semibold text-zinc-900">Add Player to {tournamentName}</h3>
          {availablePlayers.length === 0 ? (
            <p className="text-sm text-zinc-400">
              All existing players are already in this tournament.
            </p>
          ) : (
            <div className="flex gap-2">
              <select
                value={addingPlayer}
                onChange={(e) => setAddingPlayer(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
              >
                <option value="">Select a player…</option>
                {availablePlayers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                    {p.dataGolfRank ? ` (rank ${p.dataGolfRank})` : ""}
                  </option>
                ))}
              </select>
              <button
                onClick={handleAddPlayer}
                disabled={!addingPlayer}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {/* Player table(s) */}
      {grouped ? (
        <div className="space-y-6">
          {TIER_ORDER.map((tier) => {
            const tierPlayers = groupedPlayers[tier] ?? [];
            if (tierPlayers.length === 0) return null;
            return (
              <div key={tier}>
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      TIER_CONFIG[tier]?.badgeClass
                    }`}
                  >
                    {TIER_CONFIG[tier]?.label ?? tier}
                  </span>
                  <span className="text-xs text-zinc-400">
                    {tierPlayers.length} player{tierPlayers.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
                  <PlayerTable>{tierPlayers.map(renderPlayerRow)}</PlayerTable>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="rounded-xl bg-white py-12 text-center text-sm text-zinc-400 shadow-sm">
              No players match your filters.
            </div>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
          <PlayerTable>{filtered.map(renderPlayerRow)}</PlayerTable>
        </div>
      )}
    </div>
  );
}

function PlayerTable({ children }: { children: React.ReactNode }) {
  return (
    <table className="w-full text-sm">
      <thead className="sticky top-0 bg-zinc-50 text-zinc-600">
        <tr className="border-b border-zinc-200">
          <th className="px-3 py-2 text-left">Rank</th>
          <th className="px-3 py-2 text-left">Player</th>
          <th className="px-3 py-2 text-left">Tier</th>
          <th className="px-3 py-2 text-center">Picks</th>
          <th className="px-3 py-2 text-center">Cut</th>
          <th className="px-3 py-2 text-center">WD</th>
          <th className="px-3 py-2 text-center">Actions</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-zinc-100">{children}</tbody>
    </table>
  );
}
