import { NextResponse } from "next/server";
import fieldManifestJson from "../../../../../data/rocket-classic-2026-field.provisional.json";
import { adminApiGuard } from "@/lib/admin-auth";
import {
  type FieldManifest,
  RocketFieldError,
  stageRocketBetaField,
} from "@/lib/rocket-field-freeze";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  const denied = await adminApiGuard(request, { allowCron: true });
  if (denied) return denied;

  try {
    const body = (await request.json()) as { mode?: unknown };
    if (
      body.mode !== "dry-run" &&
      body.mode !== "apply" &&
      body.mode !== "freeze"
    ) {
      throw new RocketFieldError("Mode must be dry-run, apply or freeze", 400);
    }
    const result = await stageRocketBetaField(
      fieldManifestJson as FieldManifest,
      body.mode,
    );
    return noStoreJson(result);
  } catch (error) {
    if (error instanceof RocketFieldError) {
      return noStoreJson(
        { ok: false, error: error.message },
        { status: error.status },
      );
    }
    console.error("sync/rocket-field error:", error);
    return noStoreJson(
      { ok: false, error: "Rocket field verification failed" },
      { status: 500 },
    );
  }
}

function noStoreJson(data: unknown, init?: ResponseInit) {
  return NextResponse.json(data, {
    ...init,
    headers: {
      "Cache-Control": "private, no-store, max-age=0",
      ...init?.headers,
    },
  });
}
