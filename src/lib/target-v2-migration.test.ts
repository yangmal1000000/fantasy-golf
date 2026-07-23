import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controlRoute = readFileSync(
  new URL("../app/api/target-control/route.ts", import.meta.url),
  "utf8",
);
const targetPage = readFileSync(
  new URL("../app/target/page.tsx", import.meta.url),
  "utf8",
);
const previewPage = readFileSync(
  new URL("../app/target-v2-preview/page.tsx", import.meta.url),
  "utf8",
);

test("v2 migration is limited to the approved unredeemed v1 state", () => {
  assert.match(controlRoute, /case "migrate_target_v2"/);
  assert.match(
    controlRoute,
    /488f2b2222263a6fdd24e316258bf4781cdde7711cd4c90f733ceaeedc55e0c1/,
  );
  assert.match(controlRoute, /entries\.length !== 2 \|\| passes\.length !== 2/);
  assert.match(controlRoute, /pass\.status !== "UNLOCKED"/);
  assert.match(controlRoute, /Boolean\(pass\.redeemedAt\)/);
  assert.match(controlRoute, /Boolean\(pass\.teamId\)/);
  assert.match(
    controlRoute,
    /Prisma\.TransactionIsolationLevel\.Serializable/,
  );
});

test("v2 migration resets only the linked passes and entries and is audited", () => {
  assert.match(
    controlRoute,
    /rocketBetaPass\.deleteMany\(\{[\s\S]*id: \{ in: passes\.map/,
  );
  assert.match(
    controlRoute,
    /targetPilotEntry\.deleteMany\(\{[\s\S]*id: \{ in: entryIds \}/,
  );
  assert.match(controlRoute, /action: "target_v2_migration_completed"/);
  assert.match(controlRoute, /action: "target_v2_pass_reset"/);
  assert.match(
    controlRoute,
    /target-v1-pre-v2-2026-07-23T2322Z\.json/,
  );
});

test("the live Target renders v2 while the former preview redirects to it", () => {
  assert.match(targetPage, /TargetV2Client/);
  assert.match(previewPage, /redirect\("\/target"\)/);
});
