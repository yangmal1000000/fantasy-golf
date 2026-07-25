import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), "utf8");
}

const middleware = source("../middleware.ts");
const rootLayout = source("../app/layout.tsx");
const routeShell = source("../components/RouteShell.tsx");
const adminLayout = source("../app/admin/layout.tsx");
const adminSidebar = source("../app/admin/components/AdminSidebar.tsx");
const targetControl = source("../app/api/target-control/route.ts");
const targetJudge = source("../app/api/target-judge/route.ts");
const targetPilot = source("../app/api/target-pilot-entry/route.ts");
const targetJudgePage = source("../app/target-judge/page.tsx");
const rocketBeta = source("./rocket-beta.ts");
const operationalJobs = source("./operational-jobs.ts");
const resultsSync = source("../app/api/sync/results/route.ts");
const rankingsSync = source("../app/api/sync/rankings/route.ts");
const scheduleSync = source("../app/api/sync/schedule/route.ts");
const push = source("./push.ts");
const heartbeatRoute = source("../app/api/ops/heartbeat/route.ts");

test("private Target request paths never run schema DDL", () => {
  for (const file of [
    targetControl,
    targetJudge,
    targetPilot,
    targetJudgePage,
    rocketBeta,
  ]) {
    assert.doesNotMatch(file, /ensureTargetJudgeSchema|ensureRocketBetaSchema/);
    assert.doesNotMatch(file, /\$executeRaw/);
  }
});

test("legacy admin pages are unavailable even to an Owner", () => {
  assert.match(middleware, /quarantinedLegacyAdminPage/);
  for (const legacyPath of [
    "/admin/auto-subs",
    "/admin/blog",
    "/admin/data",
    "/admin/revenue",
    "/admin/season",
    "/admin/settings",
    "/admin/tournaments",
  ]) {
    assert.match(middleware, new RegExp(legacyPath.replace("/", "\\/")));
  }
  assert.match(
    middleware,
    /if \(quarantinedLegacyAdminPage\)[\s\S]*status: 404/,
  );
});

test("Target Control is protected before its private shell renders", () => {
  assert.match(
    middleware,
    /pathname === "\/target-control"/,
  );
  assert.match(
    middleware,
    /protectedPage[\s\S]*isEdgeAdminPathAllowed/,
  );
});

test("admin routes use a private shell and noindex metadata", () => {
  assert.match(rootLayout, /RouteShell/);
  assert.match(routeShell, /pathname\.startsWith\("\/admin\/"\)/);
  assert.match(routeShell, /if \(isAdminRoute\) return children/);
  assert.match(adminLayout, /Operations — Fantasy Golf/);
  assert.match(
    adminLayout,
    /robots: \{ index: false, follow: false, nocache: true \}/,
  );
});

test("the mobile admin drawer is rendered only while open and handles focus", () => {
  assert.match(adminSidebar, /\{mobileOpen && \(/);
  assert.match(adminSidebar, /event\.key === "Escape"/);
  assert.match(adminSidebar, /event\.key !== "Tab"/);
  assert.match(adminSidebar, /aria-modal="true"/);
  assert.match(adminSidebar, /openButtonRef\.current\?\.focus/);
});

test("every scheduled Rocket operations lane has a truthful heartbeat contract", () => {
  for (const jobKey of [
    "rocket-field-reconciliation",
    "rocket-live-scoring",
    "tournament-results-sync",
    "world-ranking-sync",
    "tournament-schedule-sync",
    "push-delivery",
    "openclaw-field-watcher",
    "openclaw-field-delay-warning",
    "openclaw-field-manual-review",
    "openclaw-live-first-run-check",
    "openclaw-live-cleanup",
  ]) {
    assert.match(operationalJobs, new RegExp(jobKey));
  }
  for (const route of [resultsSync, rankingsSync, scheduleSync]) {
    assert.match(route, /beginOperationalRun/);
    assert.match(route, /completeOperationalRun/);
    assert.match(route, /status: "FAILED"/);
  }
  assert.match(push, /key: "push-delivery"/);
  assert.match(push, /status: failed > 0 \? "FAILED" : "SUCCESS"/);
});

test("OpenClaw heartbeat callbacks are signed, bounded and allowlisted", () => {
  assert.match(heartbeatRoute, /isAuthorizedOpsHeartbeat/);
  assert.match(heartbeatRoute, /MAX_BODY_BYTES = 4_096/);
  assert.match(heartbeatRoute, /contract\.source !== "openclaw"/);
  assert.match(heartbeatRoute, /recordOperationalRun/);
  assert.doesNotMatch(heartbeatRoute, /actorEmail|request\.text\(/);
});
