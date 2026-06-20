export const API_ERROR_CODES = [
  "INVALID_JSON",
  "INVALID_FIELD",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "STATE_CONFLICT",
  "CONFIRMATION_REQUIRED",
  "VALIDATION_ERROR",
  "EVENT_CURSOR_EXPIRED",
  "INTERNAL_ERROR",
] as const;

export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

const API_ERROR_STATUS: Record<ApiErrorCode, number> = {
  INVALID_JSON: 400,
  INVALID_FIELD: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  STATE_CONFLICT: 409,
  CONFIRMATION_REQUIRED: 409,
  VALIDATION_ERROR: 422,
  EVENT_CURSOR_EXPIRED: 410,
  INTERNAL_ERROR: 500,
};

export function getApiErrorStatus(code: ApiErrorCode): number {
  return API_ERROR_STATUS[code];
}

export class ApiRequestError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;

  constructor(code: ApiErrorCode, message: string, status = getApiErrorStatus(code)) {
    super(message);
    this.name = "ApiRequestError";
    this.code = code;
    this.status = status;
  }
}
