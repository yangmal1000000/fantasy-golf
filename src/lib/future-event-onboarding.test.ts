import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relativePath: string) {
  return readFileSync(new URL(relativePath, import.meta.url), "utf8");
}

const page = source("../app/next-event/page.tsx");
const optIn = source("../components/NextEventNotificationOptIn.tsx");
const browserPush = source("./browser-push.ts");
const pushRegistration = source("../components/PushRegistration.tsx");
const home = source("../app/page.tsx");
const layout = source("../app/layout.tsx");
const sitemap = source("../app/sitemap.ts");

test("the next-event preview never invents an event or open entry", () => {
  assert.match(page, /The event, course and dates have not been announced/);
  assert.match(page, /Event" value="To be announced/);
  assert.match(page, /Dates" value="Not confirmed/);
  assert.match(page, /No event entry is open/);
  assert.match(page, /Lifecycle checks first/);
  assert.doesNotMatch(page, /Join the next event/);
});

test("notification permission requires a signed-in explicit click", () => {
  const enableFunction = optIn.indexOf("async function enableAlerts");
  const signedInGate = optIn.indexOf("if (!user)", enableFunction);
  const permissionRequest = optIn.indexOf(
    "window.Notification.requestPermission()",
    enableFunction,
  );
  assert.ok(enableFunction >= 0);
  assert.ok(signedInGate > enableFunction);
  assert.ok(permissionRequest > signedInGate);
  assert.match(optIn, /onClick=\{enableAlerts\}/);
  assert.doesNotMatch(pushRegistration, /requestPermission/);
  assert.doesNotMatch(browserPush, /requestPermission/);
});

test("browser alerts expose accurate success, denial, failure and opt-out states", () => {
  assert.match(optIn, /Event alerts are on for this browser/);
  assert.match(optIn, /Notifications are blocked in this browser/);
  assert.match(optIn, /Event alerts are temporarily unavailable/);
  assert.match(optIn, /We could not finish the subscription/);
  assert.match(optIn, /Turn off on this browser/);
  assert.match(optIn, /No alert is sent now/);
  assert.match(browserPush, /\/api\/push\/subscribe/);
  assert.match(browserPush, /\/api\/push\/unsubscribe/);
  assert.match(browserPush, /credentials: "same-origin"/);
  assert.match(browserPush, /fantasy-golf-push-opted-out/);
  assert.match(browserPush, /input\?\.explicit/);
  assert.match(pushRegistration, /syncCurrentBrowserPush\(\{ explicit: true \}\)/);
});

test("the completed journey leads to the future event without hiding Rocket", () => {
  assert.match(home, /href="\/next-event"/);
  assert.match(home, /Prepare for the next test/);
  assert.match(page, /\/tournaments\/rocket-classic\/leaderboard/);
  assert.match(layout, /Target judgement meets five-player test flights/);
  assert.doesNotMatch(layout, /Rocket Classic free test flight/);
  assert.match(sitemap, /\/next-event/);
});
