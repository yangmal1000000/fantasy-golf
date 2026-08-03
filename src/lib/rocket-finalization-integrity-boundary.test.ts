import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const finalization = readFileSync(
  new URL("./rocket-finalization.ts", import.meta.url),
  "utf8",
);
const reconciliation = readFileSync(
  new URL("./rocket-official-reconciliation.ts", import.meta.url),
  "utf8",
);
const dataSync = readFileSync(new URL("./data-sync.ts", import.meta.url), "utf8");
const immutableMigration = readFileSync(
  new URL(
    "../../prisma/migrations/20260803110000_sealed_rocket_result_guards/migration.sql",
    import.meta.url,
  ),
  "utf8",
);

test("finalization locks the mutable score snapshot before calculating standings", () => {
  const lock = finalization.indexOf("await lockFinalizationSnapshot");
  const calculate = finalization.indexOf(
    "calculateLeaderboard(input.tournamentId, tx)",
  );
  assert.ok(lock >= 0 && calculate > lock);
  assert.match(finalization, /FOR UPDATE/);
  assert.match(finalization, /FROM "TournamentPlayer"[\s\S]*FOR SHARE/);
  assert.match(finalization, /FROM "Score"[\s\S]*FOR SHARE/);
  assert.match(finalization, /FROM "TeamSelection"[\s\S]*FOR SHARE OF selection/);
  assert.match(
    finalization,
    /isolationLevel: Prisma\.TransactionIsolationLevel\.Serializable/,
  );
  assert.match(finalization, /error\.code === "P2034"/);
});

test("automatic closure uses compare-and-set and cannot reopen a final campaign", () => {
  assert.match(
    finalization,
    /where: \{ id: campaign\.id, status: "OPEN", finalizedAt: null \}/,
  );
  assert.ok(
    finalization.indexOf("if (updated.count !== 1)") <
      finalization.indexOf('action: "campaign_closed_automatically"'),
  );
});

test("partial official evidence is rejected before reconciliation writes", () => {
  const assessment = reconciliation.indexOf(
    "assessPgaTourLeaderboardEvidence",
  );
  const rejection = reconciliation.indexOf("if (!assessment.ok)");
  const firstWrite = reconciliation.indexOf("prisma.$transaction");
  assert.ok(assessment >= 0 && rejection > assessment && firstWrite > rejection);
});

test("sealed Rocket results skip both live and completed score ingestion", () => {
  assert.match(dataSync, /await isRocketResultSealed\(tournament\.id\)/);
  assert.match(dataSync, /sealedTournamentsSkipped \+= 1/);
  assert.match(dataSync, /finalization = await finalizeRocketCampaign/);
  assert.match(dataSync, /ok: errors\.length === 0/);
});

test("all mutable final-result inputs are protected at the database boundary", () => {
  for (const table of ["Score", "TournamentPlayer", "Team", "TeamSelection"]) {
    assert.match(immutableMigration, new RegExp(`ON "${table}"`));
  }
  assert.match(immutableMigration, /"finalizedAt" IS NOT NULL/);
  assert.match(immutableMigration, /ERRCODE = '55000'/);
  assert.match(reconciliation, /FOR SHARE/);
  assert.match(reconciliation, /if \(!applied\)/);
});
