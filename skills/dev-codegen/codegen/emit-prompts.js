#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   阶段2 A · 提示词包生成器 · emit-prompts.js · 零依赖
   ────────────────────────────────────────────────────────────────────────
   出【提示词包】——README + prompts/*.md，供【导出对接料·喂AI】。
   把料(openapi/schema/tokens/data_model)配成"喂给任意 AI 生成代码"的指令；栈无关(用户填自己的栈)。
   用法：node emit-prompts.js <data_model.json> <outDir>
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const [, , dmPath, outDir] = process.argv;
if (!dmPath || !outDir) { console.error('用法: node emit-prompts.js <data_model.json> <outDir>'); process.exit(2); }
const doc = JSON.parse(fs.readFileSync(dmPath, 'utf8').replace(/^﻿/, ''));
const entities = (doc.data_model || {}).entities || {};
const fps = doc.function_points || {};
const entList = Object.entries(entities).map(([k, e]) => `- **${k}**（表 ${e.table}·${e.label || ''}）：${e.columns.length} 个业务字段`).join('\n');
const apiList = Object.values(fps).map(fp => { const a = fp.api || {}; return Object.values(a).map(x => `\`${x.method} ${x.path}\``).join(' · '); }).join('\n');

const readme = `# 对接料·研发包（喂 AI 生成代码）

本包由 Proenga 从原型 + PRD 自动导出。**Proenga 只出料、不出代码**——把这包喂给你的 AI（Cursor / Codex / Claude / 你司大模型），让它照料生成**你自己技术栈**的代码。

## 包里有什么
| 文件 | 是什么 | 栈相关性 |
|---|---|---|
| \`openapi.yaml\` | 接口契约（有哪些 API·入参出参） | ✅ 栈无关 |
| \`schema.sql\` | 建表 DDL（MySQL 参考版） | 数据库方言相关·可让 AI 按你的库改 |
| \`data_model.json\` | 中性数据模型（实体/字段/类型/约束/枚举/关系） | ✅ 栈无关·最权威 |
| \`tokens.css\` / \`tokens.json\` | 设计令牌（主色/字号/间距/圆角/组件尺寸） | ✅ 栈无关 |
| \`prompts/\` | 给 AI 的生成指令 | — |

## 怎么用（3 步）
1. 打开 \`prompts/00-总纲.md\`，把里面 \`{{你的技术栈}}\` 换成你的栈（如 React18+TS+AntD / NestJS+Prisma+PostgreSQL）。
2. 把 \`00-总纲.md\` + 对应的 \`后端.md\` / \`前端.md\` + 本包里的料文件，一起喂给你的 AI。
3. AI 照料生成代码 → 你收口业务逻辑那 20% → 上线。

## 本包覆盖的实体
${entList || '（无实体）'}
`;

const outline = `# 00 · 总纲（先喂这个）

你是资深全栈工程师。我给你一份【对接料】，请照它生成一套 CRUD 应用代码。

## 我的技术栈（★请替换）
- 前端：{{你的技术栈·如 Vue3+TS+ElementPlus / React18+TS+AntD}}
- 后端：{{你的技术栈·如 Java+SpringBoot+MyBatisPlus / NestJS+Prisma}}
- 数据库：{{MySQL / PostgreSQL / …}}

## 料（我会随本提示词一起给你）
- \`data_model.json\`：实体/字段/类型/约束/枚举/关系（**最权威·以此为准**）
- \`openapi.yaml\`：接口契约
- \`schema.sql\`：MySQL 参考建表（按你的数据库方言调整）
- \`tokens.css\`：设计令牌（UI 照此配色/字号/间距/圆角）

## 通用约定（务必遵守）
- 每表带：主键 id（雪花/自增按你栈）、租户 tenant_id、审计列(create_time/update_time/create_by/update_by)、逻辑删除 deleted。
- 金额用 DECIMAL(14,2)；日期时间 DATETIME；枚举用整数 code + 文案映射。
- 接口统一返回包装（如 { code, msg, data }，成功码按你栈约定）。
- 列表接口：分页 + 按 data_model 的查询字段过滤。
- 前端：列表页（筛选区 + 表格 + 分页）+ 表单页（新增/编辑/查看**双态**：编辑态控件、查看态只读文本、空值显示 \`--\`）。UI 照 \`tokens.css\`。
- 业务逻辑（校验/权限/状态前置/联动）先留 TODO，标清楚，由我补。

## 实体清单
${entList || '（无）'}

生成前先复述你将用的栈 + 要生成的文件清单，再开始。
`;

const backend = `# 后端生成（喂完总纲后喂这个）

照 \`data_model.json\` + \`openapi.yaml\` + \`schema.sql\`，用【{{你的后端栈}}】生成后端：

对每个实体生成分层代码（按你栈的范式命名）：
- 实体/模型（只声明业务字段·id/租户/审计走基类或框架能力）
- 数据访问层（Mapper/Repository/DAO）
- 服务层（列表分页查询 + 详情 + 新增 + 编辑 + 逻辑删除）
- 控制器/路由（照 openapi 的路径与方法）
- 请求 DTO（带字段校验：必填/长度/格式，来自 data_model 的 nullable/len/约束）
- 响应 VO

## 接口（来自 openapi）
${apiList || '（见 openapi.yaml）'}

## 主子表（若 data_model 里有 fp.detail）
主表新增/编辑在**一个事务**里：存主表 → 给每行明细设外键 → 批量存明细；详情要带出明细行。

业务校验/唯一性/状态前置 标 TODO。
`;

const frontend = `# 前端生成（喂完总纲后喂这个）

照 \`data_model.json\` + \`openapi.yaml\` + \`tokens.css\`，用【{{你的前端栈}}】生成前端：

对每个实体生成：
- **列表页**：筛选区（按 data_model 查询字段·占位符即字段名）+ 表格（列=业务字段·状态列显示枚举文案）+ 分页（layout: total/sizes/prev/pager/next/jumper·page-sizes [10,25,50,100]）+ 操作列（查看/编辑/删除）。
- **表单页（新增/编辑/查看三态）**：label 在控件上方；**双态**——非查看态显示控件（按字段类型：文本→输入框、金额→数字框、枚举→下拉、日期→日期选择、上传→上传），查看态显示只读文本（空值 \`--\`）；校验规则来自 data_model（必填/长度）；底部 [取消][保存]，查看态只 [返回]。
- **请求层**：按 openapi 封装 CRUD 调用，统一返回结构。
- **主子表**：表单里明细做成可增删行的子表格。

UI 一律照 \`tokens.css\`：主色、字号、间距、圆角、组件尺寸都用令牌，别自己编。
`;

fs.mkdirSync(path.join(outDir, 'prompts'), { recursive: true });
fs.writeFileSync(path.join(outDir, 'README.md'), readme);
fs.writeFileSync(path.join(outDir, 'prompts', '00-总纲.md'), outline);
fs.writeFileSync(path.join(outDir, 'prompts', '后端.md'), backend);
fs.writeFileSync(path.join(outDir, 'prompts', '前端.md'), frontend);
console.log('════════ 提示词包生成（阶段2A）════════');
console.log('  实体 ' + Object.keys(entities).length + ' 个 → README.md + prompts/{00-总纲,后端,前端}.md');
console.log('  → ' + outDir);
process.exit(0);
