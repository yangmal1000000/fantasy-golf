import assert from "node:assert/strict";
import test from "node:test";
import {
  normalizeGolfPlayerName,
  parsePgaTourLeaderboardHtml,
} from "./pga-tour-leaderboard";

const sourceUrl =
  "https://www.pgatour.com/tournaments/2026/rocket-classic/R2026524/leaderboard";

function html(players: unknown[], status = "COMPLETED") {
  const payload = {
    props: {
      pageProps: {
        dehydratedState: {
          queries: [
            { state: { data: { __typename: "FeatureFlags" } } },
            {
              state: {
                data: {
                  __typename: "LeaderboardV3",
                  id: "R2026524",
                  tournamentStatus: status,
                  players,
                },
              },
            },
          ],
        },
      },
    },
  };
  return `<html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(payload)}</script></html>`;
}

test("PGA TOUR fallback recognises WD state and preserves completed rounds", () => {
  const evidence = parsePgaTourLeaderboardHtml(
    html([
      {
        __typename: "PlayerRowV3",
        player: { displayName: "Patrick Rodgers" },
        scoringData: {
          position: "WD",
          playerState: "WITHDRAWN",
          rounds: ["77", "-", "-", "-"],
        },
      },
    ]),
    "R2026524",
    sourceUrl,
  );

  assert.equal(evidence.tournamentStatus, "COMPLETED");
  assert.deepEqual(evidence.players[0], {
    name: "Patrick Rodgers",
    position: "WD",
    playerState: "WITHDRAWN",
    rounds: [77, null, null, null],
    withdrew: true,
    madeCut: null,
  });
});

test("PGA TOUR fallback recognises a cut and a completed player", () => {
  const evidence = parsePgaTourLeaderboardHtml(
    html([
      {
        __typename: "PlayerRowV3",
        player: { displayName: "Cut Golfer" },
        scoringData: {
          position: "CUT",
          playerState: "COMPLETE",
          rounds: ["71", "72", "-", "-"],
        },
      },
      {
        __typename: "PlayerRowV3",
        player: { displayName: "Weekend Golfer" },
        scoringData: {
          position: "4",
          playerState: "COMPLETE",
          rounds: ["68", "69", "70", "67"],
        },
      },
    ]),
    "R2026524",
    sourceUrl,
  );

  assert.equal(evidence.players[0].madeCut, false);
  assert.equal(evidence.players[1].madeCut, true);
});

test("PGA TOUR fallback fails closed on the wrong leaderboard", () => {
  assert.throws(
    () => parsePgaTourLeaderboardHtml(html([]), "R2026999", sourceUrl),
    /leaderboard mismatch/,
  );
});

test("player-name normalization is accent and punctuation tolerant", () => {
  assert.equal(normalizeGolfPlayerName("Rasmus Højgaard"), "rasmus hojgaard");
  assert.equal(normalizeGolfPlayerName("  Tom  O'Neil  "), "tom o neil");
});
