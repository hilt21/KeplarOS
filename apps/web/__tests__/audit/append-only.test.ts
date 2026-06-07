/**
 * T-014: append-only 边界静态 import 检查
 *
 * 覆盖范围(per F-004 AC-4.7 / AC-4.10):
 *   验证 @/lib/audit 模块的导出集合中,以下 4 个名字均不存在:
 *     - updateAuditEntry
 *     - deleteAuditEntry
 *     - truncateAudit
 *     - dropAuditTable
 *
 * 真相源: F-004 description "不导出 updateAuditEntry / deleteAuditEntry / truncateAudit"
 *         + AC-4.10 (4 个名字静态 import 检查)
 *
 * 此测试运行在 node 环境(vitest.config.mts environmentMatchGlobs 配置)。无 DB 访问,
 * 仅做模块 namespace 检查,纯 import-time 验证。
 */

import { describe, expect, it } from "vitest";
import * as auditModule from "@/lib/audit";

describe("T-014: append-only 边界", () => {
  it("AC-4.10: 不导出 updateAuditEntry", () => {
    expect(auditModule).not.toHaveProperty("updateAuditEntry");
  });

  it("AC-4.10: 不导出 deleteAuditEntry", () => {
    expect(auditModule).not.toHaveProperty("deleteAuditEntry");
  });

  it("AC-4.10: 不导出 truncateAudit", () => {
    expect(auditModule).not.toHaveProperty("truncateAudit");
  });

  it("AC-4.10: 不导出 dropAuditTable", () => {
    expect(auditModule).not.toHaveProperty("dropAuditTable");
  });
});
