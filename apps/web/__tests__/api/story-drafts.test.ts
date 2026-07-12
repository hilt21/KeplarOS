import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createJsonRequest,
  expectApiError,
  expectApiOk,
  withTestSession,
} from "./route-test-harness";
import type { Actor } from "@/lib/authorization/types";

const mockApplyStoryDraft = vi.hoisted(() => vi.fn());
const mockStoryDraftAuditPayloadFits = vi.hoisted(() => vi.fn(() => true));

vi.mock("@/lib/services/story-drafts", () => ({
  applyStoryDraft: mockApplyStoryDraft,
  storyDraftAuditPayloadFits: mockStoryDraftAuditPayloadFits,
}));

const initiator: Actor = { id: "initiator-1", role: "initiator" };
const chainUser: Actor = { id: "chain-user-1", role: "chain_user" };

function draft(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    goal: "Ship the beta",
    problem_statement: "The beta needs a release plan.",
    cards: [
      {
        title: "Initial planning",
        description: "Plan the release.",
        priority: 50,
        risk_level: "medium",
      },
    ],
    ...overrides,
  };
}

function request(body: unknown, actor: Actor = initiator): Request {
  return createJsonRequest(
    "/api/v1/story-drafts/apply",
    "POST",
    body,
    withTestSession(actor),
  );
}

describe("story draft apply API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 without an authenticated actor", async () => {
    const { POST } = await import("@/app/api/v1/story-drafts/apply/route");

    await expectApiError(
      await POST(createJsonRequest("/api/v1/story-drafts/apply", "POST", {})),
      "UNAUTHORIZED",
      401,
    );
    expect(mockApplyStoryDraft).not.toHaveBeenCalled();
  });

  it("returns 403 for a chain user", async () => {
    const { POST } = await import("@/app/api/v1/story-drafts/apply/route");

    await expectApiError(
      await POST(request({ story_application_id: "application-1", draft: draft() }, chainUser)),
      "FORBIDDEN",
      403,
    );
    expect(mockApplyStoryDraft).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON before applying", async () => {
    const { POST } = await import("@/app/api/v1/story-drafts/apply/route");

    await expectApiError(
      await POST(
        new Request("http://localhost/api/v1/story-drafts/apply", {
          method: "POST",
          body: "{",
          ...withTestSession(initiator),
        }),
      ),
      "INVALID_JSON",
      400,
    );
    expect(mockApplyStoryDraft).not.toHaveBeenCalled();
  });

  it.each([
    ["constraints", [42]],
    ["acceptance evidence", [{ criterion: "works", evidence: [false] }]],
    ["output requirements", [{}]],
    ["risk hints", [null]],
  ])("rejects invalid %s without applying", async (_label, value) => {
    const { POST } = await import("@/app/api/v1/story-drafts/apply/route");
    const invalidDraft =
      _label === "acceptance evidence"
        ? draft({ acceptance_criteria: value })
        : _label === "output requirements"
          ? draft({ output_requirements: value })
          : _label === "risk hints"
            ? draft({ risk_hints: value })
            : draft({ constraints: value });

    await expectApiError(
      await POST(request({ story_application_id: "application-1", draft: invalidDraft })),
      "INVALID_FIELD",
      400,
    );
    expect(mockApplyStoryDraft).not.toHaveBeenCalled();
  });

  it("rejects blank nested strings without applying", async () => {
    const { POST } = await import("@/app/api/v1/story-drafts/apply/route");

    await expectApiError(
      await POST(
        request({
          story_application_id: "application-1",
          draft: draft({ acceptance_criteria: [{ criterion: " ", evidence: ["proof"] }] }),
        }),
      ),
      "INVALID_FIELD",
      400,
    );
    expect(mockApplyStoryDraft).not.toHaveBeenCalled();
  });

  it.each([[], Array.from({ length: 51 }, () => draft().cards as unknown[]).flat()])(
    "rejects %s cards without applying",
    async (cards) => {
      const { POST } = await import("@/app/api/v1/story-drafts/apply/route");

      await expectApiError(
        await POST(request({ story_application_id: "application-1", draft: draft({ cards }) })),
        "INVALID_FIELD",
        400,
      );
      expect(mockApplyStoryDraft).not.toHaveBeenCalled();
    },
  );

  it("rejects an audit payload that exceeds the 32KB limit before applying", async () => {
    mockStoryDraftAuditPayloadFits.mockReturnValueOnce(false);
    const { POST } = await import("@/app/api/v1/story-drafts/apply/route");

    await expectApiError(
      await POST(
        request({
          story_application_id: "application-1",
          draft: draft({ output_requirements: Array.from({ length: 50 }, () => "x".repeat(4000)) }),
        }),
      ),
      "INVALID_FIELD",
      400,
    );
    expect(mockApplyStoryDraft).not.toHaveBeenCalled();
  });

  it("returns 201 for a first apply and 200 for a replay", async () => {
    mockApplyStoryDraft
      .mockReturnValueOnce({ goal_space_id: "goal-space-1", card_ids: ["card-1"], applied: true })
      .mockReturnValueOnce({ goal_space_id: "goal-space-1", card_ids: [], applied: false });
    const { POST } = await import("@/app/api/v1/story-drafts/apply/route");
    const body = { story_application_id: "application-1", draft: draft() };

    const first = await POST(request(body));
    expect(first.status).toBe(201);
    await expectApiOk(first);

    const replay = await POST(request(body));
    expect(replay.status).toBe(200);
    await expectApiOk(replay);
  });
});
