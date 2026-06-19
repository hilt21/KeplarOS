import { ApiRequestError } from "@/lib/api/errors";
import { getSessionActor } from "@/lib/auth/session";
import type { Actor } from "@/lib/authorization/types";
import { USER_ROLE_VALUES } from "@db/schema";

export const TEST_ACTOR_HEADER = "x-keplar-test-actor";

function isTestRuntime(): boolean {
  return process.env.NODE_ENV === "test" || process.env.VITEST === "true";
}

export async function readJsonBody<T>(request: Request): Promise<T> {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiRequestError("INVALID_JSON", "Request body must be valid JSON.");
  }
}

export function requireString(value: unknown, field: string): string {
  if (value === undefined || value === null) {
    throw new ApiRequestError("INVALID_FIELD", `${field} is required.`);
  }

  if (typeof value !== "string") {
    throw new ApiRequestError("INVALID_FIELD", `${field} must be a string.`);
  }

  return value;
}

export function optionalString(value: unknown, field: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new ApiRequestError("INVALID_FIELD", `${field} must be a string.`);
  }

  return value;
}

export async function parseCurrentActor(request: Request): Promise<Actor> {
  const sessionActor = await getSessionActor(request);
  if (sessionActor) {
    return sessionActor;
  }

  if (!isTestRuntime()) {
    throw new ApiRequestError("UNAUTHORIZED", "Authentication required.");
  }

  const encodedActor = request.headers.get(TEST_ACTOR_HEADER);
  if (encodedActor === null) {
    throw new ApiRequestError("UNAUTHORIZED", "Authentication required.");
  }

  let parsedActor: unknown;

  try {
    parsedActor = JSON.parse(encodedActor);
  } catch {
    throw new ApiRequestError("UNAUTHORIZED", "Authentication required.");
  }

  if (typeof parsedActor !== "object" || parsedActor === null) {
    throw new ApiRequestError("UNAUTHORIZED", "Authentication required.");
  }

  const actorRecord = parsedActor as Record<string, unknown>;
  const role = requireString(actorRecord.role, "actor.role");

  if (!USER_ROLE_VALUES.includes(role as Actor["role"])) {
    throw new ApiRequestError("UNAUTHORIZED", "Invalid current actor role.");
  }

  return {
    id: requireString(actorRecord.id, "actor.id"),
    role: role as Actor["role"],
  };
}
