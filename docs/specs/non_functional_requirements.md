# KEPLAR 非功能指标规范

## 0. 适用范围

Phase 1 非功能门禁只覆盖 **Web-first 本地 demo**：Next.js Web/API runtime、SQLite demo persistence、SSE dashboard、stub/fixture AI execution boundary、结构化日志、权限与审计一致性。

Production/Future 指标用于后续阶段设计，不阻塞 Phase 1 开发冻结：PostgreSQL 生产运行、Kubernetes/HPA、真实 ACP/MCP/A2A 外部写集成、Tauri 桌面端、OpenTelemetry collector、容器安全、生产备份和高可用。

## 1. 性能

### 1.1 API 响应时间

Phase 1 本地 demo 目标：

| 场景 | 目标 | 说明 |
|------|------|------|
| 简单查询（读取卡片、状态） | < 100ms | P95，第95百分位 |
| 写入操作（创建卡片、更新状态） | < 200ms | P95 |
| 列表查询（目标空间列表、卡片列表） | < 300ms | 含缓存命中 |
| 首次加载（Dashboard 完整数据） | < 1s | 含 SSE 连接建立 |

### 1.2 AI 任务执行延迟

Phase 1 允许使用 stub/fixture executor，但必须保留同一超时和 blocked contract。

| 角色 | 预期时间 | 超时阈值 |
|------|---------|---------|
| Backlog Refiner | 5-15s | 30s |
| Todo Orchestrator | 2-5s | 15s |
| Dev Crafter | 10-30s | 60s |
| Review Guard | 5-15s | 30s |
| Done Reporter | 2-5s | 15s |
| Blocked Resolver | 5-20s | 30s |

**前端进度提示要求：**
- AI 任务提交后 3s 内显示"AI 处理中..."
- 超过预期时间 50% 显示进度条或预估时间
- 超过超时阈值自动进入 Blocked 并通知用户

### 1.3 SSE 实时推送延迟

| 事件类型 | 目标延迟 | 说明 |
|---------|---------|------|
| 卡片状态变更 | < 500ms | 从状态变更到前端渲染 |
| AI 角色活动 | < 1s | 实时展示 AI 工作进度 |
| 异常告警 | < 300ms | Blocked/错误优先推送 |

### 1.4 缓存策略

Phase 1 可先使用应用内缓存或请求级缓存；分布式缓存属于 Future/Production。

| 缓存对象 | TTL | 失效策略 |
|---------|-----|---------|
| 目标空间列表 | 5min | 主动失效（写入时） |
| 卡片列表 | 1min | 主动失效 + SSE 推送 |
| 卡片详情 | 30s | 主动失效 |
| 用户信息 | 15min | 被动失效 |

---

## 2. 可扩展性

Phase 1 不要求水平扩展；以下能力仅作为 Future/Production 目标。

### 2.1 水平扩展

| 组件 | 扩展方式 | 无状态 |
|------|---------|-------|
| Next.js API | K8s HPA / 负载均衡 | Future |
| Tauri 桌面端 | 单实例 | Future |
| ACP Session Runner | K8s HPA | Future |
| SSE 连接管理器 | Sticky Session 或共享 broker | Future |

### 2.2 数据库扩展

| 方案 | 适用场景 | 限制 |
|------|---------|------|
| SQLite | Phase 1 单机 Demo | 不支持高并发写入 |
| PostgreSQL 单机 | Future 小规模生产 | 单点 |
| PostgreSQL 主从 | Future 高可用 | 读写分离需配置 |
| PostgreSQL + PgBouncer | Future 多租户 | 连接池配置 |

### 2.3 外部服务扩展

| 服务 | 扩展方式 |
|------|---------|
| LLM (Anthropic/OpenAI) | Phase 1 通过 executor contract 隔离；真实调用后续接入限流 + 重试 |
| MCP 工具 | Future 连接池 + 超时 |
| ACP 代理 | Future 消息队列削峰 |

---

## 3. 可用性与高可用

Phase 1 只要求本地 demo 可恢复、错误可见、SSE 可重连；生产 SLA 和 HA 属于 Future/Production。

### 3.1 可用性目标

| 组件 | 可用性目标 | 说明 |
|------|-----------|------|
| Web 前端 | Phase 1 本地可用 | 页面错误可见，可刷新恢复 |
| API 服务 | Phase 1 本地可用 | 错误返回结构化响应 |
| 数据库 | Phase 1 SQLite demo | 数据库错误不得静默吞掉 |
| SSE 连接 | Phase 1 断线重连 | 支持 Last-Event-ID replay |
| Web/API 服务 | 99.5% | Future/Production |
| 数据库 | 99.9% | Future PostgreSQL HA |

### 3.2 降级策略

| 场景 | 降级行为 |
|------|---------|
| 网络中断 | 显示错误 Banner，5s 重连，最多重试 3 次 |
| AI 服务不可用 | 卡片进入 Blocked，提示"AI 服务暂不可用" |
| SSE 断开 | 自动重连，丢失消息通过轮询补偿 |
| 数据库只读 | 允许查看，禁用写入，显示维护提示 |

### 3.3 桌面端断点续传

本节属于 Future/Tauri，不阻塞 Phase 1。

| 数据 | 续传策略 |
|------|---------|
| 会话历史 | 持久化到本地，刷新后恢复 |
| 草稿输入 | 每 30s 自动保存到 localStorage |
| 上传文件 | 分块上传，记录进度，断点续传 |

---

## 4. 安全性

### 4.1 传输安全

| 要求 | 实现 |
|------|------|
| Phase 1 本地开发 | 允许 localhost HTTP；不得把生产凭据写入本地配置或仓库 |
| HTTPS | Production 强制，HTTP 自动跳转 |
| WebSocket/WSS | SSE over HTTPS，无需独立证书 |
| CSRF | SameSite Cookie + Origin 校验 |
| CORS | 限定允许域名 |

### 4.2 认证与授权

| 要求 | 实现 |
|------|------|
| Token 存储 | HttpOnly Cookie 或内存，不持久化到 localStorage |
| 会话过期 | 30min 空闲过期，需重新认证 |
| 桌面端权限 | Future/Tauri：最小权限原则，不使用管理员权限运行 |
| 角色权限 | 按 `docs/specs/authorization_matrix.md` 执行端点级 RBAC 和资源归属校验 |
| 人工确认门禁 | 高风险、低置信度、外部写操作、部署和不可逆操作必须强制确认 |

### 4.3 输入校验

| 校验点 | 要求 |
|-------|------|
| 外部服务参数 | 白名单 + 类型校验，防注入 |
| AI Prompt | 输入长度限制，防 Prompt 注入 |
| 文件上传 | Future/Production：类型白名单、大小限制、病毒扫描 |
| 数据库 | 参数化查询，无字符串拼接 |

### 4.4 容器安全（Future/Production）

Phase 1 不要求容器化交付；以下约束在 Docker/Kubernetes 部署冻结时生效。

| 要求 | 实现 |
|------|------|
| 基础镜像 | 只读根文件系统 |
| 运行用户 | 非 root 用户 (UID 1000) |
| 凭据管理 | Kubernetes Secret / Vault，不进镜像 |
| 网络策略 | 最小暴露，仅开放必要端口 |

---

## 5. 可观测性

Phase 1 必须有结构化日志；OpenTelemetry、Prometheus 和集中日志属于 Future/Production。

### 5.1 指标采集（Future/Production OpenTelemetry）

**基础设施指标：**

| 指标名 | 类型 | 说明 |
|-------|------|------|
| `http_requests_total` | Counter | 请求总数 |
| `http_request_duration_seconds` | Histogram | 请求延迟分布 |
| `http_requests_in_flight` | Gauge | 并发请求数 |
| `db_connections_active` | Gauge | 活跃数据库连接 |
| `sse_connections_active` | Gauge | SSE 连接数 |

**业务指标：**

| 指标名 | 类型 | 说明 |
|-------|------|------|
| `card_state_transitions_total` | Counter | 卡片状态变更次数 |
| `ai_role_executions_total` | Counter | AI 角色执行次数 |
| `ai_role_duration_seconds` | Histogram | AI 角色执行时间 |
| `ai_role_failures_total` | Counter | AI 角色失败次数 |
| `human_confirm_requests_total` | Counter | 人工确认请求数 |
| `blocked_cards_total` | Gauge | 当前阻塞卡片数 |

**导出配置：**

```yaml
# Prometheus exporter config (otel-collector.yaml)
exporters:
  prometheus:
    endpoint: ":9090"
    const_labels:
      app: keplar
```

### 5.2 日志规范

Phase 1 必须至少输出 JSON 或等价结构化日志，覆盖目标、卡片、AI 执行、人工确认、审计和 SSE 投递失败。

| 级别 | 使用场景 |
|------|---------|
| ERROR | AI 调用失败、数据库异常、安全事件 |
| WARN | 降级触发、AI 重试、配置异常 |
| INFO | 会话启动、状态变更、用户操作 |
| DEBUG | AI Prompt/Response、详细执行步骤 |

生产环境默认不得记录完整 AI Prompt/Response、外部工具原始输出、凭据、Cookie、Session Token、数据库连接串或本地文件绝对路径。调试日志必须先经过脱敏，且只能在受控环境短期开启。

**日志格式（JSON）：**

```json
{
  "timestamp": "2026-05-10T14:32:00.000Z",
  "level": "INFO",
  "service": "keplar-api",
  "trace_id": "abc123",
  "span_id": "def456",
  "message": "Card state transition",
  "card_id": "CARD-001",
  "from_state": "dev",
  "to_state": "review",
  "actor": "ai",
  "actor_name": "DevCrafter"
}
```

### 5.3 健康检查

| 端点 | 检查内容 |
|------|---------|
| `GET /api/health` | 服务存活 |
| `GET /api/health/ready` | Future/Production 服务就绪（含依赖检查） |
| `GET /api/health/live` | Future/Production 存活探针（K8s liveness） |

**响应格式：**

```json
{
  "status": "healthy",
  "version": "0.1.0",
  "checks": {
    "database": "ok",
    "llm": "ok",
    "sse": "ok"
  },
  "timestamp": "2026-05-10T14:32:00.000Z"
}
```

### 5.4 链路追踪（Future/Production）

| Span 名称 | 父级 | 属性 |
|----------|------|------|
| `http.request` | — | method, path, status |
| `api.card.create` | http.request | card_id, goal_space_id |
| `ai.role.execute` | api.card.create | role, card_id, duration |
| `llm.call` | ai.role.execute | model, input_tokens, output_tokens |
| `external.mcp.call` | ai.role.execute | tool_name, duration |
| `sse.publish` | — | event_type, client_count |

### 5.5 审计完整性

| 要求 | 实现 |
|------|------|
| Append-only | `audit_entries` 不提供业务更新或删除路径 |
| 事务一致性 | 状态变更、确认决策、外部写操作与审计写入必须同事务提交 |
| 失败策略 | 审计写入失败时，主业务操作必须失败 |
| 保留策略 | 审计记录不随 Goal Space、Card、Confirmation 的软删除而删除 |
| 敏感信息 | 审计详情不得保存明文凭据、完整 Token、未脱敏 Prompt/Response |

---

## 6. 备份与恢复

Phase 1 只要求 SQLite demo 数据可手动备份和恢复；生产 RTO/RPO 属于 Future/Production。

### 6.1 备份策略

| 环境 | 备份方式 | 频率 | 保留 |
|------|---------|------|------|
| SQLite (Demo) | 文件复制 | 每次会话结束 | 7 天 |
| PostgreSQL (Prod) | Future/Production pg_dump + 增量 WAL | 每日全量 + 持续归档 | 30 天 |
| 桌面端 | Future/Tauri 导出 `keplar.db` | 用户手动 | 用户决定 |

### 6.2 RTO / RPO

| 环境 | RTO（恢复时间目标） | RPO（恢复点目标） |
|------|---------------------|-------------------|
| Demo (SQLite) | < 5min（文件复制恢复） | < 1天（上次手动备份） |
| 生产 (PostgreSQL) | Future/Production < 30min（云快照恢复） | < 1小时（持续归档） |

### 6.3 桌面端备份引导（Future/Tauri）

```typescript
// 首次启动时检测到 SQLite 数据库
if (isFirstLaunch && dbExists) {
  showBackupPrompt({
    title: "数据备份",
    message: "建议定期备份您的数据。数据库文件位于：",
    path: appDataDir + "/keplar.db",
    actions: ["立即备份", "稍后提醒", "不再显示"]
  })
}
```

---

## 7. 监控告警

### 7.1 告警规则

| 告警名 | 条件 | 严重度 | 通知方式 |
|-------|------|--------|---------|
| `HighErrorRate` | 5min 内 error rate > 5% | P2 | Slack |
| `AIExecutionSlow` | AI 执行 P95 > 60s | P2 | Slack |
| `SSEConnectionsHigh` | 连接数 > 1000 | P3 | Email |
| `BlockedCardsSpike` | 阻塞卡片数 > 10 | P2 | Slack |
| `DatabaseUnavailable` | 数据库不可达 > 1min | P1 | PagerDuty |

### 7.2 Dashboard 看板（grafana）

| Panel | 数据源 | 说明 |
|-------|--------|------|
| 请求速率 | Prometheus | QPS、错误率 |
| API 延迟 | Prometheus | P50/P95/P99 |
| AI 执行时间 | Prometheus | 各角色执行时间分布 |
| SSE 连接数 | Prometheus | 实时连接数 |
| 卡片状态分布 | Prometheus | 各状态卡片数 |
| 错误日志 | Loki | 最近 ERROR 日志流 |
