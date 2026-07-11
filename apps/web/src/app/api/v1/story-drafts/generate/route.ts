import { ApiRequestError } from "@/lib/api/errors";
import { requireInitiator } from "@/lib/api/actor";
import { readJsonBody, requireString } from "@/lib/api/request";
import { apiError, apiOk } from "@/lib/api/response";
import { generateStoryDraft } from "@/lib/services/story-drafts";

export async function POST(request: Request): Promise<Response> {
  try {
    await requireInitiator(request);
    const body = await readJsonBody<{ goal?: unknown }>(request);
    return apiOk({
      draft: generateStoryDraft(requireString(body.goal, "goal")),
      source: "deterministic_demo",
    });
  } catch (error) {
    if (error instanceof ApiRequestError)
      return apiError(error.code, error.message, { status: error.status });
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
