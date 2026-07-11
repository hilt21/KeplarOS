# Request Analysis Tasks

Change ID: `20260711-product-implementation-audit`
Status: request_analysis

## Implementation Tasks

- [ ] Build a dated, classified evidence index.
  - Verify: every substantive conclusion has a source path and evidence type.
- [ ] Analyse original product/architecture intent separately from evolution facts.
  - Verify: no plan or implementation claim is used as baseline without a label.
- [ ] Inspect current code, database migrations, API surface, tests, and Git history for the core product chain.
  - Verify: claimed capabilities have implementation evidence and delivery status is explicit.
- [ ] Produce bidirectional discrepancy findings and a proposed current baseline.
  - Verify: each high-impact difference has impact, recommended disposition, and confidence.

## Test Tasks

- [ ] Do not run mutating development commands during the documentary audit.
  - Verify: Git status preserves existing untracked files and shows only approved audit artifacts.
- [ ] Cross-check material implementation claims against source and tests.
  - Verify: record unavailable or ambiguous verification as such.

## Documentation Tasks

- [ ] Create a consolidated audit deliverable under the active change workspace.
  - Verify: it contains the minimum requested report sections without duplicating historical source material.
- [ ] Identify and minimally revise only confirmed authoritative pre-development documents.
  - Verify: each edit has a revision-record entry and leaves pending decisions marked pending.

## Sequencing

1. Freeze the evidence snapshot and establish document authority/freshness.
   Verify: inventory and timeline completed.
2. Analyse baseline and development evolution independently.
   Verify: each contains cited facts and explicit uncertainty.
3. Compare both directions and draft the proposed current baseline and decision list.
   Verify: findings are actionable and not inferred from plans alone.
4. Apply minimal approved documentation revisions and record them.
   Verify: `git diff` is documentation/audit-only and all changes are traceable.

## Dependencies

- Human approval after request analysis.
- Existing project product, architecture, Harness, Superpowers, source, and Git evidence.

## Stop Condition

Stop after writing request analysis artifacts and wait for human approval.
