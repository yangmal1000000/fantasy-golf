"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { formatGBP, TIER_CONFIG, tierBadgeClass } from "@/lib/ui";

interface TeamRow {
  id: string;
  name: string;
  paid: boolean;
  totalScore: number;
  position: number | null;
  createdAt: string;
  user: { name: string | null; email: string };
  selections: Array<{ playerName: string; tier: string }>;
}

export default function TeamsManager({
  tournamentId,
  entryFee,
  teams,
}: {
  tournamentId: string;
  entryFee: number;
  teams: TeamRow[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [filter, setFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [search, setSearch] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);

  const filtered = teams.filter((t) => {
    if (filter === "paid" && !t.paid) return false;
    if (filter === "unpaid" && t.paid) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !t.name.toLowerCase().includes(q) &&
        !(t.user.name ?? "").toLowerCase().includes(q) &&
        !t.user.email.toLowerCase().includes(q)
      )
        return false;
    }
    return true;
  });

  const paidCount = teams.filter((t) => t.paid).length;
  const unpaidCount = teams.length - paidCount;
  const revenue = paidCount * entryFee;

  async function togglePaid(teamId: string, currentPaid: boolean) {
    setFeedback("Updating…");
    try {
      const res = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teamId, paid: !currentPaid }),
      });
      if (res.ok) {
        setFeedback(`✅ Marked as ${!currentPaid ? "paid" : "unpaid"}`);
        startTransition(() => router.refresh());
        setTimeout(() => setFeedback(null), 2000);
      } else {
        setFeedback("❌ Failed to update");
      }
    } catch {
      setFeedback("❌ Network error");
    }
  }

  async function handleDelete(teamId: string, name: string) {
    if (!confirm(`Delete team "${name}"? This cannot be undone.`)) return;
    setFeedback("Deleting…");
    try {
      const res = await fetch(`/api/admin/team?teamId=${teamId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFeedback(`✅ Deleted "${name}"`);
        startTransition(() => router.refresh());
      } else {
        setFeedback("❌ Failed to delete");
      }
    } catch {
      setFeedback("❌ Network error");
    }
  }

  function handleExportCSV() {
    const headers = [
      "Position",
      "Team Name",
      "Owner",
      "Email",
      "Paid",
      "Total Score",
      "Selection 1",
      "Selection 2",
      "Selection 3",
      "Selection 4",
      "Selection 5",
      "Entered",
    ];
    const rows = filtered.map((t) => [
      t.position ?? "",
      t.name,
      t.user.name ?? "",
      t.user.email,
      t.paid ? "Yes" : "No",
      t.totalScore || "",
      ...t.selections.map((s) => s.playerName),
      "",
      "",
      "",
      "",
      "",
    ].slice(0, 12));

    // Pad selections to 5
    const csvRows = filtered.map((t) => {
      const sels = [...t.selections];
      while (sels.length < 5) sels.push({ playerName: "", tier: "" });
      return [
        t.position ?? "",
        `"${t.name}"`,
        `"${t.user.name ?? ""}"`,
        t.user.email,
        t.paid ? "Yes" : "No",
        t.totalScore || "",
        ...sels.map((s) => `"${s.playerName}"`),
        new Date(t.createdAt).toLocaleDateString("en-GB"),
      ].join(",");
    });

    const csv = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `teams-${tournamentId}.csv`;
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

      {/* Summary cards */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow-sm ring-1 ring-zinc-200">
          <p className="text-xs font-medium text-zinc-500">Total Teams</p>
          <p className="mt-1 text-xl font-bold text-zinc-900">{teams.length}</p>
        </div>
        <div className="rounded-lg bg-green-50 p-4 ring-1 ring-green-200">
          <p className="text-xs font-medium text-green-700">Paid</p>
          <p className="mt-1 text-xl font-bold text-green-800">{paidCount}</p>
        </div>
        <div className="rounded-lg bg-orange-50 p-4 ring-1 ring-orange-200">
          <p className="text-xs font-medium text-orange-700">Unpaid</p>
          <p className="mt-1 text-xl font-bold text-orange-800">{unpaidCount}</p>
        </div>
        <div className="rounded-lg bg-blue-50 p-4 ring-1 ring-blue-200">
          <p className="text-xs font-medium text-blue-700">Revenue</p>
          <p className="mt-1 text-xl font-bold text-blue-800">
            {formatGBP(revenue)}
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-2">
          <input
            type="search"
            placeholder="Search teams…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 min-w-[200px] rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
          />
          <div className="flex overflow-hidden rounded-lg border border-zinc-300">
            {(["all", "paid", "unpaid"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-2 text-sm font-medium capitalize transition ${
                  filter === f
                    ? "bg-[#1a6b3c] text-white"
                    : "bg-white text-zinc-600 hover:bg-zinc-50"
                }`}
              >
                {f}
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          className="rounded-lg bg-zinc-200 px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-300"
        >
          📥 Export CSV
        </button>
      </div>

      {/* Teams table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-zinc-600">
            <tr className="border-b border-zinc-200">
              <th className="px-4 py-3 text-left font-semibold">Pos</th>
              <th className="px-4 py-3 text-left font-semibold">Team</th>
              <th className="px-4 py-3 text-left font-semibold">Selections</th>
              <th className="px-4 py-3 text-center font-semibold">Score</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-400">
                  No teams found.
                </td>
              </tr>
            )}
            {filtered.map((t, i) => (
              <tr key={t.id} className={i % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}>
                <td className="px-4 py-3 text-center text-zinc-500">
                  {t.position ?? i + 1}
                </td>
                <td className="px-4 py-3">
                  <p className="font-medium text-zinc-900">{t.name}</p>
                  <p className="text-xs text-zinc-500">
                    {t.user.name ?? t.user.email}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {t.selections.map((s, idx) => (
                      <span
                        key={idx}
                        className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                          tierBadgeClass(s.tier)
                        }`}
                      >
                        {s.playerName}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 text-center">
                  <span className="font-bold text-zinc-900">
                    {t.totalScore || "—"}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    onClick={() => togglePaid(t.id, t.paid)}
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold transition ${
                      t.paid
                        ? "bg-green-100 text-green-700 hover:bg-green-200"
                        : "bg-orange-100 text-orange-700 hover:bg-orange-200"
                    }`}
                  >
                    {t.paid ? "✓ Paid" : "⏳ Unpaid"}
                  </button>
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    onClick={() => handleDelete(t.id, t.name)}
                    className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
