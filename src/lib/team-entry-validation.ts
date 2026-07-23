export const TEAM_ENTRY_TIERS = [
  "T1_10",
  "T11_20",
  "T21_30",
  "T31_50",
  "T51_PLUS",
] as const;

export interface TeamEntryPayload {
  teamName: string;
  selections: string[];
}

export interface TeamEntryPlayerRow {
  id: string;
  tier: string;
  withdrew?: boolean;
}

export class TeamEntryValidationError extends Error {
  constructor(
    message: string,
    public readonly status = 400,
  ) {
    super(message);
  }
}

export function validateTeamEntryPayload(input: unknown): TeamEntryPayload {
  if (!input || typeof input !== "object") {
    throw new TeamEntryValidationError("Invalid team entry");
  }

  const { teamName, selections } = input as {
    teamName?: unknown;
    selections?: unknown;
  };

  if (
    typeof teamName !== "string" ||
    !teamName.trim() ||
    teamName.trim().length > 80
  ) {
    throw new TeamEntryValidationError(
      "Team name must be between 1 and 80 characters",
    );
  }

  if (
    !Array.isArray(selections) ||
    selections.length !== TEAM_ENTRY_TIERS.length ||
    !selections.every(
      (selection) =>
        typeof selection === "string" &&
        selection.length > 0 &&
        selection.length <= 100,
    )
  ) {
    throw new TeamEntryValidationError(
      "Must select exactly 5 players (one per tier)",
    );
  }

  if (new Set(selections).size !== selections.length) {
    throw new TeamEntryValidationError(
      "Each player may be selected only once",
    );
  }

  return {
    teamName: teamName.trim(),
    selections,
  };
}

export function validateTeamEntryPlayers(
  players: TeamEntryPlayerRow[],
  selections: string[],
) {
  if (
    players.length !== TEAM_ENTRY_TIERS.length ||
    players.some((player) => player.withdrew)
  ) {
    throw new TeamEntryValidationError("Invalid player selections");
  }

  const selectedIds = new Set(selections);
  if (players.some((player) => !selectedIds.has(player.id))) {
    throw new TeamEntryValidationError("Invalid player selections");
  }

  const tiers = new Set(players.map((player) => player.tier));
  if (
    tiers.size !== TEAM_ENTRY_TIERS.length ||
    TEAM_ENTRY_TIERS.some((tier) => !tiers.has(tier))
  ) {
    throw new TeamEntryValidationError(
      "Must pick one player from each of the 5 tiers",
    );
  }
}
