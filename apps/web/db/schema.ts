/**
 * S1 placeholder schema. No domain tables yet — S2 will introduce
 * Goal Space, Node Board, Card, Audit, User. This file exists so that
 * drizzle-kit can resolve its config and so that the workspace pattern
 * `@db/*` is exercised end-to-end.
 */
export const schema = {} as const;

export type Schema = typeof schema;
