import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const teamEntrySource = readFileSync(
  new URL(
    "../app/tournaments/[id]/enter/TeamEntryForm.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("mobile team review action sits above the persistent bottom navigation", () => {
  assert.match(
    teamEntrySource,
    /bottom-\[calc\(48px\+env\(safe-area-inset-bottom\)\)\]/,
  );
  assert.doesNotMatch(
    teamEntrySource,
    /className="fixed bottom-0 left-0 right-0 z-40/,
  );
});

test("team-entry review dialogs stack above the persistent mobile navigation", () => {
  assert.equal(
    teamEntrySource.match(/fixed inset-0 z-\[60\]/g)?.length,
    2,
  );
});

test("review actions remain actionable and reveal missing entry requirements", () => {
  assert.match(teamEntrySource, /teamNameInputRef\.current\?\.focus\(\)/);
  assert.match(teamEntrySource, /team-tier-\$\{firstMissingTier\}/);
  assert.doesNotMatch(
    teamEntrySource,
    /disabled=\{\s*!allTiersFilled/,
  );
});

test("mobile selection starts with one tier and advances after a pick", () => {
  assert.match(
    teamEntrySource,
    /return new Set\(firstIncompleteTier \? \[firstIncompleteTier\] : \[\]\)/,
  );
  assert.match(
    teamEntrySource,
    /setOpenTiers\(new Set\(nextIncompleteTier \? \[nextIncompleteTier\] : \[\]\)\)/,
  );
  assert.match(
    teamEntrySource,
    /team-tier-\$\{nextIncompleteTier\}/,
  );
  assert.match(
    teamEntrySource,
    /team-tier-\$\{nextIncompleteTier\}[\s\S]*scrollIntoView\(\{ behavior: "auto", block: "start" \}/,
  );
  assert.doesNotMatch(
    teamEntrySource,
    /new Set\(TEAM_ENTRY_TIERS\)/,
  );
});

test("large tiers have an accessible player search", () => {
  assert.match(teamEntrySource, /Search \{config\.label\} golfers/);
  assert.match(teamEntrySource, /type="search"/);
  assert.match(teamEntrySource, /player\.name\.toLowerCase\(\)\.includes/);
  assert.match(teamEntrySource, /No golfers match/);
});
