/**
 * Confirmation API wrappers (F2-09).
 */

import { apiGet, apiRequest } from "./client";
import type { ConfirmationListResponse, HumanConfirmationResponse } from "./types";

export function listConfirmations(
  opts: {
    readonly status?: "pending" | "approved" | "rejected" | "cancelled";
  } = {},
): Promise<ConfirmationListResponse> {
  const query: Record<string, string> = {};
  if (opts.status !== undefined) query.status = opts.status;
  return apiGet<ConfirmationListResponse>("/api/v1/confirmations", { query });
}

export function decideConfirmation(
  id: string,
  input: {
    readonly outcome: "approved" | "rejected";
    readonly comment?: string;
    readonly reason?: string;
  },
): Promise<{
  id: string;
  status: "approved" | "rejected";
  decided_by: string;
  decided_at: string;
  card_state_changed: boolean;
  new_card_state?: string;
}> {
  return apiRequest(`/api/v1/confirmations/${id}/decide`, {
    method: "POST",
    body: input,
  });
}

export type { ConfirmationListResponse, HumanConfirmationResponse };
