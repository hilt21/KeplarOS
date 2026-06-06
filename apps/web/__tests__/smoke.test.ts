import { describe, it, expect } from "vitest";
import { schema } from "@db/schema";

describe("S1 smoke: React 18 + project workspace ready", () => {
  it("Vitest can resolve the workspace `@db` alias to a module", () => {
    expect(schema).toBeDefined();
    expect(typeof schema).toBe("object");
  });

  it("Empty S1 schema is intentionally empty (S2 will populate)", () => {
    expect(Object.keys(schema)).toHaveLength(0);
  });

  it("Vitest jsdom environment provides DOM globals", () => {
    expect(typeof document).toBe("object");
    expect(typeof window).toBe("object");
  });
});
