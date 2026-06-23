/**
 * ConfirmationQueue (F2-09) — RED-first test.
 *
 * Verifies: approve fires onDecide with "approved"; reject fires
 * "rejected"; in-flight POST disables both buttons; empty list shows
 * // no pending confirmations.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { ConfirmationQueue } from "@/components/confirmation-queue";
import type { HumanConfirmationResponse } from "@/lib/api/types";

afterEach(() => {
  cleanup();
});

function makeConfirmation(
  id: string,
  overrides: Partial<HumanConfirmationResponse> = {},
): HumanConfirmationResponse {
  return {
    id,
    card_id: "card-1",
    card_title: `Title ${id}`,
    status: "pending",
    trigger_type: "high_risk",
    trigger_reason: null,
    triggered_by: null,
    triggered_at: null,
    ai_summary: null,
    risk_factors: [],
    recommendations: [],
    ai_confidence: null,
    target_state: null,
    expires_at: "2026-12-31T00:00:00.000Z",
    created_at: "2026-06-23T00:00:00.000Z",
    ...overrides,
  };
}

describe("ConfirmationQueue", () => {
  it("renders the header with the count", () => {
    render(
      <ConfirmationQueue
        confirmations={[makeConfirmation("cfm-aaaaaa"), makeConfirmation("cfm-bbbbbb")]}
        onDecide={async () => {}}
      />,
    );
    expect(screen.getByText("Pending confirmations")).toBeInTheDocument();
    expect(screen.getByText("2 ▾")).toBeInTheDocument();
  });

  it("shows // no pending confirmations when empty", () => {
    render(<ConfirmationQueue confirmations={[]} onDecide={async () => {}} />);
    expect(screen.getByText("// no pending confirmations")).toBeInTheDocument();
  });

  it("approving fires onDecide with 'approved'", async () => {
    const onDecide = vi.fn(async () => {});
    render(
      <ConfirmationQueue confirmations={[makeConfirmation("cfm-aaaaaa")]} onDecide={onDecide} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "approve" }));
    await waitFor(() => {
      expect(onDecide).toHaveBeenCalledWith("cfm-aaaaaa", "approved");
    });
  });

  it("rejecting fires onDecide with 'rejected'", async () => {
    const onDecide = vi.fn(async () => {});
    render(
      <ConfirmationQueue confirmations={[makeConfirmation("cfm-aaaaaa")]} onDecide={onDecide} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "reject" }));
    await waitFor(() => {
      expect(onDecide).toHaveBeenCalledWith("cfm-aaaaaa", "rejected");
    });
  });

  it("disables buttons while onDecide is in flight", async () => {
    let resolveFn: () => void = () => {};
    const onDecide = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveFn = resolve;
        }),
    );
    render(
      <ConfirmationQueue confirmations={[makeConfirmation("cfm-aaaaaa")]} onDecide={onDecide} />,
    );
    const approveBtn = screen.getByRole("button", { name: "approve" });
    fireEvent.click(approveBtn);
    // While pending, both buttons for this confirmation should be disabled.
    await waitFor(() => {
      expect(approveBtn).toBeDisabled();
      expect(screen.getByRole("button", { name: "reject" })).toBeDisabled();
    });
    // Resolve and wait for re-enable.
    resolveFn();
    await waitFor(() => {
      expect(approveBtn).not.toBeDisabled();
    });
  });
});
