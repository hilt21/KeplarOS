# Request Analysis Tasks

Change ID: `20260619-phase2-baseline-docs`
Status: request_analysis

## Implementation Tasks

- [ ] Update `docs/specs/phase1_scope.md` with a Phase 1 completion section and Phase 2 start statement.
  - Verify: `rg -n "Phase 1 Completion|Web Collaboration Beta|Phase 2" docs/specs/phase1_scope.md`

- [ ] Update `docs/architecture/test_matrix.md` to remove stale "no executable test entry" wording and document current pnpm verification commands.
  - Verify: `rg -n "尚未具备可执行测试入口|no executable test entry" docs/architecture/test_matrix.md` returns no matches.
  - Verify: `rg -n "pnpm (typecheck|lint|test|build|format:check|check)" docs/architecture/test_matrix.md`

- [ ] Update `docs/specs/interface_spec.md` with the Phase 2 `/api/v1` implementation note.
  - Verify: `rg -n "Phase 2|/api/v1|Next.js route handlers|authorization|audit|realtime" docs/specs/interface_spec.md`

- [ ] Update `docs/README.md` only if it needs a Phase 2 entry point.
  - Verify: `git diff -- docs/README.md` shows only Phase 2 navigation/baseline text if changed.

## Test Tasks

- [ ] RED-style documentation verification: identify stale assertions before editing.
  - Verify: `rg -n "尚未具备可执行测试入口|package.json 没有 scripts|当前仓库尚未具备|尚未集成 Vitest|尚未提供" docs/architecture/test_matrix.md docs/specs/global_unified_spec.md docs/README.md`

- [ ] GREEN-style documentation verification: confirm stale F2-00 target assertions are removed or scoped correctly.
  - Verify: repeat the stale assertion search and confirm no stale assertion remains in the F2-00 touched files.

- [ ] Run formatting/diff checks for changed Markdown files.
  - Verify: `git diff --check`

## Documentation Tasks

- [ ] Keep Phase 2 wording future-oriented.
  - Verify: changed docs do not claim auth/API/UI/E2E are already implemented.

- [ ] Keep out-of-scope future capabilities out of Phase 2.
  - Verify: changed docs still defer Tauri, Rust Axum, production Kubernetes, enterprise SSO, and real MCP/ACP/A2A external writes.

## Sequencing

1. Step: Run RED-style stale documentation search.
   Verify: stale claims are identified before edits.
2. Step: Update `phase1_scope.md`.
   Verify: Phase 1 completion and Phase 2 start are explicit.
3. Step: Update `test_matrix.md`.
   Verify: executable pnpm commands are listed and stale "no test entry" wording is gone.
4. Step: Update `interface_spec.md`.
   Verify: Phase 2 route-handler implementation note is present.
5. Step: Optionally update `docs/README.md`.
   Verify: only navigation/baseline text changes.
6. Step: Run GREEN-style stale documentation search and `git diff --check`.
   Verify: checks pass or exceptions are recorded in testing results.

## Dependencies

- `docs/superpowers/plans/2026-06-19-phase2-web-collaboration-beta.md`
- `docs/specs/phase1_scope.md`
- `docs/architecture/test_matrix.md`
- `docs/specs/interface_spec.md`
- Root `package.json` verification scripts.

## Stop Condition

Stop after writing request analysis artifacts and wait for human approval.
