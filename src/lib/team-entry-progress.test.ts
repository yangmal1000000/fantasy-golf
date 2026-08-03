import assert from "node:assert/strict";
import test from "node:test";
import { teamEntryProgress } from "./team-entry-progress";

test("mobile entry names the exact remaining selection work", () => {
  assert.deepEqual(
    teamEntryProgress({
      selectedCount: 2,
      hasTeamName: false,
      reviewLabel: "Review & save",
    }),
    {
      readyToReview: false,
      guidance: "Choose 3 more golfers",
      mobileAction: "Pick 3 more",
    },
  );
});

test("team name is the next action after all five golfers are chosen", () => {
  assert.equal(
    teamEntryProgress({
      selectedCount: 5,
      hasTeamName: false,
      reviewLabel: "Review & save",
    }).mobileAction,
    "Add team name",
  );
});

test("a named five-player team is ready for review", () => {
  assert.deepEqual(
    teamEntryProgress({
      selectedCount: 5,
      hasTeamName: true,
      reviewLabel: "Review & save",
    }),
    {
      readyToReview: true,
      guidance: "Ready to review and save",
      mobileAction: "Review & save",
    },
  );
});
