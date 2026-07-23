"use client";

import Image from "next/image";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  APPROACH_FLAG_GROUND_VIEWBOX,
  TARGET_COORDINATE_MAX,
  TARGET_MAP_HEIGHT,
  TARGET_MAP_WIDTH,
  type TargetPoint,
  type TargetScenario,
  moveTargetPoint,
  normaliseTargetPoint,
} from "@/lib/target-challenge";
import { estimateTargetFinishYards } from "@/lib/target-v2";

interface CourseMapProps {
  scenario: TargetScenario;
  point: TargetPoint | null;
  onChange?: (point: TargetPoint | null) => void;
  compact?: boolean;
  edgeToEdgeOnMobile?: boolean;
  referencePoints?: Array<{
    point: TargetPoint;
    label: string;
    color: string;
  }>;
}

const COURSE_IMAGES: Record<TargetScenario["mapKind"], string> = {
  practice: "/images/target-challenge/hawthorn-vale-tee.png",
  tee: "/images/target-challenge/hawthorn-vale-tee.png",
  approach: "/images/target-challenge/hawthorn-vale-approach.png",
  layup: "/images/target-challenge/hawthorn-vale-layup.png",
};

const BALL_POSITIONS: Partial<Record<TargetScenario["mapKind"], TargetPoint>> = {
  tee: { x: 48_000, y: 93_000 },
  approach: { x: 49_000, y: 93_000 },
  layup: { x: 47_000, y: 94_000 },
};

function pointToViewBox(point: TargetPoint) {
  return {
    x: (point.x / TARGET_COORDINATE_MAX) * TARGET_MAP_WIDTH,
    y: (point.y / TARGET_COORDINATE_MAX) * TARGET_MAP_HEIGHT,
  };
}

export default function CourseMap({
  scenario,
  point,
  onChange,
  compact = false,
  edgeToEdgeOnMobile = false,
  referencePoints = [],
}: CourseMapProps) {
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
  const ballPoint = scenario.ballPoint ?? BALL_POSITIONS[scenario.mapKind];
  const ballMarker = ballPoint ? pointToViewBox(ballPoint) : null;
  const finishYards = estimateTargetFinishYards(scenario, point);
  const prefix = `course-${scenario.mapKind}`;

  return (
    <div>
      <div
        className={`relative overflow-hidden border border-white/10 bg-[#123c2b] shadow-inner ${
          interactive ? "cursor-crosshair touch-manipulation" : ""
        } ${
          edgeToEdgeOnMobile
            ? "rounded-none border-x-0 sm:rounded-2xl sm:border-x"
            : "rounded-2xl"
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
          viewBox={`0 0 ${TARGET_MAP_WIDTH} ${TARGET_MAP_HEIGHT}`}
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
            <rect x="-18" y="-22" width="150" height="90" rx="18" fill="rgba(8,28,20,.78)" />
            <path
              d="M18 34 H82 M68 22 L86 34 L68 46"
              fill="none"
              stroke="#f4df9d"
              strokeWidth="7"
              strokeLinecap="round"
              strokeLinejoin="round"
              transform={`rotate(${scenario.windArrowDegrees} 52 34)`}
            />
            <text x="48" y="1" textAnchor="middle" fill="#fff6d9" fontSize="20" fontWeight="700">
              {scenario.windLabel}
            </text>
          </g>

          <CourseGuides scenario={scenario} ballPoint={ballPoint} />

          {marker && ballMarker && finishYards !== null ? (
            <g pointerEvents="none">
              <path
                d={`M${ballMarker.x} ${ballMarker.y} L${marker.x} ${marker.y}`}
                fill="none"
                stroke="#fff7dd"
                strokeWidth="4"
                strokeDasharray="10 9"
                opacity=".9"
              />
              <g transform={`translate(${Math.max(72, Math.min(928, (ballMarker.x + marker.x) / 2))} ${Math.max(38, Math.min(612, (ballMarker.y + marker.y) / 2))})`}>
                <rect x="-66" y="-21" width="132" height="42" rx="21" fill="rgba(7,29,20,.9)" stroke="#f4df9d" strokeWidth="2" />
                <text y="7" textAnchor="middle" fill="#fff6d9" fontSize="20" fontWeight="900">
                  ≈ {finishYards} YDS
                </text>
              </g>
            </g>
          ) : null}

          {referencePoints.map((reference) => {
            const position = pointToViewBox(reference.point);
            return (
              <g
                key={`${reference.label}-${reference.point.x}-${reference.point.y}`}
                transform={`translate(${position.x} ${position.y})`}
                filter={`url(#${prefix}-shadow)`}
              >
                <circle r="22" fill={reference.color} stroke="#fff" strokeWidth="5" />
                <text
                  y="7"
                  textAnchor="middle"
                  fill="#fff"
                  fontSize="20"
                  fontWeight="900"
                >
                  {reference.label}
                </text>
              </g>
            );
          })}

          {marker ? (
            <g transform={`translate(${marker.x} ${marker.y})`} filter={`url(#${prefix}-shadow)`}>
              <path d="M0 26 C-20 2 -29 -11 -29 -29 A29 29 0 1 1 29 -29 C29 -11 20 2 0 26Z" fill="#d8b85c" stroke="#fff7dd" strokeWidth="6" />
              <circle cy="-29" r="10" fill="#0a3d2a" />
              <path d="M-38 33 H38 M0 21 V42" stroke="#fff7dd" strokeWidth="4" strokeLinecap="round" opacity=".85" />
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
        <div
          className={`mt-3 flex flex-wrap items-center justify-between gap-3 ${
            edgeToEdgeOnMobile ? "px-4 sm:px-0" : ""
          }`}
        >
          <div>
            {finishYards !== null ? (
              <p className="text-sm font-black text-[#0a3d2a] dark:text-green-300" aria-live="polite">
                Approx. finishing distance: {finishYards} yards
              </p>
            ) : null}
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
              Fine tune with the arrows or your keyboard. Hold Shift for larger steps.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-1" aria-label="Fine target adjustment">
            <span />
            <NudgeButton label="Move target up" glyph="↑" onClick={() => onChange(moveTargetPoint(point, 0, -250))} />
            <span />
            <NudgeButton label="Move target left" glyph="←" onClick={() => onChange(moveTargetPoint(point, -250, 0))} />
            <NudgeButton label="Clear target" glyph="×" onClick={() => onChange(null)} />
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

function CourseGuides({
  scenario,
  ballPoint,
}: {
  scenario: TargetScenario;
  ballPoint: TargetPoint | undefined;
}) {
  const ball = ballPoint;
  const ballPosition = ball ? pointToViewBox(ball) : null;

  return (
    <g pointerEvents="none">
      {scenario.yardage?.guides.map((guide) => (
        <g key={`${scenario.id}-${guide.yards}`}>
          <path
            d={guide.path}
            fill="none"
            stroke="#f4df9d"
            strokeWidth="3"
            strokeDasharray="9 9"
            opacity=".78"
          />
          <rect
            x={guide.labelX - 30}
            y={guide.labelY - 17}
            width="60"
            height="32"
            rx="16"
            fill="rgba(7,29,20,.84)"
          />
          <text
            x={guide.labelX}
            y={guide.labelY + 6}
            textAnchor="middle"
            fill="#fff6d9"
            fontSize="17"
            fontWeight="900"
          >
            {guide.yards}
          </text>
        </g>
      ))}

      {ballPosition ? (
        <g transform={`translate(${ballPosition.x} ${ballPosition.y})`}>
          <circle r="14" fill="#ffffff" stroke="#071d14" strokeWidth="5" />
          <path d="M0 -18 V-58" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
          <rect x="-55" y="-95" width="110" height="34" rx="17" fill="rgba(7,29,20,.86)" />
          <text y="-71" textAnchor="middle" fill="#fff" fontSize="19" fontWeight="800">YOUR BALL</text>
        </g>
      ) : null}

      {scenario.mapKind === "approach" ? (
        <g>
          <g transform={`translate(${APPROACH_FLAG_GROUND_VIEWBOX.x} ${APPROACH_FLAG_GROUND_VIEWBOX.y})`}>
            <path d="M0 0 V-70" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
            <path d="M3 -69 L56 -53 L3 -35Z" fill="#d8b85c" stroke="#fff7dd" strokeWidth="3" />
            <circle r="10" fill="none" stroke="#fff" strokeWidth="4" />
          </g>
          <rect
            x={scenario.pinSheetLabel ? 300 : 340}
            y="82"
            width={scenario.pinSheetLabel ? 280 : 200}
            height="40"
            rx="20"
            fill="rgba(7,29,20,.84)"
          />
          <text x="440" y="109" textAnchor="middle" fill="#fff" fontSize={scenario.pinSheetLabel ? 18 : 21} fontWeight="800">
            {scenario.pinSheetLabel ?? "FRONT-LEFT PIN"}
          </text>
        </g>
      ) : null}

      {scenario.mapKind === "layup" && !scenario.yardage ? (
        <g>
          <path
            d="M-15 293 C165 298 288 324 420 365 C595 419 760 484 1015 594"
            fill="none"
            stroke="#fff7dd"
            strokeWidth="5"
            strokeDasharray="13 10"
            opacity=".9"
          />
          <rect x="170" y="309" width="244" height="40" rx="20" fill="rgba(7,29,20,.86)" />
          <text x="292" y="336" textAnchor="middle" fill="#fff" fontSize="19" fontWeight="800">CREEK · 137 YD CENTRE</text>

          <g transform="translate(487 78)">
            <path d="M0 34 V-20" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
            <path d="M3 -19 L42 -7 L3 7Z" fill="#d8b85c" stroke="#fff7dd" strokeWidth="3" />
          </g>

          <path d="M273 263 Q470 211 677 263" fill="none" stroke="#f4df9d" strokeWidth="4" strokeDasharray="9 9" opacity=".9" />
          <rect x="485" y="218" width="182" height="40" rx="20" fill="rgba(7,29,20,.86)" />
          <text x="576" y="245" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="800">174 YD CARRY ARC</text>
          <rect x="475" y="109" width="207" height="40" rx="20" fill="rgba(7,29,20,.86)" />
          <text x="579" y="136" textAnchor="middle" fill="#fff" fontSize="20" fontWeight="800">≈102 YDS REMAINING</text>
        </g>
      ) : null}

      {scenario.mapKind === "layup" && scenario.yardage ? (
        <g>
          <path
            d="M-15 293 C165 298 288 324 420 365 C595 419 760 484 1015 594"
            fill="none"
            stroke="#fff7dd"
            strokeWidth="5"
            strokeDasharray="13 10"
            opacity=".9"
          />
          <rect x="170" y="309" width="244" height="40" rx="20" fill="rgba(7,29,20,.86)" />
          <text x="292" y="336" textAnchor="middle" fill="#fff" fontSize="19" fontWeight="800">CREEK · 137 YD CENTRE</text>
          <g transform="translate(487 78)">
            <path d="M0 34 V-20" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
            <path d="M3 -19 L42 -7 L3 7Z" fill="#d8b85c" stroke="#fff7dd" strokeWidth="3" />
          </g>
        </g>
      ) : null}
    </g>
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
