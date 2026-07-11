# Request Analysis Spec

Change ID: `20260711-product-implementation-audit`
Status: request_analysis

## Request Summary

Perform an evidence-led, two-way consistency audit of KEPLAR OS. Distinguish
the original product/architecture baseline, later decisions and development
plans, and the current implementation. Produce an auditable report, propose a
current product baseline, list human decisions, and make the smallest necessary
updates to authoritative pre-development documents after analysis.

The work must not modify business code, delete files, rewrite Git history, or
overwrite uncommitted work. The initial discovery established that `.playwright-mcp/`
and `.superpowers/` are untracked and must remain untouched.

## Assumptions

- `docs/specs/` and `docs/architecture/` contain the likely original baseline,
  but authority and freshness will be verified rather than assumed.
- `.harness/changes/`, committed `docs/superpowers/`, Git history, and tests
  are evidence of development evolution, not automatic product authority.
- Current `master` is the implementation snapshot under review; untracked
  materials are supplementary evidence only.
- Documentation changes are gated on completion of the evidence analysis and
  explicit approval of this request analysis.

## Scope

### In Scope

- Inventory and classify product, architecture, Harness, Superpowers, code,
  migration, configuration, test, and relevant Git evidence.
- Analyse the original baseline and development evolution independently.
- Compare requirements-to-implementation and implementation-to-requirements.
- Produce concise, evidence-linked audit, current-baseline, decision, and
  document-revision records.
- Revise only identified authoritative pre-development documents after approval.

### Out of Scope

- Business-code, test, configuration, data, or deployment changes.
- Deletion or alteration of historical Harness/Superpowers records.
- Git history rewrites, commits, or changes to untracked user files.
- Deciding unresolved product questions on behalf of the product owner.

## Affected Areas

- API: read-only inspection of `apps/web/src/app/api/v1/**`.
- Data model: read-only inspection of `apps/web/db/schema.ts` and migrations.
- Authorization: read-only inspection of `apps/web/src/lib/authorization/**`.
- UI/UX: read-only inspection, constrained by `DESIGN.md` when evaluating UI evidence.
- Tests: read-only inspection of unit, integration, API, and E2E evidence.
- Docs: new audit artifacts; later, minimal corrections to verified authority documents.

## Acceptance Criteria

- [ ] Material inventory identifies the authoritative-baseline candidates and freshness risks.
- [ ] Baseline, decisions, plans, and implementation facts are separately evidenced.
- [ ] High-impact discrepancies include evidence, impact, recommendation, and confidence.
- [ ] A current product baseline distinguishes committed scope, deferred scope, exclusions, and unresolved decisions.
- [ ] Any doc revision is minimal, traceable, preserves history, and does not silently resolve open decisions.
- [ ] No business code or untracked user content is modified.

## Risks

- Risk: Later documentation may be presented as a baseline despite superseding earlier intent.
  Mitigation: build a dated evidence timeline and label authority separately from recency.
- Risk: Plans or tests may be mistaken for delivered behavior.
  Mitigation: require code, migration, API, or verified-test corroboration for implementation claims.
- Risk: The documentation corpus has conflicting terminology.
  Mitigation: make terminology conflicts explicit and preserve unresolved choices for human decision.

## Open Questions

- Which product document should become the single maintained canonical baseline after the audit?
- Whether the untracked `.superpowers/brainstorm/` prototypes are intended to be preserved or ignored as private work artifacts.
- Whether the Rust workspace is roadmap architecture or active product scope.

## Approval Gate

Request Analysis stops here. Explicit human approval is required before conducting the report-writing and documentation-revision work.
