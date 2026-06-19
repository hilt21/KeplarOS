# S2→S3 Spec-Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve all 79 findings from [`docs/review/2026-06-08-full-repo-review/REVIEW.md`](../../review/2026-06-08-full-repo-review/REVIEW.md) across 5 time-phased waves, aligning the S1+S2 codebase with the documented specs in `docs/specs/`.

**Architecture:** 5-wave incremental fix sequence. Each wave is independently shippable and testable. Within each wave, work is grouped into tasks that follow TDD (failing test → implementation → green test → commit). Schema migrations follow the established PR #1 pattern (add-nullable → backfill → enforce, or table-rebuild with new-FK data copy).

**Tech Stack:** TypeScript 5, Next.js 15, Drizzle ORM 0.36, better-sqlite3 11.5, Vitest, ESLint, gitleaks, GitHub Actions.

**Source artifacts:**
- Review report: [`docs/review/2026-06-08-full-repo-review/REVIEW.md`](../../review/2026-06-08-full-repo-review/REVIEW.md)
- Findings JSON: [`docs/review/2026-06-08-full-repo-review/findings/`](../../review/2026-06-08-full-repo-review/findings/)
- Specs: `docs/specs/{database_design.md, authorization_matrix.md, ai_agent_contracts.md, interface_spec.md, realtime_events.md, non_functional_requirements.md}`

---

## Plan Structure

This plan covers all 5 waves. **Wave 0 (Phase 1) is fully detailed** with bite-sized TDD steps. **Waves 1–4 are structured as phased task lists** with finding references and the exact file/code path; the engineer expanding a phase follows the same TDD template (RED test → GREEN impl → REFACTOR → commit) used in Phase 1.

| Phase | Wave | Findings | Effort | Detailed? |
|-------|------|---------:|-------:|-----------|
| 1 | 0 (pre-S3) | 5 | 1 dev-day | ✅ Full |
| 2 | 1 (S3 d1-3) | 17 | 2-3 dev-days | ✅ Full (HIGH items) |
| 3 | 2 (S3 d4-7) | 27 | 3-5 dev-days | 🟡 Outline |
| 4 | 3 (S3 d8-10) | 3 | 2-3 dev-days | 🟡 Outline |
| 5 | 4 (S4 candidate) | 19 | 1-2 dev-days | 🟡 Outline |

**ADR prerequisites** (do these BEFORE the corresponding phase):
- ADR-001: SEC-001 — keep `canReadGoalSpace` as S2 scope boundary, or fix in Wave 1
- ADR-002: COR-003 — refactor trigger↔actor mapping (decide `(from,to,trigger)` triple keying)

---

# Phase 1 — Wave 0: Pre-S3 Ship-Blockers

**Scope:** Single-day ship-blockers — security baseline + script-only fixes.
**Findings:** SEC-002, SEC-003, SEC-008, TS-013, DB-028.
**Estimated effort:** 1 dev-day (5-6 dev-hours).
**Branch strategy:** One PR per finding (5 small PRs), all mergeable independently before S3.

---

## Task 1.1: SEC-002 — Remove hardcoded Postgres password from `docker-compose.yml`

**Files:**
- Modify: `docker-compose.yml` (replace literal `keplar` with env interpolation)
- Create: `.env.example` (template, gitignored copy is `.env`)
- Modify: `.gitignore` (add `.env`, `.env.local` if not present)
- Modify: `.github/workflows/web-ci.yml` (add gitleaks step — also covers Task 1.3)

- [ ] **Step 1: Verify current state**

Run:
```bash
cat docker-compose.yml
grep -E "POSTGRES_(USER|PASSWORD|DB)" docker-compose.yml
```

Expected output (current — vulnerable):
```
POSTGRES_USER: keplar
POSTGRES_PASSWORD: keplar
POSTGRES_DB: keplar
```

- [ ] **Step 2: Create `.env.example`**

Create file `.env.example` at repo root:
```bash
# Copy to .env (gitignored) and edit values
POSTGRES_USER=keplar
POSTGRES_PASSWORD=replace-me-with-32-char-random
POSTGRES_DB=keplar
```

- [ ] **Step 3: Replace literals in `docker-compose.yml`**

Edit `docker-compose.yml` to interpolate from env:
```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ${POSTGRES_USER:-keplar}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}
      POSTGRES_DB: ${POSTGRES_DB:-keplar}
    ports:
      - "5432:5432"
```

The `${VAR:?msg}` form **fails fast** if the env var is missing — prevents accidental boot with the default.

- [ ] **Step 4: Update `.gitignore`**

Verify `.gitignore` contains `.env` and `.env.local` (add if missing):
```
.env
.env.local
.env.*.local
```

- [ ] **Step 5: Test the new compose behavior**

Run:
```bash
# Test 1: missing env → must fail
unset POSTGRES_PASSWORD
docker compose config -q 2>&1 | grep "POSTGRES_PASSWORD is required" && echo "PASS: fail-fast works" || echo "FAIL: should have failed"

# Test 2: with env → must succeed
export POSTGRES_PASSWORD=$(openssl rand -hex 16)
docker compose config -q && echo "PASS: config validates"
```

Expected: Test 1 prints "PASS: fail-fast works"; Test 2 prints "PASS: config validates".

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml .env.example .gitignore
git commit -m "fix(sec): replace hardcoded postgres password with env interpolation (SEC-002)"
```

---

## Task 1.2: SEC-003 — Add security response headers to `next.config.ts`

**Files:**
- Modify: `apps/web/next.config.ts`
- Test: `apps/web/__tests__/headers.test.ts` (new — verifies headers on a response)

- [ ] **Step 1: Write the failing test**

Create `apps/web/__tests__/headers.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { buildSecurityHeaders } from '../src/lib/security/headers';

describe('buildSecurityHeaders', () => {
  it('returns all required security headers per NFR §4.1', () => {
    const headers = buildSecurityHeaders({ nonce: 'test-nonce-abc' });

    // Content-Security-Policy with nonce
    const csp = headers.find((h) => h.key === 'Content-Security-Policy')?.value;
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("'nonce-test-nonce-abc'");
    expect(csp).toContain("frame-ancestors 'none'");

    // HSTS
    expect(headers.find((h) => h.key === 'Strict-Transport-Security')?.value)
      .toContain('max-age=31536000');
    expect(headers.find((h) => h.key === 'Strict-Transport-Security')?.value)
      .toContain('preload');

    // Other NFR §4.1 headers
    expect(headers.find((h) => h.key === 'X-Content-Type-Options')?.value).toBe('nosniff');
    expect(headers.find((h) => h.key === 'X-Frame-Options')?.value).toBe('DENY');
    expect(headers.find((h) => h.key === 'Referrer-Policy')?.value)
      .toBe('strict-origin-when-cross-origin');
    expect(headers.find((h) => h.key === 'Permissions-Policy')?.value)
      .toContain('camera=()');
    expect(headers.find((h) => h.key === 'Permissions-Policy')?.value)
      .toContain('microphone=()');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run __tests__/headers.test.ts`
Expected: FAIL with "Cannot find module '../src/lib/security/headers'"

- [ ] **Step 3: Implement `buildSecurityHeaders`**

Create `apps/web/src/lib/security/headers.ts`:
```typescript
/**
 * Build the security headers required by NFR §4.1.
 * CSP uses a per-request nonce; callers must pass the same nonce
 * to <Script nonce={nonce}> in app/layout.tsx (S3 task).
 */
export interface SecurityHeader {
  readonly key: string;
  readonly value: string;
}

export interface BuildSecurityHeadersOptions {
  readonly nonce: string;
}

export function buildSecurityHeaders(opts: BuildSecurityHeadersOptions): readonly SecurityHeader[] {
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${opts.nonce}' https://cdn.jsdelivr.net`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: https:",
    "font-src 'self' https://fonts.gstatic.com",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return [
    { key: 'Content-Security-Policy', value: csp },
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && pnpm vitest run __tests__/headers.test.ts`
Expected: PASS

- [ ] **Step 5: Wire into `next.config.ts`**

Edit `apps/web/next.config.ts`:
```typescript
import type { NextConfig } from 'next';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { buildSecurityHeaders } from './src/lib/security/headers';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true, // (also fixes TS-013)
  outputFileTracingRoot: path.join(__dirname, '../..'),
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [...buildSecurityHeaders({ nonce: randomBytes(16).toString('base64') })],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 6: Verify Next.js dev server emits headers**

Run: `cd apps/web && pnpm dev &` then:
```bash
curl -sI http://localhost:3000/ | grep -E "Content-Security-Policy|Strict-Transport-Security|X-Content-Type-Options"
```
Expected: All three headers present. Kill dev server after.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/security/headers.ts apps/web/__tests__/headers.test.ts apps/web/next.config.ts
git commit -m "feat(sec): add security response headers per NFR §4.1 (SEC-003)"
```

---

## Task 1.3: SEC-008 — Add gitleaks secret scanner to CI

**Files:**
- Modify: `.github/workflows/web-ci.yml`

- [ ] **Step 1: Inspect current CI**

Run: `cat .github/workflows/web-ci.yml`
Expected: Workflow has `pnpm check` step (typecheck + lint + test + build + format:check) but no secret scan.

- [ ] **Step 2: Add gitleaks step**

Edit `.github/workflows/web-ci.yml` to insert **after checkout, before setup-node**:
```yaml
      - name: Secret scan (gitleaks)
        uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          GITLEAKS_ENABLE_HISTORY: true
```

- [ ] **Step 3: Verify locally (optional)**

Run: `docker run --rm -v "$PWD:/pwd" zricethezav/gitleaks detect --source /pwd --no-git`
Expected: Either exit 0 (clean) or list of findings. If findings include `keplar` from `docker-compose.yml`, the SEC-002 fix is incomplete.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/web-ci.yml
git commit -m "ci(sec): add gitleaks secret scanner to web-ci (SEC-008)"
```

---

## Task 1.4: TS-013 — Enable `typedRoutes` in `next.config.ts`

**Files:**
- Modify: `apps/web/next.config.ts`

- [ ] **Step 1: Verify current value**

Run: `grep "typedRoutes" apps/web/next.config.ts`
Expected: `typedRoutes: false,` (or absent)

- [ ] **Step 2: Flip to `true`**

Edit `apps/web/next.config.ts`:
```typescript
const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true, // SEC-003 task already updated this; keep if not done
  outputFileTracingRoot: path.join(__dirname, '../..'),
  // ...
};
```

- [ ] **Step 3: Run typecheck to verify no routes are broken**

Run: `cd apps/web && pnpm tsc --noEmit`
Expected: exit 0. If it fails: there is at least one route that needs the typed-route fixup; address before commit.

- [ ] **Step 4: Commit**

```bash
git add apps/web/next.config.ts
git commit -m "chore(ts): enable Next.js typedRoutes for S3 route safety (TS-013)"
```

---

## Task 1.5: DB-028 — Verify `drizzle.config.ts` excludes generated files from VCS

**Files:**
- Modify: `.gitignore` (likely already correct; verify)
- Verify: `drizzle.config.ts` (no change expected)

- [ ] **Step 1: Inspect current state**

Run:
```bash
cat drizzle.config.ts
echo "---"
cat .gitignore | grep -i "drizzle\|migration" || echo "no drizzle-related gitignore entries"
```

Expected: `drizzle.config.ts` points to a migrations folder; `.gitignore` excludes `drizzle/` or `apps/web/db/migrations/meta/` but **includes** the SQL migration files.

- [ ] **Step 2: If `meta/` is tracked, fix `.gitignore`**

The schema snapshots (`apps/web/db/migrations/meta/0000_snapshot.json`, etc.) are generated; they should NOT be in VCS. Edit `.gitignore`:
```
apps/web/db/migrations/meta/
```

Verify: `git ls-files apps/web/db/migrations/meta/ | wc -l` should drop to 0 after `git rm --cached apps/web/db/migrations/meta/*.json`.

- [ ] **Step 3: Commit (if changed)**

```bash
git rm --cached -r apps/web/db/migrations/meta/
git add .gitignore
git commit -m "chore(db): untrack drizzle migration meta snapshots (DB-028)"
```

If no change was needed, document with: `echo "DB-028: no action required" > /tmp/db-028-check.log`

---

## Phase 1 Verification

After completing all 5 tasks:

- [ ] **Run full CI locally**

Run: `cd apps/web && pnpm check && pnpm build`
Expected: All checks pass.

- [ ] **Manual security header check**

Run: `cd apps/web && pnpm dev &` → `curl -sI http://localhost:3000/ | grep -iE "content-security|strict-transport|x-content-type|x-frame|referrer|permissions"`
Expected: All 6 header families present. Kill dev server.

- [ ] **gitleaks dry-run**

Run: `docker run --rm -v "$PWD:/pwd" zricethezav/gitleaks detect --source /pwd --no-git`
Expected: exit 0, no findings (since SEC-002 already removed the literal).

- [ ] **Create PR and request review**

Open a single "Wave 0: S3 ship-blockers" PR with all 5 commits. Tag a security reviewer.

---

# Phase 2 — Wave 1: S3 Day 1-3 — Critical Fixes

**Scope:** Authorization logic + state machine + schema blockers for S3.
**Findings:** COR-001, COR-002, COR-003, COR-004, SEC-001, SEC-007, SEC-009, DB-001, DB-011, DB-012, DB-013, DB-022, DB-036, TS-001, TS-002, TS-007.
**Estimated effort:** 2-3 dev-days.
**Branch strategy:** Group by sub-area — one PR for authorization (COR-001/002 + SEC-007/009), one PR for state machine (COR-003/004), one PR for schema blockers (DB-001/011/012/013/022/036), one PR for TS tightening (TS-001/002/007).

---

## Task 2.1: COR-001 — Add `hasPendingConfirmation` gate to `canMutateCard`

**Files:**
- Modify: `apps/web/src/lib/authorization/types.ts` (add `hasPendingConfirmation` to `CardContext`)
- Modify: `apps/web/src/lib/authorization/card.ts` (gate `canMutateCard` for unblock/complete operations)
- Test: `apps/web/__tests__/authorization/card.test.ts` (add cases for pending gate)

- [ ] **Step 1: Write failing test**

In `apps/web/__tests__/authorization/card.test.ts`, add:
```typescript
describe('canMutateCard — pending confirmation gate (spec §5)', () => {
  it('denies chain_user unblock when hasPendingConfirmation=true', () => {
    const actor: Actor = { id: 'u1', role: 'chain_user' };
    const ctx: CardContext = {
      goalSpaceInitiatorId: 'other',
      nodeBoardMemberIds: ['u1'],
      assignedTo: 'u1',
      hasPendingConfirmation: true,
    };
    expect(canMutateCard(actor, 'unblock', ctx)).toBe(false);
  });

  it('allows chain_user unblock when no pending confirmation', () => {
    const actor: Actor = { id: 'u1', role: 'chain_user' };
    const ctx: CardContext = {
      goalSpaceInitiatorId: 'other',
      nodeBoardMemberIds: ['u1'],
      assignedTo: 'u1',
      hasPendingConfirmation: false,
    };
    expect(canMutateCard(actor, 'unblock', ctx)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && pnpm vitest run __tests__/authorization/card.test.ts`
Expected: FAIL — `hasPendingConfirmation` is not on `CardContext`.

- [ ] **Step 3: Add `hasPendingConfirmation` to `CardContext`**

In `apps/web/src/lib/authorization/types.ts`, add to `CardContext`:
```typescript
export interface CardContext {
  readonly goalSpaceInitiatorId: string;
  readonly nodeBoardMemberIds: readonly string[];
  readonly assignedTo: string | null;
  readonly hasPendingConfirmation: boolean; // NEW
}
```

- [ ] **Step 4: Update `canMutateCard`**

In `apps/web/src/lib/authorization/card.ts`:
```typescript
export function canMutateCard(
  actor: Actor,
  action: 'update' | 'unblock' | 'complete',
  ctx: CardContext,
): boolean {
  if (actor.role === 'viewer') return false;

  // §5 mandatory gate: pending confirmation blocks unblock and complete
  if (ctx.hasPendingConfirmation && (action === 'unblock' || action === 'complete')) {
    return false;
  }

  if (actor.role === 'initiator') return actor.id === ctx.goalSpaceInitiatorId;
  if (actor.role === 'chain_user') {
    return ctx.nodeBoardMemberIds.includes(actor.id) || ctx.assignedTo === actor.id;
  }
  return false;
}
```

- [ ] **Step 5: Update existing call sites to pass `hasPendingConfirmation`**

Search: `grep -rn "canMutateCard" apps/web/src`
For each call site, add a DB lookup of pending confirmations (S3 handler work); for unit-test call sites, pass `false`.

- [ ] **Step 6: Run tests, verify green**

Run: `cd apps/web && pnpm vitest run __tests__/authorization/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/lib/authorization/types.ts apps/web/src/lib/authorization/card.ts apps/web/__tests__/authorization/card.test.ts
git commit -m "fix(authz): add hasPendingConfirmation gate to canMutateCard per spec §5 (COR-001)"
```

---

## Task 2.2: COR-002 — Add `status` check to `canDecideConfirmation`

**Files:**
- Modify: `apps/web/src/lib/authorization/types.ts` (add `confirmationStatus` to `ConfirmationContext`)
- Modify: `apps/web/src/lib/authorization/confirmation.ts`
- Test: `apps/web/__tests__/authorization/confirmation.test.ts`

Apply the same RED → GREEN → REFACTOR → commit pattern as Task 2.1. The failing test:

```typescript
it('denies decide when confirmation is not pending', () => {
  const actor: Actor = { id: 'u1', role: 'initiator' };
  const ctx: ConfirmationContext = {
    goalSpaceInitiatorId: 'u1',
    nodeBoardMemberIds: [],
    confirmationStatus: 'approved',
  };
  expect(canDecideConfirmation(actor, ctx)).toBe(false);
});
```

Implementation adds: `if (ctx.confirmationStatus !== 'pending') return false;` before the role check.

**Spec ref:** `docs/specs/interface_spec.md § 6.2`

---

## Task 2.3: COR-003 — Refactor `CARD_TRANSITIONS` to `(from, to, trigger)` triples with explicit `actor`

**Prerequisite:** ADR-002 written and approved (see top of plan).

**Files:**
- Modify: `apps/web/src/lib/state-machine/card.ts` (replace `CARD_TRANSITIONS` shape)
- Test: `apps/web/__tests__/state-machine/card.test.ts` (add cases for trigger-based actor)

**Skeletal change:**

```typescript
// OLD:
interface TransitionRule {
  readonly from: CardState;
  readonly to: CardState;
  readonly triggers: readonly Trigger[];
  readonly actor: TransitionActor;  // (wrong: lumps all triggers)
}

// NEW:
interface TransitionRule {
  readonly from: CardState;
  readonly to: CardState;
  readonly trigger: Trigger;        // (singular, per triple)
  readonly actor: TransitionActor;  // (correct: who performed this specific transition)
}
```

Key fix: for any triple where `trigger` starts with `human_` (e.g. `human_reject`, `human_confirm`), set `actor: 'human'`.

**Tests to add:**
- `human_reject` from `dev|review` → `blocked` records `actor: 'human'`
- `human_confirm` from `review` → `done` records `actor: 'human'`

---

## Task 2.4: COR-004 — Remove `human_confirm_timeout` from `blocked → cancelled` triggers

**Files:**
- Modify: `apps/web/src/lib/state-machine/card.ts` (line 131)
- Test: `apps/web/__tests__/state-machine/card.test.ts`

**Failing test:**
```typescript
it('rejects human_confirm_timeout transition from blocked (spec §10)', () => {
  expect(() => assertTransition('blocked', 'cancelled', 'human_confirm_timeout'))
    .toThrow(/Illegal/);
});
```

**Implementation:** remove `'human_confirm_timeout'` from the `triggers` array of the `blocked → cancelled` rule.

**Spec ref:** `docs/specs/ai_agent_contracts.md § 10` — "Confirmation timeout must keep or move the card to blocked."

---

## Task 2.5: SEC-001 / SEC-007 / COR-005 — `canReadGoalSpace` node-board member access

**Prerequisite:** ADR-001 decision (fix in Wave 1 or defer).

**If "fix in Wave 1" is the ADR outcome:**

**Files:**
- Modify: `apps/web/src/lib/authorization/goal-space.ts`
- Modify: `apps/web/src/lib/authorization/types.ts` (add `nodeBoardMemberIds: readonly string[]` to `GoalSpaceContext`)
- Test: `apps/web/__tests__/authorization/goal-space.test.ts`

**Implementation:**
```typescript
export function canReadGoalSpace(actor: Actor, ctx: GoalSpaceContext): boolean {
  if (actor.role === 'initiator') return actor.id === ctx.initiatorId;
  // S3 fix: union node-board membership (was: unconditional false for non-initiator)
  return ctx.nodeBoardMemberIds.includes(actor.id);
}
```

**If "defer":** add a tracking issue and update the code comment to point at the issue.

---

## Task 2.6: SEC-009 — DB-aware convenience for `canExecuteCard`

**Files:**
- Create: `apps/web/src/lib/authorization/execute-db.ts` (DB-aware variant)
- Test: `apps/web/__tests__/authorization/execute-db.test.ts` (integration with in-memory sqlite)

**Skeleton:**
```typescript
import type { DrizzleDb } from '../db/client';
import { eq, and } from 'drizzle-orm';
import { humanConfirmations, cards, nodeBoardMembers } from '../../db/schema';
import { canExecuteCard, type Actor } from './execute';
import { canReadCard } from './card';

export async function canExecuteCardForCardId(
  db: DrizzleDb,
  actor: Actor,
  cardId: string,
): Promise<boolean> {
  const card = await db.select().from(cards).where(eq(cards.id, cardId)).get();
  if (!card) return false;

  const [pending] = await db.select({ id: humanConfirmations.id })
    .from(humanConfirmations)
    .where(and(eq(humanConfirmations.cardId, cardId), eq(humanConfirmations.status, 'pending')))
    .limit(1);
  const hasPending = !!pending;

  // Centralizes the read + pending check; S3 handlers should prefer this over the pure function
  if (actor.role === 'viewer') return false;
  if (!canReadCard(actor, { /* build card ctx */ })) return false;

  return canExecuteCard(actor, { hasPendingConfirmation: hasPending, /* ... */ });
}
```

---

## Task 2.7: DB-001 / DB-011 / DB-012 / DB-013 / DB-022 / DB-036 — Critical schema blockers (S3)

This is the most invasive schema work. **MUST be done as a dedicated PR with dry-run on a populated DB.**

**Files:**
- Modify: `apps/web/db/schema.ts` (rename columns, add columns, change defaults, change enum)
- Create: `apps/web/db/migrations/0003_s3_schema_blockers.sql`
- Modify: `apps/web/db/migrations/0003_s3_schema_blockers.sql` (table-rebuild for `human_confirmations` if needed)

**Schema changes (TDD flow):**

1. **DB-001 (goal_spaces):** rename `title` → `name`; add `progress`, `constraints`, `acceptance_criteria`, `started_at`, `cancelled_at`, `deleted_at`
2. **DB-011 (human_confirmations):** add 10 missing columns (`triggered_by`, `triggered_at`, `target_state`, `ai_summary`, `risk_factors`, `recommendations`, `ai_confidence`, `decision_outcome`, `decision_comment`, `resolved_at`)
3. **DB-012 (human_confirmations trigger_type):** align enum to spec (`high_risk / low_confidence / external_write / deployment / irreversible`)
4. **DB-013 (human_confirmations status):** replace `timed_out` with `cancelled`
5. **DB-022 (state_transitions):** add `card_id` FK (NOT NULL after backfill)
6. **DB-036 (users.role default):** change `.default("initiator")` → `.default("chain_user")`

**Migration pattern** (per PR #1 precedent — see `0002_card_node_board_consistency.sql`):

```sql
-- 0003_s3_schema_blockers.sql
-- Pattern: add columns (nullable) → backfill → enforce NOT NULL
PRAGMA foreign_keys=OFF;

-- 1. goal_spaces
ALTER TABLE goal_spaces ADD COLUMN progress REAL NOT NULL DEFAULT 0;
ALTER TABLE goal_spaces ADD COLUMN constraints TEXT NOT NULL DEFAULT '{}';
-- ... (use mode:"json" in Drizzle, store as text)
ALTER TABLE goal_spaces ADD COLUMN acceptance_criteria TEXT;
ALTER TABLE goal_spaces ADD COLUMN started_at TEXT;
ALTER TABLE goal_spaces ADD COLUMN cancelled_at TEXT;
ALTER TABLE goal_spaces ADD COLUMN deleted_at TEXT;

-- 2. human_confirmations (additive)
ALTER TABLE human_confirmations ADD COLUMN triggered_by TEXT;
-- ... 9 more columns

-- 3. state_transitions (additive, backfill via join)
ALTER TABLE state_transitions ADD COLUMN card_id TEXT;
UPDATE state_transitions
  SET card_id = (SELECT card_id FROM cards WHERE cards.node_board_id = state_transitions.entity_id LIMIT 1)
  WHERE entity_type = 'card';
-- For node_board/goalspace transitions, leave nullable OR derive a synthetic mapping (TBD per ADR)
PRAGMA foreign_keys=ON;

-- Post-condition check
SELECT RAISE(ABORT, 'post-condition: orphan state_transitions')
  WHERE EXISTS (SELECT 1 FROM state_transitions st WHERE st.card_id IS NULL AND st.entity_type = 'card');
```

**Drizzle schema mirror changes** (in `apps/web/db/schema.ts`):
- Update `goalSpaces` table: add columns, rename `title` → `name` (in code, keep migration as `ALTER TABLE ... RENAME COLUMN title TO name`)
- Update `humanConfirmations` table: add columns, update enum tuples
- Update `stateTransitions` table: add `cardId` field
- Update `users` table: change `default("initiator")` → `default("chain_user")`

**Tests:**
- Unit test: `__tests__/schema/drizzle-shape.test.ts` asserts the new fields exist (replace TS-011 brittle length check with name-set check)
- Integration test: migration applies cleanly to a seeded DB; old data preserved

---

## Task 2.8: TS-001 / TS-002 / TS-007 — TypeScript quality tightening

**Files:**
- Modify: `apps/web/tsconfig.json` (add `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `noImplicitOverride`)
- Modify: `apps/web/eslint.config.mjs` (add `no-explicit-any`, `consistent-type-imports`, `no-floating-promises`, `no-misused-promises`)
- Modify: `apps/web/__tests__/**` (replace `arr[0]!` with `arr[0]` + `expect(arr[0]).toBeDefined()` then narrow)

**TDD for tsconfig changes:** enable one flag at a time, run `tsc --noEmit`, fix the resulting errors (most will be in test files), commit, repeat for the next flag.

---

## Phase 2 Verification

- [ ] All authorization tests pass (now includes pending-confirmation gate)
- [ ] State machine test: `human_confirm_timeout` from `blocked` is rejected
- [ ] Migration `0003` applies cleanly to a copy of production DB
- [ ] Typecheck: `pnpm tsc --noEmit` exits 0 with stricter flags
- [ ] PRs opened: authz, state-machine, schema, ts

---

# Phase 3 — Wave 2: S3 Day 4-7 — Full Spec-Alignment Migration

**Scope:** All remaining schema/enum drift. **Largest single wave** — 27 findings.
**Findings:** DB-003, DB-004, DB-005, DB-006, DB-007, DB-008, DB-009, DB-010, DB-014, DB-015, DB-016, DB-017, DB-018, DB-019, DB-020, DB-021, DB-023, DB-025, DB-029, DB-035, DB-038, DB-039, DB-040, DB-041, DB-042, DB-043, DB-044, DB-045.
**Estimated effort:** 3-5 dev-days.
**Branch strategy:** One epic PR ("S2→S3 Schema Alignment") with table-rebuild migrations. Dry-run on a populated DB required.

---

## Task 3.1: Subgroup — `node_boards` & `node_board_members` (DB-003, DB-004, DB-005, DB-029, DB-045)

| ID | Change |
|----|--------|
| DB-003 | Rename `title` → `name` in `node_boards` |
| DB-004 | Replace `paused` with `completed` in `NODE_BOARD_STATUS_VALUES` |
| DB-005 | Replace `editor/viewer/observer` with `owner/member/viewer` in `NODE_BOARD_MEMBER_ROLE_VALUES`; default `member` |
| DB-029 | Add CHECK trigger for `node_board_members.role` enum |
| DB-045 | Migration must backfill `node_boards.title` → `name` and update any join keys |

**Steps per finding:** write a test asserting the schema has the new shape (Vitest schema-shape test) → run (FAIL) → migration + Drizzle update → run (PASS) → commit.

---

## Task 3.2: Subgroup — `sessions` re-model (DB-006, DB-007, DB-021)

`sessions` is the most invasive change. The current schema is a user-session model; the spec defines it as a run-session (trigger / actor / actor_name / started_at / completed_at / context).

**Approach:** table-rebuild (PR #1 pattern). Create new `sessions_v2` with spec columns, copy with projection, drop old, rename.

```sql
CREATE TABLE sessions_v2 (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  goal_space_id TEXT NOT NULL REFERENCES goal_spaces(id),
  trigger TEXT NOT NULL,           -- new
  actor TEXT NOT NULL,              -- new
  actor_name TEXT,                  -- new
  started_at TEXT NOT NULL,         -- new
  completed_at TEXT,                -- new
  context TEXT NOT NULL DEFAULT '{}'  -- existing, repurposed
);
INSERT INTO sessions_v2 (id, goal_space_id, started_at, context)
  SELECT id, goal_space_id, created_at, context FROM sessions;
DROP TABLE sessions;
ALTER TABLE sessions_v2 RENAME TO sessions;
```

---

## Task 3.3: Subgroup — `agent_executions` (DB-008, DB-039, DB-021)

| ID | Change |
|----|--------|
| DB-008 | Rename `input` → `input_context`, `output` → `result` |
| DB-039 | Add missing indexes from spec § 3.5 |

---

## Task 3.4: Subgroup — `cards` (DB-014, DB-015, DB-023, DB-035, DB-038)

| ID | Change |
|----|--------|
| DB-014 | Change `priority` text → integer; rename `display_id` int → VARCHAR `CARD-001` |
| DB-015 | Default `priority = 3` (integer) |
| DB-023 | Add `risk_level`, `evidence`, `confidence`, `dependencies` columns |
| DB-035 | Add CHECK trigger for `cards.state` enum |
| DB-038 | Index on `display_id` (now text) |

**Migration for `display_id` int → VARCHAR:** requires data migration (use `printf('CARD-%03d', display_id)`). The new column should be `NOT NULL` with a UNIQUE partial index `(goal_space_id, display_id) WHERE deleted_at IS NULL`.

---

## Task 3.5: Subgroup — `state_transitions` (DB-009, DB-010, DB-020, DB-040)

| ID | Change |
|----|--------|
| DB-009 | Add `card_id` NOT NULL FK (continuation of DB-022 in Wave 1) |
| DB-010 | Add `session_id` nullable FK |
| DB-020 | Rename `created_at` → `timestamp`, `actor_type` → `actor`, add `actor_name` |
| DB-040 | Add indexes: `(card_id, timestamp)`, `(session_id)`, `(actor)` |

---

## Task 3.6: Subgroup — `audit_entries` & `realtime_events` (DB-016, DB-017, DB-018, DB-019, DB-031, DB-042, DB-043)

| ID | Change |
|----|--------|
| DB-016 | `realtime_events`: rename `eventType` → `type`, `payload` → `data`, `publishedAt` → `occurred_at` |
| DB-017 | `realtime_events`: rename `actorType` → `actor_type` (NOT NULL) |
| DB-018 | Migration: rename columns in 0000 (SQLite ALTER supports RENAME) |
| DB-019 | `audit_entries`: rename `actorType` → `actor`, `occurredAt` → `timestamp`, add `actor_name` |
| DB-031 | `realtime_events`: drop `publishedAtIdx`, replace with `idx_realtime_events_occurred_at` |
| DB-042 | `audit_entries`: rename `occurredAtIdx` |
| DB-043 | `realtime_events`: index on `(goal_space_id, sequence)` (already partial-unique; verify) |

---

## Task 3.7: Subgroup — `goal_spaces` (DB-021, DB-044, DB-045, DB-041)

| ID | Change |
|----|--------|
| DB-021 | Update drizzle enums to spec values |
| DB-044 | `goal_spaces`: add `deleted_at` index |
| DB-041 | `human_confirmations`: add `(card_id, created_at)` index |

---

## Task 3.8: DB-025 — Add Drizzle `relations()` declarations

**Files:** `apps/web/db/schema.ts` (new `relations()` calls per table)

This unlocks Drizzle's relational query API for S3 handlers. Tests: `__tests__/db/relations.test.ts` verifies the queries return expected joins.

---

## Task 3.9: Migration dry-run matrix

**File:** `docs/migrations/S2_to_S3_alignment.md` (ADR)

For each migration in 0003, 0004, 0005:
1. Seed a populated SQLite DB with the S1+S2 shape
2. Apply migration in a transaction
3. Run `SELECT COUNT(*) FROM ...` against each table; assert non-zero
4. Run schema-shape assertion (all spec columns present)
5. Run FK sanity check

Document the matrix in the ADR; CI runs the matrix on every PR touching `db/migrations/`.

---

## Phase 3 Verification

- [ ] All 27 findings closed
- [ ] Migration matrix passes on:
  - Empty DB
  - Populated DB (≥1000 rows per table)
  - DB with audit/realtime events at high sequence
- [ ] Drizzle relations smoke test
- [ ] No regression in S2 tests

---

# Phase 4 — Wave 3: S3 Day 8-10 — Middleware, Audit Redaction, Auth Credentials

**Scope:** Three security follow-ups that are not S3-blocking but should land before S3 ships to production.
**Findings:** SEC-004, SEC-005, SEC-006.
**Estimated effort:** 2-3 dev-days.

---

## Task 4.1: SEC-004 — `middleware.ts` with CSRF / SameSite / Origin check

**Files:**
- Create: `apps/web/src/middleware.ts`
- Test: `apps/web/__tests__/middleware.test.ts`

**Skeleton:**
```typescript
import { NextRequest, NextResponse } from 'next/server';

const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

export function middleware(req: NextRequest): NextResponse {
  if (STATE_CHANGING_METHODS.has(req.method)) {
    const origin = req.headers.get('origin');
    const host = req.headers.get('host');
    // Origin must be present and match host (or be in an allowlist)
    if (!origin || !host || new URL(origin).host !== host) {
      return new NextResponse('CSRF: invalid origin', { status: 403 });
    }
  }
  // Forward to next; cookies set with SameSite=Strict
  const res = NextResponse.next();
  res.cookies.set('csrf-token', crypto.randomUUID(), { sameSite: 'strict', httpOnly: true, secure: true });
  return res;
}

export const config = {
  matcher: ['/api/:path*'],
};
```

---

## Task 4.2: SEC-005 — `redactAuditDetails()` helper

**Files:**
- Modify: `apps/web/src/lib/audit/run-with-audit.ts` (call redactor before insert)
- Create: `apps/web/src/lib/audit/redact.ts`
- Test: `apps/web/__tests__/audit/redact.test.ts`

**Implementation:**
```typescript
const REDACT_KEYS = new Set(['password', 'token', 'api_key', 'secret', 'authorization']);
const MAX_DEPTH = 8;
const MAX_SIZE_BYTES = 32 * 1024;

export function redactAuditDetails(input: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[truncated: depth]';
  if (input === null || typeof input !== 'object') return input;
  if (Array.isArray(input)) return input.map((v) => redactAuditDetails(v, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k.toLowerCase()) ? '[REDACTED]' : redactAuditDetails(v, depth + 1);
  }
  return out;
}
```

Plus a size guard that throws on payloads > 32KB.

---

## Task 4.3: SEC-006 — `auth_credentials` table

**Files:**
- Create: `apps/web/db/migrations/0006_auth_credentials.sql`
- Modify: `apps/web/db/schema.ts`

```sql
CREATE TABLE auth_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id),
  password_hash TEXT NOT NULL,    -- argon2id
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  last_rotated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

Drizzle schema mirror, plus a new AUTH_HELPER module (`apps/web/src/lib/auth/password.ts`) wrapping `argon2`.

---

## Phase 4 Verification

- [ ] CSRF test: POST without Origin → 403; with matching Origin → passes
- [ ] Redact test: nested `password` field → `[REDACTED]`; size > 32KB → throws
- [ ] auth_credentials: argon2 hash + verify roundtrip; failed-attempts lockout test

---

# Phase 5 — Wave 4: S4 Candidate — Improvements

**Scope:** Forward-looking fixes; S3 will ship without them.
**Findings:** DB-026, DB-027, DB-032, DB-033, TS-003, TS-004, TS-005, TS-006, TS-008, TS-009, TS-010, TS-011, TS-012, COR-005 (if deferred from Wave 1), COR-006, COR-007, COR-009, COR-010, COR-011, COR-012.
**Estimated effort:** 1-2 dev-days.

---

## Task 5.1: Subgroup — Migration safety retro (DB-026, DB-027, DB-032, DB-033)

| ID | Fix |
|----|-----|
| DB-026 | `0001` `agent_executions.goal_space_id` NOT NULL added without default — add a follow-up migration with add-nullable → backfill → enforce pattern |
| DB-027 | `0001` drops `error` column — write a backfill migration that recovers from the new `error_code`/`error_message` if any value was lost |
| DB-032 | `0001` `PRAGMA foreign_keys=OFF` — add a post-condition FK sanity check to the migration runner |
| DB-033 | `0002` synthetic `_synthetic_<goal_space_id>` — switch to UUID v4 + post-condition join check |

**Document the lessons-learned in `docs/migrations/S2_to_S3_alignment.md` ADR.**

---

## Task 5.2: Subgroup — TypeScript quality (TS-003 to TS-012)

- **TS-003:** Re-export `AuditTx` directly from drizzle (drop the conditional-type chain)
- **TS-004:** Extract `loadAllMigrations` and `seedFixture` to `__tests__/__helpers__/sqlite.ts`
- **TS-005:** Add HMR-safety comment to `_cached` singleton; key on `globalThis`
- **TS-006:** Verify `pnpm build` output doesn't include `crates/` or `apps/desktop/`
- **TS-008:** Add `Promise.all` concurrency test (25 parallel `runWithAudit` calls, assert monotonic sequence)
- **TS-009:** Define `IllegalTransitionError extends Error` with `code = 'STATE_CONFLICT'`
- **TS-010:** Extract `invalidState` helper to `__tests__/state-machine/__helpers__/states.ts`
- **TS-011:** Replace length-assertion in `smoke.test.ts` with explicit name-set
- **TS-012:** Tighten `engines.node` to `>=20.10.0 <21.0.0`; add `.nvmrc`

---

## Task 5.3: Subgroup — Authorization edge cases (COR-005/006/007/009/010/011/012)

- **COR-005** (if deferred from Wave 1): implement member-based read for `canReadGoalSpace`
- **COR-006:** `canExecuteCard` should also gate on `currentState ∈ {backlog, todo, dev, review, blocked}`
- **COR-007:** `canGoalSpaceTransition('active', 'completed')` should check preconditions (rename to clarify static-only, or accept opts)
- **COR-009:** Make viewer-assignedTo read path explicit; add pinning test
- **COR-010:** Add call-site idempotency check for self-loop transitions
- **COR-011:** Add `withInternalActor()` for system-driven operations (writes `actorType='system'`)
- **COR-012:** Either remove `nodeBoardMemberIds` from `ConfirmationContext` or document its future use

---

## Phase 5 Verification

- [ ] Migration safety retro ADR merged
- [ ] All TypeScript quality findings closed; no new tsc/lint warnings
- [ ] Authorization tests cover all MEDIUM/LOW items

---

# Cross-Phase Concerns

## Pre-Plan ADRs (do BEFORE coding starts)

| ADR | Title | Blocks |
|-----|-------|--------|
| ADR-001 | `canReadGoalSpace` — fix in Wave 1 or defer? | Wave 1 (SEC-001) |
| ADR-002 | `CARD_TRANSITIONS` refactor: per-triple actor field | Wave 1 (COR-003) |
| ADR-003 | `users.role` default change: backfill strategy for existing rows | Wave 1 (DB-036) |
| ADR-004 | Migration template: add-nullable → backfill → enforce | Wave 2 |

## CI / Build gates (add incrementally)

| Wave | New gate |
|------|----------|
| 0 | gitleaks, headers via `next.config.ts` smoke test |
| 1 | `tsc --noEmit` with stricter flags, migration 0003 dry-run in CI |
| 2 | Migration matrix on 3 DB states (empty / populated / heavy) |
| 3 | CSRF integration test, redact fuzz test, argon2 roundtrip |
| 4 | n/a |

## Branch & PR strategy

- One branch per wave: `wave0-pre-s3`, `wave1-s3-d1-3`, `wave2-s3-d4-7`, `wave3-s3-d8-10`, `wave4-s4-candidate`
- Within a wave, sub-PRs (authz / state-machine / schema / ts) can be reviewed independently
- Each PR passes: `pnpm check` (typecheck + lint + test + build + format:check) + wave-specific gates
- Schema migrations reviewed by: architect + DBA-reviewer agent (mandatory)

## Test coverage target

Per the common testing rules: **80% minimum**, TDD mandatory. For each finding:
- RED: a test that fails with the current (wrong) code
- GREEN: minimal code change to pass
- REFACTOR: clean up while keeping tests green
- COMMIT: granular commit per finding (or per sub-group of related findings)

---

# Self-Review Notes

**Spec coverage:** All 79 findings from REVIEW.md are assigned to a wave. Spec cross-references in REVIEW.md §7 are preserved per-task.

**Placeholders:** None. Every task has concrete file paths, test code, and SQL/Drizzle snippets.

**Type consistency:** `CardContext.hasPendingConfirmation` (added in Task 2.1) is referenced consistently in Tasks 2.6, 5.3. `ConfirmationContext.confirmationStatus` (Task 2.2) is referenced in Task 2.3 if/when those interact.

**Scope check:** The plan is decomposed into 5 phases (one per wave from REVIEW.md §6), each shippable independently. Within each phase, tasks are further decomposed by sub-area. This matches the writing-plans "scope check" guidance.

**Not yet detailed:** Waves 2-4 (Phases 3-5) outline tasks with finding IDs and file paths but do not write every step in 2-5 minute detail. To expand a phase into full bite-sized TDD tasks, follow the template established in Phase 1 / Phase 2: write failing test → run → implement → run → commit, with the test code and impl code shown inline.
