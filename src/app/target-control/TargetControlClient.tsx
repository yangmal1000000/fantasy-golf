"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import TargetPanelReview from "@/components/TargetPanelReview";
import type {
  TargetJudgeControlDto,
  TargetJudgePanelMember,
} from "@/lib/target-judge-core";

const EMPTY_PANEL: TargetJudgePanelMember[] = [1, 2, 3].map(() => ({
  email: "",
  displayName: "",
  credential: "",
}));

export default function TargetControlClient() {
  const [data, setData] = useState<TargetJudgeControlDto | null>(null);
  const [panel, setPanel] = useState<TargetJudgePanelMember[]>(EMPTY_PANEL);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyData = useCallback((next: TargetJudgeControlDto) => {
    setData(next);
    if (next.assignments.length === 3) {
      setPanel(next.assignments.map((assignment) => ({
        email: assignment.email ?? "",
        displayName: assignment.displayName,
        credential: assignment.credential,
      })));
    }
  }, []);

  const load = useCallback(async () => {
    const response = await fetch("/api/target-control", { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Unable to load Target control");
    applyData(body as TargetJudgeControlDto);
  }, [applyData]);

  useEffect(() => {
    let active = true;
    fetch("/api/target-control", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load Target control");
        return body as TargetJudgeControlDto;
      })
      .then((body) => {
        if (!active) return;
        setData(body);
        if (body.assignments.length === 3) {
          setPanel(body.assignments.map((assignment) => ({
            email: assignment.email ?? "",
            displayName: assignment.displayName,
            credential: assignment.credential,
          })));
        }
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load Target control");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function mutate(action: string, payload?: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/target-control", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to update Target control");
      applyData(body as TargetJudgeControlDto);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to update Target control");
    } finally {
      setBusy(false);
    }
  }

  function updatePanel(index: number, field: keyof TargetJudgePanelMember, value: string) {
    setPanel((current) => current.map((member, i) => i === index ? { ...member, [field]: value } : member));
  }

  const round = data?.round ?? null;
  const assignments = data?.assignments ?? [];
  const auditEvents = data?.auditEvents ?? [];
  const panelReady = panel.every((member) => member.email.trim() && member.displayName.trim() && member.credential.trim().length >= 5);

  return (
    <div className="min-h-screen bg-[#f6f4ee] pb-20 dark:bg-[#0d0f0e] sm:pb-10">
      <div className="border-b border-[#c8a951]/25 bg-[#071f16] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 text-xs">
          <span className="font-bold uppercase tracking-[0.16em] text-[#e4cc85]">Private Target Control</span>
          <span className="text-right text-white/65">Pilot only · Coordinator access</span>
        </div>
      </div>

      <header className="bg-[#0a3d2a] text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d7bc6a]">Hawthorn Vale · Judge rehearsal</p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">Panel control and audit record</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            Assign the three judges, freeze the round, and move the panel from blind initial marks to final judgement. There is no control for editing locked pins or official targets.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl space-y-7 px-4 py-7 sm:py-10">
        {loading ? <ControlCard title="Loading private round…" /> : null}
        {error ? <p className="rounded-2xl bg-red-50 p-4 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}

        {!loading && data && !round ? (
          <ControlCard title="No rehearsal round exists" detail="Create the frozen Hawthorn Vale MVP-1 judging record. This does not create a customer competition or prize liability.">
            <button type="button" disabled={busy} onClick={() => mutate("create_round")} className="mt-5 rounded-xl bg-[#0a3d2a] px-6 py-3 text-sm font-black text-white disabled:opacity-40">
              {busy ? "Creating…" : "Create private rehearsal round"}
            </button>
          </ControlCard>
        ) : null}

        {round ? (
          <>
            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">{round.scenarioVersion}</p>
                  <h2 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">{round.name}</h2>
                  <p className="mt-2 break-all text-xs text-zinc-500">Scenario hash: {round.scenarioHash}</p>
                </div>
                <StatusBadge status={round.status} />
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                {assignments.map((assignment) => (
                  <div key={assignment.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
                    <p className="text-xs font-black uppercase tracking-wide text-[#9b7b25] dark:text-[#d7bc6a]">Seat {assignment.seat}</p>
                    <p className="mt-1 font-black text-zinc-900 dark:text-white">{assignment.displayName}</p>
                    <p className="mt-1 text-xs text-zinc-500">{assignment.email}</p>
                    <p className="mt-2 text-xs leading-5 text-zinc-600 dark:text-zinc-300">{assignment.credential}</p>
                    <div className="mt-3 flex gap-2 text-[11px] font-bold">
                      <LockPill label="Initial" locked={Boolean(assignment.initialLockedAt)} />
                      <LockPill label="Final" locked={Boolean(assignment.finalLockedAt)} />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {round.status === "DRAFT" ? (
              <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">Panel setup</p>
                <h2 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">Assign exactly three judges</h2>
                <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Use each judge’s exact Google sign-in email. Panel details can be revised only before initial judging opens.</p>
                <div className="mt-5 grid gap-4 lg:grid-cols-3">
                  {panel.map((member, index) => (
                    <div key={index} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
                      <p className="text-sm font-black text-zinc-900 dark:text-white">Judge {index + 1}</p>
                      <Field label="Email" type="email" value={member.email} onChange={(value) => updatePanel(index, "email", value)} placeholder="pro@example.com" />
                      <Field label="Full name" value={member.displayName} onChange={(value) => updatePanel(index, "displayName", value)} placeholder="Alex Morgan" />
                      <Field label="Credential" value={member.credential} onChange={(value) => updatePanel(index, "credential", value)} placeholder="PGA Professional, Example Golf Club" />
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <button type="button" disabled={!panelReady || busy} onClick={() => mutate("save_panel", { panel })} className="rounded-xl border border-[#0a3d2a] px-5 py-3 text-sm font-black text-[#0a3d2a] disabled:opacity-35 dark:border-green-500 dark:text-green-400">
                    Save panel
                  </button>
                  <button
                    type="button"
                    disabled={assignments.length !== 3 || busy}
                    onClick={() => {
                      if (window.confirm("Freeze this scenario version and panel, then open blind initial judging?")) mutate("open_initial");
                    }}
                    className="rounded-xl bg-[#0a3d2a] px-5 py-3 text-sm font-black text-white disabled:opacity-35"
                  >
                    Open initial judging
                  </button>
                </div>
              </section>
            ) : null}

            {round.status === "INITIAL_MARKING" ? (
              <ControlCard title="Blind initial judging is open" detail={`${assignments.filter((item) => item.initialLockedAt).length} of 3 judges have locked their independent marks. No judge can see another mark yet.`} />
            ) : null}

            {round.status === "INITIAL_COMPLETE" ? (
              <>
                <ControlCard title="Initial panel is locked" detail="The panel can now review the three independent starting positions and discuss the strategy. Open final marking only when that discussion is complete.">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (window.confirm("Open final marking for all three judges? Initial marks will remain preserved.")) mutate("open_final");
                    }}
                    className="mt-5 rounded-xl bg-[#0a3d2a] px-6 py-3 text-sm font-black text-white disabled:opacity-35"
                  >
                    Open final marking
                  </button>
                </ControlCard>
                <TargetPanelReview assignments={assignments} phase="initial" />
              </>
            ) : null}

            {round.status === "FINAL_MARKING" ? (
              <>
                <ControlCard title="Private final judging is open" detail={`${assignments.filter((item) => item.finalLockedAt).length} of 3 judges have locked their final marks. Official targets are calculated automatically after the third lock.`} />
                <TargetPanelReview assignments={assignments} phase="initial" />
              </>
            ) : null}

            {round.status === "CALCULATED" && round.officialTargets ? (
              <>
                <ControlCard title="Official targets are locked" detail="The system combined the three final marks automatically. There is no manual target or winner override." tone="success" />
                <TargetPanelReview assignments={assignments} phase="final" officialTargets={round.officialTargets} />
                <section className="rounded-3xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 sm:p-7">
                  <p className="font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200">Calculation evidence</p>
                  <p className="mt-3 break-all"><strong>Official hash:</strong> {round.officialTargetsHash}</p>
                  <p className="mt-2"><strong>Algorithm:</strong> weiszfeld-map-v1</p>
                  <p className="mt-2"><strong>Calculated:</strong> {round.calculatedAt ? new Date(round.calculatedAt).toLocaleString() : "—"}</p>
                </section>
              </>
            ) : null}

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">Append-only record</p>
                  <h2 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">Audit events</h2>
                </div>
                <button type="button" onClick={() => {
                  setError(null);
                  load().catch((caught: unknown) => setError(caught instanceof Error ? caught.message : "Unable to refresh"));
                }} className="rounded-xl border border-zinc-200 px-4 py-2 text-xs font-black text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">Refresh</button>
              </div>
              <div className="mt-4 divide-y divide-zinc-100 dark:divide-zinc-800">
                {auditEvents.map((event) => (
                  <div key={event.id} className="grid gap-1 py-3 text-xs sm:grid-cols-[180px_1fr_220px]">
                    <span className="font-bold text-zinc-900 dark:text-white">{event.action.replaceAll("_", " ")}</span>
                    <span className="text-zinc-500">{event.actorEmail}</span>
                    <time className="text-zinc-400 sm:text-right">{new Date(event.createdAt).toLocaleString()}</time>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}

        <div className="flex justify-center gap-5 text-sm font-bold">
          <Link href="/target" className="text-[#0a3d2a] underline-offset-4 hover:underline dark:text-green-400">Target preview</Link>
          <Link href="/target-judge" className="text-[#0a3d2a] underline-offset-4 hover:underline dark:text-green-400">Judge portal (assigned judges only)</Link>
        </div>
      </main>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (value: string) => void; placeholder: string; type?: string }) {
  return (
    <label className="mt-3 block text-xs font-bold text-zinc-600 dark:text-zinc-300">
      {label}
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="mt-1 w-full rounded-xl border border-zinc-200 bg-white px-3 py-2.5 text-sm text-zinc-900 outline-none focus:border-[#c8a951] dark:border-zinc-700 dark:bg-zinc-950 dark:text-white" />
    </label>
  );
}

function LockPill({ label, locked }: { label: string; locked: boolean }) {
  return <span className={`rounded-full px-2 py-1 ${locked ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>{locked ? "✓" : "○"} {label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = { DRAFT: "Draft", INITIAL_MARKING: "Initial open", INITIAL_COMPLETE: "Discussion", FINAL_MARKING: "Final open", CALCULATED: "Calculated" };
  return <span className="rounded-full bg-[#e8f2eb] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#0a3d2a] dark:bg-green-950/40 dark:text-green-300">{labels[status] ?? status}</span>;
}

function ControlCard({ title, detail, tone = "neutral", children }: { title: string; detail?: string; tone?: "neutral" | "success"; children?: React.ReactNode }) {
  const style = tone === "success" ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20" : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
  return (
    <section className={`rounded-3xl border p-6 text-center shadow-sm sm:p-8 ${style}`}>
      <h2 className="text-xl font-black text-zinc-900 dark:text-white">{title}</h2>
      {detail ? <p className="mx-auto mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">{detail}</p> : null}
      {children}
    </section>
  );
}
