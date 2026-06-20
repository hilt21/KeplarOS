/**
 * POST /api/v1/cards/:id/unblock — resolve a blocked card into a target state.
 *
 * Per docs/specs/interface_spec.md § 4.7.
 * Spec § 5 mandatory gate: a pending human confirmation blocks this operation
 * (F-003 canMutateCard('unblock') returns false when hasPendingConfirmation=true).
 */

import { ApiRequestError } from "@/lib/api/errors";
import { readJsonBody, requireString } from "@/lib/api/request";
import { apiError, apiOk } from "@/lib/api/response";
import { requireActor } from "@/lib/api/actor";
import { CARD_STATES } from "@db/schema";
import { unblockCardService } from "@/lib/services/cards";
import type { CardState } from "@db/schema";

interface UnblockCardBody {
  target_state?: unknown;
}

const ALLOWED_UNBLOCK_TARGET_STATES: readonly CardState[] = ["backlog", "todo", "dev", "review"];

function validateTargetState(value: unknown): CardState {
  const s = requireString(value, "target_state");
  if (!(ALLOWED_UNBLOCK_TARGET_STATES as readonly string[]).includes(s)) {
    throw new ApiRequestError(
      "VALIDATION_ERROR",
      `target_state must be one of: ${ALLOWED_UNBLOCK_TARGET_STATES.join(", ")}.`,
    );
  }
  return s as CardState;
}

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const body = await readJsonBody<UnblockCardBody>(request);
    const target = validateTargetState(body.target_state);
    return apiOk(unblockCardService(id, { target_state: target }, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}

// Ensure CARD_STATES is referenced (the unblock service validates target_state
// against ALLOWED_UNBLOCK_TARGET_STATES; CARD_STATES is the schema-level enum).
void CARD_STATES;
