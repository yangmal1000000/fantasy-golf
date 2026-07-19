/**
 * Achievements definitions and evaluation logic.
 * Achievement types must match the `type` column in "UserAchievement" table.
 */

export interface AchievementDef {
  type: string;
  label: string;
  description: string;
  icon: string;
  color: string; // tailwind gradient classes
}

export const ACHIEVEMENT_DEFS: AchievementDef[] = [
  {
    type: "first_steps",
    label: "First Steps",
    description: "Entered your first team",
    icon: "👶",
    color: "from-emerald-400 to-emerald-600",
  },
  {
    type: "major_player",
    label: "Major Player",
    description: "Entered all 4 majors in one year",
    icon: "🏆",
    color: "from-amber-400 to-amber-600",
  },
  {
    type: "podium_finish",
    label: "Podium Finish",
    description: "Finished top 3 in a tournament",
    icon: "🥉",
    color: "from-orange-400 to-orange-600",
  },
  {
    type: "champion",
    label: "Champion",
    description: "Won a tournament",
    icon: "👑",
    color: "from-yellow-400 to-yellow-600",
  },
  {
    type: "dark_horse_hero",
    label: "Dark Horse Hero",
    description: "Won with a T5 player who finished top 10",
    icon: "🐎",
    color: "from-zinc-500 to-zinc-700",
  },
  {
    type: "loyal_fan",
    label: "Loyal Fan",
    description: "Entered 5+ tournaments",
    icon: "💚",
    color: "from-green-500 to-green-700",
  },
  {
    type: "league_champion",
    label: "League Champion",
    description: "Won a private league",
    icon: "🏅",
    color: "from-blue-400 to-blue-600",
  },
  {
    type: "social_butterfly",
    label: "Social Butterfly",
    description: "In 3+ leagues",
    icon: "🦋",
    color: "from-purple-400 to-purple-600",
  },
  {
    type: "streak_master",
    label: "Streak Master",
    description: "7 correct daily predictions",
    icon: "🔥",
    color: "from-red-400 to-red-600",
  },
  {
    type: "early_bird",
    label: "Early Bird",
    description: "First to enter a tournament",
    icon: "🐦",
    color: "from-sky-400 to-sky-600",
  },
];

export const ACHIEVEMENT_MAP: Record<string, AchievementDef> = Object.fromEntries(
  ACHIEVEMENT_DEFS.map((a) => [a.type, a]),
);

/**
 * Evaluate which achievements a user has earned based on raw query results.
 * Returns a list of achievement types that should be awarded.
 *
 * This is a best-effort synchronous evaluation; pass pre-fetched counts.
 */
export interface AchievementStats {
  teamsCount: number;
  majorTeamsCount: number; // teams in majors this year
  top3Finishes: number;
  wins: number;
  leaguesCount: number;
  paidTeamsCount: number;
  firstEntryTournaments: number; // tournaments where user was first to enter
  darkHorseWins: number;
  leagueWins: number;
  predictionStreak: number;
}

export function evaluateAchievements(stats: AchievementStats): string[] {
  const earned: string[] = [];
  if (stats.teamsCount >= 1) earned.push("first_steps");
  if (stats.majorTeamsCount >= 4) earned.push("major_player");
  if (stats.top3Finishes >= 1) earned.push("podium_finish");
  if (stats.wins >= 1) earned.push("champion");
  if (stats.darkHorseWins >= 1) earned.push("dark_horse_hero");
  if (stats.paidTeamsCount >= 5) earned.push("loyal_fan");
  if (stats.leagueWins >= 1) earned.push("league_champion");
  if (stats.leaguesCount >= 3) earned.push("social_butterfly");
  if (stats.predictionStreak >= 7) earned.push("streak_master");
  if (stats.firstEntryTournaments >= 1) earned.push("early_bird");
  return earned;
}
