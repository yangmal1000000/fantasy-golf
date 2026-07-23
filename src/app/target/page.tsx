import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SignInPrompt from "@/components/SignInPrompt";
import { getCurrentUser } from "@/lib/auth";
import { getRocketBetaStateForUser } from "@/lib/rocket-beta";
import TargetV2Client from "../target-v2-preview/TargetV2PreviewClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Target Challenge — Rocket Classic Test Flight",
  description: "Complete three golf decisions to unlock a free Rocket Classic Test Pass.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function TargetPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <SignInPrompt
        title="Join the Rocket test flight"
        message="Continue with Google, complete Target and receive one free account-bound Test Pass."
      />
    );
  }

  const state = await getRocketBetaStateForUser(user);
  if (!state.approved) notFound();

  return <TargetV2Client />;
}
