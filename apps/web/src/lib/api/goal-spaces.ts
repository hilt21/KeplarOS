/**
 * Goal Space API wrappers (F2-09).
 *
 * Thin typed wrappers around `apiRequest` / `apiGet` for the F2-03
 * goal-space endpoints. The shape mirrors the server-side service
 * response shapes in `lib/api/types.ts`.
 */

import { apiGet, apiRequest, type ApiRequestOptions } from "./client";
import type { GoalSpaceDetailResponse, GoalSpaceListResponse, GoalSpaceResponse } from "./types";

export function listGoalSpaces(
  opts: {
    readonly page?: number;
    readonly limit?: number;
    readonly status?: GoalSpaceListResponse["items"][number]["status"];
  } = {},
): Promise<GoalSpaceListResponse> {
  const query: Record<string, string | number | undefined> = {};
  if (opts.page !== undefined) query.page = opts.page;
  if (opts.limit !== undefined) query.limit = opts.limit;
  if (opts.status !== undefined) query.status = opts.status;
  return apiGet<GoalSpaceListResponse>("/api/v1/goal-spaces", { query });
}

export function getGoalSpace(id: string): Promise<GoalSpaceDetailResponse> {
  return apiGet<GoalSpaceDetailResponse>(`/api/v1/goal-spaces/${id}`);
}

export function createGoalSpace(input: {
  readonly name: string;
  readonly description?: string;
  readonly constraints?: readonly string[];
  readonly acceptance_criteria?: readonly { criterion: string; evidence: readonly string[] }[];
}): Promise<GoalSpaceResponse> {
  return apiRequest<GoalSpaceResponse>("/api/v1/goal-spaces", {
    method: "POST",
    body: input,
  });
}

export function updateGoalSpace(
  id: string,
  input: Partial<
    Pick<GoalSpaceResponse, "name" | "description" | "constraints" | "acceptance_criteria">
  >,
): Promise<GoalSpaceResponse> {
  return apiRequest<GoalSpaceResponse>(`/api/v1/goal-spaces/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function startGoalSpace(
  id: string,
): Promise<{ status: "active"; started_at: string; cards_generated: number }> {
  return apiRequest(`/api/v1/goal-spaces/${id}/start`, { method: "POST" });
}

export function completeGoalSpace(
  id: string,
): Promise<{ status: "completed"; completed_at: string; summary: unknown }> {
  return apiRequest(`/api/v1/goal-spaces/${id}/complete`, { method: "POST" });
}

export function cancelGoalSpace(
  id: string,
  reason: string,
): Promise<{ status: "cancelled"; cancelled_at: string; cancel_reason: string; summary: unknown }> {
  return apiRequest(`/api/v1/goal-spaces/${id}/cancel`, {
    method: "POST",
    body: { reason },
  });
}

export type { ApiRequestOptions };
