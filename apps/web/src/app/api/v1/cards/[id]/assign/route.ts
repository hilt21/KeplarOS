/**
 * POST /api/v1/cards/:id/assign — assign a card to a user.
 *
 * Per docs/specs/interface_spec.md § 4.5.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { readJsonBody, requireString } from "@/lib/api/request";
import { apiError, apiOk } from "@/lib/api/response";
import { requireActor } from "@/lib/api/actor";
import { assignCardService } from "@/lib/services/cards";

interface AssignCardBody {
  assigned_to?: unknown;
}

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const body = await readJsonBody<AssignCardBody>(request);
    const assignedTo = requireString(body.assigned_to, "assigned_to");
    return apiOk(assignCardService(id, { assigned_to: assignedTo }, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
