# 团队技术栈 + 研发规范配置

> ⚠️ **本文档是 dev-prompts skill 的团队级配置**。用户填好后，AI 生成研发提示词时会自动用你的配置覆盖默认行业栈。
>
> 适用：本团队所有项目 / 所有模块的研发提示词生成。

---

## 1. 团队技术栈

### 1.1 后端

| 维度 | 选型 | 版本 | 备注 |
|---|---|---|---|
| 编程语言 | <Java / Kotlin / Go / Node.js / Python> | <版本> | |
| 主框架 | <Spring Boot / NestJS / Django / Gin / FastAPI> | <版本> | |
| ORM / DAO | <MyBatis-Plus / Hibernate / Prisma / GORM> | <版本> | |
| 鉴权 | <Spring Security / Sa-Token / 自研 SSO / OAuth 2.0> | <版本> | |
| Web | <Spring MVC / Webflux / Express / Fastify> | <版本> | |
| 任务调度 | <XXL-Job / Quartz / Spring Schedule / Airflow> | <版本> | |
| 配置中心 | <Nacos / Apollo / Consul / 自研> | <版本> | |
| 服务注册 | <Nacos / Eureka / Consul / K8s Service> | <版本> | |
| RPC | <Dubbo / gRPC / OpenFeign / 自研> | <版本> | |

### 1.2 前端

| 维度 | 选型 | 版本 | 备注 |
|---|---|---|---|
| 框架 | <Vue / React / Angular / Svelte> | <版本> | |
| UI 组件库 | <Element Plus / Ant Design Vue / Vant / 自研> | <版本> | |
| 状态管理 | <Pinia / Vuex / Redux / Zustand / Jotai> | <版本> | |
| 路由 | <Vue Router / React Router> | <版本> | |
| HTTP 客户端 | <axios / fetch 封装 / ky / 自研> | <版本> | |
| 类型系统 | <TypeScript / JavaScript> | <版本> | |
| 构建工具 | <Vite / Webpack / Rspack / Turbopack> | <版本> | |
| 包管理 | <pnpm / yarn / npm> | <版本> | |
| i18n | <vue-i18n / react-i18next / 自研> | <版本> | |

### 1.3 移动端 / 小程序

| 维度 | 选型 | 备注 |
|---|---|---|
| 跨平台 | <Flutter / React Native / Uni-app / Taro> | |
| 原生 iOS | <Swift / SwiftUI> | |
| 原生 Android | <Kotlin / Jetpack Compose> | |
| 小程序 | <微信 / 支付宝 / 抖音 / Uni-app / Taro> | |

### 1.4 数据存储

| 维度 | 选型 | 版本 | 备注 |
|---|---|---|---|
| 主数据库 | <MySQL / PostgreSQL / Oracle / TiDB / OceanBase> | <版本> | |
| 缓存 | <Redis / Memcached / 自研> | <版本> | |
| 搜索引擎 | <Elasticsearch / OpenSearch / Solr> | <版本> | |
| 时序数据库 | <InfluxDB / TDengine / Prometheus> | <版本> | |
| 文档数据库 | <MongoDB / CouchDB> | <版本> | |
| 对象存储 | <OSS / S3 / MinIO> | <版本> | |
| 数据仓库 | <Hive / Doris / ClickHouse / StarRocks> | <版本> | |

### 1.5 消息与中间件

| 维度 | 选型 | 版本 | 备注 |
|---|---|---|---|
| 消息队列 | <Kafka / RocketMQ / RabbitMQ / Pulsar> | <版本> | |
| 分布式锁 | <Redisson / ZooKeeper / etcd / 自研> | <版本> | |
| 分布式 ID | <Snowflake / Leaf / 自研> | <版本> | |
| 限流熔断 | <Sentinel / Hystrix / Resilience4j> | <版本> | |
| 链路追踪 | <SkyWalking / Zipkin / Jaeger> | <版本> | |

### 1.6 部署与运维

| 维度 | 选型 | 备注 |
|---|---|---|
| 容器 | <Docker / Containerd> | |
| 编排 | <K8s / Docker Compose / Nomad> | |
| 服务网格 | <Istio / Linkerd / 自研> | |
| API 网关 | <Spring Cloud Gateway / Kong / APISIX / 自研> | |
| CI/CD | <Jenkins / GitHub Actions / GitLab CI / 自研> | |
| 制品仓库 | <Harbor / Nexus / 自研> | |
| 监控 | <Prometheus + Grafana / 自研监控> | |
| 日志 | <ELK / Loki / 自研日志中台> | |
| APM | <SkyWalking / Pinpoint / 阿里 ARMS> | |
| 告警 | <Alertmanager / 钉钉 / 企微 / 短信 / 自研> | |

---

## 2. 团队代码规范

### 2.1 后端规范

- 编程规范文档：<URL 或路径，如：阿里巴巴 Java 开发手册黄山版 / 公司私有规范文档链接>
- 命名规范：<驼峰 / 蛇形 / 包名规则>
- 包结构：
```
<贴你的包结构示例，如：
com.<company>.<project>
├── controller
├── service
│   └── impl
├── mapper
├── entity
├── dto
├── vo
├── enums
├── constant
├── exception
├── config
├── util
└── aspect>
```
- 注释规范：<JavaDoc 强制 / 行尾注释规则>
- 异常处理：<自研业务异常类 / 错误码体系链接>
- 日志规范：<打印级别 / 关键参数 / 敏感数据脱敏>
- 单元测试：<JUnit 5 / TestNG，覆盖率 ≥ X%>

### 2.2 前端规范

- 编程规范文档：<URL 或路径>
- 命名规范：<组件 PascalCase / 文件 kebab-case / 变量 camelCase>
- 目录结构：
```
<贴你的目录结构示例>
```
- CSS 规范：<BEM / Tailwind / SCSS 变量规范>
- 组件规范：<Composition API 强制 / Props 必须 TypeScript 类型>
- 国际化：<key 命名规则 / 文案分包规则>

### 2.3 API 规范

- API 风格：<RESTful / GraphQL / RPC>
- URL 规范：<复数名词 / 版本号位置：/api/v1/users 还是 /v1/api/users>
- 请求规范：<Header 必传字段 / 请求体格式 / 时间格式>
- 响应规范：<贴 ResponseResult 标准结构>
- 错误码规范：<分段规则 + 错误码字典链接>
- 鉴权规范：<JWT 头字段 / Token 刷新机制>
- 限流规范：<默认限流策略 / 关键接口加严>

### 2.4 数据库规范

- 表命名：<lowercase + 下划线 / 业务前缀>
- 字段命名：<下划线 / 时间字段名称约定>
- 主键策略：<自增 / Snowflake / UUID>
- 软删除：<is_deleted / deleted_at>
- 审计字段：<必含 created_at / updated_at / created_by / updated_by / version>
- 字符集：<utf8mb4_unicode_ci / utf8mb4_0900_ai_ci>
- 索引规范：<命名规则 idx_xxx / uk_xxx>
- DDL 流程：<Flyway / Liquibase / 公司 DBA 平台>

### 2.5 Git 规范

- 分支策略：<GitFlow / GitHub Flow / Trunk-based>
- Commit 规范：<Conventional Commits / 公司自定义>
- PR 规范：<必须 2 人 review / CI 必须通过 / 模板>
- 版本号：<SemVer / CalVer>

### 2.6 安全规范

- 数据脱敏字段：<手机号 / 身份证 / 银行卡 / 邮箱 / 姓名>
- SQL 注入：<参数化强制 / 禁止字符串拼接>
- XSS：<前端转义规则 / 后端过滤规则>
- CSRF：<Token 校验机制>
- 越权检查：<RBAC 权限码 + 数据权限>
- 敏感操作：<二次密码 / 短信验证 / 审批流>
- 日志脱敏：<禁止打印密码 / Token / 完整证件号>

### 2.7 性能规范

- 接口响应：<P99 ≤ 500ms / 慢查询定义>
- DB 慢查询：<≥ 1s 必须优化>
- 缓存策略：<热点数据必缓存 / 缓存击穿/穿透/雪崩防护>
- 大事务：<禁止单事务 ≥ 10 条 SQL>
- 并发：<高并发接口必须压测>

---

## 3. 团队业务规范

### 3.1 错误码体系

- 错误码字典链接：<URL>
- 错误码格式：<整数 5 位 / 字符串 / 分段规则>
- 错误码示例：
  - 10001 ← 必填字段缺失
  - 20001 ← 名称重复
  - 30001 ← 无权限
  - 40001 ← 数据库异常
  - 50001 ← 第三方异常
  - 90001 ← 系统未知

### 3.2 业务铁律

- <列出公司所有业务必守的铁律，如：>
- 所有数据必须可审计
- 所有写操作必须有操作日志
- 所有金额字段必须 BigDecimal + 2 位小数
- 所有时间字段必须 LocalDateTime + 时区 UTC+8
- 所有 ID 字段必须 Long
- 所有删除必须软删
- 所有列表查询必须分页（默认 pageSize ≤ 100）
- 所有 API 必须鉴权
- 所有外部依赖必须熔断降级

### 3.3 RBAC 权限体系

- 权限码格式：<resource:action / module.function.action>
- 权限码示例：<vip-level:read / vip-level:create / vip-level:update / vip-level:delete>
- 数据权限：<部门隔离 / 门店隔离 / 自研规则>
- 鉴权方式：<注解 @PreAuthorize / AOP 拦截 / 网关层>

---

## 4. 团队工具链

### 4.1 研发工具

- IDE：<IntelliJ IDEA / VS Code / Cursor>
- AI 编程：<Cursor / Copilot / Claude Code / 公司私有 AI>
- 接口测试：<Postman / Apifox / 自研>
- 数据库工具：<Navicat / DBeaver / DataGrip / 公司 DBA 平台>

### 4.2 协作工具

- 项目管理：<Jira / TAPD / Lark Project / 飞书 / 自研>
- 文档：<Confluence / 飞书 / Notion / 公司 Wiki>
- 沟通：<钉钉 / 企微 / Slack / 飞书>
- 代码托管：<GitLab / GitHub / Bitbucket / 公司私有>

### 4.3 CI/CD 流水线

- 平台：<Jenkins / GitHub Actions / GitLab CI / 自研>
- 流水线模板：<URL>
- 环境分级：<dev / test / staging / prod>
- 发布流程：<蓝绿 / 灰度 / 滚动 / 全量>

---

## 5. 团队特有的提示词补丁

### 5.1 公司私有 SDK / 框架

如团队有自研框架 / SDK，请填写以便 AI 生成的代码能直接用：

- <自研 ORM / 工具类 / 中间件名称 + 用法示例>

### 5.2 公司私有模板代码

如有公司常用的代码模板（如标准 Controller / Service 骨架），请粘贴：

```java
// 贴公司标准 Controller 骨架
```

```vue
<!-- 贴公司标准组件骨架 -->
```

### 5.3 公司私有业务约束

- <列出业务上必须遵守的约束，如：所有订单必须关联仓库 / 所有商品必须有 SKU>

---

## 使用说明

1. **填写本文档**：用户根据团队实际填写各章节（用尖括号占位的部分）
2. **AI 自动应用**：dev-prompts skill 生成研发提示词时，自动注入本配置
3. **持续维护**：技术栈升级 / 规范变更时及时更新本文档
4. **版本控制**：本文档进 Git 仓库，所有研发可见

---

## 配置完成清单

填写完成后，请在每节末勾选：

- [ ] §1 团队技术栈
- [ ] §2 团队代码规范
- [ ] §3 团队业务规范
- [ ] §4 团队工具链
- [ ] §5 团队特有的提示词补丁

全部勾选后，可以告诉 AI："按团队配置重新生成研发提示词"。
