"use client";

import { useState } from "react";
import { formatGBP } from "@/lib/ui";

interface TeamSimple {
  id: string;
  name: string;
  position: number | null;
  totalScore: number;
  userName: string;
}

interface PayoutPosition {
  position: number;
  percentage: number;
}

export default function PayoutCalculator({
  tournamentId,
  entryFee,
  prizePool,
  paidTeamCount,
  teams,
  savedStructure,
}: {
  tournamentId: string;
  entryFee: number;
  prizePool: number;
  paidTeamCount: number;
  teams: TeamSimple[];
  savedStructure: PayoutPosition[] | null;
}) {
  const [structure, setStructure] = useState<PayoutPosition[]>(
    savedStructure ?? [
      { position: 1, percentage: 50 },
      { position: 2, percentage: 25 },
      { position: 3, percentage: 15 },
      { position: 4, percentage: 10 },
    ]
  );
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const totalPercent = structure.reduce((sum, p) => sum + p.percentage, 0);

  function updatePercentage(idx: number, value: number) {
    setStructure((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, percentage: value } : p))
    );
  }

  function updatePosition(idx: number, value: number) {
    setStructure((prev) =>
      prev.map((p, i) => (i === idx ? { ...p, position: value } : p))
    );
  }

  function addRow() {
    const nextPos = structure.length + 1;
    setStructure((prev) => [...prev, { position: nextPos, percentage: 5 }]);
  }

  function removeRow(idx: number) {
    setStructure((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setSaving(true);
    setFeedback("Saving…");
    try {
      const res = await fetch("/api/admin/payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tournamentId, payoutStructure: structure }),
      });
      if (res.ok) {
        setFeedback("✅ Payout structure saved");
      } else {
        setFeedback("❌ Failed to save");
      }
    } catch {
      setFeedback("❌ Network error");
    } finally {
      setSaving(false);
    }
  }

  // Get team at a given position
  function getTeamAtPosition(pos: number): TeamSimple | null {
    return teams.find((t) => t.position === pos) ?? null;
  }

  return (
    <div>
      {feedback && (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
          {feedback}
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Prize pool info */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <h3 className="text-sm font-semibold text-zinc-700">Prize Pool</h3>
            <p className="mt-2 text-3xl font-bold text-green-700">
              {formatGBP(prizePool)}
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              {paidTeamCount} paid teams × {formatGBP(entryFee)}
            </p>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200">
            <h3 className="text-sm font-semibold text-zinc-700">
              Allocation Check
            </h3>
            <div className="mt-2">
              <div className="flex justify-between text-sm">
                <span className="text-zinc-500">Total allocated</span>
                <span
                  className={`font-bold ${
                    totalPercent === 100
                      ? "text-green-600"
                      : totalPercent > 100
                      ? "text-red-600"
                      : "text-orange-500"
                  }`}
                >
                  {totalPercent}%
                </span>
              </div>
              {totalPercent !== 100 && (
                <p className="mt-1 text-xs text-orange-500">
                  {totalPercent > 100
                    ? `${totalPercent - 100}% over-allocated`
                    : `${100 - totalPercent}% remaining`}
                </p>
              )}
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200">
                <div
                  className={`h-full transition-all ${
                    totalPercent > 100
                      ? "bg-red-500"
                      : totalPercent === 100
                      ? "bg-green-500"
                      : "bg-orange-400"
                  }`}
                  style={{ width: `${Math.min(totalPercent, 100)}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Payout structure */}
        <div className="lg:col-span-2">
          <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
              <h3 className="font-semibold text-zinc-900">Payout Structure</h3>
              <button
                onClick={addRow}
                className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-200"
              >
                + Add Position
              </button>
            </div>

            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Position</th>
                  <th className="px-4 py-3 text-center font-semibold">%</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                  <th className="px-4 py-3 text-left font-semibold">
                    Current Leader
                  </th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {structure.map((p, idx) => {
                  const amount = Math.round((prizePool * p.percentage) / 100);
                  const leader = getTeamAtPosition(p.position);
                  return (
                    <tr key={idx}>
                      <td className="px-4 py-3">
                        <input
                          type="number"
                          min={1}
                          value={p.position}
                          onChange={(e) =>
                            updatePosition(idx, parseInt(e.target.value) || 1)
                          }
                          className="w-16 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-center outline-none focus:border-[#1a6b3c]"
                        />
                        <span className="ml-1 text-xs text-zinc-400">
                          {ordinal(p.position)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={p.percentage}
                            onChange={(e) =>
                              updatePercentage(
                                idx,
                                Math.max(0, parseInt(e.target.value) || 0)
                              )
                            }
                            className="w-16 rounded-lg border border-zinc-300 px-2 py-1.5 text-sm text-center outline-none focus:border-[#1a6b3c]"
                          />
                          <span className="text-zinc-400">%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-bold text-green-700">
                          {formatGBP(amount)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {leader ? (
                          <div>
                            <p className="text-sm font-medium text-zinc-900">
                              {leader.name}
                            </p>
                            <p className="text-xs text-zinc-500">
                              {leader.totalScore > 0
                                ? `${leader.totalScore} strokes`
                                : "No scores yet"}
                            </p>
                          </div>
                        ) : (
                          <span className="text-xs text-zinc-400">TBD</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => removeRow(idx)}
                          className="rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50"
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="border-t border-zinc-200 p-4">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-[#1a6b3c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f3d20] disabled:opacity-50"
              >
                {saving ? "Saving…" : "💾 Save Payout Structure"}
              </button>
            </div>
          </div>

          {/* Full standings preview */}
          {teams.length > 0 && (
            <div className="mt-6 overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
              <div className="border-b border-zinc-200 px-5 py-4">
                <h3 className="font-semibold text-zinc-900">Current Standings</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-4 py-2 text-left">Pos</th>
                    <th className="px-4 py-2 text-left">Team</th>
                    <th className="px-4 py-2 text-center">Score</th>
                    <th className="px-4 py-2 text-right">Would Win</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {teams.slice(0, 10).map((t, i) => {
                    const payout = structure.find(
                      (s) => s.position === t.position
                    );
                    const amount = payout
                      ? Math.round((prizePool * payout.percentage) / 100)
                      : 0;
                    return (
                      <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}>
                        <td className="px-4 py-2 text-zinc-600">
                          {t.position ?? i + 1}
                        </td>
                        <td className="px-4 py-2 font-medium text-zinc-900">
                          {t.name}
                        </td>
                        <td className="px-4 py-2 text-center">
                          {t.totalScore || "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          {amount > 0 ? (
                            <span className="font-bold text-green-700">
                              {formatGBP(amount)}
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ordinal(n: number): string {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0];
}
