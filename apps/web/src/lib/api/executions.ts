/**
 * Execution API wrappers (F2-09).
 */

import { apiGet } from "./client";
import type { ExecuteStatusResponse, Role } from "./types";

export function getExecutionStatus(taskId: string): Promise<ExecuteStatusResponse> {
  return apiGet<ExecuteStatusResponse>(`/api/v1/execute/${taskId}`);
}

export type { ExecuteStatusResponse, Role };