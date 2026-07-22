import type { Metadata } from "next";
import Link from "next/link";
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
  const assignment = await prisma.targetJudgeAssignment.findFirst({
    where: { email, round: { slug: TARGET_JUDGE_ROUND_SLUG } },
    select: { id: true },
  });
  if (!assignment) {
    if (!isTargetJudgeCoordinator(email)) notFound();

    return (
      <main className="mx-auto flex min-h-[60vh] max-w-2xl items-center px-4 py-12 sm:px-6">
        <section className="w-full rounded-3xl border border-zinc-200 bg-white p-6 text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-10">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-[#9b7b25] dark:text-[#d7bc6a]">
            Coordinator account
          </p>
          <h1 className="mt-3 text-3xl font-black text-zinc-900 dark:text-white">
            No judge assignment
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-sm leading-6 text-zinc-600 dark:text-zinc-300">
            Your account controls the rehearsal but is not one of its independent judges. This separation prevents the coordinator from submitting or altering panel marks.
          </p>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-zinc-500 dark:text-zinc-400">
            Add three judges in Target Control. Each judge must then sign in here with the exact Google email assigned to them.
          </p>
          <Link
            href="/target-control"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#0a3d2a] px-5 py-3 text-sm font-black text-white hover:bg-[#0d5138]"
          >
            Back to Target Control
          </Link>
        </section>
      </main>
    );
  }

  return <TargetJudgeClient />;
}
