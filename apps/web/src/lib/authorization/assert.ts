/**
 * S2 F-003 断言工具
 *
 * 真相源: docs/specs/authorization_matrix.md § 4 错误码 + § 5 强制门禁
 *   - 403 Forbidden: actor 无权(can 全部 false);S3 route handler 捕获后转 403
 *   - 409 Conflict: pending confirmation 阻塞 execute;由 S3 service 层判定后转 409
 *
 * 本文件只承担 403 路径的 can-boolean → throw 收口;409 不走此路径(语义不同)。
 * S3 调用模式:const allowed = canXxx(actor, ctx); assertAccess(allowed, msg);
 */

import type { AccessResult } from "./types";

/**
 * 权限不足错误。
 * - code='FORBIDDEN' 供上层 envelope 解析统一映射到 HTTP 403
 * - name='ForbiddenError' 便于 instanceof / 错误监控识别
 */
export class ForbiddenError extends Error {
  readonly code = "FORBIDDEN";
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * 断言权限通过;否则抛 ForbiddenError。
 * - 与 canXxx 配对使用,把 boolean 收口为 throw
 * - asserts allowed is true 形式给 TypeScript 推断:throw 后 narrow 为 true
 *
 * @param allowed   can 函数返回值
 * @param message   自定义错误信息(可选);默认 "Forbidden"
 * @throws ForbiddenError 当 allowed === false
 */
export function assertAccess(allowed: AccessResult, message?: string): asserts allowed is true {
  if (!allowed) {
    throw new ForbiddenError(message);
  }
}
