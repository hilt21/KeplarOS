/**
 * POST /api/v1/confirmations/:id/decide — approve or reject a pending confirmation.
 *
 * Per docs/specs/interface_spec.md § 6.2.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { readJsonBody, optionalString } from "@/lib/api/request";
import { apiError, apiOk } from "@/lib/api/response";
import { requireActor } from "@/lib/api/actor";
import {
  decideConfirmationService,
  type DecideConfirmationInput,
} from "@/lib/services/confirmations";

interface DecideConfirmationBody {
  outcome?: unknown;
  comment?: unknown;
  reason?: unknown;
}

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const body = await readJsonBody<DecideConfirmationBody>(request);

    if (typeof body.outcome !== "string") {
      throw new ApiRequestError("INVALID_FIELD", "outcome is required.");
    }

    const input: DecideConfirmationInput = {
      outcome: body.outcome as "approved" | "rejected",
      ...(optionalString(body.comment, "comment") !== undefined
        ? { comment: optionalString(body.comment, "comment")! }
        : {}),
      ...(optionalString(body.reason, "reason") !== undefined
        ? { reason: optionalString(body.reason, "reason")! }
        : {}),
    };

    return apiOk(decideConfirmationService(id, input, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
