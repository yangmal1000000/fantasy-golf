import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SignInPrompt from "@/components/SignInPrompt";
import { prisma } from "@/lib/prisma";
import { isTargetJudgeCoordinator } from "@/lib/target-judge-access";
import { TARGET_JUDGE_ROUND_SLUG } from "@/lib/target-judge-core";
import { ensureTargetJudgeSchema } from "@/lib/target-judge-schema";
import { getVerifiedTargetEmail } from "@/lib/target-judge-server";
import TargetJudgeClient from "./TargetJudgeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Private Judge Mode — Fantasy Golf",
  description: "Private blind judging rehearsal for the Golf Target Challenge.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function TargetJudgePage() {
  const email = await getVerifiedTargetEmail();
  if (!email) {
    return (
      <SignInPrompt
        title="Private Target judge access"
        message="Sign in with the exact Google account assigned to the judging panel."
      />
    );
  }

  await ensureTargetJudgeSchema();
  const round = await prisma.targetJudgingRound.findUnique({
    where: { slug: TARGET_JUDGE_ROUND_SLUG },
    select: { panelMode: true },
  });
  if (isTargetJudgeCoordinator(email) && round?.panelMode === "COORDINATOR_REHEARSAL") {
    return <TargetJudgeClient rehearsal />;
  }
  const assignment = await prisma.targetJudgeAssignment.findFirst({
    where: { email, round: { slug: TARGET_JUDGE_ROUND_SLUG } },
    select: { id: true },
  });
  if (!assignment) {
    if (!isTargetJudgeCoordinator(email)) notFound();
    return <TargetJudgeClient sandbox />;
  }

  return <TargetJudgeClient />;
}
