import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const entryForm = readFileSync(
  new URL("../app/tournaments/[id]/enter/TeamEntryForm.tsx", import.meta.url),
  "utf8",
);
const entryPage = readFileSync(
  new URL("../app/tournaments/[id]/enter/page.tsx", import.meta.url),
  "utf8",
);
const funnelRoute = readFileSync(
  new URL("../app/api/rocket-beta-funnel/route.ts", import.meta.url),
  "utf8",
);
const operations = readFileSync(
  new URL("./admin-operations.ts", import.meta.url),
  "utf8",
);

test("five selected golfers never masquerade as a saved team", () => {
  assert.match(entryForm, /5 of 5 selected · name needed/);
  assert.match(entryForm, /5 of 5 selected · ready to review/);
  assert.match(entryForm, /entryProgress\.guidance/);
  assert.match(entryForm, /Review & save/);
  assert.match(entryForm, /Confirm your five picks/);
  assert.match(entryForm, /Save my team/);
  assert.doesNotMatch(entryForm, /Team Complete!/);
});

test("saved entry gives an unambiguous stopping point", () => {
  assert.match(entryForm, /Entry saved · No action needed/);
  assert.match(entryForm, /You&apos;re done for now/);
  assert.match(entryForm, /You do not need to do anything else/);
  assert.match(entryForm, /View my saved team/);
  assert.match(entryPage, /Once your entry is saved, you are done/);
});

test("a complete unsaved draft warns before navigation", () => {
  assert.match(entryForm, /hasUnsavedCompleteDraft/);
  assert.match(entryForm, /beforeunload/);
  assert.match(entryForm, /Your five picks have not been saved/);
  assert.match(entryForm, /window\.confirm/);
  assert.match(entryForm, /lastSavedDraftFingerprint/);
});

test("first-party funnel events are authenticated, allowlisted and aggregate by user", () => {
  assert.match(funnelRoute, /five_picks_selected/);
  assert.match(funnelRoute, /review_opened/);
  assert.match(funnelRoute, /getCurrentUser/);
  assert.match(funnelRoute, /Cross-site request blocked/);
  assert.match(funnelRoute, /campaignId_userId/);
  assert.doesNotMatch(funnelRoute, /actorEmail:/);
  assert.match(entryForm, /recordRocketEntryFunnelEvent\("five_picks_selected"\)/);
  assert.match(entryForm, /recordRocketEntryFunnelEvent\("review_opened"\)/);
  assert.match(operations, /5\/5 selected/);
  assert.match(operations, /Review opened/);
  assert.match(operations, /new Set/);
});
