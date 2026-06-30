// Thin wrapper: the actual kanban view implementation lives in
// `goal-space-shell.tsx` (it owns replay hydration, SSE subscription,
// card-drawer mount, and the command palette). PrimaryPane consumes it
// under the GoalSpaceKanbanView name to fit the persistent-shell
// architecture; a follow-up can split the file cleanly.
export { GoalSpaceShell as GoalSpaceKanbanView } from "../goal-space-shell";
