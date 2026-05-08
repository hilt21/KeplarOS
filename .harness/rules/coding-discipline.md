# Coding Discipline

Default implementation boundaries for harness work.

Rules are ordered by cost of failure: prevent expensive mistakes first, then improve execution quality.

## NEVER

- NEVER implement code before Phase 1 Request Analysis artifacts exist and explicit human approval is recorded.
- NEVER implement more than one approved feature in a single implementation pass.
- NEVER rewrite `feature_list.json` to hide unfinished work, failed verification, deferred scope, or blockers.
- NEVER bypass the required review or testing phase for an implementation change.
- NEVER claim a feature is done without verification evidence or a documented unavailable-check exception.
- NEVER introduce future or production scope into an approved feature unless the scope amendment returns to Phase 1 Request Analysis and passes Phase 2 Review.
- NEVER perform destructive git operations such as reset, checkout, clean, rebase, or force push unless the human explicitly asks for that exact operation.
- NEVER delete or overwrite user work, unrelated changes, audit artifacts, sprint progress, handoff records, or review findings.
- NEVER depend on local-only external skill paths as the source of truth. Project-owned harness files are authoritative.

## DO NOT

- DO NOT modify files unrelated to the current approved feature.
- DO NOT broaden scope because an adjacent cleanup is tempting.
- DO NOT add speculative abstractions, configurability, error handling, or framework machinery.
- DO NOT start external writes, production deployment, infrastructure expansion, or observability platform work unless explicitly approved.
- DO NOT treat generated artifacts as disposable. Keep `.harness/changes/{change-id}/` accurate and current.
- DO NOT skip updating `sprint_progress.md` before ending a session.
- DO NOT leave `feature_list.json` inconsistent with implementation, testing, or delivery status.
- DO NOT mark skipped verification as passed. Record skipped, unavailable, or not-applicable checks with reason and risk.
- DO NOT commit unless the human explicitly asks for a commit.

## Recommendations

- Prefer the smallest implementation that satisfies the approved acceptance criteria.
- Keep changed lines traceable to the current feature ID.
- Use `.harness/templates/` as the default artifact structure, adapting only when the request genuinely needs it.
- Run `.harness/skills/init.sh` when available before implementation and again before claiming done.
- Keep `implementation/notes.md` factual: files changed, feature worked on, deviations, risks, and verification already performed.
- Keep `handoff.md` concise. It is a next-session recovery snapshot, not a duplicate of all progress or test output.
- If a change needs a second feature, stop immediately and use the scope amendment flow.

## Repeated Error Backfill

If the same class of mistake appears more than once, do not rely on another verbal reminder.

Backfill it into the harness:

1. Add or tighten a rule in this directory.
2. Add the check to the relevant phase skill if it belongs in a workflow.
3. Add or update a verification step in `.harness/skills/init.sh` or the testing skill when it can be checked automatically.
4. Record the rule or check update in the active change's `sprint_progress.md`.

Examples that should become rules or checks:

- scope creep across multiple features
- missing `feature_list.json` status updates
- skipped verification with no reason
- docs and implementation diverging
- repeated type, lint, migration, or API contract failures
- misplaced harness artifacts
