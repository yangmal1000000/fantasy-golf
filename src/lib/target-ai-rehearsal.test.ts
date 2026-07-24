import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const controlRoute = readFileSync(
  new URL("../app/api/target-control/route.ts", import.meta.url),
  "utf8",
);
const controlPage = readFileSync(
  new URL("../app/target-control/TargetControlClient.tsx", import.meta.url),
  "utf8",
);
const judgePage = readFileSync(
  new URL("../app/target-judge/TargetJudgeClient.tsx", import.meta.url),
  "utf8",
);

test("AI rehearsal assignments are synthetic, disclosed and auditable", () => {
  assert.match(controlRoute, /TARGET_AI_REHEARSAL_PERSPECTIVES\.map/);
  assert.match(controlRoute, /@fantasy-golf\.invalid/);
  assert.match(controlRoute, /independentPanel: false/);
  assert.match(controlRoute, /source: "gombot_ai"/);
  assert.match(controlRoute, /perspectives: TARGET_AI_REHEARSAL_PERSPECTIVES/);
});

test("coordinator and judge screens never present the AI rehearsal as an independent panel", () => {
  assert.match(controlPage, /Three-perspective AI rehearsal/);
  assert.match(controlPage, /not an independent human or PGA panel result/);
  assert.match(judgePage, /three independent people or PGA judging/);
  assert.match(judgePage, /assignment\.displayName/);
});
