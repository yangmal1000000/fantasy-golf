import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Target — Fantasy Golf",
  description: "Complete Target to unlock your Rocket Classic Test Pass.",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

export default async function TargetV2PreviewPage() {
  redirect("/target");
}
