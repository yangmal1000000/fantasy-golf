import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isTargetPreviewAllowed } from "@/lib/target-preview-access";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return NextResponse.json(
    { allowed: isTargetPreviewAllowed(user?.email) },
    {
      headers: {
        "Cache-Control": "private, no-store, max-age=0",
        Vary: "Cookie",
      },
    },
  );
}
