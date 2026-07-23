"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  MapPinIcon,
  ShieldIcon,
  TargetIcon,
} from "@/components/icons";
import {
  TARGET_ATTEMPT_SECONDS,
  formatAttemptTime,
  type TargetPoint,
} from "@/lib/target-challenge";
import {
  TARGET_V2_PRACTICE,
  TARGET_V2_SCENARIOS,
  estimateTargetFinishYards,
  type TargetV2Metric,
  type TargetV2Scenario,
} from "@/lib/target-v2";
import CourseMap from "../target/CourseMap";

type PreviewStage = "intro" | "playing" | "review" | "complete" | "expired";

const EMPTY_POINTS: Array<TargetPoint | null> = [null, null, null];

export default function TargetV2PreviewClient() {
  const [stage, setStage] = useState<PreviewStage>("intro");
  const [practicePoint, setPracticePoint] = useState<TargetPoint | null>(null);
  const [points, setPoints] = useState<Array<TargetPoint | null>>([...EMPTY_POINTS]);
  const [currentScenario, setCurrentScenario] = useState(0);
  const [rulesConfirmed, setRulesConfirmed] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(TARGET_ATTEMPT_SECONDS);

  const completedCount = points.filter(Boolean).length;
  const allComplete = completedCount === TARGET_V2_SCENARIOS.length;
  const scenario = TARGET_V2_SCENARIOS[currentScenario];
  const currentPoint = points[currentScenario];

  useEffect(() => {
    if ((stage !== "playing" && stage !== "review") || deadline === null) return;
    function syncTimer() {
      const remaining = Math.max(0, Math.ceil((deadline! - Date.now()) / 1_000));
      setSecondsRemaining(remaining);
      if (remaining === 0) setStage("expired");
    }
    syncTimer();
    const interval = window.setInterval(syncTimer, 1_000);
    return () => window.clearInterval(interval);
  }, [deadline, stage]);

  const statusLabel = useMemo(() => {
    if (stage === "playing") return `Decision ${currentScenario + 1} of ${TARGET_V2_SCENARIOS.length}`;
    if (stage === "review") return "Review";
    if (stage === "complete") return "Read-only review";
    return "Working preview";
  }, [currentScenario, stage]);

  function beginPreview() {
    setPoints([...EMPTY_POINTS]);
    setCurrentScenario(0);
    setSecondsRemaining(TARGET_ATTEMPT_SECONDS);
    setDeadline(Date.now() + TARGET_ATTEMPT_SECONDS * 1_000);
    setStage("playing");
  }

  function updatePoint(index: number, point: TargetPoint | null) {
    setPoints((current) =>
      current.map((existing, pointIndex) => (pointIndex === index ? point : existing)),
    );
  }

  function continueFromScenario() {
    if (!currentPoint) return;
    if (currentScenario < TARGET_V2_SCENARIOS.length - 1) {
      setCurrentScenario((index) => index + 1);
      return;
    }
    setStage("review");
  }

  function restartPreview() {
    setStage("intro");
    setPracticePoint(null);
    setPoints([...EMPTY_POINTS]);
    setCurrentScenario(0);
    setRulesConfirmed(false);
    setDeadline(null);
    setSecondsRemaining(TARGET_ATTEMPT_SECONDS);
  }

  return (
    <div className="min-h-screen bg-[#f6f4ee] pb-16 dark:bg-[#0d0f0e]">
      <div className="border-b border-[#c8a951]/25 bg-[#071f16] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 text-xs">
          <span className="inline-flex items-center gap-2 font-bold uppercase tracking-[0.16em] text-[#e4cc85]">
            <ShieldIcon className="h-4 w-4" /> Target v2 preview
          </span>
          <span className="text-right text-white/65">Nothing saved · no pass issued</span>
        </div>
      </div>

      {stage === "intro" ? (
        <section className="relative overflow-hidden bg-[#0a3d2a] text-white">
          <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#c8a951]/10 blur-3xl" />
          <div className="absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-[#4c9b67]/15 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-4 py-8 sm:py-11">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-[#d7bc6a]">
              Finish-position prototype
            </p>
            <h1 className="mt-3 max-w-3xl text-3xl font-black tracking-tight sm:text-5xl">
              Read the shot. Choose the finish.
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
              Three golf decisions, clearer yardages and one precise finishing marker.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-bold">
              <PreviewPill>Free test flight</PreviewPill>
              <PreviewPill>No payment</PreviewPill>
              <PreviewPill>No prize</PreviewPill>
            </div>
          </div>
        </section>
      ) : null}

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-9">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
              {statusLabel}
            </p>
          </div>
          {(stage === "playing" || stage === "review") && (
            <div
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black tabular ${
                secondsRemaining <= 120
                  ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                  : "bg-white text-[#0a3d2a] shadow-sm dark:bg-zinc-900 dark:text-green-400"
              }`}
            >
              <ClockIcon className="h-4 w-4" /> {formatAttemptTime(secondsRemaining)}
            </div>
          )}
        </div>

        {stage === "intro" ? (
          <IntroStage
            practicePoint={practicePoint}
            setPracticePoint={setPracticePoint}
            rulesConfirmed={rulesConfirmed}
            setRulesConfirmed={setRulesConfirmed}
            onStart={beginPreview}
          />
        ) : null}

        {stage === "playing" ? (
          <PlayingStage
            scenario={scenario}
            point={currentPoint}
            currentScenario={currentScenario}
            completedCount={completedCount}
            points={points}
            onSelectScenario={setCurrentScenario}
            onChange={(point) => updatePoint(currentScenario, point)}
            onBack={() => setCurrentScenario((index) => Math.max(0, index - 1))}
            onContinue={continueFromScenario}
          />
        ) : null}

        {stage === "review" ? (
          <ReviewStage
            points={points}
            onEdit={(index) => {
              setCurrentScenario(index);
              setStage("playing");
            }}
            onComplete={() => {
              setDeadline(null);
              setStage("complete");
            }}
            allComplete={allComplete}
          />
        ) : null}

        {stage === "complete" ? (
          <CompleteStage points={points} onRestart={restartPreview} />
        ) : null}

        {stage === "expired" ? (
          <section className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-lg dark:border-red-900/50 dark:bg-zinc-900">
            <ClockIcon className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-2xl font-black text-zinc-900 dark:text-white">
              Preview time expired
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
              Nothing was saved. Restart whenever you are ready.
            </p>
            <button
              type="button"
              onClick={restartPreview}
              className="mt-6 rounded-xl bg-[#0a3d2a] px-6 py-3 text-sm font-black text-white"
            >
              Restart preview
            </button>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function IntroStage({
  practicePoint,
  setPracticePoint,
  rulesConfirmed,
  setRulesConfirmed,
  onStart,
}: {
  practicePoint: TargetPoint | null;
  setPracticePoint: (point: TargetPoint | null) => void;
  rulesConfirmed: boolean;
  setRulesConfirmed: (value: boolean) => void;
  onStart: () => void;
}) {
  const ready = Boolean(practicePoint) && rulesConfirmed;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
      <section className="-mx-4 overflow-hidden border-y border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900 sm:mx-0 sm:rounded-3xl sm:border-x sm:p-6">
        <div className="flex items-start justify-between gap-4 px-4 py-4 sm:px-0 sm:pt-0">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
              Practice
            </p>
            <h2 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">
              Place a finish marker
            </h2>
          </div>
          <span className="rounded-full bg-[#e8f2eb] px-3 py-1 text-xs font-bold text-[#0a3d2a] dark:bg-green-950/40 dark:text-green-300">
            Not recorded
          </span>
        </div>
        <CourseMap
          scenario={TARGET_V2_PRACTICE}
          point={practicePoint}
          onChange={setPracticePoint}
          edgeToEdgeOnMobile
        />
      </section>

      <aside className="rounded-3xl bg-[#0a3d2a] p-6 text-white shadow-xl sm:p-8">
        <TargetIcon className="h-10 w-10 text-[#d7bc6a]" />
        <h2 className="mt-5 text-2xl font-black">How it works</h2>
        <ul className="mt-5 space-y-4 text-sm">
          <IntroBullet icon={<MapPinIcon className="h-4 w-4" />}>
            Place one marker where you want the ball to finish.
          </IntroBullet>
          <IntroBullet icon={<TargetIcon className="h-4 w-4" />}>
            Complete three course decisions.
          </IntroBullet>
          <IntroBullet icon={<ClockIcon className="h-4 w-4" />}>
            You have 20 minutes. Speed does not affect the result.
          </IntroBullet>
        </ul>

        <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-2xl border border-white/15 bg-white/5 p-4">
          <input
            type="checkbox"
            checked={rulesConfirmed}
            onChange={(event) => setRulesConfirmed(event.target.checked)}
            className="mt-0.5 h-5 w-5 accent-[#c8a951]"
          />
          <span className="text-sm font-semibold leading-6 text-white/80">
            I understand the live version is one locked individual attempt and agree to the test-flight rules.
          </span>
        </label>

        <details className="mt-3 rounded-2xl border border-white/15 px-4 py-3 text-sm text-white/75">
          <summary className="cursor-pointer font-black text-[#f0d986]">
            Test-flight rules
          </summary>
          <ul className="mt-3 space-y-2 leading-5">
            <li>One individual Target attempt per verified account; no outside assistance.</li>
            <li>The live markers lock on submission and cannot be replaced.</li>
            <li>Completion—not Target rank—unlocks one non-transferable pass for one free Rocket team. Target never changes the fantasy score.</li>
            <li>Three final panel markers are combined automatically into one reference position for each decision. The result identifies whether the panel is independent or a coordinator-run rehearsal.</li>
            <li>Entries rank by combined distance from those references; exact ties use Decision 3, then 2, then 1.</li>
            <li>There is no entry fee, prize, cash value or payout.</li>
            <li>Target and team entry close at the official first tee.</li>
          </ul>
        </details>

        <button
          type="button"
          onClick={onStart}
          disabled={!ready}
          className="mt-6 w-full rounded-xl bg-[#c8a951] px-5 py-3.5 text-sm font-black text-[#17251d] transition hover:bg-[#ddc77f] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {practicePoint ? "Start three decisions →" : "Place a practice marker first"}
        </button>
      </aside>
    </div>
  );
}

function PlayingStage({
  scenario,
  point,
  currentScenario,
  completedCount,
  points,
  onSelectScenario,
  onChange,
  onBack,
  onContinue,
}: {
  scenario: TargetV2Scenario;
  point: TargetPoint | null;
  currentScenario: number;
  completedCount: number;
  points: Array<TargetPoint | null>;
  onSelectScenario: (index: number) => void;
  onChange: (point: TargetPoint | null) => void;
  onBack: () => void;
  onContinue: () => void;
}) {
  return (
    <section className="-mx-4 overflow-hidden border-y border-zinc-200 bg-white shadow-xl shadow-[#0a3d2a]/5 dark:border-zinc-800 dark:bg-zinc-900 sm:mx-0 sm:rounded-3xl sm:border-x">
      <div className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {TARGET_V2_SCENARIOS.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelectScenario(index)}
                className={`flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-xs font-black transition ${
                  index === currentScenario
                    ? "bg-[#0a3d2a] text-white"
                    : points[index]
                      ? "bg-[#e8f2eb] text-[#0a3d2a] dark:bg-green-950/40 dark:text-green-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
                aria-label={`Open decision ${index + 1}${points[index] ? ", marker placed" : ""}`}
              >
                {points[index] ? <CheckCircleIcon className="mr-1 h-4 w-4" /> : null}
                {index + 1}
              </button>
            ))}
          </div>
          <span className="text-xs font-semibold text-zinc-500">
            {completedCount}/3 markers placed
          </span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
          <div
            className="h-full rounded-full bg-[#c8a951] transition-all"
            style={{ width: `${(completedCount / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.45fr)_minmax(330px,.8fr)]">
        <div className="self-start bg-[#071f16] sm:p-5">
          <CourseMap
            scenario={scenario}
            point={point}
            onChange={onChange}
            edgeToEdgeOnMobile
          />
        </div>
        <div className="p-5 sm:p-7">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
            {scenario.eyebrow}
          </p>
          <h2 className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">
            {scenario.title}
          </h2>
          <p className="mt-1 text-sm font-semibold text-[#0a3d2a] dark:text-green-400">
            {scenario.hole}
          </p>
          <p className="mt-4 rounded-2xl bg-[#f4f0e5] p-4 text-base font-black leading-6 text-zinc-900 dark:bg-zinc-800 dark:text-white">
            {scenario.question}
          </p>

          <MetricGrid metrics={scenario.metrics} />

          <details className="mt-5 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
            <summary className="cursor-pointer text-sm font-black text-[#0a3d2a] dark:text-green-300">
              Course detail
            </summary>
            <ul className="mt-3 space-y-2 text-sm leading-5 text-zinc-600 dark:text-zinc-300">
              {scenario.details.map((detail) => (
                <li key={detail} className="flex items-start gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c8a951]" />
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </details>

          <div className="mt-6 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onBack}
              disabled={currentScenario === 0}
              className="rounded-xl border border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onContinue}
              disabled={!point}
              className="rounded-xl bg-[#0a3d2a] px-5 py-3 text-sm font-black text-white transition hover:bg-[#15543b] disabled:cursor-not-allowed disabled:opacity-35"
            >
              {currentScenario === 2 ? "Review decisions" : "Save and continue"} →
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function ReviewStage({
  points,
  onEdit,
  onComplete,
  allComplete,
}: {
  points: Array<TargetPoint | null>;
  onEdit: (index: number) => void;
  onComplete: () => void;
  allComplete: boolean;
}) {
  return (
    <section className="-mx-4 overflow-hidden border-y border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:mx-0 sm:rounded-3xl sm:border-x sm:p-8">
      <div className="border-b border-zinc-100 px-4 pb-6 pt-6 dark:border-zinc-800 sm:px-0 sm:pt-0">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
          Final review
        </p>
        <h2 className="mt-2 text-3xl font-black text-zinc-900 dark:text-white">
          Check your finishing positions
        </h2>
        <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
          In the live version, these markers lock when submitted.
        </p>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {TARGET_V2_SCENARIOS.map((scenario, index) => {
          const point = points[index];
          const yards = estimateTargetFinishYards(scenario, point);
          return (
            <article
              key={scenario.id}
              className="overflow-hidden border-y border-zinc-200 dark:border-zinc-700 sm:rounded-2xl sm:border-x"
            >
              <CourseMap scenario={scenario} point={point} compact edgeToEdgeOnMobile />
              <div className="p-4">
                <p className="text-xs font-black uppercase tracking-wide text-[#9b7b25] dark:text-[#d7bc6a]">
                  Decision {index + 1}
                </p>
                <h3 className="mt-1 font-black text-zinc-900 dark:text-white">
                  {scenario.title}
                </h3>
                <p className="mt-2 text-sm font-bold text-zinc-500 dark:text-zinc-400">
                  Approx. {yards ?? "—"} yards from the ball
                </p>
                <button
                  type="button"
                  onClick={() => onEdit(index)}
                  className="mt-4 text-sm font-black text-[#0a3d2a] underline decoration-[#c8a951] decoration-2 underline-offset-4 dark:text-green-400"
                >
                  Edit marker
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mx-4 my-6 flex justify-end sm:mx-0 sm:mb-0">
        <button
          type="button"
          disabled={!allComplete}
          onClick={onComplete}
          className="rounded-xl bg-[#0a3d2a] px-7 py-3.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          Complete preview
        </button>
      </div>
    </section>
  );
}

function CompleteStage({
  points,
  onRestart,
}: {
  points: Array<TargetPoint | null>;
  onRestart: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="bg-[#0a3d2a] px-6 py-9 text-center text-white sm:px-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#c8a951] text-[#0a3d2a] shadow-lg">
          <CheckCircleIcon className="h-9 w-9" />
        </span>
        <h2 className="mt-5 text-3xl font-black">Preview complete</h2>
        <p className="mt-2 text-sm text-white/70">
          Nothing was saved. This is the proposed read-only view after a live submission.
        </p>
      </div>

      <div className="space-y-5 p-5 sm:p-8">
        {TARGET_V2_SCENARIOS.map((scenario, index) => (
          <article
            key={scenario.id}
            className="grid overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 md:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]"
          >
            <div className="bg-[#071f16]">
              <CourseMap scenario={scenario} point={points[index]} compact />
            </div>
            <div className="p-5">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9b7b25] dark:text-[#d7bc6a]">
                Decision {index + 1} · locked
              </p>
              <h3 className="mt-2 text-xl font-black text-zinc-900 dark:text-white">
                {scenario.title}
              </h3>
              <p className="mt-1 text-sm font-semibold text-[#0a3d2a] dark:text-green-400">
                {scenario.hole}
              </p>
              <p className="mt-3 text-sm font-black leading-6 text-zinc-900 dark:text-white">
                {scenario.question}
              </p>
              <MetricGrid metrics={scenario.metrics} compact />
              <p className="mt-4 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
                {scenario.summary}
              </p>
              <details open className="mt-4 text-sm text-zinc-600 dark:text-zinc-300">
                <summary className="cursor-pointer font-black text-[#0a3d2a] dark:text-green-300">
                  Shot detail
                </summary>
                <ul className="mt-2 space-y-2 leading-5">
                  {scenario.details.map((detail) => (
                    <li key={detail} className="flex items-start gap-2">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c8a951]" />
                      <span>{detail}</span>
                    </li>
                  ))}
                </ul>
              </details>
            </div>
          </article>
        ))}

        <div className="flex flex-wrap justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={onRestart}
            className="rounded-xl bg-[#0a3d2a] px-6 py-3 text-sm font-black text-white"
          >
            Run preview again
          </button>
          <Link
            href="/tournaments/rocket-classic"
            className="rounded-xl border border-zinc-300 px-6 py-3 text-sm font-black text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
          >
            Return to Rocket hub
          </Link>
        </div>
      </div>
    </section>
  );
}

function MetricGrid({
  metrics,
  compact = false,
}: {
  metrics: readonly TargetV2Metric[];
  compact?: boolean;
}) {
  return (
    <div className={`grid grid-cols-2 gap-2 ${compact ? "mt-4" : "mt-5"}`}>
      {metrics.map((metric) => (
        <div
          key={`${metric.label}-${metric.value}`}
          className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-800/70"
        >
          <p className="text-[10px] font-black uppercase tracking-[0.12em] text-zinc-400">
            {metric.label}
          </p>
          <p className="mt-1 text-sm font-black text-zinc-900 dark:text-white">
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function IntroBullet({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#e4cc85]">
        {icon}
      </span>
      <span className="leading-6 text-white/80">{children}</span>
    </li>
  );
}

function PreviewPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-white/80">
      {children}
    </span>
  );
}
