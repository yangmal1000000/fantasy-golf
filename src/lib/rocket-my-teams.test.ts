import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const myTeamsSource = readFileSync(
  new URL("../app/my-teams/page.tsx", import.meta.url),
  "utf8",
);

test("an unlocked Rocket pass distinguishes a provisional draft from an official team", () => {
  assert.match(myTeamsSource, /rocketPass\?\.status === "UNLOCKED"/);
  assert.match(myTeamsSource, /parseRocketDraft\(rocketPass\?\.draftTeam\)/);
  assert.match(myTeamsSource, /Entry saved — no action needed/);
  assert.match(myTeamsSource, /do not need to do anything else/);
  assert.match(myTeamsSource, /official initial field has not been published/);
  assert.match(myTeamsSource, /href="\/tournaments\/rocket-classic\/enter"/);
});

test("My Teams renders the saved provisional team and all five picks", () => {
  assert.match(myTeamsSource, /Saved Rocket entry/);
  assert.match(myTeamsSource, /\{rocketDraft\.teamName\}/);
  assert.match(myTeamsSource, /rocketDraftPicks\.map/);
  assert.match(myTeamsSource, /\{pick\.playerName\}/);
  assert.match(myTeamsSource, /fieldRelative/);
  assert.match(myTeamsSource, /No action needed/);
  assert.match(myTeamsSource, /Saved now/);
  assert.match(myTeamsSource, /Field checked Monday/);
  assert.match(myTeamsSource, /Official automatically/);
  assert.match(myTeamsSource, /official automatically after Monday/);
});

test("My Teams changes its Rocket action when the reviewed field opens", () => {
  assert.match(myTeamsSource, /rocketFieldReady/);
  assert.match(myTeamsSource, /rocketProvisionalFieldReady/);
  assert.match(myTeamsSource, /Build Rocket team →/);
  assert.match(myTeamsSource, /Start provisional draft →/);
  assert.match(myTeamsSource, /View entry status →/);
  assert.match(myTeamsSource, /PendingLinkLabel/);
  assert.match(myTeamsSource, /Opening your draft…/);
});
