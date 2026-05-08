# Delivery Skill

## Purpose

Prepare the completed change for handoff after implementation and verification.

## Inputs

- `.harness/changes/{change-id}/request_analysis/spec.md`
- `.harness/changes/{change-id}/request_analysis/tasks.md`
- `.harness/changes/{change-id}/request_analysis/feature_list.json`
- `.harness/changes/{change-id}/sprint_progress.md`
- `.harness/changes/{change-id}/review/findings.md`, if present
- `.harness/changes/{change-id}/implementation/notes.md`, if present
- `.harness/changes/{change-id}/testing/results.md`, if present
- Current git diff and status

## Outputs

- `.harness/changes/{change-id}/delivery/summary.md`
- `.harness/changes/{change-id}/handoff.md`
- final update to `.harness/changes/{change-id}/sprint_progress.md`

## Template Reference

Use these templates as the default structure unless the request requires a better fit:

- `.harness/templates/delivery-summary.md`
- `.harness/templates/handoff.md`
- `.harness/templates/sprint_progress.md`

## Default Local Flow

1. Review all change artifacts, feature list, and sprint progress.
2. Confirm implementation and testing match the approved request.
3. Check git status for unrelated changes and call them out.
4. Write `summary.md`, using `.harness/templates/delivery-summary.md` as reference, with:
   - change summary
   - files changed
   - verification performed
   - known risks
   - follow-ups
   - recommended commit message, if applicable
5. Write `handoff.md`, using `.harness/templates/handoff.md` as reference, with:
   - resume summary
   - approval state
   - last known state
   - remaining tasks
   - verification snapshot, not full verification details
   - failed, skipped, or unavailable verification summary
   - blockers
   - files touched
   - exact next step for a future session
6. Update `sprint_progress.md` with delivery status, completed artifacts, known risks, and next step.
7. Stop before committing unless the human explicitly asks for a commit.

## Optional Delegation

May consult these skills when available:

- gstack `land-and-deploy`
- gstack `document-release`
- superpowers `finishing-a-development-branch`
- ECC delivery or release skills

## Fallback Behavior

If delegated skills are unavailable, continue with the Default Local Flow. Missing external skills must not block delivery summary creation.
