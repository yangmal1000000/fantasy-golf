import { NextResponse } from "next/server";
import { adminApiGuard } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const denied = await adminApiGuard(request, { required: "VIEW_DASHBOARD" });
  if (denied) return denied;
  return NextResponse.redirect(new URL("/admin", request.url));
}

export async function HEAD(request: Request) {
  const denied = await adminApiGuard(request, { required: "VIEW_DASHBOARD" });
  if (denied) return denied;
  return new NextResponse(null, { status: 204 });
}
