/**
 * POST /api/v1/goal-spaces/:id/start — start a draft goal space.
 *
 * Per docs/specs/interface_spec.md § 3.5.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { apiError, apiOk } from "@/lib/api/response";
import { requireInitiator } from "@/lib/api/actor";
import { startGoalSpaceService } from "@/lib/services/goal-spaces";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireInitiator(request);
    const { id } = await context.params;
    return apiOk(startGoalSpaceService(id, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
