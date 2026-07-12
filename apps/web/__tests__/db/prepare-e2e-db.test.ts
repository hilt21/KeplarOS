import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

import { requireE2eDatabasePath } from "../../e2e/db-path";

const prepareScript = resolve(process.cwd(), "scripts/prepare-e2e-db.mjs");

function runPrepare(databasePath?: string) {
  const { KEPLAR_DB_PATH: _ignored, ...environment } = process.env;
  return spawnSync(process.execPath, [prepareScript], {
    cwd: process.cwd(),
    env: databasePath ? { ...environment, KEPLAR_DB_PATH: databasePath } : environment,
    encoding: "utf8",
  });
}

describe("E2E database guards", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects an unset database path before prepare", () => {
    const result = runPrepare();

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Refusing to prepare a database other than");
  });

  it("rejects the developer database before prepare", () => {
    const result = runPrepare(resolve(process.cwd(), "db/dev.db"));

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("Refusing to prepare a database other than");
  });

  it("leaves a non-E2E database untouched when rejecting it", () => {
    const directory = mkdtempSync(resolve(tmpdir(), "keplar-e2e-guard-"));
    const databasePath = resolve(directory, "other.db");
    writeFileSync(databasePath, "sentinel");

    try {
      const result = runPrepare(databasePath);

      expect(result.status).not.toBe(0);
      expect(readFileSync(databasePath, "utf8")).toBe("sentinel");
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it("rejects non-E2E paths in E2E helpers", () => {
    vi.stubEnv("KEPLAR_DB_PATH", resolve(process.cwd(), "db/dev.db"));

    expect(requireE2eDatabasePath).toThrow("E2E requires KEPLAR_DB_PATH=");
  });
});
