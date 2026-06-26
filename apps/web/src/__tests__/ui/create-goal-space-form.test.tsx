import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { CreateGoalSpaceForm } from "@/components/create-goal-space-form";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

describe("CreateGoalSpaceForm", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts a goal space and refreshes on success", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        success: true,
        data: {
          id: "goal-space-1",
          name: "Reduce board review latency",
          description: "Coordinate executive review handoffs.",
          constraints: [],
          acceptance_criteria: [],
          status: "draft",
          progress: 0,
          initiator_id: "user-1",
          created_at: "2026-06-26T00:00:00.000Z",
          updated_at: "2026-06-26T00:00:00.000Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CreateGoalSpaceForm />);

    fireEvent.change(screen.getByLabelText("Goal name"), {
      target: { value: "Reduce board review latency" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Coordinate executive review handoffs." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create goal space" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/goal-spaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          name: "Reduce board review latency",
          description: "Coordinate executive review handoffs.",
          constraints: [],
          acceptance_criteria: [],
        }),
      });
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Goal name")).toHaveValue("");
    expect(screen.getByLabelText("Description")).toHaveValue("");
  });

  it("renders the API error message and does not refresh", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "Goal name is required.",
          },
        }),
      ),
    );

    render(<CreateGoalSpaceForm />);

    fireEvent.change(screen.getByLabelText("Goal name"), {
      target: { value: " " },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Coordinate executive review handoffs." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create goal space" }));

    expect(await screen.findByText("Goal name is required.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders a fallback error when creation throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Network unavailable");
      }),
    );

    render(<CreateGoalSpaceForm />);

    fireEvent.change(screen.getByLabelText("Goal name"), {
      target: { value: "Reduce board review latency" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Coordinate executive review handoffs." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create goal space" }));

    expect(await screen.findByText("Unable to create goal space.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
