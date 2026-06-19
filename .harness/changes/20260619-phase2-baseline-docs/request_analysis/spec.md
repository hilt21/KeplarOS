# Request Analysis Spec

Change ID: `20260619-phase2-baseline-docs`
Status: request_analysis

## Request Summary

Start Phase 2 development using the saved superpowers plan `docs/superpowers/plans/2026-06-19-phase2-web-collaboration-beta.md`, with Subagent-Driven Development and Test-Driven Development as the execution model.

The first approved implementation slice is F2-00: refresh the project documentation baseline so Phase 1 is explicitly marked complete, Phase 2 is defined as Web Collaboration Beta, and the testing documentation reflects the current executable pnpm/Vitest/Next.js baseline rather than the older "no executable test entry" state.

## Assumptions

- Phase 1 development is complete, per the user's statement.
- Phase 2 starts with the first feature in the saved plan: F2-00 Phase 2 baseline and docs refresh.
- Subagent-Driven Development will be used after request analysis and review approval.
- TDD applies to behavior-changing implementation features. For this documentation-only baseline feature, the equivalent red/green discipline is documentation verification: first identify stale assertions, then update docs, then verify no stale assertions remain.
- No application source code, runtime config, tests, database migrations, UI, or CI behavior should be changed in this feature.

## Scope

### In Scope

- Mark Phase 1 as complete in `docs/specs/phase1_scope.md`.
- Define Phase 2 as Web Collaboration Beta in documentation.
- Refresh `docs/architecture/test_matrix.md` so it references current executable verification commands.
- Add a Phase 2 API implementation note to `docs/specs/interface_spec.md`.
- Update `docs/README.md` only if needed to point readers to the Phase 2 baseline.
- Preserve the saved superpowers plan as the source plan for Phase 2 execution.
- Prepare this change for later Subagent-Driven execution and TDD-style verification.

### Out of Scope

- Implementing API routes.
- Implementing auth/session behavior.
- Implementing UI.
- Adding Playwright.
- Changing database schema or migrations.
- Changing CI.
- Running external MCP/ACP/A2A integrations.
- Production deployment, Kubernetes, enterprise SSO, or Tauri/Rust runtime work.

## Affected Areas

- API: documentation only, `docs/specs/interface_spec.md`.
- Data model: none.
- Authorization: none.
- UI/UX: none.
- Tests: documentation baseline only, `docs/architecture/test_matrix.md`.
- Docs: `docs/specs/phase1_scope.md`, `docs/architecture/test_matrix.md`, `docs/specs/interface_spec.md`, optionally `docs/README.md`.

## Acceptance Criteria

- [ ] `docs/specs/phase1_scope.md` states Phase 1 is complete and Phase 2 starts from the completed Web-first baseline.
- [ ] Documentation names Phase 2 as Web Collaboration Beta.
- [ ] `docs/architecture/test_matrix.md` no longer claims the repository has no executable test entry.
- [ ] `docs/architecture/test_matrix.md` includes the current root verification commands: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm format:check`, and `pnpm check`.
- [ ] `docs/specs/interface_spec.md` states Phase 2 implements `/api/v1` through Next.js route handlers using shared response, auth, authorization, state machine, audit, and realtime boundaries.
- [ ] No application source code, test code, database migration, UI, or CI behavior is changed.
- [ ] The implementation pass records verification evidence in `.harness/changes/20260619-phase2-baseline-docs/testing/results.md`.

## Risks

- Risk: Documentation may overstate Phase 2 implementation status before code exists.
  Mitigation: Phrase Phase 2 as the next implementation target, not as already delivered.
- Risk: F2-00 could accidentally expand into API or CI work.
  Mitigation: Keep this feature documentation-only and return to request analysis for any additional scope.
- Risk: TDD language can be awkward for docs-only work.
  Mitigation: Use stale-assertion verification as the RED step and post-edit grep/checks as the GREEN step.

## Open Questions

- None for F2-00. Later features require separate request analysis and approval.

## Approval Gate

Request Analysis must stop here until explicit human approval is given.
