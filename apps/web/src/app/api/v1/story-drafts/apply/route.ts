import { ApiRequestError } from "@/lib/api/errors";
import { requireInitiator } from "@/lib/api/actor";
import { readJsonBody, requireString } from "@/lib/api/request";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import { applyStoryDraft, type StoryDraft } from "@/lib/services/story-drafts";

interface ApplyBody {
  story_application_id?: unknown;
  draft?: unknown;
}

function parseDraft(value: unknown): StoryDraft {
  if (typeof value !== "object" || value === null) {
    throw new ApiRequestError("INVALID_FIELD", "draft must be an object.");
  }
  const draft = value as Record<string, unknown>;
  const goal = requireString(draft.goal, "draft.goal");
  const problemStatement = requireString(draft.problem_statement, "draft.problem_statement");
  if (!Array.isArray(draft.cards) || draft.cards.length === 0) {
    throw new ApiRequestError("INVALID_FIELD", "draft.cards must contain at least one card.");
  }
  return {
    goal,
    problem_statement: problemStatement,
    constraints: Array.isArray(draft.constraints)
      ? draft.constraints.filter((v): v is string => typeof v === "string")
      : [],
    acceptance_criteria: Array.isArray(draft.acceptance_criteria)
      ? draft.acceptance_criteria.filter(
          (v): v is { criterion: string; evidence: string[] } =>
            typeof v === "object" &&
            v !== null &&
            typeof (v as Record<string, unknown>).criterion === "string" &&
            Array.isArray((v as Record<string, unknown>).evidence),
        )
      : [],
    output_requirements: Array.isArray(draft.output_requirements)
      ? draft.output_requirements.filter((v): v is string => typeof v === "string")
      : [],
    risk_hints: Array.isArray(draft.risk_hints)
      ? draft.risk_hints.filter((v): v is string => typeof v === "string")
      : [],
    cards: draft.cards.map((value, index) => {
      if (typeof value !== "object" || value === null)
        throw new ApiRequestError("INVALID_FIELD", `draft.cards[${index}] must be an object.`);
      const card = value as Record<string, unknown>;
      const risk = requireString(card.risk_level, `draft.cards[${index}].risk_level`);
      if (!(["low", "medium", "high", "critical"] as const).includes(risk as "low"))
        throw new ApiRequestError("INVALID_FIELD", `draft.cards[${index}].risk_level is invalid.`);
      if (!Number.isInteger(card.priority))
        throw new ApiRequestError(
          "INVALID_FIELD",
          `draft.cards[${index}].priority must be an integer.`,
        );
      return {
        title: requireString(card.title, `draft.cards[${index}].title`),
        description: requireString(card.description, `draft.cards[${index}].description`),
        priority: card.priority as number,
        risk_level: risk as "low" | "medium" | "high" | "critical",
      };
    }),
  };
}

export async function POST(request: Request): Promise<Response> {
  try {
    const actor = await requireInitiator(request);
    const body = await readJsonBody<ApplyBody>(request);
    const result = applyStoryDraft(
      requireString(body.story_application_id, "story_application_id"),
      parseDraft(body.draft),
      actor,
    );
    return result.applied ? apiCreated(result) : apiOk(result);
  } catch (error) {
    if (error instanceof ApiRequestError)
      return apiError(error.code, error.message, { status: error.status });
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
