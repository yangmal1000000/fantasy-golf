import { NextResponse } from "next/server";
import fieldManifestJson from "../../../../../data/rocket-classic-2026-field.provisional.json";
import { adminApiGuard } from "@/lib/admin-auth";
import {
  type FieldManifest,
  RocketFieldError,
  stageRocketBetaField,
} from "@/lib/rocket-field-freeze";
import {
  beginOperationalRun,
  completeOperationalRun,
} from "@/lib/operational-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  const denied = await adminApiGuard(request, { allowCron: true });
  if (denied) return denied;
  const run = await beginOperationalRun(
    {
      key: "rocket-field-reconciliation",
      name: "Rocket final-field reconciliation",
      source: "github-actions",
    },
    "signed-field-endpoint",
  );

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
    await completeOperationalRun(run, {
      status: "SUCCESS",
      recordsProcessed: result.playerCount,
      summary: `${body.mode}: ${result.sourceStatus}; ${result.draftChanges} draft changes`,
    });
    return noStoreJson(result);
  } catch (error) {
    await completeOperationalRun(run, {
      status: "FAILED",
      errorSummary:
        error instanceof RocketFieldError
          ? error.message
          : "Rocket field verification failed",
    });
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
