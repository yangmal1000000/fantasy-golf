"use client";

/**
 * SelectionWheel — Circular SVG progress indicator for team selection.
 * Shows X/5 tiers filled. Pulses gold when all 5 selected.
 * Designed to be sticky on mobile.
 */

import { TEAM_ENTRY_TIERS } from "@/lib/team-entry-validation";

interface SelectionWheelProps {
  selectedCount: number;
}

export default function SelectionWheel({ selectedCount }: SelectionWheelProps) {
  const size = 64;
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = selectedCount / TEAM_ENTRY_TIERS.length;
  const offset = circumference - progress * circumference;
  const complete = selectedCount === TEAM_ENTRY_TIERS.length;

  return (
    <div
      className={`relative inline-flex items-center justify-center ${
        complete ? "animate-wheel-pulse" : ""
      }`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#e2e8f0"
          strokeWidth={stroke}
          className="dark:stroke-zinc-700"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={complete ? "#c8a951" : "#0a3d2a"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.3s ease" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className={`text-sm font-extrabold ${
            complete
              ? "text-[#c8a951]"
              : "text-[#0a3d2a] dark:text-zinc-200"
          }`}
        >
          {selectedCount}/5
        </span>
      </div>
    </div>
  );
}
