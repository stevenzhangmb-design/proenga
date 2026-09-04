# 安装指南 — 在各 AI 工具上安装本工具

> 本工具 = 一套 `skills/`（AgentSkills 标准 `SKILL.md`）+ 纯 Node 机器闸 + `AGENTS.md`/`CLAUDE.md` 入口。
> **核心（规则 + 机器闸）工具无关**；下面是各工具的**安装位置 + 启用方式**。
> 图例：✅ 已按官方文档核实 · ⚠️ 按文档但未在该工具实测，靠前请先验证。

## 通用前提（所有工具）
- 装 **Node.js 18+**（跑机器闸、anno-server、auto-screenshot；零 npm 依赖）。
- 可选 **pandoc**（PRD → docx）。
- 把本仓库放到你的工作区，或按下方各工具的技能目录放置。

---

## Claude Code ✅
- 技能：放 `~/.claude/skills/` 或项目 `.claude/skills/`，自动加载。
- 入口：项目根 `CLAUDE.md` 自动加载。
- **自动跑闸**：可配 settings.json hook，在交付时自动 `node skills/pm-design/qa/deliver-gate.js`（唯一支持自动拦截的工具）。

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
1. 在工具里让 AI「画一个原型」→ 它**应先反问你"用哪套 UI 设计规范（A/B/C）"**（说明铁律已加载）。
2. 让 AI「写 PRD」→ 它**应先反问你"部署地区（CN/BR/…）"**。
3. 交付前 AI **应主动跑 `node skills/pm-design/qa/deliver-gate.js` 并贴出全绿**（不绿不交）。
3 条都出现 = 规则 + 闸已生效。**没出现** = 该工具没加载到规则（检查技能放置/启用），别将就。

## 诚实边界
- **规则 + 机器闸**：跨工具一致（已通用）。
- **"自动跑闸 + 红了拦"**：仅 Claude Code 自动；其余工具靠 AGENTS.md 约定的"交付前手动跑"，请自觉。
- **⚠️ 标注的工具**：按官方文档建，但我未在该工具本机实测——首次用请按上面 3 条自验。
