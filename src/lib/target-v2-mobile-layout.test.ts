import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const previewSource = readFileSync(
  new URL("../app/target-v2-preview/TargetV2PreviewClient.tsx", import.meta.url),
  "utf8",
);
const courseMapSource = readFileSync(
  new URL("../app/target/CourseMap.tsx", import.meta.url),
  "utf8",
);

test("immersive mobile map and detail column explicitly fill the Safari viewport", () => {
  assert.match(
    previewSource,
    /className="flex min-h-0 w-full flex-1 flex-col bg-\[#071f16\]/,
  );
  assert.doesNotMatch(
    previewSource,
    /className="shrink-0 self-start bg-\[#071f16\]/,
  );
});

test("full shot information uses the remaining mobile height and scrolls internally", () => {
  assert.match(
    previewSource,
    /min-h-0 flex-1 overflow-y-auto overscroll-contain/,
  );
  assert.match(previewSource, /\{scenario\.question\}/);
  assert.match(previewSource, /MetricGrid metrics=\{scenario\.metrics\} compact/);
  assert.match(previewSource, /\{scenario\.summary\}/);
  assert.match(previewSource, /scenario\.details\.map/);
});

test("each decision resets the mobile shot information to the beginning", () => {
  assert.match(previewSource, /const detailPanelRef = useRef<HTMLDivElement>\(null\)/);
  assert.match(
    previewSource,
    /detailPanelRef\.current\.scrollTop = 0;[\s\S]*\[currentScenario\]/,
  );
  assert.match(previewSource, /ref=\{detailPanelRef\}/);
});

test("real decisions do not repeat the practice placement bubble", () => {
  assert.match(previewSource, /showPlacementHint=\{false\}/);
  assert.match(courseMapSource, /showPlacementHint &&[\s\S]*Tap the map to place/);
});

test("completion leads with the Test Pass handoff and collapses read-only detail", () => {
  const handoffIndex = previewSource.indexOf("Live test-flight handoff");
  const reviewIndex = previewSource.indexOf("Review my three decisions");
  assert.ok(handoffIndex >= 0);
  assert.ok(reviewIndex > handoffIndex);
  assert.match(previewSource, /Build my Rocket team →/);
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
