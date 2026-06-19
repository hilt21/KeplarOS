# ADR-003: `users.role` default change — hard backfill + default flip

**Status:** Accepted
**Date:** 2026-06-10
**Deciders:** project owner
**Context finding:** DB-036 (HIGH) + DB-037 (LOW) (see `docs/review/2026-06-08-full-repo-review/findings/database.json`)

## Context

`apps/web/db/schema.ts:123` declares `users.role` with `.default("initiator")`. This is a security concern — every new user is automatically the highest-privilege role. Spec (`docs/specs/database_design.md §3.11`) requires the default to be `chain_user`.

## Decision

Single migration that:
1. `UPDATE users SET role = 'chain_user' WHERE role = 'initiator';` (irreversible without a backup)
2. `ALTER TABLE users` change default to `'chain_user'` (Drizzle: change `.default("initiator")` to `.default("chain_user")` in schema.ts)
3. Document in the migration SQL that the backfill is intentional per ADR-003.

## Consequences

- The migration is destructive: any user currently stored as `initiator` becomes `chain_user` on the next deploy.
- Acceptable for S1/S2 because: (a) the spec mandates the default, (b) real `initiator` rows can be re-promoted by an S3 admin endpoint, (c) the security risk of leaving the default is greater than the operational risk of a one-time backfill.
- The migration should run inside a transaction with a sanity-check `SELECT` after the UPDATE.
- New row inserts default to `chain_user`.
- **For production:** the migration runner should be inspected manually before apply; the plan's ADR-004 (migration template) will add a `pre-migration` row count of `initiator` users for audit.
