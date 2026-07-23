export interface LiveTournamentStateInput {
  eventState?: string | null;
  completed?: boolean;
  currentRound: number;
}

export function deriveLiveTournamentState(
  input: LiveTournamentStateInput,
): { status: "in_progress" | "completed"; currentRound: number } | null {
  const eventState = input.eventState?.trim().toLowerCase();
  if (input.completed || eventState === "post") {
    return { status: "completed", currentRound: 4 };
  }
  if (
    eventState === "in" ||
    eventState === "in_progress" ||
    input.currentRound > 0
  ) {
    return {
      status: "in_progress",
      currentRound: Math.min(4, Math.max(1, Math.trunc(input.currentRound))),
    };
  }
  return null;
}
