/**
 * API client (F2-09).
 *
 * Typed fetch wrapper with cookie auth, envelope parsing, `ApiClientError`,
 * and `EVENT_CURSOR_EXPIRED` (HTTP 410) callback support.
 *
 * - Uses `credentials: 'include'` so the `keplar_session` HttpOnly cookie
 *   attaches automatically. NEVER reads `document.cookie`. NEVER sets the
 *   `x-keplar-test-actor` header in production code.
 * - Parses `{ success, data | error, timestamp }` envelope and throws
 *   `ApiClientError` on `success === false`.
 * - `onCursorExpired` callback fires when the server returns 410 with
 *   `EVENT_CURSOR_EXPIRED` code.
 */

import type { ApiResponse } from "./types";

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: Record<string, string[]>;

  constructor(code: string, message: string, status: number, details?: Record<string, string[]>) {
    super(message);
    this.name = "ApiClientError";
    this.code = code;
    this.status = status;
    if (details !== undefined) {
      this.details = details;
    }
  }
}

export interface ApiRequestOptions {
  readonly method?: "GET" | "POST" | "PATCH" | "DELETE";
  readonly body?: unknown;
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
  readonly signal?: AbortSignal;
  readonly onCursorExpired?: () => void;
}

function buildUrl(path: string, query?: ApiRequestOptions["query"]): string {
  if (!query) return path;
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null) continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs.length > 0 ? `${path}?${qs}` : path;
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal, onCursorExpired } = options;
  const url = buildUrl(path, query);

  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  let payload: BodyInit | undefined;
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      credentials: "include",
      ...(payload !== undefined ? { body: payload } : {}),
      ...(signal !== undefined ? { signal } : {}),
    });
  } catch (error) {
    throw new ApiClientError(
      "INTERNAL_ERROR",
      error instanceof Error ? error.message : "Network error.",
      0,
    );
  }

  let envelope: ApiResponse<T>;
  try {
    envelope = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiClientError("INTERNAL_ERROR", "Response body is not valid JSON.", response.status);
  }

  if (envelope.success) {
    return envelope.data;
  }

  const { code, message, details } = envelope.error;
  if (response.status === 410 && code === "EVENT_CURSOR_EXPIRED" && onCursorExpired) {
    onCursorExpired();
  }
  throw new ApiClientError(code, message, response.status, details);
}

export function apiGet<T>(
  path: string,
  options: Omit<ApiRequestOptions, "method" | "body"> = {},
): Promise<T> {
  return apiRequest<T>(path, { ...options, method: "GET" });
}
