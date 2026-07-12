import { ApiRequestError } from "@/lib/api/errors";
import { requireInitiator } from "@/lib/api/actor";
import { readJsonBody, requireString } from "@/lib/api/request";
import { apiCreated, apiError, apiOk } from "@/lib/api/response";
import {
  applyStoryDraft,
  storyDraftAuditPayloadFits,
  type StoryDraft,
} from "@/lib/services/story-drafts";

interface ApplyBody {
  story_application_id?: unknown;
  draft?: unknown;
}

const MAX_CARDS = 50;
const MAX_LIST_ITEMS = 50;
const MAX_STRING_LENGTH = 4000;

function requireEditableString(value: unknown, field: string): string {
  const string = requireString(value, field);
  if (!string.trim()) {
    throw new ApiRequestError("INVALID_FIELD", `${field} must not be blank.`);
  }
  if (string.length > MAX_STRING_LENGTH) {
    throw new ApiRequestError(
      "INVALID_FIELD",
      `${field} must not exceed ${MAX_STRING_LENGTH} characters.`,
    );
  }
  return string;
}

function parseStringList(value: unknown, field: string): string[] {
  if (!Array.isArray(value)) {
    throw new ApiRequestError("INVALID_FIELD", `${field} must be an array.`);
  }
  if (value.length > MAX_LIST_ITEMS) {
    throw new ApiRequestError(
      "INVALID_FIELD",
      `${field} must not contain more than ${MAX_LIST_ITEMS} items.`,
    );
  }
  return value.map((item, index) => requireEditableString(item, `${field}[${index}]`));
}

function parseDraft(value: unknown): StoryDraft {
  if (typeof value !== "object" || value === null) {
    throw new ApiRequestError("INVALID_FIELD", "draft must be an object.");
  }
  const draft = value as Record<string, unknown>;
  const goal = requireEditableString(draft.goal, "draft.goal");
  const problemStatement = requireEditableString(draft.problem_statement, "draft.problem_statement");
  if (!Array.isArray(draft.cards) || draft.cards.length === 0) {
    throw new ApiRequestError("INVALID_FIELD", "draft.cards must contain at least one card.");
  }
  if (draft.cards.length > MAX_CARDS) {
    throw new ApiRequestError(
      "INVALID_FIELD",
      `draft.cards must not contain more than ${MAX_CARDS} cards.`,
    );
  }
  return {
    goal,
    problem_statement: problemStatement,
    constraints:
      draft.constraints === undefined ? [] : parseStringList(draft.constraints, "draft.constraints"),
    acceptance_criteria:
      draft.acceptance_criteria === undefined
        ? []
        : (() => {
            if (!Array.isArray(draft.acceptance_criteria)) {
              throw new ApiRequestError(
                "INVALID_FIELD",
                "draft.acceptance_criteria must be an array.",
              );
            }
            if (draft.acceptance_criteria.length > MAX_LIST_ITEMS) {
              throw new ApiRequestError(
                "INVALID_FIELD",
                `draft.acceptance_criteria must not contain more than ${MAX_LIST_ITEMS} items.`,
              );
            }
            return draft.acceptance_criteria.map((item, index) => {
              if (typeof item !== "object" || item === null) {
                throw new ApiRequestError(
                  "INVALID_FIELD",
                  `draft.acceptance_criteria[${index}] must be an object.`,
                );
              }
              const criterion = item as Record<string, unknown>;
              return {
                criterion: requireEditableString(
                  criterion.criterion,
                  `draft.acceptance_criteria[${index}].criterion`,
                ),
                evidence: parseStringList(
                  criterion.evidence,
                  `draft.acceptance_criteria[${index}].evidence`,
                ),
              };
            });
          })(),
    output_requirements:
      draft.output_requirements === undefined
        ? []
        : parseStringList(draft.output_requirements, "draft.output_requirements"),
    risk_hints:
      draft.risk_hints === undefined ? [] : parseStringList(draft.risk_hints, "draft.risk_hints"),
    cards: draft.cards.map((value, index) => {
      if (typeof value !== "object" || value === null)
        throw new ApiRequestError("INVALID_FIELD", `draft.cards[${index}] must be an object.`);
      const card = value as Record<string, unknown>;
      const risk = requireEditableString(card.risk_level, `draft.cards[${index}].risk_level`);
      if (!(["low", "medium", "high", "critical"] as const).includes(risk as "low"))
        throw new ApiRequestError("INVALID_FIELD", `draft.cards[${index}].risk_level is invalid.`);
      if (!Number.isInteger(card.priority))
        throw new ApiRequestError(
          "INVALID_FIELD",
          `draft.cards[${index}].priority must be an integer.`,
        );
      return {
        title: requireEditableString(card.title, `draft.cards[${index}].title`),
        description: requireEditableString(card.description, `draft.cards[${index}].description`),
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
    const storyApplicationId = requireEditableString(body.story_application_id, "story_application_id");
    const draft = parseDraft(body.draft);
    if (!storyDraftAuditPayloadFits(storyApplicationId, draft)) {
      throw new ApiRequestError("INVALID_FIELD", "Story draft audit payload exceeds the 32KB limit.");
    }
    const result = applyStoryDraft(
      storyApplicationId,
      draft,
      actor,
    );
    return result.applied ? apiCreated(result) : apiOk(result);
  } catch (error) {
    if (error instanceof ApiRequestError)
      return apiError(error.code, error.message, { status: error.status });
    return apiError("INTERNAL_ERROR", "Unexpected error.");
  }
}
