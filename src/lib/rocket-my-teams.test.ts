import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const myTeamsSource = readFileSync(
  new URL("../app/my-teams/page.tsx", import.meta.url),
  "utf8",
);

test("an unlocked Rocket pass distinguishes a provisional draft from an official team", () => {
  assert.match(myTeamsSource, /rocketPass\?\.status === "UNLOCKED"/);
  assert.match(myTeamsSource, /Your provisional Rocket draft is saved/);
  assert.match(myTeamsSource, /without using the Test Pass/);
  assert.match(myTeamsSource, /official initial field has not been published/);
  assert.match(myTeamsSource, /href="\/tournaments\/rocket-classic\/enter"/);
});

test("My Teams changes its Rocket action when the reviewed field opens", () => {
  assert.match(myTeamsSource, /rocketFieldReady/);
  assert.match(myTeamsSource, /rocketProvisionalFieldReady/);
  assert.match(myTeamsSource, /Build Rocket team →/);
  assert.match(myTeamsSource, /Start provisional draft →/);
  assert.match(myTeamsSource, /View entry status →/);
});
