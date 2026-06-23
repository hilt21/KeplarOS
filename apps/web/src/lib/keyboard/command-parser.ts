/**
 * Slash command parser (F2-09).
 *
 * Parses `/<command> <args>` strings into typed commands. Drives the
 * bottom-of-main `CommandInput`. Non-`/` input is rejected; F2-09
 * does not invent an AI chat surface.
 */

export type ParsedCommand =
  | { kind: "create-card"; title: string }
  | { kind: "execute"; cardId: string }
  | { kind: "list-cards"; state?: string }
  | { kind: "transition"; cardId: string; targetState: string }
  | { kind: "block"; cardId: string; reason?: string }
  | { kind: "unblock"; cardId: string }
  | { kind: "approve"; confirmationId: string; comment?: string }
  | { kind: "reject"; confirmationId: string; reason?: string }
  | { kind: "cancel" }
  | { kind: "complete" }
  | { kind: "help" }
  | { kind: "unknown"; raw: string };

const VALID_STATES = new Set([
  "backlog",
  "todo",
  "dev",
  "review",
  "done",
  "blocked",
  "cancelled",
]);

export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  if (trimmed.length === 0 || !trimmed.startsWith("/")) {
    return { kind: "unknown", raw: input };
  }
  const tokens = trimmed.slice(1).split(/\s+/);
  const cmd = tokens[0]?.toLowerCase() ?? "";
  const args = tokens.slice(1);

  switch (cmd) {
    case "help":
      return { kind: "help" };
    case "create-card":
    case "create_card": {
      const title = args.join(" ");
      if (!title) return { kind: "unknown", raw: input };
      return { kind: "create-card", title };
    }
    case "execute": {
      const cardId = args[0];
      if (!cardId) return { kind: "unknown", raw: input };
      return { kind: "execute", cardId };
    }
    case "list-cards":
    case "list_cards": {
      const state = args[0];
      if (!state) return { kind: "list-cards" };
      return { kind: "list-cards", state };
    }
    case "transition":
    case "block":
    case "unblock":
    case "approve":
    case "reject": {
      const id = args[0];
      if (!id) return { kind: "unknown", raw: input };
      const rest = args.slice(1).join(" ");
      if (cmd === "transition") {
        const target = args[1];
        if (!target || !VALID_STATES.has(target)) return { kind: "unknown", raw: input };
        return { kind: "transition", cardId: id, targetState: target };
      }
      if (cmd === "block") return { kind: "block", cardId: id, ...(rest ? { reason: rest } : {}) };
      if (cmd === "unblock") return { kind: "unblock", cardId: id };
      if (cmd === "approve") return { kind: "approve", confirmationId: id, ...(rest ? { comment: rest } : {}) };
      return { kind: "reject", confirmationId: id, ...(rest ? { reason: rest } : {}) };
    }
    case "cancel":
      return { kind: "cancel" };
    case "complete":
      return { kind: "complete" };
    default:
      return { kind: "unknown", raw: input };
  }
}

export function helpText(): readonly string[] {
  return [
    "/create-card <title>          — create a card on the first node board",
    "/execute <card_id>            — run an AI role on a card",
    "/list-cards [state]           — list cards (optionally filtered by state)",
    "/transition <id> <state>      — trigger a state transition",
    "/block <id> [reason]          — block a card",
    "/unblock <id>                 — unblock a card into its default state",
    "/approve <confirmation_id> [comment]",
    "/reject <confirmation_id> [reason]",
    "/cancel                        — cancel the goal space",
    "/complete                      — complete the goal space",
    "/help                          — show this list",
  ];
}