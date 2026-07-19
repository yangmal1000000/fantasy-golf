/**
 * TierBadge — Shield/medal-style badge for player tiers.
 * Renders an SVG shield with tier-specific gradient and icon.
 *
 * Sizes:
 *   sm  — 18×20px shield, inline (leaderboards, tables)
 *   md  — 24×28px shield (cards, detail rows)
 *   lg  — 32×36px shield + full label (headers, hero sections)
 */

const TIER_META: Record<
  string,
  {
    short: string;
    icon: string;
    gradFrom: string;
    gradTo: string;
    label: string;
  }
> = {
  T1_10: {
    short: "T1",
    icon: "M5 16L3 8l5.5 4L12 4l3.5 8L21 8l-2 8H5zm0 2h14v2H5v-2z",
    gradFrom: "#fbbf24",
    gradTo: "#b45309",
    label: "Tier 1 · Ranks 1–10",
  },
  T11_20: {
    short: "T2",
    icon: "M12 2l3 6.5 7 .9-5 4.8 1.3 7L12 18l-6.3 3.2L7 14.2 2 9.4l7-.9L12 2z",
    gradFrom: "#94a3b8",
    gradTo: "#1e3a5f",
    label: "Tier 2 · Ranks 11–20",
  },
  T21_30: {
    short: "T3",
    icon: "M12 2L4 7v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V7l-8-5z",
    gradFrom: "#c2410c",
    gradTo: "#166534",
    label: "Tier 3 · Ranks 21–30",
  },
  T31_50: {
    short: "T4",
    icon: "M6 3h12l3 6-9 12L3 9l3-6zm1.5 1.5L5.5 8.5h13L17 4.5H7.5z",
    gradFrom: "#7c3aed",
    gradTo: "#4c1d95",
    label: "Tier 4 · Ranks 31–50",
  },
  T51_PLUS: {
    short: "T5",
    icon: "M13 2L4 14h6l-2 8 9-12h-6l2-8z",
    gradFrom: "#6b7280",
    gradTo: "#1f2937",
    label: "Tier 5 · Ranks 51+",
  },
};

interface TierBadgeProps {
  tier: string;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export default function TierBadge({
  tier,
  size = "sm",
  showLabel = false,
}: TierBadgeProps) {
  const meta = TIER_META[tier];
  if (!meta) return null;

  const dims = {
    sm: { w: 18, h: 21, font: 8, iconScale: 0.4 },
    md: { w: 24, h: 28, font: 10, iconScale: 0.5 },
    lg: { w: 32, h: 37, font: 12, iconScale: 0.6 },
  }[size];

  const gradId = `tier-grad-${tier}`;

  return (
    <span className="inline-flex items-center gap-1.5 align-middle">
      <svg
        width={dims.w}
        height={dims.h}
        viewBox="0 0 24 28"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,0.25))" }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="28" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor={meta.gradFrom} />
            <stop offset="100%" stopColor={meta.gradTo} />
          </linearGradient>
        </defs>
        {/* Shield path */}
        <path
          d="M12 1 L22 4 V14 C22 21 17 26 12 27 C7 26 2 21 2 14 V4 Z"
          fill={`url(#${gradId})`}
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="0.5"
        />
        {/* Icon */}
        <g transform={`translate(12 12) scale(${dims.iconScale}) translate(-12 -12)`}>
          <path d={meta.icon} fill="rgba(255,255,255,0.55)" />
        </g>
        {/* Short label */}
        <text
          x="12"
          y={size === "lg" ? 24 : size === "md" ? 23 : 22}
          textAnchor="middle"
          fill="white"
          fontSize={dims.font}
          fontWeight="800"
          fontFamily="system-ui, sans-serif"
        >
          {meta.short}
        </text>
      </svg>
      {showLabel && (
        <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          {meta.label}
        </span>
      )}
    </span>
  );
}
