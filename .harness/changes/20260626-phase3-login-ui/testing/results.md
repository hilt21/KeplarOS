# Testing Results

Change ID: `20260626-phase3-login-ui`
Status: passed_with_concerns

## Tests Added

- `apps/web/src/__tests__/ui/login-form.test.tsx`
  - Successful login posts to `/api/v1/auth/login` with `method: "POST"` and `credentials: "include"`, then calls `router.refresh()` and `router.push("/goal-spaces")`.
  - Failed login renders the API error message and does not push.
  - Thrown or network failure renders `Unable to sign in.` and does not push.

## Commands Run

| Command | Outcome |
|------|------|
| `.harness/skills/init.sh` | Passed before P3-01 source edits. Reported Node engine warnings, existing lint warnings, and Vitest sandbox WebSocket warning. |
| `pnpm --filter @keplar/web test -- src/__tests__/ui/login-form.test.tsx` | Failed as expected before implementation: missing `@/components/login-form`. |
| `pnpm --filter @keplar/web test -- src/__tests__/ui/login-form.test.tsx` | Passed after implementation: 45 files, 575 tests. |
| `pnpm --filter @keplar/web typecheck` | Passed. |
| `pnpm --filter @keplar/web lint` | Passed with 14 pre-existing warnings in unrelated files. |
| `pnpm --filter @keplar/web format:check` | Passed. |
| `git diff --check` | Passed. |
| `rg "#[0-9A-Fa-f]{3,8}" apps/web/src/app/login/page.tsx apps/web/src/components/login-form.tsx apps/web/src/__tests__/ui/login-form.test.tsx .harness/changes/20260626-phase3-login-ui` | No matches. |
| `rg "#[0-9A-Fa-f]{3,8}\|tracking-\|letter-spacing" apps/web/src/app/login/page.tsx apps/web/src/components/login-form.tsx apps/web/src/__tests__/ui/login-form.test.tsx` | No matches after removing `tracking-wider` classes. |

## Post-Review Controller Check

- Removed `tracking-wider` from the P3-01 page/form labels to satisfy the project frontend constraint that letter spacing must remain 0.
- Re-ran `pnpm --filter @keplar/web test -- src/__tests__/ui/login-form.test.tsx`: passed, 45 files and 574 tests.
- Re-ran `pnpm --filter @keplar/web format:check`: passed.
- Re-ran `git diff --check`: passed.
- Re-ran scoped hardcoded-hex/tracking scan: no matches.
- After addressing code-quality minor findings, re-ran `pnpm --filter @keplar/web test -- src/__tests__/ui/login-form.test.tsx`: passed, 45 files and 575 tests.
- After addressing code-quality minor findings, re-ran `pnpm --filter @keplar/web format:check`: passed.
- After addressing code-quality minor findings, re-ran `git diff --check`: passed.

## Verification Matrix

| Check | Required | Result | Notes |
|------|------|------|------|
| lint | Yes | Passed with concerns | 14 warnings are pre-existing and outside P3-01 files. |
| typecheck | Yes | Passed | No TypeScript errors. |
| unit | Yes | Passed | Login UI tests pass. Vitest ran the broader suite despite the path argument. |
| integration | No | Not applicable | No persistence or cross-service boundary changed. |
| api_contract | No | Not applicable | Existing `/api/v1/auth/login` contract consumed only; no API changes. |
| migration | No | Not applicable | No DB changes. |
| smoke | No | Not applicable | No local app server required by P3-01 request. |
| e2e | No | Not applicable | Not requested and no e2e scope added. |

## Environment Concerns

- Current Node is `v25.2.1`; `apps/web` requires `>=20.10.0 <21.0.0`.
- Vitest reports `WebSocket server error: listen EPERM 0.0.0.0:24678` under this sandbox, but test runs complete successfully.
- Node emits `--localstorage-file was provided without a valid path` warnings during Vitest runs.

## Untested Risks

- `/login` server redirect was not covered by a new server-component test; implementation reuses the same `cookies()` plus `getSessionActor(request)` pattern as the authenticated app layout.
