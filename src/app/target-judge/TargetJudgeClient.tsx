"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import CourseMap from "@/app/target/CourseMap";
import TargetPanelReview from "@/components/TargetPanelReview";
import {
  TARGET_SCENARIOS,
  type TargetPoint,
} from "@/lib/target-challenge";
import type {
  TargetJudgeContextDto,
  TargetJudgePhase,
  TargetJudgeSubmission,
} from "@/lib/target-judge-core";

type Declaration = {
  qualified: boolean;
  independent: boolean;
  noConflict: boolean;
};

export default function TargetJudgeClient({ sandbox = false }: { sandbox?: boolean }) {
  const [data, setData] = useState<TargetJudgeContextDto | null>(null);
  const [loading, setLoading] = useState(!sandbox);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sandbox) {
      return;
    }

    let active = true;
    fetch("/api/target-judge", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to load Judge Mode");
        return body as TargetJudgeContextDto;
      })
      .then((body) => {
        if (active) setData(body);
      })
      .catch((caught: unknown) => {
        if (active) setError(caught instanceof Error ? caught.message : "Unable to load Judge Mode");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [sandbox]);

  return (
    <div className="min-h-screen bg-[#f6f4ee] pb-20 dark:bg-[#0d0f0e] sm:pb-10">
      <div className="border-b border-[#c8a951]/25 bg-[#071f16] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 text-xs">
          <span className="font-bold uppercase tracking-[0.16em] text-[#e4cc85]">
            {sandbox ? "Development Judge Sandbox" : "Private Judge Mode"}
          </span>
          <span className="text-right text-white/65">
            {sandbox ? "Browser-only · No official records" : "Pilot only · No entrant pins visible"}
          </span>
        </div>
      </div>

      <header className="bg-[#0a3d2a] text-white">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-[#d7bc6a]">
            Hawthorn Vale · {sandbox ? "Coordinator development test" : "Blind panel rehearsal"}
          </p>
          <h1 className="mt-2 text-3xl font-black sm:text-4xl">
            {sandbox ? "Test the complete judge experience" : "Judge the same three golf decisions"}
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-white/75">
            {sandbox
              ? "Place initial pins, review them, revise final pins and complete a test submission. Nothing here changes the official round or its audit trail."
              : "Your pins and reasoning are private until every judge has locked the same phase. Locked marks cannot be edited by you or the coordinator."}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-7 sm:py-10">
        {sandbox ? <SandboxJudgeStage /> : null}
        {!sandbox && loading ? <StateCard title="Loading private assignment…" /> : null}
        {!sandbox && error ? <StateCard title="Judge Mode unavailable" detail={error} tone="danger" /> : null}
        {!sandbox && data ? <JudgeStage data={data} onUpdate={setData} /> : null}
      </main>
    </div>
  );
}

function SandboxJudgeStage() {
  const [stage, setStage] = useState<"initial" | "review" | "final" | "complete">("initial");
  const [initialSubmission, setInitialSubmission] = useState<TargetJudgeSubmission | null>(null);
  const [finalSubmission, setFinalSubmission] = useState<TargetJudgeSubmission | null>(null);

  const assignment = useMemo(() => ({
    id: "development-sandbox",
    seat: 1,
    displayName: "Harry — development test",
    credential: "Coordinator sandbox · not an official panel member",
    declarationConfirmedAt: null,
    initialLockedAt: initialSubmission ? new Date(0).toISOString() : null,
    finalLockedAt: finalSubmission ? new Date(0).toISOString() : null,
    initialSubmission,
    finalSubmission,
  }), [finalSubmission, initialSubmission]);

  function resetSandbox() {
    setInitialSubmission(null);
    setFinalSubmission(null);
    setStage("initial");
  }

  return (
    <div className="space-y-7">
      <StateCard
        title="Development sandbox"
        detail="You are testing the judge interface as the coordinator. These pins and rationales stay only in this browser tab and are never written to the official judging database."
      />

      {stage === "initial" ? (
        <MarkingForm
          phase="initial"
          sandbox
          onSandboxComplete={(submission) => {
            setInitialSubmission(submission);
            setStage("review");
          }}
        />
      ) : null}

      {stage === "review" && initialSubmission ? (
        <>
          <StateCard
            title="Test initial marks locked"
            detail="This reproduces the judge's private review step. In a real round, other judges remain hidden until all three initial submissions are locked."
            tone="success"
          />
          <TargetPanelReview assignments={[assignment]} phase="initial" />
          <SandboxActions>
            <button
              type="button"
              onClick={() => setStage("final")}
              className="rounded-xl bg-[#0a3d2a] px-5 py-3 text-sm font-black text-white hover:bg-[#15543b]"
            >
              Continue to final marks
            </button>
            <button type="button" onClick={resetSandbox} className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-black text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
              Restart sandbox
            </button>
          </SandboxActions>
        </>
      ) : null}

      {stage === "final" && initialSubmission ? (
        <MarkingForm
          phase="final"
          seed={initialSubmission}
          sandbox
          onSandboxComplete={(submission) => {
            setFinalSubmission(submission);
            setStage("complete");
          }}
        />
      ) : null}

      {stage === "complete" && finalSubmission ? (
        <>
          <StateCard
            title="Judge sandbox complete"
            detail="Your final test marks are shown below. No official target is calculated from one sandbox judge, and no audit event or panel record was created."
            tone="success"
          />
          <TargetPanelReview assignments={[assignment]} phase="final" />
          <SandboxActions>
            <button type="button" onClick={resetSandbox} className="rounded-xl bg-[#0a3d2a] px-5 py-3 text-sm font-black text-white hover:bg-[#15543b]">
              Run another test
            </button>
            <Link href="/target-control" className="rounded-xl border border-zinc-300 px-5 py-3 text-sm font-black text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
              Back to Target Control
            </Link>
          </SandboxActions>
        </>
      ) : null}
    </div>
  );
}

function SandboxActions({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-center gap-3 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      {children}
    </div>
  );
}

function JudgeStage({
  data,
  onUpdate,
}: {
  data: TargetJudgeContextDto;
  onUpdate: (data: TargetJudgeContextDto) => void;
}) {
  const { round, assignment } = data;

  return (
    <div className="space-y-7">
      <section className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">Panel seat {assignment.seat}</p>
            <h2 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">{assignment.displayName}</h2>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{assignment.credential}</p>
          </div>
          <StatusBadge status={round.status} />
        </div>
        <div className="mt-5 grid gap-3 text-xs sm:grid-cols-3">
          <ProgressItem label="Declaration" complete={Boolean(assignment.declarationConfirmedAt)} />
          <ProgressItem label="Initial marks" complete={Boolean(assignment.initialLockedAt)} />
          <ProgressItem label="Final marks" complete={Boolean(assignment.finalLockedAt)} />
        </div>
      </section>

      {round.status === "DRAFT" ? (
        <StateCard title="The coordinator is preparing the round" detail="Your assignment is confirmed. Judging will appear here only after the scenario bundle and full panel are frozen." />
      ) : null}

      {round.status === "INITIAL_MARKING" && !assignment.initialLockedAt ? (
        <MarkingForm phase="initial" onComplete={onUpdate} />
      ) : null}

      {round.status === "INITIAL_MARKING" && assignment.initialLockedAt ? (
        <StateCard title="Initial marks locked" detail="Your independent starting judgement is sealed. Other judges’ marks remain hidden until all three have locked theirs." />
      ) : null}

      {round.status === "INITIAL_COMPLETE" && data.panelInitial ? (
        <>
          <StateCard title="Initial panel complete" detail="All three independent starting marks are now visible for the private panel discussion. No entrant data is available in this system." tone="success" />
          <TargetPanelReview assignments={data.panelInitial} phase="initial" />
        </>
      ) : null}

      {round.status === "FINAL_MARKING" ? (
        <>
          {data.panelInitial ? (
            <section>
              <h2 className="mb-4 text-2xl font-black text-zinc-900 dark:text-white">Locked initial panel</h2>
              <TargetPanelReview assignments={data.panelInitial} phase="initial" />
            </section>
          ) : null}
          {!assignment.finalLockedAt ? (
            <MarkingForm
              phase="final"
              seed={assignment.initialSubmission ?? undefined}
              onComplete={onUpdate}
            />
          ) : (
            <StateCard title="Final marks locked" detail="Your final judgement is sealed. Official targets are calculated automatically only after all three judges have locked their final marks." />
          )}
        </>
      ) : null}

      {round.status === "CALCULATED" && data.panelFinal ? (
        <>
          <StateCard title="Official targets calculated" detail="All three final submissions were locked and combined automatically using the frozen geometric-median algorithm." tone="success" />
          <TargetPanelReview
            assignments={data.panelFinal}
            phase="final"
            officialTargets={round.officialTargets}
          />
          <section className="rounded-2xl border border-zinc-200 bg-white p-5 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            <p><strong className="text-zinc-800 dark:text-zinc-200">Evidence hash:</strong> {round.officialTargetsHash}</p>
            <p className="mt-2">Algorithm: `weiszfeld-map-v1` · Scenario version: {round.scenarioVersion}</p>
          </section>
        </>
      ) : null}

      <div className="text-center">
        <Link href="/target" className="text-sm font-bold text-[#0a3d2a] underline-offset-4 hover:underline dark:text-green-400">
          Return to Target Challenge preview
        </Link>
      </div>
    </div>
  );
}

function MarkingForm({
  phase,
  seed,
  onComplete,
  sandbox = false,
  onSandboxComplete,
}: {
  phase: TargetJudgePhase;
  seed?: TargetJudgeSubmission;
  onComplete?: (data: TargetJudgeContextDto) => void;
  sandbox?: boolean;
  onSandboxComplete?: (submission: TargetJudgeSubmission) => void;
}) {
  const seedByScenario = useMemo(
    () => new Map(seed?.marks.map((mark) => [mark.scenarioId, mark]) ?? []),
    [seed],
  );
  const [points, setPoints] = useState<Array<TargetPoint | null>>(() =>
    TARGET_SCENARIOS.map((scenario) => seedByScenario.get(scenario.id)?.point ?? null),
  );
  const [rationales, setRationales] = useState<string[]>(() =>
    TARGET_SCENARIOS.map((scenario) => seedByScenario.get(scenario.id)?.rationale ?? ""),
  );
  const [declaration, setDeclaration] = useState<Declaration>({
    qualified: false,
    independent: false,
    noConflict: false,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completeMarks = points.every(Boolean) && rationales.every((text) => text.trim().length >= 40);
  const declarationComplete = sandbox || phase === "final" || Object.values(declaration).every(Boolean);

  function updatePoint(index: number, point: TargetPoint | null) {
    setPoints((current) => current.map((existing, i) => (i === index ? point : existing)));
  }

  function updateRationale(index: number, rationale: string) {
    setRationales((current) => current.map((existing, i) => (i === index ? rationale : existing)));
  }

  async function lockSubmission() {
    if (!completeMarks || !declarationComplete || busy) return;
    const confirmed = window.confirm(
      sandbox
        ? `Complete your ${phase} sandbox marks? You can restart the sandbox afterward.`
        : `Lock your ${phase} marks? They cannot be edited after submission.`,
    );
    if (!confirmed) return;

    const submission: TargetJudgeSubmission = {
      marks: TARGET_SCENARIOS.map((scenario, index) => ({
        scenarioId: scenario.id,
        point: points[index] as TargetPoint,
        rationale: rationales[index],
      })),
    };

    if (sandbox) {
      onSandboxComplete?.(submission);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/target-judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phase,
          declaration,
          submission,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to lock marks");
      onComplete?.(body as TargetJudgeContextDto);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to lock marks");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
          {phase === "initial" ? "Independent first judgement" : "Private final judgement"}
        </p>
        <h2 className="mt-1 text-3xl font-black text-zinc-900 dark:text-white">
          {phase === "initial" ? "Place your initial targets" : "Lock your final targets"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          Place one target and give a short strategic rationale for every scenario. The final phase starts from your initial answers, but you may revise them after the panel discussion.
        </p>
      </div>

      {phase === "initial" && sandbox ? (
        <div className="rounded-3xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-200">
          Development sandbox: qualification and independence declarations are not requested or recorded here. Real judges must complete them before an official initial submission.
        </div>
      ) : null}

      {phase === "initial" && !sandbox ? (
        <div className="rounded-3xl border border-[#c8a951]/35 bg-[#fffaf0] p-5 dark:bg-[#c8a951]/10">
          <h3 className="font-black text-zinc-900 dark:text-white">Required declaration</h3>
          <div className="mt-3 space-y-3">
            <DeclarationCheck checked={declaration.qualified} onChange={(value) => setDeclaration((current) => ({ ...current, qualified: value }))} text="I confirm the qualification and experience shown above are accurate." />
            <DeclarationCheck checked={declaration.independent} onChange={(value) => setDeclaration((current) => ({ ...current, independent: value }))} text="I am judging independently and have not seen entrant targets or heat maps." />
            <DeclarationCheck checked={declaration.noConflict} onChange={(value) => setDeclaration((current) => ({ ...current, noConflict: value }))} text="I have no undisclosed conflict and will not enter this competition." />
          </div>
        </div>
      ) : null}

      {TARGET_SCENARIOS.map((scenario, index) => (
        <article key={scenario.id} className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,.8fr)]">
            <div className="self-start bg-[#071f16] p-0 sm:p-5">
              <CourseMap
                scenario={scenario}
                point={points[index]}
                onChange={(point) => updatePoint(index, point)}
                edgeToEdgeOnMobile
              />
            </div>
            <div className="p-5 sm:p-7">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">Decision {scenario.number}</p>
              <h3 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">{scenario.title}</h3>
              <p className="mt-1 text-sm font-semibold text-[#0a3d2a] dark:text-green-400">{scenario.hole}</p>
              <p className="mt-4 rounded-2xl bg-[#f4f0e5] p-4 text-sm font-bold leading-6 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">{scenario.question}</p>
              <div className="mt-4 grid gap-4 text-xs leading-5 text-zinc-600 dark:text-zinc-300">
                <ScenarioFacts title="Supplied golfer" items={scenario.playerFacts} />
                <ScenarioFacts title="Conditions" items={scenario.conditions} />
              </div>
              <label className="mt-5 block text-sm font-black text-zinc-900 dark:text-white" htmlFor={`rationale-${phase}-${scenario.id}`}>
                Strategic rationale
              </label>
              <textarea
                id={`rationale-${phase}-${scenario.id}`}
                value={rationales[index]}
                onChange={(event) => updateRationale(index, event.target.value)}
                maxLength={1_000}
                rows={5}
                placeholder="Explain the wind, dispersion, penalty and course-management factors behind your target…"
                className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-900 outline-none transition focus:border-[#c8a951] focus:ring-2 focus:ring-[#c8a951]/20 dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
              />
              <p className={`mt-1 text-right text-xs ${rationales[index].trim().length >= 40 ? "text-green-600" : "text-zinc-400"}`}>
                {rationales[index].trim().length}/40 minimum
              </p>
            </div>
          </div>
        </article>
      ))}

      {error ? <p className="rounded-xl bg-red-50 p-4 text-sm font-bold text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p> : null}
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-7">
        <p className="text-sm leading-6 text-zinc-600 dark:text-zinc-400">
          {sandbox
            ? "This test stays in browser memory only. It does not create a judge assignment, database submission, audit event or official target."
            : "This is irreversible. The server records the exact coordinates, rationales, scenario version and lock time in the private audit trail."}
        </p>
        <button
          type="button"
          onClick={lockSubmission}
          disabled={!completeMarks || !declarationComplete || busy}
          className="mt-5 w-full rounded-xl bg-[#0a3d2a] px-6 py-3.5 text-sm font-black text-white transition hover:bg-[#15543b] disabled:cursor-not-allowed disabled:opacity-35 sm:w-auto"
        >
          {busy ? "Locking…" : sandbox ? `Complete ${phase} test` : `Lock ${phase} marks`}
        </button>
      </div>
    </section>
  );
}

function DeclarationCheck({ checked, onChange, text }: { checked: boolean; onChange: (value: boolean) => void; text: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-1 h-4 w-4 accent-[#0a3d2a]" />
      <span>{text}</span>
    </label>
  );
}

function ScenarioFacts({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div>
      <p className="font-black uppercase tracking-wide text-zinc-800 dark:text-zinc-100">{title}</p>
      <ul className="mt-1 list-disc space-y-0.5 pl-4">
        {items.map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const label: Record<string, string> = {
    DRAFT: "Waiting",
    INITIAL_MARKING: "Initial marking",
    INITIAL_COMPLETE: "Panel discussion",
    FINAL_MARKING: "Final marking",
    CALCULATED: "Complete",
  };
  return <span className="rounded-full bg-[#e8f2eb] px-4 py-2 text-xs font-black uppercase tracking-wide text-[#0a3d2a] dark:bg-green-950/40 dark:text-green-300">{label[status] ?? status}</span>;
}

function ProgressItem({ label, complete }: { label: string; complete: boolean }) {
  return (
    <div className={`rounded-xl px-4 py-3 font-bold ${complete ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300" : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800"}`}>
      {complete ? "✓" : "○"} {label}
    </div>
  );
}

function StateCard({ title, detail, tone = "neutral" }: { title: string; detail?: string; tone?: "neutral" | "success" | "danger" }) {
  const style = tone === "success"
    ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20"
    : tone === "danger"
      ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20"
      : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900";
  return (
    <section className={`rounded-3xl border p-6 text-center shadow-sm sm:p-8 ${style}`}>
      <h2 className="text-xl font-black text-zinc-900 dark:text-white">{title}</h2>
      {detail ? <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">{detail}</p> : null}
    </section>
  );
}
