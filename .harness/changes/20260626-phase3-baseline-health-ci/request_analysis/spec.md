# Request Analysis Spec

Change ID: `20260626-phase3-baseline-health-ci`
Status: approved_for_implementation

## Request Summary

Restore the Phase 3 web beta baseline health and CI gate by excluding generated Playwright/test artifacts from Prettier checks, applying Prettier formatting only to the files reported by the P3-00 baseline `format:check`, and recording verification evidence for the web package gate.

This pass is limited to P3-00. It does not add product behavior, UI, API changes, or semantic source edits.

## Assumptions

- The user's instruction to implement P3-00 is explicit human approval to proceed beyond request analysis for this feature.
- The P3-00 baseline `format:check` output supplied in the request is authoritative for the formatting-only source/config file list.
- Generated `test-results/` output should be ignored by Prettier rather than formatted.
- Local verification may run under Node v25.2.1 even though `apps/web/package.json` requires Node `>=20.10.0 <21.0.0`; that mismatch must be recorded as a risk.

## Scope

### In Scope

- Create P3-00 harness artifacts under `.harness/changes/20260626-phase3-baseline-health-ci/`.
- Update `apps/web/.prettierignore` to ignore generated Playwright/test artifacts.
- Run Prettier only on the P3-00 baseline-reported source/config files, excluding generated `test-results/` paths.
- Run and record the required verification commands.

### Out of Scope

- Semantic code changes.
- UI, API, data model, auth, or realtime behavior changes.
- Formatting files not reported by the P3-00 baseline output.
- Committing changes.

## Affected Areas

- API: not affected.
- Data model: not affected.
- Authorization: not affected.
- UI/UX: no behavior change; formatting only for existing UI source files reported by Prettier.
- Tests: no test logic changes; generated test artifacts are ignored by Prettier.
- Docs: harness audit artifacts only.

## Acceptance Criteria

- [ ] `apps/web/.prettierignore` exactly includes the requested generated-artifact ignore entries.
- [ ] P3-00 baseline-reported source/config files are formatted by Prettier only.
- [ ] `pnpm --filter @keplar/web format:check` passes after changes.
- [ ] Required verification commands pass or unavailable checks are explicitly justified.
- [ ] Node engine mismatch and lint warnings are recorded in `testing/results.md`.
- [ ] Harness artifacts truthfully describe implementation, testing, delivery, and handoff state.

## Risks

- Risk: Local Node runtime does not match the package engine range.
  Mitigation: Record exact Node version and treat exact Node 20 verification as unavailable in local evidence.
- Risk: Formatting many files could hide semantic edits.
  Mitigation: Use Prettier only on the reported source/config files and inspect the resulting diff.

## Open Questions

- None for P3-00.

## Approval Gate

Human approval was provided by the implementation request for P3-00. No additional application source work is authorized beyond the stated write scope.
