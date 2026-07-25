import { NextResponse } from "next/server";
import { isAuthorizedOpsHeartbeat } from "@/lib/ops-heartbeat-auth";
import {
  operationalJobContract,
  recordOperationalRun,
} from "@/lib/operational-jobs";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4_096;
const ALLOWED_STATUSES = new Set(["SUCCESS", "FAILED", "SKIPPED"]);

export async function POST(request: Request) {
  if (
    !isAuthorizedOpsHeartbeat(
      request.headers.get("authorization"),
      process.env.OPS_HEARTBEAT_SECRET,
    )
  ) {
    return noStoreJson({ error: "Not found" }, { status: 404 });
  }
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BODY_BYTES) {
    return noStoreJson({ error: "Payload too large" }, { status: 413 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return noStoreJson({ error: "JSON required" }, { status: 415 });
  }

  const body = (await request.json().catch(() => null)) as {
    jobKey?: unknown;
    status?: unknown;
    summary?: unknown;
    recordsProcessed?: unknown;
  } | null;
  if (
    typeof body?.jobKey !== "string" ||
    typeof body.status !== "string" ||
    !ALLOWED_STATUSES.has(body.status)
  ) {
    return noStoreJson({ error: "Invalid heartbeat" }, { status: 400 });
  }
  const contract = operationalJobContract(body.jobKey);
  if (!contract || contract.source !== "openclaw") {
    return noStoreJson({ error: "Unknown job" }, { status: 400 });
  }
  const status = body.status as "SUCCESS" | "FAILED" | "SKIPPED";
  const summary =
    typeof body.summary === "string" ? body.summary.slice(0, 240) : undefined;
  const recordsProcessed =
    typeof body.recordsProcessed === "number" &&
    Number.isFinite(body.recordsProcessed)
      ? Math.max(0, Math.trunc(body.recordsProcessed))
      : undefined;
  const recorded = await recordOperationalRun(
    contract,
    "openclaw-callback",
    {
      status,
      recordsProcessed,
      summary: status === "FAILED" ? undefined : summary,
      errorSummary: status === "FAILED" ? summary ?? "OpenClaw job failed" : undefined,
    },
  );
  if (!recorded) {
    return noStoreJson({ error: "Heartbeat unavailable" }, { status: 503 });
  }
  return noStoreJson({ ok: true });
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
