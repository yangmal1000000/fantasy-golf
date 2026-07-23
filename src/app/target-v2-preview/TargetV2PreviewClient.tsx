"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  CheckCircleIcon,
  ClockIcon,
  InfoIcon,
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
  targetV2EssentialFacts,
  type TargetV2Metric,
  type TargetV2Scenario,
} from "@/lib/target-v2";
import CourseMap from "../target/CourseMap";

type PreviewStage = "intro" | "playing" | "review" | "complete" | "expired";

const EMPTY_POINTS: Array<TargetPoint | null> = [null, null, null];

export default function TargetV2PreviewClient() {
  const [stage, setStage] = useState<PreviewStage>("intro");
  const [practicePoint, setPracticePoint] = useState<TargetPoint | null>(null);
  const [points, setPoints] = useState<Array<TargetPoint | null>>([
    ...EMPTY_POINTS,
  ]);
  const [currentScenario, setCurrentScenario] = useState(0);
  const [rulesConfirmed, setRulesConfirmed] = useState(false);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(
    TARGET_ATTEMPT_SECONDS,
  );
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefSeen, setBriefSeen] = useState([false, false, false]);

  const completedCount = points.filter(Boolean).length;
  const allComplete = completedCount === TARGET_V2_SCENARIOS.length;
  const scenario = TARGET_V2_SCENARIOS[currentScenario];
  const currentPoint = points[currentScenario];

  useEffect(() => {
    if ((stage !== "playing" && stage !== "review") || deadline === null)
      return;
    function syncTimer() {
      const remaining = Math.max(
        0,
        Math.ceil((deadline! - Date.now()) / 1_000),
      );
      setSecondsRemaining(remaining);
      if (remaining === 0) setStage("expired");
    }
    syncTimer();
    const interval = window.setInterval(syncTimer, 1_000);
    return () => window.clearInterval(interval);
  }, [deadline, stage]);

  useEffect(() => {
    const attemptActive = stage === "playing" || stage === "review";
    if (!attemptActive) return;
    document.body.classList.add("target-attempt-active");
    return () => document.body.classList.remove("target-attempt-active");
  }, [stage]);

  const statusLabel = useMemo(() => {
    if (stage === "playing")
      return `Decision ${currentScenario + 1} of ${TARGET_V2_SCENARIOS.length}`;
    if (stage === "review") return "Review";
    if (stage === "complete") return "Read-only review";
    return "Working preview";
  }, [currentScenario, stage]);

  function beginPreview() {
    setPoints([...EMPTY_POINTS]);
    setCurrentScenario(0);
    setSecondsRemaining(TARGET_ATTEMPT_SECONDS);
    setDeadline(Date.now() + TARGET_ATTEMPT_SECONDS * 1_000);
    setBriefSeen([false, false, false]);
    setBriefOpen(true);
    setStage("playing");
  }

  function updatePoint(index: number, point: TargetPoint | null) {
    setPoints((current) =>
      current.map((existing, pointIndex) =>
        pointIndex === index ? point : existing,
      ),
    );
  }

  function continueFromScenario() {
    if (!currentPoint) return;
    setBriefSeen((seen) =>
      seen.map((value, index) => (index === currentScenario ? true : value)),
    );
    if (currentScenario < TARGET_V2_SCENARIOS.length - 1) {
      const nextScenario = currentScenario + 1;
      setCurrentScenario(nextScenario);
      setBriefOpen(!briefSeen[nextScenario]);
      return;
    }
    setBriefOpen(false);
    setStage("review");
  }

  function selectScenario(index: number) {
    setCurrentScenario(index);
    setBriefOpen(!briefSeen[index]);
  }

  function dismissBrief() {
    setBriefSeen((seen) =>
      seen.map((value, index) => (index === currentScenario ? true : value)),
    );
    setBriefOpen(false);
  }

  function restartPreview() {
    setStage("intro");
    setPracticePoint(null);
    setPoints([...EMPTY_POINTS]);
    setCurrentScenario(0);
    setRulesConfirmed(false);
    setDeadline(null);
    setSecondsRemaining(TARGET_ATTEMPT_SECONDS);
    setBriefOpen(false);
    setBriefSeen([false, false, false]);
  }

  return (
    <div className="min-h-screen bg-[#f6f4ee] pb-10 dark:bg-[#0d0f0e] sm:pb-16">
      <div
        className={`border-b border-[#c8a951]/25 bg-[#071f16] text-white ${
          stage === "playing" || stage === "review" ? "hidden sm:block" : ""
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-3 py-2 text-[11px] sm:px-4 sm:py-2.5 sm:text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-[0.13em] text-[#e4cc85] sm:gap-2 sm:tracking-[0.16em]">
            <ShieldIcon className="h-4 w-4" /> Target v2 preview
          </span>
          <span className="text-right text-white/65">
            <span className="sm:hidden">Preview only · nothing saved</span>
            <span className="hidden sm:inline">
              Nothing saved · no pass issued
            </span>
          </span>
        </div>
      </div>

      {stage === "intro" ? (
        <section className="relative overflow-hidden bg-[#0a3d2a] text-white">
          <div className="absolute -left-24 top-8 h-72 w-72 rounded-full bg-[#c8a951]/10 blur-3xl" />
          <div className="absolute -right-16 bottom-0 h-64 w-64 rounded-full bg-[#4c9b67]/15 blur-3xl" />
          <div className="relative mx-auto max-w-6xl px-4 py-5 sm:py-11">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#d7bc6a] sm:text-xs sm:tracking-[0.22em]">
              Finish-position prototype
            </p>
            <h1 className="mt-2 max-w-3xl text-2xl font-black tracking-tight sm:mt-3 sm:text-5xl">
              Read the shot. Choose the finish.
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-5 text-white/75 sm:mt-3 sm:text-base sm:leading-6">
              Three golf decisions, clearer yardages and one precise finishing
              marker.
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[11px] font-bold sm:mt-5 sm:gap-2 sm:text-xs">
              <PreviewPill>Free test flight</PreviewPill>
              <PreviewPill>No payment</PreviewPill>
              <PreviewPill>No prize</PreviewPill>
            </div>
          </div>
        </section>
      ) : null}

      <main
        className={`mx-auto max-w-6xl px-4 py-3 sm:py-9 ${
          stage === "playing" || stage === "review"
            ? "max-sm:h-[100dvh] max-sm:w-full max-sm:max-w-none max-sm:p-0"
            : ""
        }`}
      >
        {stage !== "intro" ? (
          <div className="mb-2 hidden flex-wrap items-center justify-between gap-2 sm:mb-5 sm:flex sm:gap-3">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a] sm:text-xs">
              {statusLabel}
            </p>
            {(stage === "playing" || stage === "review") && (
              <div
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-black tabular sm:gap-2 sm:px-4 sm:py-2 sm:text-sm ${
                  secondsRemaining <= 120
                    ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                    : "bg-white text-[#0a3d2a] shadow-sm dark:bg-zinc-900 dark:text-green-400"
                }`}
              >
                <ClockIcon className="h-4 w-4" />{" "}
                {formatAttemptTime(secondsRemaining)}
              </div>
            )}
          </div>
        ) : null}

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
            secondsRemaining={secondsRemaining}
            briefOpen={briefOpen}
            onSelectScenario={selectScenario}
            onChange={(point) => updatePoint(currentScenario, point)}
            onBack={() => setCurrentScenario((index) => Math.max(0, index - 1))}
            onOpenBrief={() => setBriefOpen(true)}
            onDismissBrief={dismissBrief}
            onContinue={continueFromScenario}
          />
        ) : null}

        {stage === "review" ? (
          <ReviewStage
            points={points}
            onEdit={(index) => {
              setCurrentScenario(index);
              setBriefOpen(false);
              setStage("playing");
            }}
            onComplete={() => {
              setDeadline(null);
              setStage("complete");
            }}
            allComplete={allComplete}
            secondsRemaining={secondsRemaining}
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
    <div className="grid gap-3 sm:gap-6 lg:grid-cols-[minmax(0,1.3fr)_minmax(320px,.7fr)]">
      <section className="-mx-4 overflow-hidden border-y border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-900 sm:mx-0 sm:rounded-3xl sm:border-x sm:p-6">
        <div className="flex items-start justify-between gap-3 px-4 py-3 sm:gap-4 sm:px-0 sm:pb-4 sm:pt-0">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a] sm:text-xs">
              Practice
            </p>
            <h2 className="mt-0.5 text-xl font-black text-zinc-900 dark:text-white sm:mt-1 sm:text-2xl">
              Place a finish marker
            </h2>
          </div>
          <span className="rounded-full bg-[#e8f2eb] px-2.5 py-1 text-[10px] font-bold text-[#0a3d2a] dark:bg-green-950/40 dark:text-green-300 sm:px-3 sm:text-xs">
            Not recorded
          </span>
        </div>
        <CourseMap
          scenario={TARGET_V2_PRACTICE}
          point={practicePoint}
          onChange={setPracticePoint}
          edgeToEdgeOnMobile
          compactMobileControls
        />
      </section>

      <aside className="rounded-2xl bg-[#0a3d2a] p-4 text-white shadow-xl sm:rounded-3xl sm:p-8">
        <div className="flex items-center gap-2.5 sm:block">
          <TargetIcon className="h-7 w-7 text-[#d7bc6a] sm:h-10 sm:w-10" />
          <h2 className="text-xl font-black sm:mt-5 sm:text-2xl">
            How it works
          </h2>
        </div>
        <ul className="mt-3 grid grid-cols-3 gap-2 text-xs sm:mt-5 sm:block sm:space-y-4 sm:text-sm">
          <IntroBullet
            icon={<MapPinIcon className="h-4 w-4" />}
            mobileText="Choose the finish"
          >
            Place one marker where you want the ball to finish.
          </IntroBullet>
          <IntroBullet
            icon={<TargetIcon className="h-4 w-4" />}
            mobileText="Three decisions"
          >
            Complete three course decisions.
          </IntroBullet>
          <IntroBullet
            icon={<ClockIcon className="h-4 w-4" />}
            mobileText="20 minutes"
          >
            You have 20 minutes. Speed does not affect the result.
          </IntroBullet>
        </ul>

        <label className="mt-4 flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border border-white/15 bg-white/5 p-3 sm:mt-6 sm:rounded-2xl sm:p-4">
          <input
            type="checkbox"
            checked={rulesConfirmed}
            onChange={(event) => setRulesConfirmed(event.target.checked)}
            className="mt-0.5 h-5 w-5 accent-[#c8a951]"
          />
          <span className="text-[13px] font-semibold leading-5 text-white/80 sm:text-sm sm:leading-6">
            I understand this is one locked attempt and agree to the test-flight
            rules.
          </span>
        </label>

        <details className="mt-2 rounded-xl border border-white/15 px-3 py-2.5 text-xs text-white/75 sm:mt-3 sm:rounded-2xl sm:px-4 sm:py-3 sm:text-sm">
          <summary className="cursor-pointer font-black text-[#f0d986]">
            Test-flight rules
          </summary>
          <ul className="mt-3 space-y-2 leading-5">
            <li>
              One individual Target attempt per verified account; no outside
              assistance.
            </li>
            <li>The live markers lock on submission and cannot be replaced.</li>
            <li>
              Completion—not Target rank—unlocks one non-transferable pass for
              one free Rocket team. Target never changes the fantasy score.
            </li>
            <li>
              Three final panel markers are combined automatically into one
              reference position for each decision. The result identifies
              whether the panel is independent or a coordinator-run rehearsal.
            </li>
            <li>
              Entries rank by combined distance from those references; exact
              ties use Decision 3, then 2, then 1.
            </li>
            <li>There is no entry fee, prize, cash value or payout.</li>
            <li>Target and team entry close at the official first tee.</li>
          </ul>
        </details>

        <button
          type="button"
          onClick={onStart}
          disabled={!ready}
          className="mt-4 min-h-11 w-full rounded-xl bg-[#c8a951] px-5 py-3 text-sm font-black text-[#17251d] transition hover:bg-[#ddc77f] disabled:cursor-not-allowed disabled:opacity-40 sm:mt-6 sm:py-3.5"
        >
          {practicePoint
            ? "Start three decisions →"
            : "Place a practice marker first"}
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
  secondsRemaining,
  briefOpen,
  onSelectScenario,
  onChange,
  onBack,
  onOpenBrief,
  onDismissBrief,
  onContinue,
}: {
  scenario: TargetV2Scenario;
  point: TargetPoint | null;
  currentScenario: number;
  completedCount: number;
  points: Array<TargetPoint | null>;
  secondsRemaining: number;
  briefOpen: boolean;
  onSelectScenario: (index: number) => void;
  onChange: (point: TargetPoint | null) => void;
  onBack: () => void;
  onOpenBrief: () => void;
  onDismissBrief: () => void;
  onContinue: () => void;
}) {
  const essentialFacts = targetV2EssentialFacts(scenario);

  return (
    <section className="target-attempt-shell fixed inset-0 z-[80] flex h-[100dvh] flex-col overflow-hidden bg-white dark:bg-[#0d0f0e] sm:static sm:h-auto sm:overflow-hidden sm:rounded-3xl sm:border sm:border-zinc-200 sm:bg-white sm:shadow-xl sm:shadow-[#0a3d2a]/5 sm:dark:border-zinc-800 sm:dark:bg-zinc-900">
      <header className="relative shrink-0 bg-[#071f16] text-white sm:hidden safe-area-top">
        <div className="flex min-h-14 items-center gap-2 px-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d7bc6a]">
              Target v2 preview
            </p>
            <p className="mt-0.5 text-sm font-black">
              Decision {currentScenario + 1} of {TARGET_V2_SCENARIOS.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onOpenBrief}
            className="flex min-h-11 items-center gap-1.5 rounded-xl border border-white/15 bg-white/10 px-3 text-xs font-black text-white"
            aria-haspopup="dialog"
          >
            <InfoIcon className="h-4 w-4 text-[#e4cc85]" />
            Brief
          </button>
          <div
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-black tabular ${
              secondsRemaining <= 120
                ? "bg-red-950/70 text-red-200"
                : "bg-white/10 text-green-300"
            }`}
            aria-label={`${formatAttemptTime(secondsRemaining)} remaining`}
          >
            <ClockIcon className="h-4 w-4" />
            {formatAttemptTime(secondsRemaining)}
          </div>
        </div>
        <div className="h-1 bg-white/10">
          <div
            className="h-full bg-[#c8a951] transition-all"
            style={{
              width: `${((currentScenario + 1) / TARGET_V2_SCENARIOS.length) * 100}%`,
            }}
          />
        </div>
      </header>

      <div className="hidden border-b border-zinc-100 px-6 py-4 dark:border-zinc-800 sm:block">
        <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex gap-1.5 sm:gap-2">
            {TARGET_V2_SCENARIOS.map((item, index) => (
              <button
                type="button"
                key={item.id}
                onClick={() => onSelectScenario(index)}
                className={`flex h-11 min-w-11 items-center justify-center rounded-full px-2.5 text-xs font-black transition sm:h-10 sm:min-w-10 sm:px-3 ${
                  index === currentScenario
                    ? "bg-[#0a3d2a] text-white"
                    : points[index]
                      ? "bg-[#e8f2eb] text-[#0a3d2a] dark:bg-green-950/40 dark:text-green-300"
                      : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                }`}
                aria-label={`Open decision ${index + 1}${points[index] ? ", marker placed" : ""}`}
              >
                {points[index] ? (
                  <CheckCircleIcon className="mr-1 h-4 w-4" />
                ) : null}
                {index + 1}
              </button>
            ))}
          </div>
          <span className="text-[11px] font-semibold text-zinc-500 sm:text-xs">
            {completedCount}/3 markers placed
          </span>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800 sm:mt-3 sm:h-1.5">
          <div
            className="h-full rounded-full bg-[#c8a951] transition-all"
            style={{ width: `${(completedCount / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col sm:grid sm:flex-none lg:grid-cols-[minmax(0,1.45fr)_minmax(330px,.8fr)]">
        <div className="w-full shrink-0 bg-[#071f16] sm:p-5">
          <CourseMap
            scenario={scenario}
            point={point}
            onChange={onChange}
            edgeToEdgeOnMobile
            immersiveMobileControls
            mobileBelowMap={
              <button
                type="button"
                onClick={onOpenBrief}
                className="w-full border-b border-white/10 bg-[#10231c] px-4 py-3 text-left sm:hidden"
                aria-haspopup="dialog"
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-white">
                    {scenario.title}
                  </span>
                  <span className="shrink-0 text-[10px] font-black uppercase tracking-wide text-green-300">
                    Full details
                  </span>
                </span>
                <span className="mt-1 block truncate text-[11px] font-bold text-[#e4cc85]">
                  {essentialFacts.map((metric) => metric.value).join(" · ")}
                </span>
                <span className="mt-1 block text-xs leading-4 text-white/70">
                  {scenario.summary}
                </span>
              </button>
            }
          />
        </div>

        <div className="hidden p-7 sm:block">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a] sm:text-xs">
            {scenario.eyebrow}
          </p>
          <h2 className="mt-1 text-xl font-black text-zinc-900 dark:text-white sm:mt-2 sm:text-2xl">
            {scenario.title}
          </h2>
          <p className="mt-0.5 text-xs font-semibold text-[#0a3d2a] dark:text-green-400 sm:mt-1 sm:text-sm">
            {scenario.hole}
          </p>
          <p className="mt-3 rounded-xl bg-[#f4f0e5] p-3 text-sm font-black leading-5 text-zinc-900 dark:bg-zinc-800 dark:text-white sm:mt-4 sm:rounded-2xl sm:p-4 sm:text-base sm:leading-6">
            {scenario.question}
          </p>

          <MetricGrid metrics={scenario.metrics} />

          <details className="mt-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700 sm:mt-5 sm:rounded-2xl sm:p-4">
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

          <div className="mt-4 flex items-center justify-between gap-3 sm:mt-6">
            <button
              type="button"
              onClick={onBack}
              disabled={currentScenario === 0}
              className="min-h-11 rounded-xl border border-zinc-200 px-4 py-2.5 text-sm font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300 sm:py-3"
            >
              Back
            </button>
            <button
              type="button"
              onClick={onContinue}
              disabled={!point}
              className="min-h-11 rounded-xl bg-[#0a3d2a] px-4 py-2.5 text-sm font-black text-white transition hover:bg-[#15543b] disabled:cursor-not-allowed disabled:opacity-35 sm:px-5 sm:py-3"
            >
              {currentScenario === 2 ? "Review decisions" : "Save and continue"}{" "}
              →
            </button>
          </div>
        </div>

        <div className="mt-auto flex shrink-0 items-center gap-2 border-t border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950 sm:hidden safe-area-bottom">
          <button
            type="button"
            onClick={onBack}
            disabled={currentScenario === 0}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 text-xl font-black text-zinc-600 disabled:opacity-25 dark:border-zinc-700 dark:text-zinc-300"
            aria-label="Previous decision"
          >
            ←
          </button>
          <button
            type="button"
            onClick={onContinue}
            disabled={!point}
            className="min-h-11 flex-1 rounded-xl bg-[#0a3d2a] px-4 py-2.5 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-35"
          >
            {currentScenario === 2 ? "Review decisions" : "Save and continue"}{" "}
            →
          </button>
        </div>
      </div>

      <ShotBriefSheet
        open={briefOpen}
        scenario={scenario}
        onDismiss={onDismissBrief}
      />
    </section>
  );
}

function ShotBriefSheet({
  open,
  scenario,
  onDismiss,
}: {
  open: boolean;
  scenario: TargetV2Scenario;
  onDismiss: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = `shot-brief-${scenario.id}`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const mobile = window.matchMedia("(max-width: 639px)");

    const syncDialog = () => {
      if (open && mobile.matches && !dialog.open) {
        dialog.showModal();
      } else if ((!open || !mobile.matches) && dialog.open) {
        dialog.close();
      }
    };

    syncDialog();
    mobile.addEventListener("change", syncDialog);
    return () => {
      mobile.removeEventListener("change", syncDialog);
      if (dialog.open) dialog.close();
    };
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onDismiss();
      }}
      onClick={(event) => {
        if (event.currentTarget === event.target) onDismiss();
      }}
      className="target-shot-dialog fixed inset-x-0 bottom-0 top-auto m-0 max-h-[86dvh] w-full max-w-none overflow-y-auto rounded-t-3xl border-0 bg-white p-0 text-zinc-900 shadow-2xl dark:bg-zinc-900 dark:text-white sm:hidden safe-area-bottom"
    >
      <div className="sticky top-0 z-10 border-b border-zinc-200 bg-white/95 px-4 pb-3 pt-2 backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
        <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-zinc-300 dark:bg-zinc-600" />
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
              Decision {scenario.number} · Shot brief
            </p>
            <h2 id={titleId} className="mt-1 text-xl font-black">
              {scenario.title}
            </h2>
            <p className="mt-0.5 text-xs font-semibold text-[#0a3d2a] dark:text-green-300">
              {scenario.hole}
            </p>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xl font-black text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            aria-label="Close shot brief"
          >
            ×
          </button>
        </div>
      </div>

      <div className="p-4">
        <p className="rounded-2xl bg-[#f4f0e5] p-3 text-sm font-black leading-5 dark:bg-zinc-800">
          {scenario.question}
        </p>
        <MetricGrid metrics={scenario.metrics} />
        <p className="mt-4 text-sm font-semibold leading-5 text-zinc-700 dark:text-zinc-200">
          {scenario.summary}
        </p>
        <ul className="mt-3 space-y-2 text-sm leading-5 text-zinc-600 dark:text-zinc-300">
          {scenario.details.map((detail) => (
            <li key={detail} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c8a951]" />
              <span>{detail}</span>
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 min-h-12 w-full rounded-xl bg-[#0a3d2a] px-5 py-3 text-sm font-black text-white"
        >
          Choose finishing position
        </button>
      </div>
    </dialog>
  );
}

function ReviewStage({
  points,
  onEdit,
  onComplete,
  allComplete,
  secondsRemaining,
}: {
  points: Array<TargetPoint | null>;
  onEdit: (index: number) => void;
  onComplete: () => void;
  allComplete: boolean;
  secondsRemaining: number;
}) {
  return (
    <section className="target-attempt-shell fixed inset-0 z-[80] flex h-[100dvh] flex-col overflow-hidden bg-[#f6f4ee] dark:bg-[#0d0f0e] sm:static sm:h-auto sm:overflow-hidden sm:rounded-3xl sm:border sm:border-zinc-200 sm:bg-white sm:p-8 sm:shadow-xl sm:dark:border-zinc-800 sm:dark:bg-zinc-900">
      <header className="relative shrink-0 bg-[#071f16] text-white sm:hidden safe-area-top">
        <div className="flex min-h-14 items-center justify-between gap-3 px-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#d7bc6a]">
              Target v2 preview
            </p>
            <p className="mt-0.5 text-sm font-black">Final review</p>
          </div>
          <div
            className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-xs font-black tabular ${
              secondsRemaining <= 120
                ? "bg-red-950/70 text-red-200"
                : "bg-white/10 text-green-300"
            }`}
            aria-label={`${formatAttemptTime(secondsRemaining)} remaining`}
          >
            <ClockIcon className="h-4 w-4" />
            {formatAttemptTime(secondsRemaining)}
          </div>
        </div>
        <div className="h-1 bg-[#c8a951]" />
      </header>

      <div className="shrink-0 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800 sm:px-0 sm:pb-6 sm:pt-0">
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a] sm:text-xs">
          Final review
        </p>
        <h2 className="mt-1 text-xl font-black text-zinc-900 dark:text-white sm:mt-2 sm:text-3xl">
          Check your finishing positions
        </h2>
        <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400 sm:mt-2 sm:text-sm">
          In the live version, these markers lock when submitted.
        </p>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-hidden p-3 sm:mt-6 sm:grid sm:flex-none sm:space-y-0 sm:p-0 sm:gap-4 lg:grid-cols-3">
        {TARGET_V2_SCENARIOS.map((scenario, index) => {
          const point = points[index];
          const yards = estimateTargetFinishYards(scenario, point);
          return (
            <article
              key={scenario.id}
              className="flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white p-2 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 sm:block sm:overflow-hidden sm:p-0 sm:shadow-none"
            >
              <div className="w-28 shrink-0 overflow-hidden rounded-xl sm:w-auto sm:rounded-none">
                <CourseMap scenario={scenario} point={point} compact />
              </div>
              <div className="min-w-0 flex-1 sm:p-4">
                <p className="text-[10px] font-black uppercase tracking-wide text-[#9b7b25] dark:text-[#d7bc6a] sm:text-xs">
                  Decision {index + 1}
                </p>
                <h3 className="mt-0.5 truncate text-sm font-black text-zinc-900 dark:text-white sm:mt-1 sm:text-base">
                  {scenario.title}
                </h3>
                <p className="mt-0.5 text-xs font-bold text-zinc-500 dark:text-zinc-400 sm:mt-2 sm:text-sm">
                  Approx. {yards ?? "—"} yards from the ball
                </p>
                <button
                  type="button"
                  onClick={() => onEdit(index)}
                  className="mt-1 min-h-11 text-xs font-black text-[#0a3d2a] underline decoration-[#c8a951] decoration-2 underline-offset-4 dark:text-green-400 sm:mt-4 sm:text-sm"
                >
                  Edit marker
                </button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-auto shrink-0 border-t border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950 sm:mt-6 sm:flex sm:justify-end sm:border-0 sm:bg-transparent sm:p-0 sm:dark:bg-transparent safe-area-bottom">
        <button
          type="button"
          disabled={!allComplete}
          onClick={onComplete}
          className="min-h-11 w-full rounded-xl bg-[#0a3d2a] px-7 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40 sm:w-auto sm:py-3.5"
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
      <div className="bg-[#0a3d2a] px-4 py-5 text-center text-white sm:px-10 sm:py-9">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#c8a951] text-[#0a3d2a] shadow-lg sm:h-16 sm:w-16">
          <CheckCircleIcon className="h-7 w-7 sm:h-9 sm:w-9" />
        </span>
        <h2 className="mt-3 text-2xl font-black sm:mt-5 sm:text-3xl">
          Preview complete
        </h2>
        <p className="mt-1 text-sm text-white/70 sm:mt-2">
          Nothing was saved. This is the proposed read-only view after a live
          submission.
        </p>
      </div>

      <div className="space-y-3 p-3 sm:space-y-5 sm:p-8">
        {TARGET_V2_SCENARIOS.map((scenario, index) => (
          <article
            key={scenario.id}
            className="grid overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-700 md:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]"
          >
            <div className="bg-[#071f16]">
              <CourseMap scenario={scenario} point={points[index]} compact />
            </div>
            <div className="p-4 sm:p-5">
              <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[#9b7b25] dark:text-[#d7bc6a] sm:text-xs">
                Decision {index + 1} · locked
              </p>
              <h3 className="mt-1 text-lg font-black text-zinc-900 dark:text-white sm:mt-2 sm:text-xl">
                {scenario.title}
              </h3>
              <p className="mt-0.5 text-xs font-semibold text-[#0a3d2a] dark:text-green-400 sm:mt-1 sm:text-sm">
                {scenario.hole}
              </p>
              <p className="mt-2 text-sm font-black leading-5 text-zinc-900 dark:text-white sm:mt-3 sm:leading-6">
                {scenario.question}
              </p>
              <MetricGrid metrics={scenario.metrics} compact />
              <p className="mt-3 text-sm leading-5 text-zinc-600 dark:text-zinc-300 sm:mt-4 sm:leading-6">
                {scenario.summary}
              </p>
              <details className="mt-3 text-sm text-zinc-600 dark:text-zinc-300 sm:mt-4">
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

        <div className="flex flex-wrap justify-center gap-2 pt-1 sm:gap-3 sm:pt-2">
          <button
            type="button"
            onClick={onRestart}
            className="min-h-11 rounded-xl bg-[#0a3d2a] px-5 py-2.5 text-sm font-black text-white sm:px-6 sm:py-3"
          >
            Run preview again
          </button>
          <Link
            href="/tournaments/rocket-classic"
            className="min-h-11 rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-black text-zinc-700 dark:border-zinc-700 dark:text-zinc-200 sm:px-6 sm:py-3"
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
    <div
      className={`grid grid-cols-2 gap-1.5 sm:gap-2 ${
        compact ? "mt-3 sm:mt-4" : "mt-3 sm:mt-5"
      }`}
    >
      {metrics.map((metric) => (
        <div
          key={`${metric.label}-${metric.value}`}
          className="rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-2 dark:border-zinc-700 dark:bg-zinc-800/70 sm:rounded-xl sm:px-3 sm:py-3"
        >
          <p className="text-[9px] font-black uppercase tracking-[0.1em] text-zinc-400 sm:text-[10px] sm:tracking-[0.12em]">
            {metric.label}
          </p>
          <p className="mt-0.5 text-[13px] font-black text-zinc-900 dark:text-white sm:mt-1 sm:text-sm">
            {metric.value}
          </p>
        </div>
      ))}
    </div>
  );
}

function IntroBullet({
  icon,
  mobileText,
  children,
}: {
  icon: ReactNode;
  mobileText: string;
  children: ReactNode;
}) {
  return (
    <li className="flex min-w-0 flex-col items-center gap-1.5 rounded-xl bg-white/5 p-2 text-center sm:flex-row sm:items-start sm:gap-3 sm:bg-transparent sm:p-0 sm:text-left">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#e4cc85] sm:mt-0.5">
        {icon}
      </span>
      <span className="leading-4 text-white/80 sm:hidden">{mobileText}</span>
      <span className="hidden leading-6 text-white/80 sm:inline">
        {children}
      </span>
    </li>
  );
}

function PreviewPill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-white/80 sm:px-3 sm:py-1.5">
      {children}
    </span>
  );
}
