/**
 * DELETE /api/v1/node-boards/:id/members/:userId — soft-remove a member (initiator only).
 *
 * Per docs/specs/interface_spec.md § 3.8.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { apiError, apiNoContent } from "@/lib/api/response";
import { requireInitiator } from "@/lib/api/actor";
import { removeNodeBoardMemberService } from "@/lib/services/node-boards";

interface RouteContext {
  readonly params: Promise<{ id: string; userId: string }>;
}

export async function DELETE(request: Request, context: RouteContext): Promise<Response> {
  try {
    const actor = await requireInitiator(request);
    const { id, userId } = await context.params;
    removeNodeBoardMemberService(id, userId, actor);
    return apiNoContent();
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return apiError(error.code, error.message, { status: error.status });
    }
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
