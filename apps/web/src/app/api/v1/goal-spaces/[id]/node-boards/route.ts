/**
 * GET  /api/v1/goal-spaces/:goalSpaceId/node-boards — list boards visible to the actor.
 * POST /api/v1/goal-spaces/:goalSpaceId/node-boards — create a board (initiator only).
 *
 * Per docs/specs/interface_spec.md § 3.8.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { readJsonBody, requireString } from "@/lib/api/request";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { requireActor, requireInitiator } from "@/lib/api/actor";
import {
  createNodeBoardService,
  listNodeBoardsForGoalSpaceService,
  type CreateNodeBoardInput,
} from "@/lib/services/node-boards";

interface CreateNodeBoardBody {
  key?: unknown;
  name?: unknown;
  description?: unknown;
  members?: unknown;
}

interface SeedMember {
  user_id: string;
  role: "owner" | "member" | "viewer";
}

function parseMembers(value: unknown): SeedMember[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new ApiRequestError("INVALID_FIELD", "members must be an array.");
  }
  return value.map((entry, index) => {
    if (typeof entry !== "object" || entry === null) {
      throw new ApiRequestError("INVALID_FIELD", `members[${index}] must be an object.`);
    }
    const record = entry as Record<string, unknown>;
    const userId = requireString(record.user_id, `members[${index}].user_id`);
    if (record.role !== "owner" && record.role !== "member" && record.role !== "viewer") {
      throw new ApiRequestError(
        "INVALID_FIELD",
        `members[${index}].role must be one of: owner, member, viewer.`,
      );
    }
    return { user_id: userId, role: record.role };
  });
}

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function GET(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireActor(request);
    const { id: goalSpaceId } = await context.params;
    return apiOk(listNodeBoardsForGoalSpaceService(goalSpaceId, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireInitiator(request);
    const { id: goalSpaceId } = await context.params;
    const body = await readJsonBody<CreateNodeBoardBody>(request);

    const input: CreateNodeBoardInput = {
      key: requireString(body.key, "key"),
      name: requireString(body.name, "name"),
      ...(body.description !== undefined
        ? { description: requireString(body.description, "description") }
        : {}),
      ...(body.members !== undefined ? { members: parseMembers(body.members) ?? [] } : {}),
    };

    const created = createNodeBoardService(goalSpaceId, input, actor);
    return apiCreated(created);
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
