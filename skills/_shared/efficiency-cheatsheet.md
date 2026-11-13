# 提效速查表 · 六操作 → 用哪条命令（随包·跨工具·单一真理源）

> **给任何 AI 工具的话**（Claude Code / Cursor / Codex / OpenClaw / Copilot …）：
> 画原型 / 改原型 / 生成 PRD / 改 PRD / 生成代码 / 改代码 这六件事，**各有专用命令，别现搓脚本、别整份读大文件**。
> 这些工具是**零依赖 node 脚本**（只用 node 内置 fs/path/child_process + 仓库内文件·无 npm 依赖·无写死路径），
> 随仓库发布，**任何机器只要装了 Node 18+（render/截图另需 Chrome）跑出来的效果完全一致**——装完就和作者本机一样。

## 六操作 → 命令

| 操作 | 命令 | 做什么 | 实测 |
|---|---|---|---|
| **① 生成原型** | `node skills/pm-design/scaffold.js <源> init / add-list / add-form / add-view / add-home / add-custom / add-dialog` | 一行紧凑 spec → 整页合规 pagecfg + 自动挂导航（全页型） | <0.1s/页 |
| | `node skills/pm-design/scaffold.js <源> build <plan.json> [--assemble --verify]` | 一个计划 → 一条命令造整套 | 4 页≈3s |
| | `node skills/pm-design/scaffold.js <main> merge <frag…>` | 并行扇出：N 子 agent 各写片段 → 合并（墙钟÷N） | <0.1s |
| **② 改原型** | `node skills/pm-design/p.js <源> find/show/get/tree` | 定点查（这句话在哪 / 这页有什么），**不整份读大 HTML** | 0.16s |
| | `node skills/pm-design/p.js <源> set "<路径>=<值>" --check <页>` | 改一处 + 重装 + **文字确认**（列/行/字段/报错/溢出·省截图 token） | set 0.5s + check ~1.5s |
| | `node skills/pm-design/p.js <源> shot <页> [--click …]` | 只在核对视觉保真/逐像素时才截图 | ~7s |
| | `node skills/pm-design/mockgen.js <源> <页> [N] --apply` | 按列名自动生成模拟数据（金额/CNPJ/日期/状态…） | <0.1s |
| | 多语标签写紧凑串 `"\|中文\|English\|Português"`（`i18n-compact.js` 装配时自动展开） | | |
| **③ 生成 PRD** | `node skills/prd/prd-draft.js <类型> [--fields "售价*,库存"] [--notif] [--name 商品]` | 吐 7 节 use_cases 骨架·固定件（操作日志/查询句/提示消息/通知表头）逐字填好·AI 只填 `<…>` 业务槽位 → `/anno-inject` | 瞬时·每 fp 省~20-30% |
| **④ 改 PRD** | `node skills/prd/pd.js <prd-data> list/show/get/find` | 定点看某功能点现有字段规范 + 7 节用例规则，**不整份读几 MB prd-data** | 瞬时·只读 |
| | 看清要改哪 → `prd-draft` 出骨架填业务 → `/anno-inject` 重生成那**一个** fp（写入走 anno-server·自动重算 md/docx） | | |
| **⑤ 生成代码** | `node skills/dev-codegen/codegen/emit-all.js <data_model.json> <outDir> [栈…]` | 确定性生成前后端骨架（无 AI 敲字循环） | 0.97s·35 文件 |
| | `node skills/dev-codegen/codegen/derive-from-prototype.js <原型.html> <data_model.json>` | 原型 → data_model | 0.08s |
| **⑥ 改代码** | 改源（原型/PRD）→ 重跑 `emit-all`（确定性·全量即可，无需增量） | | 0.97s |
| | 手改 L3 复杂逻辑（生成器造不出的 ~20%）= 正常代码库，在 IDE 里改 | | 人工 |

## 铁律（跨工具一致）
- **改一处 = 只改源 `project-data.json` / `prd-data.json` 的那几行 → 重跑对应命令**；**禁整份读/改几 MB 的大 HTML 原型或 prd-data**（token 爆炸）。
- **验证结构 = 文字**（`p.js --check` / `pd.js show`），**只有核对视觉保真才截图**。
- **复刻真系统（模式 A）不走 scaffold**（要 RPA 抓真值 1:1）；scaffold/mockgen 只用于默认 UI / 新系统（模式 C）。
- **PRD/原型的写入都走单一真理源**：原型→project-data→assemble；PRD→/anno-inject→anno-server。直接改大文件会让下游（md/docx/离线件）脱节。

## 回归闸（防工具被改坏·随包）
- `skills/pm-design/qa/scaffold-smoke-gate.js` — 全页型 build→装配→渲染→弹窗自检
- `skills/prd/qa/prd-draft-sync-gate.js` — prd-draft 固定件 ⇄ annotation-templates 真理源逐字一致
- 交付前全套：`skills/pm-design/qa/deliver-gate.js`（40 道·f97d 验收红线）

## 装完怎么确认"和作者一样"（可移植性）
- 这些工具**零 npm 依赖**（只用 node 内置）、**无写死路径**、**随仓库 git-tracked**（含 `rpa/_cdp.js`、`components/*.html`、`vendor/` 12 个离线资产）→ 任何机器 clone + Node 18 即同效果。
- 机器实证：`node skills/pm-design/qa/fresh-install-smoke.js` 会把 `skills/pm-design` 复制到临时**干净目录**、**只从副本**跑 —— 其中 **scaffold 从零 build 出整套原型·标注层=最新·产物不引用原始路径**（绿），证明"从零画原型"换机也一致。
- 全套打包验收见 [`acceptance-checklist.md`](./acceptance-checklist.md)。
