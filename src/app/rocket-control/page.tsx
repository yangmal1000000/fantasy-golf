import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SignInPrompt from "@/components/SignInPrompt";
import { getCurrentUser } from "@/lib/auth";
import RocketControlClient from "./RocketControlClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Rocket Beta Control — Fantasy Golf",
  robots: { index: false, follow: false, nocache: true },
};

export default async function RocketControlPage() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <SignInPrompt
        title="Rocket beta control"
        message="Sign in with the coordinator account to manage the test flight."
      />
    );
  }
  if (!user.isAdmin) notFound();
  return <RocketControlClient />;
}
