import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const myTeamsSource = readFileSync(
  new URL("../app/my-teams/page.tsx", import.meta.url),
  "utf8",
);

test("an unlocked Rocket pass explains why a dry-run team is absent", () => {
  assert.match(myTeamsSource, /rocketPass\?\.status === "UNLOCKED"/);
  assert.match(myTeamsSource, /Dry-run teams are deliberately not saved/);
  assert.match(myTeamsSource, /your Test Pass remains unlocked/);
  assert.match(
    myTeamsSource,
    /href="\/tournaments\/rocket-classic\/enter"/,
  );
});

test("My Teams changes its Rocket action when the reviewed field opens", () => {
  assert.match(myTeamsSource, /rocketFieldReady/);
  assert.match(myTeamsSource, /Build Rocket team →/);
  assert.match(myTeamsSource, /View entry status →/);
});
