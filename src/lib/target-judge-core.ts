import {
  TARGET_SCENARIOS,
  geometricMedianTarget,
  type TargetPoint,
} from "@/lib/target-challenge";

export const TARGET_JUDGE_ROUND_SLUG = "hawthorn-vale-mvp-1";
export const TARGET_SCENARIO_VERSION = "hawthorn-vale-mvp-1.0";
export const TARGET_JUDGE_STATUSES = [
  "DRAFT",
  "INITIAL_MARKING",
  "INITIAL_COMPLETE",
  "FINAL_MARKING",
  "CALCULATED",
] as const;

export type TargetJudgeStatus = (typeof TARGET_JUDGE_STATUSES)[number];
export type TargetJudgePhase = "initial" | "final";

export interface TargetJudgeMark {
  scenarioId: string;
  point: TargetPoint;
  rationale: string;
}

export interface TargetJudgeSubmission {
  marks: TargetJudgeMark[];
}

export interface TargetJudgePanelMember {
  email: string;
  displayName: string;
  credential: string;
}

export interface TargetOfficialTargetsRecord {
  algorithm: "weiszfeld-map-v1";
  targets: Array<{ scenarioId: string; point: TargetPoint }>;
}

export interface TargetJudgeAssignmentDto {
  id: string;
  seat: number;
  email?: string;
  displayName: string;
  credential: string;
  declarationConfirmedAt: string | null;
  initialLockedAt: string | null;
  finalLockedAt: string | null;
  initialSubmission?: TargetJudgeSubmission | null;
  finalSubmission?: TargetJudgeSubmission | null;
}

export interface TargetJudgeRoundDto {
  id: string;
  slug: string;
  name: string;
  scenarioVersion: string;
  scenarioHash: string;
  status: TargetJudgeStatus;
  officialTargets: TargetOfficialTargetsRecord | null;
  officialTargetsHash: string | null;
  calculatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TargetJudgeAuditDto {
  id: string;
  actorEmail: string;
  action: string;
  payload: unknown;
  createdAt: string;
}

export interface TargetJudgeControlDto {
  round: TargetJudgeRoundDto | null;
  assignments: TargetJudgeAssignmentDto[];
  auditEvents: TargetJudgeAuditDto[];
}

export interface TargetJudgeContextDto {
  round: TargetJudgeRoundDto;
  assignment: TargetJudgeAssignmentDto;
  panelInitial: TargetJudgeAssignmentDto[] | null;
  panelFinal: TargetJudgeAssignmentDto[] | null;
}

export function isTargetJudgeStatus(value: string): value is TargetJudgeStatus {
  return TARGET_JUDGE_STATUSES.includes(value as TargetJudgeStatus);
}

export function validateTargetJudgePanel(value: unknown): TargetJudgePanelMember[] {
  if (!Array.isArray(value) || value.length !== 3) {
    throw new Error("Exactly three primary judges are required");
  }

  const emails = new Set<string>();
  return value.map((member): TargetJudgePanelMember => {
    if (!member || typeof member !== "object") throw new Error("Invalid judge record");
    const candidate = member as {
      email?: unknown;
      displayName?: unknown;
      credential?: unknown;
    };
    const email = typeof candidate.email === "string" ? candidate.email.trim().toLowerCase() : "";
    const displayName = typeof candidate.displayName === "string" ? candidate.displayName.trim() : "";
    const credential = typeof candidate.credential === "string" ? candidate.credential.trim() : "";

    if (!/^\S+@\S+\.\S+$/.test(email)) throw new Error("Every judge needs a valid email address");
    if (emails.has(email)) throw new Error("Judge email addresses must be unique");
    emails.add(email);
    if (displayName.length < 2 || displayName.length > 100) {
      throw new Error("Every judge needs a display name");
    }
    if (credential.length < 5 || credential.length > 200) {
      throw new Error("Every judge needs a short credential description");
    }

    return { email, displayName, credential };
  });
}

export function validateJudgeSubmission(value: unknown): TargetJudgeSubmission {
  if (!value || typeof value !== "object") {
    throw new Error("A complete judge submission is required");
  }

  const marks = (value as { marks?: unknown }).marks;
  if (!Array.isArray(marks) || marks.length !== TARGET_SCENARIOS.length) {
    throw new Error(`Exactly ${TARGET_SCENARIOS.length} scenario marks are required`);
  }

  const expectedIds = new Set(TARGET_SCENARIOS.map((scenario) => scenario.id));
  const seen = new Set<string>();
  const validated = marks.map((mark): TargetJudgeMark => {
    if (!mark || typeof mark !== "object") throw new Error("Invalid scenario mark");
    const candidate = mark as {
      scenarioId?: unknown;
      point?: { x?: unknown; y?: unknown };
      rationale?: unknown;
    };
    if (typeof candidate.scenarioId !== "string" || !expectedIds.has(candidate.scenarioId)) {
      throw new Error("Submission contains an unknown scenario");
    }
    if (seen.has(candidate.scenarioId)) throw new Error("Each scenario may be marked only once");
    seen.add(candidate.scenarioId);

    const x = candidate.point?.x;
    const y = candidate.point?.y;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      x > 100_000 ||
      y < 0 ||
      y > 100_000
    ) {
      throw new Error("Every mark needs a valid target coordinate");
    }

    if (typeof candidate.rationale !== "string") throw new Error("Every mark needs a rationale");
    const rationale = candidate.rationale.trim();
    if (rationale.length < 40 || rationale.length > 1_000) {
      throw new Error("Each rationale must be between 40 and 1,000 characters");
    }

    return { scenarioId: candidate.scenarioId, point: { x, y }, rationale };
  });

  return {
    marks: TARGET_SCENARIOS.map((scenario) =>
      validated.find((mark) => mark.scenarioId === scenario.id),
    ).filter((mark): mark is TargetJudgeMark => Boolean(mark)),
  };
}

export function calculateOfficialTargets(
  submissions: readonly TargetJudgeSubmission[],
): TargetPoint[] {
  if (submissions.length !== 3) {
    throw new Error("Exactly three final judge submissions are required");
  }
  const validated = submissions.map(validateJudgeSubmission);

  return TARGET_SCENARIOS.map((scenario) => {
    const points = validated.map((submission) => {
      const mark = submission.marks.find((item) => item.scenarioId === scenario.id);
      if (!mark) throw new Error(`Missing final mark for ${scenario.id}`);
      return mark.point;
    });
    return geometricMedianTarget(points);
  });
}

export function validateOfficialTargetsRecord(value: unknown): TargetOfficialTargetsRecord {
  if (!value || typeof value !== "object") throw new Error("Official targets are missing");
  const candidate = value as { algorithm?: unknown; targets?: unknown };
  if (candidate.algorithm !== "weiszfeld-map-v1" || !Array.isArray(candidate.targets)) {
    throw new Error("Official target record is invalid");
  }
  if (candidate.targets.length !== TARGET_SCENARIOS.length) {
    throw new Error("Official target record is incomplete");
  }
  const expected = new Set(TARGET_SCENARIOS.map((scenario) => scenario.id));
  const seen = new Set<string>();
  const targets = candidate.targets.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Official target is invalid");
    const target = item as { scenarioId?: unknown; point?: { x?: unknown; y?: unknown } };
    if (typeof target.scenarioId !== "string" || !expected.has(target.scenarioId)) {
      throw new Error("Official target contains an unknown scenario");
    }
    if (seen.has(target.scenarioId)) throw new Error("Official target scenarios must be unique");
    seen.add(target.scenarioId);
    const x = target.point?.x;
    const y = target.point?.y;
    if (
      typeof x !== "number" ||
      typeof y !== "number" ||
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      x > 100_000 ||
      y < 0 ||
      y > 100_000
    ) {
      throw new Error("Official target coordinate is invalid");
    }
    return { scenarioId: target.scenarioId, point: { x, y } };
  });

  return {
    algorithm: "weiszfeld-map-v1",
    targets: TARGET_SCENARIOS.map((scenario) =>
      targets.find((target) => target.scenarioId === scenario.id),
    ).filter((target): target is { scenarioId: string; point: TargetPoint } => Boolean(target)),
  };
}
