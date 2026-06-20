/**
 * GET /api/v1/execute/:taskId — read the status of a previously-queued execution.
 *
 * Per docs/specs/interface_spec.md § 7.2.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { apiError, apiOk } from "@/lib/api/response";
import { requireActor } from "@/lib/api/actor";
import { getExecutionStatusService } from "@/lib/services/executions";

interface RouteContext {
  readonly params: Promise<{ taskId: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { taskId } = await context.params;
    return apiOk(getExecutionStatusService(taskId, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
