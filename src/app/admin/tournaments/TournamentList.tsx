"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatGBP, formatDateRange, STATUS_CONFIG } from "@/lib/ui";

interface TournamentItem {
  id: string;
  name: string;
  course: string | null;
  status: string;
  currentRound: number;
  par: number;
  cutLine: number | null;
  entryFee: number;
  startDate: string;
  endDate: string;
  teamCount: number;
  paidCount: number;
  playerCount: number;
  revenue: number;
}

export default function TournamentList({
  tournaments,
}: {
  tournaments: TournamentItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This removes ALL teams, scores, and players. This cannot be undone.`))
      return;
    setFeedback("Deleting…");
    try {
      const res = await fetch(`/api/admin/tournament?tournamentId=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setFeedback(`✅ Deleted "${name}"`);
        startTransition(() => router.refresh());
      } else {
        const data = await res.json();
        setFeedback(`❌ ${data.error ?? "Delete failed"}`);
      }
    } catch {
      setFeedback("❌ Network error");
    }
    setDeleteConfirmId(null);
  }

  return (
    <div>
      {feedback && (
        <div className="mb-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm">
          {feedback}
        </div>
      )}

      {/* Action bar */}
      <div className="mb-4 flex justify-end">
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-lg bg-[#1a6b3c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f3d20]"
        >
          {showCreate ? "Cancel" : "+ New Tournament"}
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <CreateForm
          onDone={() => {
            setShowCreate(false);
            startTransition(() => router.refresh());
          }}
        />
      )}

      {/* Tournament list */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-zinc-200">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-zinc-50 text-zinc-600">
            <tr className="border-b border-zinc-200">
              <th className="px-4 py-3 text-left font-semibold">Tournament</th>
              <th className="px-4 py-3 text-center font-semibold">Status</th>
              <th className="px-4 py-3 text-center font-semibold">Teams</th>
              <th className="px-4 py-3 text-center font-semibold">Players</th>
              <th className="px-4 py-3 text-right font-semibold">Revenue</th>
              <th className="px-4 py-3 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {tournaments.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-zinc-400">
                  No tournaments yet. Click "New Tournament" to create one.
                </td>
              </tr>
            )}
            {tournaments.map((t, i) => (
              <>
                <tr
                  key={t.id}
                  className={i % 2 === 0 ? "bg-white" : "bg-zinc-50/50"}
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/tournaments/${t.id}/players`}
                      className="font-medium text-[#1a6b3c] hover:underline"
                    >
                      {t.name}
                    </Link>
                    <p className="text-xs text-zinc-500">
                      {t.course ?? "—"} ·{" "}
                      {formatDateRange(new Date(t.startDate), new Date(t.endDate))}
                    </p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span
                      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                        STATUS_CONFIG[t.status]?.badgeClass ??
                        "bg-zinc-100 text-zinc-600"
                      }`}
                    >
                      {STATUS_CONFIG[t.status]?.label ?? t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-zinc-900">{t.teamCount}</span>
                    <span className="text-xs text-zinc-400">
                      {" "}
                      ({t.paidCount} paid)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center text-zinc-700">
                    {t.playerCount}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-green-700">
                    {formatGBP(t.revenue)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      <button
                        onClick={() =>
                          setEditingId(editingId === t.id ? null : t.id)
                        }
                        className="rounded bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(t.id, t.name)}
                        className="rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
                {editingId === t.id && (
                  <tr key={`${t.id}-edit`}>
                    <td colSpan={6} className="bg-zinc-50 px-4 py-4">
                      <EditForm tournament={t} onDone={() => {
                        setEditingId(null);
                        startTransition(() => router.refresh());
                      }} />
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------- Create Form ----------

function CreateForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [course, setCourse] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [par, setPar] = useState("72");
  const [entryFee, setEntryFee] = useState("15.00");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) return setError("Name is required");
    if (!startDate || !endDate)
      return setError("Start and end dates are required");

    setSaving(true);
    try {
      const res = await fetch("/api/admin/tournament", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          course: course.trim() || undefined,
          startDate,
          endDate,
          par: parseInt(par) || 72,
          entryFee: Math.round(parseFloat(entryFee) * 100),
        }),
      });

      if (res.ok) {
        onDone();
      } else {
        const data = await res.json();
        setError(data.error ?? "Failed to create");
      }
    } catch {
      setError("Network error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-6 rounded-xl bg-white p-5 shadow-sm ring-1 ring-zinc-200"
    >
      <h3 className="mb-4 font-semibold text-zinc-900">New Tournament</h3>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name *">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="The Open"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
          />
        </Field>
        <Field label="Course">
          <input
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            placeholder="Royal Birkdale"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
          />
        </Field>
        <Field label="Start Date *">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
          />
        </Field>
        <Field label="End Date *">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
          />
        </Field>
        <Field label="Par">
          <input
            type="number"
            value={par}
            onChange={(e) => setPar(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
          />
        </Field>
        <Field label="Entry Fee (£)">
          <input
            type="number"
            step="0.01"
            value={entryFee}
            onChange={(e) => setEntryFee(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
          />
        </Field>
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#1a6b3c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f3d20] disabled:opacity-50"
        >
          {saving ? "Creating…" : "Create Tournament"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

// ---------- Edit Form ----------

function EditForm({
  tournament,
  onDone,
}: {
  tournament: TournamentItem;
  onDone: () => void;
}) {
  const [name, setName] = useState(tournament.name);
  const [course, setCourse] = useState(tournament.course ?? "");
  const [status, setStatus] = useState(tournament.status);
  const [currentRound, setCurrentRound] = useState(tournament.currentRound);
  const [par, setPar] = useState(tournament.par.toString());
  const [cutLine, setCutLine] = useState(
    tournament.cutLine?.toString() ?? ""
  );
  const [entryFee, setEntryFee] = useState(
    (tournament.entryFee / 100).toFixed(2)
  );
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch("/api/admin/tournament", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tournamentId: tournament.id,
          name,
          course: course || null,
          status,
          currentRound: parseInt(currentRound.toString()),
          par: parseInt(par),
          cutLine: cutLine ? parseInt(cutLine) : null,
          entryFee: Math.round(parseFloat(entryFee) * 100),
        }),
      });
      onDone();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
          />
        </Field>
        <Field label="Course">
          <input
            value={course}
            onChange={(e) => setCourse(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
          />
        </Field>
        <Field label="Status">
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
        </Field>
        <Field label="Current Round">
          <select
            value={currentRound}
            onChange={(e) => setCurrentRound(parseInt(e.target.value))}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
          >
            <option value={0}>Not Started</option>
            <option value={1}>Round 1</option>
            <option value={2}>Round 2</option>
            <option value={3}>Round 3</option>
            <option value={4}>Round 4</option>
            <option value={5}>Completed</option>
          </select>
        </Field>
        <Field label="Par">
          <input
            type="number"
            value={par}
            onChange={(e) => setPar(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
          />
        </Field>
        <Field label="Cut Line">
          <input
            type="number"
            value={cutLine}
            onChange={(e) => setCutLine(e.target.value)}
            placeholder="—"
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
          />
        </Field>
        <Field label="Entry Fee (£)">
          <input
            type="number"
            step="0.01"
            value={entryFee}
            onChange={(e) => setEntryFee(e.target.value)}
            className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-[#1a6b3c]"
          />
        </Field>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-[#1a6b3c] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0f3d20] disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="rounded-lg bg-zinc-100 px-4 py-2 text-sm font-semibold text-zinc-600 hover:bg-zinc-200"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
        {label}
      </label>
      {children}
    </div>
  );
}
