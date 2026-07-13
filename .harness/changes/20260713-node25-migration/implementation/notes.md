# Implementation Notes

Change ID: `20260713-node25-migration`
Feature: F-001 — Align KEPLAR runtime contract with Node 25

## Files Changed

- `.nvmrc`
- `package.json`
- `apps/web/package.json`
- `README.md`
- `docs/CODEMAPS/dependencies.md`

## Implementation Summary

- Pinned the repository runtime to Node `25.2.1` in `.nvmrc`.
- Bounded both workspace engine ranges to `>=25.0.0 <26.0.0`.
- Kept pnpm pinned at `11.5.1` and made no dependency or lockfile changes.
- Updated the active README and CI dependency codemap runtime references.
- Left `web-ci.yml` unchanged because it already reads `.nvmrc` through `actions/setup-node`.

## Deviations From Plan

- None.

## Risks And Follow-Ups

- Node 25 is a non-LTS major. Future runtime upgrades require a separate approved change.
- `pnpm check` reaches the existing Prettier gate and fails on seven unrelated files. No formatting changes were made because they are outside F-001 scope; the exception is recorded in `testing/results.md`.
- The first E2E attempt had a transient login timeout; a full rerun passed all four tests under Node 25.

## Verification Performed During Implementation

- `node --version` → `v25.2.1`
- `pnpm install --frozen-lockfile` → passed without KEPLAR engine warnings
- `pnpm check` → typecheck, lint, 706 unit tests, and build passed; existing Prettier gate failed
- `pnpm smoke` → 3 passed
- `pnpm e2e` → 4 passed on rerun
