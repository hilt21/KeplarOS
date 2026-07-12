import { describe, expect, it } from "vitest";
import { resolve } from "node:path";

import { resolveDatabasePath } from "@/lib/db/client";

describe("resolveDatabasePath", () => {
  it("defaults to the development database", () => {
    expect(resolveDatabasePath(undefined)).toBe(resolve(process.cwd(), "db/dev.db"));
  });

  it("uses an explicit database path", () => {
    expect(resolveDatabasePath("db/e2e.db")).toBe(resolve(process.cwd(), "db/e2e.db"));
  });
});
