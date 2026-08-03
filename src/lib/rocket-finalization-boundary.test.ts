import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const dataSync = readFileSync(new URL("./data-sync.ts", import.meta.url), "utf8");
const liveRoute = readFileSync(
  new URL("../app/api/sync/live/route.ts", import.meta.url),
  "utf8",
);
const workflow = readFileSync(
  new URL("../../.github/workflows/rocket-live-scoring.yml", import.meta.url),
  "utf8",
);
const tournamentPage = readFileSync(
  new URL("../app/tournaments/[id]/page.tsx", import.meta.url),
  "utf8",
);
const leaderboardPage = readFileSync(
  new URL("../app/tournaments/[id]/leaderboard/page.tsx", import.meta.url),
  "utf8",
);

test("post-event sync uses official status evidence before finalization", () => {
  assert.match(dataSync, /reconcileRocketOfficialLeaderboard/);
  assert.match(dataSync, /await processAutoSubs/);
  assert.ok(
    dataSync.indexOf("reconcileRocketOfficialLeaderboard(tournament.id)") <
      dataSync.indexOf("await processAutoSubs(tournament.id)"),
  );
  assert.match(dataSync, /finalizeRocketCampaign/);
  assert.match(dataSync, /officialReconciliation\?\.finalizationReady/);
  assert.doesNotMatch(
    dataSync,
    /liveState\?\.status === "completed" \|\|/,
  );
});

test("manual recovery bypasses the expired window only with a sealed-result gate", () => {
  assert.match(workflow, /finalize:/);
  assert.match(workflow, /force=true&requireFinal=true/);
  assert.match(liveRoute, /searchParams\.get\("force"\) === "true"/);
  assert.match(liveRoute, /searchParams\.get\("requireFinal"\) === "true"/);
  assert.match(liveRoute, /Rocket finalization gate failed/);
});

test("public Rocket surfaces distinguish open, provisional and sealed states", () => {
  assert.match(tournamentPage, /FINAL TEST RESULT/);
  assert.match(tournamentPage, /RESULTS PENDING/);
  assert.match(tournamentPage, /Test Flight Complete/);
  assert.match(leaderboardPage, /Final result sealed/);
  assert.match(leaderboardPage, /Provisional standings/);
  assert.match(leaderboardPage, /No winner is final yet/);
  assert.match(leaderboardPage, /verifyRocketFinalResult/);
  assert.match(leaderboardPage, /overlayRocketFinalLeaderboard/);
  assert.match(leaderboardPage, /Final result verification unavailable/);
});
