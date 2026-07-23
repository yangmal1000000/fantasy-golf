import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const targetSource = readFileSync(
  new URL("../app/target-v2-preview/TargetV2PreviewClient.tsx", import.meta.url),
  "utf8",
);
const courseMapSource = readFileSync(
  new URL("../app/target/CourseMap.tsx", import.meta.url),
  "utf8",
);

test("immersive mobile map and detail column explicitly fill the Safari viewport", () => {
  assert.match(
    targetSource,
    /className="flex min-h-0 w-full flex-1 flex-col bg-\[#071f16\]/,
  );
  assert.doesNotMatch(
    targetSource,
    /className="shrink-0 self-start bg-\[#071f16\]/,
  );
});

test("full shot information uses the remaining mobile height and scrolls internally", () => {
  assert.match(
    targetSource,
    /min-h-0 flex-1 overflow-y-auto overscroll-contain/,
  );
  assert.match(targetSource, /\{scenario\.question\}/);
  assert.match(targetSource, /MetricGrid metrics=\{scenario\.metrics\} compact/);
  assert.match(targetSource, /\{scenario\.summary\}/);
  assert.match(targetSource, /scenario\.details\.map/);
});

test("each decision resets the mobile shot information to the beginning", () => {
  assert.match(targetSource, /const detailPanelRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(
    targetSource,
    /detailPanelRef\.current\.scrollTop = 0;[\s\S]*\[currentScenario\]/,
  );
  assert.match(targetSource, /ref=\{detailPanelRef\}/);
});

test("real decisions do not repeat the practice placement bubble", () => {
  assert.match(targetSource, /showPlacementHint=\{false\}/);
  assert.match(courseMapSource, /showPlacementHint &&[\s\S]*Tap the map to place/);
});

test("completion leads with the Test Pass handoff and collapses read-only detail", () => {
  const handoffIndex = targetSource.indexOf("Test-flight handoff");
  const reviewIndex = targetSource.indexOf("Review my three decisions");
  assert.ok(handoffIndex >= 0);
  assert.ok(reviewIndex > handoffIndex);
  assert.match(targetSource, /Build my Rocket team →/);
});

test("the promoted Target submits v2 points and confirms the locked entry", () => {
  assert.match(targetSource, /fetch\("\/api\/target-pilot-entry"/);
  assert.match(targetSource, /method: "POST"/);
  assert.match(targetSource, /TARGET_V2_SCENARIOS\.map/);
  assert.match(targetSource, /setEntryReference\(status\.entry\.reference\)/);
  assert.match(targetSource, /Submit Target/);
  assert.doesNotMatch(targetSource, /Complete preview|Nothing saved|preview only/i);
});

test("immersive fine adjustment is overlaid in the map's lower-left corner", () => {
  assert.match(
    courseMapSource,
    /absolute bottom-2 left-2 z-30 grid grid-cols-3/,
  );
  assert.match(courseMapSource, /onPointerDown=\{\(event\) => event\.stopPropagation\(\)\}/);
  assert.match(courseMapSource, /overlay[\s\S]*Move \$\{markerTerm\} up/);
  assert.match(courseMapSource, /Move \$\{markerTerm\} left[\s\S]*overlay/);
  assert.match(courseMapSource, /Move \$\{markerTerm\} down[\s\S]*overlay/);
  assert.match(courseMapSource, /Move \$\{markerTerm\} right[\s\S]*overlay/);
});
