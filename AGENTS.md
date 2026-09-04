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

5. **交付前必跑机器闸（最硬的一条）**：
   ```bash
   node skills/pm-design/qa/deliver-gate.js
   ```
   **全绿（退出码 0）才算"完成"；红了禁止说"完成/搞定/可以了"，先修。** 这 12 道闸覆盖：标注层回归、PRD 内容合规、PRD 结构合规（编号/层级/表格/禁词/日期一致）、**PRD↔原型字段一致（硬拦字段臆造）** 等。**自检是 AI 的活、不是用户的活**：主动跑、把全绿输出附给用户当证据，绝不等用户提醒"再检查一次"。

---

## ⚙️ 环境与运行

- **Node.js 18+**（跑 `skills/*/qa/*.js` 机器闸、`anno-server`、`auto-screenshot.js`——零 npm 依赖，只用 Node + 本机 Chrome/Edge）。
- **pandoc**（PRD `.md` → `.docx`，可选）。
- **anno-server**（`anno-server/server.js`，原型↔PRD 本地同步，端口 3799）。**优先用隐藏后台启动器**（无窗口、崩溃自动重启、防双开，客户不会误关窗口致同步断），按系统选：
  - **Windows**：`wscript "<anno-server>\start-anno-server.vbs"`（全隐藏）。
  - **macOS / Linux / 任意 OS**：`nohup node "<anno-server>/start-anno-server.js" >/dev/null 2>&1 &`（跨平台 node 监督器，零额外依赖）。
  - 两个启动器脚本都随 `anno-server/` 包发；实在没有才回退可见窗口 `node server.js`。检测是否在跑：`GET http://localhost:3799/anno-queue`。
- **原型图自动截图**：`node skills/pm-design/qa/auto-screenshot.js -Html <离线原型.html>`——不给 `-States` 时自动读原型内 `window.__ANNO_SHOT_MANIFEST__`（pm-design 生成原型时烤入），零配置。

## 🔌 跨工具说明（诚实标注）

- **规则 + 机器闸**：工具无关，任何工具一致（这是产品命脉、已通用）。
- **技能自动加载**：OpenClaw/Hermes 走 `SKILL.md`（AgentSkills）；Codex/Cursor 走本 `AGENTS.md`；Claude Code 走 `CLAUDE.md`。各工具安装位置见 `INSTALL.md`。
- **"交付前自动跑闸 + 红了自动拦"**：**仅 Claude Code 的 hook 支持自动**；**其他工具需在交付前手动跑 `node skills/pm-design/qa/deliver-gate.js`**——本契约第 5 条已要求，但属"约定"非"机器强制"，请自觉执行。
- **Hermes 专项**：Hermes 强制技能 `description ≤ 60 字`，本仓库描述较长，装到 Hermes 前需裁短（其余工具无此限）。
