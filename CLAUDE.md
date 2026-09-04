# AI 原型 + PRD 协作工具

> **版本：v1.0.0**　发布日期：2026-06-19　维护者：[作者主页](https://github.com/)
> 如需更新，请在项目目录执行 `git pull` 获取最新铁律与组件。

## 首次使用 — 环境检测

> **每次新用户打开这个项目时，AI 必须自动执行以下检测，并在对话框里提示结果。**
> 检测与 AI 工具无关（OpenClaw / Cursor / Claude Code / Codex 均适用）。

请立即运行以下检测，用中文告诉用户哪些已就绪、哪些需要安装：

```powershell
# 检测 Node.js（运行 anno-server 必须）
node --version

# 检测 pandoc（生成 Word 文档必须；不要 Word 可跳过）
pandoc --version

# 检测本地 PRD 同步服务是否在运行
try { Invoke-WebRequest -Uri http://localhost:3799/anno-queue -TimeoutSec 2 -UseBasicParsing | Out-Null; Write-Host "PRD服务: 运行中" } catch { Write-Host "PRD服务: 未启动" }
```

检测后按以下格式告知用户，并**自动执行缺失项**：

```
✅ Node.js 已安装（vXX.X.X）
✅ pandoc 已安装 / ❌ 未安装 → 告诉我"帮我装 pandoc"，AI 会引导你完成安装
✅ PRD 同步服务运行中 / ❌ 未启动 → 【AI 自动尝试启动，见下方规则】
```

**anno-server 自动启动规则（AI 强制执行）**：
检测到 anno-server 未启动时，AI 按以下顺序搜索 `server.js`（**无需询问用户**）：

```powershell
# 搜索顺序（依次尝试）
$candidates = @(
  (Join-Path (Split-Path $PWD -Parent) 'anno-server\server.js'),   # 1. ai-rules 同级
  (Join-Path $PWD 'anno-server\server.js'),                         # 2. 当前目录子级
  (Join-Path $HOME 'anno-server\server.js'),                        # 3. 用户主目录
  'D:\AI\anno-server\server.js'                                     # 4. 历史默认路径
)
$found = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
```

- **找到** → **优先隐藏后台启动**（无窗口、崩溃自动重启、防双开；客户不会误关窗口致同步断），**按系统选**（`$dir` = `Split-Path $found`）：
  - **Windows**：有 `$dir\start-anno-server.vbs` → `Start-Process wscript.exe -ArgumentList "`"$dir\start-anno-server.vbs`""`（最干净·全隐藏）；否则 → `Start-Process node -ArgumentList 'start-anno-server.js' -WorkingDirectory $dir -WindowStyle Hidden`
  - **macOS / Linux**：`nohup node "$dir/start-anno-server.js" >/dev/null 2>&1 &`
  - 两个启动器脚本都不存在才回退**可见窗口**：`Start-Process powershell -ArgumentList '-NoExit','-Command',"cd '$dir'; node server.js"`
  等 ~6 秒重新检测，提示「PRD 同步服务已在**后台**启动 ✅（无需保持任何窗口）」
  > `start-anno-server.js` 是跨平台 node 监督器（任何 OS 通用、零额外依赖）；`start-anno-server.vbs` 是 Windows 全隐藏版。二者都随 `anno-server/` 包发。
- **找不到** → 提示用户：「请告诉我 anno-server 目录的位置」，用户回答后记住路径并启动；**以后不再询问**（记住即可）

> 客户无需手动敲命令、也无需盯着黑窗口——AI 检测到缺失项会自动用隐藏启动器在后台拉起，崩了自动重启；Windows / mac / Linux 都覆盖。

> **彻底无感知（推荐一次性配置·随包通用）**：让用户跑一次 `anno-server/setup-autostart.ps1`（相对路径 `$PSScriptRoot`·无写死盘符·任意机器/任意安装位置通用），把隐藏启动器加入 Windows 启动文件夹 → **以后每次开机 anno-server 自动在后台启动**，用户在原型上点「导出分享版」等再也见不到"需先启动 anno-server（localhost:3799）"。AI 检测到未配置开机启动、或用户说「配置自动启动 / 让它开机自启」时，直接运行该脚本即可（Windows）。

> **【AI 铁律·anno-server 起停纪律】（2026-07-03 事故根治·强制执行）**
> 1. 启动/重启 anno-server **一律走隐藏启动器**（Windows：`wscript start-anno-server.vbs`；跨平台：`node start-anno-server.js` 监督器）——**绝不裸跑 `node server.js`**。裸跑无监督，退出/被杀不会自愈；vbs 有 relaunch 循环、`start-anno-server.js` 有崩溃 respawn，且端口忙自动防双开。
> 2. **改过 `server.js` / `anno-config.json` 需重启时**：① 停掉旧实例 → ② **走监督器重启**（非裸 `Start-Process node`）→ ③ **立刻复验 `http://localhost:3799/anno-queue` 通**，不留空档。
> 3. **禁"反复裸杀裸起"**：同一轮多处改动合并成一次重启；重启后没验证通之前，不告诉用户"服务已就绪"。
> 4. 三层保险联动：①开机自启（setup-autostart.ps1）②监督器崩溃自重启 ③AI 检测未起自动拉起——正常用户永远碰不到"需先启动 anno-server"。
> 根因：反复裸杀裸起 + 无开机自启 → 用户点【导出分享版】时服务恰好没起、报 `导出失败：需先启动 anno-server`。

---

## 安装清单（新用户必看）

> AI 工具（OpenClaw / Cursor / Claude Code / Codex 等）你已经有了，不用再装。
> 只需补装下面两样工具，装一次永久有效。

### 一次性安装（只需装一次）

| 工具 | 用途 | 安装方式 |
|---|---|---|
| **Node.js 18+** | 运行 anno-server（原型↔PRD 自动同步） | 告诉 AI「帮我装 Node.js」，或去 nodejs.org 下载 LTS |
| **pandoc** | 把 PRD `.md` 转成 Word `.docx` | 告诉 AI「帮我装 pandoc」，或去 pandoc.org 下载 |

### 每次使用前启动（不需要安装，直接让 AI 帮你运行）

| 操作 | 说什么 | 说明 |
|---|---|---|
| **启动 PRD 同步服务** | 「帮我启动 anno-server」 | AI 自动找到目录并用**隐藏后台启动器**（`start-anno-server.vbs`）拉起：**无黑窗口、崩溃自动重启、防双开**，无需保持任何窗口。也可双击 `anno-server\start-anno-server.vbs` 自行启动。 |

---

## 项目结构

```
<你的工作目录>/
├── ai-rules/          ← 本项目（AI 工作目录，含 CLAUDE.md）
│   ├── skills/        ← AI 技能定义（pm-design 等）
│   └── CLAUDE.md      ← 本文件
├── archive/           ← 原型 HTML 文件（用浏览器打开）
│   └── 原型-xxx.html
└── anno-server/       ← PRD 本地同步服务
    ├── server.js      ← 启动：node server.js
    └── anno-queue.json← 原型操作队列（自动生成）
```

> AI 会根据实际项目位置自动推断路径，无需手动配置。

---

## 日常使用流程

> **两种模式可自由混用、随时切换，互不干扰。anno-server 必须运行中（端口 3799）才能实现本地自动生成。**

### 模式一：AI 对话框驱动（场景①）
1. 确认 anno-server 正在运行（见上方「每次使用前启动」）
2. 打开原型 HTML（浏览器）
3. 在对话框说：「为充值管理的充值功能生成 PRD 标注」
4. AI 生成字段规范 + 用例规则 → `POST http://localhost:3799/anno-inject`
5. anno-server 自动：写 `prd-data.json` → 生成 `PRD-*.md` + `.docx` → 广播 SSE
6. 浏览器中打开的原型实时收到 SSE → 自动创建/更新标注 PIN，**无需刷新页面**

### 模式二：原型内操作（场景②，可视化）
1. 打开原型 HTML，右上角开启「标注」开关
2. **右键**单击功能按钮/元素 → 弹气泡「是否为 XX 添加 PRD 标注？」→ 点「确定添加」
   （或右键单击区域空白 → 进画框模式 → 左键拖拽框选区域 → 松开弹气泡）
3. 系统自动预生成字段规范 + 用例规则（AI 草稿，可在弹窗里编辑）
4. 点开标注号可查看/编辑内容
5. 点顶部「生成研发PRD」按钮（或每个标注号里的「生成研发PRD」）
6. anno-server 自动：写 `prd-data.json` → 生成 `PRD-*.md` + `.docx` → 回写原型 HTML

### 分享给客户（预览模式）
- 分享链接末尾加 `?preview=1`，例如：`file:///<你的archive目录>/原型-xxx.html?preview=1`
- 预览模式下：只能开/关标注开关查看标注内容，**不能编辑、不能生成 PRD、不能新增标注**

---

## PRD 自动生成机制（强制，anno-server 运行时完全自动）

> **anno-server 运行时，PRD 文件生成完全自动，AI 无需介入文件操作。**
> 两条通道均由 anno-server 统一处理，输出结果完全等价。

### 通道②：原型操作 → 自动生成
```
用户在原型操作（右键标注 + 点「生成研发PRD」）
  → POST /anno-update → anno-server
  → ① prd-data.json 更新（_draft_fieldSpecs / _draft_useCaseRules）
  → ② PRD-*.md 生成（§1-§4.3 基于真实产品数据，§4.4 标注内容）
  → ③ PRD-*.docx 生成（pandoc，不可用时静默跳过）
  → ④ 原型 HTML window.__PRD_DATA__ 回写
```

### 通道①：AI 对话框 → 自动生成 + 原型同步
```
用户在对话框说「给 X 功能加标注」→ AI 生成内容
  → POST /anno-inject { systemName, pins:[{fpKey, title, fieldSpecs, useCaseRules}] }   ★ systemName（驼峰）= 原型 window.__PRD_DATA__.system_name；**必带**，否则 anno-server 落成默认名「产品需求文档」、PRD 绑不到本产品
  → anno-server（同上四步）
  → SSE broadcast inject-pins → 原型 JS window._annoInjectPins(pins)
  → 原型实时创建/更新 PIN（无需刷新）
```

### anno-server 未运行时的降级行为
- **通道②**：原型自动复制 AI 指令到剪贴板，用户手动粘贴给 AI，AI 按旧三步流程执行
- **通道①**：AI 提示用户启动 anno-server，不静默失败

### anno-server 未运行时 AI 执行旧三步流程（降级模式）
仅当 anno-server 未启动、且用户要求直接改 PRD 文件时，AI 才需要手动执行以下三步：

1. **更新 `prd-data.json`**：找到对应功能点条目，更新 `_draft_fieldSpecs` / `_draft_useCaseRules` 字段
2. **生成 PRD `.md` 文件**：`archive/PRD-<产品名>.md`，§1-§4.3 基于 prd-data 真实数据，§4.4 功能点明细
3. **回写原型 HTML `window.__PRD_DATA__`**：用大括号计数法定位 JSON 边界后替换

完成后告知用户：
```
✅ prd-data.json 已更新
✅ PRD-*.md 已生成（archive 目录）
✅ 原型 window.__PRD_DATA__ 已回写 → 刷新浏览器可看到最新标注
```

### 用户编辑内容必须优先（铁律）
- 用户在标注弹窗里编辑了字段规范/用例规则（`isAIDraft = false`）后点「生成研发PRD」
- anno-server 必须以最新编辑内容为准写入 PRD，绝不被旧结构化数据覆盖
- `_draft_fieldSpecs` / `_draft_useCaseRules` 始终反映用户最新内容，在 PRD.md 里优先展示

---

## AI 批量优化标注（anno-ai-queue 队列机制）

> **说明**：原型右键标注后，系统自动将区域上下文（zoneId/zoneTexts/zoneHTML）推入本地队列（`anno-server/anno-ai-regen-queue.json`），AI 可批量读取队列、重新生成符合 7 节规范的高质量 PRD 标注，并通过 `/anno-inject` 接口实时推送到原型。

### 队列端点
| 端点 | 方法 | 说明 |
|---|---|---|
| `http://localhost:3799/anno-ai-queue` | GET | 读取所有待优化项 |
| `http://localhost:3799/anno-ai-queue` | POST `{ item: {...} }` | 入队（幂等，同 zoneId 去重）|
| `http://localhost:3799/anno-ai-queue` | DELETE `{ ids: [...] }` | 删除已处理项；body 为空则清空全部 |

### AI 处理队列的标准流程（PM 说"优化标注"时自动执行）
1. `GET /anno-ai-queue` → 拿到所有待处理项
2. 对每项读取 `zoneId`、`zoneLabel`、`zoneTexts`、`zoneHTML`、`boundFp`（精确功能点 key）
3. 若 `boundFp` 不为空，从 `prd-data.json` 读取真实字段规范和业务规则作为上下文
4. 根据区域类型（按钮/筛选区/表单/弹窗等）生成**完整 7 节用例规则**（前置条件/操作流程/后置条件/校验规则/提示消息/消息通知/操作日志）
5. `POST /anno-inject { systemName, pins: [{ fpKey, title, fieldSpecs, useCaseRules }] }` 推送到原型（★ systemName 驼峰 = 原型 window.__PRD_DATA__.system_name，**必带**，否则 PRD 用默认名、绑不到本产品）
6. `DELETE /anno-ai-queue { ids: [已处理的 id 列表] }` 清理已完成项
7. 告知用户：已优化 N 个标注，原型已实时更新

### 7 节用例规则强制规范
- **前置条件**：三要素（登录状态 + 权限 + 数据状态）
- **操作流程**：双路径（正向流程 + 取消/异常流程）
- **后置条件**：数据变化 + 操作日志触发
- **校验规则**：权限校验 + 字段校验
- **提示消息**：Markdown 3 列表格（字段名 | 未填提示 | 错误提示）
- **消息通知**：Markdown 4 列表格（通知场景 | 通知标题 | 通知内容 | 接收方）；无通知写"无。"
- **操作日志**：固定说明语 + 6 行表格（操作时间/账号/模块/功能/明细/IP）；查询/查看类写"查询/查看不输出操作日志。"

### 扫描遗漏功能
原型右上角「扫描遗漏」按钮可一键扫描页面所有可标注区域，自动判断哪些标注格式不符合 7 节规范，并批量入队等待 AI 优化。PM 只需点击按钮 → 告诉 AI「优化队列里的标注」即可。

---

## UI 设计规范铁律（强制，每次 UI 改动 / 设计前必走）

> **UI 设计 / 改动默认按 [`skills/pm-design/system-design-spec.md`](skills/pm-design/system-design-spec.md) 执行（无需每次询问用户），严禁自行发挥 / 简化；仅当用户主动要求或提供参考素材时，才改用用户提供的参考。**

> 🏛 **默认规范三件套（均从真实生产代码提炼·2026-07-07·旧的作废）**：① B端 UI [`skills/pm-design/system-design-spec.md`](skills/pm-design/system-design-spec.md) ② 移动版 UI [`skills/pm-design/system-design-spec-mobile.md`](skills/pm-design/system-design-spec-mobile.md)（画原型选「移动版」时走）③ 技术栈 [`skills/_shared/dev-stack-spec.md`](skills/_shared/dev-stack-spec.md)（后端四层/DDL/契约/i18n·生成代码·导出研发版·技术设计·研发提示词的默认技术规范）。

- **用户选「默认」** → 严格遵循 [`skills/pm-design/system-design-spec.md`](skills/pm-design/system-design-spec.md)（主色 #3363FF、组件范式、**筛选区 §5.3 固定宽字段(输入/下拉210px·日期564px·label112px·bg#f7f8fa·radius6·padding24) / 输入框高30px / 日期「至」分隔 / 查询蓝底·重置白底灰边·末行右对齐**、**分页 §4.2 `total, sizes, prev, pager, next, jumper` + page-sizes[10,25,50,100]** 等），不简化、不自创样式。
- **用户选「提供参考 / 不用默认」** → 等用户给参考素材（截图 / 链接 / 设计稿）后再按素材落地，不臆造。
- 派给子 agent 做 UI 时，必须在指令里要求 agent **先完整阅读 system-design-spec.md 对应章节再动手**。
- **一致性铁律**：同类组件（筛选区 / 分页 / 表格 / 按钮 / 字段命名 等）在所有模块、所有地区版本（中国版 / 巴西版等）必须**保持一致**，不允许各处用不同布局或叫法；地区差异只保留本土必需项（货币 / 票据 / 税码 / 支付方式等）。

> 🏛 **路由指针（常驻提醒）**：画原型默认走 `skills/pm-design`、PRD 默认走 `skills/prd`；交付前过对应 `qa` 机器闸（已挂 Stop 钩子 + 随包）。强制与细节以各 skill + `qa` 闸为**单一真理源**，本处不复述。

> 🏛 **验收红线（常驻·随包·跨工具）**：画原型 / 生成 PRD / 标注 / 导出分享版 / 清空恢复 / 导出研发版 的必达效果，见 [`skills/_shared/acceptance-checklist.md`](skills/_shared/acceptance-checklist.md)。任何 AI 工具（本地或打包后别人用的 Cursor/Codex/OpenClaw 等）行为不符时，读该清单 + 对应 skill 规则 + `qa` 闸自行修复，跑闸验绿再交付——不空口保证。

> 🏛 **修复纪律（强制·随包）**：修任何 bug 前后必读 [`skills/_shared/fix-and-upstream-protocol.md`](skills/_shared/fix-and-upstream-protocol.md)。核心四条：① **能测就别猜**（实地测量，别连环假设）；② 修复**必落源头层**、改标准件必须 **bump 版本 + 重注入所有原型**；③ **每个修复必配一道闸或静态断言**（防重新引入）；④ **禁用假实现/硬编码绕过真实约束验收**——闸绿 ≠ 没问题，用户报了现象而闸绿，**先怀疑闸有盲区**。本地修复只救本机，**必须回流上游**。
