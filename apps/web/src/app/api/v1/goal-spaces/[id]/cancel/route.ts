/**
 * POST /api/v1/goal-spaces/:id/cancel — cancel a draft or active goal space.
 *
 * Per docs/specs/interface_spec.md § 3.7.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { readJsonBody, requireString } from "@/lib/api/request";
import { apiError, apiOk } from "@/lib/api/response";
import { requireInitiator } from "@/lib/api/actor";
import { cancelGoalSpaceService } from "@/lib/services/goal-spaces";

interface CancelBody {
  reason?: unknown;
}

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireInitiator(request);
    const { id } = await context.params;
    const body = await readJsonBody<CancelBody>(request);
    const reason = requireString(body.reason, "reason");
    return apiOk(cancelGoalSpaceService(id, actor, reason));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
