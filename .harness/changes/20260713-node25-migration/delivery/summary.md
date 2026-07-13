# Delivery Summary

Change ID: `20260713-node25-migration`
Status: delivery

## Change Summary

KEPLAR now declares Node `25.2.1` as its runtime pin and Node 25 as its only supported engine major. The root workspace, Web workspace, developer documentation, and CI input are aligned. CI already reads `.nvmrc`, so no workflow logic change was needed.

## Files Changed

- `.nvmrc`
  - Pin updated from `20.10.0` to `25.2.1`.
- `package.json`
  - Root Node engine updated to `>=25.0.0 <26.0.0`.
- `apps/web/package.json`
  - Web Node engine updated to `>=25.0.0 <26.0.0`.
- `README.md`
  - Developer prerequisite updated to Node `25.2.1`.
- `docs/CODEMAPS/dependencies.md`
  - CI dependency/runtime description updated to Node `25.2.1`.

## Verification Performed

- Runtime-contract audit: all seven assertions passed (`.nvmrc`, both manifests, CI `.nvmrc` usage, README, codemap, and active runtime).
- `pnpm install --frozen-lockfile`: passed under Node `v25.2.1` without KEPLAR engine warnings.
- `pnpm check`: typecheck, lint, 706 Vitest tests, and production build passed; final Prettier step has a documented pre-existing exception.
- `pnpm smoke`: 3 tests passed.
- `pnpm e2e`: full rerun passed 4/4 Playwright tests.
- `git diff --check`: passed.

## Known Risks

- Node 25 is non-LTS; this bounded major range does not imply long-term support.
- `pnpm check` is not globally green because seven pre-existing files fail `prettier --check`; none were modified by this migration.

## Follow-Ups

- If a globally green `pnpm check` is required, approve a separate formatting-only cleanup for the seven reported files.
- Plan a separate, approved runtime migration before Node 25 reaches end of support.

## Recommended Commit Message

```text
chore(runtime): migrate KEPLAR to Node 25
```

## Sprint Progress Final Update

Delivery artifacts are complete. No commit was created because none was requested.
