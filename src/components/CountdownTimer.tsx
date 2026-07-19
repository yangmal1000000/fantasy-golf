"use client";

/**
 * CountdownTimer — Ticking countdown to tournament start.
 * Shows "Entries close in Xd Xh Xm Xs".
 * Turns red when < 24h. Turns off when started.
 */

import { useEffect, useState } from "react";

interface CountdownTimerProps {
  startDate: Date | string;
  label?: string;
}

interface TimeParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
}

function getTimeParts(target: number): TimeParts {
  const now = Date.now();
  const diff = target - now;
  if (diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, total: 0 };
  }
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    minutes: Math.floor((diff % 3600000) / 60000),
    seconds: Math.floor((diff % 60000) / 1000),
    total: diff,
  };
}

export default function CountdownTimer({
  startDate,
  label = "Entries close in",
}: CountdownTimerProps) {
  const target = new Date(startDate).getTime();
  const [time, setTime] = useState<TimeParts>(() => getTimeParts(target));

  useEffect(() => {
    const interval = setInterval(() => {
      setTime(getTimeParts(target));
    }, 1000);
    return () => clearInterval(interval);
  }, [target]);

  // Tournament has started
  if (time.total <= 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 dark:text-orange-400">
        <span className="inline-block h-2 w-2 animate-pulse-live rounded-full bg-red-500" />
        Started
      </span>
    );
  }

  const urgent = time.total < 86400000; // < 24h

  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${
        urgent
          ? "text-red-600 dark:text-red-400"
          : "text-[#0a3d2a] dark:text-green-400"
      }`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-3.5 w-3.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      {label}{" "}
      {time.days > 0 && `${time.days}d `}
      {time.hours}h {time.minutes}m {time.seconds}s
    </span>
  );
}
