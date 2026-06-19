/**
 * POST /api/v1/goal-spaces — create a draft goal space (initiator only).
 * GET  /api/v1/goal-spaces — list goal spaces visible to the actor.
 *
 * Per docs/specs/interface_spec.md § 3.1, § 3.2.
 */

import { GOAL_SPACE_STATUS_VALUES } from "@db/schema";

import { ApiRequestError } from "@/lib/api/errors";
import { parsePagination } from "@/lib/api/pagination";
import { readJsonBody, requireString } from "@/lib/api/request";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { requireActor, requireInitiator } from "@/lib/api/actor";
import {
  createGoalSpaceService,
  listGoalSpacesService,
  type AcceptanceCriterion,
  type CreateGoalSpaceInput,
} from "@/lib/services/goal-spaces";

interface CreateGoalSpaceBody {
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

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireInitiator(request);
    const body = await readJsonBody<CreateGoalSpaceBody>(request);
    const input: CreateGoalSpaceInput = {
      name: requireString(body.name, "name"),
      ...(body.description !== undefined
        ? { description: requireString(body.description, "description") }
        : {}),
      ...(Array.isArray(body.constraints)
        ? {
            constraints: body.constraints.map((c, i) => {
              if (typeof c !== "string") {
                throw new ApiRequestError("INVALID_FIELD", `constraints[${i}] must be a string.`);
              }
              return c;
            }),
          }
        : {}),
      ...(body.acceptance_criteria !== undefined
        ? { acceptance_criteria: parseAcceptanceCriteria(body.acceptance_criteria) ?? [] }
        : {}),
    };

    const created = createGoalSpaceService(input, actor);
    return apiCreated(created);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}

export async function GET(request: Request): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const url = new URL(request.url);
    const params = parsePagination(url.searchParams);

    const statusParam = url.searchParams.get("status");
    let status = undefined as ReturnType<typeof asStatus> | undefined;
    if (statusParam !== null) {
      status = asStatus(statusParam);
    }

    const result = listGoalSpacesService(
      { ...(status ? { status } : {}), page: params.page, limit: params.limit },
      actor,
    );
    return apiOk(result);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}

function asStatus(value: string): (typeof GOAL_SPACE_STATUS_VALUES)[number] {
  if ((GOAL_SPACE_STATUS_VALUES as readonly string[]).includes(value)) {
    return value as (typeof GOAL_SPACE_STATUS_VALUES)[number];
  }
  throw new ApiRequestError(
    "INVALID_FIELD",
    `status must be one of: ${GOAL_SPACE_STATUS_VALUES.join(", ")}.`,
  );
}
