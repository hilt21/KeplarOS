/**
 * Card API wrappers (F2-09).
 */

import { apiGet, apiRequest } from "./client";
import type {
  CardDetailResponse,
  CardListResponse,
  CardResponse,
  CardState,
  RiskLevel,
  StateTransitionResponse,
} from "./types";

export function listCards(
  goalSpaceId: string,
  opts: {
    readonly state?: CardState;
    readonly assigned_to?: string;
    readonly tags?: readonly string[];
  } = {},
): Promise<CardListResponse> {
  const query: Record<string, string> = {};
  if (opts.state !== undefined) query.state = opts.state;
  if (opts.assigned_to !== undefined) query.assigned_to = opts.assigned_to;
  if (opts.tags !== undefined && opts.tags.length > 0) {
    query.tags = opts.tags.join(",");
  }
  return apiGet<CardListResponse>(`/api/v1/goal-spaces/${goalSpaceId}/cards`, { query });
}

export function getCard(id: string): Promise<CardDetailResponse> {
  return apiGet<CardDetailResponse>(`/api/v1/cards/${id}`);
}

export function getCardTransitions(cardId: string): Promise<{ items: readonly StateTransitionResponse[] }> {
  return apiGet<{ items: readonly StateTransitionResponse[] }>(`/api/v1/cards/${cardId}/transitions`);
}

export function createCard(
  goalSpaceId: string,
  input: {
    readonly title: string;
    readonly node_board_id: string;
    readonly description?: string;
    readonly assigned_to?: string;
    readonly priority?: number;
    readonly risk_level?: RiskLevel;
    readonly dependencies?: readonly string[];
    readonly tags?: readonly string[];
  },
): Promise<CardResponse> {
  return apiRequest<CardResponse>(`/api/v1/goal-spaces/${goalSpaceId}/cards`, {
    method: "POST",
    body: input,
  });
}

export function updateCard(
  id: string,
  input: Partial<{
    title: string;
    description: string;
    assigned_to: string;
    priority: number;
    risk_level: RiskLevel;
    tags: readonly string[];
  }>,
): Promise<CardResponse> {
  return apiRequest<CardResponse>(`/api/v1/cards/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function assignCard(id: string, assignedTo: string): Promise<CardResponse> {
  return apiRequest<CardResponse>(`/api/v1/cards/${id}/assign`, {
    method: "POST",
    body: { assigned_to: assignedTo },
  });
}

export function blockCard(id: string, reason: string): Promise<CardResponse> {
  return apiRequest<CardResponse>(`/api/v1/cards/${id}/block`, {
    method: "POST",
    body: { reason },
  });
}

export function unblockCard(
  id: string,
  targetState: "backlog" | "todo" | "dev" | "review",
): Promise<CardResponse> {
  return apiRequest<CardResponse>(`/api/v1/cards/${id}/unblock`, {
    method: "POST",
    body: { target_state: targetState },
  });
}

export function executeCard(
  id: string,
  role: string,
  context?: Record<string, unknown>,
): Promise<{ task_id: string; card_id: string; role: string; status: "queued"; estimated_time: number; polling_url: string }> {
  return apiRequest(`/api/v1/cards/${id}/execute`, {
    method: "POST",
    body: { role, ...(context !== undefined ? { context } : {}) },
  });
}