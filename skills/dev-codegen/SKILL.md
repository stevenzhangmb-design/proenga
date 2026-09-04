---
name: dev-codegen
description: 研发交付——把已完成的原型+PRD 变成【对接料(A·喂任意AI)】或【前后端工程代码(B·开箱即编译)】。含导出对接料 / 一键生成代码 / 导出研发版。输入=pm-design 产出的 prd-data；下游兄弟=tech-design/test-case。
---

# 研发交付 skill（dev-codegen）

> **职责边界**：pm-design 管【画原型】、prd 管【写 PRD】、本 skill 管【把原型+PRD 变成料/代码】。
> 2026-09-01 从 pm-design/codegen 拆出独立成 skill（代码生成定型后归位·各司其职）。

## 什么时候用
用户说「导出对接料 / 导出研发版 / 一键生成代码 / 生成前后端代码」，或点原型上【📦 导出对接料·喂AI】【🚀 一键生成代码】按钮时。

## 前提（硬）
- 原型 + PRD 已完成，且 **PRD 填全**（字段规范 + 7 节用例规则）。**PRD 空/糙 → 出的料/码必是垃圾（GIGO）**，先拦住补 PRD。
- anno-server 运行中（按钮走 /anno-codegen、/anno-devkit 端点）。

## 两条路线（对应两个按钮）
### A · 导出对接料·喂AI（栈无关·Proenga 不碰代码）
出料包喂用户自己的任意 AI（Cursor/Codex/Claude）生成任意栈代码：
`openapi.yaml + schema.sql + tokens.css + prompts/前后端.md + README + data_model`。
命令：`node codegen/emit-contract.js`、`emit-tokens.js`、`emit-prompts.js`（或 anno-server `/anno-devkit`）。

### B · 一键生成代码（Proenga 确定性出【开箱即编译】的前后端工程）
桥 → 发射器 → 脚手架，一条命令：
```
node codegen/derive-datamodel.js <prd-data.json> <dm.json> [fpFilter]     # 桥：PRD字段规范→data_model
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
