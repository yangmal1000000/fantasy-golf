"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──────────────────────────────────────────────────────────────────

interface TournamentSummary {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  category: string;
  tour: string;
  playersLinked: number;
  status: "created" | "exists";
}

interface SeasonResult {
  ok: boolean;
  year: number;
  created: number;
  skipped: number;
  totalTournaments: number;
  totalLinksCreated: number;
  mensPlayersAvailable: number;
  womensPlayersAvailable: number;
  tournaments: TournamentSummary[];
  error?: string;
}

interface SyncResult {
  ok: boolean;
  ranking?: {
    playersUpdated: number;
    playersMatched: number;
    playersUnmatched: number;
    warnings: string[];
  };
  tiers?: {
    tiersChanged: number;
    totalChecked: number;
  };
  stats?: {
    totalPlayers: number;
    rankedPlayers: number;
  };
  error?: string;
}

interface ESPNTournament {
  name: string;
  startDate: string;
  endDate: string;
  course: string | null;
  status: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

const CATEGORY_LABELS: Record<string, string> = {
  major: "🏆 Major",
  signature: "⭐ Signature",
  playoff: "🎯 Playoff",
  dpwt: "🌍 DPWT",
  lpga_major: "🎀 LPGA Major",
};

const STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-zinc-100 text-zinc-600",
  entries_open: "bg-green-100 text-green-700",
  in_progress: "bg-orange-100 text-orange-700",
  completed: "bg-blue-100 text-blue-700",
};

const STATUS_LABELS: Record<string, string> = {
  upcoming: "Upcoming",
  entries_open: "Open",
  in_progress: "Live",
  completed: "Done",
};

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ── Page Component ─────────────────────────────────────────────────────────

export default function SeasonManagementPage() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear + 1);

  // Create season state
  const [creating, setCreating] = useState(false);
  const [seasonResult, setSeasonResult] = useState<SeasonResult | null>(null);
  const [seasonError, setSeasonError] = useState<string | null>(null);

  // Sync rankings state
  const [syncingOWGR, setSyncingOWGR] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  // ESPN schedule state
  const [fetchingESPN, setFetchingESPN] = useState(false);
  const [pgaSchedule, setPgaSchedule] = useState<ESPNTournament[] | null>(null);
  const [lpgaSchedule, setLpgaSchedule] = useState<ESPNTournament[] | null>(null);
  const [espnError, setEspnError] = useState<string | null>(null);

  // Existing tournaments for the selected year
  const [existingTournaments, setExistingTournaments] = useState<
    Array<{
      id: string;
      name: string;
      status: string;
      category: string;
      tour: string;
      startDate: string;
      endDate: string;
      playerCount: number;
      teamCount: number;
    }>
  >([]);
  const [loadingTournaments, setLoadingTournaments] = useState(false);

  // Load existing tournaments for the year
  const loadExisting = useCallback(async (year: number) => {
    setLoadingTournaments(true);
    try {
      const res = await fetch(`/api/admin/season-tournaments?year=${year}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setExistingTournaments(data.tournaments ?? []);
      } else {
        setExistingTournaments([]);
      }
    } catch {
      setExistingTournaments([]);
    } finally {
      setLoadingTournaments(false);
    }
  }, []);

  useEffect(() => {
    loadExisting(selectedYear);
  }, [selectedYear, loadExisting]);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleCreateSeason() {
    setCreating(true);
    setSeasonError(null);
    setSeasonResult(null);

    try {
      const res = await fetch("/api/admin/create-season", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year: selectedYear }),
      });
      const data: SeasonResult = await res.json();

      if (!res.ok || !data.ok) {
        setSeasonError(data.error ?? `HTTP ${res.status}`);
      } else {
        setSeasonResult(data);
        // Reload existing tournaments
        await loadExisting(selectedYear);
      }
    } catch (e) {
      setSeasonError(String(e));
    } finally {
      setCreating(false);
    }
  }

  async function handleSyncOWGR() {
    setSyncingOWGR(true);
    setSyncError(null);
    setSyncResult(null);

    try {
      const res = await fetch("/api/admin/sync-rankings", { method: "POST" });
      const data: SyncResult = await res.json();

      if (!res.ok || !data.ok) {
        setSyncError(data.error ?? `HTTP ${res.status}`);
      } else {
        setSyncResult(data);
      }
    } catch (e) {
      setSyncError(String(e));
    } finally {
      setSyncingOWGR(false);
    }
  }

  async function handleSyncESPN() {
    setFetchingESPN(true);
    setEspnError(null);
    setPgaSchedule(null);
    setLpgaSchedule(null);

    try {
      const [pgaRes, lpgaRes] = await Promise.all([
        fetch(
          "https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard"
        ),
        fetch(
          "https://site.api.espn.com/apis/site/v2/sports/golf/lpga/scoreboard"
        ),
      ]);

      if (pgaRes.ok) {
        const pgaData = await pgaRes.json();
        const events = (pgaData?.events ?? []).map((ev: any) => ({
          name: String(ev?.name ?? ev?.shortName ?? "Unknown"),
          startDate: String(ev?.date ?? ""),
          endDate: String(ev?.endDate ?? ev?.date ?? ""),
          course:
            (ev?.competitions?.[0] as any)?.details
              ? String(
                  ((ev.competitions[0] as any).details as any)
                    ?.course?.fullName ?? "—"
                )
              : (ev?.venue as any)?.fullName
              ? String((ev.venue as any).fullName)
              : null,
          status: String(
            (ev?.status as any)?.type
              ? (((ev.status as any).type as any)
                  ?.name as string) ?? "scheduled"
              : "scheduled"
          ),
        }));
        setPgaSchedule(events);
      }

      if (lpgaRes.ok) {
        const lpgaData = await lpgaRes.json();
        const events = (lpgaData?.events ?? []).map((ev: any) => ({
          name: String(ev?.name ?? ev?.shortName ?? "Unknown"),
          startDate: String(ev?.date ?? ""),
          endDate: String(ev?.endDate ?? ev?.date ?? ""),
          course:
            (ev?.competitions?.[0] as any)?.details
              ? String(
                  ((ev.competitions[0] as any).details as any)
                    ?.course?.fullName ?? "—"
                )
              : (ev?.venue as any)?.fullName
              ? String((ev.venue as any).fullName)
              : null,
          status: String(
            (ev?.status as any)?.type
              ? (((ev.status as any).type as any)
                  ?.name as string) ?? "scheduled"
              : "scheduled"
          ),
        }));
        setLpgaSchedule(events);
      }

      if (!pgaRes.ok && !lpgaRes.ok) {
        setEspnError("Failed to fetch both PGA and LPGA schedules from ESPN.");
      }
    } catch (e) {
      setEspnError(String(e));
    } finally {
      setFetchingESPN(false);
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Season Management</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Generate a full tournament season and sync player rankings
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ── Create Season ─────────────────────────────────────────────── */}
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="font-semibold text-zinc-900">📅 Create Season</h2>
            <p className="text-xs text-zinc-500">
              Generate all 15 tournaments for a given year
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-end gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-600 mb-1">
                  Year
                </label>
                <input
                  type="number"
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  min={2024}
                  max={2100}
                  className="w-28 rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-green-600 focus:outline-none focus:ring-1 focus:ring-green-600"
                />
              </div>
              <button
                onClick={handleCreateSeason}
                disabled={creating}
                className={`rounded-lg px-5 py-2 text-sm font-semibold text-white transition ${
                  creating
                    ? "cursor-wait bg-zinc-400"
                    : "bg-green-700 hover:bg-green-800"
                }`}
              >
                {creating ? "Generating…" : "Generate Season"}
              </button>
            </div>

            {/* Season result */}
            {seasonError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <p className="font-semibold">Error</p>
                <p className="mt-1">{seasonError}</p>
              </div>
            )}

            {seasonResult && (
              <div className="rounded-lg bg-green-50 border border-green-200 p-4 text-sm">
                <p className="font-semibold text-green-800">
                  ✅ Season {seasonResult.year} generated
                </p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-green-700">
                  <p>Created: <strong>{seasonResult.created}</strong></p>
                  <p>Already existed: <strong>{seasonResult.skipped}</strong></p>
                  <p>Total tournaments: <strong>{seasonResult.totalTournaments}</strong></p>
                  <p>Player links: <strong>{seasonResult.totalLinksCreated}</strong></p>
                  <p>Men&apos;s pool: <strong>{seasonResult.mensPlayersAvailable}</strong></p>
                  <p>Women&apos;s pool: <strong>{seasonResult.womensPlayersAvailable}</strong></p>
                </div>

                {/* Tournament breakdown */}
                <div className="mt-3 max-h-64 overflow-y-auto rounded-md bg-white border border-green-100">
                  <table className="w-full text-xs">
                    <thead className="bg-green-50 text-green-800 sticky top-0">
                      <tr>
                        <th className="text-left px-3 py-2">Tournament</th>
                        <th className="text-left px-3 py-2">Dates</th>
                        <th className="text-left px-3 py-2">Cat</th>
                        <th className="text-right px-3 py-2">Players</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-100">
                      {seasonResult.tournaments.map((t) => (
                        <tr key={t.id}>
                          <td className="px-3 py-1.5 text-zinc-700">{t.name}</td>
                          <td className="px-3 py-1.5 text-zinc-500">
                            {formatDate(t.startDate)}
                          </td>
                          <td className="px-3 py-1.5 text-zinc-500">
                            {CATEGORY_LABELS[t.category] ?? t.category}
                          </td>
                          <td className="px-3 py-1.5 text-right text-zinc-600">
                            {t.playersLinked}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Sync Rankings ────────────────────────────────────────────── */}
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="font-semibold text-zinc-900">🔄 Sync Rankings</h2>
            <p className="text-xs text-zinc-500">
              Update player rankings from external sources
            </p>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSyncOWGR}
                disabled={syncingOWGR}
                className={`rounded-lg px-5 py-2 text-sm font-semibold text-white transition ${
                  syncingOWGR
                    ? "cursor-wait bg-zinc-400"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {syncingOWGR ? "Syncing…" : "Sync from OWGR"}
              </button>
              <button
                onClick={handleSyncESPN}
                disabled={fetchingESPN}
                className={`rounded-lg px-5 py-2 text-sm font-semibold text-white transition ${
                  fetchingESPN
                    ? "cursor-wait bg-zinc-400"
                    : "bg-orange-600 hover:bg-orange-700"
                }`}
              >
                {fetchingESPN ? "Fetching…" : "Fetch ESPN Schedule"}
              </button>
            </div>

            {/* OWGR sync result */}
            {syncError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-700">
                <p className="font-semibold">Sync Error</p>
                <p className="mt-1">{syncError}</p>
              </div>
            )}

            {syncResult && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 p-4 text-sm">
                <p className="font-semibold text-blue-800">
                  ✅ Rankings synced
                </p>
                <div className="mt-2 space-y-1 text-blue-700">
                  <p>Players updated: <strong>{syncResult.ranking?.playersUpdated ?? 0}</strong></p>
                  <p>Players matched: <strong>{syncResult.ranking?.playersMatched ?? 0}</strong></p>
                  <p>Players unmatched: <strong>{syncResult.ranking?.playersUnmatched ?? 0}</strong></p>
                  <p>Tiers changed: <strong>{syncResult.tiers?.tiersChanged ?? 0}</strong> / {syncResult.tiers?.totalChecked ?? 0} checked</p>
                  <p>Ranked players in DB: <strong>{syncResult.stats?.rankedPlayers ?? 0}</strong> / {syncResult.stats?.totalPlayers ?? 0}</p>
                </div>
                {syncResult.ranking?.warnings &&
                  syncResult.ranking.warnings.length > 0 && (
                    <div className="mt-2 rounded bg-white/60 p-2 text-xs text-blue-600">
                      {syncResult.ranking.warnings.map((w, i) => (
                        <p key={i}>{w}</p>
                      ))}
                    </div>
                  )}
              </div>
            )}

            {/* ESPN schedule result */}
            {espnError && (
              <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 text-sm text-orange-700">
                <p className="font-semibold">ESPN Fetch Error</p>
                <p className="mt-1">{espnError}</p>
              </div>
            )}

            {(pgaSchedule || lpgaSchedule) && (
              <div className="space-y-3">
                {pgaSchedule && (
                  <div className="rounded-lg bg-white border border-zinc-200 overflow-hidden">
                    <div className="bg-orange-50 px-3 py-2 border-b border-orange-100">
                      <p className="text-xs font-bold text-orange-700">
                        PGA Tour ({pgaSchedule.length} events this week)
                      </p>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {pgaSchedule.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-zinc-400">No events currently listed.</p>
                      ) : (
                        pgaSchedule.map((ev, i) => (
                          <div key={i} className="px-3 py-2 border-b border-zinc-50 text-xs">
                            <p className="font-medium text-zinc-700">{ev.name}</p>
                            <p className="text-zinc-400">
                              {ev.startDate ? formatDate(ev.startDate) : "TBD"}
                              {ev.course ? ` · ${ev.course}` : ""}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {lpgaSchedule && (
                  <div className="rounded-lg bg-white border border-zinc-200 overflow-hidden">
                    <div className="bg-pink-50 px-3 py-2 border-b border-pink-100">
                      <p className="text-xs font-bold text-pink-700">
                        LPGA Tour ({lpgaSchedule.length} events this week)
                      </p>
                    </div>
                    <div className="max-h-40 overflow-y-auto">
                      {lpgaSchedule.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-zinc-400">No events currently listed.</p>
                      ) : (
                        lpgaSchedule.map((ev, i) => (
                          <div key={i} className="px-3 py-2 border-b border-zinc-50 text-xs">
                            <p className="font-medium text-zinc-700">{ev.name}</p>
                            <p className="text-zinc-400">
                              {ev.startDate ? formatDate(ev.startDate) : "TBD"}
                              {ev.course ? ` · ${ev.course}` : ""}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Current Season Overview ───────────────────────────────────── */}
      <div className="mt-8 rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
        <div className="border-b border-zinc-200 px-5 py-4 flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-zinc-900">
              📋 {selectedYear} Season Overview
            </h2>
            <p className="text-xs text-zinc-500">
              Tournaments currently in the database for this year
            </p>
          </div>
        </div>

        {loadingTournaments ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-400">
            Loading tournaments…
          </div>
        ) : existingTournaments.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-zinc-400">
            No tournaments found for {selectedYear}. Generate a season above.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="text-left px-5 py-3 font-medium">Tournament</th>
                  <th className="text-left px-5 py-3 font-medium">Category</th>
                  <th className="text-left px-5 py-3 font-medium">Dates</th>
                  <th className="text-left px-5 py-3 font-medium">Status</th>
                  <th className="text-right px-5 py-3 font-medium">Players</th>
                  <th className="text-right px-5 py-3 font-medium">Teams</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {existingTournaments.map((t) => (
                  <tr key={t.id} className="hover:bg-zinc-50">
                    <td className="px-5 py-3 font-medium text-zinc-900">
                      {t.name}
                    </td>
                    <td className="px-5 py-3 text-zinc-500">
                      {CATEGORY_LABELS[t.category] ?? t.category}
                    </td>
                    <td className="px-5 py-3 text-zinc-500">
                      {formatDate(t.startDate)} – {formatDate(t.endDate)}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          STATUS_COLORS[t.status] ?? STATUS_COLORS.upcoming
                        }`}
                      >
                        {STATUS_LABELS[t.status] ?? t.status}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-600">
                      {t.playerCount}
                    </td>
                    <td className="px-5 py-3 text-right text-zinc-600">
                      {t.teamCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
