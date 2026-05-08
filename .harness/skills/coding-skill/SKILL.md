# Coding Skill

## Purpose

Implement an approved change with surgical scope, using the approved request analysis and review artifacts as the source of truth.

## Inputs

- Explicit human approval to proceed
- `.harness/changes/{change-id}/request_analysis/spec.md`
- `.harness/changes/{change-id}/request_analysis/tasks.md`
- `.harness/changes/{change-id}/request_analysis/feature_list.json`
- `.harness/changes/{change-id}/sprint_progress.md`
- `.harness/changes/{change-id}/review/findings.md`, if present
- All files under `.harness/rules/`
- Relevant source files and project docs
- `DESIGN.md` when UI or frontend behavior is affected

## Outputs

- Implementation diff
- `.harness/changes/{change-id}/implementation/notes.md`
- update `.harness/changes/{change-id}/request_analysis/feature_list.json`
- update `.harness/changes/{change-id}/sprint_progress.md`

## Implementation Control

Constrain implementation to one feature at a time.

- No overreach.
- No half-finishing multiple features at once.
- No rewriting `feature_list.json` to hide unfinished work.
- If a second feature becomes necessary, stop immediately and return to Phase 1: Request Analysis for a scope amendment.
- Unfinished work must remain visible in `feature_list.json`, `implementation/notes.md`, and `sprint_progress.md`.

Scope amendments must update:

- `.harness/changes/{change-id}/request_analysis/spec.md`
- `.harness/changes/{change-id}/request_analysis/tasks.md`
- `.harness/changes/{change-id}/request_analysis/feature_list.json`
- `.harness/changes/{change-id}/sprint_progress.md`

After the amendment, re-enter Phase 2: Review. Do not implement the added feature until the amended scope passes review and receives explicit human approval.

## Template Reference

Use these templates as the default structure unless the request requires a better fit:

- `.harness/templates/implementation-notes.md`
- `.harness/templates/request-analysis-feature_list.json`
- `.harness/templates/sprint_progress.md`

## Default Local Flow

1. Confirm explicit human approval exists.
2. Read request analysis, tasks, feature list, sprint progress, review findings, and applicable rules.
3. Select exactly one approved feature from `feature_list.json` for this implementation pass.
4. Keep changes minimal and traceable to the approved tasks.
5. Do not introduce speculative features or abstractions.
6. Update or create tests when required by the approved tasks.
7. Write `notes.md`, using `.harness/templates/implementation-notes.md` as reference, with:
   - files changed
   - implementation summary
   - deviations from plan, if any
   - remaining risks or follow-ups
8. Update `feature_list.json` feature statuses when implementation work starts or completes.
9. Update `sprint_progress.md` with implementation status, blockers, completed artifacts, and next step.

## Optional Delegation

May consult these skills when available:

- superpowers `executing-plans`
- superpowers `test-driven-development`
- gstack language/framework skills when applicable
- ECC implementation skills

## Fallback Behavior

If delegated skills are unavailable, continue with the Default Local Flow. Missing external skills must not block implementation after approval.
