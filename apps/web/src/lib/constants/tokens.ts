/**
 * Token metering placeholders.
 *
 * The right-rail token meter is a Phase 2 placeholder until F10 lands
 * real metering. For now the values are zero-by-default so the
 * progress bar reads 0%.
 *
 * Once F10 ships:
 *   1. Delete `TOKENS_PLACEHOLDER_USED` and `TOKENS_PLACEHOLDER_CAP`.
 *   2. Replace the props passed from `(app)/layout.tsx` with values
 *      returned by a new `/api/v1/tokens` (or similar) endpoint.
 *   3. Remove this file.
 */

// TODO(F10): wire real token metering — see plan/F10 tracking issue.
export const TOKENS_PLACEHOLDER_USED = 0;
export const TOKENS_PLACEHOLDER_CAP = 100000;