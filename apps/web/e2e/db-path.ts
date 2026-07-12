import { resolve } from "node:path";

export const E2E_DB_PATH = resolve(process.cwd(), "db/e2e.db");

export function requireE2eDatabasePath(): string {
  if (process.env.KEPLAR_DB_PATH !== E2E_DB_PATH) {
    throw new Error(`E2E requires KEPLAR_DB_PATH=${E2E_DB_PATH}.`);
  }
  return E2E_DB_PATH;
}
