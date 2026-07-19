/**
 * Tournament Templates
 * --------------------
 * Recurring tournament definitions used by the season generator to scaffold
 * a full year of events. Each template contains enough information to create
 * a Tournament record plus its player links.
 *
 * The `slug` and `name` fields accept `{year}` interpolation. Dates are
 * derived from `typicalMonth` — the tournament starts on the first Thursday
 * of that month and runs Thursday→Sunday (4 days).
 */

export type TournamentGender = "mens" | "womens";
export type TournamentCategory =
  | "major"
  | "signature"
  | "playoff"
  | "dpwt"
  | "lpga_major";

export interface TournamentTemplate {
  /** Slug pattern, e.g. "masters-{year}" */
  slug: string;
  /** Name pattern, e.g. "The Masters {year}" */
  name: string;
  /** 1–12 — month in which the tournament is typically played */
  typicalMonth: number;
  /** Course name (may vary year to year for some majors but we use the default) */
  course: string;
  /** Par for the course */
  par: number;
  /** Category used by the app */
  category: TournamentCategory;
  /** Tour identifier */
  tour: "pga" | "dpwt" | "lpga";
  /** Entry fee in pence */
  entryFee: number;
  /** Gender — determines which player pool to link */
  gender: TournamentGender;
}

/**
 * All 15 recurring tournaments in the fantasy golf app.
 * Ordered roughly chronologically within the calendar year.
 */
export const TOURNAMENT_TEMPLATES: TournamentTemplate[] = [
  // ── Men's Signature (early season) ──────────────────────────────────────
  {
    slug: "genesis-{year}",
    name: "The Genesis Invitational {year}",
    typicalMonth: 2,
    course: "Riviera Country Club",
    par: 71,
    category: "signature",
    tour: "pga",
    entryFee: 1000,
    gender: "mens",
  },
  // ── Men's Majors ────────────────────────────────────────────────────────
  {
    slug: "masters-{year}",
    name: "The Masters {year}",
    typicalMonth: 4,
    course: "Augusta National Golf Club",
    par: 72,
    category: "major",
    tour: "pga",
    entryFee: 1500,
    gender: "mens",
  },
  {
    slug: "pga-championship-{year}",
    name: "PGA Championship {year}",
    typicalMonth: 5,
    course: "TBD",
    par: 72,
    category: "major",
    tour: "pga",
    entryFee: 1500,
    gender: "mens",
  },
  {
    slug: "us-open-{year}",
    name: "U.S. Open {year}",
    typicalMonth: 6,
    course: "TBD",
    par: 70,
    category: "major",
    tour: "pga",
    entryFee: 1500,
    gender: "mens",
  },
  {
    slug: "the-open-{year}",
    name: "The Open Championship {year}",
    typicalMonth: 7,
    course: "TBD",
    par: 70,
    category: "major",
    tour: "pga",
    entryFee: 1500,
    gender: "mens",
  },
  // ── Men's Signature (spring) ────────────────────────────────────────────
  {
    slug: "arnold-palmer-{year}",
    name: "Arnold Palmer Invitational {year}",
    typicalMonth: 3,
    course: "Bay Hill Golf Club",
    par: 72,
    category: "signature",
    tour: "pga",
    entryFee: 1000,
    gender: "mens",
  },
  {
    slug: "players-{year}",
    name: "The Players Championship {year}",
    typicalMonth: 3,
    course: "TPC Sawgrass",
    par: 72,
    category: "signature",
    tour: "pga",
    entryFee: 1000,
    gender: "mens",
  },
  {
    slug: "memorial-{year}",
    name: "The Memorial Tournament {year}",
    typicalMonth: 6,
    course: "Muirfield Village Golf Club",
    par: 72,
    category: "signature",
    tour: "pga",
    entryFee: 1000,
    gender: "mens",
  },
  // ── Men's Playoff ───────────────────────────────────────────────────────
  {
    slug: "tour-championship-{year}",
    name: "Tour Championship {year}",
    typicalMonth: 8,
    course: "East Lake Golf Club",
    par: 70,
    category: "playoff",
    tour: "pga",
    entryFee: 1000,
    gender: "mens",
  },
  // ── Men's DPWT ──────────────────────────────────────────────────────────
  {
    slug: "bmw-pga-{year}",
    name: "BMW PGA Championship {year}",
    typicalMonth: 9,
    course: "Wentworth Club",
    par: 72,
    category: "dpwt",
    tour: "dpwt",
    entryFee: 1000,
    gender: "mens",
  },
  // ── Women's LPGA Majors ─────────────────────────────────────────────────
  {
    slug: "chevron-{year}",
    name: "The Chevron Championship {year}",
    typicalMonth: 4,
    course: "The Club at Carlton Woods",
    par: 72,
    category: "lpga_major",
    tour: "lpga",
    entryFee: 1000,
    gender: "womens",
  },
  {
    slug: "us-womens-open-{year}",
    name: "U.S. Women's Open {year}",
    typicalMonth: 5,
    course: "TBD",
    par: 72,
    category: "lpga_major",
    tour: "lpga",
    entryFee: 1000,
    gender: "womens",
  },
  {
    slug: "kpmg-womens-pga-{year}",
    name: "KPMG Women's PGA Championship {year}",
    typicalMonth: 6,
    course: "TBD",
    par: 71,
    category: "lpga_major",
    tour: "lpga",
    entryFee: 1000,
    gender: "womens",
  },
  {
    slug: "amundi-evian-{year}",
    name: "Amundi Evian Championship {year}",
    typicalMonth: 7,
    course: "Evian Resort Golf Club",
    par: 71,
    category: "lpga_major",
    tour: "lpga",
    entryFee: 1000,
    gender: "womens",
  },
  {
    slug: "aig-womens-open-{year}",
    name: "AIG Women's Open {year}",
    typicalMonth: 8,
    course: "TBD",
    par: 72,
    category: "lpga_major",
    tour: "lpga",
    entryFee: 1000,
    gender: "womens",
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────

/**
 * Compute the first Thursday of a given month/year, then return a 4-day
 * Thursday→Sunday date range. Golf tournaments almost universally start
 * on Thursday and end on Sunday.
 */
export function getTournamentDates(
  year: number,
  month: number // 1-12
): { startDate: Date; endDate: Date } {
  // Find the first Thursday of the month
  const firstOfMonth = new Date(Date.UTC(year, month - 1, 1));
  const dayOfWeek = firstOfMonth.getUTCDay(); // 0=Sun, 4=Thu
  const daysUntilThursday = (4 - dayOfWeek + 7) % 7;
  const firstThursday = new Date(
    Date.UTC(year, month - 1, 1 + daysUntilThursday)
  );
  const sunday = new Date(
    Date.UTC(year, month - 1, 1 + daysUntilThursday + 3)
  );
  return { startDate: firstThursday, endDate: sunday };
}

/**
 * Resolve a template's slug/name for a given year.
 */
export function resolveTemplate(
  template: TournamentTemplate,
  year: number
): {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  course: string;
  par: number;
  category: TournamentCategory;
  tour: "pga" | "dpwt" | "lpga";
  entryFee: number;
  gender: TournamentGender;
} {
  const { startDate, endDate } = getTournamentDates(year, template.typicalMonth);
  return {
    id: template.slug.replace("{year}", String(year)),
    name: template.name.replace("{year}", String(year)),
    startDate,
    endDate,
    course: template.course,
    par: template.par,
    category: template.category,
    tour: template.tour,
    entryFee: template.entryFee,
    gender: template.gender,
  };
}

/**
 * Determine the tier for a given rank, matching the schema's enum values.
 */
export function tierForRank(rank: number | null | undefined): string {
  if (rank == null) return "T51_PLUS";
  if (rank <= 10) return "T1_10";
  if (rank <= 20) return "T11_20";
  if (rank <= 30) return "T21_30";
  if (rank <= 50) return "T31_50";
  return "T51_PLUS";
}
