-- 0011_auth_credentials.sql
-- Wave 3 SEC-006: Add auth_credentials table for password hashing + failed-login tracking.
-- Per docs/specs/non_functional_requirements.md §4.2.
--
-- The `users` table intentionally holds only identity/profile fields (id, name,
-- email, role, preferences, createdAt, lastLoginAt). Authentication credentials
-- are isolated in a separate 1:1 table so that:
--   - users can be created without credentials (invited, agent, service)
--   - credentials can be rotated independently
--   - failed-login state can be cleared without touching the user record
--
-- The current implementation stores scrypt-hashed values (Node built-in,
-- sandbox-safe). The interface in src/lib/auth/password.ts is intentionally
-- narrow so a future argon2id backend can be swapped in without callers
-- changing.

PRAGMA foreign_keys=OFF;--> statement-breakpoint
BEGIN TRANSACTION;--> statement-breakpoint

CREATE TABLE auth_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  password_hash TEXT NOT NULL,
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_rotated_at TEXT NOT NULL DEFAULT (datetime('now'))
);--> statement-breakpoint

COMMIT;--> statement-breakpoint
PRAGMA foreign_keys=ON;