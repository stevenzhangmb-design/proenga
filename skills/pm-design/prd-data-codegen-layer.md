# prd-data 代码生成层（阶段1① · 契约数据 schema + 商品模块试跑）

> **这是什么**：把 `prd-data.json` 从"给写 PRD / 画原型用的数据"升级成"能生成前后端代码的**契约数据**"。是 [[project_route_b_codegen_direction]] **阶段1① 语义地基**的第一铲，A（出料）和 B（生成代码）都吃它。
> **对齐**：DB/契约约定一律照 [`../\_shared/dev-stack-spec.md`](../_shared/dev-stack-spec.md)（雪花 id·审计列·tenant_id·逻辑删除·金额 DECIMAL(14,2)·snake_case·每列 COMMENT·Entity 只声明业务字段）。不自由发挥。
> **状态**：schema 设计 + 商品模块试跑一版（2026-08-04）。**未接生成器**（那是阶段2/3）。

---

## 1 分层原则（关键·不破坏现有数据）

现有 `function_points[fp].field_specs`（中文名/type 粗类/required/default/constraint 文字）**原样不动**——它是 **PRD / UI 层**。

**新增一层** `data_model`（**代码生成层**），与 field_specs **按"字段中文名"join**：

```
field_specs（PRD/UI层·已有）      data_model（代码生成层·新增）
  商品名称·文本·1~60字符唯一   ──→   goods_name · varchar(60) · not null · uk
  ("长什么样、怎么校验")              ("落哪张表哪列、什么类型、什么约束、什么接口")
```

- **id / tenant_id / 审计列（create_time/update_time/create_by/update_by/deleted）不在 data_model 里重复**——由 dev-stack-spec 的 `TenantBasePO` 基类 + DDL 约定**自动加**。data_model **只声明业务列**（与 Entity 只声明业务字段一致）。
- DB 列类型是**从实测字段 + 校验规则推导的建议契约**（见 §3 推导规则），**非实测**——研发/DBA 可调。实测的是 UI 字段本身（名/粗类/校验文字）。

---

## 2 schema 定义

### 2.1 `data_model.enums`（枚举值域·结构化）
```json
"enums": {
  "goods_status": {
    "comment": "商品审核状态",
    "values": [
      { "code": 1, "key": "pending",  "zh": "待审核" },
      { "code": 2, "key": "approved", "zh": "已审核" },
      { "code": 3, "key": "rejected", "zh": "已驳回" },
      { "code": 9, "key": "disabled", "zh": "停用"   }
    ]
  }
}
```
> 原型状态标签、后端 enum、DDL tinyint 注释、i18n 全从这一处派生（单一真理源）。

### 2.2 `data_model.entities`（表/实体·只业务列）
| 列键 | 含义 |
|---|---|
| `field` | 关联 field_specs 里的字段中文名（join 键·可空=纯技术列）|
| `col` | snake_case 列名 |
| `type` | `varchar`/`char`/`text`/`bigint`/`int`/`tinyint`/`decimal`/`date`/`datetime`/`json` |
| `len` | varchar 长度 |
| `precision`/`scale` | decimal 精度（金额固定 14,2）|
| `nullable` | 可空（默认 false）|
| `default` | 默认值（枚举写 code）|
| `unique` | 唯一（生成 `uk(tenant_id, col, deleted)`）|
| `index` | 普通索引 |
| `enum` | 引用 `enums` 的 key |
| `fk` | `{ entity, onDelete }` 外键关系 |
| `comment` | 列注释（必填·每列都要）|

### 2.3 `function_points[fp].api`（接口契约）
```json
"entity": "goods",
"api": {
  "list":   { "method":"GET",    "path":"/api/wms/goods",      "query":["goodsName","barcode","status","customerId"], "resp":"PageResult<GoodsVO>" },
  "detail": { "method":"GET",    "path":"/api/wms/goods/{id}", "resp":"GoodsVO" },
  "create": { "method":"POST",   "path":"/api/wms/goods",      "req":"GoodsSaveReq", "resp":"Long" },
  "update": { "method":"PUT",    "path":"/api/wms/goods/{id}", "req":"GoodsSaveReq" },
  "delete": { "method":"DELETE", "path":"/api/wms/goods/{id}" }
}
```

---

## 3 推导规则（UI 字段 → DB 类型 · 生成器的引擎逻辑）

> 这张表是"引擎"——从实测的 UI 类型 + 校验文字，**确定性推导**建议 DB 契约。生成器照此跑，人可覆盖。

| field_specs 里的 type / constraint | → DB type | 规则 |
|---|---|---|
| 文本 · "1~N 字符" | `varchar(N)` | N≤255→varchar(N)；无长度→varchar(64) 兜底 + 警告 |
| 文本 · 长文本/备注/说明 | `text` | constraint 含"多行/富文本/≤1000" |
| 数字 · 整数/数量/个数 | `int`（大→`bigint`）| |
| 数字 · 金额/价值/价格/费用 | `decimal(14,2)` | 照 dev-stack-spec 金额约定 |
| 数字 · 尺寸/重量/百分比 | `decimal(10,2)` | |
| 日期 | `date` | |
| 日期时间 | `datetime` | |
| 下拉/单选 · 固定选项 | `tinyint` + `enum` | 选项 → enums 值域（code 从 1 起）|
| 开关/是否 | `tinyint` | 0/1 |
| "唯一" 出现在 constraint | 加 `unique` | 生成 `uk(tenant_id, col, deleted)` |
| "必填/required:是" | `nullable:false` | |
| 名称含"客户/供应商/仓库/所属 X"且指向另一实体 | `bigint` + `fk` | 关系推导（需确认 ref 实体）|
| 上传/图片/附件 | `varchar(255)`（单）/`json`（多）| 存 URL/路径 |

**推导后必人工确认项**（生成器标 ⚠️）：外键 ref 实体、枚举 code 映射、varchar 无长度的兜底、大整数是否 bigint。

---

## 4 商品模块 · 试跑一版（代表性字段·完整 24 字段见实测档）

> 字段来自 TF WMS「新增商品」实测（4 组：基本信息/价格规格/商品属性/税务信息）。下取每组代表字段演示全部 code-gen 层特性；DB 契约是 §3 推导的建议。

```json
{
  "data_model": {
    "enums": {
      "goods_status": { "comment":"商品审核状态", "values":[
        {"code":1,"key":"pending","zh":"待审核"},
        {"code":2,"key":"approved","zh":"已审核"},
        {"code":3,"key":"rejected","zh":"已驳回"},
        {"code":9,"key":"disabled","zh":"停用"}
      ]},
      "size_unit": { "comment":"公制/英制", "values":[
        {"code":1,"key":"metric","zh":"公制"},
        {"code":2,"key":"imperial","zh":"英制"}
      ]}
    },
    "entities": {
      "goods": {
        "table": "wms_goods",
        "label": "商品",
        "comment": "商品主数据",
        "columns": [
          { "field":"客户",       "col":"customer_id",   "type":"bigint",  "nullable":false, "fk":{"entity":"customer","onDelete":"restrict"}, "comment":"所属客户ID" },
          { "field":"商品名称",   "col":"goods_name",    "type":"varchar", "len":60, "nullable":false, "unique":true, "comment":"商品名称·同客户下唯一" },
          { "field":"商品条形码", "col":"barcode",       "type":"varchar", "len":32, "nullable":true,  "index":true,  "comment":"商品条形码" },
          { "field":"参考SKU编号","col":"ref_sku",       "type":"varchar", "len":64, "nullable":true,  "comment":"参考SKU编号" },
          { "field":"商品别名",   "col":"alias",         "type":"varchar", "len":128,"nullable":true,  "comment":"商品别名·多个逗号隔" },
          { "field":"申报价值",   "col":"declared_value","type":"decimal", "precision":14, "scale":2, "nullable":true, "comment":"客户申报价值" },
          { "field":"长",         "col":"length_cm",     "type":"decimal", "precision":10, "scale":2, "nullable":true, "comment":"长(cm)" },
          { "field":"宽",         "col":"width_cm",      "type":"decimal", "precision":10, "scale":2, "nullable":true, "comment":"宽(cm)" },
          { "field":"高",         "col":"height_cm",     "type":"decimal", "precision":10, "scale":2, "nullable":true, "comment":"高(cm)" },
          { "field":"重量",       "col":"weight_g",      "type":"decimal", "precision":10, "scale":2, "nullable":true, "comment":"重量(g)" },
          { "field":"计量单位",   "col":"size_unit",     "type":"tinyint", "enum":"size_unit", "default":1, "nullable":false, "comment":"公制/英制" },
          { "field":"NCM编码",    "col":"ncm_code",      "type":"varchar", "len":16, "nullable":true, "comment":"巴西 NCM 税则编码" },
          { "field":"状态",       "col":"status",        "type":"tinyint", "enum":"goods_status", "default":1, "nullable":false, "index":true, "comment":"审核状态" }
        ]
      },
      "customer": { "table":"wms_customer", "label":"客户", "comment":"客户主数据",
        "columns":[ { "field":"客户名称","col":"customer_name","type":"varchar","len":100,"nullable":false,"unique":true,"comment":"客户名称" } ] }
    }
  },
  "function_points_patch": {
    "商品管理.商品库.新增-无规格": {
      "entity": "goods",
      "api": {
        "list":   { "method":"GET",    "path":"/api/wms/goods",      "query":["goodsName","barcode","status","customerId","page","size"], "resp":"PageResult<GoodsVO>" },
        "detail": { "method":"GET",    "path":"/api/wms/goods/{id}", "resp":"GoodsVO" },
        "create": { "method":"POST",   "path":"/api/wms/goods",      "req":"GoodsSaveReq", "resp":"Long" },
        "update": { "method":"PUT",    "path":"/api/wms/goods/{id}", "req":"GoodsSaveReq" },
        "delete": { "method":"DELETE", "path":"/api/wms/goods/{id}" }
      }
    }
  }
}
```

---

## 5 派生证明（这份数据够不够生成代码？）

从 §4 的 data_model **确定性派生**出下面两样——证明"料够"（生成器要做的就是这个）：

### 5.1 DDL（照 dev-stack-spec：雪花 id + tenant_id + 审计列 + 逻辑删除 + 每列 COMMENT）
```sql
CREATE TABLE `wms_goods` (
  `id`             BIGINT       NOT NULL COMMENT '主键(雪花)',
  `tenant_id`      BIGINT       NOT NULL COMMENT '租户ID',
  `customer_id`    BIGINT       NOT NULL COMMENT '所属客户ID',
  `goods_name`     VARCHAR(60)  NOT NULL COMMENT '商品名称·同客户下唯一',
  `barcode`        VARCHAR(32)      NULL COMMENT '商品条形码',
  `ref_sku`        VARCHAR(64)      NULL COMMENT '参考SKU编号',
  `alias`          VARCHAR(128)     NULL COMMENT '商品别名·多个逗号隔',
  `declared_value` DECIMAL(14,2)    NULL COMMENT '客户申报价值',
  `length_cm`      DECIMAL(10,2)    NULL COMMENT '长(cm)',
  `width_cm`       DECIMAL(10,2)    NULL COMMENT '宽(cm)',
  `height_cm`      DECIMAL(10,2)    NULL COMMENT '高(cm)',
  `weight_g`       DECIMAL(10,2)    NULL COMMENT '重量(g)',
  `size_unit`      TINYINT      NOT NULL DEFAULT 1 COMMENT '公制/英制(1公制2英制)',
  `ncm_code`       VARCHAR(16)      NULL COMMENT '巴西 NCM 税则编码',
  `status`         TINYINT      NOT NULL DEFAULT 1 COMMENT '审核状态(1待审核2已审核3已驳回9停用)',
  `create_time`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `update_time`    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  `create_by`      BIGINT           NULL COMMENT '创建人',
  `update_by`      BIGINT           NULL COMMENT '更新人',
  `deleted`        TINYINT      NOT NULL DEFAULT 0 COMMENT '逻辑删除(0否1是)',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_goods_name` (`tenant_id`, `customer_id`, `goods_name`, `deleted`),
  KEY `idx_barcode` (`tenant_id`, `barcode`),
  KEY `idx_status` (`tenant_id`, `status`),
  KEY `idx_customer` (`tenant_id`, `customer_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='商品主数据';
```

### 5.2 openapi（片段·从 fp.api + entity 派生）
```yaml
paths:
  /api/wms/goods:
    get:
      summary: 商品列表
      parameters:
        - { name: goodsName,  in: query, schema: { type: string } }
        - { name: barcode,    in: query, schema: { type: string } }
        - { name: status,     in: query, schema: { type: integer, enum: [1,2,3,9] } }
        - { name: customerId, in: query, schema: { type: integer, format: int64 } }
      responses: { '200': { description: OK, content: { application/json: { schema: { $ref: '#/components/schemas/PageGoodsVO' } } } } }
    post:
      summary: 新增商品
      requestBody: { content: { application/json: { schema: { $ref: '#/components/schemas/GoodsSaveReq' } } } }
      responses: { '200': { description: 主键 } }
components:
  schemas:
    GoodsSaveReq:
      type: object
      required: [customerId, goodsName]
      properties:
        customerId:    { type: integer, format: int64 }
        goodsName:     { type: string, maxLength: 60 }
        barcode:       { type: string, maxLength: 32 }
        declaredValue: { type: number, format: decimal }
        status:        { type: integer, enum: [1,2,3,9] }
```

→ **前端生成器**再从同一份 data_model 出 Vue3+EP 的列表页（列=columns、筛选=api.list.query）、新增/编辑表单（字段+校验=len/nullable/enum）、详情页——**前后端共用这一份契约，天然对齐**。

---

## 6 阶段2 A 生成器 ✅ 已实现（2026-08-04）

§3 推导规则 + §5 派生逻辑**已写成真生成器**（零依赖 node 脚本）：

```
node skills/dev-codegen/codegen/emit-contract.js codegen/sample-goods.json out
  → out/schema.sql  （每张表 DDL·雪花id+tenant_id+审计列+逻辑删除+uk含tenant/scope/deleted+每列COMMENT+枚举注释+InnoDB utf8mb4）
  → out/openapi.yaml（paths 从 fp.api·schemas SaveReq/VO/PageVO 从 entities/enums 派生·ref 全解析无悬空）
  + 「料够不够」检查：缺 COMMENT/varchar无长度→⚠️待确认；枚举/外键 ref 不存在→❌阻断（不产出半成品·退出码1）
```
- 正/负双向验证过：坏输入（枚举 ref 缺）→ 阻断不崩不产出；好输入 → 全清产出。**检查不是摆设**。
- §5 手工派生的 DDL/openapi 现在是这脚本**确定性一键产出**。

## 7 诚实边界 + 缺口
- **DB 契约是推导建议，非实测**：varchar 长度、外键 ref、枚举 code 映射，研发/DBA 需过一遍（生成器标 ⚠️/❌）。
- **只试跑了商品 1 个模块**：证明 schema + 生成器够用。全量要给每模块补 data_model（依赖逐模块字段先扒——B 端字段库目前 20-25%）。
- **生成器只出 DDL+openapi**：tokens 导出、研发提示词包、**前端 Vue 页面 / 后端 CRUD 四层代码**（阶段3 B）还没写。
- **天花板 L3**：生成的是可跑 CRUD 骨架；业务逻辑/权限/集成那 20% 仍研发+AI 接力。

## 8 阶段3 B · 后端 CRUD 四层生成器 ✅ 已实现（2026-08-04）

```
node skills/dev-codegen/codegen/emit-backend.js codegen/sample-goods.json out/backend com.tf.wms
  → 每个 fp 实体 8 个 .java（严格照 dev-stack-spec）：
     entity/GoodsPO（@Data @TableName @EqualsAndHashCode(callSuper=true) extends TenantBasePO·只业务字段）
     mapper/GoodsMapper（BaseMapper）· service/IGoodsService + impl/GoodsServiceImpl（ServiceImpl+LambdaQueryWrapper·文本走TextSearchHelper·非文本eq）
     controller/GoodsController（@RestController·端点从 fp.api·Result 包装）
     dto/GoodsSaveReq（jakarta @NotNull/@Size）· dto/GoodsQuery · vo/GoodsVO
```
- 验证过：PO/ServiceImpl/SaveReq 逐字符合技术栈约定（类型映射 bigint→Long/decimal→BigDecimal/tinyint→Integer；查询 LambdaQueryWrapper；校验 jakarta）。
- **前提**：生成的四层假设项目已有基座（`TenantBasePO`/`Result`/`TextSearchHelper`/MyBatis-Plus 配置）——那是真实项目的地基，非每实体生成。
- **L3**：方法体标 `TODO`（业务校验/唯一性/状态前置/权限那 20% 交研发+AI 接力）。

## 9 阶段3 B · 前端页面生成器 ✅ 已实现（2026-08-04）

```
node skills/dev-codegen/codegen/emit-frontend.js codegen/sample-goods.json out/frontend
  → 每个 fp 实体 4 个文件（照 dev-stack-spec 前端范式 · Vue3+TS+EP）：
     views/<e>/index.vue  列表：SearchBox+SearchSeleItem(查询) + el-table(列+操作列) + el-pagination(§4.2 layout+page-sizes)
     views/<e>/form.vue   新增/编辑/查看 三态：el-form label-top·双态(pageDisabled: 控件↔form-box-text 空值'--')·控件按类型·formRules·底部[取消][保存]/[返回]
     service/<e>.ts       CRUD 请求(Result 包装) · types/<e>.ts  TS 接口(VO/SaveReq/Query)
```
- 验证过：form.vue/index.vue 逐条符合前端范式（双态 v-if pageDisabled、lang()、控件映射、分页铁律、按钮命名[取消][保存]）。
- 前提同后端：假设项目已有 SearchBox/SearchSeleItem/lang()/axios 基座。

---

## 10 🎯 B 核心闭环已打通（MVP·2026-08-04）

**一份 `data_model` → 一键生成【数据库 + 后端 + 前端】全套骨架**，共用一份契约天然对齐：
```
sample-goods.json ──┬─ emit-contract → schema.sql（DDL）+ openapi.yaml
                    ├─ emit-backend  → 8 个 .java（PO/Mapper/Service/Controller/DTO/VO）
                    └─ emit-frontend → 4 个文件（列表+表单双态+service+types）
```
在商品模块上端到端跑通=**证明 B 路线成立**（不是 PPT）。**天花板 L3**：可跑 CRUD 骨架·方法体/联动/权限/状态前置那 20% 标 TODO 交研发+AI 接力。

## 11 主子表（一对多单据）✅ 已支持（2026-08-04）

`fp.detail = { entity, fk, label }` 声明主子表（如入库单头+明细行），三生成器全支持（sample-inbound.json 试跑·⚠️字段为设计示例非实测）：
- **DDL**：主+子两张表·子表 FK 列自动加索引（emit-contract 原生支持）。
- **后端**（emit-backend·14 个 .java）：子实体出 PO/Mapper/IService/ServiceImpl/SaveReq(排主外键)/VO；主 SaveReq/VO 带 `List<子> lines`；主 ServiceImpl `@Transactional saveWithLines/updateWithLines`（存头→set 外键→saveBatch 行）+ `detail()` 加载明细行。
- **前端**（emit-frontend）：form.vue 头部表单 + **明细子表**（el-table 绑 formData.lines·单元格按类型出控件·新增行/删除·双态只读）；types 出行接口 + master `lines` 字段。
- 回归：扁平（商品）路径不受影响。修了个真 bug（主 ServiceImpl 用 LineVO 未 import → 补）。

## 12 一键 + 静态校验 ✅ 已实现（2026-08-04）

```
node skills/dev-codegen/codegen/emit-all.js <input.json> [outDir] [basePackage]
  ① 契约 → ② 后端 → ③ 前端 → ④ Java 静态校验 → ⑤ 前端结构校验（任一步阻断即停）
```
- **verify-java.js**（⚠️非真 javac·无 JDK）：查【引用类型无 import】(wildcard/java.lang/同文件/泛型已排除) + 花括号/圆括号配平。正负验证过：干净全绿、删一个 import 即逮（正是曾经的 LineVO 漏 import bug 类）。**建时逮出并修了校验器自身 3 个假阳 bug**（wildcard import 正则漏 `*`；`<template #slot>` 计数；**全限定名 `java.util.List` 尾段被当漏 import**——2026-08-04 负向复测逮出·加 `(?<![.\w])` 负向前瞻修）。
- **verify-ts.js**（⚠️非 vue-tsc）：.ts/.vue 的 {}/()/[] 配平 + `<template>/<script setup>` 标签配对 + import 成形。
- **诚实**：这两道是"廉价前哨"，逮住的是**结构性崩因**（漏 import/括号错），**不是真编译**——真 javac 需 JDK+Maven+项目基座，真类型/模板检查需 vue-tsc+node_modules（本机无 JDK/vue-tsc）。

## 12.5 ✅ 后端真编译验证通过（2026-08-04·铁证）

装 JDK 21（Temurin·`<你的安装目录>\jdk-21.0.12+8`）+ Maven 3.9.16（`<你的安装目录>\apache-maven-3.9.16`·便携解压·非 C 盘）。搭最小 SpringBoot 3.3.4 脚手架（`scratchpad\compile-verify`·pom + 3 基座 stub: `TenantBasePO`/`Result`/`TextSearchHelper`），把商品(扁平 8)+入库单(主子表 14)生成码丢进去：
```
mvn -s settings.xml(Aliyun镜像) compile  →  BUILD SUCCESS · 25/25 .class 产出
```
= **真 javac 编译过**（对齐 Spring Boot 3 + MyBatis-Plus 3.5.7 + Lombok + Jakarta validation·含主子表 saveWithLines/SFunction 方法引用/泛型）。不是静态近似，是铁证。**下次同环境 java/mvn 在 `<你的安装目录>\` 可复用。**

## 12.6 ✅ 前端真类型检查通过（2026-08-04·铁证）

前端脚手架（`scratchpad\ts-verify`·Vue3+TS+ElementPlus+vue-router·npmmirror 装 62 包）+ 4 基座 stub（`@/utils/axios` 带泛型签名 / `@/language` lang / `@/types/common` Result·Page / 全局组件 `SearchBox`·`SearchSeleItem` 声明），把商品+入库单前端码丢进去：
```
vue-tsc --noEmit  →  退出码 0 · 无类型错误（8 个 .vue/.ts）
```
= **真 vue-tsc 类型检查过**（含主子表明细子表 `formData.lines`·el-form 双态·service 泛型 `axios.get<Result<Page<VO>>>`）。**有牙**：首跑逮到 10 个 `TS2347`（我 axios stub 初写成 `any` 拒绝泛型实参——stub 错非生成码错），改成带泛型签名后过。

## 13 离"能给真实项目用"还差
1. **逐模块补 data_model**（依赖字段先扒·目前 B 端字段库 20-25%）——"业务内容"层，扒真系统/用户给。
3. tokens 导出 + 研发提示词包（补齐阶段2 A 全套料）。
4. 扇出多栈（uni-app 移动端 / 其它后端栈）。
5. 行级 diff（update 现全删重插·TODO 保留 id 增量）等业务逻辑那 20%。

关联：[[project_route_b_codegen_direction]] · dev-stack-spec.md · prd-data-schema.md
