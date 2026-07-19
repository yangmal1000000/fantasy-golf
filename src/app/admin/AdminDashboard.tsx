"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TIER_CONFIG, tierBadgeClass, formatGBP, formatDateRange } from "@/lib/ui";

// ---------- Serialized types ----------

interface AdminTournament {
  id: string;
  name: string;
  status: string;
  currentRound: number;
  par: number;
  cutLine: number | null;
}

interface AdminPlayer {
  id: string;
  tier: string;
  madeCut: boolean | null;
  withdrew: boolean;
  selectionCount: number;
  player: {
    id: string;
    name: string;
    country: string | null;
    dataGolfRank: number | null;
  };
  scores: Array<{ id: string; round: number; strokes: number | null; isEstimated: boolean }>;
}

interface AdminTeam {
  id: string;
  name: string;
  totalScore: number;
  position: number | null;
  paid: boolean;
  user: { name: string | null; email: string };
  selections: Array<{
    tournamentPlayer: { player: { name: string }; tier: string };
  }>;
}

interface TournamentData {
  id: string;
  name: string;
  course: string | null;
  status: string;
  par: number;
  cutLine: number | null;
  currentRound: number;
  entryFee: number;
  startDate: string;
  endDate: string;
  players: AdminPlayer[];
  teams: AdminTeam[];
}

interface Props {
  tournaments: AdminTournament[];
  selectedTournamentId: string;
  tournamentData: TournamentData | null;
}

const TABS = ["Players", "Scores", "Teams", "Settings"] as const;
type Tab = (typeof TABS)[number];

export default function AdminDashboard({
  tournaments,
  selectedTournamentId,
  tournamentData,
}: Props) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("Players");
  const [isPending, startTransition] = useTransition();

  function selectTournament(id: string) {
    router.push(`/admin?admin=1&tournament=${id}`);
  }

  if (!tournamentData) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8">
        <h1 className="text-2xl font-bold text-[#0f3d20]">Admin Dashboard</h1>
        <p className="mt-4 text-zinc-600">No tournament selected.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-[#0f3d20]">⚙️ Admin Dashboard</h1>
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
          ADMIN MODE
        </span>
      </div>

      {/* Tournament selector */}
      <div className="mb-6 rounded-xl bg-white p-4 shadow-sm">
        <label className="mb-1 block text-xs font-semibold uppercase text-zinc-500">
          Tournament
        </label>
        <select
          value={selectedTournamentId}
          onChange={(e) => selectTournament(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
        >
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name} ({t.status})
            </option>
          ))}
        </select>
      </div>

      {/* Tournament info bar */}
      <div className="mb-4 flex flex-wrap gap-3 text-sm">
        <span className="rounded-full bg-zinc-100 px-3 py-1">
          Status: <strong>{tournamentData.status}</strong>
        </span>
        <span className="rounded-full bg-zinc-100 px-3 py-1">
          Round: <strong>{tournamentData.currentRound}</strong>
        </span>
        <span className="rounded-full bg-zinc-100 px-3 py-1">
          Par: <strong>{tournamentData.par}</strong>
        </span>
        {tournamentData.cutLine != null && (
          <span className="rounded-full bg-orange-100 px-3 py-1">
            Cut: <strong>{tournamentData.cutLine}</strong>
          </span>
        )}
        <span className="rounded-full bg-zinc-100 px-3 py-1">
          Players: <strong>{tournamentData.players.length}</strong>
        </span>
        <span className="rounded-full bg-zinc-100 px-3 py-1">
          Teams: <strong>{tournamentData.teams.length}</strong>
        </span>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-zinc-200">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-4 py-2 text-sm font-semibold transition ${
              activeTab === tab
                ? "border-[#1a6b3c] text-[#1a6b3c]"
                : "border-transparent text-zinc-500 hover:text-zinc-700"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Players" && (
        <PlayersTab tournamentId={tournamentData.id} players={tournamentData.players} />
      )}
      {activeTab === "Scores" && (
        <ScoresTab tournamentId={tournamentData.id} players={tournamentData.players} par={tournamentData.par} />
      )}
      {activeTab === "Teams" && <TeamsTab teams={tournamentData.teams} />}
      {activeTab === "Settings" && (
        <SettingsTab tournament={tournamentData} />
      )}
    </div>
  );
}

// ---------- Players Tab ----------

function PlayersTab({
  tournamentId,
  players,
}: {
  tournamentId: string;
  players: AdminPlayer[];
}) {
  const [editing, setEditing] = useState<string | null>(null);

  async function updatePlayer(player: AdminPlayer, changes: Record<string, unknown>) {
    const res = await fetch(`/api/admin/tournament-player`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentPlayerId: player.id,
        ...changes,
      }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      alert("Failed to update player");
    }
  }

  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead className="bg-zinc-50 text-zinc-600">
          <tr>
            <th className="px-3 py-2 text-left">Rank</th>
            <th className="px-3 py-2 text-left">Player</th>
            <th className="px-3 py-2 text-left">Tier</th>
            <th className="px-3 py-2 text-center">Picks</th>
            <th className="px-3 py-2 text-center">Cut</th>
            <th className="px-3 py-2 text-center">WD</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-100">
          {players.map((p) => (
            <tr key={p.id} className="hover:bg-zinc-50">
              <td className="px-3 py-2 text-zinc-500">{p.player.dataGolfRank ?? "—"}</td>
              <td className="px-3 py-2 font-medium text-zinc-900">{p.player.name}</td>
              <td className="px-3 py-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${tierBadgeClass(p.tier)}`}>
                  {TIER_CONFIG[p.tier]?.label ?? p.tier}
                </span>
              </td>
              <td className="px-3 py-2 text-center text-zinc-500">{p.selectionCount}</td>
              <td className="px-3 py-2 text-center">
                {p.madeCut === true ? "✅" : p.madeCut === false ? "✗" : "—"}
              </td>
              <td className="px-3 py-2 text-center">
                <button
                  onClick={() => updatePlayer(p, { withdrew: !p.withdrew })}
                  className={`rounded px-2 py-0.5 text-xs font-semibold ${
                    p.withdrew
                      ? "bg-red-100 text-red-700"
                      : "bg-zinc-100 text-zinc-500 hover:bg-red-50 hover:text-red-600"
                  }`}
                >
                  {p.withdrew ? "WD" : "—"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- Scores Tab ----------

function ScoresTab({
  tournamentId,
  players,
  par,
}: {
  tournamentId: string;
  players: AdminPlayer[];
  par: number;
}) {
  const [scores, setScores] = useState<Record<string, Record<number, string>>>({});
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeMsg, setScrapeMsg] = useState<string | null>(null);

  // Initialize scores from player data
  function getScore(playerId: string, round: number): string {
    if (scores[playerId]?.[round] !== undefined) return scores[playerId][round];
    return "";
  }

  function setScore(playerId: string, round: number, value: string) {
    setScores((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] || {}), [round]: value },
    }));
  }

  async function handleSave() {
    setSaving(true);
    try {
      const updates: Array<{ playerId: string; round: number; strokes: number }> = [];
      for (const [playerId, rounds] of Object.entries(scores)) {
        for (const [round, val] of Object.entries(rounds)) {
          const strokes = parseInt(val, 10);
          if (!isNaN(strokes)) {
            updates.push({ playerId, round: parseInt(round, 10), strokes });
          }
        }
      }

      if (updates.length === 0) {
        alert("No scores to save");
        return;
      }

      const res = await fetch(`/api/admin/scores`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, scores: updates }),
      });

      if (res.ok) {
        alert(`Saved ${updates.length} scores`);
        window.location.reload();
      } else {
        alert("Failed to save scores");
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleScrape() {
    setScraping(true);
    setScrapeMsg(null);
    try {
      const res = await fetch(`/api/scores/refresh?tournamentId=${tournamentId}`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.success) {
        setScrapeMsg(`✅ Updated ${data.updated} scores, created ${data.created}. ${data.unmatched} unmatched.`);
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setScrapeMsg(`⚠️ ${data.error || "Scrape failed"}`);
      }
    } catch {
      setScrapeMsg("⚠️ Network error");
    } finally {
      setScraping(false);
    }
  }

  return (
    <div>
      {/* Action bar */}
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-700">
          Manual Score Entry — par {par}
        </h3>
        <div className="flex gap-2">
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {scraping ? "Fetching..." : "📡 Fetch from CBS"}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg bg-[#1a6b3c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f3d20] disabled:opacity-50"
          >
            {saving ? "Saving..." : "💾 Save Scores"}
          </button>
        </div>
      </div>

      {scrapeMsg && (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
          {scrapeMsg}
        </div>
      )}

      {/* Score grid */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="sticky left-0 z-10 bg-zinc-50 px-3 py-2 text-left">Player</th>
              <th className="px-3 py-2 text-center">R1</th>
              <th className="px-3 py-2 text-center">R2</th>
              <th className="px-3 py-2 text-center">R3</th>
              <th className="px-3 py-2 text-center">R4</th>
              <th className="px-3 py-2 text-center">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {players.map((p) => {
              const existing = [1, 2, 3, 4].map((r) =>
                p.scores.find((s) => s.round === r)?.strokes ?? null
              );
              const total = existing.reduce<number>((sum, s) => sum + (s ?? 0), 0);
              return (
                <tr key={p.id} className="hover:bg-zinc-50">
                  <td className="sticky left-0 z-10 bg-white px-3 py-2 font-medium text-zinc-900">
                    {p.player.name}
                    {p.withdrew && <span className="ml-1 text-xs text-red-500">WD</span>}
                  </td>
                  {[1, 2, 3, 4].map((round) => (
                    <td key={round} className="px-3 py-2 text-center">
                      <input
                        type="number"
                        inputMode="numeric"
                        value={getScore(p.player.id, round)}
                        onChange={(e) => setScore(p.player.id, round, e.target.value)}
                        placeholder={existing[round - 1]?.toString() ?? "—"}
                        className="w-14 rounded border border-zinc-200 px-2 py-1 text-center text-sm outline-none focus:border-[#1a6b3c] focus:ring-1 focus:ring-[#1a6b3c]/30"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center font-bold text-zinc-900">{total || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Teams Tab ----------

function TeamsTab({ teams }: { teams: AdminTeam[] }) {
  return (
    <div className="space-y-3">
      {teams.length === 0 ? (
        <p className="rounded-xl bg-zinc-50 p-8 text-center text-zinc-500">
          No teams entered yet.
        </p>
      ) : (
        teams.map((team, i) => (
          <div key={team.id} className="rounded-xl bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-zinc-400">#{i + 1}</span>
                <h4 className="font-bold text-zinc-900">{team.name}</h4>
                <p className="text-xs text-zinc-500">
                  {team.user.name ?? team.user.email}
                </p>
              </div>
              <div className="text-right">
                <p className="text-lg font-bold text-[#0f3d20]">{team.totalScore || "—"}</p>
                <p className="text-xs text-zinc-500">
                  {team.paid ? "✅ Paid" : "⏳ Unpaid"}
                </p>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1">
              {team.selections.map((sel, idx) => (
                <span
                  key={idx}
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${tierBadgeClass(
                    sel.tournamentPlayer.tier
                  )}`}
                >
                  {sel.tournamentPlayer.player.name}
                </span>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ---------- Settings Tab ----------

function SettingsTab({ tournament }: { tournament: TournamentData }) {
  const [status, setStatus] = useState(tournament.status);
  const [currentRound, setCurrentRound] = useState(tournament.currentRound);
  const [cutLine, setCutLine] = useState(tournament.cutLine?.toString() ?? "");
  const [par, setPar] = useState(tournament.par.toString());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/tournament`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: tournament.id,
          status,
          currentRound: parseInt(currentRound.toString(), 10),
          cutLine: cutLine ? parseInt(cutLine, 10) : null,
          par: parseInt(par, 10),
        }),
      });

      if (res.ok) {
        setMsg("✅ Settings saved");
      } else {
        setMsg("❌ Failed to save");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-md space-y-4">
      <div>
        <label className="mb-1 block text-sm font-semibold text-zinc-700">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
        >
          <option value="upcoming">Upcoming</option>
          <option value="entries_open">Entries Open</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-zinc-700">
          Current Round
        </label>
        <select
          value={currentRound}
          onChange={(e) => setCurrentRound(parseInt(e.target.value, 10))}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
        >
          <option value={0}>Not Started (0)</option>
          <option value={1}>Round 1</option>
          <option value={2}>Round 2</option>
          <option value={3}>Round 3</option>
          <option value={4}>Round 4</option>
          <option value={5}>Completed (5)</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-zinc-700">
          Cut Line (total strokes after R2)
        </label>
        <input
          type="number"
          value={cutLine}
          onChange={(e) => setCutLine(e.target.value)}
          placeholder="e.g. 145"
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-semibold text-zinc-700">Par</label>
        <input
          type="number"
          value={par}
          onChange={(e) => setPar(e.target.value)}
          className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
        />
      </div>

      <div>
        <p className="text-xs text-zinc-500">
          Entry Fee: {formatGBP(tournament.entryFee)} ·{" "}
          {formatDateRange(new Date(tournament.startDate), new Date(tournament.endDate))}
        </p>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="w-full rounded-lg bg-[#1a6b3c] py-2.5 text-sm font-bold text-white transition hover:bg-[#0f3d20] disabled:opacity-50"
      >
        {saving ? "Saving..." : "💾 Save Settings"}
      </button>

      {msg && (
        <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">{msg}</div>
      )}
    </div>
  );
}
