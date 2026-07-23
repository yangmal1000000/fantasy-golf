"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  PRACTICE_SCENARIO,
  TARGET_ATTEMPT_SECONDS,
  TARGET_SCENARIOS,
  formatAttemptTime,
  formatTargetCoordinate,
  type TargetPoint,
} from "@/lib/target-challenge";
import type { TargetPilotStatusDto } from "@/lib/target-pilot-core";
import {
  CheckCircleIcon,
  ClockIcon,
  InfoIcon,
  LockIcon,
  MapPinIcon,
  ShieldIcon,
  TargetIcon,
  TrophyIcon,
} from "@/components/icons";
import CourseMap from "./CourseMap";

type Stage = "intro" | "eligibility" | "playing" | "review" | "submitted" | "expired" | "closed";

const EMPTY_POINTS: Array<TargetPoint | null> = [null, null, null];

export default function TargetChallengeClient() {
  const [stage, setStage] = useState<Stage>("intro");
  const [practicePoint, setPracticePoint] = useState<TargetPoint | null>(null);
  const [points, setPoints] = useState<Array<TargetPoint | null>>(EMPTY_POINTS);
  const [currentScenario, setCurrentScenario] = useState(0);
  const [secondsRemaining, setSecondsRemaining] = useState(TARGET_ATTEMPT_SECONDS);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [entryReference, setEntryReference] = useState<string | null>(null);
  const [accountConfirmed, setAccountConfirmed] = useState(false);
  const [betaConfirmed, setBetaConfirmed] = useState(false);
  const [rulesConfirmed, setRulesConfirmed] = useState(false);
  const [rocketPass, setRocketPass] =
    useState<TargetPilotStatusDto["rocketPass"] | null>(null);
  const [pilotChecking, setPilotChecking] = useState(true);
  const [submissionBusy, setSubmissionBusy] = useState(false);
  const [submissionError, setSubmissionError] = useState<string | null>(null);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);

  const completedCount = points.filter(Boolean).length;
  const allComplete = completedCount === TARGET_SCENARIOS.length;
  const currentPoint = points[currentScenario];
  const scenario = TARGET_SCENARIOS[currentScenario];

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

  useEffect(() => {
    let active = true;
    fetch("/api/target-pilot-entry", { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Unable to check pilot entry status");
        return body as TargetPilotStatusDto;
      })
      .then((status) => {
        if (!active) return;
        setRocketPass(status.rocketPass);
        if (status.entry?.submission) {
          setPoints(status.entry.submission.points.map((item) => item.point));
          setEntryReference(status.entry.reference);
          setSubmittedAt(status.entry.submittedAt);
          setDeadline(null);
          setStage("submitted");
        } else if (!status.entryOpen) {
          setStage("closed");
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setSubmissionError(caught instanceof Error ? caught.message : "Unable to check pilot entry status");
        }
      })
      .finally(() => {
        if (active) setPilotChecking(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const statusLabel = useMemo(() => {
    if (stage === "playing") return `Decision ${currentScenario + 1} of ${TARGET_SCENARIOS.length}`;
    if (stage === "review") return "Review all targets";
    return "Interactive prototype";
  }, [currentScenario, stage]);

  function updatePoint(index: number, point: TargetPoint | null) {
    setPoints((current) => current.map((existing, pointIndex) => (pointIndex === index ? point : existing)));
  }

  function beginPrototype() {
    const nextDeadline = Date.now() + TARGET_ATTEMPT_SECONDS * 1_000;
    setPoints([...EMPTY_POINTS]);
    setCurrentScenario(0);
    setEntryReference(null);
    setSecondsRemaining(TARGET_ATTEMPT_SECONDS);
    setDeadline(nextDeadline);
    setStage("playing");
  }

  function continueFromScenario() {
    if (!currentPoint) return;
    if (currentScenario < TARGET_SCENARIOS.length - 1) {
      setCurrentScenario((index) => index + 1);
    } else {
      setStage("review");
    }
  }

  async function submitPrototype() {
    if (!allComplete || secondsRemaining === 0) return;
    setSubmissionBusy(true);
    setSubmissionError(null);
    try {
      const response = await fetch("/api/target-pilot-entry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submission: {
            points: TARGET_SCENARIOS.map((item, index) => ({
              scenarioId: item.id,
              point: points[index],
            })),
          },
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Unable to save the pilot entry");
      const status = body as TargetPilotStatusDto;
      if (!status.entry) throw new Error("The saved pilot entry could not be confirmed");
      setEntryReference(status.entry.reference);
      setSubmittedAt(status.entry.submittedAt);
      setRocketPass(status.rocketPass);
      setDeadline(null);
      setStage("submitted");
    } catch (caught) {
      setSubmissionError(caught instanceof Error ? caught.message : "Unable to save the pilot entry");
    } finally {
      setSubmissionBusy(false);
    }
  }

  function resetPrototype() {
    setStage("intro");
    setPracticePoint(null);
    setPoints([...EMPTY_POINTS]);
    setCurrentScenario(0);
    setSecondsRemaining(TARGET_ATTEMPT_SECONDS);
    setDeadline(null);
    setEntryReference(null);
    setSubmittedAt(null);
    setSubmissionError(null);
    setAccountConfirmed(false);
    setBetaConfirmed(false);
    setRulesConfirmed(false);
  }

  return (
    <div className="min-h-screen bg-[#f6f4ee] pb-20 dark:bg-[#0d0f0e] sm:pb-0">
      <div className="border-b border-[#c8a951]/25 bg-[#071f16] text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-2.5 text-xs">
          <span className="inline-flex items-center gap-2 font-bold uppercase tracking-[0.16em] text-[#e4cc85]">
            <ShieldIcon className="h-4 w-4" /> Open test-flight gateway
          </span>
          <span className="text-right text-white/65">Open signup · No payment · No prize</span>
        </div>
      </div>

      <section className="relative overflow-hidden bg-[#0a3d2a] text-white">
        <div className="absolute -left-24 top-12 h-80 w-80 rounded-full bg-[#c8a951]/10 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-[#4c9b67]/15 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-4 py-8 sm:py-12">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#d7bc6a]">Target · Rocket Classic test flight</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">Read the hole. Place the target.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/75 sm:text-base">
                Complete three demanding golf decisions to unlock one account-bound Rocket Classic Test Pass. Your Target score never changes your fantasy score.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <HeroStat label="Beta entry" value="£0" />
              <HeroStat label="Test Pass" value="1" />
              <HeroStat label="Decisions" value="3" />
            </div>
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10">
        {pilotChecking ? (
          <p className="mb-4 rounded-2xl border border-zinc-200 bg-white p-3 text-center text-xs font-bold text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900">Checking your private pilot status…</p>
        ) : null}
        {submissionError ? (
          <p className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{submissionError}</p>
        ) : null}
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">{statusLabel}</p>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Finish once to unlock your pass. No purchase, prize or random draw.</p>
          </div>
          {(stage === "playing" || stage === "review") && (
            <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-black tabular ${secondsRemaining <= 120 ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-white text-[#0a3d2a] shadow-sm dark:bg-zinc-900 dark:text-green-400"}`}>
              <ClockIcon className="h-4 w-4" /> {formatAttemptTime(secondsRemaining)}
            </div>
          )}
        </div>

        {stage === "intro" && (
          <IntroStage
            practicePoint={practicePoint}
            setPracticePoint={setPracticePoint}
            onContinue={() => setStage("eligibility")}
          />
        )}

        {stage === "eligibility" && (
          <EligibilityStage
            accountConfirmed={accountConfirmed}
            betaConfirmed={betaConfirmed}
            rulesConfirmed={rulesConfirmed}
            setAccountConfirmed={setAccountConfirmed}
            setBetaConfirmed={setBetaConfirmed}
            setRulesConfirmed={setRulesConfirmed}
            onBack={() => setStage("intro")}
            onStart={beginPrototype}
          />
        )}

        {stage === "playing" && (
          <section className="-mx-4 overflow-hidden rounded-none border-y border-zinc-200 bg-white shadow-xl shadow-[#0a3d2a]/5 dark:border-zinc-800 dark:bg-zinc-900 sm:mx-0 sm:rounded-3xl sm:border-x">
            <div className="border-b border-zinc-100 px-4 py-4 dark:border-zinc-800 sm:px-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                  {TARGET_SCENARIOS.map((item, index) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => setCurrentScenario(index)}
                      className={`flex h-10 min-w-10 items-center justify-center rounded-full px-3 text-xs font-black transition ${
                        index === currentScenario
                          ? "bg-[#0a3d2a] text-white"
                          : points[index]
                            ? "bg-[#e8f2eb] text-[#0a3d2a] dark:bg-green-950/40 dark:text-green-300"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}
                      aria-label={`Open decision ${index + 1}${points[index] ? ", target placed" : ""}`}
                    >
                      {points[index] ? <CheckCircleIcon className="mr-1 h-4 w-4" /> : null}
                      {index + 1}
                    </button>
                  ))}
                </div>
                <span className="text-xs font-semibold text-zinc-500">{completedCount}/3 targets placed</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className="h-full rounded-full bg-[#c8a951] transition-all" style={{ width: `${(completedCount / 3) * 100}%` }} />
              </div>
            </div>

            <div className="grid gap-0 lg:grid-cols-[minmax(0,1.45fr)_minmax(320px,.8fr)]">
              <div className="self-start bg-[#071f16] p-0 sm:p-5">
                <CourseMap
                  scenario={scenario}
                  point={currentPoint}
                  onChange={(point) => updatePoint(currentScenario, point)}
                  edgeToEdgeOnMobile
                />
              </div>
              <div className="p-5 sm:p-7">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">{scenario.eyebrow}</p>
                <h2 className="mt-2 text-2xl font-black text-zinc-900 dark:text-white">{scenario.title}</h2>
                <p className="mt-1 text-sm font-semibold text-[#0a3d2a] dark:text-green-400">{scenario.hole}</p>
                <p className="mt-4 rounded-2xl bg-[#f4f0e5] p-4 text-sm font-bold leading-6 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-100">{scenario.question}</p>

                <FactGroup title="Supplied golfer" items={scenario.playerFacts} />
                <FactGroup title="Conditions" items={scenario.conditions} />

                <div className="mt-5 rounded-xl border border-[#c8a951]/30 bg-[#fffaf0] p-3 text-xs leading-5 text-zinc-600 dark:bg-[#c8a951]/10 dark:text-zinc-300">
                  <strong className="text-zinc-900 dark:text-white">What this tests:</strong> {scenario.skill}
                </div>

                <div className="mt-6 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentScenario((index) => Math.max(0, index - 1))}
                    disabled={currentScenario === 0}
                    className="rounded-xl border border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-600 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-30 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={continueFromScenario}
                    disabled={!currentPoint}
                    className="rounded-xl bg-[#0a3d2a] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#15543b] disabled:cursor-not-allowed disabled:opacity-35"
                  >
                    {currentScenario === 2 ? "Review all targets" : "Save and continue"} →
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {stage === "review" && (
          <ReviewStage
            points={points}
            onEdit={(index) => {
              setCurrentScenario(index);
              setStage("playing");
            }}
            onSubmit={submitPrototype}
            submitting={submissionBusy}
          />
        )}

        {stage === "submitted" && (
          <SubmittedStage
            points={points}
            entryReference={entryReference}
            submittedAt={submittedAt}
            rocketPass={rocketPass}
          />
        )}

        {stage === "closed" && (
          <section className="mx-auto max-w-xl rounded-3xl border border-zinc-200 bg-white p-8 text-center shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
            <LockIcon className="mx-auto h-12 w-12 text-[#9b7b25] dark:text-[#d7bc6a]" />
            <h2 className="mt-4 text-2xl font-black text-zinc-900 dark:text-white">Pilot entries are closed</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">The coordinator has sealed this rehearsal entry set. No late or replacement target can be added.</p>
          </section>
        )}

        {stage === "expired" && (
          <section className="mx-auto max-w-xl rounded-3xl border border-red-200 bg-white p-8 text-center shadow-lg dark:border-red-900/50 dark:bg-zinc-900">
            <ClockIcon className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-2xl font-black text-zinc-900 dark:text-white">Prototype time expired</h2>
            <p className="mt-2 text-sm leading-6 text-zinc-500 dark:text-zinc-400">No entry was created and no Test Pass was issued. You can restart while beta entries remain open.</p>
            <button type="button" onClick={resetPrototype} className="mt-6 rounded-xl bg-[#0a3d2a] px-6 py-3 text-sm font-black text-white">Restart prototype</button>
          </section>
        )}
      </main>
    </div>
  );
}
function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-24 rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-center backdrop-blur sm:min-w-28">
      <p className="text-xl font-black text-[#f0d986] sm:text-2xl">{value}</p>
      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-white/60">{label}</p>
    </div>
  );
}

function IntroStage({
  practicePoint,
  setPracticePoint,
  onContinue,
}: {
  practicePoint: TargetPoint | null;
  setPracticePoint: (point: TargetPoint | null) => void;
  onContinue: () => void;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(320px,.75fr)]">
      <section className="-mx-4 overflow-hidden rounded-none border-y border-zinc-200 bg-white p-0 shadow-lg shadow-[#0a3d2a]/5 dark:border-zinc-800 dark:bg-zinc-900 sm:mx-0 sm:rounded-3xl sm:border-x sm:p-6">
        <div className="mb-4 flex items-start justify-between gap-4 px-4 pt-4 sm:px-0 sm:pt-0">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">Free practice</p>
            <h2 className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">Learn the marker</h2>
          </div>
          <span className="rounded-full bg-[#e8f2eb] px-3 py-1 text-xs font-bold text-[#0a3d2a] dark:bg-green-950/40 dark:text-green-300">Not scored</span>
        </div>
        <CourseMap
          scenario={PRACTICE_SCENARIO}
          point={practicePoint}
          onChange={setPracticePoint}
          edgeToEdgeOnMobile
        />
      </section>

      <aside className="rounded-3xl bg-[#0a3d2a] p-6 text-white shadow-xl sm:p-8">
        <TargetIcon className="h-10 w-10 text-[#d7bc6a]" />
        <h2 className="mt-5 text-2xl font-black">The pin is your answer</h2>
        <p className="mt-3 text-sm leading-6 text-white/75">You are not guessing where a future shot will finish. You are choosing the centre of the carry landing pattern that best solves the supplied strategy problem.</p>
        <ul className="mt-6 space-y-3 text-sm">
          <IntroBullet icon={<MapPinIcon className="h-4 w-4" />} text="One precise pin for each of three course situations" />
          <IntroBullet icon={<ClockIcon className="h-4 w-4" />} text="20 minutes; completion speed never changes your score" />
          <IntroBullet icon={<ShieldIcon className="h-4 w-4" />} text="One locked Target submission per verified account" />
          <IntroBullet icon={<TrophyIcon className="h-4 w-4" />} text="Completion unlocks one Rocket Classic Test Pass" />
        </ul>
        <button
          type="button"
          onClick={onContinue}
          disabled={!practicePoint}
          className="mt-8 w-full rounded-xl bg-[#c8a951] px-5 py-3.5 text-sm font-black text-[#17251d] transition hover:bg-[#ddc77f] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {practicePoint ? "Continue to eligibility →" : "Place a practice pin to continue"}
        </button>
      </aside>
    </div>
  );
}

function IntroBullet({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/10 text-[#e4cc85]">{icon}</span>
      <span className="leading-6 text-white/80">{text}</span>
    </li>
  );
}

function EligibilityStage({
  accountConfirmed,
  betaConfirmed,
  rulesConfirmed,
  setAccountConfirmed,
  setBetaConfirmed,
  setRulesConfirmed,
  onBack,
  onStart,
}: {
  accountConfirmed: boolean;
  betaConfirmed: boolean;
  rulesConfirmed: boolean;
  setAccountConfirmed: (value: boolean) => void;
  setBetaConfirmed: (value: boolean) => void;
  setRulesConfirmed: (value: boolean) => void;
  onBack: () => void;
  onStart: () => void;
}) {
  const ready = accountConfirmed && betaConfirmed && rulesConfirmed;
  return (
    <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-100 bg-[#0a3d2a] p-6 text-white dark:border-zinc-800 sm:p-8">
        <LockIcon className="h-9 w-9 text-[#d7bc6a]" />
        <h2 className="mt-4 text-2xl font-black">Before the attempt begins</h2>
        <p className="mt-2 text-sm leading-6 text-white/70">This free test flight uses your verified account. Completing it unlocks a non-transferable Test Pass, not a cash-value voucher.</p>
      </div>
      <div className="space-y-3 p-6 sm:p-8">
        <ConfirmRow checked={accountConfirmed} onChange={setAccountConfirmed} label="I am using my own verified account." />
        <ConfirmRow checked={betaConfirmed} onChange={setBetaConfirmed} label="I understand this test flight has no payment, cash value or prize." />
        <ConfirmRow checked={rulesConfirmed} onChange={setRulesConfirmed} label="I understand this is one individual skill attempt and external assistance is not allowed." />

        <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
          <strong>Beta safeguard:</strong> pressing start takes no money. A completed submission only unlocks entry to the private Rocket Classic rehearsal.
        </div>

        <div className="flex items-center justify-between gap-3 pt-4">
          <button type="button" onClick={onBack} className="rounded-xl border border-zinc-200 px-4 py-3 text-sm font-bold text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">Back</button>
          <button type="button" onClick={onStart} disabled={!ready} className="rounded-xl bg-[#0a3d2a] px-6 py-3 text-sm font-black text-white transition hover:bg-[#15543b] disabled:cursor-not-allowed disabled:opacity-35">Start 20-minute Target →</button>
        </div>
      </div>
    </section>
  );
}

function ConfirmRow({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 p-4 transition hover:border-[#c8a951] dark:border-zinc-700">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="mt-0.5 h-5 w-5 accent-[#0a3d2a]" />
      <span className="text-sm font-semibold leading-6 text-zinc-700 dark:text-zinc-200">{label}</span>
    </label>
  );
}

function FactGroup({ title, items }: { title: string; items: readonly string[] }) {
  return (
    <div className="mt-5">
      <h3 className="text-xs font-black uppercase tracking-[0.14em] text-zinc-500 dark:text-zinc-400">{title}</h3>
      <ul className="mt-2 grid gap-2 text-sm text-zinc-600 dark:text-zinc-300">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c8a951]" />
            <span className="leading-5">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ReviewStage({
  points,
  onEdit,
  onSubmit,
  submitting,
}: {
  points: Array<TargetPoint | null>;
  onEdit: (index: number) => void;
  onSubmit: () => Promise<void>;
  submitting: boolean;
}) {
  return (
    <section className="-mx-4 overflow-hidden rounded-none border-y border-zinc-200 bg-white p-0 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 sm:mx-0 sm:rounded-3xl sm:border-x sm:p-8">
      <div className="flex flex-col gap-3 border-b border-zinc-100 px-4 pb-6 pt-6 dark:border-zinc-800 sm:flex-row sm:items-end sm:justify-between sm:px-0 sm:pt-0">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">Final review</p>
          <h2 className="mt-2 text-3xl font-black text-zinc-900 dark:text-white">Lock your three targets</h2>
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">Submission time does not affect ranking. Check every marker carefully.</p>
        </div>
        <span className="inline-flex items-center gap-2 text-sm font-bold text-[#0a3d2a] dark:text-green-400"><LockIcon className="h-4 w-4" /> Coordinates lock on submit</span>
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {TARGET_SCENARIOS.map((scenario, index) => {
          const point = points[index];
          return (
            <article key={scenario.id} className="overflow-hidden rounded-none border-y border-zinc-200 dark:border-zinc-700 sm:rounded-2xl sm:border-x">
              <CourseMap scenario={scenario} point={point} compact edgeToEdgeOnMobile />
              <div className="p-4">
                <p className="text-xs font-black uppercase tracking-wide text-[#9b7b25] dark:text-[#d7bc6a]">Decision {index + 1}</p>
                <h3 className="mt-1 font-black text-zinc-900 dark:text-white">{scenario.title}</h3>
                {point && (
                  <p className="mt-2 font-mono text-xs text-zinc-500 dark:text-zinc-400">X {formatTargetCoordinate(point.x)} · Y {formatTargetCoordinate(point.y)}</p>
                )}
                <button type="button" onClick={() => onEdit(index)} className="mt-4 text-sm font-black text-[#0a3d2a] underline decoration-[#c8a951] decoration-2 underline-offset-4 dark:text-green-400">Edit target</button>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mx-4 mt-7 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200 sm:mx-0">
        <strong>Test Pass confirmation:</strong> submitting stores one no-payment Target entry against your verified account and unlocks one Rocket Classic Test Pass. Neither can be transferred or exchanged for cash.
      </div>

      <div className="mx-4 mb-6 mt-6 flex justify-end sm:mx-0 sm:mb-0">
        <button type="button" disabled={submitting} onClick={() => void onSubmit()} className="rounded-xl bg-[#0a3d2a] px-7 py-3.5 text-sm font-black text-white shadow-lg shadow-[#0a3d2a]/15 transition hover:bg-[#15543b] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? "Locking Target and pass…" : "Submit Target and unlock pass"}</button>
      </div>
    </section>
  );
}

function SubmittedStage({
  points,
  entryReference,
  submittedAt,
  rocketPass,
}: {
  points: Array<TargetPoint | null>;
  entryReference: string | null;
  submittedAt: string | null;
  rocketPass: TargetPilotStatusDto["rocketPass"] | null;
}) {
  return (
    <section className="overflow-hidden rounded-3xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
      <div className="bg-[#0a3d2a] px-6 py-9 text-center text-white sm:px-10">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#c8a951] text-[#0a3d2a] shadow-lg"><CheckCircleIcon className="h-9 w-9" /></span>
        <h2 className="mt-5 text-3xl font-black">Target locked. Test Pass ready.</h2>
        <p className="mt-2 text-sm text-white/70">Reference <span className="font-mono font-bold text-[#f0d986]">{entryReference}</span></p>
        {submittedAt ? <p className="mt-1 text-xs text-white/50">Saved {new Date(submittedAt).toLocaleString()}</p> : null}
      </div>
      <div className="p-6 sm:p-9">
        <div className="grid gap-4 sm:grid-cols-3">
          {TARGET_SCENARIOS.map((scenario, index) => (
            <div key={scenario.id} className="rounded-2xl bg-zinc-50 p-3 dark:bg-zinc-800/70">
              <CourseMap scenario={scenario} point={points[index]} compact />
              <p className="mt-3 text-center text-xs font-black uppercase tracking-wide text-zinc-500">Decision {index + 1} locked</p>
            </div>
          ))}
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-700">
            <div className="flex items-start gap-3">
              <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-[#9b7b25]" />
              <div>
                <h3 className="font-black text-zinc-900 dark:text-white">Your Target record</h3>
                <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">Your verified account, frozen scenario version, three coordinates, submission time and integrity hash. There is no checkout, live prize or payout.</p>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border-2 border-[#c8a951]/40 bg-[#eef5f0] p-5 dark:bg-green-950/25">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-[#9b7b25] dark:text-[#d7bc6a]">Account-bound Test Pass</p>
            <h3 className="mt-2 font-black text-[#0a3d2a] dark:text-green-300">
              {rocketPass?.status === "REDEEMED" ? "Rocket team confirmed" : "Rocket Classic entry unlocked"}
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-300">
              {rocketPass?.status === "REDEEMED"
                ? "Your pass has been used for one confirmed five-player beta team."
                : "Choose one golfer from each of five tiers, review the team and use this pass once before entries close."}
            </p>
            <Link
              href={
                rocketPass?.status === "REDEEMED" && rocketPass.teamId
                  ? `/tournaments/rocket-classic/teams/${rocketPass.teamId}`
                  : rocketPass?.enterHref ?? "/tournaments/rocket-classic/enter"
              }
              className="mt-4 inline-flex rounded-xl bg-[#0a3d2a] px-4 py-2.5 text-sm font-black text-white"
            >
              {rocketPass?.status === "REDEEMED" ? "View confirmed team →" : "Build my Rocket team →"}
            </Link>
          </div>
        </div>

        <p className="mt-7 text-center text-sm font-bold text-zinc-500 dark:text-zinc-400">One entry per verified tester. The coordinator may clear all entries only before the rehearsal set is sealed.</p>
      </div>
    </section>
  );
}
