# 技术概要设计模板（HLD + LLD 详细版 / IEEE 1016 SDD 扩展）

> 🎯 **本文档定位**：**给研发/架构师的设计依据** — 用于评审、对齐、归档、新人入职理解。同时作为 [dev-prompts](../dev-prompts/SKILL.md) 生成研发提示词的**内容源**。
>
> ⚠️ **不是直接给 AI 的提示词**。AI 写代码看的是研发提示词，不是本文档。
>
> 📐 **详细度**：HLD（高层架构）+ LLD（详细设计）混合。涵盖完整 DDL / OpenAPI / Service 伪代码 / 状态机 / 错误码 / 操作日志 / 双消息 / 集成等。

---

# <模块/系统名> 技术概要设计（HLD + LLD）

## 1. 文档信息

| 项 | 内容 |
|---|---|
| 文档类型 | 技术概要设计（HLD + LLD）|
| 版本 | v1.0 |
| 日期 | YYYY-MM-DD |
| 关联 PRD | ./PRD-XXX-<日期>.md |
| 关联原型 | ./原型-XXX-<日期>-offline.html |
| 关联数据源 | ./prd-data-XXX-<日期>.json |
| 评审状态 | 待评审 / 评审通过 / 已发布 |
| 变更日志 | <列出关键变更点> |

## 2. 引言

### 2.1 目的
本文档为 <模块名> 提供技术设计依据，作为研发实施、评审、归档的标准。

### 2.2 范围
- **包含**：<列出本设计覆盖的子模块>
- **不包含**：<列出边界>

### 2.3 术语
| 术语 | 含义 |
|---|---|
| <术语 1> | <含义> |

### 2.4 参考资料
- PRD / 原型 / prd-data.json
- 行业规范：<如 ISO / GDPR / HIPAA>

## 3. 总体设计

### 3.1 架构图（Mermaid）
```
[前端 Vue 3] ─HTTPS→ [API 网关] ─→ [微服务集群] ─→ [DB/Cache/MQ]
```

### 3.2 技术栈
| 层 | 选型 | 版本 | 理由 |
|---|---|---|---|
| 前端 | <Vue 3 / React> | <版本> | <理由> |
| 后端 | <Spring Boot / NestJS> | <版本> | <理由> |
| DB | <MySQL / PostgreSQL> | <版本> | <理由> |
| 缓存 | <Redis> | <版本> | <理由> |
| MQ | <Kafka / RabbitMQ> | <版本> | <理由> |

### 3.3 部署架构
- 容器：Docker + K8s
- 副本：3 个
- 灰度策略：<蓝绿 / 滚动>

## 4. 模块划分

按 prd-data.json menus 映射后端模块：

```
<系统名>
├── 模块 1：<名称>（核心 / 必做 / Phase 1）
├── 模块 2：<名称>（重要 / Phase 2）
└── 模块 3：<名称>（远期 / Phase 3）
```

## 5. 数据模型（完整 DDL / LLD）⭐

### 5.1 ER 图（Mermaid）
```
[<实体 A>] ──1:N── [<实体 B>] ──N:M── [<实体 C>]
```

### 5.2 表设计（每张表完整 DDL）

#### 5.2.1 `<table_name>` 表

**完整 DDL（可直接执行）**：

```sql
CREATE TABLE `<table_name>` (
  `id` BIGINT NOT NULL AUTO_INCREMENT COMMENT '主键',
  `<业务编号>` VARCHAR(16) NOT NULL COMMENT '业务编号（<规则>）',
  `<字段 1>` VARCHAR(60) NOT NULL COMMENT '<注释>',
  `<字段 2>` DECIMAL(10,2) NOT NULL DEFAULT 0.00 COMMENT '<注释>',
  `<字段 3>` TINYINT NOT NULL DEFAULT 1 COMMENT '状态：1=启用 0=停用',
  `is_deleted` TINYINT NOT NULL DEFAULT 0 COMMENT '软删除：0=未删 1=已删',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `created_by` VARCHAR(64) NOT NULL COMMENT '创建人',
  `updated_by` VARCHAR(64) NOT NULL COMMENT '更新人',
  `version` INT NOT NULL DEFAULT 0 COMMENT '乐观锁版本号',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_<编号>` (`<业务编号>`),
  UNIQUE KEY `uk_<名称>` (`<字段 1>`, `is_deleted`),
  KEY `idx_<字段>` (`<字段>`),
  KEY `idx_status_deleted` (`<字段 3>`, `is_deleted`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='<表注释>';
```

**初始化数据**：
```sql
INSERT INTO `<table_name>` (...) VALUES (...);
```

#### 5.2.2 `operation_log` 表（标配）
（完整 DDL）

### 5.3 数据字典
| 字段 | 取值 | 含义 |
|---|---|---|
| status | 1 | 已启用 |
| status | 0 | 已停用 |

## 6. 接口设计（OpenAPI 3.0 / LLD）⭐

### 6.1 通用响应格式
```json
{
  "code": 0,
  "message": "success",
  "data": { /* 业务数据 */ },
  "trace_id": "<追踪 ID>",
  "timestamp": 1717667800
}
```

### 6.2 完整 OpenAPI 3.0 定义（可导入 Swagger / Apifox）

```yaml
openapi: 3.0.3
info:
  title: <模块名> API
  version: 1.0.0
servers:
  - url: https://api.example.com/v1

paths:
  /api/<resource>:
    get:
      summary: 分页查询
      tags: [<模块名>]
      security:
        - bearerAuth: []
      parameters:
        - name: page
          in: query
          schema: { type: integer, default: 1 }
        - name: pageSize
          in: query
          schema: { type: integer, default: 10, maximum: 100 }
        - name: <过滤字段>
          in: query
          schema: { type: string }
      responses:
        '200':
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/<Resource>PageResponse'
              examples:
                success:
                  value:
                    code: 0
                    data:
                      total: 13
                      list: [...]
        '401': { $ref: '#/components/responses/Unauthorized' }
        '403': { $ref: '#/components/responses/Forbidden' }

    post:
      summary: 新增
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/Create<Resource>Request'
      responses:
        '200': { $ref: '#/components/responses/<Resource>Created' }
        '400': { $ref: '#/components/responses/BadRequest' }
        '409':
          description: 业务冲突
          content:
            application/json:
              schema: { $ref: '#/components/schemas/ErrorResponse' }
              examples:
                duplicate:
                  value: { code: 20001, message: '名称已存在' }

  /api/<resource>/{id}:
    put: { /* 编辑 */ }
    delete: { /* 删除 */ }

  /api/<resource>/{id}/status:
    patch: { /* 启用/停用 */ }

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    <Resource>VO: { /* 字段定义 */ }
    Create<Resource>Request: { /* 字段定义 */ }
    Update<Resource>Request: { /* 字段定义 */ }
    Query<Resource>Request: { /* 字段定义 */ }

  responses:
    Unauthorized: { description: '未登录' }
    Forbidden: { description: '无权限' }
    BadRequest: { description: '参数错误' }
```

### 6.3 接口非功能要求
| 接口 | TPS | P99 | 可用性 | 限流 |
|---|---|---|---|---|
| 查询 | 1000 | 200ms | 99.95% | 100/s/user |
| 写 | 200 | 500ms | 99.9% | 20/s/user |

## 7. 实体类 / DTO / VO 字段清单 🆕（LLD）

### 7.1 Entity（数据库映射）

```
<Resource>（@TableName("<table_name>")）
- id: Long（@TableId）
- <业务编号>: String（@TableField）
- <字段 1>: String
- ...
- isDeleted: Integer（@TableLogic）
- version: Integer（@Version）
- 审计字段（继承 BaseEntity）
```

### 7.2 DTO（请求）

**Create<Resource>Request**：
| 字段 | 类型 | 校验注解 | 说明 |
|---|---|---|---|
| <字段 1> | String | @NotBlank, @Size(min=1,max=30) | <说明> |
| <字段 2> | BigDecimal | @NotNull, @DecimalMin("0"), @DecimalMax("999999.99") | <说明> |

**Update<Resource>Request**：同上 + version（@NotNull）

**Query<Resource>Request**：
| 字段 | 类型 | 默认值 | 说明 |
|---|---|---|---|
| page | Integer | 1 | |
| pageSize | Integer | 10 | @Max(100) |

### 7.3 VO（响应）
| 字段 | 类型 | 序列化 | 说明 |
|---|---|---|---|
| id | Long | | |
| <业务编号> | String | | |
| ... | ... | | |
| createdAt | LocalDateTime | @JsonFormat("yyyy-MM-dd HH:mm:ss") | |

## 8. Service 业务逻辑伪代码 🆕（LLD）⭐

> 每个核心功能点的业务逻辑用**伪代码**表达。**不是具体 Java 代码**，而是 `if-then-else / 校验顺序 / 事务边界` 的清晰流程。

### 8.1 新增（create）伪代码

```
function create(CreateRequest dto, currentUser) {
    // Step 1: 参数级校验（@Valid 自动处理）

    // Step 2: 业务前置校验
    checkNameUnique(dto.name, excludeId=null)         // 抛 20001
    checkValueRange(dto.value)                         // 抛 20002
    checkBusinessRule(dto)                             // 抛 2000X

    // Step 3: 生成业务编号
    code = redis.incr("<resource>:seq")
    businessCode = "<前缀>" + format("%04d", code)

    // Step 4: 落库（事务内）
    @Transactional {
        entity = build(dto, businessCode, currentUser)
        mapper.insert(entity)

        // Step 5: 发送业务下发消息（如属于 8 类）
        kafka.send("<topic>", buildEvent(entity))     // 异步
    }

    // Step 6: 操作日志（AOP 自动处理 / @OperationLog）
    return toVO(entity)
}
```

### 8.2 编辑（update）伪代码

```
function update(id, UpdateRequest dto, currentUser) {
    @Transactional {
        // Step 1: 加锁查询（乐观锁 / 行锁）
        entity = mapper.selectByIdForUpdate(id)
        if (entity == null) throw 404

        // Step 2: 业务前置校验
        checkNameUnique(dto.name, excludeId=id)
        checkVersionMatch(entity.version, dto.version) // 乐观锁

        // Step 3: 差异计算（用于操作日志旧→新）
        oldValues = snapshot(entity)
        applyChanges(entity, dto)

        // Step 4: 落库
        mapper.updateById(entity)

        // Step 5: 缓存淘汰
        redis.del("<resource>:cache:" + id)
    }
    return toVO(entity)
}
```

### 8.3 删除（软删）伪代码
（同上，含关联依赖校验）

### 8.4 启用/停用 伪代码
（含状态机校验）

### 8.5 查询 伪代码
（含缓存 + 分页 + 过滤）

## 9. 状态机详细表 🆕（LLD）

### 9.1 状态机流转图（Mermaid）

```
stateDiagram-v2
    [*] --> 已启用: 新增
    已启用 --> 已停用: 停用
    已停用 --> 已启用: 启用
    已启用 --> 已删除: 删除（关联=0）
    已停用 --> 已删除: 删除（关联=0）
```

### 9.2 完整状态转换表

| # | 当前状态 | 触发动作 | 目标状态 | 前置条件 | 后置动作 | 异常处理 |
|---|---|---|---|---|---|---|
| 1 | 初始 | 新增 | 已启用 | 名称唯一 + 值合规 | 发送 created 事件 | 唯一冲突 → 20001 |
| 2 | 已启用 | 停用 | 已停用 | 当前=已启用 | 通知关联方 | 已停用 → 20004 |
| 3 | 已停用 | 启用 | 已启用 | 当前=已停用 | 通知关联方 | 已启用 → 20004 |
| 4 | 任意 | 删除 | 已删除 | 关联依赖 = 0 | 软删除标记 | 有关联 → 20003 |

## 10. 事务 / 锁 / 缓存策略 🆕（LLD）

### 10.1 事务边界
| 操作 | 事务范围 | 隔离级别 | 超时 |
|---|---|---|---|
| 新增 | Service.create() | REPEATABLE_READ | 5s |
| 编辑 | Service.update() | REPEATABLE_READ | 5s |
| 删除 | Service.delete() | REPEATABLE_READ | 3s |
| 状态切换 | Service.updateStatus() | REPEATABLE_READ | 3s |

### 10.2 锁策略
| 场景 | 锁类型 | 说明 |
|---|---|---|
| 编辑同行 | 乐观锁（version）| @Version 注解 |
| 高并发新增同名 | Redis 分布式锁 | key=`<resource>:name:<name>`, TTL=5s |
| 状态机切换 | DB 行锁 | SELECT FOR UPDATE |

### 10.3 缓存策略
| 数据 | 缓存层 | Key | TTL | 淘汰时机 |
|---|---|---|---|---|
| 单实体（按 ID）| Redis | `<resource>:<id>` | 60s | 更新/删除时 del |
| 分页查询 | Redis | `<resource>:page:<hash>` | 60s | 写操作清 prefix |
| 业务编号序列 | Redis INCR | `<resource>:seq` | 永久 | 不淘汰 |

## 11. 错误码完整清单 🆕（LLD）⭐

| 错误码 | HTTP | 类型 | 含义 | 用户提示文案 |
|---|---|---|---|---|
| 0 | 200 | 成功 | 成功 | - |
| 10001 | 400 | 参数 | 必填字段缺失 | 请填写 <字段名> |
| 10002 | 400 | 参数 | 字段格式不合法 | <字段名>格式错误 |
| 10003 | 400 | 参数 | 字段超出范围 | <字段名>范围 X~Y |
| 20001 | 409 | 业务 | 名称已存在 | 该等级名称已存在，请换一个 |
| 20002 | 409 | 业务 | 业务规则冲突 | <具体提示> |
| 20003 | 409 | 业务 | 关联依赖 | 该等级有 N 个关联会员，不可删除 |
| 20004 | 409 | 业务 | 状态机非法 | 该等级已启用，无需重复操作 |
| 30001 | 401 | 鉴权 | 未登录 | 请先登录 |
| 30002 | 403 | 鉴权 | 无权限 | 您无此操作权限 |
| 40001 | 500 | 数据库 | DB 异常 | 系统繁忙，请稍后重试 |
| 50001 | 500 | 第三方 | 外部依赖故障 | 系统繁忙，请稍后重试 |
| 90001 | 500 | 系统 | 未知异常 | 系统异常，请联系客服 |

## 12. 操作日志详细规则 🆕（LLD）

### 12.1 注解使用
```
@OperationLog(
  module = "<完整菜单路径，如 会员中心系统-会员-会员中心-会员等级>",
  function = "新增" | "编辑" | "删除" | "启用" | "停用",
  detailSpEL = "<SpEL 表达式>"
)
```

### 12.2 每个功能点的 detail 完整规则

| 功能点 | detail SpEL 表达式 | 示例输出 |
|---|---|---|
| 新增 | `'新增<对象>：编号=' + #result.code + '，名称=' + #args[0].name + '，<其它关键字段>=' + ...` | `新增会员等级：编号=VL0014，名称=白金卡，升级阈值=¥3000` |
| 编辑 | `'编辑<对象>：编号=' + #oldValue.code + '，' + #diff.toString()` | `编辑会员等级：编号=VL0001，升级阈值：¥0→¥100` |
| 删除 | `'删除<对象>：编号=' + #oldValue.code + '，名称=' + #oldValue.name` | `删除会员等级：编号=VL0010，名称=生日特卡` |
| 启用 | `'启用<对象>：编号=' + #oldValue.code` | `启用会员等级：编号=VL0004` |
| 停用 | `'停用<对象>：编号=' + #oldValue.code` | `停用会员等级：编号=VL0012` |

### 12.3 写入策略
- 异步（@Async）写入，不阻塞主流程
- 失败重试 3 次
- 保留期：3 年（按月分区）

## 13. 双消息详细规则 🆕（LLD）

> 业务下发 8 类（上架/下架/改价/发布/发货/签收/退货申请/退货完成）必出双消息。

### 13.1 消息 1（操作人确认）

| 字段 | 内容 |
|---|---|
| 接收人 | 操作账号本人 |
| 渠道 | 站内信 + Toast |
| 标题 | <动作>成功 |
| 内容 | 您于 <时间> 成功<动作>了 <对象 N> 个 |
| 触发时机 | Service 方法成功返回后 |

### 13.2 消息 2（受影响方通知）

| 字段 | 内容 |
|---|---|
| 接收人 | <具体角色>（如：门店店长 / 受影响商户）|
| 渠道 | 站内信 + 短信 / 邮件 / Push |
| 标题 | <动作>通知 |
| 内容 | <对象>于 <时间> 发生了 <动作>，请关注 |
| 触发时机 | MQ 异步下发 |

### 13.3 实现方式
- 通过 Kafka 异步发送
- 接收人具体化（**禁止**"操作人/发起人"等抽象词）

## 14. 集成与依赖 🆕（LLD）

### 14.1 内部依赖
| 系统 | 用途 | 接口 | 故障应对 |
|---|---|---|---|
| 统一账号中心 | 鉴权 / 用户信息 | /api/auth/* | JWT 验证失败 → 401 |
| <其它内部系统> | <用途> | <接口> | <降级方案> |

### 14.2 外部依赖
| 第三方 | 用途 | SDK 版本 | 故障应对 |
|---|---|---|---|
| <SDK 1> | <用途> | <版本> | 熔断 + 降级 |

### 14.3 集成清单
- 微信支付 / 支付宝 / Stripe（如适用）
- 短信 / 邮件 / Push 服务商
- 监控 / 日志 / APM SDK

## 15. 关键技术决策

| 决策 | 选项对比 | 最终方案 | 理由 |
|---|---|---|---|
| 唯一性校验 | DB UNIQUE / 应用层预查 / 分布式锁 | 三者结合 | 防并发 + 兜底 |
| 编号生成 | DB 自增 / Redis INCR / Snowflake | Redis INCR | 性能 + 顺序 |
| 软删除策略 | is_deleted / deleted_at / 物理删除 | is_deleted | 简单可恢复 |

## 16. 非功能需求

### 16.1 性能
- 列表 P99 < 200ms
- 写操作 P99 < 500ms
- 并发用户：<X>

### 16.2 可用性
- SLA 99.95%
- 多可用区 + 主从 + 跨区备份

### 16.3 安全
- 鉴权：JWT + Refresh Token
- 防护：SQL 注入 / XSS / CSRF / 越权
- 审计：完整操作日志

### 16.4 可观测
- 日志：ELK / Loki
- 监控：Prometheus + Grafana
- 链路：SkyWalking / Jaeger

## 17. 风险与依赖

| 风险 | 概率 | 影响 | 应对 |
|---|---|---|---|
| <技术风险 1> | 中 | 高 | <应对> |
| <业务风险 1> | 低 | 中 | <应对> |

## 18. 实施计划

| 阶段 | 内容 | 工期 | 负责人 |
|---|---|---|---|
| 详细设计 | DDL + OpenAPI + 接口契约定稿 | 0.5 周 | <角色> |
| 开发 | 后端 + 前端 + 联调 | 2 周 | <角色> |
| 测试 | 单元 + 集成 + 性能 + E2E | 1 周 | <角色> |
| 上线 | 灰度 + 全量 + 监控 | 0.5 周 | <角色> |

---

## 附录

- DDL：`./db/<模块>.sql`（含完整建表 + 索引 + 初始数据）
- API 契约：`./api/<模块>.yaml`（完整 OpenAPI 3.0）
- 业务伪代码：本文档 §8
- Postman 集合：`./postman/<模块>.json`
