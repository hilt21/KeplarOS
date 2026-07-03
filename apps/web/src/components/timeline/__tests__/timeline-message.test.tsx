import { describe, expect, it, afterEach } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { TimelineMessage } from "../timeline-message";

afterEach(() => {
  cleanup();
});

describe("TimelineMessage", () => {
  it("renders user variant right-aligned", () => {
    render(<TimelineMessage variant="user" body="/execute CARD-1" />);
    expect(screen.getByText("/execute CARD-1")).toBeInTheDocument();
  });

  it("renders agent-thinking variant with AI icon", () => {
    const { container } = render(
      <TimelineMessage variant="agent-thinking" body="Reading the spec." />,
    );
    expect(screen.getByText("Reading the spec.")).toBeInTheDocument();
    expect(container.querySelector("[aria-label='Agent']")).not.toBeNull();
  });

  it("renders tool variant with mono log", () => {
    render(<TimelineMessage variant="tool" body="read_file · 124ms · signaling_timing_v2.json" />);
    expect(screen.getByText(/read_file/)).toBeInTheDocument();
  });

  it("renders confirmation variant with Approve / Reject buttons", () => {
    render(
      <TimelineMessage
        variant="confirmation"
        body="This will publish to the shared registry."
        onApprove={() => {}}
        onReject={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Approve" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reject" })).toBeInTheDocument();
  });

  it("renders system variant dimmed", () => {
    const { container } = render(<TimelineMessage variant="system" body="Waiting for approval…" />);
    expect(screen.getByText("Waiting for approval…")).toBeInTheDocument();
    expect(container.querySelector("[aria-label='Agent']")).toBeNull();
  });
});
