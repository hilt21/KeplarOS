# Request Analysis Skill

## Purpose

Turn an implementation request into approved planning artifacts without writing implementation code.

## Inputs

- User request
- `.harness/agents/application-owner.md`
- All files under `.harness/rules/`
- Relevant product, architecture, API, data, and test docs
- `DESIGN.md` when the request affects UI, UX, styling, layout, components, pages, or frontend behavior

## Outputs

- `.harness/changes/{change-id}/request_analysis/spec.md`
- `.harness/changes/{change-id}/request_analysis/tasks.md`
- `.harness/changes/{change-id}/request_analysis/feature_list.json`
- `.harness/changes/{change-id}/sprint_progress.md`

## Template Reference

Use these templates as the default structure unless the request requires a better fit:

- `.harness/templates/request-analysis-spec.md`
- `.harness/templates/request-analysis-tasks.md`
- `.harness/templates/request-analysis-feature_list.json`
- `.harness/templates/sprint_progress.md`

## Default Local Flow

1. Generate `change-id` using `YYYYMMDD-short-slug`.
2. Create `.harness/changes/{change-id}/request_analysis/`.
3. Read the request, harness rules, and relevant project docs.
4. Write `spec.md`, using `.harness/templates/request-analysis-spec.md` as reference, with:
   - request summary
   - assumptions
   - scope
   - non-goals
   - affected docs/modules
   - acceptance criteria
   - risks and open questions
5. Write `tasks.md`, using `.harness/templates/request-analysis-tasks.md` as reference, with:
   - implementation tasks
   - test tasks
   - verification steps
   - sequencing
6. Write `feature_list.json`, using `.harness/templates/request-analysis-feature_list.json` as reference, with:
   - `change_id`
   - `title`
   - `status`
   - `features[]`
   - each feature's `id`, `title`, `description`, `scope`, `priority`, `acceptance_criteria`, `affected_areas`, `dependencies`, `test_needs`, `definition_of_done`, `verification`, `implementation_status`, `test_status`, and `done_status`
7. Write `sprint_progress.md`, using `.harness/templates/sprint_progress.md` as reference, with:
   - change ID
   - current status
   - phase status table
   - current blockers
   - completed artifacts
   - next step
8. Stop and wait for explicit human approval.

## feature_list.json Minimum Shape

```json
{
  "change_id": "20260606-add-goal-space-api",
  "title": "Add Goal Space API",
  "status": "request_analysis",
  "features": [
    {
      "id": "F-001",
      "title": "Create Goal Space API",
      "description": "Allow an initiator to create a goal space.",
      "scope": "in",
      "priority": "P0",
      "acceptance_criteria": [
        "Creates a draft goal space"
      ],
      "affected_areas": [
        "api",
        "database"
      ],
      "dependencies": [],
      "test_needs": [
        "API contract test"
      ],
      "definition_of_done": [
        "Acceptance criteria satisfied",
        "Required tests pass",
        "Required verification matrix items pass or have documented exceptions",
        "No unresolved blocking review findings"
      ],
      "verification": {
        "lint": "required",
        "typecheck": "required",
        "unit": "required",
        "integration": "optional",
        "api_contract": "required",
        "migration": "not_applicable",
        "smoke": "optional",
        "e2e": "optional"
      },
      "implementation_status": "not_started",
      "test_status": "not_started",
      "done_status": "not_started"
    }
  ]
}
```

## Feature Success Definition

A feature is successfully implemented only when:

- all acceptance criteria are satisfied
- `implementation_status` is `completed`
- `test_status` is `passed` or `justified_unavailable`
- all required verification matrix items are `passed` or have a documented exception
- there are no unresolved blocking review findings
- there is no unapproved scope deviation
- `sprint_progress.md` is updated

## sprint_progress.md Minimum Shape

```md
# Sprint Progress

Change ID: 20260606-add-goal-space-api
Status: request_analysis

## Phase Status

| Phase | Status | Notes |
|------|--------|-------|
| Request Analysis | Done | Awaiting approval |
| Review | Not Started | |
| Implementation | Not Started | |
| Testing | Not Started | |
| Delivery | Not Started | |

## Current Blockers

- Awaiting human approval.

## Completed

- request_analysis/spec.md
- request_analysis/tasks.md
- request_analysis/feature_list.json

## Next Step

- Human approves request analysis or asks for revision.
```

## Optional Delegation

May consult these skills when available:

- gstack `plan-eng-review`
- gstack `autoplan`
- superpowers `writing-plans`
- ECC planning or review skills

## Fallback Behavior

If delegated skills are unavailable, continue with the Default Local Flow. Missing external skills must not block request analysis.
