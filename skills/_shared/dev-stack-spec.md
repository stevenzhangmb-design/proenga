# 默认技术栈规范（Tech Stack Spec · 后端 / 前端 / PDA）

> **🎯 首要用途：这是马上要做的【导出研发版 / 生成代码】的地基。** 导出研发版产出的"料"——DDL 草案、接口契约、前后端骨架、研发提示词——全部以本文范式为模板依据，生成的代码才"长得像真实生产项目"，不是教科书默认。同时也是"技术概要设计 / 研发提示词"的默认技术规范。
>
> **这是与 UI 设计规范并列的另一半真理源。**
> - **UI 设计规范**（配色/组件/布局）→ [`pm-design/system-design-spec.md`](../pm-design/system-design-spec.md)（B 端）+ [`pm-design/system-design-spec-mobile.md`](../pm-design/system-design-spec-mobile.md)（移动版）
> - **技术栈规范**（代码分层/契约/DDL/i18n）→ **本文件**
>
> **来源**：从真实生产代码提炼（2026-07-07，`retail-server` 后端 / `wms-manage` 前端 / `wms-pda` PDA）。**这是默认，旧的教科书写法（Controller→Service 两层 / Pinia / vue-i18n / 简单 enum 错误码）作废。**
> **铁律**：生成的代码要"长得像真实项目"——按本文范式，别用教科书默认。UI 令牌只在上面两份 UI 规范里取，本文不重复。
> ⚠️ 本文只记"约定/范式"，不含真实源码/密钥/客户数据；打包发布随 skill 走。

---

## 一、后端范式（Java · retail-server）

- **栈**：**Java 21 + Spring Boot 3 + MyBatis-Plus 3.5.10** + MapStruct 1.6.2 + **Redisson（分布式锁）** + JWT(jjwt) + Spring Security + Redis + **SpringDoc/knife4j（Swagger）**；多模块 Maven（`<name>-common` 共享 + `<name>-server` 业务）。
- **分层（比标准多一层 Logic）**：`Controller → Logic（编排/业务规则/@Transactional/分布式锁）→ Service（IService MyBatis-Plus）→ Mapper → PO`。**别用教科书的 Controller→Service 两层。** `DTO` 入参 / `VO` 出参 / `PO` 持久化。
- **统一返回 `Result<T>`**：`success` / `code`（**2000 OK / 301 WARN / 500 ERROR**）/ `subcode` 业务子码 / `msg` / `data`；静态工厂 `Result.ok(...)` / `Result.error(...)`。
- **错误码 `XxxCodeMsg extends LanguageMsg`**：每个码 = 数字（**按模块分段**，如 customer=10009xxx）+ **4 语言（中 zh / 英 en / 葡 pt / 西 spa）** + `%s` 占位；构造时自动注册到全局翻译表。**不是简单 enum。** `GlobalExceptionHandler`（`@RestControllerAdvice`）统一捕获业务/校验异常 → `Result`。
- **Controller**：`@RestController` + `@RequestMapping` + 构造注入(`@RequiredArgsConstructor`) + `@Validated` + Swagger(`@Tag`/`@Operation`) + `@PreAuthorize` 权限 + `@Valid @RequestBody DTO`。CRUD = `POST` 创建 / `PUT` 改 / `GET /{id}` 详情 / `POST /page` 分页。
- **业务层 Logic**：`@Component` + `@Transactional(rollbackFor=Exception.class)`；唯一性校验走**分布式锁 + existsBy**；抛 `XxxException(XxxCodeMsg.YYY)`；PO→VO 手工映射；分页 MyBatis-Plus `Page`→`PageResult`。
- **DTO 校验**：Jakarta `@NotBlank`/`@Size(message=...)` + Swagger `@Schema(description/requiredMode/example)`。
- **横切**：多租户 `tenant_id` 自动注入（`TenantLineHandler`）+ 审计字段自动填充（`AuditMetaObjectHandler`）+ 操作日志切面（`OperationLogAspect`）+ 访问日志（`AccessLogAspect`）+ 单号生成（`SerialCodeGenerator`）+ i18n `ResponseLanguageFilter`（按 `Language` 头切错误消息语言）。

### 数据层（DDL / PO / Service）
- **DDL（Flyway `V<时间戳>__<名>.sql`）**：InnoDB + utf8mb4_unicode_ci；`id` BIGINT（**雪花算法·无 AUTO_INCREMENT**）；**标准审计列** `create_time`(DEFAULT CURRENT_TIMESTAMP) / `update_time`(ON UPDATE) / `create_by` / `update_by` / `deleted`(TINYINT 逻辑删除)；`tenant_id` BIGINT（多租户）；金额 `DECIMAL(14,2)`；**唯一键带 (tenant_id, 业务列, deleted)**、索引 tenant_id 前缀；**每列每表都有 COMMENT**。
- **Entity(PO)**：`@Data @TableName("表名") @EqualsAndHashCode(callSuper=true)` **extends `TenantBasePO`**（基类含 id + tenant_id + 审计字段）；**只声明业务字段**；类型 String/Integer/BigDecimal/LocalDateTime；camelCase↔snake_case 自动映射。
- **Mapper**：MyBatis-Plus `BaseMapper` + 复杂查询才写 `XxxMapper.xml`。
- **Service 实现**：`@Service class XxxServiceImpl extends ServiceImpl<XxxMapper, XxxPO> implements IXxxService`。
  - **简单查询不写 XML**，用 `LambdaQueryWrapper`（`Wrappers.lambdaQuery()`）类型安全构造：`.eq/.ne/.ge/.le/.orderByDesc`；`baseMapper.exists/selectPage/selectCount`。
  - 文本搜索用统一 `TextSearchHelper.apply(wrapper, PO::getField, keyword)`。
  - 冗余统计列**原子自增防竞态**：`update(lambdaUpdate().setSql("total_amount = total_amount + " + amount).eq(...))`。

---

## 二、前端范式（Vue3 + TS · wms-manage · B 端后台）

- **栈**：Vue3 + **TypeScript** + Element Plus + SCSS + axios + js-cookie + **Vuex** + Vue Router +（Vue CLI/webpack）。**不用 Pinia/vue-i18n/Vite 教科书写法。**
- **通用表格 `BaseTable.vue`（配置驱动）**：状态页签 `el-tabs type=card` + 左右按钮组（`v-buttonAuth` 权限指令 + `SvgIcon` + `lang()`）+ `el-table`（header-cell-style / row-style / row-class-name / row-key / v-loading / 多选）。按钮由 `leftButtonsData/rightButtonsData` 配置（type/icon/label/authTxt/component[el-dropdown/export/import]）。
- **列表页范式**：`<SearchBox @search @reset>` 包多个 `<SearchSeleItem>`（el-select/el-input·`lang()` 占位·filterable/clearable·v-model `search.xxx`）+ 下方 `BaseTable`；外层 `el-config-provider`。
- **表单/详情页范式**：`<el-form :model="formData" :rules="formRules" ref="formRef" label-position="top" :inline="true">`；`form-header__title` 分块（如"基本信息"）；**编辑/查看双态**——`v-if="!pageDisabled"` 显示 el-input/el-select 控件，`v-else` 显示 `form-box-text` 只读文本（空值 `--`）；控件 `v-model.trim` + `lang()` 占位 + `maxlength`/`clearable`/`show-word-limit`（textarea）+ `prop` 对应 `formRules`。
- **请求层**：① `service/index.ts` 聚合器——`require.context` 自动加载 `service/**` → 挂 `$service` / `useService()`；② `utils/axios.ts` 基座——`baseURL=VUE_APP_API_URL`，token 走 `<系统>Authorization` cookie，**请求头带 `time-zone`（默认 America/Sao_Paulo）+ `Language`（默认 `pt` 葡语）**，响应 401 跳登录、超时重试 3 次。
- **统一返回**：`Result` code `2000`=成功 / `401`=登录过期 / `500`=错误。
- **权限**：`v-buttonAuth`（读 localStorage `permissions`，无权限 `removeChild` 隐藏按钮）；另有 `v-noSpace`。
- **目录**：components / directives / hooks / icons / language / layout / mock / report / router / service / store / styles / types / utils / views；多 `.env`。

---

## 三、PDA / 移动版范式（uni-app · wms-pda）

- **栈**：**uni-app + Vue3 + JavaScript + uv-ui**（`@/uni_modules/uv-ui-tools`）+ HBuilderX；页面 **`.nvue`**（原生渲染）。UI 组件细节见 [`system-design-spec-mobile.md`](../pm-design/system-design-spec-mobile.md)。
- **原生组件**：`<view>/<text>/<image>/<scroll-view>`（非 HTML div/span）。
- **uv-ui 组件**：`uv-navbar`/`uv-icon`/`uv-list`/`uv-list-item`/`uv-modal`/`uv-action-sheet`/`uv-loading-page` 等。
- **请求**：`utils/request/index.js` → `uni.$uv.http.setConfig(baseURL=config.baseUrl)` + `requestInterceptors`/`responseInterceptors`（luch-request）。
- **单位 rpx**（`uni.$uv.setConfig({config:{unit:'rpx'}})`）。
- **扫码交互（PDA 命脉）**：`<input>` + `@blur/@focus` 的"扫描/输入"模式；`manifest.json` `app-plus.modules` 挂 **Barcode（核心）/ Camera / Bluetooth**。
- **导航**：`pages.json` `navigationStyle:"custom"`（用 `uv-navbar` 自定义，不用系统导航栏）。
- **目录**：api / common / components / config / language / pages / static / uni_modules / utils；多 `.env`（development/production/staging/testing）。

---

## 四、i18n 范式（三端共通 · 自研·默认葡语）

- **4 语**：`type LanguageKey = 'zh' | 'en' | 'pt' | 'spa'`；**默认 `pt`**（`localStorage.curLang || 'pt'`）。
- **本地基础包** `language/lang/zh-CN/common.ts`：key 为英文驼峰（`okText/confirmText/addNewText/editText/importText/exportText/searchText/queryText`…）→ 各语言值。
- **远端语言包**：从 `${langUrl}/static/language/<系统>/${lang}.js` 按版本（`lang_zh_v1`）异步加载，缓存 localStorage `localLang{zh,en,pt,spa}`。
- 用法：`lang('key' 或 中文原文)` 查表返回当前语言文本。
- **后端错误码同样 4 语言**（zh/en/pt/spa），按 `Language` 请求头切换。

---

## 五、关键铁律（生成代码时必遵）

1. **主色 `#3363FF` 三端一致**（B 端 / 移动版 / PDA）——UI 令牌以两份 UI 规范为准。
2. **Brazil 本地化是硬需求**：前端默认 `pt` + 时区 America/Sao_Paulo；后端错误码 4 语言（含 pt/spa）；PDA 多语言页面。**"pt/spa 必带"坐实。**
3. **后端是四层**（Controller→Logic→Service→Mapper），**不是**教科书两层。
4. **前端请求 = service 聚合器 + axios 基座**、权限 = `v-buttonAuth` 指令、i18n = 自研 `lang()`——**别用 Pinia/vue-i18n 教科书写法**。
5. **后端错误码 = 数字码 + 4 语言常量类**（`LanguageMsg` 范式），**不是简单 enum**。
6. **DDL = 雪花 id + 逻辑删除 + tenant_id + 审计列 + 每列 COMMENT + 金额 DECIMAL(14,2)**。
7. **前端表单编辑/查看双态**（`pageDisabled` 切控件/只读文本）。

---

## 六、待补（后续吸收）

- **APP / 小程序 / 网站** 的专属技术栈：用户后续提供代码后按同法吸收。当前移动版默认沿用 PDA 范式（uni-app）。
