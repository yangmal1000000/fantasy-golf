/**
 * PlayerAvatar — Deterministic avatar from player initials.
 * Background colour derived from country flag colours or name hash.
 *
 * Sizes: sm (28px), md (48px)
 */

const COUNTRY_COLORS: Record<string, [string, string]> = {
  USA: ["#1e3a8a", "#dc2626"],
  ENG: ["#1e40af", "#ffffff"],
  SCO: ["#1e40af", "#ffffff"],
  WAL: ["#166534", "#dc2626"],
  NIR: ["#1e40af", "#ffffff"],
  IRE: ["#166534", "#f97316"],
  ESP: ["#dc2626", "#fbbf24"],
  AUS: ["#1e3a8a", "#dc2626"],
  RSA: ["#1e3a8a", "#fbbf24"],
  JPN: ["#dc2626", "#ffffff"],
  KOR: ["#1e40af", "#dc2626"],
  CAN: ["#dc2626", "#ffffff"],
  ARG: ["#3b82f6", "#ffffff"],
  SWE: ["#1e40af", "#fbbf24"],
  NOR: ["#dc2626", "#1e3a8a"],
  FIN: ["#ffffff", "#1e3a8a"],
  DEN: ["#dc2626", "#ffffff"],
  FRA: ["#1e40af", "#dc2626"],
  GER: ["#1a1a1a", "#dc2626"],
  ITA: ["#166534", "#ffffff"],
  NED: ["#dc2626", "#f97316"],
  BEL: ["#fbbf24", "#1a1a1a"],
  AUT: ["#dc2626", "#ffffff"],
  SUI: ["#dc2626", "#ffffff"],
  CZE: ["#1e40af", "#dc2626"],
  POL: ["#ffffff", "#dc2626"],
  AUS_ETH: ["#fbbf24", "#166534"],
};

function hashString(s: string): number {
  let hash = 0;
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface PlayerAvatarProps {
  name: string;
  country?: string | null;
  size?: "sm" | "md";
}

export default function PlayerAvatar({
  name,
  country,
  size = "sm",
}: PlayerAvatarProps) {
  const initials = getInitials(name);
  const dim = size === "sm" ? 28 : 48;
  const fontSize = size === "sm" ? 11 : 18;

  let colors: [string, string];
  if (country && COUNTRY_COLORS[country.toUpperCase()]) {
    colors = COUNTRY_COLORS[country.toUpperCase()];
  } else {
    const hash = hashString(name);
    const palette: [string, string][] = [
      ["#0a3d2a", "#0a3d2a"],
      ["#1e3a8a", "#1e40af"],
      ["#7c3aed", "#4c1d95"],
      ["#b45309", "#92400e"],
      ["#be185d", "#831843"],
      ["#0e7490", "#155e75"],
    ];
    colors = palette[hash % palette.length];
  }

  const gradId = `avatar-grad-${hashString(name)}`;

  return (
    <svg
      width={dim}
      height={dim}
      viewBox="0 0 40 40"
      fill="none"
      className="shrink-0"
      style={{ borderRadius: "50%" }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="40" y2="40">
          <stop offset="0%" stopColor={colors[0]} />
          <stop offset="100%" stopColor={colors[1]} />
        </linearGradient>
      </defs>
      <circle cx="20" cy="20" r="20" fill={`url(#${gradId})`} />
      {/* Simple silhouette suggestion — small arc at bottom */}
      <ellipse cx="20" cy="33" rx="12" ry="8" fill="rgba(255,255,255,0.08)" />
      <text
        x="20"
        y="20"
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize={fontSize}
        fontWeight="700"
        fontFamily="system-ui, sans-serif"
      >
        {initials}
      </text>
    </svg>
  );
}
