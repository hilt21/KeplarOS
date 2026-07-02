/**
 * WorkspacePanel — token meter + workspace metadata test.
 *
 * Verifies:
 *   - The token-meter inner bar's `width` style matches `used / cap`.
 *   - The formatted "X / Y" text reflects the same values.
 *   - All workspace metadata rows render the provided info.
 *   - The env badge in the header shows the supplied env string.
 *
 * WorkspacePanel seeds the `tokensStore` from its `info` prop on mount
 * via `useEffect`. We seed the store ourselves in `beforeEach` to
 * keep the snapshot reference stable.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

import { WorkspacePanel } from "../detail-pane/workspace-panel";
import { tokensStore } from "@/lib/state/tokens-store";

const baseInfo = {
  goalSpaceName: "Alpha",
  boardName: "Board A",
  userName: "Test User",
  userRole: "Engineer",
  runtime: "Next.js · React",
  apiBase: "/api/v1",
};

beforeEach(() => {
  tokensStore.setState({ used: 0, cap: 100000 });
});

afterEach(() => {
  cleanup();
});

describe("WorkspacePanel — token meter", () => {
  it("renders the used / cap text formatted with locale separators", async () => {
    render(
      <WorkspacePanel info={{ ...baseInfo, tokensUsed: 50000, tokensCap: 100000 }} env="dev" />,
    );

    await waitFor(() => {
      expect(screen.getByText("50,000 / 100,000")).toBeInTheDocument();
    });
  });

  it("sets the progress-bar inner width to (used / cap) percent", async () => {
    const { container } = render(
      <WorkspacePanel info={{ ...baseInfo, tokensUsed: 50000, tokensCap: 100000 }} env="dev" />,
    );

    await waitFor(() => {
      // WorkspacePanel renders two nested <div>s — outer is the track
      // (width: 120), inner is the filled bar (width: `${pct}%`).
      // Find the inner bar by inspecting the computed width against pct.
      const divs = Array.from(container.querySelectorAll("div"));
      const inner = divs.find((d) => {
        const style = (d as HTMLElement).getAttribute("style") ?? "";
        return /width:\s*50%/.test(style);
      });
      expect(inner).toBeTruthy();
    });
  });

  it("caps the meter at 100% when usage exceeds the cap", async () => {
    const { container } = render(
      <WorkspacePanel info={{ ...baseInfo, tokensUsed: 150000, tokensCap: 100000 }} env="dev" />,
    );

    await waitFor(() => {
      const divs = Array.from(container.querySelectorAll("div"));
      const inner = divs.find((d) => {
        const style = (d as HTMLElement).getAttribute("style") ?? "";
        return /width:\s*100%/.test(style);
      });
      expect(inner).toBeTruthy();
    });
    // The text label still shows the raw used / cap values (no clamping
    // of the display string).
    expect(screen.getByText("150,000 / 100,000")).toBeInTheDocument();
  });

  it("renders 0% when cap is 0 (uses a 1-safe denominator)", async () => {
    const { container } = render(
      <WorkspacePanel info={{ ...baseInfo, tokensUsed: 0, tokensCap: 0 }} env="dev" />,
    );

    await waitFor(() => {
      const divs = Array.from(container.querySelectorAll("div"));
      const inner = divs.find((d) => {
        const style = (d as HTMLElement).getAttribute("style") ?? "";
        return /width:\s*0%/.test(style);
      });
      expect(inner).toBeTruthy();
    });
    expect(screen.getByText("0 / 0")).toBeInTheDocument();
  });

  it("renders the workspace metadata rows", () => {
    render(<WorkspacePanel info={{ ...baseInfo, tokensUsed: 100, tokensCap: 1000 }} env="prod" />);
    expect(screen.getByText("WORKSPACE")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Board A")).toBeInTheDocument();
    expect(screen.getByText("Test User · Engineer")).toBeInTheDocument();
    expect(screen.getByText("Next.js · React")).toBeInTheDocument();
    expect(screen.getByText("/api/v1")).toBeInTheDocument();
    expect(screen.getByText("prod")).toBeInTheDocument();
  });
});
