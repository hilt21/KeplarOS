/**
 * GET /api/v1/confirmations — list accessible confirmations.
 *
 * Per docs/specs/interface_spec.md § 6.1.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { apiError, apiOk } from "@/lib/api/response";
import { requireActor } from "@/lib/api/actor";
import { CONFIRMATION_STATUS_VALUES, type ConfirmationStatus } from "@db/schema";
import { listConfirmationsService } from "@/lib/services/confirmations";

function validateStatus(value: string | null): ConfirmationStatus | undefined {
  if (value === null) return undefined;
  if (!(CONFIRMATION_STATUS_VALUES as readonly string[]).includes(value)) {
    throw new ApiRequestError(
      "INVALID_FIELD",
      `status must be one of: ${CONFIRMATION_STATUS_VALUES.join(", ")}.`,
    );
  }
  return value as ConfirmationStatus;
}

interface RouteContext {
  readonly params: Promise<Record<string, never>>;
}

export async function GET(request: Request, _context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const status = validateStatus(url.searchParams.get("status"));
    const { page, limit } = parsePagination(url.searchParams);
    return apiOk(
      listConfirmationsService(actor, {
        ...(status !== undefined ? { status } : {}),
        page,
        limit,
      }),
    );
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
