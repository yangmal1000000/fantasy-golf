/**
 * Golf scoring color system — matches PGA Tour / major championship convention.
 *
 * Under par  → RED   (good score, birdie/eagle territory)
 * Even par   → GRAY  ("E")
 * Over par   → DARK  (bad score, bogey+)
 *
 * Usage: import { scoreColor, toParClass } from "@/lib/score-colors";
 */

/**
 * Get Tailwind classes for a single round score vs par.
 * Used for individual round columns (R1, R2, R3, R4).
 */
export function roundScoreClass(strokes: number | null, par: number): string {
  if (strokes === null) return "text-zinc-300 dark:text-zinc-600";
  const diff = strokes - par;
  if (diff < -1) return "text-red-600 dark:text-red-400 font-bold"; // Eagle or better
  if (diff < 0) return "text-red-500 dark:text-red-400 font-semibold"; // Birdie
  if (diff === 0) return "text-zinc-700 dark:text-zinc-300"; // Par
  if (diff === 1) return "text-zinc-800 dark:text-zinc-400 font-medium"; // Bogey
  return "text-zinc-900 dark:text-zinc-500 font-bold"; // Double bogey+
}

/**
 * Get Tailwind classes for a "to par" / "vs par" total.
 * Negative = under par = RED. Positive = over par = DARK.
 */
export function toParClass(toPar: number): string {
  if (toPar < 0) return "text-red-600 dark:text-red-400 font-bold";
  if (toPar === 0) return "text-zinc-600 dark:text-zinc-400 font-semibold";
  return "text-zinc-800 dark:text-zinc-500 font-semibold";
}

/**
 * Get the display string for a to-par value.
 * -3 → "-3", 0 → "E", +5 → "+5"
 */
export function toParDisplay(toPar: number): string {
  if (toPar === 0) return "E";
  return `${toPar > 0 ? "+" : ""}${toPar}`;
}

/**
 * Get background tint for a scoreboard row based on position.
 * Used for leaderboard rows.
 */
export function positionRowClass(position: number, isProjected: boolean): string {
  if (position === 1) return isProjected ? "bg-amber-50 dark:bg-amber-950/20" : "bg-[#c8a951]/10";
  if (position <= 3) return "bg-[#0a3d2a]/5 dark:bg-green-950/10";
  return "";
}

/**
 * Get the badge class for a position circle.
 */
export function positionBadgeClass(position: number): string {
  if (position === 1) return "bg-[#c8a951] text-[#1a1a1a]";
  if (position <= 3) return "bg-[#0a3d2a] text-white dark:bg-green-700";
  if (position <= 10) return "bg-[#1a5c3e] text-white dark:bg-green-800";
  return "bg-zinc-100 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300";
}
