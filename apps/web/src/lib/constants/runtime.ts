/**
 * Human-readable runtime label rendered in the right-rail workspace
 * panel. Defaults to "Next.js · React" for the Phase 2 web runtime;
 * override via `NEXT_PUBLIC_RUNTIME_LABEL` if a different runtime is
 * targeted in the future (Phase 3 desktop, etc.).
 */

export const RUNTIME_LABEL: string =
  process.env.NEXT_PUBLIC_RUNTIME_LABEL ?? "Next.js · React";