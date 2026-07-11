import { randomUUID } from "node:crypto";

import { eq } from "drizzle-orm";

import { goalSpaces } from "@db/schema";

import { runWithAudit } from "@/lib/audit/run-with-audit";
import type { Actor } from "@/lib/authorization/types";
import { getDb, type DrizzleDb } from "@/lib/db/client";
import { createCard } from "@/lib/db/repositories/cards";
import { createGoalSpace } from "@/lib/db/repositories/goal-spaces";
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
  const existing = db
    .select({ id: goalSpaces.id })
    .from(goalSpaces)
    .where(eq(goalSpaces.storyApplicationId, storyApplicationId))
    .get();
  if (existing) return { goal_space_id: existing.id, card_ids: [], applied: false };

  const goalSpaceId = randomUUID();
  const boardId = randomUUID();
  const cardIds = draft.cards.map(() => randomUUID());
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
      data: { story_application_id: storyApplicationId, card_ids: cardIds },
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
}
