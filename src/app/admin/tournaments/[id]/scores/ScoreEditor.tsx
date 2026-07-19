"use client";

import { useState } from "react";

interface PlayerScoreData {
  playerId: string;
  tournamentPlayerId: string;
  name: string;
  rank: number | null;
  tier: string;
  madeCut: boolean | null;
  withdrew: boolean;
  scores: Array<{ strokes: number | null; isEstimated: boolean } | null>;
  total: number;
  playedRounds: number;
}

export default function ScoreEditor({
  tournamentId,
  par,
  currentRound,
  players,
}: {
  tournamentId: string;
  par: number;
  currentRound: number;
  players: PlayerScoreData[];
}) {
  const [editedScores, setEditedScores] = useState<
    Record<string, Record<number, string>>
  >({});
  const [saving, setSaving] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  function getCellValue(playerId: string, round: number): string {
    if (editedScores[playerId]?.[round] !== undefined)
      return editedScores[playerId][round];
    return "";
  }

  function getDisplayValue(
    p: PlayerScoreData,
    round: number
  ): string {
    const edited = getCellValue(p.playerId, round);
    if (edited !== "") return edited;
    return p.scores[round]?.strokes?.toString() ?? "";
  }

  function setCellValue(playerId: string, round: number, value: string) {
    setEditedScores((prev) => ({
      ...prev,
      [playerId]: { ...(prev[playerId] || {}), [round]: value },
    }));
  }

  function getTotal(p: PlayerScoreData): number {
    let total = 0;
    for (let r = 0; r < 4; r++) {
      const edited = getCellValue(p.playerId, r + 1);
      if (edited !== "") {
        const n = parseInt(edited, 10);
        if (!isNaN(n)) total += n;
      } else {
        total += p.scores[r]?.strokes ?? 0;
      }
    }
    return total;
  }

  function getPlayedRounds(p: PlayerScoreData): number {
    let count = 0;
    for (let r = 0; r < 4; r++) {
      const edited = getCellValue(p.playerId, r + 1);
      if (edited !== "") {
        if (parseInt(edited, 10)) count++;
      } else if (p.scores[r]?.strokes != null) {
        count++;
      }
    }
    return count;
  }

  async function handleSave() {
    const updates: Array<{
      playerId: string;
      round: number;
      strokes: number;
    }> = [];

    for (const [playerId, rounds] of Object.entries(editedScores)) {
      for (const [round, val] of Object.entries(rounds)) {
        const strokes = parseInt(val, 10);
        if (!isNaN(strokes)) {
          updates.push({
            playerId,
            round: parseInt(round, 10),
            strokes,
          });
        }
      }
    }

    if (updates.length === 0) {
      setFeedback("No scores to save");
      return;
    }

    setSaving(true);
    setFeedback("Saving…");
    try {
      const res = await fetch("/api/admin/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, scores: updates }),
      });

      if (res.ok) {
        const data = await res.json();
        setFeedback(`✅ Saved ${updates.length} scores (${data.created} new, ${data.updated} updated)`);
        setEditedScores({});
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setFeedback("❌ Failed to save scores");
      }
    } catch {
      setFeedback("❌ Network error");
    } finally {
      setSaving(false);
    }
  }

  async function handleScrape() {
    setScraping(true);
    setFeedback("Fetching from CBS Sports…");
    try {
      const res = await fetch(
        `/api/scores/refresh?tournamentId=${tournamentId}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.success) {
        setFeedback(
          `✅ Scraped ${data.playersScraped} players: ${data.updated} updated, ${data.created} created, ${data.unmatched} unmatched`
        );
        setTimeout(() => window.location.reload(), 2000);
      } else {
        setFeedback(`⚠️ ${data.error ?? "Scrape failed"}`);
      }
    } catch {
      setFeedback("⚠️ Network error");
    } finally {
      setScraping(false);
    }
  }

  function handleBulkApply() {
    if (!bulkText.trim()) {
      setFeedback("Paste some data first");
      return;
    }

    const lines = bulkText.trim().split("\n");
    const newEdits: Record<string, Record<number, string>> = {};
    let matched = 0;

    for (const line of lines) {
      const parts = line.split(",").map((s) => s.trim());
      if (parts.length < 2) continue;

      const name = parts[0];
      const scoreParts = parts.slice(1);

      // Find player by fuzzy name match
      const player = players.find(
        (p) =>
          p.name.toLowerCase().includes(name.toLowerCase()) ||
          name.toLowerCase().includes(p.name.toLowerCase())
      );

      if (!player) continue;

      newEdits[player.playerId] = newEdits[player.playerId] || {};

      for (let i = 0; i < Math.min(4, scoreParts.length); i++) {
        const val = parseInt(scoreParts[i], 10);
        if (!isNaN(val)) {
          newEdits[player.playerId][i + 1] = val.toString();
          matched++;
        }
      }
    }

    if (matched === 0) {
      setFeedback(
        "No scores matched. Use format: Player Name,72,71,70,69"
      );
      return;
    }

    setEditedScores((prev) => {
      const merged = { ...prev };
      for (const [pid, rounds] of Object.entries(newEdits)) {
        merged[pid] = { ...(merged[pid] || {}), ...rounds };
      }
      return merged;
    });
    setFeedback(
      `✅ Applied ${matched} scores. Review then click Save.`
    );
    setBulkMode(false);
    setBulkText("");
  }

  const hasEdits = Object.keys(editedScores).length > 0;

  return (
    <div>
      {feedback && (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
          {feedback}
        </div>
      )}

      {/* Action bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
          >
            {scraping ? "Fetching…" : "📡 Fetch from CBS"}
          </button>
          <button
            onClick={() => setBulkMode(!bulkMode)}
            className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-300"
          >
            📋 {bulkMode ? "Close Bulk" : "Bulk Paste"}
          </button>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hasEdits}
          className="rounded-lg bg-[#1a6b3c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f3d20] disabled:opacity-50"
        >
          {saving
            ? "Saving…"
            : hasEdits
            ? `💾 Save ${Object.values(editedScores).reduce((a, r) => a + Object.keys(r).length, 0)} Scores`
            : "💾 Save Scores"}
        </button>
      </div>

      {/* Bulk paste area */}
      {bulkMode && (
        <div className="mb-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-zinc-200">
          <h3 className="mb-2 font-semibold text-zinc-900">Bulk Score Paste</h3>
          <p className="mb-2 text-xs text-zinc-500">
            Paste data in format: <code>Player Name,R1,R2,R3,R4</code> (one per line)
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
            placeholder={"Scottie Scheffler,69,68,71,70\nRory McIlroy,70,70,69,68"}
            className="w-full rounded-lg border border-zinc-300 p-3 font-mono text-sm outline-none focus:border-[#1a6b3c]"
          />
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleBulkApply}
              className="rounded-lg bg-[#1a6b3c] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0f3d20]"
            >
              Apply to Grid
            </button>
            <button
              onClick={() => {
                setBulkText("");
                setBulkMode(false);
              }}
              className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Score grid */}
      <div className="overflow-x-auto rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10 bg-zinc-50 text-zinc-600 shadow-sm">
            <tr className="border-b border-zinc-200">
              <th className="sticky left-0 z-20 bg-zinc-50 px-3 py-3 text-left font-semibold">
                Player
              </th>
              <th className="px-3 py-3 text-center font-semibold">R1</th>
              <th className="px-3 py-3 text-center font-semibold">R2</th>
              <th className="px-3 py-3 text-center font-semibold">R3</th>
              <th className="px-3 py-3 text-center font-semibold">R4</th>
              <th className="px-3 py-3 text-center font-semibold">Total</th>
              <th className="px-3 py-3 text-center font-semibold">vs Par</th>
              <th className="px-3 py-3 text-center font-semibold">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {players.map((p, idx) => {
              const total = getTotal(p);
              const played = getPlayedRounds(p);
              const vsPar = total - par * played;
              const isEdited = (round: number) =>
                editedScores[p.playerId]?.[round] !== undefined;
              const isEstimated = (round: number) =>
                p.scores[round]?.isEstimated === true;

              let rowBg = idx % 2 === 0 ? "bg-white" : "bg-zinc-50/50";
              if (p.withdrew) rowBg = "bg-gray-100 opacity-60";
              else if (p.madeCut === false && played >= 2) rowBg = "bg-red-50/40";
              else if (p.madeCut === true) rowBg = "bg-green-50/30";

              return (
                <tr key={p.playerId} className={`${rowBg} hover:opacity-100`}>
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <span className="font-medium text-zinc-900">{p.name}</span>
                      {p.withdrew && (
                        <span className="rounded bg-gray-300 px-1 text-xs text-gray-700">
                          WD
                        </span>
                      )}
                    </div>
                    {p.rank && (
                      <span className="text-xs text-zinc-400">#{p.rank}</span>
                    )}
                  </td>
                  {[0, 1, 2, 3].map((roundIdx) => {
                    const round = roundIdx + 1;
                    const val = getDisplayValue(p, roundIdx);
                    const edited = isEdited(round);
                    const estimated = isEstimated(roundIdx);
                    return (
                      <td key={round} className="px-3 py-2 text-center">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={val}
                          onChange={(e) =>
                            setCellValue(p.playerId, round, e.target.value)
                          }
                          disabled={p.withdrew}
                          placeholder="—"
                          className={`w-14 rounded border px-2 py-1 text-center text-sm outline-none transition disabled:bg-transparent disabled:border-transparent disabled:text-gray-400 ${
                            edited
                              ? "border-[#1a6b3c] bg-green-50 font-semibold text-green-800"
                              : estimated
                              ? "border-dashed border-amber-300 bg-amber-50 text-amber-700"
                              : "border-zinc-200 text-zinc-700 focus:border-[#1a6b3c] focus:ring-1 focus:ring-[#1a6b3c]/30"
                          }`}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-center">
                    <span className="font-bold text-zinc-900">
                      {total > 0 ? total : "—"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-center">
                    {total > 0 ? (
                      <span
                        className={`font-semibold ${
                          vsPar < 0
                            ? "text-green-600"
                            : vsPar > 0
                            ? "text-red-500"
                            : "text-zinc-500"
                        }`}
                      >
                        {vsPar > 0 ? "+" : ""}
                        {vsPar}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {p.withdrew ? (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-xs text-gray-600">
                        WD
                      </span>
                    ) : p.madeCut === false ? (
                      <span className="rounded bg-red-100 px-1.5 py-0.5 text-xs font-semibold text-red-700">
                        Missed Cut
                      </span>
                    ) : p.madeCut === true ? (
                      <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs font-semibold text-green-700">
                        Made Cut
                      </span>
                    ) : (
                      <span className="text-xs text-zinc-400">
                        {played}/4
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
            {players.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center text-zinc-400">
                  No players in this tournament yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border border-[#1a6b3c] bg-green-50"></span>
          Edited (unsaved)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded border border-dashed border-amber-300 bg-amber-50"></span>
          Estimated (cut average)
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-red-50/40 border border-red-200"></span>
          Missed cut
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-green-50/30 border border-green-200"></span>
          Made cut
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded bg-gray-100 border border-gray-300"></span>
          Withdrew
        </span>
      </div>
    </div>
  );
}
