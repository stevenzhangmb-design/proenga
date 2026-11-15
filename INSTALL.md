# 安装指南

> 本工具是一套 skills/（标准 SKILL.md 技能）加纯 Node 机器闸，再加 AGENTS.md 和 CLAUDE.md 两个入口。规则和机器闸与 AI 工具无关，下面按工具写清楚怎么装。

## 傻瓜版安装（推荐，不用敲命令）

下面以 Claude 为例，全程不用敲命令，照着点就行。

**第 1 步：装两个软件（只装一次）**
- **Node.js**：打开 nodejs.org，选 LTS 版本下载。
- 双击下载好的安装包，一路点下一步装完。
- Node.js 是 Proenga 的本地同步服务和检查工具要用的。
- **Claude 桌面版**：打开 claude.com/download，点【Download for Windows】下载并安装。
- 安装好后打开 Claude，登录你的账号。
- Claude Code 需要付费套餐，Pro、Max、Ultra、Team、Enterprise 都可以。
- 桌面版自带 Claude Code，不用为 Claude 另外装命令行工具。
- Windows 上不用装 Git。

**第 2 步：下载 Proenga**
- 打开 https://github.com/stevenzhangmb-design/proenga 。
- 点绿色的【Code】按钮，再点【Download ZIP】。
- 把下载的压缩包解压到好找的位置，比如 D 盘。
- 把解压出来的文件夹名改成 proenga。

**第 3 步：用 Claude 打开 proenga 文件夹**
- 打开 Claude，点侧边栏顶部的【Code】。
- 如果侧边栏只显示图标，把鼠标移上去就能看到名字。
- 在输入框下面那一行，点最左边的环境选择器，选【Local】分组里的第一项。
- 点旁边的项目文件夹按钮，选【Open folder…】。
- 选中刚才解压的 proenga 文件夹。

**第 4 步：对 Claude 说一句话**
- 在输入框里输入“帮我完成 Proenga 的安装”，然后发送。
- Claude 会自动按顺序做完这些事：检查 Node.js 和 pandoc，复制钩子配置，指定原型输出目录（可选），启动本地同步服务并检查，设开机自动启动，登记需求清单，跑检查验证。
- 中间它可能会问你原型放在哪个文件夹，照实回答就行。
- 最后它提醒你重启 Claude 时，把 Claude 关掉再打开。

**第 5 步：确认装好了**
- 重新打开 Claude 后，按第 3 步再打开 proenga 文件夹。
- 输入“检查 Proenga 装好了没有”，然后发送。

**开始用**
- 直接说要做的事，比如“帮我画一个会员管理的原型”。

**遇到问题**
- 把报错截图发给 Claude，说“帮我看看怎么回事”。

**Mac 用户**
- Node.js 和 Claude 的下载页都有 Mac 版，步骤一样。

### Cursor

**第 1 步：装 Cursor**
- 打开 cursor.com/downloads，下载 Windows 版并安装。
- 安装好后打开 Cursor，登录你的账号。
- Cursor 有免费套餐，但 Agent 的使用次数有限，用得多需要付费套餐。
- Mac 用户在同一个下载页下载 Mac 版，步骤一样。

**第 2 步：装 Node.js（只装一次）**
- 打开 nodejs.org，选 LTS 版本下载。
- 双击下载好的安装包，一路点下一步装完。
- 已经装过的跳过这一步。

**第 3 步：下载 Proenga**
- 打开 https://github.com/stevenzhangmb-design/proenga 。
- 点绿色的【Code】按钮，再点【Download ZIP】。
- 把下载的压缩包解压到好找的位置，比如 D 盘。
- 把解压出来的文件夹名改成 proenga。

**第 4 步：用 Cursor 打开 proenga 文件夹**
- 在 Cursor 顶部菜单点【File】，再点【Open Folder】。
- 选中刚才解压的 proenga 文件夹。

**第 5 步：对 Cursor 说一句话**
- 按 Ctrl + I 打开【Agent】面板。
- 在输入框里输入“帮我完成 Proenga 的安装”，然后发送。
- Cursor 会照 proenga 文件夹里的安装说明一步步做，比如检查 Node.js 和 pandoc，启动本地同步服务并检查。
- 中间它可能会问你原型放在哪个文件夹，照实回答就行。

**第 6 步：确认装好了**
- 在【Agent】面板里输入“检查 Proenga 装好了没有”，然后发送。

### Codex

**第 1 步：装 ChatGPT 桌面版（自带 Codex）**
- Codex 现在在 ChatGPT 桌面版里，装 ChatGPT 桌面版就行。
- 打开 learn.chatgpt.com/docs/windows/windows-app，点【Download the ChatGPT desktop app for Windows】，从 Microsoft Store 下载并安装。
- 安装好后打开 ChatGPT，用你的 ChatGPT 账号登录。
- 免费账号也能用 Codex，但额度有限；Plus、Pro 等付费套餐额度更多。
- Mac 用户打开 learn.chatgpt.com/docs/app 下载 Mac 版，步骤一样。

**第 2 步：装 Node.js（只装一次）**
- 打开 nodejs.org，选 LTS 版本下载。
- 双击下载好的安装包，一路点下一步装完。
- 已经装过的跳过这一步。

**第 3 步：下载 Proenga**
- 打开 https://github.com/stevenzhangmb-design/proenga 。
- 点绿色的【Code】按钮，再点【Download ZIP】。
- 把下载的压缩包解压到好找的位置，比如 D 盘。
- 把解压出来的文件夹名改成 proenga。

**第 4 步：用 Codex 打开 proenga 文件夹**
- 在 ChatGPT 桌面版里切到【Codex】。
- 点【Add new project】，或者按 Ctrl + O。
- 选中刚才解压的 proenga 文件夹。

**第 5 步：对 Codex 说一句话**
- 点【New chat】开一个新对话。
- 在输入框里输入“帮我完成 Proenga 的安装”，然后发送。
- Codex 会照 proenga 文件夹里的安装说明一步步做，比如检查 Node.js 和 pandoc，启动本地同步服务并检查。
- 中间它可能会问你原型放在哪个文件夹，照实回答就行。

**第 6 步：确认装好了**
- 在 proenga 项目里点【New chat】，输入“检查 Proenga 装好了没有”，然后发送。

### GitHub Copilot

**第 1 步：装 VS Code 并登录 GitHub Copilot**
- 打开 code.visualstudio.com/download，下载 Windows 版并安装。
- VS Code 要 1.116 或更高版本，新版已经自带 Copilot，不用另装扩展。
- 打开 VS Code，把鼠标移到底部状态栏的 Copilot 图标上，点【Use AI Features】。
- 按提示用 GitHub 账号登录，没有账号就按提示注册一个。
- 账号还没有 Copilot 套餐的，登录后会自动开通 Copilot Free，每月有免费额度，用得多需要付费套餐。
- Mac 用户在同一个下载页下载 Mac 版，步骤一样。

**第 2 步：装 Node.js（只装一次）**
- 打开 nodejs.org，选 LTS 版本下载。
- 双击下载好的安装包，一路点下一步装完。
- 已经装过的跳过这一步。

**第 3 步：下载 Proenga**
- 打开 https://github.com/stevenzhangmb-design/proenga 。
- 点绿色的【Code】按钮，再点【Download ZIP】。
- 把下载的压缩包解压到好找的位置，比如 D 盘。
- 把解压出来的文件夹名改成 proenga。

**第 4 步：用 VS Code 打开 proenga 文件夹**
- 在 VS Code 顶部菜单点【File】，再点【Open Folder】。
- 选中刚才解压的 proenga 文件夹。

**第 5 步：对 Copilot 说一句话**
- 按 Ctrl + Alt + I 打开 Chat 视图。
- 在输入框的 Agent 下拉框里选【Agent】。
- 在输入框里输入“帮我完成 Proenga 的安装”，然后发送。
- Copilot 要运行命令时会弹窗请你确认，点【Allow】（允许）。
- Copilot 会照 proenga 文件夹里的安装说明一步步做，比如检查 Node.js 和 pandoc，启动本地同步服务并检查。
- 中间它可能会问你原型放在哪个文件夹，照实回答就行。

**第 6 步：确认装好了**
- 在 Chat 视图里选【Agent】，输入“检查 Proenga 装好了没有”，然后发送。

### OpenClaw

**第 1 步：装 Node.js（只装一次）**
- 打开 nodejs.org，选 LTS 版本下载。
- 双击下载好的安装包，一路点下一步装完。
- OpenClaw 要求 Node.js 24.16 或更高版本，已经装过的确认版本够新。

**第 2 步：装 OpenClaw**
- 在开始菜单搜索“PowerShell”，打开【Windows PowerShell】。
- 粘贴下面这行官方安装命令，按回车：`iwr -useb https://openclaw.ai/install.ps1 | iex`
- 这种装法直接装在 Windows 上，不用装 WSL，能直接读写 D 盘的文件。
- 装完会进入设置向导，按提示选 AI 模型：已登录的 Claude Code 或 Codex，或者模型服务商的 API key。
- OpenClaw 是开源软件，本身不收费，用的 AI 模型按模型服务商收费。
- Mac 用户打开 github.com/openclaw/openclaw/releases 下载 .dmg 安装包，装好后打开 OpenClaw.app。

**第 3 步：下载 Proenga**
- 打开 https://github.com/stevenzhangmb-design/proenga 。
- 点绿色的【Code】按钮，再点【Download ZIP】。
- 把下载的压缩包解压到好找的位置，比如 D 盘。
- 把解压出来的文件夹名改成 proenga。

**第 4 步：让 OpenClaw 把技能复制过去**
- OpenClaw 不用打开文件夹。在 PowerShell 里输入 `openclaw dashboard`，按回车，浏览器会打开 OpenClaw 的对话页面。
- 在输入框里输入“帮我把 D:\proenga 文件夹里 skills 下的全部技能复制到 ~/.agents/skills”，然后发送。
- 话里的 D:\proenga 换成你解压的实际位置，~/.agents/skills 是 OpenClaw 的个人技能目录，照原样说就行。
- 复制完新开一个会话，技能才会生效。

**第 5 步：对 OpenClaw 说一句话**
- 在新会话里输入“帮我完成 Proenga 的安装，Proenga 在 D:\proenga 文件夹”，然后发送。
- OpenClaw 会照 proenga 文件夹里的安装说明一步步做，比如检查 Node.js 和 pandoc，启动本地同步服务并检查。
- 中间它可能会问你原型放在哪个文件夹，照实回答就行。

**第 6 步：确认装好了**
- 新开一个会话，输入“检查 Proenga 装好了没有，Proenga 在 D:\proenga 文件夹”，然后发送。

### WorkBuddy

**第 1 步：装 WorkBuddy**
- 打开 workbuddy.cn，点【立即下载】，选 Windows 版安装包。
- 双击安装包，按向导一路点下一步，最后点【安装】，装完点【完成】。
- 打开 WorkBuddy，点【登录】，用微信扫码登录，也可以用手机号或邮箱登录。
- WorkBuddy 有免费版，额度有限，用得多需要付费套餐，以 workbuddy.cn/pricing 为准。
- Mac 用户在同一个下载页下载 Mac 版，步骤一样。

**第 2 步：装 Node.js（只装一次）**
- 打开 nodejs.org，选 LTS 版本下载。
- 双击下载好的安装包，一路点下一步装完。
- 已经装过的跳过这一步。

**第 3 步：下载 Proenga**
- 打开 https://github.com/stevenzhangmb-design/proenga 。
- 点绿色的【Code】按钮，再点【Download ZIP】。
- 把下载的压缩包解压到好找的位置，比如 D 盘。
- 把解压出来的文件夹名改成 proenga。

**第 4 步：用 WorkBuddy 打开 proenga 文件夹**
- 新建任务时，点输入框左下角的【选择工作空间】。
- 选中刚才解压的 proenga 文件夹。
- 第一次打开时会弹出信任提示，选【正常打开】。选受限模式的话，技能不会加载。
- proenga 文件夹里已经带好 WorkBuddy 的技能目录（.codebuddy/skills），打开文件夹就能用，不用复制。

**第 5 步：对 WorkBuddy 说一句话**
- 在输入框里输入“帮我完成 Proenga 的安装”，然后发送。
- WorkBuddy 会照 proenga 文件夹里的安装说明一步步做，比如检查 Node.js 和 pandoc，启动本地同步服务并检查。
- 中间它可能会问你原型放在哪个文件夹，照实回答就行。

**第 6 步：确认装好了**
- 新建一个任务，选 proenga 文件夹作为工作空间，输入“检查 Proenga 装好了没有”，然后发送。

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

**Cursor / Codex / GitHub Copilot：** 用它打开 proenga 文件夹即可，自动读取 AGENTS.md 和技能目录（Cursor、Codex 读 .agents/skills，Copilot 读 .github/skills）。Copilot 在 VS Code 的 Chat 里用 Agent 模式，VS Code 要 1.116 或更高版本，不用另装扩展。

**OpenClaw：** 把技能复制到全局技能目录，然后新开一个会话。
```bash
# Mac / Linux
mkdir -p ~/.agents/skills && cp -r skills/* ~/.agents/skills/
```
```powershell
# Windows（PowerShell）
New-Item -ItemType Directory -Force "$HOME\.agents\skills" | Out-Null; Copy-Item -Recurse -Force skills\* "$HOME\.agents\skills\"
```

**WorkBuddy：** 用 WorkBuddy 打开 proenga 文件夹即可，首次打开弹出信任提示时选【正常打开】；技能在包里的 .codebuddy/skills，自动读取，不用复制。

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

公开包里已经放好了各工具的技能入口（.claude/skills、.agents/skills、.github/skills、.codebuddy/skills 下每个技能一个 SKILL.md），入口文件只写技能名和用途，并指向 skills/ 下的完整规则。这些入口由发布脚本自动生成，不要手改。

| 工具 | 规则文件 | 技能目录 | 核实情况 |
|---|---|---|---|
| Claude Code | CLAUDE.md（其中用 @AGENTS.md 一并读入 AGENTS.md） | .claude/skills、~/.claude/skills | 官方文档；本机实测识别到 10 个技能，钩子生效 |
| Codex | AGENTS.md（上限 32KiB） | .agents/skills、~/.agents/skills | 官方文档；本机实测读到 AGENTS.md 和 10 个技能 |
| Cursor | AGENTS.md | .agents/skills、.cursor/skills、.claude/skills、~/.agents/skills | 官方文档；本机安装包里核对到这些目录，没开界面实测 |
| GitHub Copilot（VS Code） | AGENTS.md | .github/skills、.agents/skills、.claude/skills、~/.agents/skills、~/.copilot/skills | 官方文档；本机 VS Code 安装包里核对到这些目录，chat.useAgentSkills 和 chat.useAgentsMdFile 默认开启，没开界面实测 |
| OpenClaw | 自己工作区（默认 ~/.openclaw/workspace）里的 AGENTS.md | 工作区 skills、~/.agents/skills、~/.openclaw/skills | 官方文档；本机实测 openclaw skills list 识别到 10 个技能 |
| WorkBuddy | 打开的文件夹里的 AGENTS.md（官方文档：与 CODEBUDDY.md、AGENTS.md 兼容） | 项目级 .codebuddy/skills | WorkBuddy 官方文档（workbuddy.cn 项目配置页）写明读项目里的 .codebuddy/skills；首次打开要选【正常打开】，受限模式不加载技能；WorkBuddy 桌面版没实测 |

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
