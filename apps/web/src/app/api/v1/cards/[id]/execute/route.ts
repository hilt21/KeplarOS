/**
 * POST /api/v1/cards/:id/execute — kick off a fixture execution.
 *
 * Per docs/specs/interface_spec.md § 7.1.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { readJsonBody } from "@/lib/api/request";
import { apiError, apiOk } from "@/lib/api/response";
import { requireActor } from "@/lib/api/actor";
import { createExecutionService, type ExecuteCardInput } from "@/lib/services/executions";

interface ExecuteCardBody {
  role?: unknown;
  context?: unknown;
}

function optionalObject(value: unknown, field: string): Record<string, unknown> | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new ApiRequestError("INVALID_FIELD", `${field} must be an object.`);
  }
  return value as Record<string, unknown>;
}

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const body = await readJsonBody<ExecuteCardBody>(request);

    if (typeof body.role !== "string") {
      throw new ApiRequestError("INVALID_FIELD", "role is required.");
    }

    const input: ExecuteCardInput = {
      role: body.role as ExecuteCardInput["role"],
      ...(optionalObject(body.context, "context") !== undefined
        ? { context: optionalObject(body.context, "context")! }
        : {}),
    };

    return apiOk(createExecutionService(id, input, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
