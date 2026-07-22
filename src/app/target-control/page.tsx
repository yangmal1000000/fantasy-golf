import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SignInPrompt from "@/components/SignInPrompt";
import { isTargetJudgeCoordinator } from "@/lib/target-judge-access";
import { getVerifiedTargetEmail } from "@/lib/target-judge-server";
import TargetControlClient from "./TargetControlClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Private Target Control — Fantasy Golf",
  description: "Private control and audit view for the Target judging rehearsal.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function TargetControlPage() {
  const email = await getVerifiedTargetEmail();
  if (!email) {
    return (
      <SignInPrompt
        title="Private Target control"
        message="Sign in with the coordinator account to manage this rehearsal."
      />
    );
  }
  if (!isTargetJudgeCoordinator(email)) notFound();

  return <TargetControlClient />;
}
