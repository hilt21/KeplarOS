/**
 * POST /api/v1/cards/:id/block — manually block a card.
 *
 * Per docs/specs/interface_spec.md § 4.6.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { apiError, apiOk } from "@/lib/api/response";
import { requireActor } from "@/lib/api/actor";
import { blockCardService } from "@/lib/services/cards";

interface BlockCardBody {
  reason?: unknown;
}

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

function validateReason(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiRequestError("VALIDATION_ERROR", "reason must be a non-empty string.");
  }
  return value;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const body = await readJsonBody<BlockCardBody>(request);
    const reason = validateReason(body.reason);
    return apiOk(blockCardService(id, { reason }, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
