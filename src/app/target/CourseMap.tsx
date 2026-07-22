"use client";

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
        } ${compact ? "aspect-[16/9]" : "aspect-[16/10]"}`}
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
        <svg
          viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
          className="h-full w-full select-none"
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

          <rect width="1000" height="650" fill={`url(#${prefix}-rough)`} />
          <CourseArtwork kind={scenario.mapKind} prefix={prefix} />
          <rect width="1000" height="650" fill={`url(#${prefix}-grid)`} />

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
          <div className="pointer-events-none absolute left-3 top-3 rounded-full bg-[#071d14]/80 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-[#f4df9d] backdrop-blur">
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

function CourseArtwork({ kind, prefix }: { kind: TargetScenario["mapKind"]; prefix: string }) {
  if (kind === "approach") {
    return (
      <>
        <path d="M454 650 C448 520 410 418 398 312 C384 190 421 91 500 37 C579 91 616 190 602 312 C590 418 552 520 546 650Z" fill={`url(#${prefix}-fairway)`} />
        <ellipse cx="500" cy="140" rx="170" ry="105" fill="#b9d878" stroke="#d8ec9b" strokeWidth="8" />
        <path d="M290 232 C333 162 349 96 375 45 C318 28 247 48 206 96 C185 139 212 205 290 232Z" fill={`url(#${prefix}-water)`} stroke="#6bc1dc" strokeWidth="5" />
        <path d="M626 210 C692 191 742 220 762 266 C711 288 660 282 614 249Z" fill="#ead9a4" stroke="#fff0bd" strokeWidth="5" />
        <path d="M449 110 V55 H499" stroke="#fff" strokeWidth="6" />
        <path d="M499 55 L499 95 L557 75Z" fill="#d7554c" />
        <circle cx="500" cy="594" r="20" fill="#f5eee0" stroke="#d7c7a2" strokeWidth="5" />
        <text x="242" y="125" fill="#d8f3ff" fontSize="18" fontWeight="700">WATER</text>
        <text x="672" y="252" fill="#5a492b" fontSize="17" fontWeight="700">DEEP BUNKER</text>
        <text x="530" y="131" fill="#24351d" fontSize="17" fontWeight="800">PIN</text>
        <text x="520" y="620" fill="#fff" fontSize="17" fontWeight="700">181 YDS</text>
      </>
    );
  }

  if (kind === "layup") {
    return (
      <>
        <path d="M420 650 C411 545 302 478 330 369 C350 291 454 285 438 192 C425 118 449 61 500 20 C551 61 575 118 562 192 C546 285 650 291 670 369 C698 478 589 545 580 650Z" fill={`url(#${prefix}-fairway)`} />
        <ellipse cx="500" cy="68" rx="108" ry="55" fill="#b9d878" stroke="#d8ec9b" strokeWidth="7" />
        <path d="M90 242 C240 208 388 257 514 230 C672 197 780 217 930 185 L955 250 C785 280 656 251 523 284 C358 326 229 269 65 309Z" fill={`url(#${prefix}-water)`} stroke="#6bc1dc" strokeWidth="5" />
        <path d="M279 365 C228 328 201 285 204 235 C251 246 293 280 323 335Z" fill="#183c29" opacity=".82" />
        <path d="M715 391 C780 363 843 386 878 446 C821 474 756 469 704 427Z" fill="#214a33" />
        <circle cx="500" cy="603" r="21" fill="#f5eee0" stroke="#d7c7a2" strokeWidth="5" />
        <path d="M500 68 V24 M500 24 L556 42 L500 58Z" fill="#d7554c" stroke="#fff" strokeWidth="3" />
        <text x="115" y="278" fill="#d8f3ff" fontSize="18" fontWeight="800">CREEK · 73–87 YDS SHORT</text>
        <text x="236" y="386" fill="#e7f2e9" fontSize="17" fontWeight="700">NARROWS</text>
        <text x="730" y="435" fill="#e7f2e9" fontSize="17" fontWeight="700">BLOCKED ROUGH</text>
        <text x="522" y="626" fill="#fff" fontSize="17" fontWeight="700">286 YDS</text>
      </>
    );
  }

  if (kind === "practice") {
    return (
      <>
        <path d="M430 650 C420 520 360 430 382 315 C402 209 450 111 500 29 C550 111 598 209 618 315 C640 430 580 520 570 650Z" fill={`url(#${prefix}-fairway)`} />
        <ellipse cx="500" cy="84" rx="105" ry="60" fill="#b9d878" stroke="#d8ec9b" strokeWidth="7" />
        <ellipse cx="373" cy="234" rx="78" ry="36" fill="#ead9a4" stroke="#fff0bd" strokeWidth="5" />
        <ellipse cx="620" cy="342" rx="76" ry="38" fill="#ead9a4" stroke="#fff0bd" strokeWidth="5" />
        <circle cx="500" cy="600" r="20" fill="#f5eee0" stroke="#d7c7a2" strokeWidth="5" />
        <text x="520" y="625" fill="#fff" fontSize="17" fontWeight="700">PRACTICE TEE</text>
      </>
    );
  }

  return (
    <>
      <path d="M438 650 C425 557 340 492 348 391 C356 290 431 267 415 177 C401 100 449 54 500 17 C551 54 599 100 585 177 C569 267 644 290 652 391 C660 492 575 557 562 650Z" fill={`url(#${prefix}-fairway)`} />
      <ellipse cx="500" cy="69" rx="103" ry="52" fill="#b9d878" stroke="#d8ec9b" strokeWidth="7" />
      <path d="M164 429 C191 344 272 281 365 267 C385 337 366 411 315 468 C247 482 194 469 164 429Z" fill={`url(#${prefix}-water)`} stroke="#6bc1dc" strokeWidth="5" />
      <path d="M622 309 C682 282 744 301 782 356 C733 394 672 401 614 363Z" fill="#ead9a4" stroke="#fff0bd" strokeWidth="5" />
      <path d="M801 95 C833 225 817 375 850 544" fill="none" stroke="#ef6d61" strokeWidth="6" strokeDasharray="15 13" />
      <circle cx="500" cy="603" r="21" fill="#f5eee0" stroke="#d7c7a2" strokeWidth="5" />
      <path d="M500 69 V24 M500 24 L556 42 L500 58Z" fill="#d7554c" stroke="#fff" strokeWidth="3" />
      <text x="190" y="408" fill="#d8f3ff" fontSize="18" fontWeight="800">WATER</text>
      <text x="667" y="354" fill="#5a492b" fontSize="17" fontWeight="800">BUNKER</text>
      <text x="853" y="326" fill="#ffaaa2" fontSize="17" fontWeight="800" transform="rotate(8 853 326)">OUT OF BOUNDS</text>
      <text x="522" y="627" fill="#fff" fontSize="17" fontWeight="700">TEE</text>
    </>
  );
}
