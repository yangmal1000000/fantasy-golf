const TARGET_JUDGE_COORDINATOR_EMAILS = new Set([
  "yangmal1000000@gmail.com",
]);

export function normaliseTargetEmail(email: string | null | undefined): string {
  return email?.trim().toLowerCase() ?? "";
}

export function isTargetJudgeCoordinator(email: string | null | undefined): boolean {
  return TARGET_JUDGE_COORDINATOR_EMAILS.has(normaliseTargetEmail(email));
}
