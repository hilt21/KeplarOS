import { describe, it, expect } from "vitest";
import { schema } from "@db/schema";

describe("S1 smoke: React 18 + project workspace ready (carried into S2)", () => {
  it("Vitest can resolve the workspace `@db` alias to a module", () => {
    expect(schema).toBeDefined();
    expect(typeof schema).toBe("object");
  });

  it("S2 F-001 populates the schema with 11 KEPLAR domain tables", () => {
    // S1 placeholder was `export const schema = {} as const;`
    // S2 F-001 introduced 11 tables (users, goal_spaces, node_boards, node_board_members,
    // sessions, cards, agent_executions, state_transitions, human_confirmations,
    // audit_entries, realtime_events) — see docs/specs/database_design.md § 3.
    expect(Object.keys(schema)).toHaveLength(11);
  });

  it("Vitest jsdom environment provides DOM globals", () => {
    expect(typeof document).toBe("object");
    expect(typeof window).toBe("object");
  });
});
