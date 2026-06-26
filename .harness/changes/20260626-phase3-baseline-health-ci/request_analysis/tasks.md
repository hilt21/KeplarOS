# Request Analysis Tasks

Change ID: `20260626-phase3-baseline-health-ci`
Status: approved_for_implementation

## Implementation Tasks

- [ ] Create required harness artifacts for P3-00.
  - Verify: artifacts exist under `.harness/changes/20260626-phase3-baseline-health-ci/`.
- [ ] Update `apps/web/.prettierignore` with the exact requested generated-artifact entries.
  - Verify: file contents match the requested six-line ignore list.
- [ ] Run Prettier only on the source/config files reported by the baseline `format:check`, excluding generated `test-results/` paths.
  - Verify: source/config diffs are formatting-only.

## Test Tasks

- [ ] Run runtime/version checks.
  - Verify: `node --version` and `pnpm --version` outputs are recorded.
- [ ] Run required web verification checks.
  - Verify: `format:check`, `typecheck`, `lint`, `test`, and `build` outcomes are recorded.
- [ ] Run repository whitespace check.
  - Verify: `git diff --check` exits 0.

## Documentation Tasks

- [ ] Record implementation notes.
  - Verify: `implementation/notes.md` exists and lists files changed, scope, deviations, and risks.
- [ ] Record testing results.
  - Verify: `testing/results.md` includes command outcomes, lint warnings, and Node mismatch risk.
- [ ] Record delivery summary and handoff.
  - Verify: `delivery/summary.md` and `handoff.md` exist.

## Sequencing

1. Step: Create request analysis artifacts and initial progress tracker.
   Verify: artifacts are present.
2. Step: Apply `.prettierignore` update.
   Verify: generated artifact paths are ignored by Prettier.
3. Step: Apply Prettier to reported source/config files only.
   Verify: `format:check` no longer reports formatting drift.
4. Step: Run required verification.
   Verify: command outcomes are recorded and risks are explicit.
5. Step: Finalize harness artifacts.
   Verify: feature list and sprint progress reflect the final state.

## Dependencies

- Existing `@keplar/web` package scripts.
- Local pnpm installation.
- Local Node runtime; exact Node 20 verification is unavailable if the active runtime remains outside the package engine range.

## Stop Condition

Stop after P3-00 artifacts, formatting-only cleanup, verification, and delivery handoff are complete. Do not commit.
