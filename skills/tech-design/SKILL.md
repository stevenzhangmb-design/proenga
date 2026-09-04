---
name: tech-design
description: 根据 pm-design 生成的原型 + prd-data.json 输出"技术概要设计文档"（HLD+LLD 详细版 / 18 章节 / 含完整 DDL、OpenAPI 3.0、Service 业务伪代码、状态机详细表、错误码清单、操作日志/双消息详细规则、事务锁缓存策略、集成与依赖）。用于用户说"生成技术概要设计 / 写技术设计 / 出技术方案 / 给开发的设计文档"等场景。**定位：研发的设计依据 + dev-prompts 的内容源**，不是直接给 AI 用的。原型改了必须重跑同步。
---

## ⚠️ 本 skill 的定位（必读 / 防概念混淆）

| 项 | 说明 |
|---|---|
| 🎯 **真实用途** | 给研发/架构师的**设计依据**（评审 / 对齐 / 归档 / 新人入职理解）|
| 📥 **下游用途** | 作为 [dev-prompts](../dev-prompts/SKILL.md) 生成研发提示词的**内容源**之一 |
| ❌ **不是什么** | **不是**直接给 AI 工具的提示词。AI 写代码看的是 dev-prompts 的输出，不是本文档 |
| 📐 **详细度** | HLD（高层架构）+ LLD（详细设计）混合 — 18 章节涵盖完整 DDL / OpenAPI / 伪代码 / 状态机 / 错误码 / 操作日志 / 双消息 / 集成 |

## 🏛 默认技术栈规范（强制 / 生成 DDL·契约·分层·伪代码前必读）

> **技术选型、分层、DDL、错误码、i18n 一律按** [`../_shared/dev-stack-spec.md`](../_shared/dev-stack-spec.md)（从真实生产代码提炼的默认技术规范），**旧的教科书写法作废**。要点：后端**四层** Controller→Logic→Service→Mapper（非两层）· 统一 `Result<T>`（2000/301/500）· 错误码 = 数字码 + 4 语言常量类（zh/en/pt/spa，非简单 enum）· DDL = 雪花 id + 逻辑删除 + tenant_id + 审计列 + 每列 COMMENT + 金额 DECIMAL(14,2) · 前端 Vue3+TS+EP+Vuex + `v-buttonAuth` + 自研 `lang()`（默认 pt）· 移动版 uni-app+uv-ui+rpx。**UI 令牌另见** [`../pm-design/system-design-spec.md`](../pm-design/system-design-spec.md)。


# Tech-Design Skill — 技术概要设计

## 触发场景

| 触发 | 示例 |
|---|---|
| 原型确认后 | "原型 OK 了，出技术概要设计" |
| 显式指令 | "生成技术设计 / 写技术方案 / 出技术概要 / 给开发的设计文档" |
| 同步更新 | "原型改了，技术设计同步更新一下" |

## 输入（单一真理源）

1. **prd-data.json**（pm-design 生成的）—— 字段规范 + 用例规则 + 菜单 + 功能点
2. **原型 HTML**（视觉参考）
3. **可选**：用户补充的技术约束（DB 选型 / 框架 / 部署环境）

## 输出

单文件，前缀 `技术概要设计`，输出目录 / 命名 / `.docx` 同步均按公共约定 [../_shared/downstream-skill-conventions.md §1](../_shared/downstream-skill-conventions.md)。

## 文档结构（标准模板）

```markdown
# <模块名> 技术概要设计

## 1. 文档信息
- 关联 PRD：./<prd-file>.md
- 关联原型：./<prototype-file>.html
- 关联数据源：./<prd-data-file>.json
- 版本 / 日期 / 作者

## 2. 系统架构
- 整体架构图（mermaid）
- 技术栈选型（前端 / 后端 / DB / 缓存 / 消息队列 / 部署）
- 部署架构

## 3. 模块划分
- 按 prd-data.json 的 menus 结构对应后端模块
- 模块职责 / 依赖关系

## 4. 数据模型
按 field_specs.groups 生成表结构：
- 表名 / 字段名 / 类型 / 长度 / 必填 / 默认值 / 索引 / 外键
- 必含：主键 + 创建时间 + 更新时间 + 创建人 + 更新人 + 软删除标记
- 状态机字段单独标注（如 status enum）

## 5. 接口设计
按功能点（fp_key）生成 RESTful API：
- 查询 → GET /api/<resource>?<filters>
- 新增 → POST /api/<resource>
- 编辑 → PUT /api/<resource>/<id>
- 删除 → DELETE /api/<resource>/<id>
- 启用/停用 → PATCH /api/<resource>/<id>/status
- 每个接口含：请求参数 / 响应结构 / 错误码 / 鉴权要求 / 限流策略

## 6. 状态机
按 use_cases.preconditions 的业务前置 + use_cases.validations 提炼状态流转图

## 7. 关键技术决策
- 唯一性校验：DB 唯一索引 + 应用层预查
- 业务前置：关联依赖 / 状态机 / 时效 4 类的实现方式
- 双消息通知：消息队列 / 站内信 / 短信 / 邮件 接入方案
- 软删除：is_deleted 字段 vs 物理删除策略
- 操作日志：表结构 + 写入时机（AOP / 中间件）

## 8. 非功能需求
- 性能：TPS / 响应时间 / 并发数
- 安全：鉴权 / 数据脱敏 / SQL 注入防护 / XSS
- 可用性：SLA / 灾备 / 降级方案
- 可扩展：水平扩展 / 垂直扩展

## 9. 风险与依赖
- 第三方系统依赖
- 数据迁移风险
- 团队能力风险
```

## 与 prd-data.json 的映射规则

> 字段语义以 schema 真理源 [../pm-design/prd-data-schema.md](../pm-design/prd-data-schema.md) 为准；下表只做 schema 字段 → 技术设计章节的映射，不重定义字段语义。

| prd-data.json 内容 | 对应技术设计章节 |
|---|---|
| `menus` 结构 | §3 模块划分 |
| `field_specs.groups[].fields[]` | §4 数据模型表字段 |
| `field_specs[].constraint` 含「同 X 唯一」 | §4 索引 + §7 唯一性校验方案 |
| `field_specs[].constraint` 含「VL + 4 位流水号」 | §7 编号生成策略 |
| 功能点 fp_type | §5 RESTful API HTTP 方法 |
| `use_cases.preconditions` | §5 接口鉴权 + §7 业务前置实现 |
| `use_cases.postconditions` 含状态变化 | §6 状态机 |
| `use_cases.validations` | §7 业务校验实现 |
| `use_cases.message_notifications` 双消息 | §7 消息队列方案 |
| `use_cases.operation_log` | §7 操作日志表 + 写入方案 |

## 同步更新机制

按公共统一同步 SOP [../_shared/downstream-skill-conventions.md §2](../_shared/downstream-skill-conventions.md)：技术设计存在大量跨章节依赖（字段变更牵动建表/接口/状态机），**默认整篇重新生成**（不增量），并在文档头追加变更日志（哪些字段/接口/状态机变了）。

## 离线版

技术设计文档是 .md 不需要离线版（直接 markdown 阅读即可）。

## 适用产品形态

任何产品形态：ERP / WMS / OMS / CRM / 零售 / B2C / B2B / SaaS / APP / 小程序 / IM / 教育 / 医疗 / 金融 / 物流 / IoT / DevOps / CMS 等。

按业务对象自动选择对应的数据模型 / 接口风格。

## 规范遵守

本 skill 遵守 [pm-design/v1-master-spec.md](../pm-design/v1-master-spec.md) 的**单一真理源原则**——以 prd-data.json 为数据源，禁止脱离数据源凭空写技术设计。
