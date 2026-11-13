# 安装指南 — 在各 AI 工具上安装本工具

> 本工具 = 一套 `skills/`（AgentSkills 标准 `SKILL.md`）+ 纯 Node 机器闸 + `AGENTS.md`/`CLAUDE.md` 入口。
> **核心（规则 + 机器闸）工具无关**；下面是各工具的**安装位置 + 启用方式**。
> 图例：✅ 已按官方文档核实 · ⚠️ 按文档但未在该工具实测，靠前请先验证。

## 通用前提（所有工具）
- 装 **Node.js**：建议 22 或更高；18 也能用，但不能自动出标注（不圈选生成 PRD 后自动配对标注要用 Node.js 22 自带的 WebSocket）。用来跑机器闸、anno-server、auto-screenshot，零 npm 依赖。
- 可选 **pandoc**（PRD → docx）。
- 把本仓库放到你的工作区，或按下方各工具的技能目录放置。
- **临时文件放哪个盘（自动·不用配）**：检查工具会复制原型、开后台浏览器，产生临时文件。第一次运行时自动选“非系统盘里剩余空间最大的本地硬盘”，用 `<盘>:\proenga-temp`，并记进仓库根的 `.proenga-tmp`；只有系统盘的机器退回系统临时目录。**无论放哪，每个工具用完都会自动删**，崩了下次启动自动清。想换位置：改 `.proenga-tmp` 第一行（或设环境变量 `PROENGA_TMP`）。

---

## Claude Code ✅
- 技能：放 `~/.claude/skills/` 或项目 `.claude/skills/`，自动加载。
- 入口：项目根 `CLAUDE.md` 自动加载。
- **启用钩子（必做一步）**：把 `.claude/settings.json.example` 复制为 `.claude/settings.json`（已有就把其中 `hooks` 段合并进去），然后重启 Claude Code 或打开一次 `/hooks`。
  ```powershell
  Copy-Item .claude\settings.json.example .claude\settings.json
  ```
  没做这一步，下面这些**自动拦截全部不生效**：
  - 收工时自动跑交付闸（PRD 结构 / 字段防臆造 / 原型合规 等），红了不准说"完成"；
  - 改原型后自动做浏览器回归自检；
  - **需求清单**：收到消息先提醒记清单；清单里还有“本轮·待做”时不准收工。
- **需求清单登记（每个项目一次）**：原型目录下放一份 `原型改动清单.md`（模板 `skills/_shared/templates/原型改动清单.md`），把它的绝对路径写进 `.claude/ledgers.txt`（每行一个；本机专用，不进版本库）。规范见 [`skills/_shared/requirement-ledger.md`](skills/_shared/requirement-ledger.md)。没登记清单的项目，清单钩子静默不打扰。

## OpenClaw ✅（[文档](https://docs.openclaw.ai/tools/skills)）
- 技能：放任一被发现的根目录——`<workspace>/skills`、`<workspace>/.agents/skills`、`~/.agents/skills`、`~/.openclaw/skills`。OpenClaw 见 `SKILL.md` 即加载。
- 启用：`~/.openclaw/openclaw.json` 加 `"skills.entries.<技能名>": { "enabled": true }`（技能名取 `SKILL.md` 的 `name`）。
- 跑闸：手动 `node skills/pm-design/qa/deliver-gate.js`（OpenClaw 的 installPolicy 是装技能时的策略，非交付前跑闸）。

## Codex ⚠️
- 入口：项目根 `AGENTS.md`（Codex 自动读）——已提供。
- 技能内容通过 `AGENTS.md` 指向 `skills/` 引用；跑闸手动 `node skills/pm-design/qa/deliver-gate.js`。

## Cursor ⚠️
- 入口：项目根 `AGENTS.md`（Cursor 已支持）或 `.cursor/rules/*.mdc`。
- 跑闸：手动 `node skills/pm-design/qa/deliver-gate.js`。

## Hermes（Nous Research）⚠️（[文档](https://hermes-agent.nousresearch.com/docs)）
- 技能：放 `skills/`（默认加载）或 `optional-skills/`。入口也读 `AGENTS.md`。
- **⚠️ 限制**：Hermes 强制技能 `description ≤ 60 字符`。本仓库 `SKILL.md` 描述较长，**装到 Hermes 前需把每个 `SKILL.md` 的 description 裁到 ≤60 字**（其余工具无此限）。
- 跑闸：手动 `node skills/pm-design/qa/deliver-gate.js`。

---

## 装好后怎么验证"真生效"（任何工具通用）
1. 在工具里让 AI“画一个原型”→ 它**应先反问你"用哪套 UI 设计规范（A/B/C）"**（说明铁律已加载）。
2. 让 AI“写 PRD”→ 它**应先反问你"部署地区（CN/BR/…）"**。
3. 交付前 AI **应主动跑 `node skills/pm-design/qa/deliver-gate.js` 并贴出全绿**（不绿不交）。
4. 提一个改原型的要求 → AI **应先把它记进 `原型改动清单.md`（状态“本轮·待做”）再动手**；做完回复里应列出清单每条的状态。
   Claude Code 下还可以这样验机器拦截：在清单里手动加一行状态为“本轮·待做”的条目，让 AI 结束一轮 → 应被拦下并列出该条目。

4 条都出现 = 规则 + 闸已生效。**没出现** = 该工具没加载到规则（检查技能放置/启用；Claude Code 检查 `.claude/settings.json` 是否存在），别将就。

## 诚实边界
- **规则 + 机器闸**：跨工具一致（已通用）。
- **"自动跑闸 + 红了拦"**：仅 Claude Code 自动；其余工具靠 AGENTS.md 约定的"交付前手动跑"，请自觉。
- **需求清单**：规则（先记后做、收工前逐条对账）所有工具一样，写在 `AGENTS.md` 第 9 条；"没做完拦住收工"的机器拦截仅 Claude Code 有。
- **⚠️ 标注的工具**：按官方文档建，但我未在该工具本机实测——首次用请按上面 3 条自验。
