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

test("the waiting card renders the server-owned field-opening countdown", () => {
  assert.match(enterPageSource, /RocketFieldOpeningCountdown/);
  assert.match(enterPageSource, /opensAt=\{betaState\.entryOpensAt\}/);
  assert.match(betaSource, /entryOpensAt: ROCKET_BETA_ENTRY_OPENS_AT/);
});

test("the countdown checks for released field data without a manual reload", () => {
  assert.match(countdownSource, /router\.refresh\(\)/);
  assert.match(countdownSource, /hasReachedOpening \? 15_000 : 60_000/);
  assert.match(countdownSource, /reveal the five-tier team/);
});
