# RISK_REGISTER

## Summary

The highest risks are not from existing implementation defects, because implementation is mostly absent. The highest risks are architectural and governance gaps that need to be resolved before implementation, especially authorization, human confirmation gates, external tool execution, and audit integrity.

## Risks

| ID | Severity | Risk | Evidence | Recommended Next Review |
|---|---|---|---|---|
| R-001 | High | Endpoint-level RBAC and ownership rules are not defined | Roles exist in API/database docs, but endpoint permission matrix is missing | Define role/resource matrix for every REST endpoint |
| R-002 | High | Human confirmation gate implementation is pending | Specs now define mandatory gates for `execute/unblock/complete` and external writes, but no implementation exists | Implement and test pending-confirmation guard rules |
| R-003 | High | MCP/ACP external execution boundaries are underspecified | Docs mention external systems, CI/CD, filesystem, Docker/Sandbox, MCP/ACP | Define read/write tool policy, approval policy, credential policy, and command audit |
| R-004 | High | Audit integrity implementation is pending | Specs now require append-only and transaction-blocking audit, but no implementation exists | Implement and test audit transaction behavior |
| R-005 | Medium | Demo database credentials may leak into production habits | `docker-compose.yml` uses `POSTGRES_PASSWORD: keplar`; NFR requires Secret/Vault for credentials | Separate demo compose from production examples |
| R-006 | Medium | Debug logs may leak sensitive goals, prompts, responses, or tool results | NFR allows DEBUG for AI Prompt/Response | Define redaction and production logging rules |
| R-007 | Medium | CI supply-chain path downloads binary without checksum | Workflow downloads `yq` via `sudo wget` | Pin checksums or use trusted setup action/container |
| R-008 | Medium | Cascade delete can remove transition/confirmation evidence | Database design cascades Card deletion to transitions and confirmations | Define archive/delete policy before implementing destructive operations |
| R-009 | Medium | CI card validation lacks sample coverage | Schema now exists and workflow is scoped to `docs/cards/`, but no sample card YAML exists | Add passing and failing card YAML fixtures when card docs are introduced |
| R-010 | Medium | Documentation/spec drift can harden into implementation drift | Multiple state/event/type naming inconsistencies found | Normalize specs before code generation or implementation |

## Risk Updates After 2026-05-30 Spec Pass

| Risk | Status |
|---|---|
| Endpoint-level RBAC undefined | Partially reduced by `docs/specs/authorization_matrix.md`; implementation still pending |
| Human confirmation bypass | Partially reduced by explicit gate rules; implementation/tests still pending |
| Audit integrity undefined | Partially reduced by append-only and transaction rules; implementation/tests still pending |
| Documentation/spec drift | Reduced for card states, IDs, priority, risk, and confirmation event names |
| Missing card schema | Reduced by adding `docs/development-guidelines/card-schema.json` and scoping workflow to `docs/cards/` |

## Permission, Confirmation, and Audit Path

### Authentication

- Planned login endpoint: `POST /api/v1/auth/login`
- Planned credential mechanism: HttpOnly Cookie Session Token
- Planned session behavior: 30-minute idle expiry

### Authorization Subjects

- User roles: `initiator`, `chain_user`, `viewer`
- Goal Space owner/initiator: `goal_spaces.initiator_id`
- Human confirmation decision maker: `human_confirmations.decided_by`

### Human Confirmation

Triggers:

- High-risk task.
- Low AI confidence.
- External system modification.
- CI/CD deployment or irreversible operation.
- Cross-node impact.

States:

- `pending`
- `approved`
- `rejected`
- `cancelled`

Planned decision endpoint:

- `POST /api/v1/confirmations/:id/decide`

Updated rule:

- Pending confirmation now blocks card execution, unblock, goal completion, and external write operations. Implementation and tests are still pending.

### Audit

Planned audit surfaces:

- Card detail returns `transitions`, `confirmations`, and `audit_trail`.
- State transitions include actor, trigger, reason, evidence, timestamp.
- Goal Space transitions define audit entries.
- Human confirmation transitions define audit entries.
- SSE publishes state and confirmation updates.

Updated rule:

- Audit is now specified as append-only and transaction-blocking. Tamper-evidence/export requirements are still open for later governance review.

## TODO / FIXME Scan

Exact search for `TODO`, `FIXME`, `XXX`, and `HACK` found no actionable code markers.

The word "待办" appears in normal product language such as Backlog descriptions and should not be treated as a code TODO.
