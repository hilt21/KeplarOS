/**
 * GET   /api/v1/node-boards/:id — read a node board the actor can access.
 * PATCH /api/v1/node-boards/:id — update name, description, or status (initiator only).
 *
 * Per docs/specs/interface_spec.md § 3.8.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { readJsonBody, requireString, optionalString } from "@/lib/api/request";
import { apiError, apiOk } from "@/lib/api/response";
import { requireActor, requireInitiator } from "@/lib/api/actor";
import {
  getNodeBoardDetailService,
  updateNodeBoardService,
  type UpdateNodeBoardInput,
} from "@/lib/services/node-boards";
import { NODE_BOARD_STATUS_VALUES } from "@/lib/db/repositories/node-boards";

interface UpdateNodeBoardBody {
  name?: unknown;
  description?: unknown;
  status?: unknown;
}

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    return apiOk(getNodeBoardDetailService(id, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireInitiator(request);
    const { id } = await context.params;
    const body = await readJsonBody<UpdateNodeBoardBody>(request);

    const patch: {
      -readonly [K in keyof UpdateNodeBoardInput]: UpdateNodeBoardInput[K];
    } = {};
    if (body.name !== undefined) patch.name = requireString(body.name, "name");
    if (body.description !== undefined) {
      const desc = optionalString(body.description, "description");
      if (desc !== undefined) patch.description = desc;
    }
    if (body.status !== undefined) {
      if (
        typeof body.status !== "string" ||
        !(NODE_BOARD_STATUS_VALUES as readonly string[]).includes(body.status)
      ) {
        throw new ApiRequestError(
          "VALIDATION_ERROR",
          `status must be one of: ${NODE_BOARD_STATUS_VALUES.join(", ")}.`,
        );
      }
      patch.status = body.status as (typeof NODE_BOARD_STATUS_VALUES)[number];
    }

    return apiOk(updateNodeBoardService(id, patch, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
