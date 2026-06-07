/**
 * F-004 audit 模块 barrel re-export
 *
 * 真相源: F-004 AC-4.7 (append-only 边界)
 *   - 只导出 runWithAudit / AuditContext / AuditTx
 *   - 显式不导出 updateAuditEntry / deleteAuditEntry / truncateAudit / dropAuditTable / removeAuditEntry
 *   - append-only 由 API 边界 enforce;物理 DB 写权限由 S3+ handler 限定
 *
 * S2 范围内:无更新/删除/截断/拖表 API;若 S3+ 需要"软删除"等场景,应在 audit 之外开新表,本表只 append。
 */

export { runWithAudit } from "./run-with-audit";
export type { AuditContext, AuditTx } from "./run-with-audit";
