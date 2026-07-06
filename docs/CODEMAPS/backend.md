<!-- Generated: 2026-07-06 | Files scanned: 27 routes | Token estimate: ~700 -->

# KEPLAR — Backend Codemap (REST + SSE)

## Base path

All REST routes under `apps/web/src/app/api/v1/`. Auth = HttpOnly session cookie
(`apps/web/src/middleware.ts`). Response envelope: `ApiResponse<T>` / `ApiError`
defined in `lib/api/response.ts`.

## Routes

### Auth
| Method | Path | Handler | Service |
|---|---|---|---|
| POST | `/auth/login` | `auth/login/route.ts` | `lib/auth/password.ts` + `session.ts` |
| POST | `/auth/logout` | `auth/logout/route.ts` | `lib/auth/session.ts` |
| GET  | `/auth/me` | `auth/me/route.ts` | `lib/auth/session.ts` |

### Goal Spaces
| Method | Path | Handler | Service |
|---|---|---|---|
| POST | `/goal-spaces` | `goal-spaces/route.ts` | `services/goal-spaces.ts` |
| GET  | `/goal-spaces` | `goal-spaces/route.ts` | `services/goal-spaces.ts` (paginated) |
| GET  | `/goal-spaces/:id` | `goal-spaces/[id]/route.ts` | `services/goal-spaces.ts` |
| PATCH | `/goal-spaces/:id` | `goal-spaces/[id]/route.ts` | `services/goal-spaces.ts` |
| POST | `/goal-spaces/:id/start` | `goal-spaces/[id]/start/route.ts` | `services/goal-spaces.ts` |
| POST | `/goal-spaces/:id/complete` | `goal-spaces/[id]/complete/route.ts` | `services/goal-spaces.ts` |
| POST | `/goal-spaces/:id/cancel` | `goal-spaces/[id]/cancel/route.ts` (requires `reason`) | `services/goal-spaces.ts` |
| GET  | `/goal-spaces/:id/events` | `goal-spaces/[id]/events/route.ts` (replay, `after_id?`, `limit≤500`) | `lib/realtime/replay.ts` |

### Node Boards
| Method | Path | Handler | Service |
|---|---|---|---|
| GET  | `/goal-spaces/:goalSpaceId/node-boards` | `goal-spaces/[id]/node-boards/route.ts` | `services/node-boards.ts` |
| POST | `/goal-spaces/:goalSpaceId/node-boards` | `goal-spaces/[id]/node-boards/route.ts` | `services/node-boards.ts` |
| GET  | `/node-boards/:id` | `node-boards/[id]/route.ts` | `services/node-boards.ts` |
| PATCH | `/node-boards/:id` | `node-boards/[id]/route.ts` | `services/node-boards.ts` |
| POST | `/node-boards/:id/members` | `node-boards/[id]/members/route.ts` | `services/node-boards.ts` |
| DELETE | `/node-boards/:id/members/:userId` | `node-boards/[id]/members/[userId]/route.ts` | `services/node-boards.ts` |

### Cards
| Method | Path | Handler | Service |
|---|---|---|---|
| POST | `/goal-spaces/:goalSpaceId/cards` | `goal-spaces/[id]/cards/route.ts` | `services/cards.ts` |
| GET  | `/goal-spaces/:goalSpaceId/cards` | `goal-spaces/[id]/cards/route.ts` (filters: `state`, `assigned_to`, `tags`) | `services/cards.ts` |
| GET  | `/cards/:id` | `cards/[id]/route.ts` (returns transitions + confirmations + audit) | `services/cards.ts` |
| PATCH | `/cards/:id` | `cards/[id]/route.ts` | `services/cards.ts` |
| POST | `/cards/:id/assign` | `cards/[id]/assign/route.ts` | `services/cards.ts` |
| POST | `/cards/:id/block` | `cards/[id]/block/route.ts` | `services/cards.ts` |
| POST | `/cards/:id/unblock` | `cards/[id]/unblock/route.ts` ⚠ confirmation-gated | `services/cards.ts` |
| POST | `/cards/:id/execute` | `cards/[id]/execute/route.ts` ⚠ confirmation-gated | `services/cards.ts` + `services/executions.ts` |
| GET  | `/cards/:id/transitions` | `cards/[id]/transitions/route.ts` | `services/cards.ts` |

### Confirmations
| Method | Path | Handler | Service |
|---|---|---|---|
| GET  | `/confirmations?status=pending` | `confirmations/route.ts` | `services/confirmations.ts` |
| POST | `/confirmations/:id/decide` | `confirmations/[id]/decide/route.ts` (rejected requires `reason`) | `services/confirmations.ts` |

### AI Execution
| Method | Path | Handler | Service |
|---|---|---|---|
| POST | `/cards/:id/execute` | (see Cards) — returns `202 + task_id + polling_url` | `services/executions.ts` |
| GET  | `/execute/:taskId` | `execute/[taskId]/route.ts` (attempt progress, status, result, error) | `services/executions.ts` |

### SSE (Realtime)
| Method | Path | Handler | Notes |
|---|---|---|---|
| GET  | `/sse?goal_space_id=...` | `sse/route.ts` | Honors `Last-Event-ID` header; 15s heartbeat; authz-scoped per GS |

## Error codes (`lib/api/errors.ts`)

| Code | HTTP | Meaning |
|---|---|---|
| `AUTH_REQUIRED` | 401 | No session |
| `AUTH_EXPIRED` | 401 | Idle > 30min |
| `FORBIDDEN` | 403 | Cross-GS access or wrong role |
| `NOT_FOUND` | 404 | Resource missing |
| `INVALID_REQUEST` | 400 | Malformed |
| `VALIDATION_ERROR` | 422 | Schema fail |
| `STATE_CONFLICT` | 409 | Illegal transition |
| `CONFIRMATION_REQUIRED` | 409 | Pending human_confirmation blocks op |
| `EVENT_CURSOR_EXPIRED` | 409 | SSE replay cursor unknown (refetch snapshot) |
| `INTERNAL_ERROR` | 500 | Unexpected |

## Middleware chain

```
HTTP request
  └─ src/middleware.ts (Next.js middleware — auth cookie → session actor)
       └─ route.ts (parse body, extract :id params)
            └─ lib/authorization/{cards|goal-spaces|...}.ts (assert access)
                 └─ lib/state-machine/{card|goal-space}.ts (validate transition)
                      └─ lib/services/{...}.ts (orchestrate business op)
                           └─ lib/audit/run-with-audit.ts (TX + 3 writes)
                           └─ lib/execution/{roles,fixture-executor}.ts (if AI op)
```

## Cross-cutting helpers

| Concern | Module |
|---|---|
| API client (typed fetch) | `lib/api/client.ts` |
| Pagination helper | `lib/api/pagination.ts` (`page`, `limit≤100`, `has_more`) |
| Response envelopes | `lib/api/response.ts` |
| Error taxonomy | `lib/api/errors.ts` |
| Type definitions | `lib/api/types.ts` |
| Security headers | `lib/security/headers.ts` |

## Test gates

- `apps/web/__tests__/api/**` — route-level handler tests
- `apps/web/__tests__/state-machine/**` — transition guards
- `apps/web/__tests__/authorization/**` — permission matrix
- `apps/web/__tests__/audit/**` — three-write atomicity
- `apps/web/e2e/**` — Playwright end-to-end