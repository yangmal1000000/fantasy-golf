/** Tier metadata: colors, labels, descriptions, icons */
export const TIER_CONFIG: Record<
  string,
  {
    label: string;
    badgeClass: string;
    cardClass: string;
    description: string;
    icon: string;
    gradFrom: string;
    gradTo: string;
    short: string;
  }
> = {
  T1_10: {
    label: "Tier 1 · Ranks 1–10",
    badgeClass: "bg-amber-100 text-amber-800 border-amber-300",
    cardClass: "border-amber-300 bg-amber-50",
    description: "Elite — the top 10 in the world",
    icon: "crown",
    gradFrom: "#fbbf24",
    gradTo: "#b45309",
    short: "T1",
  },
  T11_20: {
    label: "Tier 2 · Ranks 11–20",
    badgeClass: "bg-blue-100 text-blue-800 border-blue-300",
    cardClass: "border-blue-300 bg-blue-50",
    description: "Strong contenders ranked 11–20",
    icon: "star",
    gradFrom: "#94a3b8",
    gradTo: "#1e3a5f",
    short: "T2",
  },
  T21_30: {
    label: "Tier 3 · Ranks 21–30",
    badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300",
    cardClass: "border-emerald-300 bg-emerald-50",
    description: "Proven talent ranked 21–30",
    icon: "shield",
    gradFrom: "#c2410c",
    gradTo: "#166534",
    short: "T3",
  },
  T31_50: {
    label: "Tier 4 · Ranks 31–50",
    badgeClass: "bg-purple-100 text-purple-800 border-purple-300",
    cardClass: "border-purple-300 bg-purple-50",
    description: "Dark horses ranked 31–50",
    icon: "diamond",
    gradFrom: "#7c3aed",
    gradTo: "#4c1d95",
    short: "T4",
  },
  T51_PLUS: {
    label: "Tier 5 · Ranks 51+",
    badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-300",
    cardClass: "border-zinc-300 bg-zinc-50",
    description: "Long shots ranked 51+. Hidden gems!",
    icon: "bolt",
    gradFrom: "#6b7280",
    gradTo: "#1f2937",
    short: "T5",
  },
};

export const TIER_ORDER = ["T1_10", "T11_20", "T21_30", "T31_50", "T51_PLUS"];

export function tierLabel(tier: string): string {
  return TIER_CONFIG[tier]?.label ?? tier;
}

export function tierBadgeClass(tier: string): string {
  return TIER_CONFIG[tier]?.badgeClass ?? "bg-zinc-100 text-zinc-700 border-zinc-300";
}

/** Format pence as pounds */
export function formatGBP(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/** Format date range for display */
export function formatDateRange(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" };
  const s = new Date(start).toLocaleDateString("en-GB", opts);
  const e = new Date(end).toLocaleDateString("en-GB", opts);
  return `${s} – ${e}`;
}

/** Status badge config for tournaments */
export const STATUS_CONFIG: Record<string, { label: string; badgeClass: string }> = {
  upcoming: { label: "Upcoming", badgeClass: "bg-zinc-100 text-zinc-700 border-zinc-300" },
  entries_open: { label: "Entries Open", badgeClass: "bg-green-100 text-green-800 border-green-300" },
  in_progress: { label: "In Progress", badgeClass: "bg-orange-100 text-orange-800 border-orange-300" },
  completed: { label: "Completed", badgeClass: "bg-blue-100 text-blue-800 border-blue-300" },
};

/** Course hero image mapping
 *  NOTE: only files that actually exist in /public/courses/ are mapped here.
 *  Any unknown tournament id falls back to `default.jpg` (which must exist).
 *  If you add new images to /public/courses/, add the mapping here too.
 */
export const COURSE_IMAGES: Record<string, string> = {
  // Men's
  "masters-2026": "/courses/augusta.jpg",
  "pga-championship-2026": "/courses/quail-hollow.jpg",
  "us-open-2026": "/courses/oakmont.jpg",
  "the-open-2026": "/courses/royal-birkdale.jpg",
  "players-2026": "/courses/tpc-sawgrass.jpg",
  "genesis-2026": "/courses/riviera.jpg",
  "arnold-palmer-2026": "/courses/bay-hill.jpg",
  "memorial-2026": "/courses/muirfield-village.jpg",
  "tour-championship-2026": "/courses/east-lake.jpg",
  "bmw-pga-2026": "/courses/wentworth.jpg",
  // Women's LPGA — specific course images not yet shipped; fall back to default.
};

export const CATEGORY_CONFIG: Record<string, { label: string; badgeClass: string; icon: string }> = {
  major: { label: "Major", badgeClass: "bg-amber-100 text-amber-800 border-amber-300", icon: "trophy" },
  signature: { label: "Signature", badgeClass: "bg-purple-100 text-purple-800 border-purple-300", icon: "star" },
  playoff: { label: "Playoff", badgeClass: "bg-blue-100 text-blue-800 border-blue-300", icon: "target" },
  dpwt: { label: "DP World Tour", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "globe" },
  lpga_major: { label: "LPGA Major", badgeClass: "bg-pink-100 text-pink-800 border-pink-300", icon: "star" },
  regular: { label: "Regular", badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-300", icon: "flag" },
};

export function courseImage(tournamentId: string): string {
  return COURSE_IMAGES[tournamentId] ?? "/courses/default.jpg";
}
