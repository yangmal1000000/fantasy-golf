import type { PgaTourPlayerRow } from "@/lib/pga-tour-leaderboard";

export function deriveRocketOfficialPlayerState(input: {
  currentWithdrew: boolean;
  currentMadeCut: boolean | null;
  official: PgaTourPlayerRow | undefined;
  hasAnyScore: boolean;
  finalizationReady: boolean;
}) {
  const absentFinalStarter =
    input.finalizationReady && !input.official && !input.hasAnyScore;
  return {
    absentFinalStarter,
    withdrew:
      input.currentWithdrew ||
      input.official?.withdrew === true ||
      input.official?.disqualified === true ||
      absentFinalStarter,
    madeCut: input.official?.madeCut ?? input.currentMadeCut,
  };
}
