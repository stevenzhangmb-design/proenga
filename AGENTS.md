# AGENTS.md — AI 原型 + PRD 协作工具（跨工具通用入口）

> 本文件是**工具无关**的 Agent 操作契约。**Codex / Cursor / Hermes / OpenCode 等读 `AGENTS.md` 的 AI 工具**从这里入口；Claude Code 走同目录 `CLAUDE.md`（内容等价）。规则与机器闸是纯 markdown + 纯 Node，**任何工具读到/跑到，效果一致**。

本工具帮 PM 把「画原型」与「写 PRD」一体化，并用**机器闸**保证交付质量。技能（`skills/` 下，均为 [AgentSkills 标准](https://agentskills.io) 的 `SKILL.md`，OpenClaw/Hermes/Claude Code 等原生加载）：

| 技能 | 用途 |
|---|---|
| `skills/pm-design` | 画可点击 HTML 原型（标注层 + 设计规范 + 自动截图） |
| `skills/prd` | 写 PRD（固定 4 章 / 字段规范 5 列 / 用例规则 7 节 / 操作日志 3 列…） |
| `skills/tech-design`·`test-case`·`dev-prompts`·`user-manual`·`product-pitch`·`verify-prototype` | 技术设计 / 测试用例 / 研发提示词 / 操作手册 / 售前方案 / 原型验证 |

---

## 🏛 不可违反的铁律（任何工具、任何模型都必须遵守）

**真理源是 `skills/prd/_rules/*.mdc` 原文**——下面是摘要，细则一律以原文为准、**现读不靠记忆**。

1. **根本界定（业务/格式分工）**：**业务内容**（字段名/值/必填/校验/枚举/流程）一律以**原型**为准、禁臆造；**要求和格式**一律按 **prd skill 铁律**、不简化不自创。说什么听原型，怎么写听规则。见 `skills/prd/_rules/prd-post-generation-deepcheck.mdc §〇`。

2. **画原型前必先问用户**：用哪套 UI 设计规范？**A 默认**（`skills/pm-design/system-design-spec.md`）/ **B 用户提供**（截图·网址·UI 设计文档·设计稿·文字）/ **C 学过的** `learned-specs/`。**禁擅自套默认开画**。见 `skills/pm-design/SKILL.md §视觉规范来源`。

3. **写 PRD 前必先问用户**：部署地区/时区（CN=YYYY-MM-DD / BR=DD/MM/YYYY / US=…）——决定日期格式、币种、语言。**不问就默认 = 违规**。见 `prd-template-structure.mdc §3.1.5`。

4. **生成后强制深检**：任何 PRD/原型生成或更新后，交付前必 ⑴ 全量通读规则原文 ⑵ 逐功能点对照每条规则全量深检、**细到标点、严禁抽检** ⑶ 机器闸全绿 ⑷ 判断类逐条人工核、不擅自主张。见 `skills/prd/_rules/prd-post-generation-deepcheck.mdc`。

   - **PRD 的 md 和 Word 始终一致（随包·任何工具）**：用户在本地只改了 Word → 把 Word 的改动同步进 md，不动 Word；只改了 md → 用 md 重新生成 Word；在 AI 对话里让改 PRD → md 和 Word 同一轮一起改完（只改 md 不算做完）；两边都改过 → 合并，同一处不同时列原文问用户。动 PRD 前先跑 `node skills/prd/qa/docx-guard.js status <docx> <md>`（0=都没改、10=只改了 md、3=只改了 Word、4=都改了），差异用 `diff` 逐段列出；生成 Word 一律用 `skills/pm-design/make-doc.ps1`（用户改过 Word 时自动拦截、不覆盖）。细则见 `skills/prd/SKILL.md`“Word 优先铁律”。
   - **写法和版式规则的适用范围**：中文书面用语、【】和“”、句末用句号、一段一件事的分段、无编号段落首行缩进 2 个字、Word 版式、md 和 Word 一致、字段规范无字段写“无。”、提示语写成 提示：“提示原文。”。（引号后用句号，后半句补主语单独成句；Word 里提示语深蓝加粗，由转换过滤器自动处理）——不管是谁使用、不管是否按标准 PRD 模板撰写，还是用户在对话框里按个人要求增加的文字，统一遵守。不按模板的文档由 `make-doc.ps1` 自动跑 `prd-structure-lint.js --writing-only` 检查。细则见 `skills/prd/SKILL.md`“适用范围铁律”。

5. **交付前必跑机器闸（最硬的一条）**：
   ```bash
   node skills/pm-design/qa/deliver-gate.js
   ```
   **全绿（退出码 0）才算"完成"；红了禁止说"完成/搞定/可以了"，先修。** 这 12 道闸覆盖：标注层回归、PRD 内容合规、PRD 结构合规（编号/层级/表格/禁词/日期一致）、**PRD↔原型字段一致（硬拦字段臆造）** 等。**自检是 AI 的活、不是用户的活**：主动跑、把全绿输出附给用户当证据，绝不等用户提醒"再检查一次"。

6. **先研究后建议、先深查后告诉、已定规则优先（工作底线）**：
   - **先研究后建议**：给用户任何决策建议前，先研究三样：竞品和行业标准系统怎么做、本系统现状、行业规范和法规原文。建议里写明依据和证据等级（实测 / 官方原文 / 厂商文档 / 第三方转述 / 没找到）；研究不够就说“还不能建议，缺……”。
   - **先深查后告诉**：告诉用户任何结论前，先用能直接证明的手段查，比如查窗口和进程、在交付件里点开截图、读原文和需求清单里的历史决定、抽查子任务报告。不凭锁定文件、文件名、记忆或子任务的说法下结论；没查完只说“还没查清，正在查”；说错了第一句更正。
   - **已定规则优先**：给建议前，先把用户定过的相关规则找全，推演建议落地后各类单据、各种状态会不会自相矛盾。建议不能给已定规则加条件、减条件或推翻；外部资料和已定规则冲突时，只把冲突和后果摆出来请用户定。
   - 细则见 `skills/pm-design/SKILL.md` 的“先研究后建议铁律”“先深查后告诉铁律”两节。

7. **【铁律】推到 GitHub 的文字只写通用能力**：推送到 GitHub 的提交说明、CHANGELOG、README，以及公开工具包里的所有文字，不许带具体项目的系统名称和业务功能名称，只写工具包提供的通用能力。发布工具包时，发布脚本会检查提交说明和 CHANGELOG、README、INSTALL 等说明文字的新增内容，发现项目业务词就拒绝发布（硬拦，不是提示），改成通用说法后再发。推送用户自己的原型只读版或 PRD 网页时，提交说明同样只写通用说法（例如“更新原型只读版 2026-11-20”）；页面正文是用户自己的文档，不在此限。
   - 正确：“表格单元格支持第二行说明”“弹窗字段支持条件必填”“表格行名支持多语言映射”“弹窗按钮带确认框时先校验字段”。
   - 错误：“××单类型下面加第二行”“作废××单保留原记录”“××页待上传张数”“三语行名”（带了某个具体项目的单据名、页面名、功能名，或只有那个项目才看得懂的简称）。

8. **【铁律】原型必须遵守 PRD 字段规范、用例规则模版**：生成原型和改原型都不能跳过：每个输入项的字段名、控件类型、是否必填（星号）、默认值或占位、校验规则、填错提示，都要和 PRD 字段规范模版、用例规则模版一致，多语言原型中英葡对照。模版原文以 `skills/prd/references/templates/prd-template-clean.md`（字段规范五列、用例规则提示消息三列）和 `skills/prd/references/templates/prompt-template-common.md` 为准，先读再写。
   - 占位：输入框写“请输入 + 字段名”，下拉框写“请选择 + 字段名”，用例子当占位的保留例子（见 `skills/pm-design/system-design-spec.md` §7.6）；字段没写占位时骨架自动拼上字段名，三种语言分别是“请输入{字段名} / Enter {字段名} / Informe {字段名}”“请选择{字段名} / Select {字段名} / Selecione {字段名}”。
   - 必填：PRD 写“是”的字段，原型必须有星号（`required:true`，条件必填用 `requiredWhen`）；PRD 写“否”的字段不许有星号。
   - 填错提示：用户语言短句，没填写“请输入XX”“请选择XX”“请上传XX”，填错写“格式不正确”“最多 N 个字符”“须大于 N”等，和 PRD 提示消息表一字不差。
   - 正确：原型 `{ "label":"客户名称", "type":"input", "required":true, "ph":"请输入客户名称" }`，PRD 字段规范“客户名称｜文本｜是｜请输入客户名称｜最多 50 个字符”，提示消息“客户名称｜请输入客户名称｜最多 50 个字符”。
   - 错误：原型 `{ "label":"客户名称", "ph":"请输入" }`（占位没带字段名）；PRD 写必填，原型没有星号；PRD 没填提示写“请输入客户名称”，原型 `reqMsg` 写“客户名称不能为空”。
   - 机器兜底：交付件自检 `skills/pm-design/qa/deliverable-verify-gate.js` 内含两项检查，`rebuild-deliverable.ps1` 全量重建和快速模式的后台报告都会跑：`skills/pm-design/qa/proto-copy-writing-gate.js`（占位只写“请输入”“请选择”=红）、`skills/prd/qa/prd-prototype-field-gate.js`（字段名、必填、占位、没填提示和配对的 PRD 不一致=红）。交付总闸 `deliver-gate.js` 也调用这两项。红了不许说“做完了”，交付件自检全绿（快速模式看报告第一行是 PASS）才能说完成。

---

## ⚙️ 环境与运行

- **Node.js 18+**（跑 `skills/*/qa/*.js` 机器闸、`anno-server`、`auto-screenshot.js`——零 npm 依赖，只用 Node + 本机 Chrome/Edge）。
- **pandoc**（PRD `.md` → `.docx`，可选）。
- **anno-server**（`anno-server/server.js`，原型↔PRD 本地同步，端口 3799）。**优先用隐藏后台启动器**（无窗口、崩溃自动重启、防双开，客户不会误关窗口致同步断），按系统选：
  - **Windows**：`wscript "<anno-server>\start-anno-server.vbs"`（全隐藏）。
  - **macOS / Linux / 任意 OS**：`nohup node "<anno-server>/start-anno-server.js" >/dev/null 2>&1 &`（跨平台 node 监督器，零额外依赖）。
  - 两个启动器脚本都随 `anno-server/` 包发；实在没有才回退可见窗口 `node server.js`。检测是否在跑：`GET http://localhost:3799/anno-queue`。
  - **停止同步服务的正确方法**：先停守护进程，再停 node，最后确认端口已释放。只结束 node 不行：Windows 的 `start-anno-server.vbs` 会在 3 秒后把它重新拉起，`start-anno-server.js` 不到 1 秒就会拉起。只停本 proenga 文件夹里的进程，别的文件夹的同步服务不要动。
    - **Windows**（在 proenga 文件夹里运行 PowerShell）：
      ```powershell
      $dir = (Join-Path (Get-Location).ProviderPath 'anno-server\').ToLower()
      $all = @(Get-CimInstance Win32_Process)
      $svc = @($all | Where-Object { $_.CommandLine -and $_.CommandLine.ToLower().Replace('/','\').Contains($dir) })
      # 守护进程：wscript（start-anno-server.vbs）或 node（start-anno-server.js）；用相对路径启动的从子进程往上找
      $guard = @($all | Where-Object { (($svc.ProcessId -contains $_.ProcessId) -or ($svc.ParentProcessId -contains $_.ProcessId)) -and $_.CommandLine -match 'start-anno-server' })
      $guard | ForEach-Object { Stop-Process -Id $_.ProcessId -Force }                     # 1. 先停守护进程
      $svc | Where-Object { $guard.ProcessId -notcontains $_.ProcessId } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }   # 2. 再停 node
      Start-Sleep 2; try { Invoke-WebRequest http://localhost:3799/anno-queue -TimeoutSec 2 -UseBasicParsing | Out-Null; '还在运行' } catch { '已停止，端口已释放' }   # 3. 确认
      ```
    - **macOS / Linux**（在 proenga 文件夹里运行）：`d="$(pwd -P)/anno-server/"; pkill -f "${d}start-anno-server.js"; sleep 1; pkill -f "${d}server.js"; sleep 1; curl -s http://localhost:3799/anno-queue >/dev/null && echo 还在运行 || echo 已停止`。
    - 停完要恢复时，按上面的隐藏启动器重新启动，并复验 `http://localhost:3799/anno-queue` 能通。更新 Proenga 时不用手动停，更新脚本会自己停、自己重启。
- **原型图自动截图**：`node skills/pm-design/qa/auto-screenshot.js -Html <离线原型.html>`——不给 `-States` 时自动读原型内 `window.__ANNO_SHOT_MANIFEST__`（pm-design 生成原型时烤入），零配置。

## 🔄 更新 Proenga（任何工具通用）

用户说“更新 Proenga”“帮我更新 Proenga”“升级 Proenga”时，运行更新脚本；说“检查 Proenga 有没有新版”“Proenga 是不是最新版”时，加 `-Check` 只检查。脚本在 proenga 文件夹根目录，不需要管理员权限：

| 系统 | 只检查 | 更新到最新版 |
|---|---|---|
| Windows | `powershell -ExecutionPolicy Bypass -File .\update-proenga.ps1 -Check` | `powershell -ExecutionPolicy Bypass -File .\update-proenga.ps1` |
| macOS / Linux | `bash update-proenga.sh -Check` | `bash update-proenga.sh` |

- 在 proenga 文件夹里运行。当前文件夹不是 proenga（比如 OpenClaw 或全局安装只复制了技能）时，先问用户 proenga 文件夹在哪里，再用完整路径运行。
- 更新可能要几分钟（要下载、备份整个文件夹），命令超时设长一点（至少 10 分钟），不要中途打断。
- 脚本自己会：判断是不是已是最新版；停掉并重启同步服务；ZIP 下载的先完整备份到同级的“proenga-备份-日期时间”文件夹，再按清单替换工具包文件，用户自己的文件（archive、anno-server/anno-config.json、.claude/settings.json、.claude/ledgers.txt、.mcp.json、自己学的规范等）一个不碰；git 下载的走 git pull；做过全局安装的（~/.agents/skills、~/.claude/skills）一起换成新版；出错自动还原。
- 运行完，把脚本输出的要点用白话转述给用户：从哪个版本更新到哪个版本、更新了什么、备份在哪里、同步服务是否正常、下一步要不要重开 AI 工具。不要只说“更新好了”。
- 退出码 2 表示需要用户先处理（例如 git 下载的文件夹里改过工具包文件）：把脚本的提示原样转述，问用户要撤销还是保留这些改动，用户说了再处理；不要自己 `git stash`、`git reset`、`git checkout` 或强行覆盖。
- 退出码 1 表示没更新成功：转述原因（网络不通、下载不完整等），现有文件没被改动或已自动还原。不要自己手动下载 ZIP 覆盖文件夹，也不要删除备份文件夹。
- 输出里提到 `.claude/settings.json.new` 或其它 `.new` 文件时，说明用户改过原文件；问用户后，帮他把新版里的内容合并进原文件。

## 🔌 跨工具说明（诚实标注）

- **规则 + 机器闸**：工具无关，任何工具一致（这是产品命脉、已通用）。
- **技能自动加载**：OpenClaw/Hermes 走 `SKILL.md`（AgentSkills）；Codex/Cursor 走本 `AGENTS.md`；Claude Code 走 `CLAUDE.md`。各工具安装位置见 `INSTALL.md`。
- **"交付前自动跑闸 + 红了自动拦"**：**仅 Claude Code 的 hook 支持自动**；**其他工具需在交付前手动跑 `node skills/pm-design/qa/deliver-gate.js`**——本契约第 5 条已要求，但属"约定"非"机器强制"，请自觉执行。
- **Hermes 专项**：Hermes 强制技能 `description ≤ 60 字`，本仓库描述较长，装到 Hermes 前需裁短（其余工具无此限）。
