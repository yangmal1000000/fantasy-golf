"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type TimeParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
};

function getTimeParts(target: number, now: number): TimeParts {
  const total = Math.max(0, target - now);
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total % 86_400_000) / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1_000),
    total,
  };
}

function TimeUnit({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-[#c8a951]/25 bg-[#c8a951]/8 px-2 py-3 dark:bg-[#c8a951]/10">
      <span className="block text-xl font-black tabular-nums text-zinc-900 dark:text-white">
        {String(value).padStart(2, "0")}
      </span>
      <span className="mt-0.5 block text-[9px] font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
    </div>
  );
}

export default function RocketFieldOpeningCountdown({
  expectedAt,
  serverNow,
  milestone,
}: {
  expectedAt: string;
  serverNow: string;
  milestone: "provisional-drafting" | "final-confirmation";
}) {
  const router = useRouter();
  const target = new Date(expectedAt).getTime();
  const initialNow = new Date(serverNow).getTime();
  const [now, setNow] = useState(initialNow);
  const time = getTimeParts(target, now);
  const hasReachedExpectedTime = time.total === 0;
  const isProvisionalDrafting = milestone === "provisional-drafting";

  useEffect(() => {
    const tick = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(tick);
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const interval = window.setInterval(
      refresh,
      hasReachedExpectedTime ? 15_000 : 60_000,
    );
    return () => window.clearInterval(interval);
  }, [hasReachedExpectedTime, router]);

  if (Number.isNaN(target) || Number.isNaN(initialNow)) return null;

  const openingLabel = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(target));

  return (
    <section
      className="mx-auto mt-6 max-w-md rounded-2xl border border-[#c8a951]/35 bg-[#c8a951]/5 p-4"
      aria-label={
        isProvisionalDrafting
          ? "Rocket provisional drafting availability"
          : "Rocket final confirmation availability"
      }
    >
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#9b7b25] dark:text-[#d7bc6a]">
        {hasReachedExpectedTime
          ? isProvisionalDrafting
            ? "Official initial field update pending"
            : "Official final field update pending"
          : isProvisionalDrafting
            ? "Provisional draft expected in"
            : "Final confirmation expected in"}
      </p>
      {hasReachedExpectedTime ? (
        <p
          className="mt-3 text-lg font-black text-zinc-900 dark:text-white"
          role="status"
        >
          {isProvisionalDrafting
            ? "Waiting for the official PGA TOUR initial field"
            : "Waiting for the official PGA TOUR final field"}
        </p>
      ) : (
        <div className="mt-3 grid grid-cols-4 gap-2" aria-hidden="true">
          <TimeUnit value={time.days} label="Days" />
          <TimeUnit value={time.hours} label="Hours" />
          <TimeUnit value={time.minutes} label="Mins" />
          <TimeUnit value={time.seconds} label="Secs" />
        </div>
      )}
      <p className="mt-3 text-xs font-bold text-zinc-700 dark:text-zinc-200">
        Expected from {openingLabel}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
        {isProvisionalDrafting
          ? "Provisional drafting opens automatically once PGA TOUR/PGATOUR.COM publishes tonight’s official post-commitment field and our verification checks pass."
          : "Final confirmation opens automatically once the four Monday qualifiers and any withdrawals or alternates appear in the verified complete field."}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-zinc-500 dark:text-zinc-400">
        {isProvisionalDrafting
          ? "A PGA TOUR publishing or field-validation delay may move drafting later."
          : "Michigan PGA/Golf Genius must publish the qualifiers, then PGA TOUR/PGATOUR.COM must publish the authoritative event field. A playoff, withdrawal or publishing delay may move confirmation later."}
      </p>
      <p className="mt-1 text-[11px] font-semibold leading-5 text-zinc-600 dark:text-zinc-300">
        The clock is an estimate only and cannot open this stage by itself. This
        page checks the verified field automatically.
      </p>
    </section>
  );
}
