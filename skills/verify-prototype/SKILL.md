---
name: verify-prototype
description: 原型验收 skill — 每次 AI 修改原型 HTML 后，自动用 Playwright 打开浏览器，模拟真实用户操作，逐项检查改动是否生效、有无新 BUG，输出验收报告。用于"帮我检查一下" / "你改完自己验证一遍" / "验收一下原型" 等场景。
---

# Verify-Prototype Skill（原型自动验收）

> **触发时机**：AI 修改了原型 HTML 后，**必须主动执行一次验收**，不等用户提醒。
> 验收不通过必须自己修复，直到通过为止，再向用户汇报结果。

---

## §1 验收流程（强制顺序）

### Step 1 — 启动浏览器并打开原型

```powershell
# 用 Playwright MCP 打开原型（file:// 协议）
mcp__playwright__browser_navigate url="file:///<输出目录>/原型-XXX.html"
```

等待页面加载完成（`browser_wait_for` selector=".nav-bar" 或类似稳定元素）。

### Step 2 — 截图存档（改动前 baseline）

```
mcp__playwright__browser_take_screenshot
```

### Step 3 — 逐项验收（按改动内容选检查项）

见 §2 检查清单。

### Step 4 — 输出验收报告

见 §3 报告格式。

---

## §2 标准检查清单

### 2.1 标注系统（每次涉及标注改动必查）

| # | 检查项 | 验收操作 | 通过标准 |
|---|---|---|---|
| A1 | 标注开关 toggle | 点击右上角"标注"switch | body 加上/去掉 `anno-mode-on` class |
| A2 | 单元素右键标注 | 开标注模式 → 右键任意操作列图标（查看/编辑/删除）/ 业务按钮 / 状态页签 / 列标题 | 直接弹出"是否为XX功能生成PRD？"气泡，无需画框 |
| A3 | 区域画框标注 | 开标注模式 → 右键搜索区/列表行空白处 → 进画框模式 → 左键拖拽 → 松开 | 弹出确认气泡 |
| A4 | 标注 pin 可见 | 开标注模式 → 已有 pin 数量与 badge 数一致 | pin badge 显示在正确位置 |
| A5 | 画框模式激活 | 开标注模式 → 右键列表行空白处 | 出现「✏️ 画框模式」ElMessage，光标变十字 |

### 2.2 Tab 样式（每次涉及 Tab 改动必查）

| # | 检查项 | 验收操作 | 通过标准 |
|---|---|---|---|
| B1 | 激活 Tab 样式 | 点击各 Tab 切换 | 激活态：`background:#F2F2F2` 灰底 + `color:#3363FF` 蓝字，**绝不是蓝底白字** |
| B2 | 非激活 Tab 样式 | 同上 | 白底 + `#303133` 灰字 |
| B3 | Tab 高度 | 测量计算 | 40px |

### 2.3 表格样式（每次涉及表格改动必查）

| # | 检查项 | 验收操作 | 通过标准 |
|---|---|---|---|
| C1 | 表头字号 | getComputedStyle(th).fontSize | 13px |
| C2 | 行字号 | getComputedStyle(td).fontSize | 12px |
| C3 | 行内边距 | getComputedStyle(td).padding | 8px 12px |
| C4 | 单据号链接 | 检查 fontWeight | 400（非粗体） |
| C5 | op-icon 颜色 | getComputedStyle(.op-icon).color | rgba(51,99,255,0.8) |

### 2.4 筛选区（每次涉及筛选改动必查）

| # | 检查项 | 通过标准 |
|---|---|---|
| D1 | 输入框高度 | 30px |
| D2 | 查询/重置按钮可点击 | 点击后有响应（toast 或数据变化） |

### 2.5 通用交互（每次必查）

| # | 检查项 | 通过标准 |
|---|---|---|
| E1 | 页面无 JS 报错 | browser_console_messages 无 Error 级别 |
| E2 | 所有按钮可点击 | 抽查 3 个按钮，无白屏/崩溃 |
| E3 | 表格数据正常渲染 | 列表页有数据行，无空白 |
| E4 | 页签切换正常 | 点击"全部/待审核/已审核/已驳回"正确筛选 |

---

## §3 验收报告格式

验收完成后，**必须**用以下格式向用户汇报：

```
## 验收报告 — 原型-XXX.html

### ✅ 通过项
- A2 op-icon 右键标注：右键查看图标 → 气泡正常弹出 ✓
- B1 Tab 激活样式：灰底蓝字 #F2F2F2 + #3363FF ✓
- E1 无 JS 错误 ✓

### ❌ 未通过项
- C1 表头字号：实测 14px，应为 13px → 已自动修复

### ⚠️ 发现的其他问题
- xxx 描述 → [已修复 / 待用户决策 / 超出本次范围]

### 📸 验收截图
[附截图路径或内联图片]
```

---

## §4 自驱动质检闭环（强制，不需要用户提醒）

> **核心原则：AI 必须自我纠错，不靠用户发现问题、不靠用户提醒修复。用户只看最终结果。**

### 4.1 原型改动后的自驱动验收流程

每次修改原型 HTML（无论改了什么），必须按以下闭环执行，**完成前不得向用户汇报"完成"**：

```
修改原型
  ↓
自动打开浏览器（Playwright）验收 §2 检查清单
  ↓
发现问题？
  ├─ 是 → 立即自行修复 → 重新验收 → 循环直到全部通过
  └─ 否 → 向用户汇报"✅ 验收通过，共检查N项，发现并修复M处"
```

**禁止的行为：**
- ❌ 改完就说"已完成，请刷新浏览器测试" — 必须自己先验收
- ❌ 发现问题后报告给用户让用户决定 — 能自动修的必须自动修
- ❌ 只改用户指出的问题，不主动扫描关联问题

### 4.2 PRD 标注生成后的自驱动质检流程

原型 HTML 内置 `_auditDraft()` 验证器，**在浏览器端自动执行，无需 AI 介入**：

```
用户框选/点击元素 → genAnnoDraft() 生成内容
  ↓
_auditDraft() 立即自检（Rule24-27）：
  • Rule24：功能类型识别 → 展示类/操作类/跳转类 → 套对应模板
  • Rule25：操作流程去掉后端技术描述
  • Rule26：展示类字段规范去掉"必填/选填" → 改为"只读"
  • Rule27：展示类操作日志 → 强制改为"查询/查看不输出操作日志"
  ↓
修复后的内容才写入标注 pin（用户看到的已是修复后的版本）
```

### 4.3 AI 介入 PRD 内容的自检流程

当用户点"让AI更新PRD"时，AI 必须在更新前先自检：

```
读取标注内容
  ↓
逐条对照 annotation-templates.md 第24-27条
  ↓
发现违规？
  ├─ 是 → 自动修复后再更新 PRD，在回复里说明"自动修正了X处"
  └─ 否 → 直接更新 PRD
```

**不允许：把违规内容直接写进 PRD 文档，然后等用户发现再改。**

### 4.4 验收通过后向用户汇报格式

```
✅ 验收通过，共检查 N 项
🔧 自动修复 M 处：
  - [Rule27] 余额展示区操作日志 → 改为"查询/查看不输出"
  - [Rule25] 操作流程删除后端描述"从账务模块拉取..."
📋 原型已就绪，刷新浏览器即可使用
```

---

## §5 Playwright MCP 常用命令速查

```
# 导航到页面
mcp__playwright__browser_navigate url="file:///<输出目录>/原型-XXX.html"

# 等待元素出现
mcp__playwright__browser_wait_for selector=".stab" timeout=5000

# 截图
mcp__playwright__browser_take_screenshot

# 点击元素
mcp__playwright__browser_click selector=".stab:nth-child(2)"

# 右键点击（contextmenu）
mcp__playwright__browser_click selector=".op-icon" button="right"

# 执行 JS 验证样式
mcp__playwright__browser_evaluate script="getComputedStyle(document.querySelector('.pt th')).fontSize"

# 查看控制台错误
mcp__playwright__browser_console_messages

# Hover 元素
mcp__playwright__browser_hover selector=".op-icon"
```

---

## §6 关键坑（防止重复犯错）

| 坑 | 正确做法 |
|---|---|
| op-icon 标注无法触发 | **右键**触发（不依赖 hover 计时），SVG 子元素加 `pointer-events:none` |
| Tab 激活态用蓝底白字 | 正确是 `#F2F2F2` 灰底 + `#3363FF` 蓝字 |
| 表格字号用默认 14px | 表头 13px，行 12px |
| 筛选框高度用 36px | 实测 30px |
| 来源标签用圆角蓝底 | `borderRadius:0` 方形 + `#EEEEEE` 灰底 |
| 单据号 fontWeight 600 | 实测 400（正常粗细） |
| Playwright 无头截图空白 | 必须带 `--user-data-dir` 参数 |
| `.ps1` 文件中文乱码 | 必须 UTF-8 with BOM |
| **向 HTML 追加 JS 函数后页面全坏（`{{ }}` 变原始字符串）** | 跨 session 接力编辑时，追加任何 `const funcName` 前必须先 `Grep` 确认不存在 — `const` 重复声明是 SyntaxError，Vue 无法挂载，所有模板表达式失效 |
| **框选画框时确认气泡漂移到页面标题处** | 两个根因：① `mouseover` 悬停触发器未禁用 → 加 `if (_rectMode \|\| _dragRect) return;`；② mouseup 完成后浏览器补发 `click` 覆盖矩形标注 → 在 mouseup 里设 `_justFinishedRect=true`，在 click 捕获监听开头吞掉该次 click |
| **"账户余额 (CNY)" 被当成数字过滤掉** | `NUM_RE` 里 `\|CNY\|USD` 无锚定，匹配任何含 CNY 的文本 — 改为 `^(?:CNY\|USD)\\s*[\\d,.]`（必须以货币码开头后跟数字才过滤）|
| **标注弹窗用例规则各节空白不显示（数据有但渲染不出）** | `v-for` 与 `v-if` 放在**同一元素**上 — Vue 3 中 `v-if` 优先级高于 `v-for`，`v-if` 执行时拿不到 `v-for` 的迭代变量（`key` 为 undefined），条件恒 false，整列永不渲染。**正确写法：`v-for` 用 `<template>` 包裹，`v-if` 放内层 `<div>`**。自检命令：`Grep "v-for=.*v-if=" 原型.html` 应无结果 |
| **标注号 pin 漂移到页面顶部/错误元素** | pin 重锚选择器 `_elSelector` 只生成 `tag.class:nth-child(n)`（无父级路径），`document.querySelector` 命中整页**第一个**同类元素 → pin 锚错。**修复：选择器必须含父级路径**（向上至多 5 级 nth-child 链，或锚到带 `id` 的祖先如 `#app`）。注意：旧 pin 的 selectorPath 已存 localStorage，改后需**清空旧 pin 重新标注**才生效 |
| **标注开关开着时业务按钮点了没反应** | 用 `document` capture click 监听 + `preventDefault` 做"左键标注"，吞掉了业务 @click → **左键必须完全归业务，标注只用右键**（右键单击标元素/右键拖拽框选）。见 annotation-templates 第30条🔒 |
| **标注模式 hover 业务元素出现多余虚线框/crosshair/「右键标注」tooltip** | 旧"hover 提示可标注"残留 — 标注已统一右键，删除所有 `body.anno-mode-on/.canvas-anno-on ...:hover { outline:dashed; cursor:crosshair }` 及 `op-icon:hover::after` tooltip；hover 保持业务原貌(pointer)，不误导、不破坏"模拟真实操作" |
| **气泡显示所有页签拼接文字"全部(6)待审核(2)已审核(2)已驳回(2)"** | 右键点在 `.stabs` 容器 padding/gap 区（非具体 `.stab`）→ `_detectZone` case7 未命中，掉入 case10 取容器 textContent 全文。**修复：在 case7 之后加 case7a 检测 `el.closest('.stabs')` → 返回 `{label:'功能区：状态页签'}`**；凡是"多页签/多子项"容器（`.stabs`/`.tab-bar`/`.menu-list`）都必须在 `_detectZone` 里单独处理，绝不让 case10 兜底 |
| **右键单击命中通用区域就直接弹气泡（应进画框模式）** | 设计：右键命中"点"（op-icon/button/stab/th）→ 直接弹气泡；右键命中"面"（行/容器空白）→ 进画框模式。若"面"上的右键也直接出气泡，说明 `contextmenu` 捕获监听里的元素判断逻辑命中了错误的父级选择器。**排查**：检查 `e.target.closest('.op-icon[data-tip], .el-button, .stab, table.pt thead th')` 是否在通用区域也能 closest 到某个父级。**修复**：缩小选择器或加 `:is(e.target本身)` 限制，不允许向上穿透到错误祖先。 |
| **右键按下时光标不变成 crosshair（用户感知不到画框模式已激活）** | `document.body.style.cursor = 'crosshair'` 被子元素的 `cursor:pointer` CSS 覆盖。**修复：改用 CSS class**：CSS 加 `body.anno-drawing, body.anno-drawing * { cursor: crosshair !important; }`，mousedown 时 `classList.add('anno-drawing')`，mouseup 时 `classList.remove('anno-drawing')` |
| **Windows Chrome 右键拖拽松手后气泡不出现（mouseup 探针全无反应）** | Windows Chrome 右键拖拽松手触发的是 `contextmenu` 事件而非 `mouseup(button=2)`。**修复：把拖拽完成逻辑提取为 `_finishRightDrag(endX, endY)`，在 `mouseup(button=2)` 和 `contextmenu` 里都调用**。contextmenu 里需 `e.preventDefault()` 阻止系统菜单，并判断 `_rDown \|\| _dragRect` 才触发。 |
| **场景②画框交互设计：右键拖拽 ≠ 右键进模式+左键拖拽** | 正确交互：① 右键单击 → 进入画框模式（`contextmenu` + `e.preventDefault()`，显示提示，body 加 `anno-drawing`）；② 左键按住拖拽 → 绘制虚线框（mousedown capture `stopPropagation + preventDefault`）；③ 松开左键 → `mouseup` 调 `_finishDraw`。再次右键或 Escape 取消。**禁止**用"右键按住拖拽"方案——Windows Chrome 右键拖拽行为不稳定。 |
| **画框完成后点「确定添加」无反应** | 根因：mousedown capture 里设了 `_suppressNextClick = true` 屏蔽业务点击，但 Chrome 拖拽后**不补发 click 事件**，导致 `_suppressNextClick` 永远为 `true`，把后续「确定添加」的真实 click 也吞掉。**修复：在 `_finishDraw` 里，当 `savedRect` 存在（真实拖拽）时立即 `_suppressNextClick = false`**；单击无拖拽时保持 true 让 click 被屏蔽。 |
| **genAnnoDraft 里 `_fpFields is not defined`** | `_fpFields` 定义在 `if (zoneId.startsWith('btn-'))` 块内（`const` 块作用域），而 `zone-` 分支也引用了它 → ReferenceError。**修复：把 `_fpFields` 提升到 `genAnnoDraft` 函数体最顶部**，所有分支共用；同时删除 `btn-` 块内的重复定义，避免 `const` 重复声明。 |
| **标注弹窗字段规范显示空行"只读" / 提示消息显示"0/1"** | 两个根因：① `field_specs:"无"`（字符串）→ `_fpFields` 返回 `''` → `_parseFieldsText('')` 返回默认占位行 `{required:'只读'}`。修复：`_parseFieldsText` 开头加 `/^无[。.]?$/.test(text.trim())` 时返回 `[]`（模板自动显示"暂无字段规范"）。② `prompt_messages:"无。"`（字符串）→ `Object.entries("无。")` 返回字符位置索引 `[["0","无"],["1","。"]]`。修复：判断 `typeof _pmR === 'string'` 时直接返回 `'（无）'`，同理处理 `_pmRows` 函数。 |
| **操作列（查看/编辑/删除图标）区域画框/标注失败** | **根本设计缺陷**：op-icon 是小图标，要求用户先右键进画框模式再左键拖拽框住，操作成本极高且不直观。**正确设计**：右键命中可识别元素（`.op-icon[data-tip]` / `.el-button` / `.stab`）→ 直接弹气泡（调 `_detectZone` + `_showTrigger`）；右键命中通用区域 → 才进画框模式。两条路在 contextmenu 捕获监听里分叉。附加修复：① CSS `body.anno-drawing .op-icon { pointer-events: none !important }` 确保画框拖拽穿透；② op-cell 用 `oncontextmenu="event.preventDefault()"` （注意：`return false` 和 `event.preventDefault()` 在原生 DOM 内联事件里效果相同，都只 preventDefault 不 stopPropagation）。 |
| **用例规则兜底生成「按实际业务补充」占位文字** | 根因：功能按钮（重置/查询）通过画框走 `zone-` 路径，prd-data.json 里无对应功能点 → `_matchPrdFp` 未命中 → 兜底模板输出占位文字。**修复**：① `btnDefs` 里补全 `查询` / `重置` 的完整 7 节内容（供场景①悬停触发）；② HTML `window.__PRD_DATA__` 和 prd-data.json 里补入 `充值管理-WMS.重置` / `充值管理-OMS.重置` function point（供场景②画框触发走 `_matchPrdFp` 匹配）；③ BIZ_RE 加入"查询/重置"确保小按钮能被采样点识别。删旧 pin 重新画框后立即生成正确内容。 |
| **消息通知节显示「见 PRD 文档」** | 根因：zone- prd 匹配分支的 `useCaseRules` 模板里消息通知节硬编码了 `（见 PRD 文档）`，未调用 `_notifRows(fpKey)`。**修复**：将该节改为 `${fpKey ? _notifRows(fpKey) : '无'}`。**铁律**：7个节的内容必须全部从数据源读取，禁止任何硬编码占位字符串（Rule32）。 |
