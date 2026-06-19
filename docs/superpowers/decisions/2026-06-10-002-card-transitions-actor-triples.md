# ADR-002: `CARD_TRANSITIONS` refactor — per-(from,to,trigger) actor triples

**Status:** Accepted
**Date:** 2026-06-10
**Deciders:** project owner
**Context finding:** COR-003 (see `docs/review/2026-06-08-full-repo-review/findings/correctness.json`)

## Context

`apps/web/src/lib/state-machine/card.ts:60-170` keys transitions as `(from, to)` pairs with a `triggers[]` array, sharing one `actor` field across all triggers. As a result, `human_reject` (a human-initiated trigger) records `actor: 'ai_role'`, losing audit attribution. Spec (`docs/specs/ai_agent_contracts.md §4`) requires the actor to reflect who performed the transition.

## Decision

Refactor `CARD_TRANSITIONS` to be keyed on `(from, to, trigger)` triples, each with its own `actor` field. For any rule with `trigger` starting with `human_` (e.g. `human_reject`, `human_confirm`), set `actor: 'human'`. Add a backward-compat helper `actorFor(from, to, trigger): ActorType` if any consumer depends on the pair-keyed shape.

## Consequences

- Larger diff in `state-machine/card.ts` (Phase 2, Task 2.3).
- Audit trail correctly attributes human-initiated moves to `human`.
- Unit tests must cover: `human_reject` records `actor: 'human'`, `human_confirm` records `actor: 'human'`.
- The state-machine lookup function changes from `findRule(from, to, trigger)` to `findRule(from, to, trigger)` (same signature) returning a single triple-keyed rule.
