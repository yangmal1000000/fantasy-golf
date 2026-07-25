import type { Metadata } from "next";
import { requireAdminCapability } from "@/lib/admin-session";
import RocketControlClient from "./RocketControlClient";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
  title: "Rocket Beta Control — Fantasy Golf",
  robots: { index: false, follow: false, nocache: true },
};

export default async function RocketControlPage() {
  await requireAdminCapability("OPERATE_TOURNAMENT");
  return <RocketControlClient />;
}
