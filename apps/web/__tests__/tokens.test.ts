import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * DESIGN.md bridge coverage. Asserts that the design tokens file declares
 * the canonical tokens required by the S1 acceptance criteria. If the
 * upstream DESIGN.md palette changes, update this list to keep tests honest.
 */
const REQUIRED_COLOR_TOKENS = [
  "--color-bg",
  "--color-surface",
  "--color-surface-elevated",
  "--color-border",
  "--color-text-primary",
  "--color-text-secondary",
  "--color-text-muted",
  "--color-primary",
  "--color-primary-hover",
  "--color-secondary",
  "--color-success",
  "--color-warning",
  "--color-error",
  "--color-info",
];

const REQUIRED_SPACING_TOKENS = [
  "--space-2xs",
  "--space-xs",
  "--space-sm",
  "--space-md",
  "--space-lg",
  "--space-xl",
  "--space-2xl",
  "--space-3xl",
];

describe("Design tokens bridge to DESIGN.md (TT-1 / MT-2)", () => {
  const tokensPath = join(__dirname, "..", "src", "styles", "tokens.css");
  const source = readFileSync(tokensPath, "utf8");

  it.each(REQUIRED_COLOR_TOKENS)("declares color token %s", (token) => {
    expect(source).toContain(`${token}:`);
  });

  it.each(REQUIRED_SPACING_TOKENS)("declares spacing token %s", (token) => {
    expect(source).toContain(`${token}:`);
  });

  it("uses dark-mode default per DESIGN.md", () => {
    // The dark color palette starts with #0b0f19 (--color-bg).
    // Prettier normalizes hex colors to lowercase; accept either case.
    expect(source).toMatch(/#0b0f19/i);
  });
});
