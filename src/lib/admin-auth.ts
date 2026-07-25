import "server-only";

import { NextResponse } from "next/server";
import {
  getAdminActor,
  type AdminActor,
} from "@/lib/admin-session";
import {
  hasAdminCapability,
  type AdminCapability,
} from "@/lib/admin-roles";
import { isAuthorizedCronHeader } from "@/lib/cron-auth";

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

/**
 * Route-handler authorization guard for every admin/sync endpoint.
 * It intentionally returns a generic response so protected route existence and
 * database details are not exposed to unauthenticated callers.
 */
export async function adminApiGuard(
  request?: Request,
  options: {
    allowCron?: boolean;
    required?: AdminCapability;
  } = {},
): Promise<NextResponse | null> {
  const result = await adminApiActor(request, options);
  return result.denied;
}

export async function adminApiActor(
  request?: Request,
  options: {
    allowCron?: boolean;
    required?: AdminCapability;
  } = {},
): Promise<{ actor: AdminActor | null; denied: NextResponse | null }> {
  if (request && options.allowCron && isAuthorizedCronRequest(request)) {
    return { actor: null, denied: null };
  }
  if (request && !sameOrigin(request)) {
    return {
      actor: null,
      denied: NextResponse.json(
        { error: "Request origin rejected" },
        { status: 403 },
      ),
    };
  }

  const actor = await getAdminActor();
  if (!actor) {
    return {
      actor: null,
      denied: NextResponse.json(
        { error: "Authentication required" },
        { status: 401 },
      ),
    };
  }
  const required = options.required ?? "OPERATE_TOURNAMENT";
  if (!hasAdminCapability(actor.role, required)) {
    return {
      actor: null,
      denied: NextResponse.json(
        { error: "Admin access required" },
        { status: 403 },
      ),
    };
  }

  return { actor, denied: null };
}

function isAuthorizedCronRequest(request: Request) {
  return isAuthorizedCronHeader(
    request.headers.get("authorization"),
    process.env.CRON_SECRET,
  );
}
