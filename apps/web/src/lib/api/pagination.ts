import { ApiRequestError } from "@/lib/api/errors";

export const DEFAULT_PAGE_SIZE = 20;
export const DEFAULT_PAGE = 1;
export const MAX_PAGE_SIZE = 100;

export interface PaginationParams {
  readonly page: number;
  readonly limit: number;
}

function parsePositiveInteger(rawValue: string | null, field: string, fallback: number): number {
  if (rawValue === null) {
    return fallback;
  }

  const parsed = Number(rawValue);

  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new ApiRequestError("INVALID_FIELD", `${field} must be a positive integer.`);
  }

  return parsed;
}

export function parsePagination(params: URLSearchParams): PaginationParams {
  const page = parsePositiveInteger(params.get("page"), "page", DEFAULT_PAGE);
  const limit = parsePositiveInteger(params.get("limit"), "limit", DEFAULT_PAGE_SIZE);

  return {
    page,
    limit: Math.min(limit, MAX_PAGE_SIZE),
  };
}
