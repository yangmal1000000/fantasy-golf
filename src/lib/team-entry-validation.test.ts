import assert from "node:assert/strict";
import test from "node:test";
import {
  TEAM_ENTRY_TIERS,
  TeamEntryValidationError,
  validateTeamEntryPayload,
  validateTeamEntryPlayers,
} from "./team-entry-validation";

const selections = TEAM_ENTRY_TIERS.map((_, index) => `player-${index + 1}`);
const players = TEAM_ENTRY_TIERS.map((tier, index) => ({
  id: selections[index],
  tier,
  withdrew: false,
}));

test("validates and trims a complete five-tier team entry", () => {
  assert.deepEqual(
    validateTeamEntryPayload({
      teamName: "  Dry Run Five  ",
      selections,
    }),
    {
      teamName: "Dry Run Five",
      selections,
    },
  );
  assert.doesNotThrow(() => validateTeamEntryPlayers(players, selections));
});

test("rejects duplicate or incomplete team entry payloads", () => {
  assert.throws(
    () =>
      validateTeamEntryPayload({
        teamName: "Dry Run Five",
        selections: [...selections.slice(0, 4), selections[0]],
      }),
    TeamEntryValidationError,
  );
  assert.throws(
    () =>
      validateTeamEntryPayload({
        teamName: "Dry Run Five",
        selections: selections.slice(0, 4),
      }),
    TeamEntryValidationError,
  );
});

test("requires one active player from each official tier", () => {
  assert.throws(
    () =>
      validateTeamEntryPlayers(
        players.map((player, index) =>
          index === 4 ? { ...player, tier: TEAM_ENTRY_TIERS[3] } : player,
        ),
        selections,
      ),
    TeamEntryValidationError,
  );
  assert.throws(
    () =>
      validateTeamEntryPlayers(
        players.map((player, index) =>
          index === 2 ? { ...player, withdrew: true } : player,
        ),
        selections,
      ),
    TeamEntryValidationError,
  );
});
