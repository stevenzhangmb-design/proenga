---
name: dev-codegen
description: 研发交付——把已完成的原型+PRD 变成【对接料(A·喂任意AI)】或【前后端工程代码(B·开箱即编译)】。含导出对接料 / 一键生成代码 / 导出研发版。输入=pm-design 产出的 prd-data；下游兄弟=tech-design/test-case。
---

# 研发交付 skill（dev-codegen）

> 🔴🔴🔴🔴 **先研究后建议铁律（2026-11-13 用户明令「工作底线」· 最高优先 · 随包 · 所有 skill 通用）**：给用户任何决策建议前，必须先研究竞品和行业标准系统、本系统现状、行业规范和法规原文，建议里写明依据和证据等级；研究不够就说“还不能建议，缺……”；结论和之前的建议不同，第一句就更正。全文见 [../_shared/research-before-advice.md](../_shared/research-before-advice.md)。

> 🏛 **提速铁律（随包·三条产线通用）**：生成原型 / 写 PRD / 生成代码，**不管从 0 生成还是中途改**，一律按 [`skills/_shared/speed-protocol.md`](../_shared/speed-protocol.md) 走快路；同一个动作失败 2 次就停下说话，禁死循环。

> **职责边界**：pm-design 管【画原型】、prd 管【写 PRD】、本 skill 管【把原型+PRD 变成料/代码】。
> 2026-09-01 从 pm-design/codegen 拆出独立成 skill（代码生成定型后归位·各司其职）。

## 什么时候用
用户说「导出对接料 / 导出研发版 / 一键生成代码 / 生成前后端代码」，或点原型上【📦 导出对接料·喂AI】【🚀 一键生成代码】按钮时。

## 前提（软·两档数据源·2026-09-09 解耦）
> **铁律：导出对接料 / 一键生成代码 与「是否生成过 PRD、是否圈选/点选过功能」彻底独立——只要画了原型就能出料/出码，绝不因没 PRD 而拒绝。** 测试用例 / 售前 PPT+文档 / 操作手册同理，都以原型为兜底数据源。
- **有 PRD 字段规范（最佳档·精确）**：走 `derive-datamodel.js`，字段类型/可空/枚举/校验来自 PRD 的 `_draft_fieldSpecs`（人已确认）→ 出料/码精确。
- **没 PRD（兜底档·基线·始终可用）**：走 `derive-from-prototype.js`，从原型内嵌 `const PAGECFG={...}`（每页 columns/filters/rows）推**基线 data_model**——类型按列名+样例值猜（金额→decimal、YYYY-MM-DD→date、状态标签/select→枚举、数量→int、否则 varchar255）。**能直接出契约+前后端可编译代码**，但字段精度是"猜"的，产出头部会标 `_source:prototype-pagecfg` 提示研发/AI 复核类型与校验。
- anno-server 运行中（按钮走 /anno-codegen、/anno-devkit 端点）；命令行直跑不依赖 anno-server。
- **仅当有 PRD 时**才校验 PRD 填全（字段规范 + 7 节用例规则空/糙先提示补，GIGO）；**没 PRD 不拦，直接走兜底档**。

## 第 0 步（两条路线共用）：产出 data_model —— 按数据源自动选桥
> 两条路线都吃 `data_model`（同结构：`{data_model:{enums,entities}, function_points}`）。先按有无 PRD 选桥产出它，**没 PRD 绝不停**：
```
# 有 PRD 字段规范（prd-data.json 里有 _draft_fieldSpecs）——精确档
node codegen/derive-datamodel.js <prd-data.json> <dm.json> [fpFilter]
# 没 PRD（没圈选/没生成过 PRD）——从原型结构推基线，始终可用
node codegen/derive-from-prototype.js <原型.html> <dm.json> [glossary.json]
```
判定：prd-data 有 `_draft_fieldSpecs` → 用 derive-datamodel；否则（或根本没 prd-data）→ 用 derive-from-prototype 读原型 HTML。两者输出同结构，下游 emit-* 完全一致。

## 两条路线（对应两个按钮·都基于第 0 步的 data_model）
### A · 导出对接料·喂AI（栈无关·Proenga 不碰代码）
出料包喂用户自己的任意 AI（Cursor/Codex/Claude）生成任意栈代码：
`openapi.yaml + schema.sql + tokens.css + prompts/前后端.md + README + data_model`。
命令：`node codegen/emit-contract.js <dm.json> <outDir>`、`emit-tokens.js`、`emit-prompts.js`（或 anno-server `/anno-devkit`）。

### B · 一键生成代码（Proenga 确定性出【开箱即编译】的前后端工程）
桥（第 0 步）→ 发射器 → 脚手架：
```
node codegen/emit-all.js <dm.json> <outDir> <basePkg> <feStack> <beStack> # 契约+前端+后端+校验+工程脚手架
```
- **前端栈** feStack：`vue`(Vue3+EP) | `react`(React+AntD)
- **后端栈** beStack：`java`(Spring+MyBatis-Plus) | `node`(NestJS+TypeORM) | `python`(FastAPI+SQLAlchemy)
- **6 组合全开箱可编译**（真编译器验过）：前端 Vue`vue-tsc`/React`tsc`、后端 Java`mvn compile`/Node`tsc`/Python`import app.main`。emit-all 第⑥步后端脚手架、第⑦步前端脚手架自动补 pom/package.json/base/main/router 等。

## 选栈时机（附则·2026-07-09 定）
- 画原型四问【不问技术栈】；技术栈只在【导出研发版/一键生成代码】时确认。
- 提示「确认采用默认技术方案吗？」默认按 `__DESIGN_CHOICE__.form`（B端→Java四层+Vue3+EP）。
- 选「否」→ 先学用户的栈（发代码/框架文档→提取范式存 learned-stack）→ 学完才导。按钮触发+选否=断点，提示去对话框发栈。

## 天花板（诚实·L3）
- **能确定性出**：契约 + DDL + 前端页面 + 后端 CRUD 四层 + 主子表 + 开箱工程脚手架。
- **出不了（那 20%）**：真实校验细节 / 状态流转 / 权限 / 租户隔离 / 计费算法——原型/PRD 无可执行规则，需研发/AI 逐功能读用例规则补方法体。**别吹"一键出可上线系统"**。

## 依赖 / 关联
- 技术规范：`../_shared/dev-stack-spec.md`（后端四层/DDL/契约/i18n 约定）。
- 提示词：`../dev-prompts`（研发提示词）。
- 护栏：`codegen/codegen-smoke-gate.js`（5 组合出码+静态/py_compile 冒烟·防生成器回归）。
- 验收红线：`../_shared/acceptance-checklist.md` 附则 A。

## 铁律
- 拿**真原型数据**端到端验（样例能编≠真数据能编·2026-09-01 真充值数据逮修 4 个真 bug 才通）。
- 改生成器后跑 `node codegen/codegen-smoke-gate.js` 全绿再交付。
- 前端两条线：`emit-frontend`(读 data_model·通用 CRUD·两栈开箱) 与 `emit-frontend-proto`(读原型 PAGECFG·1:1 还原设计屏·自包含)。合体（忠实屏×类型绑定）待"PAGECFG+字段规范都全"的原型。
