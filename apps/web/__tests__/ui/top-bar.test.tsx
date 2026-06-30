import { describe, expect, it, vi, afterEach } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import { TopBar } from "@/components/top-bar";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

afterEach(() => {
  cleanup();
});

describe("TopBar", () => {
  it("renders all breadcrumb segments", () => {
    render(
      <TopBar
        segments={[
          { label: "Railway Metro 2026 Q1", href: "/goal-spaces/gs-1" },
          { label: "Main board", href: "/goal-spaces/gs-1" },
          { label: "CARD-004 Signaling timing" },
        ]}
        tokensUsed={2400}
        tokensCap={8000}
        onOpenCommandPalette={() => {}}
      />,
    );
    expect(screen.getByText("KEPLAR")).toBeInTheDocument();
    expect(screen.getByText("Railway Metro 2026 Q1")).toBeInTheDocument();
    expect(screen.getByText("Main board")).toBeInTheDocument();
    expect(screen.getByText("CARD-004 Signaling timing")).toBeInTheDocument();
  });

  it("renders tokensUsed on the right", () => {
    render(
      <TopBar segments={[]} tokensUsed={2400} tokensCap={8000} onOpenCommandPalette={() => {}} />,
    );
    expect(screen.getByText("2.4k")).toBeInTheDocument();
  });

  it("calls onOpenCommandPalette when CMD K button clicked", () => {
    const onOpen = vi.fn();
    render(
      <TopBar segments={[]} tokensUsed={0} tokensCap={0} onOpenCommandPalette={onOpen} />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Open command palette" }));
    expect(onOpen).toHaveBeenCalled();
  });
});
