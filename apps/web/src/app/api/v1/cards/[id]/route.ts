/**
 * GET   /api/v1/cards/:id — read card detail.
 * PATCH /api/v1/cards/:id — update card metadata.
 *
 * Per docs/specs/interface_spec.md § 4.3, § 4.4.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { readJsonBody, optionalString } from "@/lib/api/request";
import { apiError, apiOk } from "@/lib/api/response";
import { requireActor } from "@/lib/api/actor";
import { RISK_LEVEL_VALUES } from "@db/schema";
import type { UpdateCardInput } from "@/lib/db/repositories/cards";
import { getCardDetailService, updateCardService } from "@/lib/services/cards";

interface UpdateCardBody {
  title?: unknown;
  description?: unknown;
  assigned_to?: unknown;
  priority?: unknown;
  risk_level?: unknown;
  tags?: unknown;
  state?: unknown;
}

function validatePriority(value: unknown): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new ApiRequestError("INVALID_FIELD", "priority must be an integer.");
  }
  return value;
}

function validateRiskLevel(value: unknown): (typeof RISK_LEVEL_VALUES)[number] | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !(RISK_LEVEL_VALUES as readonly string[]).includes(value)) {
    throw new ApiRequestError(
      "VALIDATION_ERROR",
      `risk_level must be one of: ${RISK_LEVEL_VALUES.join(", ")}.`,
    );
  }
  return value as (typeof RISK_LEVEL_VALUES)[number];
}

function optionalStringArray(value: unknown, field: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiRequestError("INVALID_FIELD", `${field} must be an array of strings.`);
  }
  return value.map((v, i) => {
    if (typeof v !== "string") {
      throw new ApiRequestError("INVALID_FIELD", `${field}[${i}] must be a string.`);
    }
    return v;
  });
}

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    return apiOk(getCardDetailService(id, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}

export async function PATCH(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    const body = await readJsonBody<UpdateCardBody>(request);

    // Reject state field — state is managed by the state machine.
    if (body.state !== undefined) {
      throw new ApiRequestError(
        "INVALID_FIELD",
        "state is managed by the state machine; use /block or /unblock.",
      );
    }

    const patch: { -readonly [K in keyof UpdateCardInput]: UpdateCardInput[K] } = {};
    if (body.title !== undefined) {
      if (typeof body.title !== "string") {
        throw new ApiRequestError("INVALID_FIELD", "title must be a string.");
      }
      patch.title = body.title;
    }
    if (body.description !== undefined) {
      const desc = optionalString(body.description, "description");
      if (desc !== undefined) patch.description = desc;
    }
    if (body.assigned_to !== undefined) {
      const at = optionalString(body.assigned_to, "assigned_to");
      if (at !== undefined) patch.assignedTo = at;
    }
    if (body.priority !== undefined) {
      const p = validatePriority(body.priority);
      if (p !== undefined) patch.priority = p;
    }
    if (body.risk_level !== undefined) {
      const rl = validateRiskLevel(body.risk_level);
      if (rl !== undefined) patch.riskLevel = rl;
    }
    if (body.tags !== undefined) {
      const tags = optionalStringArray(body.tags, "tags");
      if (tags !== undefined) patch.tags = tags;
    }

    return apiOk(updateCardService(id, patch, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
