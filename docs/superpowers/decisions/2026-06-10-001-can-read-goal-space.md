# ADR-001: `canReadGoalSpace` member access — fix in Wave 1

**Status:** Accepted
**Date:** 2026-06-10
**Deciders:** project owner
**Context finding:** SEC-001 / COR-005 / SEC-007 (see `docs/review/2026-06-08-full-repo-review/findings/security.json`)

## Context

`apps/web/src/lib/authorization/goal-space.ts:19` returns `false` for any non-initiator. The in-file comment documents this as an S2 scope boundary, but the spec (`docs/specs/authorization_matrix.md §3, §4`) requires node-board member access to grant goal-space read.

## Decision

Fix in Wave 1 (Phase 2, Task 2.5). Extend `GoalSpaceContext` with `nodeBoardMemberIds: readonly string[]`; `canReadGoalSpace` returns `true` when the actor is a member of any node board within the goal space.

## Consequences

- One MEDIUM authz task added to Wave 1.
- The S3 route handlers that compose goal-space read with node-board data will now compose correctly.
- The original S2 scope-boundary comment in `goal-space.ts:19` is replaced with a one-line "member-union per ADR-001" reference.
