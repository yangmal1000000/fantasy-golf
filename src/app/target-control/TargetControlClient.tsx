"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import TargetPanelReview from "@/components/TargetPanelReview";
import type {
  TargetJudgeControlDto,
  TargetJudgePanelMember,
} from "@/lib/target-judge-core";
import { targetPilotWinners } from "@/lib/target-pilot-core";

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
  const pilotEntries = data?.pilotEntries ?? [];
  const auditEvents = data?.auditEvents ?? [];
  const panelReady = panel.every((member) => member.email.trim() && member.displayName.trim() && member.credential.trim().length >= 5);
  const confirmedWinners = round?.pilotResults ? targetPilotWinners(round.pilotResults) : [];

  return (
    <div className="min-h-screen bg-[#f6f4ee] pb-20 dark:bg-[#0d0f0e] sm:pb-10">
      <div className="border-b border-[#c8a951]/25 bg-[#071f16] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 text-xs">
          <span className="font-bold uppercase tracking-[0.16em] text-[#e4cc85]">Private Target Control</span>
          <Link
            href="/rocket-control"
            className="rounded-lg bg-white/10 px-3 py-1.5 font-bold text-white/80 transition hover:bg-white/15 hover:text-white"
          >
            Rocket beta control →
          </Link>
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
              {round.panelMode === "COORDINATOR_REHEARSAL" ? (
                <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
                  <strong>Development panel rehearsal.</strong> The coordinator is operating all three test seats. This validates the software and winner calculation, but it is not an independent PGA panel result.
                </div>
              ) : null}
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

            <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">Closed pilot</p>
                  <h2 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">Rehearsal entry set</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Approved testers receive one no-payment entry each. Seal the complete set before opening official judging.</p>
                </div>
                <span className={`rounded-full px-3 py-1.5 text-xs font-black uppercase tracking-wide ${round.pilotEntriesSealedAt ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300" : "bg-amber-50 text-amber-800 dark:bg-amber-950/30 dark:text-amber-300"}`}>
                  {round.pilotEntriesSealedAt ? `Sealed · ${round.pilotEntryCount ?? pilotEntries.length}` : `Open · ${pilotEntries.length}`}
                </span>
              </div>

              {pilotEntries.length ? (
                <div className="mt-5 divide-y divide-zinc-100 rounded-2xl border border-zinc-200 px-4 dark:divide-zinc-800 dark:border-zinc-700">
                  {pilotEntries.map((entry) => (
                    <div key={entry.id} className="grid gap-1 py-3 text-xs sm:grid-cols-[1fr_150px_180px] sm:items-center">
                      <div>
                        <p className="font-black text-zinc-900 dark:text-white">{entry.email}</p>
                        <p className="mt-0.5 font-mono text-zinc-400">{entry.reference}</p>
                      </div>
                      <time className="text-zinc-500">{new Date(entry.submittedAt).toLocaleString()}</time>
                      <span className="truncate font-mono text-zinc-400" title={entry.submissionHash}>{entry.submissionHash}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-5 rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">No tester has locked a pilot entry yet.</p>
              )}

              {round.status === "DRAFT" && !round.pilotEntriesSealedAt ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    disabled={!pilotEntries.length || busy}
                    onClick={() => {
                      if (window.confirm(`Seal all ${pilotEntries.length} current pilot entries? No entries can be added, changed or cleared afterward.`)) mutate("seal_pilot_entries");
                    }}
                    className="rounded-xl bg-[#0a3d2a] px-5 py-3 text-sm font-black text-white disabled:opacity-35"
                  >
                    Seal pilot entry set
                  </button>
                  <button
                    type="button"
                    disabled={!pilotEntries.length || busy}
                    onClick={() => {
                      if (window.confirm(`Clear all ${pilotEntries.length} unsealed pilot entries? Testers will be able to enter again.`)) mutate("clear_pilot_entries");
                    }}
                    className="rounded-xl border border-red-200 px-5 py-3 text-sm font-black text-red-700 disabled:opacity-35 dark:border-red-900/50 dark:text-red-300"
                  >
                    Clear unsealed entries
                  </button>
                </div>
              ) : null}

              {round.pilotEntriesSealedAt ? (
                <div className="mt-5 rounded-2xl border border-green-200 bg-green-50 p-4 text-xs leading-5 text-green-800 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-300">
                  <p><strong>Sealed:</strong> {new Date(round.pilotEntriesSealedAt).toLocaleString()}</p>
                  <p className="mt-1 break-all font-mono"><strong>Entry-set hash:</strong> {round.pilotEntrySetHash}</p>
                  <p className="mt-2 font-bold">Sealed evidence cannot be reset. A later rehearsal should use a new round version.</p>
                </div>
              ) : null}
            </section>

            {round.status === "DRAFT" ? (
              <>
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
                    disabled={assignments.length !== 3 || !round.pilotEntriesSealedAt || busy}
                    onClick={() => {
                      if (window.confirm("Freeze this scenario version and panel, then open blind initial judging?")) mutate("open_initial");
                    }}
                    className="rounded-xl bg-[#0a3d2a] px-5 py-3 text-sm font-black text-white disabled:opacity-35"
                  >
                    {round.pilotEntriesSealedAt ? "Open initial judging" : "Seal entries before judging"}
                  </button>
                </div>
              </section>
              <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm dark:border-blue-900/50 dark:bg-blue-950/20 sm:p-7">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Two-person development rehearsal</p>
                <h2 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">Operate all three test seats yourself</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-700 dark:text-zinc-300">
                  After Harry and Russ have both entered and the entry set is sealed, this opens three clearly labelled development seats on the Judge page. It proves the complete target, ranking and winner-confirmation path without claiming an independent PGA panel.
                </p>
                <button
                  type="button"
                  disabled={!round.pilotEntriesSealedAt || busy}
                  onClick={() => {
                    if (window.confirm("Start the coordinator-operated development panel? This permanently freezes the rehearsal as non-independent and opens test seat 1.")) mutate("start_coordinator_rehearsal");
                  }}
                  className="mt-5 rounded-xl bg-blue-700 px-5 py-3 text-sm font-black text-white disabled:opacity-35 dark:bg-blue-600"
                >
                  {round.pilotEntriesSealedAt ? "Start development panel" : "Seal entries first"}
                </button>
              </section>
              </>
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
                <ControlCard
                  title={round.panelMode === "COORDINATOR_REHEARSAL" ? "Rehearsal targets are locked" : "Official targets are locked"}
                  detail={round.panelMode === "COORDINATOR_REHEARSAL"
                    ? "The system combined the three coordinator-operated test seats automatically. This validates the software only and is not an independent-panel result."
                    : "The system combined the three final marks automatically. There is no manual target or winner override."}
                  tone="success"
                />
                <TargetPanelReview assignments={assignments} phase="final" officialTargets={round.officialTargets} />
                {round.pilotResults && confirmedWinners.length ? (
                  <section className="rounded-3xl border border-green-300 bg-green-50 p-6 shadow-sm dark:border-green-800 dark:bg-green-950/25 sm:p-8">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-green-700 dark:text-green-300">Immutable result</p>
                    <h2 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">
                      {confirmedWinners.length === 1 ? "Rehearsal winner confirmed" : "Joint rehearsal winners confirmed"}
                    </h2>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {confirmedWinners.map((winner) => {
                        const entry = pilotEntries.find((item) => item.id === winner.entryId);
                        return (
                          <div key={winner.entryId} className="rounded-2xl bg-white p-4 dark:bg-zinc-900">
                            <p className="font-black text-zinc-900 dark:text-white">{entry?.email ?? winner.entryId}</p>
                            <p className="mt-1 font-mono text-xs text-zinc-500">{entry?.reference}</p>
                            <p className="mt-2 text-sm font-bold text-green-700 dark:text-green-300">Rank 1 · {formatError(winner.totalError)} total error</p>
                          </div>
                        );
                      })}
                    </div>
                    <p className="mt-4 text-xs leading-5 text-green-800 dark:text-green-300">
                      Confirmed automatically from the sealed entry set and locked panel targets. {round.panelMode === "COORDINATOR_REHEARSAL" ? "Development evidence only—no real prize or independent-panel claim." : "No manual winner override exists."}
                    </p>
                  </section>
                ) : null}
                <section className="rounded-3xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 sm:p-7">
                  <p className="font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-200">Calculation evidence</p>
                  <p className="mt-3 break-all"><strong>Official hash:</strong> {round.officialTargetsHash}</p>
                  <p className="mt-2"><strong>Algorithm:</strong> weiszfeld-map-v1</p>
                  <p className="mt-2"><strong>Calculated:</strong> {round.calculatedAt ? new Date(round.calculatedAt).toLocaleString() : "—"}</p>
                </section>
                {round.pilotResults ? (
                  <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
                    <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">Automatic scoring</p>
                    <h2 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">Closed-pilot results</h2>
                    <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Ranked by combined normalised distance. Exact-total ties use Decision 3, then 2, then 1; completely identical results share the rank.</p>
                    <div className="mt-5 overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-700">
                      <table className="w-full min-w-[720px] text-left text-xs">
                        <thead className="bg-zinc-50 text-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-400">
                          <tr><th className="px-4 py-3">Rank</th><th className="px-4 py-3">Tester</th><th className="px-4 py-3">Total</th><th className="px-4 py-3">Decision 1</th><th className="px-4 py-3">Decision 2</th><th className="px-4 py-3">Decision 3</th></tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                          {round.pilotResults.entries.map((result) => {
                            const entry = pilotEntries.find((item) => item.id === result.entryId);
                            return (
                              <tr key={result.entryId}>
                                <td className="px-4 py-3 text-lg font-black text-[#0a3d2a] dark:text-green-400">{result.rank}{result.tied ? "=" : ""}</td>
                                <td className="px-4 py-3"><p className="font-black text-zinc-900 dark:text-white">{entry?.email ?? result.entryId}</p><p className="mt-0.5 font-mono text-zinc-400">{entry?.reference}</p></td>
                                <td className="px-4 py-3 font-black text-zinc-900 dark:text-white">{formatError(result.totalError)}</td>
                                {result.scenarioErrors.map((error, index) => <td key={index} className="px-4 py-3 text-zinc-500 dark:text-zinc-400">{formatError(error)}</td>)}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div className="mt-5 rounded-2xl bg-zinc-50 p-4 text-xs text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                      <p className="break-all"><strong>Results hash:</strong> <span className="font-mono">{round.pilotResultsHash}</span></p>
                      <p className="mt-1"><strong>Scored:</strong> {round.pilotScoredAt ? new Date(round.pilotScoredAt).toLocaleString() : "—"}</p>
                    </div>
                  </section>
                ) : null}
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
          <Link href="/target-judge" className="text-[#0a3d2a] underline-offset-4 hover:underline dark:text-green-400">Judge sandbox / portal</Link>
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

function formatError(error: number) {
  return `${(error * 100).toFixed(3)}%`;
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
