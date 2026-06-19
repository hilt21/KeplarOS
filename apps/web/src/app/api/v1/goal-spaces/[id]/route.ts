/**
 * GET   /api/v1/goal-spaces/:id — read a goal space the actor can access.
 * PATCH /api/v1/goal-spaces/:id — update metadata on a draft goal space (initiator only).
 *
 * Per docs/specs/interface_spec.md § 3.3, § 3.4.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { readJsonBody, requireString, optionalString } from "@/lib/api/request";
import { apiError, apiOk } from "@/lib/api/response";
import { requireActor, requireInitiator } from "@/lib/api/actor";
import {
  getGoalSpaceDetailService,
  updateGoalSpaceService,
  type AcceptanceCriterion,
} from "@/lib/services/goal-spaces";
import type { UpdateGoalSpaceInput } from "@/lib/db/repositories/goal-spaces";

interface UpdateGoalSpaceBody {
  name?: unknown;
  description?: unknown;
  constraints?: unknown;
  acceptance_criteria?: unknown;
}

function parseAcceptanceCriteria(value: unknown): AcceptanceCriterion[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiRequestError("INVALID_FIELD", "acceptance_criteria must be an array.");
  }
  return value.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ApiRequestError(
        "INVALID_FIELD",
        `acceptance_criteria[${index}] must be an object.`,
      );
    }
    const record = entry as Record<string, unknown>;
    const criterion = requireString(record.criterion, `acceptance_criteria[${index}].criterion`);
    if (!Array.isArray(record.evidence)) {
      throw new ApiRequestError(
        "INVALID_FIELD",
        `acceptance_criteria[${index}].evidence must be an array.`,
      );
    }
    const evidence = record.evidence.map((e, eIndex) => {
      if (typeof e !== "string") {
        throw new ApiRequestError(
          "INVALID_FIELD",
          `acceptance_criteria[${index}].evidence[${eIndex}] must be a string.`,
        );
      }
      return e;
    });
    return { criterion, evidence };
  });
}

function parseConstraints(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiRequestError("INVALID_FIELD", "constraints must be an array of strings.");
  }
  return value.map((c, i) => {
    if (typeof c !== "string") {
      throw new ApiRequestError("INVALID_FIELD", `constraints[${i}] must be a string.`);
    }
    return c;
  });
}

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id } = await context.params;
    return apiOk(getGoalSpaceDetailService(id, actor));
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
    const body = await readJsonBody<UpdateGoalSpaceBody>(request);

    const patch: { -readonly [K in keyof UpdateGoalSpaceInput]: UpdateGoalSpaceInput[K] } = {};
    if (body.name !== undefined) patch.name = requireString(body.name, "name");
    if (body.description !== undefined) {
      const desc = optionalString(body.description, "description");
      if (desc !== undefined) patch.description = desc;
    }
    if (body.constraints !== undefined) {
      const cs = parseConstraints(body.constraints);
      if (cs !== undefined) patch.constraints = cs;
    }
    if (body.acceptance_criteria !== undefined) {
      const ac = parseAcceptanceCriteria(body.acceptance_criteria);
      if (ac !== undefined) patch.acceptanceCriteria = ac;
    }

    return apiOk(updateGoalSpaceService(id, patch, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
