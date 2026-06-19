import { expect } from "vitest";

import type { ApiErrorCode } from "@/lib/api/errors";
import type { ApiError, ApiResponse } from "@/lib/api/response";
import type { Actor } from "@/lib/authorization/types";
import { TEST_ACTOR_HEADER } from "@/lib/api/request";

export function withTestSession(actor: Actor): { headers: HeadersInit } {
  return {
    headers: {
      [TEST_ACTOR_HEADER]: JSON.stringify(actor),
    },
  };
}

export function createJsonRequest(
  path: string,
  method: string,
  body?: unknown,
  options: RequestInit = {},
): Request {
  const headers = new Headers(options.headers);
  const requestInit: RequestInit = {
    ...options,
    method,
    headers,
  };

  if (body !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  if (body !== undefined) {
    requestInit.body = JSON.stringify(body);
  }

  return new Request(`http://localhost${path}`, requestInit);
}

export async function expectApiOk<T>(response: Response): Promise<ApiResponse<T>> {
  expect(response.ok).toBe(true);
  const json = (await response.json()) as ApiResponse<T>;
  expect(json.success).toBe(true);
  expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
  return json;
}

export async function expectApiError(
  response: Response,
  code: ApiErrorCode,
  status: number,
): Promise<ApiError> {
  expect(response.status).toBe(status);
  const json = (await response.json()) as ApiError;
  expect(json.success).toBe(false);
  expect(json.error.code).toBe(code);
  expect(new Date(json.timestamp).toISOString()).toBe(json.timestamp);
  return json;
}
