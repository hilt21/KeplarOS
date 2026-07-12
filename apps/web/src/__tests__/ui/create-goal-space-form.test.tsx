import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { CreateGoalSpaceForm } from "@/components/create-goal-space-form";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

describe("CreateGoalSpaceForm", () => {
  beforeEach(() => {
    push.mockClear();
    refresh.mockClear();
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("generates an editable deterministic draft then applies it", async () => {
    const draft = {
      goal: "Reduce review latency",
      problem_statement: "Reduce review latency",
      constraints: [],
      acceptance_criteria: [],
      output_requirements: [],
      risk_hints: [],
      cards: [
        { title: "Initial planning", description: "Plan", priority: 50, risk_level: "medium" },
      ],
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ success: true, data: { draft, source: "deterministic_demo" } }),
      )
      .mockResolvedValueOnce(
        Response.json({
          success: true,
          data: { goal_space_id: "goal-space-1", applied: true, card_ids: ["card-1"] },
        }),
      );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "application-1" });
    render(<CreateGoalSpaceForm />);
    expect(screen.getByLabelText("Business goal")).toHaveAttribute("name", "story_goal");
    expect(screen.getByLabelText("Business goal")).toHaveAttribute("autocomplete", "off");
    fireEvent.change(screen.getByLabelText("Business goal"), { target: { value: draft.goal } });
    fireEvent.click(screen.getByRole("button", { name: "Generate deterministic draft" }));
    const editor = await screen.findByLabelText(/Editable Story draft/);
    expect(editor).toHaveValue(JSON.stringify(draft, null, 2));
    expect(editor).toHaveAttribute("name", "story_draft");
    expect(editor).toHaveAttribute("autocomplete", "off");
    fireEvent.click(screen.getByRole("button", { name: "Apply draft and create workspace" }));
    await waitFor(() => expect(push).toHaveBeenCalledWith("/goal-spaces/goal-space-1"));
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "/api/v1/story-drafts/apply",
      expect.objectContaining({
        body: JSON.stringify({ story_application_id: "application-1", draft }),
      }),
    );
  });

  it("renders a generation error", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ success: false, error: { message: "Goal is required." } })),
    );
    render(<CreateGoalSpaceForm />);
    fireEvent.change(screen.getByLabelText("Business goal"), { target: { value: "x" } });
    fireEvent.click(screen.getByRole("button", { name: "Generate deterministic draft" }));
    expect(await screen.findByText("Goal is required.")).toBeInTheDocument();
  });

  it("renders the API error when applying a generated draft fails", async () => {
    const draft = { goal: "Reduce review latency" };
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(Response.json({ success: true, data: { draft } }))
        .mockResolvedValueOnce(
          Response.json({ success: false, error: { message: "Draft has too many cards." } }),
        ),
    );
    vi.stubGlobal("crypto", { randomUUID: () => "application-1" });
    render(<CreateGoalSpaceForm />);

    fireEvent.change(screen.getByLabelText("Business goal"), { target: { value: draft.goal } });
    fireEvent.click(screen.getByRole("button", { name: "Generate deterministic draft" }));
    await screen.findByLabelText(/Editable Story draft/);
    fireEvent.click(screen.getByRole("button", { name: "Apply draft and create workspace" }));

    expect(await screen.findByText("Draft has too many cards.")).toBeInTheDocument();
  });

  it("renders a JSON parse error before calling the apply API", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      Response.json({ success: true, data: { draft: { goal: "Reduce review latency" } } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("crypto", { randomUUID: () => "application-1" });
    render(<CreateGoalSpaceForm />);

    fireEvent.change(screen.getByLabelText("Business goal"), {
      target: { value: "Reduce review latency" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Generate deterministic draft" }));
    const editor = await screen.findByLabelText(/Editable Story draft/);
    fireEvent.change(editor, { target: { value: "not json" } });
    fireEvent.click(screen.getByRole("button", { name: "Apply draft and create workspace" }));

    expect(await screen.findByText("Draft must be valid JSON.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
