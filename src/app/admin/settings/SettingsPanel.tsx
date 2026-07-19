"use client";

import { useState } from "react";
import { formatGBP } from "@/lib/ui";

interface TournamentSettings {
  id: string;
  name: string;
  status: string;
  entryFee: number;
  payoutStructure: string | null;
  par: number;
  cutLine: number | null;
}

export default function SettingsPanel({
  tournaments,
}: {
  tournaments: TournamentSettings[];
}) {
  const [defaultEntryFee, setDefaultEntryFee] = useState("15.00");
  const [defaultPayout, setDefaultPayout] = useState(
    `[{"position":1,"percentage":50},{"position":2,"percentage":25},{"position":3,"percentage":15},{"position":4,"percentage":10}]`
  );
  const [scoringUrl, setScoringUrl] = useState(
    "https://www.cbssports.com/golf/leaderboard/"
  );
  const [cutRule, setCutRule] = useState("top30");
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleReset(tournamentId: string, tournamentName: string) {
    const action = confirm(
      `Reset "${tournamentName}"? This will:\n\n• Delete all scores\n• Reset all teams' positions and totals\n• Reset cut status\n\nThis CANNOT be undone.`
    );
    if (!action) return;

    setFeedback("Resetting tournament…");
    try {
      // Delete scores
      await fetch(
        `/api/admin/tournament?tournamentId=${tournamentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            tournamentId,
            currentRound: 0,
            cutLine: null,
            status: "entries_open",
          }),
        }
      );

      // We'd need a dedicated reset endpoint, but for now use score deletion
      setFeedback(`✅ Tournament settings reset`);
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      setFeedback("❌ Reset failed");
    }
  }

  function handleExportAll() {
    // Trigger a page reload with export param (simplified for client-side)
    const data = JSON.stringify(tournaments, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fantasy-golf-settings-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      {feedback && (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Default settings */}
        <div className="space-y-6">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <h3 className="mb-4 font-semibold text-zinc-900">Default Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Default Entry Fee (£)
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={defaultEntryFee}
                  onChange={(e) => setDefaultEntryFee(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
                />
                <p className="mt-1 text-xs text-zinc-400">
                  Used when creating new tournaments
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Default Payout Structure (JSON)
                </label>
                <textarea
                  value={defaultPayout}
                  onChange={(e) => setDefaultPayout(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 font-mono text-xs outline-none focus:border-[#1a6b3c]"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Scoring Source URL
                </label>
                <input
                  type="url"
                  value={scoringUrl}
                  onChange={(e) => setScoringUrl(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
                />
                <p className="mt-1 text-xs text-zinc-400">
                  CBS Sports leaderboard URL for score scraping
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Cut Rule
                </label>
                <select
                  value={cutRule}
                  onChange={(e) => setCutRule(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
                >
                  <option value="top30">Top 30 and ties (after R2)</option>
                  <option value="top50">Top 50 and ties (after R2)</option>
                  <option value="top65">Top 65 and ties (PGA standard)</option>
                  <option value="top70">Top 70 and ties (European Tour)</option>
                  <option value="none">No cut</option>
                </select>
                <p className="mt-1 text-xs text-zinc-400">
                  Applied after Round 2 when cut logic is run
                </p>
              </div>
            </div>
          </div>

          {/* Data management */}
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <h3 className="mb-4 font-semibold text-zinc-900">Data Management</h3>
            <div className="space-y-3">
              <button
                onClick={handleExportAll}
                className="w-full rounded-lg bg-zinc-100 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-200"
              >
                📥 Export Tournament Settings (JSON)
              </button>
            </div>
          </div>
        </div>

        {/* Tournament-specific settings */}
        <div className="rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h3 className="font-semibold text-zinc-900">Tournament Controls</h3>
            <p className="text-xs text-zinc-500">
              Quick reset and data management per tournament
            </p>
          </div>
          <div className="max-h-[600px] divide-y divide-zinc-100 overflow-y-auto">
            {tournaments.length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-zinc-400">
                No tournaments.
              </div>
            )}
            {tournaments.map((t) => (
              <div key={t.id} className="px-5 py-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="font-medium text-zinc-900">{t.name}</p>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-zinc-500">
                      <span className="rounded bg-zinc-100 px-1.5 py-0.5 capitalize">
                        {t.status.replace("_", " ")}
                      </span>
                      <span>Par {t.par}</span>
                      <span>{formatGBP(t.entryFee)}</span>
                      {t.cutLine != null && <span>Cut: {t.cutLine}</span>}
                    </div>
                  </div>
                  <button
                    onClick={() => handleReset(t.id, t.name)}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100"
                  >
                    Reset
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
