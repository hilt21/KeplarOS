import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { CreateNodeBoardForm } from "@/components/create-node-board-form";

const refresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh,
  }),
}));

describe("CreateNodeBoardForm", () => {
  beforeEach(() => {
    refresh.mockClear();
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("posts a node board and refreshes on success", async () => {
    const fetchMock = vi.fn(async () =>
      Response.json({
        success: true,
        data: {
          id: "board-1",
          goal_space_id: "gs-1",
          key: "MAIN",
          name: "Main board",
          description: "Primary execution board.",
          members: [],
          status: "active",
          created_at: "2026-06-26T00:00:00.000Z",
          updated_at: "2026-06-26T00:00:00.000Z",
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<CreateNodeBoardForm goalSpaceId="gs-1" />);

    fireEvent.change(screen.getByLabelText("Board key"), {
      target: { value: "MAIN" },
    });
    fireEvent.change(screen.getByLabelText("Board name"), {
      target: { value: "Main board" },
    });
    fireEvent.change(screen.getByLabelText("Description"), {
      target: { value: "Primary execution board." },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create node board" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/v1/goal-spaces/gs-1/node-boards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          key: "MAIN",
          name: "Main board",
          description: "Primary execution board.",
        }),
      });
    });
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Board key")).toHaveValue("");
    expect(screen.getByLabelText("Board name")).toHaveValue("");
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
            message: "Board key is required.",
          },
        }),
      ),
    );

    render(<CreateNodeBoardForm goalSpaceId="gs-1" />);

    fireEvent.change(screen.getByLabelText("Board key"), {
      target: { value: " " },
    });
    fireEvent.change(screen.getByLabelText("Board name"), {
      target: { value: "Main board" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create node board" }));

    expect(await screen.findByText("Board key is required.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("renders a fallback error when creation throws", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("Network unavailable");
      }),
    );

    render(<CreateNodeBoardForm goalSpaceId="gs-1" />);

    fireEvent.change(screen.getByLabelText("Board key"), {
      target: { value: "MAIN" },
    });
    fireEvent.change(screen.getByLabelText("Board name"), {
      target: { value: "Main board" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create node board" }));

    expect(await screen.findByText("Unable to create node board.")).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });
});
