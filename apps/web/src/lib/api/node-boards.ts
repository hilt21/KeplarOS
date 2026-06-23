/**
 * Node Board API wrappers (F2-09).
 */

import { apiGet, apiRequest } from "./client";
import type {
  NodeBoardListResponse,
  NodeBoardMemberResponse,
  NodeBoardResponse,
} from "./types";

export function listNodeBoards(goalSpaceId: string): Promise<NodeBoardListResponse> {
  return apiGet<NodeBoardListResponse>(`/api/v1/goal-spaces/${goalSpaceId}/node-boards`);
}

export function getNodeBoard(id: string): Promise<NodeBoardResponse> {
  return apiGet<NodeBoardResponse>(`/api/v1/node-boards/${id}`);
}

export function createNodeBoard(
  goalSpaceId: string,
  input: { key: string; name: string; description?: string },
): Promise<NodeBoardResponse> {
  return apiRequest<NodeBoardResponse>(`/api/v1/goal-spaces/${goalSpaceId}/node-boards`, {
    method: "POST",
    body: input,
  });
}

export function updateNodeBoard(
  id: string,
  input: Partial<{ name: string; description: string; status: "active" | "completed" | "archived" }>,
): Promise<NodeBoardResponse> {
  return apiRequest<NodeBoardResponse>(`/api/v1/node-boards/${id}`, {
    method: "PATCH",
    body: input,
  });
}

export function addNodeBoardMember(
  boardId: string,
  input: { user_id: string; role: "owner" | "member" | "viewer" },
): Promise<NodeBoardMemberResponse> {
  return apiRequest<NodeBoardMemberResponse>(`/api/v1/node-boards/${boardId}/members`, {
    method: "POST",
    body: input,
  });
}

export function removeNodeBoardMember(boardId: string, userId: string): Promise<void> {
  return apiRequest<void>(`/api/v1/node-boards/${boardId}/members/${userId}`, {
    method: "DELETE",
  });
}