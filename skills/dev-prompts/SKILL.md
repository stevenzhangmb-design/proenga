---
name: dev-prompts
description: 根据 pm-design 生成的原型 + prd-data.json + 技术概要设计输出"研发提示词集"。研发把这些提示词喂给**任何 AI 编码工具**（Cursor / GitHub Copilot / Claude Code / ChatGPT / Codeium / Tabnine / Cline / Aider / 公司私有 AI 等）出代码（含 DB DDL / 后端 CRUD / 前端组件 / 自动化测试 / Docker 等）。**提示词工具无关**，研发用任何 AI 都能跑。用于用户说"生成研发提示词 / 给开发的 AI 提示词 / 让 AI 帮忙写代码"等场景。原型/PRD/技术设计改了必须重跑同步。
---

## ⚠️ 本 skill 的核心原则（必读）

| 项 | 说明 |
|---|---|
| 🌐 **工具无关性** | 输出的提示词**适用任何 AI 编码工具**：Cursor / Copilot / Claude Code / ChatGPT / Codeium / Tabnine / Cline / Aider / 公司私有 AI 等。**禁止**绑定特定工具（如"复制到 Cursor"应改为"复制到你用的 AI 工具"）|
| 📥 **输入依赖** | 提示词的内容源 = **原型 + PRD + 技术概要设计**（三件套）。技术设计越详细（HLD+LLD），提示词内容越扎实 |
| 📤 **输出形态** | 标准化提示词（Markdown 格式），含上下文 + 任务 + 约束 + 输出格式，研发可直接复制粘贴到任意 AI 工具 |
| 🎯 **真实用途** | 给研发 + AI 工具用 — 研发的"AI 协作中介"，不是设计文档 |

## 🏛 默认技术栈规范（强制 / 拼提示词前必读）

> 提示词里的技术选型/分层/DDL/契约/错误码，**一律按** [`../_shared/dev-stack-spec.md`](../_shared/dev-stack-spec.md)（从真实生产代码提炼的默认技术规范），让生成的代码"长得像真实项目"。**旧教科书写法作废**：后端**四层** Controller→Logic→Service→Mapper · `Result<T>`(2000/301/500) · 错误码 4 语言常量类 · DDL 雪花 id+逻辑删除+tenant_id+审计列 · 前端 Vue3+TS+EP+Vuex+`v-buttonAuth`+自研 `lang()`(默认 pt) · 移动版 uni-app+uv-ui+rpx。UI 令牌见 [`../pm-design/system-design-spec.md`](../pm-design/system-design-spec.md)。用户在输入里另给技术栈约束时，以用户约束优先。

# Dev-Prompts Skill — 研发提示词集

## 触发场景

| 触发 | 示例 |
|---|---|
| 原型 + PRD 确认后 | "生成研发提示词" / "出给开发的 AI 提示词" |
| 显式指令 | "让 AI 帮研发写代码的提示词" / "生成给 AI 工具用的提示词" |
| 同步更新 | "原型改了，研发提示词同步更新" |

## 输入（单一真理源）

1. **prd-data.json**（字段规范 + 用例规则 + 菜单）
2. **原型 HTML**（视觉参考）
3. **技术概要设计**（架构 / 数据模型 / 接口契约）
4. **可选**：用户的技术栈约束（如 Spring Boot 3 / Vue 3 / MySQL 8）

## 输出

单文件，前缀 `研发提示词`，输出目录 / 命名 / `.docx` 同步均按公共约定 [../_shared/downstream-skill-conventions.md §1](../_shared/downstream-skill-conventions.md)。

## 文档分类（行业通用，覆盖完整研发流程）

| 类别 | 提示词数量 | 覆盖角色 |
|---|---|---|
| **0. 通用前置** | 1 | 所有研发（项目背景 / 技术栈 / 规范）|
| **1. 数据库** | 3-5 | DBA / 后端 |
| **2. 后端代码** | 10-15 | 后端开发 |
| **3. 前端代码** | 8-12 | 前端开发 |
| **4. 自动化测试** | 4-6 | QA / SDET |
| **5. DevOps** | 3-5 | SRE / 运维 |
| **6. 文档与协同** | 2-3 | 全员 |

详细模板见 [template.md](./template.md)。

## 每条提示词的标准结构

```markdown
### X.X <主题>

**用途**：<这个提示词解决什么问题>
**适用工具**：Cursor / Copilot / Claude Code / ChatGPT / Codeium
**适用角色**：<目标研发角色>
**预期产出**：<期望的代码 / 文件 / 配置>

**提示词正文**：
\`\`\`
你是 <角色>，请基于以下输入帮我...
<具体要求>

输入数据：
- 字段规范：<从 prd-data.json 提取>
- 用例规则：<从 prd-data.json 提取>
- 技术约束：<从技术设计提取>

约束：
- 必须遵守 <规范要求>
- 必须包含 <必备项>
- 禁止 <禁止项>

输出格式：
- <文件结构 / 代码风格>
\`\`\`

**使用说明**：
- 复制提示词 → 粘贴到 AI 工具
- 替换 `<尖括号>` 占位符为实际项目信息
- AI 输出后 review，注意 <检查点>
```

## 与 prd-data.json 的映射规则

> 字段语义以 schema 真理源 [../pm-design/prd-data-schema.md](../pm-design/prd-data-schema.md) 为准；下表只做 schema 字段 → 研发提示词的映射，不重定义字段语义。

| prd-data.json 内容 | 对应研发提示词 |
|---|---|
| `field_specs.groups[].fields[]` | DB 建表 + 实体类 + DTO + 表单校验 |
| `field_specs[].required/constraint` | Bean Validation 注解 + 前端 rules |
| `field_specs[].constraint` 含「同 X 唯一」 | DB UNIQUE 索引 + 应用层预查 |
| 功能点 fp_type | Controller REST API 方法 |
| `use_cases.preconditions` | RBAC 鉴权配置 + 拦截器 |
| `use_cases.operation_flow` 含二次确认 | 前端组件 ElMessageBox |
| `use_cases.postconditions` | Service 层数据修改逻辑 |
| `use_cases.validations` | Service 层业务校验代码 |
| `use_cases.message_notifications` 双消息 | MQ 消费者 + 消息发送 |
| `use_cases.operation_log` | AOP 切面 + 日志表 |
| `menus` 结构 | 前端路由配置 + 菜单组件 |

## 同步更新机制

按公共统一同步 SOP [../_shared/downstream-skill-conventions.md §2](../_shared/downstream-skill-conventions.md)：研发提示词存在大量跨章节依赖，**默认整篇重新生成**（不增量），并在文档头追加变更日志（哪些字段/功能点/用例规则变了 → 哪些提示词内容变了）。

## ⚠️ 团队技术栈 + 研发规范配置（v1.0 强制）

> 🏛 **铁律**：dev-prompts 生成的提示词**必须**先读 [team-config.md](./team-config.md)（团队技术栈 + 研发规范配置）。如未配置则使用行业默认栈，**并主动告知用户**：
>
> ```
> "本次提示词使用【行业默认栈】（Spring Boot 3 + Vue 3 + MySQL 8 + Redis 7 + Kafka）。
>  如团队有自己的技术栈和研发规范，请填写 team-config.md，我会按团队配置重新生成所有提示词。"
> ```

### team-config.md 包含 5 大类配置

1. **团队技术栈**（后端 / 前端 / 移动 / DB / MQ / 部署）
2. **团队代码规范**（命名 / 包结构 / 异常 / 日志 / 安全 / 性能）
3. **团队业务规范**（错误码体系 / 业务铁律 / RBAC 权限）
4. **团队工具链**（IDE / 协作 / CI/CD）
5. **团队特有补丁**（私有 SDK / 模板代码 / 业务约束）

---

## 🌐 通用适用范围（所有互联网产品形态）

> 🏛 **铁律**：本 skill 规则**适用于所有互联网产品形态**，不限于以下任意类型。AI 必须按用户实际产品形态调整提示词，不能仅按 B 端默认。

### 11 类产品形态全覆盖

| 产品形态 | 技术栈典型 | 特殊提示词 |
|---|---|---|
| **B 端后台系统**（ERP / WMS / OMS / CRM / HR / 财务 / 进销存）| Vue/React + Spring Boot | RBAC / 工作流 / 报表 / 导入导出 |
| **B2C 电商网站**（独立站 / 平台 / 直播）| Next.js / Nuxt + 后端 | SEO / SSR / CDN / 支付 / 物流 / 营销活动 |
| **B2B 平台**（询盘 / 报价 / 撮合）| Vue/React + 后端 | 询盘单 / 报价对比 / 合同 / 企业认证 |
| **移动 APP**（iOS / Android）| Flutter / RN / 原生 | 推送通知 / 应用内购 / 地理位置 / 相册权限 / 离线同步 |
| **小程序**（微信 / 支付宝 / 抖音）| 原生 / Uni-app / Taro | 授权登录 / 分享 / 模板消息 / 支付 / 云开发 |
| **CMS / 博客 / 官网** | Next.js / Nuxt / Astro | SEO / 静态生成 / 富文本编辑器 / 评论 / 标签 |
| **IM / 协作工具**（聊天 / 视频会议 / 文档）| WebSocket / WebRTC | 实时消息 / 端到端加密 / 文件传输 / 在线状态 |
| **教育 / 网校**（直播 / 录播 / 题库）| Vue/React + 直播 SDK | 直播推流 / 课程目录 / 答题卡 / 学习进度 |
| **医疗 / HIS / 互联网医院** | B 端 + 移动 | 患者档案 / 处方 / 影像 PACS / 隐私合规 HIPAA |
| **金融 / 钱包 / 风控** | B 端 + 移动 | 实名认证 / 风控规则 / 流水 / 对账 / 合规 PCI-DSS |
| **物流 / IoT / 设备管理** | 后端 + 大屏 | 设备协议 MQTT / 实时数据 / 报警 / GIS 地图 |
| **DevOps / 监控** | 自研 | 时序数据 / 告警 / 自愈 / Webhook |
| **游戏 / 内容平台** | 自研 + Unity / 服务端 | 短视频 / 直播 / 推荐算法 / 内容审核 |
| **政务 / SaaS** | 多租户 | 租户隔离 / 计费 / 灰度发布 / 白标 |

### 各形态需要的特殊提示词（模板已覆盖）

详见 [template.md §7](./template.md) — 按产品形态扩展的特殊提示词章节：
- APP：推送 / 应用内购 / 离线同步
- 小程序：授权登录 / 模板消息 / 云函数
- 商城网站：SEO / SSR / 支付集成 / 物流接入
- IM：WebSocket / 端到端加密 / 实时同步
- IoT：MQTT / 时序数据 / 设备协议
- 教育：直播 / 课程管理 / 学习进度
- 等等...

**AI 必做**：识别用户产品形态 → 应用对应特殊提示词 → 提醒可选项

---

## 适用技术栈（行业通用 / 团队未配置时的默认）

| 层 | 主流选择 | AI 都熟悉 |
|---|---|---|
| 后端 | Spring Boot / NestJS / Django / Gin / FastAPI / Express | ✅ |
| 前端 | Vue 3 / React / Angular / Svelte | ✅ |
| 移动 | Flutter / React Native / Swift / Kotlin | ✅ |
| 小程序 | 微信 / 支付宝 / 抖音 / Taro / Uni-app | ✅ |
| DB | MySQL / PostgreSQL / MongoDB / Redis | ✅ |
| 部署 | Docker / K8s / Serverless | ✅ |

AI 按用户的技术栈生成对应提示词。如未指定 → 默认 Spring Boot + Vue 3 + MySQL（团队栈）。

## 适用 AI 工具（工具无关 / 任选其一）

提示词标准化、**工具无关**，可在以下任意工具直接使用，**没有推荐顺序**：

- Cursor
- GitHub Copilot Chat
- Claude Code（CLI / IDE）
- ChatGPT（含 GPTs / Codex）
- Codeium
- Tabnine Pro
- Cline / Aider（开源代理）
- 公司私有 AI / 自部署 LLM

研发用什么 AI 工具就用什么，提示词都能跑。

## 规范遵守

遵守 [pm-design/v1-master-spec.md](../pm-design/v1-master-spec.md) 的**单一真理源原则**——所有提示词以 prd-data.json 为数据源，禁止脱离数据源凭空写。
