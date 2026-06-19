/**
 * POST /api/v1/node-boards/:id/members — add a member to a node board (initiator only).
 *
 * Per docs/specs/interface_spec.md § 3.8.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { readJsonBody, requireString } from "@/lib/api/request";
import { apiCreated, apiError } from "@/lib/api/response";
import { requireInitiator } from "@/lib/api/actor";
import {
  addNodeBoardMemberService,
  type AddNodeBoardMemberInput,
} from "@/lib/services/node-boards";

interface AddMemberBody {
  user_id?: unknown;
  role?: unknown;
}

interface RouteContext {
  readonly params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireInitiator(request);
    const { id } = await context.params;
    const body = await readJsonBody<AddMemberBody>(request);

    const userId = requireString(body.user_id, "user_id");
    const roleRaw = requireString(body.role, "role");
    if (roleRaw !== "owner" && roleRaw !== "member" && roleRaw !== "viewer") {
      throw new ApiRequestError("VALIDATION_ERROR", "role must be one of: owner, member, viewer.");
    }

    const input: AddNodeBoardMemberInput = {
      user_id: userId,
      role: roleRaw as AddNodeBoardMemberInput["role"],
    };

    return apiCreated(addNodeBoardMemberService(id, input, actor));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
