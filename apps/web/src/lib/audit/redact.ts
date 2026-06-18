/**
 * redactAuditDetails (SEC-005)
 * Recursively scrubs sensitive keys from audit details before INSERT.
 *
 * Spec ref: docs/specs/non_functional_requirements.md §5.2, §5.5
 * Finding ref: docs/review/2026-06-08-full-repo-review/REVIEW.md Theme F
 *
 * Audit logs must not contain plaintext credentials, tokens, or secrets.
 * Callers (runWithAudit) should pass `ctx.details`, `ctx.beforeState`,
 * `ctx.afterState`, and `ctx.data` through this helper before INSERT.
 */

export const REDACTED = '[REDACTED]';

/**
 * Frozen set of keys (lower-cased) whose values are replaced with `[REDACTED]`.
 * Match is case-insensitive: callers may pass `Password`, `PASSWORD`, etc.
 */
export const REDACT_KEYS: ReadonlySet<string> = Object.freeze(
  new Set<string>([
    'password',
    'passwd',
    'pwd',
    'token',
    'access_token',
    'refresh_token',
    'api_key',
    'apikey',
    'secret',
    'authorization', // header-style "Authorization: Bearer ..."
    'auth',
    'session_id', // identifying credential; redact to avoid plaintext session leak
    'cookie',
    'set-cookie',
  ]),
);

/** 32 KB hard cap on serialized audit details (per spec NFR §5.2). */
export const MAX_DETAILS_BYTES = 32 * 1024;

const MAX_DEPTH = 8;

/**
 * Redact sensitive keys recursively. Returns a NEW structure (no mutation).
 * Throws if the serialized payload exceeds `MAX_DETAILS_BYTES`.
 *
 * @param input - Any JSON-serializable value (object, array, primitive, null)
 */
export function redactAuditDetails(input: unknown): unknown {
  const redacted = redactInternal(input, 0);
  // Size guard — measured against serialized (redacted) output.
  // Performed once per top-level call; the guard itself does not recurse.
  const serialized = JSON.stringify(redacted);
  if (serialized.length > MAX_DETAILS_BYTES) {
    throw new Error(
      `audit details exceeds ${MAX_DETAILS_BYTES} bytes ` +
        `(serialized: ${serialized.length}); NFR §5.2 limit`,
    );
  }
  return redacted;
}

function redactInternal(input: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) return '[truncated: depth]';
  if (input === null || input === undefined) return input;

  const t = typeof input;
  if (t !== 'object') return input; // primitives pass through unchanged

  if (Array.isArray(input)) {
    return input.map((v) => redactInternal(v, depth + 1));
  }

  // Plain object
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    // Preserve null/undefined values for sensitive keys — no actual secret to redact.
    if (v === null || v === undefined) {
      out[k] = v;
      continue;
    }
    if (REDACT_KEYS.has(k.toLowerCase())) {
      out[k] = REDACTED;
    } else {
      out[k] = redactInternal(v, depth + 1);
    }
  }
  return out;
}