/**
 * S2 F-003 系统级操作授权胶水代码 (COR-011)
 *
 * 真相源:
 *   - docs/specs/authorization_matrix.md § 2 (actorType 值集合: human / ai_role / system)
 *   - docs/review/2026-06-08-full-repo-review/REVIEW.md COR-011
 *
 * COR-011 — system actor handling:
 *   spec §2 把 actorType 定义为 "human / ai_role / system" 三值,当前 S2 的 Actor
 *   类型只覆盖 user 维度(以 UserRole 为底:{initiator, chain_user, viewer}),没有
 *   对应的 system actor 概念。在 S3+ 引入系统驱动的转移(如 human_confirm_timeout
 *   触发的清理、scheduler 周期性回填、agent reaper)时,caller 必须能:
 *     1. 在不需要特定 user 的情况下"以 system 身份"执行一段业务逻辑;
 *     2. 让 audit_entries.actorType 字段能正确写入 'system' 而非硬编码 user.id;
 *     3. 现有 canXxx(actor, ctx) 函数对 system actor 行为可控(默认拒绝写,
 *        仅特定白名单放行)。
 *
 *   本文件提供 forward-looking scaffolding:`withInternalActor` 是一个 async-local
 *   风格的上下文包装,S3 handler 调用 `withInternalActor(async (internalActor) => {...})`,
 *   内部逻辑即可拿到 `{ id: 'system', role: 'system' }` 形式的 actor 用于 audit
 *   写入。当前 canXxx 函数对 role='system' 一律返回 false;若 S3 引入 system-driven
 *   写入,需在对应 canXxx 中显式放行并以 `actor.role === 'system'` 分支处理。
 *
 *   实现选择:用 AsyncLocalStorage 维护当前执行上下文,避免污染函数签名;fallback
 *   在 Node 不可用时返回 undefined(测试环境用),不破坏其他模块的 import。
 *
 * 真实身份语义:
 *   `SYSTEM_ACTOR` 是恒定的 placeholder:`{ id: 'system', role: 'system' }`,
 *   audit_entries 写入时由 F-004 audit wrapper 识别 "actor.role === 'system'" 路径
 *   并把 actor_id 列存为 NULL(S2 DB schema 不存在 'system' user 行)。
 */

import type { Actor, ActorRole } from "./types";

/**
 * System actor placeholder:用于 F-004 audit 写入 + withInternalActor 内部回调的
 * `internalActor` 参数。本身不应被任何 canXxx 函数用作"普通 user",那些函数仅
 * 接受 { id, role: UserRole } 形式的 actor。
 */
export const SYSTEM_ACTOR: Actor = Object.freeze({
  id: "system",
  // 角色值不在 USER_ROLE_VALUES 中;此字段在 canXxx 中按 actor.role === 'system'
  // 分支显式处理。当前所有 canXxx 对 role !== UserRole 一律 false。
  role: "system" as ActorRole,
});

// ─── AsyncLocalStorage:极简 polyfill + 真实现 ──────────────────────

/**
 * Node AsyncLocalStorage 的最小接口,避免在 Node-only 环境之外的测试 runner 触发
 * import 失败。检测不到全局 AsyncLocalStorage 时 fallback 为 no-op holder。
 */
interface ALSLike {
  readonly getStore: () => Actor | undefined;
  readonly run: <T>(store: Actor, fn: () => Promise<T> | T) => Promise<T> | T;
}

interface AsyncLocalStorageCtor {
  new <T>(): {
    getStore: () => T | undefined;
    run: <R>(store: T, fn: () => R) => R;
  };
}

function makeALS(): ALSLike {
  // Use globalThis lookup so this file does not pull in node:async_hooks at the
  // top level (some vitest environments don't expose it via type-only import).
  const ctor = (globalThis as { AsyncLocalStorage?: AsyncLocalStorageCtor }).AsyncLocalStorage;
  if (!ctor) {
    // Fallback:no isolation;getStore() returns undefined, run() just invokes fn.
    return {
      getStore: () => undefined,
      run: async <T>(_store: Actor, fn: () => Promise<T> | T): Promise<T> | T => fn(),
    };
  }
  const als = new ctor<Actor>();
  return {
    getStore: () => als.getStore(),
    // AsyncLocalStorage.run is sync in signature; wrap to accept async fn.
    run: <T>(store: Actor, fn: () => Promise<T> | T): Promise<T> | T => {
      const wrapped = (): Promise<T> | T => fn();
      return als.run(store, wrapped);
    },
  };
}

const _als = makeALS();

/**
 * 在 callback 期间以 SYSTEM_ACTOR 身份执行。返回 callback 的结果。
 *
 * 用法(S3 handler):
 * ```ts
 * await withInternalActor(async (internalActor) => {
 *   // internalActor.id === 'system', internalActor.role === 'system'
 *   // 在此处调用 audit wrapper 写入 audit_entries,actorType='system'
 * });
 * ```
 */
export async function withInternalActor<T>(
  fn: (internalActor: Actor) => Promise<T> | T,
): Promise<T> {
  return _als.run(SYSTEM_ACTOR, () => fn(SYSTEM_ACTOR)) as Promise<T>;
}

/**
 * 取当前 ALS 中的 internal actor;若不在 withInternalActor 上下文内,返回 undefined。
 * 给 F-004 audit wrapper 在异步链路任意点读取当前 actorType 使用。
 */
export function currentInternalActor(): Actor | undefined {
  return _als.getStore();
}