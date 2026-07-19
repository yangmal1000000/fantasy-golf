import { getCurrentUserId } from "@/lib/auth";
import DailyPredictionClient from "./DailyPredictionClient";

export const dynamic = "force-dynamic";

export default async function DailyPredictionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const userId = await getCurrentUserId();
  return <DailyPredictionClient tournamentId={id} currentUserId={userId} />;
}
