# Expert Reviewer Skill

## Purpose

Review approved request analysis artifacts before implementation begins. Identify risks, missing requirements, sequencing issues, and test gaps.

## Inputs

- `.harness/changes/{change-id}/request_analysis/spec.md`
- `.harness/changes/{change-id}/request_analysis/tasks.md`
- `.harness/changes/{change-id}/request_analysis/feature_list.json`
- `.harness/changes/{change-id}/sprint_progress.md`
- `.harness/agents/application-owner.md`
- All files under `.harness/rules/`
- Relevant project docs and existing implementation, if any

## Outputs

- `.harness/changes/{change-id}/review/findings.md`
- update `.harness/changes/{change-id}/sprint_progress.md`

## Template Reference

Use these templates as the default structure unless the request requires a better fit:

- `.harness/templates/review-findings.md`
- `.harness/templates/sprint_progress.md`

## Default Local Flow

1. Read request analysis artifacts, `feature_list.json`, `sprint_progress.md`, and applicable rules.
2. Check scope, assumptions, non-goals, feature list, and acceptance criteria for ambiguity.
3. Check task sequencing and dependencies.
4. Check whether tests and verification cover the requested behavior.
5. Check whether implementation would violate Phase 1 scope or design constraints.
6. Write `findings.md`, using `.harness/templates/review-findings.md` as reference, with:
   - blocking findings
   - non-blocking risks
   - missing test coverage
   - open questions
   - recommendation: proceed, revise request analysis, or stop
7. Update `sprint_progress.md` with review status, blockers, completed artifacts, and next step.

## Optional Delegation

May consult these skills when available:

- gstack `review`
- gstack `plan-eng-review`
- superpowers `requesting-code-review`
- ECC review skills

## Fallback Behavior

If delegated skills are unavailable, continue with the Default Local Flow. Missing external skills must not block review.
