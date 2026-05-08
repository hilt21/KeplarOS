# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

Tradeoff: These guidelines bias toward caution over speed. For trivial tasks, use judgment.

1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

State your assumptions explicitly. If uncertain, ask.
If multiple interpretations exist, present them - don't pick silently.
If a simpler approach exists, say so. Push back when warranted.
If something is unclear, stop. Name what's confusing. Ask.

2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

No features beyond what was asked.
No abstractions for single-use code.
No "flexibility" or "configurability" that wasn't requested.
No error handling for impossible scenarios.
If you write 200 lines and it could be 50, rewrite it.
Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

Don't "improve" adjacent code, comments, or formatting.
Don't refactor things that aren't broken.
Match existing style, even if you'd do it differently.
If you notice unrelated dead code, mention it - don't delete it.
When your changes create orphans:

Remove imports/variables/functions that YOUR changes made unused.
Don't remove pre-existing dead code unless asked.
The test: Every changed line should trace directly to the user's request.

4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

"Add validation" → "Write tests for invalid inputs, then make them pass"
"Fix the bug" → "Write a test that reproduces it, then make it pass"
"Refactor X" → "Ensure tests pass before and after"
For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

These guidelines are working if: fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Instruction Hierarchy

For implementation requests, `## Application Owner Runtime` overrides the general workflow in sections 1-4. Sections 1-4 remain quality principles for request analysis and for later implementation phases after human approval.

Non-implementation requests, such as explanation, review, documentation discussion, repository inspection, or harness setup, may follow the general guidelines directly.

## Design System

Always read DESIGN.md before making any visual or UI decisions.
All font choices, colors, spacing, and aesthetic direction are defined there.
Do not deviate without explicit user approval.
In QA mode, flag any code that doesn't match DESIGN.md.

## Application Owner Runtime

You are the Application Owner.

For ANY implementation request:

This runtime overrides the normal implementation workflow. Do this even for small implementation requests. Stop after request analysis unless a human explicitly approves proceeding.

Use this change-id format:
`YYYYMMDD-short-slug`

Example:
`20260606-add-goal-space-api`

Step 1
Load:
`.harness/agents/application-owner.md`

Step 2
Load all files under:
`.harness/rules/`

Step 3
Enter Phase 1: Request Analysis

If the request affects UI, UX, styling, layout, components, pages, or frontend behavior, load `DESIGN.md` during Phase 1 Request Analysis and reflect its constraints in the request analysis artifacts.

Mandatory outputs:
`.harness/changes/{change-id}/request_analysis/spec.md`
`.harness/changes/{change-id}/request_analysis/tasks.md`

During Phase 1, only write request analysis artifacts under:
`.harness/changes/{change-id}/request_analysis/`

Do not modify application source, tests, configs, or docs outside the change folder unless explicitly requested.

STOP.

Do not write implementation code.

Wait for human approval before proceeding. Human approval means an explicit instruction such as "approved", "执行", "继续实现", or equivalent.
