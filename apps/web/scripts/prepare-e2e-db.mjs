import { existsSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const e2eDatabasePath = resolve(process.cwd(), "db/e2e.db");
const configuredPath = process.env.KEPLAR_DB_PATH && resolve(process.env.KEPLAR_DB_PATH);

if (configuredPath !== e2eDatabasePath) {
  throw new Error(`Refusing to prepare a database other than ${e2eDatabasePath}.`);
}

for (const path of [
  e2eDatabasePath,
  `${e2eDatabasePath}-journal`,
  `${e2eDatabasePath}-wal`,
  `${e2eDatabasePath}-shm`,
]) {
  if (existsSync(path)) rmSync(path);
}

const migrateScript = fileURLToPath(new URL("./migrate.mjs", import.meta.url));
const result = spawnSync(process.execPath, [migrateScript], {
  env: process.env,
  stdio: "inherit",
});

if (result.status !== 0) process.exitCode = result.status ?? 1;
