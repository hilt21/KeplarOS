# Unit Test Write Skill

## Purpose

Create and run focused tests for the approved change, with coverage tied to acceptance criteria and implementation risks.

## Inputs

- `.harness/changes/{change-id}/request_analysis/spec.md`
- `.harness/changes/{change-id}/request_analysis/tasks.md`
- `.harness/changes/{change-id}/request_analysis/feature_list.json`
- `.harness/changes/{change-id}/sprint_progress.md`
- `.harness/changes/{change-id}/implementation/notes.md`, if present
- Implementation diff
- Existing test framework and project conventions
- All files under `.harness/rules/`

## Outputs

- Test diff
- `.harness/changes/{change-id}/testing/results.md`
- update `.harness/changes/{change-id}/request_analysis/feature_list.json`
- update `.harness/changes/{change-id}/sprint_progress.md`

## Verification Matrix

Evaluate and record these checks in `testing/results.md`:

| Check | Default requirement | Required when |
|------|---------------------|---------------|
| lint | required when command exists | any source, test, config, or docs tooling change |
| typecheck | required when command exists | TypeScript or typed API/schema changes |
| unit | required when test framework exists | logic, state machine, validation, or contract changes |
| integration | optional by default | cross-module behavior or persistence boundary changes |
| api_contract | required when applicable | REST, SSE, error code, or API schema changes |
| migration | required when applicable | database schema, migration, or persistence changes |
| smoke | required when app/API can run locally | user-visible or API runtime changes |
| e2e | optional by default | critical user path changes or existing e2e harness availability |

Skipped, unavailable, or not-applicable checks must be recorded with reason and risk. Required checks must pass or have a documented exception before a feature can be marked done.

## Template Reference

Use these templates as the default structure unless the request requires a better fit:

- `.harness/templates/testing-results.md`
- `.harness/templates/request-analysis-feature_list.json`
- `.harness/templates/sprint_progress.md`

## Default Local Flow

1. Detect the project's available test framework and commands.
2. Map acceptance criteria, feature test needs, and changed code paths to tests.
3. Add focused unit or integration tests where appropriate.
4. Run the smallest relevant test command first.
5. Evaluate the verification matrix and run required available checks.
6. Write `results.md`, using `.harness/templates/testing-results.md` as reference, with:
   - tests added or updated
   - commands run
   - verification matrix results
   - skipped or unavailable check reasons
   - pass/fail results
   - untested risks
   - follow-up test recommendations
7. Update `feature_list.json` with test status per feature when practical.
8. Update `sprint_progress.md` with testing status, blockers, completed artifacts, and next step.

## Optional Delegation

May consult these skills when available:

- superpowers `verification-before-completion`
- language-specific testing skills
- gstack QA or verification skills
- ECC testing skills

## Fallback Behavior

If delegated skills are unavailable, continue with the Default Local Flow. Missing external skills must not block test creation or verification.
