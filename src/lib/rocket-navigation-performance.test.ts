import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const rocketBetaSource = readFileSync(
  new URL("./rocket-beta.ts", import.meta.url),
  "utf8",
);
const entryPageSource = readFileSync(
  new URL("../app/tournaments/[id]/enter/page.tsx", import.meta.url),
  "utf8",
);
const appLoadingSource = readFileSync(
  new URL("../app/loading.tsx", import.meta.url),
  "utf8",
);

test("existing Rocket campaigns avoid request-time schema setup and upserts", () => {
  const existingLookup = rocketBetaSource.indexOf(
    "prisma.rocketBetaCampaign.findUnique",
  );
  const schemaSetup = rocketBetaSource.indexOf("await ensureRocketBetaSchema()");
  assert.ok(existingLookup >= 0);
  assert.ok(schemaSetup > existingLookup);
  assert.match(rocketBetaSource, /if \(existing\) return existing/);
  assert.match(rocketBetaSource, /error\.code !== "P2021"/);
});

test("the entry page fetches beta state and saved teams concurrently", () => {
  assert.match(
    entryPageSource,
    /const \[betaState, savedTeams\] = await Promise\.all\(/,
  );
  assert.match(
    entryPageSource,
    /player:\s*\{\s*select:\s*\{[\s\S]*dataGolfRank: true/,
  );
});

test("slow dynamic navigation immediately shows a page skeleton and progress bar", () => {
  assert.match(appLoadingSource, /navigation-loading-bar/);
  assert.match(appLoadingSource, /aria-label="Loading page"/);
  assert.equal(
    (appLoadingSource.match(/skeleton-shimmer/g) ?? []).length >= 4,
    true,
  );
});
