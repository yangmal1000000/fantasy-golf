import "server-only";

import { createHash } from "node:crypto";
import { cookies } from "next/headers";
import { TARGET_MAP_HEIGHT, TARGET_MAP_WIDTH, TARGET_SCENARIOS } from "@/lib/target-challenge";
import {
  isTargetJudgeCoordinator,
  normaliseTargetEmail,
} from "@/lib/target-judge-access";
import {
  TARGET_SCENARIO_VERSION,
  type TargetJudgeSubmission,
} from "@/lib/target-judge-core";
import type {
  TargetPilotResultsRecord,
  TargetPilotSubmission,
} from "@/lib/target-pilot-core";
import { createClient } from "@/utils/supabase/server";

export class TargetJudgeAccessError extends Error {
  constructor(
    message: string,
    public readonly status: 401 | 403 | 404 = 403,
  ) {
    super(message);
  }
}

export async function getVerifiedTargetEmail(): Promise<string | null> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = normaliseTargetEmail(user?.email);
  return email || null;
}

export async function requireTargetJudgeCoordinator(): Promise<string> {
  const email = await getVerifiedTargetEmail();
  if (!email) throw new TargetJudgeAccessError("Sign in required", 401);
  if (!isTargetJudgeCoordinator(email)) {
    throw new TargetJudgeAccessError("Coordinator access required", 404);
  }
  return email;
}

export function targetScenarioHash(): string {
  return sha256({
    scenarioVersion: TARGET_SCENARIO_VERSION,
    coordinateSpace: { width: TARGET_MAP_WIDTH, height: TARGET_MAP_HEIGHT },
    scenarios: TARGET_SCENARIOS,
  });
}

export function targetOfficialTargetsHash(input: {
  scenarioHash: string;
  finalSubmissions: Array<{ seat: number; submission: TargetJudgeSubmission }>;
  officialTargets: unknown;
}): string {
  return sha256({
    algorithm: "weiszfeld-map-v1",
    scenarioHash: input.scenarioHash,
    finalSubmissions: [...input.finalSubmissions].sort((a, b) => a.seat - b.seat),
    officialTargets: input.officialTargets,
  });
}

export function targetPilotSubmissionHash(input: {
  scenarioHash: string;
  email: string;
  submission: TargetPilotSubmission;
}): string {
  return sha256({
    version: "target-pilot-submission-v1",
    scenarioHash: input.scenarioHash,
    email: input.email,
    submission: input.submission,
  });
}

export function targetPilotEntrySetHash(input: {
  scenarioHash: string;
  entries: Array<{ email: string; submissionHash: string }>;
}): string {
  return sha256({
    version: "target-pilot-entry-set-v1",
    scenarioHash: input.scenarioHash,
    entries: [...input.entries].sort((a, b) => a.email.localeCompare(b.email)),
  });
}

export function targetPilotResultsHash(input: {
  scenarioHash: string;
  entrySetHash: string;
  officialTargetsHash: string;
  results: TargetPilotResultsRecord;
}): string {
  return sha256({
    version: "target-pilot-results-v1",
    scenarioHash: input.scenarioHash,
    entrySetHash: input.entrySetHash,
    officialTargetsHash: input.officialTargetsHash,
    results: input.results,
  });
}

function sha256(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
