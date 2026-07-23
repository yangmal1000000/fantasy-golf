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

test("immersive mobile map wrapper explicitly fills Safari viewport width", () => {
  assert.match(
    previewSource,
    /className="w-full shrink-0 bg-\[#071f16\] sm:p-5"/,
  );
  assert.doesNotMatch(
    previewSource,
    /className="shrink-0 self-start bg-\[#071f16\]/,
  );
});

test("folded shot facts render directly below the map and before controls", () => {
  const belowMap = courseMapSource.indexOf("{mobileBelowMap}");
  const controls = courseMapSource.indexOf("interactive && point && onChange");

  assert.ok(belowMap > 0);
  assert.ok(controls > belowMap);
  assert.match(previewSource, /Full details/);
  assert.match(previewSource, /\{scenario\.summary\}/);
});
