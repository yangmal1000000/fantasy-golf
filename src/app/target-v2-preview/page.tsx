import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SignInPrompt from "@/components/SignInPrompt";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import TargetV2PreviewClient from "./TargetV2PreviewClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Target v2 Preview — Fantasy Golf",
  description: "Protected working preview of the finish-position Target experience.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function TargetV2PreviewPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <SignInPrompt
        title="Target v2 working preview"
        message="Sign in with the account that completed the current Target test flight."
      />
    );
  }

  if (!user.isAdmin) {
    const existingEntry = await prisma.targetPilotEntry.findFirst({
      where: { email: user.email.trim().toLowerCase() },
      select: { id: true },
    });
    if (!existingEntry) notFound();
  }

  return <TargetV2PreviewClient />;
}
