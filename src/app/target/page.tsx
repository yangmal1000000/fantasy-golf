import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import SignInPrompt from "@/components/SignInPrompt";
import { isRocketBetaEmailApproved } from "@/lib/rocket-beta";
import { createClient } from "@/utils/supabase/server";
import TargetChallengeClient from "./TargetChallengeClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Private Target Challenge Preview — Fantasy Golf",
  description: "Private review build of the Golf Target Challenge prototype.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function TargetPreviewPage() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) {
    return (
      <SignInPrompt
        title="Private Target Challenge preview"
        message="Sign in with the approved Google account to open this preview."
      />
    );
  }

  if (!(await isRocketBetaEmailApproved(user.email))) {
    notFound();
  }

  return <TargetChallengeClient />;
}
