"use client";

import Image from "next/image";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  TARGET_COORDINATE_MAX,
  type TargetPoint,
  type TargetScenario,
  moveTargetPoint,
  normaliseTargetPoint,
} from "@/lib/target-challenge";

interface CourseMapProps {
  scenario: TargetScenario;
  point: TargetPoint | null;
  onChange?: (point: TargetPoint) => void;
  compact?: boolean;
}

const VIEWBOX_WIDTH = 1_000;
const VIEWBOX_HEIGHT = 650;

const COURSE_IMAGES: Record<TargetScenario["mapKind"], string> = {
  practice: "/images/target-challenge/hawthorn-vale-tee.png",
  tee: "/images/target-challenge/hawthorn-vale-tee.png",
  approach: "/images/target-challenge/hawthorn-vale-approach.png",
  layup: "/images/target-challenge/hawthorn-vale-layup.png",
};

function pointToViewBox(point: TargetPoint) {
  return {
    x: (point.x / TARGET_COORDINATE_MAX) * VIEWBOX_WIDTH,
    y: (point.y / TARGET_COORDINATE_MAX) * VIEWBOX_HEIGHT,
  };
}

export default function CourseMap({ scenario, point, onChange, compact = false }: CourseMapProps) {
  const interactive = Boolean(onChange);

  function placePoint(event: PointerEvent<HTMLDivElement>) {
    if (!onChange) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    onChange(
      normaliseTargetPoint(
        (event.clientX - rect.left) / rect.width,
        (event.clientY - rect.top) / rect.height,
      ),
    );
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!onChange) return;
    const step = event.shiftKey ? 1_000 : 250;
    const origin = point ?? { x: 50_000, y: 50_000 };
    const deltas: Partial<Record<string, [number, number]>> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const delta = deltas[event.key];
    if (!delta) return;
    event.preventDefault();
    onChange(moveTargetPoint(origin, delta[0], delta[1]));
  }

  const marker = point ? pointToViewBox(point) : null;
  const prefix = `course-${scenario.mapKind}`;

  return (
    <div>
      <div
        className={`relative overflow-hidden rounded-2xl border border-white/10 bg-[#123c2b] shadow-inner ${
          interactive ? "cursor-crosshair touch-manipulation" : ""
        } aspect-[3/2]`}
        onPointerDown={placePoint}
        onKeyDown={handleKeyDown}
        role={interactive ? "application" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-label={
          interactive
            ? `${scenario.title} course map. Tap or click to place a target. Use arrow keys for fine adjustment.`
            : `${scenario.title} submitted target map`
        }
      >
        <Image
          src={COURSE_IMAGES[scenario.mapKind]}
          alt=""
          fill
          priority={scenario.mapKind === "practice"}
          sizes={compact ? "(max-width: 768px) 100vw, 420px" : "(max-width: 1024px) 100vw, 900px"}
          className="pointer-events-none select-none object-cover"
          draggable={false}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#061b13]/20 via-transparent to-[#061b13]/10" />
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          className="relative z-10 h-full w-full select-none"
          aria-hidden="true"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id={`${prefix}-rough`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1d5b3a" />
              <stop offset="1" stopColor="#0f432d" />
            </linearGradient>
            <linearGradient id={`${prefix}-fairway`} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0" stopColor="#79a84f" />
              <stop offset="1" stopColor="#a6c96b" />
            </linearGradient>
            <linearGradient id={`${prefix}-water`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#2d85a8" />
              <stop offset="1" stopColor="#155575" />
            </linearGradient>
            <pattern id={`${prefix}-grid`} width="100" height="65" patternUnits="userSpaceOnUse">
              <path d="M 100 0 L 0 0 0 65" fill="none" stroke="rgba(255,255,255,.08)" strokeWidth="1" />
            </pattern>
            <filter id={`${prefix}-shadow`} x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="4" stdDeviation="5" floodColor="#071d14" floodOpacity=".55" />
            </filter>
          </defs>

          <g transform="translate(825 50)">
            <rect x="-18" y="-22" width="150" height="62" rx="18" fill="rgba(8,28,20,.78)" />
            <path d="M10 12 H92 M78 -2 L96 12 L78 26" fill="none" stroke="#f4df9d" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
            <text x="48" y="-3" textAnchor="middle" fill="#fff6d9" fontSize="17" fontWeight="700">WIND</text>
          </g>

          {marker ? (
            <g transform={`translate(${marker.x} ${marker.y})`} filter={`url(#${prefix}-shadow)`}>
              <path d="M0 26 C-20 2 -29 -11 -29 -29 A29 29 0 1 1 29 -29 C29 -11 20 2 0 26Z" fill="#d8b85c" stroke="#fff7dd" strokeWidth="6" />
              <circle cy="-29" r="10" fill="#0a3d2a" />
              <path d="M-38 33 H38 M0 21 V42" stroke="#fff7dd" strokeWidth="4" strokeLinecap="round" opacity=".85" />
            </g>
          ) : interactive ? (
            <g transform="translate(500 325)" opacity=".9">
              <circle r="54" fill="rgba(7,29,20,.72)" stroke="#f4df9d" strokeWidth="3" strokeDasharray="9 9" />
              <path d="M-22 0 H22 M0 -22 V22" stroke="#f4df9d" strokeWidth="4" strokeLinecap="round" />
              <text y="82" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="700">PLACE YOUR TARGET</text>
            </g>
          ) : null}
        </svg>

        {interactive && (
          <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-[#071d14]/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#f4df9d] backdrop-blur">
            Tap anywhere to place
          </div>
        )}
      </div>

      {interactive && point && onChange && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Fine tune with the arrows or your keyboard. Hold Shift for larger steps.
          </p>
          <div className="grid grid-cols-3 gap-1" aria-label="Fine target adjustment">
            <span />
            <NudgeButton label="Move target up" glyph="↑" onClick={() => onChange(moveTargetPoint(point, 0, -250))} />
            <span />
            <NudgeButton label="Move target left" glyph="←" onClick={() => onChange(moveTargetPoint(point, -250, 0))} />
            <NudgeButton label="Reset target" glyph="×" onClick={() => onChange({ x: 50_000, y: 50_000 })} />
            <NudgeButton label="Move target right" glyph="→" onClick={() => onChange(moveTargetPoint(point, 250, 0))} />
            <span />
            <NudgeButton label="Move target down" glyph="↓" onClick={() => onChange(moveTargetPoint(point, 0, 250))} />
            <span />
          </div>
        </div>
      )}
    </div>
  );
}
function NudgeButton({ label, glyph, onClick }: { label: string; glyph: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-lg font-bold text-[#0a3d2a] shadow-sm transition hover:border-[#c8a951] hover:bg-[#fffaf0] dark:border-zinc-700 dark:bg-zinc-900 dark:text-green-400 dark:hover:border-[#c8a951]"
    >
      {glyph}
    </button>
  );
}
