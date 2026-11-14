# 安装指南

> 本工具是一套 skills/（标准 SKILL.md 技能）加纯 Node 机器闸，再加 AGENTS.md 和 CLAUDE.md 两个入口。规则和机器闸与 AI 工具无关，下面按工具写清楚怎么装。

## 安装

### 前置
- **Node.js**：必装，建议 22 或更高（18 也能用，但不圈选生成 PRD 后不能自动出标注）。
- **pandoc**：可选，只有要把 PRD 转成 Word 才装。

### 1. 安装 skills
```bash
# 下载工具包并进入文件夹（没有 git：在 GitHub 仓库网页点【Code】→【Download ZIP】，解压后进入该文件夹）
git clone https://github.com/stevenzhangmb-design/proenga.git
cd proenga
```

**Claude Code：** 用 Claude Code 打开 proenga 文件夹，技能和规则自动生效；再复制一份钩子配置，重启 Claude Code，收工检查和需求清单拦截才会生效。
```bash
# Mac / Linux：启用钩子
cp .claude/settings.json.example .claude/settings.json
```
```powershell
# Windows（PowerShell）：启用钩子
Copy-Item .claude\settings.json.example .claude\settings.json
```

**Cursor / Codex / GitHub Copilot：** 用它打开 proenga 文件夹即可，自动读取 AGENTS.md 和 .agents/skills。Copilot 在 VS Code 的 Copilot Chat 里用 Agent 模式。

**OpenClaw：** 把技能复制到全局技能目录，然后新开一个会话。
```bash
# Mac / Linux
mkdir -p ~/.agents/skills && cp -r skills/* ~/.agents/skills/
```
```powershell
# Windows（PowerShell）
New-Item -ItemType Directory -Force "$HOME\.agents\skills" | Out-Null; Copy-Item -Recurse -Force skills\* "$HOME\.agents\skills\"
```

**WorkBuddy：** 把技能复制到 WorkBuddy 的技能目录，然后重启 WorkBuddy。
```bash
# Mac / Linux
mkdir -p ~/.workbuddy/skills && cp -r skills/* ~/.workbuddy/skills/
```
```powershell
# Windows（PowerShell）
New-Item -ItemType Directory -Force "$HOME\.workbuddy\skills" | Out-Null; Copy-Item -Recurse -Force skills\* "$HOME\.workbuddy\skills\"
```

**想在所有项目里都能用（可选）：** Claude Code 复制到 ~/.claude/skills，Cursor / Codex / GitHub Copilot 复制到 ~/.agents/skills（与上面 OpenClaw 的命令相同）。
```bash
# Mac / Linux：Claude Code 全局安装
mkdir -p ~/.claude/skills && cp -r skills/* ~/.claude/skills/
```
```powershell
# Windows（PowerShell）：Claude Code 全局安装
New-Item -ItemType Directory -Force "$HOME\.claude\skills" | Out-Null; Copy-Item -Recurse -Force skills\* "$HOME\.claude\skills\"
```
全局安装时钩子不会自动生效，需要的话跟 AI 说：“把 proenga 里 .claude/settings.global.json.example 的钩子合并到我的 ~/.claude/settings.json。”。

### 2. 启动本地同步服务
```bash
# Mac / Linux：在 proenga 文件夹里后台启动（崩溃自动重启，已在运行就不重复启动）
nohup node anno-server/start-anno-server.js >/dev/null 2>&1 &
```
```powershell
# Windows（PowerShell）：在 proenga 文件夹里后台启动，不弹窗口（也可以直接双击 anno-server\start-anno-server.vbs）
wscript anno-server\start-anno-server.vbs
```
```bash
# Mac / Linux：等几秒后检查，能看到返回内容（如 []）就说明在运行
curl http://localhost:3799/anno-queue
```
```powershell
# Windows（PowerShell）：等几秒后检查，能看到返回内容（如 []）就说明在运行
curl.exe http://localhost:3799/anno-queue
```

### 3. 在你的 AI 工具里开工
```
画一个 XX 系统的原型            # → pm-design 弹四问 → 出可交互原型
（原型上圈选功能）→ 点【📋 复制已圈功能】→ 粘到对话框 → 生成 PRD
给 XX 模块生成 PRD             # → 不圈选直接生成，写完自动出原型标注
一键生成代码 / 导出对接料        # → dev-codegen 出料/出码
```

## 各工具从哪里读规则和技能

公开包里已经放好了各工具的技能入口（.claude/skills、.agents/skills、.codebuddy/skills 下每个技能一个 SKILL.md），入口文件只写技能名和用途，并指向 skills/ 下的完整规则。这些入口由发布脚本自动生成，不要手改。

| 工具 | 规则文件 | 技能目录 | 核实情况 |
|---|---|---|---|
| Claude Code | CLAUDE.md（其中用 @AGENTS.md 一并读入 AGENTS.md） | .claude/skills、~/.claude/skills | 官方文档；本机实测识别到 10 个技能，钩子生效 |
| Codex | AGENTS.md（上限 32KiB） | .agents/skills、~/.agents/skills | 官方文档；本机实测读到 AGENTS.md 和 10 个技能 |
| Cursor | AGENTS.md | .agents/skills、.cursor/skills、.claude/skills、~/.agents/skills | 官方文档；本机安装包里核对到这些目录，没开界面实测 |
| GitHub Copilot（VS Code） | AGENTS.md | .github/skills、.agents/skills、.claude/skills、~/.agents/skills、~/.copilot/skills | 官方文档；本机 VS Code 安装包里核对到这些目录，chat.useAgentSkills 和 chat.useAgentsMdFile 默认开启，没开界面实测 |
| OpenClaw | 自己工作区（默认 ~/.openclaw/workspace）里的 AGENTS.md | 工作区 skills、~/.agents/skills、~/.openclaw/skills | 官方文档；本机实测 openclaw skills list 识别到 10 个技能 |
| WorkBuddy | 打开的文件夹里的 AGENTS.md（同站 CodeBuddy 文档：没有 CODEBUDDY.md 时读 AGENTS.md） | ~/.workbuddy/skills；项目级 .codebuddy/skills | ~/.workbuddy/skills 来自 WorkBuddy 自带的技能安装说明；项目级目录和规则文件来自同站 CodeBuddy 文档，WorkBuddy 桌面版没实测 |

- **临时文件放哪个盘（自动·不用配）**：检查工具会复制原型、开后台浏览器，产生临时文件。第一次运行时自动选“非系统盘里剩余空间最大的本地硬盘”，用 `<盘>:\proenga-temp`，并记进仓库根的 `.proenga-tmp`；只有系统盘的机器退回系统临时目录。**无论放哪，每个工具用完都会自动删**，崩了下次启动自动清。想换位置：改 `.proenga-tmp` 第一行（或设环境变量 `PROENGA_TMP`）。

## Claude Code 补充

- 钩子配置在 .claude/settings.json.example，复制成 .claude/settings.json 后重启 Claude Code 才生效。已经有 settings.json 时，把其中的 hooks 段合并进去。
- 没启用钩子时，下面这些自动拦截都不生效：收工时自动跑交付闸；改原型后自动做浏览器回归自检；收到消息先提醒记清单，清单里还有“本轮·待做”时不准收工。
- **需求清单登记（每个项目一次）**：原型目录下放一份 `原型改动清单.md`（模板 `skills/_shared/templates/原型改动清单.md`），把它的绝对路径写进 `.claude/ledgers.txt`（每行一个；本机专用，不进版本库）。规范见 [`skills/_shared/requirement-ledger.md`](skills/_shared/requirement-ledger.md)。没登记清单的项目，清单钩子静默不打扰。

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

4 条都出现 = 规则 + 闸已生效。**没出现** = 该工具没加载到规则（检查技能放置/启用；Claude Code 检查 `.claude/settings.json` 是否存在），别将就。## 诚实边界
- **规则和机器闸**：所有工具一致。
- **自动跑闸并拦截**：只有 Claude Code 能自动做到；其余工具靠 AGENTS.md 约定交付前手动跑 node skills/pm-design/qa/deliver-gate.js。
- **需求清单**：规则所有工具一样，写在 AGENTS.md 第 9 条；没做完就拦住收工的机器拦截只有 Claude Code 有。
- 表里写着没实测的工具，第一次使用请按上面 4 条自己验证。
