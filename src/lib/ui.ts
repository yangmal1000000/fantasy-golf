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
  UNRANKED: {
    label: "Unranked",
    badgeClass: "bg-zinc-50 text-zinc-400 border-zinc-200",
    cardClass: "border-zinc-200 bg-zinc-50",
    description: "Not in OWGR rankings",
    icon: "question",
    gradFrom: "#d4d4d8",
    gradTo: "#a1a1aa",
    short: "?",
  },
};

export const TIER_ORDER = ["T1_10", "T11_20", "T21_30", "T31_50", "T51_PLUS", "UNRANKED"];

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
  // Men's — by slug ID
  "masters": "/courses/augusta.jpg",
  "pga-championship": "/courses/quail-hollow.jpg",
  "us-open": "/courses/oakmont.jpg",
  "the-open": "/courses/royal-birkdale.jpg",
  "players-championship": "/courses/tpc-sawgrass.jpg",
  "genesis-invitational": "/courses/riviera.jpg",
  "arnold-palmer": "/courses/bay-hill.jpg",
  "memorial-tournament": "/courses/muirfield-village.jpg",
  "tour-championship": "/courses/east-lake.jpg",
  "bmw-pga": "/courses/wentworth.jpg",
};

/** Keyword → image mapping for course-name-based matching */
const COURSE_KEYWORD_IMAGES: { keywords: string[]; image: string }[] = [
  { keywords: ["augusta", "masters"], image: "/courses/augusta.jpg" },
  { keywords: ["bay hill", "bay-hill", "arnold palmer"], image: "/courses/bay-hill.jpg" },
  { keywords: ["east lake", "east-lake", "tour championship", "fedex"], image: "/courses/east-lake.jpg" },
  { keywords: ["muirfield", "memorial"], image: "/courses/muirfield-village.jpg" },
  { keywords: ["oakmont", "u.s. open", "us open", "erin hills"], image: "/courses/oakmont.jpg" },
  { keywords: ["quail hollow", "quail-hollow", "wells fargo", "pga championship"], image: "/courses/quail-hollow.jpg" },
  { keywords: ["riviera", "genesis", "tiger"], image: "/courses/riviera.jpg" },
  { keywords: ["royal birkdale", "royal-birkdale", "birkdale", "st andrews", "st. andrews", "old course", "links", "renaissance", "harbour town", "aberdeen", "royal montreal", "aig women", "scottish open", "port royal", "bermuda"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["tpc sawgrass", "sawgrass", "players championship"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["tpc scottsdale", "phoenix", "wm phoenix"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["tpc deere", "john deere"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["tpc craig", "byron nelson", "cj cup"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["tpc san antonio", "texas open", "valero"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["tpc southwind", "fedex", "st. jude", "st jude"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["tpc twin", "3m open"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["tpc louisiana", "zurich"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["tpc river", "travelers"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["innisbrook", "valspar"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["colonial", "charles schwab", "schwab"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["harbour town", "rbc heritage"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["southwind", "jude"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["wentworth", "bmw pga", "dp world"], image: "/courses/wentworth.jpg" },
  { keywords: ["detroit", "rocket mortgage", "rocket classic"], image: "/courses/bay-hill.jpg" },
  { keywords: ["pebble beach", "at&t", "pro-am"], image: "/courses/oakmont.jpg" },
  { keywords: ["kapalua", "sentry", "plantation"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["torrey pines", "farmers"], image: "/courses/oakmont.jpg" },
  { keywords: ["vidanta", "mexico open"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["evian", "amundi"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["baltusrol", "kpmg"], image: "/courses/oakmont.jpg" },
  { keywords: ["carlton woods", "chevron"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["doral", "cadillac"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["sea island", "rsm"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["albany", "hero world"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["diamante", "world wide technology", "wwt"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["corales", "puntacana", "dominican"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["greenbrier"], image: "/courses/bay-hill.jpg" },
  { keywords: ["hamilton", "rbc canadian", "canadian open"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["keene trace", "isco"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["philadelphia cricket", "truist"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["dunes", "myrtle beach"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["grand reserve", "puerto rico"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["memorial park", "houston"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["castle pines", "bmw championship"], image: "/courses/east-lake.jpg" },
  { keywords: ["ogden", "bank of utah"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["sequoia", "baycurrent"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["biltmore forest", "biltmore"], image: "/courses/bay-hill.jpg" },
  { keywords: ["waialae", "sony"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["pga west", "american express", "amex"], image: "/courses/tpc-sawgrass.jpg" },
  { keywords: ["pga national", "cognizant", "honda"], image: "/courses/bay-hill.jpg" },
  { keywords: ["vidantaworld", "vidanta"], image: "/courses/royal-birkdale.jpg" },
  { keywords: ["sahalee"], image: "/courses/tpc-sawgrass.jpg" },
];

export const MAJOR_THEMES: Record<string, {
  name: string;
  headerBg: string;       // gradient classes for header banner
  headerText: string;
  accentColor: string;    // hex for badges, borders
  badgeClass: string;
  winnerCardClass: string;
  cutLineClass: string;
}> = {
  "masters": {
    name: "The Masters",
    headerBg: "from-[#006747] via-[#00854a] to-[#00a35c]",
    headerText: "text-[#f5c518]",
    accentColor: "#f5c518",
    badgeClass: "bg-[#f5c518]/20 text-[#f5c518] border-[#f5c518]/40",
    winnerCardClass: "border-[#f5c518]/40 bg-gradient-to-br from-[#f5c518]/10 to-transparent",
    cutLineClass: "text-[#f5c518]",
  },
  "pga-championship": {
    name: "PGA Championship",
    headerBg: "from-[#1a3a6b] via-[#2a5298] to-[#3a6db8]",
    headerText: "text-[#d4a843]",
    accentColor: "#d4a843",
    badgeClass: "bg-[#d4a843]/20 text-[#d4a843] border-[#d4a843]/40",
    winnerCardClass: "border-[#d4a843]/40 bg-gradient-to-br from-[#d4a843]/10 to-transparent",
    cutLineClass: "text-[#d4a843]",
  },
  "us-open": {
    name: "U.S. Open",
    headerBg: "from-[#1a2540] via-[#2a3555] to-[#3a4565]",
    headerText: "text-[#c0c5ce]",
    accentColor: "#9ca3af",
    badgeClass: "bg-white/10 text-[#c0c5ce] border-white/20",
    winnerCardClass: "border-[#9ca3af]/40 bg-gradient-to-br from-white/5 to-transparent",
    cutLineClass: "text-[#9ca3af]",
  },
  "the-open": {
    name: "The Open Championship",
    headerBg: "from-[#7c1a1a] via-[#9c2a2a] to-[#bc3a3a]",
    headerText: "text-[#d4a843]",
    accentColor: "#d4a843",
    badgeClass: "bg-[#d4a843]/20 text-[#d4a843] border-[#d4a843]/40",
    winnerCardClass: "border-[#d4a843]/40 bg-gradient-to-br from-[#7c1a1a]/10 to-transparent",
    cutLineClass: "text-[#d4a843]",
  },
};

export function majorTheme(tournamentId: string) {
  return MAJOR_THEMES[tournamentId] ?? null;
}

export function courseImage(tournamentId: string, courseName?: string | null): string {
  // 1. Explicit ID match
  if (COURSE_IMAGES[tournamentId]) return COURSE_IMAGES[tournamentId];

  // 2. Course name keyword match
  if (courseName) {
    const lower = courseName.toLowerCase();
    for (const entry of COURSE_KEYWORD_IMAGES) {
      if (entry.keywords.some((kw) => lower.includes(kw))) return entry.image;
    }
  }

  // 3. Fallback
  return "/courses/default.jpg";
}

export const CATEGORY_CONFIG: Record<string, { label: string; badgeClass: string; icon: string }> = {
  major: { label: "Major", badgeClass: "bg-amber-100 text-amber-800 border-amber-300", icon: "trophy" },
  signature: { label: "Signature", badgeClass: "bg-purple-100 text-purple-800 border-purple-300", icon: "star" },
  playoff: { label: "Playoff", badgeClass: "bg-blue-100 text-blue-800 border-blue-300", icon: "target" },
  dpwt: { label: "DP World Tour", badgeClass: "bg-emerald-100 text-emerald-800 border-emerald-300", icon: "globe" },
  lpga_major: { label: "LPGA Major", badgeClass: "bg-pink-100 text-pink-800 border-pink-300", icon: "star" },
  regular: { label: "Regular", badgeClass: "bg-zinc-100 text-zinc-600 border-zinc-300", icon: "flag" },
};


