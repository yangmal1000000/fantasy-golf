import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getRocketBetaStateForUser } from "@/lib/rocket-beta";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const user = await getCurrentUser();
  const allowed = user
    ? (await getRocketBetaStateForUser(user)).approved
    : false;

  return NextResponse.json(
    { allowed },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    },
  );
}
