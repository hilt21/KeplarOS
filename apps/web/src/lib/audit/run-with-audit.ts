/**
 * F-004 runWithAudit — 业务 + audit_entries + realtime_events 同事务原子写
 *
 * 真相源: docs/specs/database_design.md § 1 § 3.9 § 3.10 + F-004 AC-4.1~AC-4.7
 *   - 业务变更 + audit_entries + 可选 realtime_events 三段同事务
 *   - audit 写失败 → 业务回滚 (better-sqlite3 事务特性,fn 抛错即整事务回滚)
 *   - realtime sequence 单调递增:用单 SQL 子查询 `SELECT COALESCE(MAX(sequence), 0) + 1
 *     FROM realtime_events WHERE goal_space_id = ?` 解决并发覆盖
 *   - append-only 边界:本文件不导出 update/delete/truncate/drop API
 *     (由 @/lib/audit/index.ts 控制,详见 AC-4.7 + append-only.test.ts)
 *
 * 同步 API 选择 (与 AC-4.1 略差异):
 *   better-sqlite3 是同步驱动,drizzle-orm/better-sqlite3 的 transaction() 返回 `T` 而非 `Promise<T>`。
 *   若 fn 需要异步 I/O,应在事务外完成;事务内只做同步 DB 写。这与 S2 范围(纯 DB 业务)一致。
 *   若 S3+ 切到 Postgres/pg 驱动,该函数签名将统一为 `Promise<T>`,迁移由 owner 调整。
 *
 * S2 范围内:测试 (T-013 / T-015) 自建 `new Database(':memory:')` + `drizzle(...)` 调 runWithAudit;
 * S3+ API handler 通过 @/lib/audit 调 runWithAudit 做业务变更 + 审计。
 */

import { sql } from "drizzle-orm";
import { auditEntries, realtimeEvents, type ActorType, type EntityType } from "@db/schema";
import type { DrizzleDb } from "@/lib/db/client";
import { redactAuditDetails } from "@/lib/audit/redact";

/**
 * 审计上下文 — 由 S3+ 调用方填;fn 写业务后,runWithAudit 自动写 audit + 可选 realtime。
 */
export interface AuditContext {
  /** audit_entries.entity_type — 7-value enum(goal_space / node_board / node_board_member / card / session / agent_execution / confirm) */
  readonly entityType: EntityType;
  /** audit_entries.entity_id */
  readonly entityId: string;
  /** audit_entries.actor — 3-value enum(human / ai_role / system) */
  readonly actor: ActorType;
  /** audit_entries.actor_id — 匿名操作可传 null */
  readonly actorId: string | null;
  /** audit_entries.action — 自由文本,如 "create" / "transition" / "complete" / "cancel" */
  readonly action: string;
  /** audit_entries.before_state — JSON,变更前快照;无前置状态(创建)可省略或 null */
  readonly beforeState?: Record<string, unknown> | null;
  /** audit_entries.after_state — JSON,变更后快照 */
  readonly afterState?: Record<string, unknown> | null;
  /** audit_entries.details — JSON,默认 `{}`;放 trigger / reason / diff 等元信息 */
  readonly details?: Record<string, unknown>;
  /** realtime_events.goal_space_id — 必填,即使 skipRealtime 也需提供以保 type-check 完整 */
  readonly goalSpaceId: string;
  /** realtime_events.type — 自由文本,如 "card.transitioned" / "goal_space.completed" */
  readonly type: string;
  /** realtime_events.resource_type — 自由文本,与 audit entityType 可同可不同(realtime 允许 "confirmation") */
  readonly resourceType: string;
  /** realtime_events.resource_id — 触发本次事件的资源 id(可为 card / goal_space / etc.) */
  readonly resourceId: string;
  /** realtime_events.data — JSON,默认 `{}` */
  readonly data?: Record<string, unknown>;
  /** 跳过 realtime 写(纯审计场景,如内部一致性写) */
  readonly skipRealtime?: boolean;
}

/** Drizzle better-sqlite3 transaction 回调里的 tx 类型,供 fn 形参使用 */
export type AuditTx = Parameters<DrizzleDb["transaction"]>[0] extends (tx: infer T) => unknown
  ? T
  : never;

/**
 * 在 `db.transaction(...)` 中执行 `fn`,fn 完成后自动追加 audit_entries(强制)+ 可选 realtime_events。
 * fn 抛错 / audit 写失败 → 整事务回滚(业务变更不会落库)。
 *
 * realtime sequence 单调递增通过 `SELECT COALESCE(MAX(sequence), 0) + 1 FROM realtime_events
 * WHERE goal_space_id = ?` 子查询实现,该子查询在同一事务内执行,避免并发覆盖。
 */
export function runWithAudit<T>(db: DrizzleDb, ctx: AuditContext, fn: (tx: AuditTx) => T): T {
  return db.transaction((tx) => {
    const result = fn(tx);

    // SEC-005: scrub sensitive keys from JSON blobs before INSERT.
    // Per NFR §5.2/§5.5: audit logs must not contain plaintext credentials.
    // redactAuditDetails throws if serialized payload exceeds 32 KB; the
    // thrown error propagates so better-sqlite3 rolls back the transaction.
    const redactedDetails = redactAuditDetails(ctx.details ?? {}) as Record<string, unknown>;
    const redactedBeforeState = ctx.beforeState
      ? (redactAuditDetails(ctx.beforeState) as Record<string, unknown>)
      : null;
    const redactedAfterState = ctx.afterState
      ? (redactAuditDetails(ctx.afterState) as Record<string, unknown>)
      : null;
    const redactedRealtimeData = ctx.data
      ? (redactAuditDetails(ctx.data) as Record<string, unknown>)
      : {};

    // 1) audit_entries 强制写(S2 AC-4.2:fn 成功 + audit 写失败 → 整事务回滚)
    tx.insert(auditEntries)
      .values({
        entityType: ctx.entityType,
        entityId: ctx.entityId,
        action: ctx.action,
        actor: ctx.actor,
        actorId: ctx.actorId,
        beforeState: redactedBeforeState,
        afterState: redactedAfterState,
        details: redactedDetails,
      })
      .run();

    // 2) realtime_events 可选写 — skipRealtime=true 跳过
    if (!ctx.skipRealtime) {
      tx.insert(realtimeEvents)
        .values({
          goalSpaceId: ctx.goalSpaceId,
          // 单 SQL 子查询读 max+1;并发事务由 better-sqlite3 串行化保证
          sequence: sql`(SELECT COALESCE(MAX(sequence), 0) + 1 FROM realtime_events WHERE goal_space_id = ${ctx.goalSpaceId})`,
          type: ctx.type,
          resourceType: ctx.resourceType,
          resourceId: ctx.resourceId,
          data: redactedRealtimeData,
        })
        .run();
    }

    return result;
  });
}
