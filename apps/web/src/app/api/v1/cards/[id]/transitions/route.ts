/**
 * GET /api/v1/cards/:id/transitions — list a card's state transition history.
 *
 * Per docs/specs/interface_spec.md § 5.1.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { apiError, apiOk } from "@/lib/api/response";
import { requireActor } from "@/lib/api/actor";
import { listCardTransitionsService } from "@/lib/services/cards";

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    return apiOk(listCardTransitionsService(id, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
