/**
 * Shared authenticated-actor helpers for /api/v1 route handlers.
 *
 * Closes the F2-02 follow-up: route handlers should not duplicate the
 * `getSessionActor() -> user lookup` pattern. Use `requireActor` for any
 * authenticated route and `requireInitiator` for routes that require the
 * initiator role.
 *
 * Both helpers throw `ApiRequestError`, so the standard route-level
 * try/catch in F2-02 routes maps the failure to the shared `apiError`
 * envelope.
 */

import { ApiRequestError } from "@/lib/api/errors";
import { parseCurrentActor } from "@/lib/api/request";
import type { Actor } from "@/lib/authorization/types";

/**
 * Resolve the current actor or throw an API request error envelope.
 * Throws `UNAUTHORIZED` (401) when no authenticated session is present
 * (or the test-only header is missing in test runtime).
 */
export async function requireActor(request: Request): Promise<Actor> {
  return await parseCurrentActor(request);
}

/**
 * Resolve the current actor and require the `initiator` role.
 * Throws `UNAUTHORIZED` (401) when no session is present, and
 * `FORBIDDEN` (403) when the actor is not an initiator.
 */
export async function requireInitiator(request: Request): Promise<Actor> {
  const actor = await parseCurrentActor(request);
  if (actor.role !== "initiator") {
    throw new ApiRequestError("FORBIDDEN", "Only initiators can perform this action.");
  }
  return actor;
}
