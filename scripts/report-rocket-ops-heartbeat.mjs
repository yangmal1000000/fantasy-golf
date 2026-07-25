#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const [jobKey, status, ...summaryParts] = process.argv.slice(2);
const allowedJobs = new Set([
  "openclaw-field-watcher",
  "openclaw-field-delay-warning",
  "openclaw-field-manual-review",
  "openclaw-live-first-run-check",
  "openclaw-live-cleanup",
]);
const allowedStatuses = new Set(["SUCCESS", "FAILED", "SKIPPED"]);

if (!allowedJobs.has(jobKey) || !allowedStatuses.has(status)) {
  process.stderr.write(
    "Usage: report-rocket-ops-heartbeat.mjs <known-job> <SUCCESS|FAILED|SKIPPED> [summary]\n",
  );
  process.exitCode = 2;
} else {
  const secret = execFileSync(
    "security",
    [
      "find-generic-password",
      "-w",
      "-s",
      "openclaw.fantasygolf.ops-heartbeat",
      "-a",
      "fantasy-golf-ops",
    ],
    { encoding: "utf8" },
  ).trim();
  const response = await fetch(
    process.env.FANTASY_GOLF_OPS_URL ??
      "https://fantasy-golf-phi.vercel.app/api/ops/heartbeat",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${secret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobKey,
        status,
        summary: summaryParts.join(" ").trim().slice(0, 240),
      }),
    },
  );
  if (!response.ok) {
    throw new Error(`Operations heartbeat returned HTTP ${response.status}`);
  }
}
