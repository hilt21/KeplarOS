/**
 * API base path for all REST + SSE calls.
 *
 * Defaults to `/api/v1` (the v1 envelope defined in
 * `docs/specs/interface_spec.md`). Override via the
 * `NEXT_PUBLIC_API_BASE` environment variable when running behind a
 * reverse proxy that mounts the API at a different prefix.
 */

export const API_BASE: string = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";