# 研发提示词集模板（行业通用 / 覆盖完整研发流程）

> 用途：基于 prd-data.json + 原型 HTML + 技术设计生成的研发 AI 提示词集。研发把每个提示词复制到 AI 工具（Cursor / Copilot / Claude Code）直接出代码。
>
> 适用：B 端 / C 端 / 移动 / 小程序 / SaaS 任意产品形态。
>
> 占位符约定：`<尖括号>` = 待 AI 填充。

---

# <模块/系统名> 研发提示词集

## 文档信息

| 项 | 内容 |
|---|---|
| 文档名称 | <模块名> 研发提示词集 |
| 版本 | v1.0 |
| 日期 | YYYY-MM-DD |
| 关联 PRD | ./PRD-XXX-<日期>.md |
| 关联原型 | ./原型-XXX-<日期>-offline.html |
| 关联数据源 | ./prd-data-XXX-<日期>.json |
| 关联技术设计 | ./技术概要设计-XXX-<日期>.md |
| 变更日志 | <与上一版变更点> |

---

## 0. 通用前置（每个 AI 对话首次必发）

### 0.1 项目背景 + 技术栈说明

**用途**：研发首次和 AI 对话时，先发这条建立上下文，后续提问 AI 能"记住"项目背景。

**适用工具**：所有 AI 工具
**适用角色**：所有研发
**预期产出**：AI 理解项目背景，后续回答更精准

**提示词正文**：
```
你是 <模块名> 模块的资深全栈研发，参与到 <公司名> 的 <业务领域> 系统中。

# 项目背景
- 业务领域：<如：会员管理 / 订单中心 / 仓储调拨>
- 业务对象：<如：会员等级 / 订单 / 仓库>
- 主要用户：<如：总部运营 / 一线客服 / C 端用户>

# 技术栈
- 后端：<Spring Boot 3.2 / NestJS 10 / Django 4 / Gin>
- 数据库：<MySQL 8.0 / PostgreSQL 15>
- 缓存：<Redis 7>
- 消息：<Kafka 3.5 / RabbitMQ>
- 前端：<Vue 3.4 + Element Plus 2.4 + Pinia + Vue Router 4>
- 部署：<Docker + K8s>

# 代码规范
- 后端：阿里巴巴 Java 开发手册（黄山版）/ <对应规范>
- 前端：Airbnb JS Style Guide / Vue 3 官方风格指南
- API：RESTful + OpenAPI 3.0
- Git：Conventional Commits

# 业务铁律（必须遵守）
- 软删除：所有数据用 is_deleted 字段，禁止物理删除
- 操作日志：所有写操作必须记录（操作时间/账号/模块/功能/明细/IP）
- 乐观锁：编辑场景必须用 version 字段防并发冲突
- 唯一性：业务唯一字段必须 DB UNIQUE 索引 + 应用层预查双重保障
- 鉴权：所有 API 必须 JWT + RBAC 权限码校验

请在后续所有回答中遵守以上约定。第 1 个任务我接下来给你。
```

---

## 1. 数据库

### 1.1 建表 SQL

**用途**：根据字段规范生成 MySQL 建表 DDL。

**适用工具**：Cursor / Copilot
**适用角色**：DBA / 后端开发
**预期产出**：`./db/<table_name>.sql` 文件

**提示词正文**：
```
根据下面的字段规范生成 MySQL 8.0 建表 SQL：

# 业务对象
<业务对象名，如：会员等级 vip_level>

# 字段规范（来自 prd-data.json field_specs）
| 字段 | 类型 | 是否必填 | 默认值 | 约束规则 |
|---|---|---|---|---|
<从 prd-data.json field_specs.groups[].fields[] 复制>

# 额外要求（行业标配）
1. 必含审计字段：
   - id BIGINT AUTO_INCREMENT PRIMARY KEY
   - is_deleted TINYINT NOT NULL DEFAULT 0
   - created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
   - updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
   - created_by VARCHAR(64) NOT NULL
   - updated_by VARCHAR(64) NOT NULL
   - version INT NOT NULL DEFAULT 0  -- 乐观锁

2. 索引设计：
   - 业务唯一字段加 UNIQUE KEY
   - 高频查询字段加 KEY
   - 复合查询字段加 KEY (a, b)
   - is_deleted + status 必加索引

3. 字符集：utf8mb4 / utf8mb4_unicode_ci
4. 引擎：InnoDB
5. 注释：表注释 + 每个字段注释

# 输出
- 完整 CREATE TABLE 语句
- 含字段注释
- 索引说明（注释方式）
- 测试数据 INSERT 语句（5 条示例数据）
```

### 1.2 索引优化建议

**用途**：根据查询场景给现有表加索引。

**提示词正文**：
```
我有一张表 <table_name>，DDL 如下：
<贴 CREATE TABLE>

业务查询场景：
1. <按 status + created_at 范围查询>
2. <按 name 模糊匹配>
3. <按 user_id 关联查询>

请帮我：
1. 评估现有索引是否覆盖这些查询
2. 给出缺失索引的 ALTER TABLE 语句
3. 用 EXPLAIN 验证（贴示例 SQL）
4. 说明每个索引的代价（写入开销 / 存储）
```

### 1.3 数据迁移脚本（Flyway / Liquibase）

**提示词正文**：
```
请基于以下 DDL 变更，生成 Flyway 迁移脚本：

旧 DDL：
<贴旧表结构>

新 DDL：
<贴新表结构>

要求：
- 文件名：V<版本>__<描述>.sql（如 V1.1.0__add_vip_level_benefit.sql）
- 含回滚脚本（注释方式）
- 数据兼容（新增字段加 DEFAULT，删除字段先废弃 N 个版本）
- 大表变更用 pt-online-schema-change 兼容写法
```

---

## 2. 后端代码

### 2.1 实体类（Entity）

**用途**：根据字段规范生成 JPA / MyBatis-Plus 实体类。

**提示词正文**：
```
根据下面的字段规范生成 <Spring Boot 3 + MyBatis-Plus 3.5> 实体类：

# 表名
<table_name>

# 字段规范
<从 prd-data.json field_specs 复制>

# 要求
1. 用 @TableName / @TableId / @TableField 注解
2. 包含审计字段（继承 BaseEntity 或显式声明）
3. is_deleted 用 @TableLogic
4. version 用 @Version 乐观锁
5. 含 Lombok @Data / @Builder / @NoArgsConstructor / @AllArgsConstructor
6. 字段添加 JavaDoc 说明
7. 枚举字段用 Java Enum + @EnumValue

# 输出
- 完整 Java 类
- import 语句
- 配套 Mapper 接口（MyBatis-Plus BaseMapper）
```

### 2.2 DTO（请求 / 响应）

**提示词正文**：
```
根据下面的 API 接口生成 DTO：

# 接口
<POST /api/vip-levels>

# 字段规范
<从 prd-data.json field_specs 复制>

# 要求
1. CreateXxxDTO（创建请求）：含 Bean Validation 注解
   - @NotBlank @NotNull @Size @Min @Max @Pattern
   - @Valid 嵌套对象
2. UpdateXxxDTO（更新请求）：可选字段 + version 字段
3. QueryXxxDTO（查询请求）：分页字段 + 筛选字段
4. XxxVO（响应）：对外字段，敏感字段脱敏
5. XxxPageVO（分页响应）：含 total / page / pageSize / list
6. 用 Lombok + Builder

# 输出 4 个独立类
```

### 2.3 Service 层

**提示词正文**：
```
为 <业务对象> 生成 Service 层代码：

# 业务对象
<对象名>

# 功能点（来自 prd-data.json menus）
<列出 fp_type 列表>

# 用例规则（来自 prd-data.json use_cases）
<按每个 fp_key 贴 use_cases>

# 要求
1. 接口 + 实现类分离（XxxService + XxxServiceImpl）
2. 实现以下方法：
   - page(QueryDTO) -> Page<VO>
   - getById(Long id) -> VO
   - create(CreateDTO) -> VO
   - update(Long id, UpdateDTO) -> VO
   - delete(Long id) -> void
   - enable(Long id) -> void
   - disable(Long id) -> void
3. 业务前置校验（按 use_cases.validations）：
   - 关联依赖检查
   - 状态机校验
   - 唯一性预查
   - 时效校验
4. 编号自动生成（如 VL + 4位流水号，用 Redis INCR）
5. 乐观锁（更新时校验 version）
6. 异常用业务异常类（BusinessException）+ 错误码
7. @Transactional 注解
8. 操作日志通过 @OperationLog 注解（AOP 切面）

# 输出
- XxxService 接口
- XxxServiceImpl 实现类（不超过 300 行）
- 配套 BusinessException + 错误码常量类
```

### 2.4 Controller 层

**提示词正文**：
```
为 <业务对象> 生成 Controller：

# Base URL
/api/<resource>

# 接口清单
| 方法 | 路径 | 说明 | 鉴权 |
|---|---|---|---|
<从技术设计 §6 复制>

# 要求
1. @RestController + @RequestMapping("/api/<resource>")
2. 每个接口加 @PreAuthorize("hasAuthority('<resource>:<action>')")
3. 用 ResponseResult<T> 统一封装
4. 参数校验 @Validated
5. 全局异常处理（@RestControllerAdvice）已存在，直接抛异常即可
6. Swagger 注解 @Tag / @Operation / @ApiResponse 完整
7. 限流：高频接口加 @RateLimit（基于 Redisson）
8. 日志：@OperationLog 注解

# 输出
- Controller 类（含 5-8 个方法）
- ResponseResult 通用类（如不存在）
```

### 2.5 业务前置校验

**提示词正文**：
```
为 <业务对象> 生成业务前置校验代码：

# 校验规则（来自 prd-data.json use_cases.validations）
<贴 validations 列表>

# 要求
1. 4 类校验独立方法：
   - checkRelatedDependencies(id)  // 关联依赖
   - checkStateMachine(currentStatus, targetStatus)  // 状态机
   - checkUniqueness(name, excludeId)  // 唯一性
   - checkTimeliness(createdAt)  // 时效
2. 校验失败抛 BusinessException + 错误码 + 友好提示
3. 错误提示按 use_cases.validations 中的"提示"内容
4. 高并发场景：唯一性用 Redis 分布式锁

# 输出
- XxxValidator 工具类
- 集成到 Service 中调用
```

### 2.6 操作日志 AOP 切面

**提示词正文**：
```
生成基于 Spring AOP 的操作日志切面：

# 切面规则
- 注解：@OperationLog(module, function, detailExpression)
- 拦截：所有 @OperationLog 注解的方法
- 时机：方法成功返回后异步写日志
- 字段：operation_time / operator_account / operation_module / operation_function / operation_detail / ip_address

# 操作明细格式（来自 prd-data.json use_cases.operation_log.detail_format）
<贴各 fp 的 detail_format>

# 要求
1. 用 SpEL 解析 detailExpression（如 "新增<对象>：编号=#result.code，名称=#args[0].name"）
2. 编辑类含旧值→新值（需要切面在前置和后置都读取数据）
3. 异步写入（用 @Async 或 MQ）
4. operator_account 从 SecurityContext 获取
5. ip_address 从 HttpServletRequest 获取

# 输出
- @OperationLog 注解定义
- OperationLogAspect 切面类
- 配套 OperationLogService + OperationLogEntity
```

### 2.7 单元测试

**提示词正文**：
```
为 <XxxServiceImpl> 生成单元测试：

# Service 代码
<贴 Service 实现>

# 要求
1. JUnit 5 + Mockito + AssertJ
2. 每个 public 方法至少 3 个测试：
   - 正向：业务流程跑通
   - 反向：业务前置校验失败（每条 validation 1 个测试）
   - 边界：极值输入（最大长度 / 0 / null）
3. Mock 所有依赖（Mapper / 外部 Service / Redis）
4. 测试命名：should_<期望>_when_<场景>
5. 用 @ParameterizedTest 处理多组数据
6. 覆盖率目标：> 80% 行覆盖

# 输出
- XxxServiceImplTest（不超过 500 行）
```

---

## 3. 前端代码

### 3.1 路由 + 菜单配置

**提示词正文**：
```
为 <模块名> 生成 Vue Router 4 路由配置：

# 菜单结构（来自 prd-data.json menus）
<贴 menus 树>

# 要求
1. 嵌套路由（一/二/三级菜单对应）
2. 路由懒加载（() => import()）
3. meta 字段：title / icon / permission / keepAlive
4. 鉴权守卫（router.beforeEach 检查 permission）
5. 配套侧边栏菜单数据源（响应式根据用户权限过滤）

# 输出
- router/modules/<module>.ts
- store/permission.ts（菜单过滤逻辑）
```

### 3.2 API 服务层

**提示词正文**：
```
为 <模块名> 生成 axios API 服务：

# 接口清单
<从技术设计 §6 复制 + 请求/响应 DTO>

# 要求
1. 用 TypeScript（如不用 TS 则纯 JS）
2. 文件 api/<resource>.ts
3. 每个接口 1 个函数：返回 Promise<ResponseResult<T>>
4. JSDoc 注释 + 类型定义
5. 错误处理：业务错误 throw / 网络错误统一 interceptor
6. 请求参数类型严格定义（与后端 DTO 对齐）

# 输出
- api/<resource>.ts（完整）
- types/<resource>.ts（DTO 类型）
```

### 3.3 列表页组件

**提示词正文**：
```
为 <业务对象> 生成 Vue 3 列表页组件：

# 字段规范（来自 prd-data.json field_specs，"列表字段"分组）
<贴列表字段表>

# 用例规则（来自 use_cases.查询）
<贴查询的 operation_flow 等>

# 要求（v1.0 规范）
1. Element Plus 2.4 + Composition API + <script setup>
2. 包含：
   - 筛选区（el-form inline）
   - 操作区（el-button 新增）
   - 列表表格（el-table）
   - 分页（el-pagination 真实可用）
3. 真实业务行为：
   - 查询 → 调 API → 更新列表
   - 翻页 / 改条数 → 重新调 API
   - 新增 / 编辑 → 弹窗组件
   - 删除 → 业务前置校验（业务前置不在前端，后端返回错误展示）+ 二次确认
   - 启用/停用 → 二次确认 + 修改 status
4. 加载状态（el-table v-loading）
5. 空状态（el-empty）
6. 错误处理（ElMessage.error）

# 输出
- pages/<resource>/list.vue
- 含 200-400 行（含模板 + 脚本 + 样式）
```

### 3.4 新增 / 编辑弹窗组件

**提示词正文**：
```
为 <业务对象> 生成新增/编辑弹窗组件：

# 字段规范
<从 prd-data.json field_specs 复制>

# 用例规则
<从 prd-data.json use_cases.新增 + 编辑 复制>

# 要求（v1.0 规范 / 严格遵守）
1. el-dialog + el-form + el-form-item 每个字段加 prop
2. formRules 完整：
   - required（带 message）
   - 长度 / 范围 / 格式
   - 自定义校验器（唯一性 / 跨字段）
3. 失焦校验 trigger: 'blur'
4. 提交全表单校验 formRef.validate()
5. 错误显示在字段下方（不用 alert）
6. 编号自动生成（从后端 API 拿）
7. 二次确认 ElMessageBox.confirm
8. 4 个关闭路径：× / 取消 / 保存 / ESC
9. 关闭时 formRef.resetFields()
10. Emits: ['save-success']
11. defineProps: visible / row（编辑时回显）

# 输出
- components/<Resource>Form.vue（200-400 行）
```

### 3.5 国际化（i18n）

**提示词正文**：
```
为 <模块名> 生成 vue-i18n 国际化文件：

# 字段 + 提示文案（来自 prd-data.json）
<贴所有用户可见文本>

# 要求
1. zh-CN / en-US 两套
2. 嵌套结构按模块分组：vipLevel.list.title / vipLevel.form.name
3. 占位符用 {var}（如 "已存在等级\"{name}\""）
4. 复数用 i18n pluralization

# 输出
- locales/zh-CN/<module>.json
- locales/en-US/<module>.json
```

---

## 4. 自动化测试

### 4.1 后端集成测试

**提示词正文**：
```
为 <XxxController> 生成 Spring Boot 集成测试：

# Controller 代码
<贴 Controller>

# 测试用例（来自 测试用例.md §3.X）
<贴关键正向 + 反向 + 边界用例>

# 要求
1. @SpringBootTest + MockMvc + Testcontainers（MySQL + Redis）
2. 每个接口至少 5 个测试：
   - 200 正常
   - 400 参数错误
   - 401 未认证
   - 403 无权限
   - 业务异常（每条 validation）
3. 测试隔离：每个测试前 @Transactional + 回滚
4. 测试数据：@Sql 注解初始化

# 输出
- XxxControllerIT.java
```

### 4.2 前端 E2E 测试（Playwright）

**提示词正文**：
```
为 <模块> 生成 Playwright E2E 测试：

# 端到端场景（来自 测试用例.md §4）
<贴 E2E 场景>

# 要求
1. Playwright + TypeScript
2. Page Object 模式
3. 每个 E2E 场景 1 个 test：
   - 完整用户操作流程
   - 验证 UI + 后端数据
4. 数据隔离：每个 test 用唯一前缀
5. 截图 / 录屏失败时保存

# 输出
- tests/e2e/<module>.spec.ts
- pages/<Module>Page.ts（Page Object）
```

---

## 5. DevOps

### 5.1 Dockerfile（后端 / 前端）

**提示词正文**：
```
为 <模块名> 后端生成 Dockerfile：

# 项目结构
<贴 Maven / Gradle 项目结构>

# 要求
1. 多阶段构建（build stage + runtime stage）
2. 基础镜像：eclipse-temurin:17-jre-alpine（小镜像）
3. 非 root 用户运行
4. 健康检查（/actuator/health）
5. JVM 参数：UseG1GC + ContainerSupport
6. 暴露端口 8080
7. 日志写到 stdout（容器化标配）

# 输出
- Dockerfile
- .dockerignore
```

### 5.2 K8s Deployment

**提示词正文**：
```
为 <服务名> 生成 K8s 部署清单：

# 资源要求
- 副本：3 个
- CPU：request 500m / limit 2
- 内存：request 512Mi / limit 2Gi

# 要求
1. Deployment + Service + HorizontalPodAutoscaler
2. 滚动更新 RollingUpdate（maxSurge 25% / maxUnavailable 0）
3. 探针：liveness + readiness + startup
4. ConfigMap 加载配置
5. Secret 加载密码
6. 资源限制 + QoS class = Guaranteed
7. PodDisruptionBudget（minAvailable 2）

# 输出
- k8s/deployment.yaml
- k8s/service.yaml
- k8s/hpa.yaml
- k8s/configmap.yaml
```

### 5.3 CI/CD Pipeline

**提示词正文**：
```
为 <项目名> 生成 GitHub Actions / GitLab CI 流水线：

# 阶段
- 代码检查（lint + SonarQube）
- 单元测试 + 覆盖率
- 构建（Maven / npm）
- Docker 镜像构建 + 推送
- 部署测试环境
- 集成测试 / E2E 测试
- 部署生产（手动批准）

# 要求
1. 缓存依赖（Maven / npm）加速
2. 并行任务
3. 测试报告上传
4. 失败通知到钉钉 / Slack
5. 镜像加 SemVer 标签

# 输出
- .github/workflows/ci.yml
- 或 .gitlab-ci.yml
```

---

## 6. 文档与协同

### 6.1 README.md 生成

**提示词正文**：
```
为 <项目名> 生成 README.md：

# 项目背景
<从 PRD §1 复制>

# 技术栈
<从技术设计 §3.4 复制>

# 要求
1. 标准结构：
   - 项目简介 + 徽章（build / coverage / license）
   - 快速开始（环境要求 / 安装 / 启动）
   - 项目结构
   - API 文档链接
   - 部署指南
   - 贡献指南
   - License
2. 中英双语（README.md + README.en.md）
3. 含截图（占位 ![](./docs/screenshot.png)）

# 输出
- README.md
```

### 6.2 API 文档（OpenAPI 3.0）

**提示词正文**：
```
为 <模块名> 生成 OpenAPI 3.0 YAML：

# 接口清单
<从技术设计 §6 复制>

# 字段规范
<从 prd-data.json 复制>

# 要求
1. 完整的 OpenAPI 3.0 规范
2. 每个接口含 summary / description / parameters / requestBody / responses / examples
3. Schema 复用（避免重复定义）
4. 错误响应统一格式
5. 鉴权 securitySchemes

# 输出
- api/<module>.yaml
- 兼容 Swagger UI / Apifox / Postman 导入
```

---

## 7. 按产品形态的特殊提示词（v1.0 / 所有互联网产品形态）

> 🌐 **通用适用**：本套提示词规则适用所有互联网产品形态。各形态有共性（§1-§6 已覆盖）+ 特殊性（本节按形态扩展）。AI 按用户的产品形态选用对应的特殊提示词。

### 7.1 移动 APP（iOS / Android / 跨平台）

#### 7.1.1 推送通知集成
```
为 <APP 名> 集成推送：
- iOS：APNs（Apple Push Notification）
- Android：FCM / 厂商通道（华为 HMS / 小米 MIPush / OPPO Push / VIVO Push）
- 跨平台 SDK：极光 / 个推 / 友盟 / 自研
要求：
1. 设备 Token 注册 + 服务端存储
2. 单推 / 群推 / 全推 接口
3. 离线消息补偿
4. 角标管理
5. 静默推送
输出：客户端 SDK 集成代码 + 服务端推送服务
```

#### 7.1.2 应用内购（IAP）
```
集成应用内购：
- iOS：StoreKit 2
- Android：Google Play Billing
- 国内：自研支付 + 微信/支付宝
要求：
1. 商品 ID 管理
2. 订单创建 + 支付凭证验证
3. 防刷单（服务端二次校验）
4. 自动续订订阅
5. 退款回调
输出：客户端 + 服务端代码
```

#### 7.1.3 权限申请 + 离线同步
```
生成权限申请封装（相册/相机/位置/通知/麦克风）+ 离线数据同步：
- 离线本地数据库：SQLite / Realm / Hive
- 同步策略：增量上传 + 冲突解决（last-write-wins / CRDT）
- 网络监听 + 重连重试
```

### 7.2 小程序（微信 / 支付宝 / 抖音 / 跨端）

#### 7.2.1 授权登录
```
为 <小程序名> 实现授权登录：
- 微信：wx.login → code → 后端 jscode2session → openId/unionId
- 支付宝：my.getAuthCode → 后端换 userId
- 抖音：tt.login → 后端换 openId
要求：
1. 静默登录 + 用户主动授权头像昵称
2. 后端 Session 维护
3. 跨小程序的 unionId 关联
4. 多端 (H5 / 小程序 / APP) 统一账号
```

#### 7.2.2 模板消息 / 订阅消息
```
集成订阅消息：
- 微信：subscribeMessage.send
- 模板 ID 管理 + 7 天有效期
- 触达策略 + 频次控制
- 跳转小程序页 / H5
```

#### 7.2.3 云开发 / 云函数
```
生成微信云开发函数：
- 云数据库 CRUD
- 云存储上传
- HTTPS 触发器
- 定时触发器
```

### 7.3 B2C 电商网站

#### 7.3.1 SEO + SSR
```
为 <电商网站> 生成 Next.js / Nuxt SSR 配置：
- 商品详情页 SSR
- 元数据 SEO（title / description / og:image / schema.org Product）
- sitemap.xml 自动生成
- robots.txt
- 静态资源 CDN
- Web Vitals 优化（LCP / FID / CLS）
```

#### 7.3.2 支付集成
```
集成支付：
- 微信支付 / 支付宝 / 银联 / 海外 Stripe / PayPal
- 统一下单 + 异步回调
- 订单状态同步
- 退款流程
- 对账系统
```

#### 7.3.3 物流接入
```
集成物流：
- 顺丰 / 中通 / 圆通 / 京东 / 海外 DHL / FedEx
- 电子面单
- 物流轨迹查询
- 自动签收 + 评价提醒
```

#### 7.3.4 营销活动
```
生成营销活动引擎：
- 满减 / 折扣 / 直降 / 第二件半价
- 优惠券（领取 / 使用 / 核销）
- 拼团 / 砍价 / 秒杀
- 会员等级权益（联动 vip-level）
```

### 7.4 IM / 协作工具

#### 7.4.1 WebSocket 实时消息
```
生成 WebSocket 实时通信：
- 后端：Spring WebSocket / Socket.IO / 自研
- 客户端：原生 WebSocket / Socket.IO 客户端
- 心跳保活 + 断线重连
- 消息确认 ACK
- 离线消息存储 + 上线推送
- 群消息扇出
```

#### 7.4.2 端到端加密
```
生成端到端加密：
- 算法：Signal Protocol / Olm
- 密钥协商 + 密钥轮换
- 前向保密
- 设备多端同步
```

#### 7.4.3 文件传输
```
生成大文件传输：
- 分片上传 + 断点续传
- 秒传（MD5 / SHA-256 去重）
- 进度反馈
- 客户端 WebRTC 直传（P2P）
```

### 7.5 IoT / 设备管理

#### 7.5.1 MQTT 协议
```
生成 MQTT 设备接入：
- Broker：EMQX / Mosquitto / 自研
- QoS 0/1/2 选择
- Topic 设计（设备/up + 设备/down）
- 设备认证（X.509 / Token）
- 上下线监听 + 设备状态同步
```

#### 7.5.2 时序数据 + 大屏
```
生成 IoT 数据存储 + 可视化：
- 时序 DB：InfluxDB / TDengine / Prometheus
- 数据降采样 + 冷热分层
- 大屏组件：ECharts / AntV / 自研
- 实时刷新（WebSocket / SSE）
```

#### 7.5.3 设备 OTA 升级
```
生成设备 OTA：
- 固件包管理
- 灰度发布
- 升级状态追踪
- 失败回滚
```

### 7.6 教育 / 直播课堂

#### 7.6.1 直播推拉流
```
集成直播：
- 推流：OBS / 自研推流端（RTMP / SRT）
- 拉流：HLS / FLV / WebRTC
- CDN：阿里云 / 腾讯云 / 七牛
- 互动：弹幕 / 礼物 / 连麦
```

#### 7.6.2 课程目录 + 学习进度
```
生成课程系统：
- 课程结构（章 / 节 / 知识点）
- 学习进度持久化
- 视频断点续播
- 笔记 + 收藏
- 答题卡 + 错题本
```

### 7.7 医疗 HIS

#### 7.7.1 患者档案 + 电子病历
```
生成 HIS 核心：
- 患者主索引（EMPI）
- 病历模板（结构化 + 富文本）
- 处方（合理用药校验）
- 影像 PACS（DICOM）
- HIPAA / 个保法合规
```

### 7.8 金融 / 风控

#### 7.8.1 实名认证 + KYC
```
生成实名认证：
- 二要素 / 三要素 / 四要素验证
- 活体识别（人脸 + 动作）
- 证件 OCR
- 风险评分模型
- PCI-DSS 合规存储
```

#### 7.8.2 风控规则引擎
```
生成风控规则引擎：
- Drools / 自研 DSL
- 规则版本管理
- 实时决策 + 离线分析
- 黑白名单
- 告警 + 人工复核
```

### 7.9 CMS / 内容

#### 7.9.1 富文本编辑器
```
集成富文本：
- TipTap / Quill / 自研
- 图片上传 + 视频嵌入
- 代码高亮
- 协同编辑（CRDT / OT）
```

#### 7.9.2 SEO 优化
```
生成 SEO 自动化：
- 自动 sitemap
- 自动 schema.org
- 自动 OG 标签
- 关键词密度分析
- 内链生成
```

---

## 使用建议

1. **首次对话**：先发 §0.1 项目背景，建立 AI 上下文
2. **按顺序生成**：DB → Entity → DTO → Service → Controller → 前端 → 测试 → DevOps
3. **每个提示词独立使用**：复制 → 替换占位符 → 粘贴到 AI 工具
4. **AI 输出后必 review**：
   - 业务校验是否完整
   - 异常处理是否友好
   - 性能是否达标（无 N+1 / 大事务）
   - 安全是否到位（SQL 注入 / 越权 / XSS）
5. **代码合入前**：必须通过 lint / 单元测试 / 集成测试

## 适用工具对比

| 工具 | 优势 | 适用场景 |
|---|---|---|
| **Cursor** | 大段代码生成 + 多文件编辑 | 整个 Service 类 / 整个组件 |
| **Copilot Chat** | IDE 内联 + 行级提示 | 边写边补全 |
| **Claude Code** | CLI / 长文档理解 | 全文档分析 + 重构 |
| **ChatGPT** | 通用强 | 没想好怎么问时先发散 |
| **Codeium** | 免费 + 多语言 | 个人项目 |
| **Cline / Aider** | 开源 + 本地代理 | 隐私要求高 |

## 提示词扩展建议

如团队有特有的：
- 代码规范（如阿里 P3C / 公司私有规范）
- CI/CD 工具（如 Jenkins / TeamCity）
- 监控告警（如自研监控）
- 错误码体系

请补充到 §0.1 项目背景中，让 AI 一并遵守。
