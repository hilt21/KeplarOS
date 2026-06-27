/**
 * GET  /api/v1/goal-spaces/:goalSpaceId/cards — list cards in a goal space.
 * POST /api/v1/goal-spaces/:goalSpaceId/cards — create a card.
 *
 * Per docs/specs/interface_spec.md § 4.1, § 4.2.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { readJsonBody, requireString, optionalString } from "@/lib/api/request";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { requireActor } from "@/lib/api/actor";
import { CARD_STATES, RISK_LEVEL_VALUES } from "@db/schema";
import {
  createCardService,
  listCardsForGoalSpaceService,
  type CreateCardInput,
} from "@/lib/services/cards";

interface CreateCardBody {
  title?: unknown;
  description?: unknown;
  node_board_id?: unknown;
  assigned_to?: unknown;
  priority?: unknown;
  risk_level?: unknown;
  dependencies?: unknown;
  tags?: unknown;
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

function validateState(value: unknown): (typeof CARD_STATES)[number] | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !(CARD_STATES as readonly string[]).includes(value)) {
    throw new ApiRequestError(
      "VALIDATION_ERROR",
      `state must be one of: ${CARD_STATES.join(", ")}.`,
    );
  }
  return value as (typeof CARD_STATES)[number];
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
    const { id: goalSpaceId } = await context.params;
    const url = new URL(request.url);

    const state = validateState(url.searchParams.get("state") ?? undefined);
    const assignedTo = optionalString(
      url.searchParams.get("assigned_to") ?? undefined,
      "assigned_to",
    );
    const tagsRaw = url.searchParams.get("tags") ?? undefined;
    const tags = tagsRaw
      ? tagsRaw
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0)
      : undefined;

    return apiOk(
      listCardsForGoalSpaceService(goalSpaceId, actor, {
        ...(state !== undefined ? { state } : {}),
        ...(assignedTo !== undefined ? { assignedTo } : {}),
        ...(tags !== undefined ? { tags } : {}),
      }),
    );
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id: goalSpaceId } = await context.params;
    const body = await readJsonBody<CreateCardBody>(request);

    const title = requireString(body.title, "title");
    const nodeBoardId = requireString(body.node_board_id, "node_board_id");
    const description = optionalString(body.description, "description");
    const assignedTo = optionalString(body.assigned_to, "assigned_to");
    const priority = validatePriority(body.priority);
    const riskLevel = validateRiskLevel(body.risk_level);
    const dependencies = optionalStringArray(body.dependencies, "dependencies");
    const tags = optionalStringArray(body.tags, "tags");

    const input: CreateCardInput = {
      title,
      node_board_id: nodeBoardId,
      ...(description !== undefined ? { description } : {}),
      ...(assignedTo !== undefined ? { assigned_to: assignedTo } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(riskLevel !== undefined ? { risk_level: riskLevel } : {}),
      ...(dependencies !== undefined ? { dependencies } : {}),
      ...(tags !== undefined ? { tags } : {}),
    };

    return apiCreated(createCardService(goalSpaceId, input, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
