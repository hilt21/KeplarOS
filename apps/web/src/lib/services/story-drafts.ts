import { randomUUID } from "node:crypto";

import { runWithAudit } from "@/lib/audit/run-with-audit";
import { MAX_DETAILS_BYTES } from "@/lib/audit/redact";
import type { Actor } from "@/lib/authorization/types";
import { getDb, type DrizzleDb } from "@/lib/db/client";
import { createCard } from "@/lib/db/repositories/cards";
import {
  createGoalSpace,
  findGoalSpaceByStoryApplication,
} from "@/lib/db/repositories/goal-spaces";
import { createNodeBoard, insertNodeBoardMember } from "@/lib/db/repositories/node-boards";
import { ApiRequestError } from "@/lib/api/errors";

export interface StoryCardDraft {
  readonly title: string;
  readonly description: string;
  readonly priority: number;
  readonly risk_level: "low" | "medium" | "high" | "critical";
}

export interface StoryDraft {
  readonly goal: string;
  readonly problem_statement: string;
  readonly constraints: readonly string[];
  readonly acceptance_criteria: readonly { criterion: string; evidence: string[] }[];
  readonly output_requirements: readonly string[];
  readonly risk_hints: readonly string[];
  readonly cards: readonly StoryCardDraft[];
}

const AUDIT_CARD_ID_BUDGET = "00000000-0000-0000-0000-000000000000";

function storyDraftAuditData(
  storyApplicationId: string,
  cardIds: readonly string[],
  draft: StoryDraft,
): Record<string, unknown> {
  return {
    story_application_id: storyApplicationId,
    card_ids: [...cardIds],
    output_requirements: [...draft.output_requirements],
    risk_hints: [...draft.risk_hints],
  };
}

export function storyDraftAuditPayloadFits(storyApplicationId: string, draft: StoryDraft): boolean {
  const cardIds = Array.from({ length: 50 }, () => AUDIT_CARD_ID_BUDGET);
  return (
    Buffer.byteLength(JSON.stringify(storyDraftAuditData(storyApplicationId, cardIds, draft)), "utf8") <=
    MAX_DETAILS_BYTES
  );
}

function isStoryApplicationUniqueConstraint(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    "message" in error &&
    error.code === "SQLITE_CONSTRAINT_UNIQUE" &&
    typeof error.message === "string" &&
    /^UNIQUE constraint failed:\s*goal_spaces\.initiator_id\s*,\s*goal_spaces\.story_application_id\s*$/.test(
      error.message,
    )
  );
}

export function generateStoryDraft(goal: string): StoryDraft {
  const trimmed = goal.trim();
  if (!trimmed) throw new ApiRequestError("VALIDATION_ERROR", "goal must not be empty.");
  return {
    goal: trimmed,
    problem_statement: trimmed,
    constraints: [],
    acceptance_criteria: [],
    output_requirements: [],
    risk_hints: [],
    cards: [
      {
        title: "Initial planning",
        description: "Deterministic draft card. Review and edit before applying.",
        priority: 50,
        risk_level: "medium",
      },
    ],
  };
}

export function applyStoryDraft(
  storyApplicationId: string,
  draft: StoryDraft,
  actor: Actor,
  db: DrizzleDb = getDb(),
): { goal_space_id: string; card_ids: readonly string[]; applied: boolean } {
  if (actor.role !== "initiator") {
    throw new ApiRequestError("FORBIDDEN", "Only initiators can apply story drafts.");
  }
  if (!storyApplicationId.trim() || !draft.goal.trim() || draft.cards.length === 0) {
    throw new ApiRequestError(
      "VALIDATION_ERROR",
      "application id, goal, and at least one card are required.",
    );
  }
  if (draft.cards.length > 50) {
    throw new ApiRequestError("VALIDATION_ERROR", "A story draft may contain at most 50 cards.");
  }
  if (!storyDraftAuditPayloadFits(storyApplicationId, draft)) {
    throw new ApiRequestError("VALIDATION_ERROR", "Story draft audit payload exceeds the 32KB limit.");
  }
  const existing = findGoalSpaceByStoryApplication(db, actor.id, storyApplicationId);
  if (existing) return { goal_space_id: existing.id, card_ids: [], applied: false };

  const goalSpaceId = randomUUID();
  const boardId = randomUUID();
  const cardIds = draft.cards.map(() => randomUUID());
  try {
    return runWithAudit(
      db,
      {
        entityType: "goal_space",
        entityId: goalSpaceId,
        actor: "human",
        actorId: actor.id,
        action: "story_draft.apply",
        goalSpaceId,
        type: "story_draft.applied",
        resourceType: "goal_space",
        resourceId: goalSpaceId,
        details: storyDraftAuditData(storyApplicationId, cardIds, draft),
        data: storyDraftAuditData(storyApplicationId, cardIds, draft),
      },
      (tx) => {
        createGoalSpace(
          tx,
          actor.id,
          {
            name: draft.goal,
            description: draft.problem_statement,
            constraints: draft.constraints.map((value) => ({ value })),
            acceptanceCriteria: draft.acceptance_criteria.map((item) => ({ ...item })),
          },
          goalSpaceId,
          storyApplicationId,
        );
        createNodeBoard(tx, {
          id: boardId,
          goalSpaceId,
          key: "initial",
          name: "Initial work board",
          description: "Created from a deterministic Story draft.",
        });
        insertNodeBoardMember(tx, {
          id: randomUUID(),
          boardId,
          userId: actor.id,
          role: "owner",
          invitedBy: actor.id,
          joinedAt: new Date().toISOString(),
        });
        draft.cards.forEach((card, index) => {
          createCard(tx, {
            id: cardIds[index]!,
            goalSpaceId,
            nodeBoardId: boardId,
            displayId: `CARD-${String(index + 1).padStart(3, "0")}`,
            title: card.title,
            description: card.description,
            assignedTo: null,
            priority: card.priority,
            riskLevel: card.risk_level,
            dependencies: [],
            tags: [],
          });
        });
        return { goal_space_id: goalSpaceId, card_ids: cardIds, applied: true };
      },
    );
  } catch (error) {
    if (isStoryApplicationUniqueConstraint(error)) {
      const existingGoalSpace = findGoalSpaceByStoryApplication(db, actor.id, storyApplicationId);
      if (existingGoalSpace) {
        return { goal_space_id: existingGoalSpace.id, card_ids: [], applied: false };
      }
    }
    throw error;
  }
}
