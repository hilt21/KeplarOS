import { type ApiErrorCode, getApiErrorStatus } from "@/lib/api/errors";

export interface ApiResponse<T> {
  success: true;
  data: T;
  timestamp: string;
}

export interface ApiError {
  success: false;
  error: {
    code: ApiErrorCode;
    message: string;
    details?: Record<string, string[]>;
  };
  timestamp: string;
}

function jsonResponse(body: ApiResponse<unknown> | ApiError, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers);

  if (!headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return new Response(JSON.stringify(body), {
    ...init,
    headers,
  });
}

export function apiOk<T>(data: T, init: ResponseInit = {}): Response {
  const responseInit: ResponseInit = { status: init.status ?? 200 };

  if (init.headers !== undefined) {
    responseInit.headers = init.headers;
  }

  return jsonResponse(
    {
      success: true,
      data,
      timestamp: new Date().toISOString(),
    },
    responseInit,
  );
}

export function apiCreated<T>(data: T): Response {
  return apiOk(data, { status: 201 });
}

export function apiNoContent(): Response {
  return new Response(null, { status: 204 });
}

export function apiError(
  error: ApiErrorCode,
  message: string,
  init: ResponseInit = {},
  details?: Record<string, string[]>,
): Response {
  const responseInit: ResponseInit = { status: init.status ?? getApiErrorStatus(error) };

  if (init.headers !== undefined) {
    responseInit.headers = init.headers;
  }

  return jsonResponse(
    {
      success: false,
      error: {
        code: error,
        message,
        ...(details !== undefined ? { details } : {}),
      },
      timestamp: new Date().toISOString(),
    },
    responseInit,
  );
}
