/**
 * Board store (F2-09).
 *
 * Per-goal-space store: the list of `RealtimeEvent`s received from
 * the SSE stream (deduped) and replay. Subscribed via
 * `useSyncExternalStore`. Multiple subscribers on the same goal space
 * share state via the `Map<goalSpaceId, BoardState>`.
 */

import { useSyncExternalStore } from "react";
import type { RealtimeEvent } from "@/lib/api/types";

export interface BoardState {
  readonly events: readonly RealtimeEvent[];
  readonly byId: Set<string>;
}

// Internal mutable container; the public interface is frozen.
interface MutableBoardState {
  events: RealtimeEvent[];
  byId: Set<string>;
}

const states = new Map<string, MutableBoardState>();
const listeners = new Map<string, Set<() => void>>();

function getOrCreate(goalSpaceId: string): MutableBoardState {
  let s = states.get(goalSpaceId);
  if (!s) {
    s = { events: [], byId: new Set() };
    states.set(goalSpaceId, s);
  }
  return s;
}

function notify(goalSpaceId: string): void {
  const set = listeners.get(goalSpaceId);
  if (set) for (const l of set) l();
}

export const boardStore = {
  append(goalSpaceId: string, event: RealtimeEvent): void {
    const s = getOrCreate(goalSpaceId);
    if (s.byId.has(event.id)) return;
    s.byId.add(event.id);
    s.events = [...s.events, event];
    snapshots.delete(goalSpaceId);
    notify(goalSpaceId);
  },
  appendMany(goalSpaceId: string, events: readonly RealtimeEvent[]): void {
    const s = getOrCreate(goalSpaceId);
    const fresh: RealtimeEvent[] = [];
    for (const ev of events) {
      if (s.byId.has(ev.id)) continue;
      s.byId.add(ev.id);
      fresh.push(ev);
    }
    if (fresh.length > 0) {
      s.events = [...s.events, ...fresh];
      snapshots.delete(goalSpaceId);
      notify(goalSpaceId);
    }
  },
  clear(goalSpaceId: string): void {
    states.delete(goalSpaceId);
    snapshots.delete(goalSpaceId);
    notify(goalSpaceId);
  },
  subscribe(goalSpaceId: string, cb: () => void): () => void {
    let set = listeners.get(goalSpaceId);
    if (!set) {
      set = new Set();
      listeners.set(goalSpaceId, set);
    }
    set.add(cb);
    return (): void => {
      set!.delete(cb);
    };
  },
  getSnapshot(goalSpaceId: string): BoardState {
    const s = getOrCreate(goalSpaceId);
    // useSyncExternalStore requires a stable reference between
    // notifications. Cache the { events, byId } wrapper so repeated
    // reads return the same object until the underlying state
    // actually changes (which we detect by checking the events
    // array reference — it is reassigned to a new array on every
    // append / appendMany / clear).
    let snap = snapshots.get(goalSpaceId);
    if (snap === undefined || snap.events !== s.events) {
      snap = { events: s.events, byId: s.byId };
      snapshots.set(goalSpaceId, snap);
    }
    return snap;
  },
  getServerSnapshot(): BoardState {
    return SERVER_SNAPSHOT;
  },
};

// Per-goal-space snapshot cache. Cleared on every mutation so
// `getSnapshot` returns the same reference between notifications.
const snapshots = new Map<string, BoardState>();

// Server snapshot is a single frozen constant: useSyncExternalStore
// expects `getServerSnapshot` to return the same reference for the
// lifetime of the request.
const SERVER_SNAPSHOT: BoardState = Object.freeze({
  events: Object.freeze([]) as readonly RealtimeEvent[],
  byId: new Set<string>(),
}) as BoardState;

export function useBoardStore<T>(goalSpaceId: string, selector: (s: BoardState) => T): T {
  return useSyncExternalStore(
    (cb) => boardStore.subscribe(goalSpaceId, cb),
    () => selector(boardStore.getSnapshot(goalSpaceId)),
    () => selector(boardStore.getServerSnapshot()),
  );
}
