import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const enterPageSource = readFileSync(
  new URL("../app/tournaments/[id]/enter/page.tsx", import.meta.url),
  "utf8",
);
const countdownSource = readFileSync(
  new URL(
    "../app/tournaments/[id]/enter/RocketFieldOpeningCountdown.tsx",
    import.meta.url,
  ),
  "utf8",
);
const betaSource = readFileSync(
  new URL("./rocket-beta.ts", import.meta.url),
  "utf8",
);
const betaConfigSource = readFileSync(
  new URL("./rocket-beta-config.ts", import.meta.url),
  "utf8",
);

test("the waiting card counts down to verified provisional drafting first", () => {
  assert.match(enterPageSource, /RocketFieldOpeningCountdown/);
  assert.match(
    enterPageSource,
    /ROCKET_BETA_PROVISIONAL_DRAFT_EXPECTED_AT\.toISOString\(\)/,
  );
  assert.match(enterPageSource, /milestone="provisional-drafting"/);
  assert.match(
    betaConfigSource,
    /ROCKET_BETA_PROVISIONAL_DRAFT_EXPECTED_AT[\s\S]*2026-07-24T21:00:00\.000Z/,
  );
  assert.match(betaSource, /entryOpensAt: ROCKET_BETA_ENTRY_OPENS_AT/);
});

test("draft mode switches the same countdown to final confirmation", () => {
  assert.match(enterPageSource, /expectedAt=\{betaState\.entryOpensAt\}/);
  assert.match(enterPageSource, /milestone="final-confirmation"/);
  assert.match(countdownSource, /Provisional draft expected in/);
  assert.match(countdownSource, /Final confirmation expected in/);
  assert.match(countdownSource, /Official initial field update pending/);
  assert.match(countdownSource, /Official final field update pending/);
});

test("both milestones poll automatically but the clock is never an opening gate", () => {
  assert.match(countdownSource, /router\.refresh\(\)/);
  assert.match(countdownSource, /hasReachedExpectedTime \? 15_000 : 60_000/);
  assert.match(countdownSource, /Waiting for the official PGA TOUR initial field/);
  assert.match(countdownSource, /Waiting for the official PGA TOUR final field/);
  assert.match(countdownSource, /cannot open this stage by itself/);
  assert.match(countdownSource, /PGA TOUR\/PGATOUR\.COM/);
  assert.match(countdownSource, /Michigan PGA\/Golf Genius/);
  assert.match(
    countdownSource,
    /playoff, withdrawal or publishing delay/,
  );
});
