# 系统设计规范 v1.0

> **用途**：AI 生成 HTML/Vue 原型时遵循的设计规范，确保原型视觉与团队真实系统一致。
> **来源**：从 Figma "WMS 设计规范-源文件" 提取（共 17 张规范图）。
> **技术栈**：Vue 3 + Element Plus + TypeScript + Tailwind CSS
> **部署地区**：巴西 (BR) — 葡语 + BRL 货币 + `DD/MM/YYYY` 日期格式
> **生效**：所有 PRD 衍生的原型 / 组件代码必须遵守本规范
>
> 🔴 **画默认原型 / 按默认规范统一改原型：先读 [§8.0 共性操作范式总纲](#80-共性操作范式总纲-唯一标准画默认原型必遵禁自由发挥)**（菜单/查询/列表/新增/编辑/删除/查看/审批 每类操作的唯一标准 + 按钮命名铁律 + 禁用词），**逐条对照、禁自由发挥**。DOM 实测证据见真理源提取档（维护者本地保留·未随公开包）。查看页最易漂（必须整页+步骤条+3列只读+居中返回，绝不弹窗/绝不[取消][提交]）。

---

## 目录

- [1. 技术栈](#1-技术栈)
- [2. Design Tokens](#2-design-tokens)
- [3. 基础组件](#3-基础组件)
- [4. 数据展示组件](#4-数据展示组件)
- [5. 导航组件](#5-导航组件)
- [6. 反馈组件](#6-反馈组件)
- [7. 表单规范](#7-表单规范)
- [8. 页面结构模板](#8-页面结构模板) — 含 **§8.0 共性操作范式总纲（🔴 画默认原型唯一标准）**
- [9. 巴西本地化](#9-巴西本地化)
- [10. Tailwind 完整配置](#10-tailwind-完整配置)

---

## 1. 技术栈

```json
{
  "frontend": "Vue 3 + <script setup> + TypeScript",
  "ui_library": "Element Plus",
  "css_helper": "Tailwind CSS (布局辅助，不替代 Element Plus)",
  "icons": "@element-plus/icons-vue",
  "router": "vue-router (history mode)",
  "i18n": "自研 lang() (zh/en/pt/spa, 默认 pt; 非 vue-i18n)",
  "font": "Noto Sans SC (真系统实测 body font·2026-07-12 实测校正)"
}
```

---

## 2. Design Tokens

### 2.0 【最高真值·2026-09-16 登录真系统全组件 getComputedStyle 逐值实测总表】

> **权威级别：最高。** 本表由 RPA 登录真系统（中文态）后，对**每一类组件**逐个 `getComputedStyle` 机器实测得出（非肉眼、非记忆），是默认 UI 规范的**单一真理源**；下文 §2.1~§8 任何值与本表冲突，**以本表为准**。原始实测 JSON 见本地真值源（客户端本地，不入公共库）。Element Plus 版本 = **2.6.3**（真系统同版）。凡「选默认 UI 规范」生成的原型，**每个组件必逐值等于本表**，机器闸 ㊸ `computed-style-gate.js` 渲染后逐属性 diff、红了禁交付。
>
> 🔬 **可复现验证（2026-09-17）**：本表真值现已可**从像素级冻结件重新机器复算、不用再登录真系统**——跑 `node skills/rpa/extract-spec.js <冻结件.html> out.json`（连调试 Chrome·穷举每类组件 getComputedStyle）。冻结件由 `rpa/freeze.js`/`mhtml2html.js` 生成、断网自洽，是本表的**可复现真值源**。2026-09-17 已对 01/02/04 冻结件复算，逐值确认本表主色/令牌/按钮/表头(列表#999·表单#909399)/行文字#444/筛选白底/分页圆角2/整页表单 label#909399 全部正确。**校验闭环 = 冻结件(真值) → extract-spec(复算) → §2.0(规范) → 装配原型 → fidelity-audit(逐维 diff 到全绿)**。

**① 全局令牌（真系统 `:root` CSS 变量 + body 实测）**

| 变量 | 值 | | 变量 | 值 |
|---|---|---|---|---|
| `--el-color-primary` | `#3363ff` | | `--el-text-color-primary` | `#303133` |
| `--el-color-success` | `#67c23a` | | `--el-text-color-regular` | `#333333` |
| `--el-color-warning` | `#f2ac3a` | | `--el-text-color-secondary` | `#909399` |
| `--el-color-danger` | `#f56c6c` | | `--el-text-color-placeholder` | `#a8abb2` |
| `--el-color-info` | `#909399` | | `--el-border-color` | `#dcdfe6` |
| `--el-font-size-base` | `14px` | | `--el-border-color-light` | `#e4e7ed` |
| `--el-border-radius-base` | `4px` | | `--el-border-color-lighter` | `#ebeef5` |
| `--el-component-size` | `32px` | | `--el-bg-color` | `#ffffff` |
| **body font-family** | `"Noto Sans SC"` | | **body font-size / color** | `14px` / `#333333` |

**② 按钮 Button**（真系统查询/新增=primary，重置/停用=default，值完全相同仅配色异）

| 类型 | height | min-width | padding | radius | 背景 | 边框 | 文字 | 字号/字重 |
|---|---|---|---|---|---|---|---|---|
| 主按钮 primary | `32px` | `80px` | `8px 15px` | `4px` | `#3363ff` | `#3363ff` | `#ffffff` | `14px` / `500` |
| 次按钮 default | `32px` | `80px` | `8px 15px` | `4px` | `#ffffff` | `#dcdfe6` | `#333333` | `14px` / `500` |

**按钮 hover 态（真系统实测·必守·2026-09-16）**：鼠标移上按钮**边框会变蓝**——
| 类型 | hover 背景 | hover 边框 | hover 文字 |
|---|---|---|---|
| 主按钮 primary | `rgba(51,99,255,.8)` | `rgba(51,99,255,.8)` | `#ffffff` |
| 次按钮 default | **`#ffffff`（底仍白）** | **`#3363ff`（实蓝·非EP默认浅蓝）** | **`#3363ff`（蓝字）** |
> 骨架靠改写 EP 令牌实现：`--el-color-primary-light-7:#3363ff`（次按钮 hover 边框=实蓝）·`--el-color-primary-light-9:#fff`（hover 底=白）·`--el-color-primary-light-3:rgba(51,99,255,.8)`（主按钮 hover）。**禁用 EP 默认 hover（浅蓝边+浅蓝底）**。工具栏批量按钮（停用/标记等）**默认可点**（对齐真系统·hover 即变蓝），点时无勾选再提示，而非置灰禁用。

**③ 筛选区控件 Filter**

| 控件 | height | radius | 背景 | padding | 说明 |
|---|---|---|---|---|---|
| 下拉 `.el-select__wrapper` | `32px` | `4px` | `#ffffff` | `4px 12px` | 无值时占位=`options[0]`（如「全部商品分类」）|
| 输入 `.el-input__wrapper` | 内框 30px | `4px` | **`#fff` 白底** | `1px 11px` | 2026-09-16 复校：筛选输入/下拉**全白底 #fff·文字 #333**（作废 09-09 的灰底 #f5f7fa）|
| 输入内框 `.el-input__inner` | `30px` | — | 透明 | — | 占位符色 `#a8abb2` |
| 日期 `.el-date-editor` | `32px` | `4px` | `#ffffff` | — | 范围用「至」分隔 |

**④ 表格 Table**

| 部位 | 值 |
|---|---|
| 表头 th | height `40px` · 背景 `#f7f8fa` · 文字 `#999999` · 字号 `14px`（指 `th > .cell`·见下方 ⚠️） · 字重 `600` · 下边框 `1px solid #ebeef5` |
| 表体单元格 `.cell` | 文字 `#444444` · 字号 `14px` · 字重 `400` · line-height `23px` · padding `0 12px` |
| 表体 td | padding `8px 0` · 下边框 `1px solid #ebeef5` · 背景透明 |
| 单据编号链接 | `#3363ff` |

> ⚠️⚠️ **表头字号必须看【内层 `.cell`】，不是外层 `th` —— 这个坑已被踩过两次（2026-10-29 第二次）**
>
> 真系统 el-table 的表头，**外层 `th` 的 `font-size` 是 `13px`，内层 `.cell` 又覆盖回 `14px`**（各 199 个样本、纯度 100%）。
> 文字在 `.cell` 里渲染，所以**用户眼睛看到的是 14px**，那个 13px 是看不见的中间值。
> 只抽外层 `th` 就会得出"规范的 14px 错了、该改 13px"——**这个结论是错的**，上表的 `14px` 从头到尾正确（§8.2 第二条「曾一度误改 13px，已修回」说的就是同一个坑）。
> **凡拿实测值跟本规范对，先确认两边说的是同一层。** 抽值工具 `skills/rpa/tokens.js` 已把 `表头·外层th` 和 `表头·内层div` 分成两个桶，别混着比。
>
> 🔴 **表格实现有【两套】（2026-10-29 登录 某 WMS + 某 OMS、机器逐页统计 55 个真实界面，零例外）**
>
> | 表格实现 | 表头字号（看得见的 `.cell`）| 字重 | 文字色 | 表头底色 | 哪些模块用它 | 页数 |
> |---|---|---|---|---|---|---|
> | **Element Plus `el-table`** ← **默认用这套** | `14px` | `600` | `#999999` | `#F7F8FA` | 售后、商品、客户、库内 | 25 |
> | 原生手写表（`.native-table-wrap`/`th.first-th`/`td.check-box-td`）| `14px` | **`700`** | **`#909399`** | **`#F5F7FA`** | 入库、出库、订单 | 20 |
>
> **字号两套都是 14px**（所以本规范的字号无需改动）；真正不同的是 **字重 600/700、文字色 `#999999`/`#909399`、底色 `#F7F8FA`/`#F5F7FA`**。
> **默认走 el-table 那套**：① 骨架本来就基于 Element Plus；② 本规范原有的 `#999999`/`#F7F8FA`/`600` 三项正是这套的值（即上表，无需改）；③ 用它的页面更多（25 > 20）。
> **复刻入库 / 出库 / 订单**这类页面时才用原生表那一行的值。
>
> ⚠️ **抓真值时另两个坑**（都已在 `tokens.js` 修死）：① **真系统不是全用 el-table** —— 只认 `.el-table__cell` 的话，原生表那 20 页一个表格都抽不到，而且**不报错**（静默漏抓比报错危险）；② **日期选择器内部也是 `<table>`**（91 个日期格），用通用 `th,td` 选择器会把日历格当成表格数据 —— 老真值里"表体一致率只有 4%"就是这么来的。
>
> 真值源：`learned-specs/wms-oms-real-20261029.json`（123 桶·每桶主值 + 真系统出现过的全部容许值）。核对：`node skills/rpa/fidelity-verify.js <复刻件> <该基线>`。

**④b 聚合单元格 Aggregate cell**（真系统「商品信息 / 订单信息」列 = 图 + 多行「灰label：值」·2026-09-16 实测）

| 项 | 值 |
|---|---|
| 结构 | `[缩略图 60×60·圆角4·无图=No photo]` + 右侧多行字段，每行 `label（#909399）：值` |
| 首字段值 | 主键（SKU编号/出库订单号）= **蓝链 `#3363ff` 可点**；其余值 `#444` |
| 图片 | **仅有商品缩略图的列才给图**（商品列表「商品信息」有图=真系统确有）；**出库订单「订单信息/平台/物流信息」= 无图**（真系统实测无缩略图·别加 No photo 框=画蛇添足）。写法 `{img:false, agg:[…]}` 关图 |
| 🔴 列宽 | 聚合列**必须显式给 `width`（min-width）≥ 230px**（订单信息/商品信息 230-240·平台/物流信息 170）。默认列宽 100-140px **会把内容挤成逐字竖排变形**（2026-09-16 事故根治）。写法 `columns:[{label:"商品信息",width:240}, …]` |

**④c 列表行内的两个交互**（2026-10-29 登录 某 WMS 中文版·出库订单「已发货」页签实测）

这两个都**不开新界面**（不是弹窗、不是跳转），是在行内就地变化 —— 复刻时容易整个漏掉。

| 交互 | 实测真值 |
|---|---|
| **多品混合订单·展开/收起** | 一张订单有多个商品时，**行内只显示第一个**，其余折叠。折叠态文案 **「剩余N个商品 ∨」**，展开后变 **「收起 ∧」**。元素 `span.order-goods-info-list__toggle` · **44×23 · 色 `#3363FF`（主色）· 14px · 字重 400 · 无边框无底色 · padding 0** · `cursor:pointer`。订单头行同时标注 **（多品混合）/（单品单数）** |
| **商品缩略图 hover → 大图浮层** | 鼠标悬停缩略图弹出预览浮层：**220×209 · 白底 · 圆角 `4px` · 边框 `1px solid #E4E7ED` · 阴影 `rgba(0,0,0,.12) 0 0 12px 0` · 内边距 `12px`**；浮层内图 **194×180** |
| 列表缩略图本身 | **60×60**，⚠️ **实测圆角 `0px`、无边框**（§④b 上面写的"圆角4"与本页实测不符 —— 本行是 2026-10-29 WMS 出库订单实测值，若要改默认规范请先在多页复核，别照单改）|

> ⚠️ **抓取侧注意**：这类"行内就地展开/hover 浮层"的交互，`deepcrawl` 旧逻辑只认"点了开新界面"，会把它们判成**「点了没反应」**（2026-10-29 的 13 个假漏抓里就有这类）。复刻这类系统时必须专门覆盖，否则交互会整块缺失。

**④d 全量实测复核（2026-10-30 · 某 WMS 121 页 + 某 OMS 61 页 = 182 个真实列表页 · 视口 1600×900）**

此前的真值只抽了 11 个页面（覆盖率 6%），且是从冻结件抽的（带 `cssText` 失真）。这次改为
**从路由表枚举全部页面 + 直接抽活页面 computed**，产出 **121 个组件桶**，基线里 **UA 默认脏值 0 个**，
**182 页正向自核全绿**。真理源：[`learned-specs/wms-oms-real-20261030.json`](learned-specs/wms-oms-real-20261030.json)。

> 🔴 **抓真值必须用 ≥1350 的视口（本次用 1600×900 · dpr=1）**
> 真系统布局 `min-width: 1350px`（§2026-07-09）。2026-10-30 实测：用默认的 **1037** 宽视口去抓，
> **整个操作列落在屏幕外** —— 行操作图标点不到（全报"点了没反应"），而且**列宽被挤压**：
> 同一页同一列，1037 视口下抽出 `74/94/101/103/142/197/224`，1600 视口下是 `78/104/138/143/194/315`。
> 组件桶数也从 24 变成 29（操作列那几个组件在窄视口下根本抽不到）。
> **哪些值受影响**：宽度类（列宽、控件宽、容器宽）、以及"有没有抓到"。
> **哪些不受影响**：字号 / 字重 / 文字色 / 背景 / 行高 / 内边距 —— 实测两种视口下完全一致。
> `_cdp.js` 已把视口锁死在 1600×900，不必每个工具单独设；要改用 `RPA_VIEWPORT=宽x高`。

**本表现有的核心值，全部被实测验证（不是重写，是确认）**：

| 规范原有写法 | 182 页实测 | 结论 |
|---|---|---|
| 表头 `#999999` · `14px` · `600` | EP 表头内层 `14px/600/rgb(153,153,153)` | ✅ 一致 |
| 表体 `#444444` · `14px` · 行高 `23px` · padding `0 12px` | EP 表体内层逐项相同 | ✅ 一致 |
| 按钮 高 `32px` · 圆角 `4px` | `border: 1px solid #3363FF`·高 `32px`（样本 **140**·纯度 93%）| ✅ 一致 |
| 输入框 / 下拉框 高 `32px` | wrapper 高 `32px`·圆角 `4px` | ✅ 一致 |

**补充的实测细节**（原规范没写或写得不够细）：

| 组件 | 实测值 |
|---|---|
| 表头行 `tr`（两套表都一样）| 高 **40px** · `14px/400` · 文字 `#909399` |
| 表体行 `tr` | 原生表 高 **40px**/`#333`；EP 表 高 **41px**/`#444` |
| 分页条 | 高 **32px** · `14px/400` · 文字 `rgb(48,49,51)` |
| 分页器内的输入框 | wrapper 高 32 · 圆角 4px · padding `1px 11px`；inner 高 **30px** · 行高 14px |
| 分页器内的下拉框 | 高 32 · 圆角 4px · padding `4px 12px` · 行高 **24px** |
| 日期范围控件 | 外层高 32 · **圆角 `0px 4px 4px 0px`（只圆右半边）** · padding `0 10px`；内层 input 高 30 · 行高 30px |
| **勾选框**（列表/表单内表通用）| **14×14** · 白底 `#fff` · 边框 **`1px solid #DCDFE6`** · **圆角 `2px`**（不是按钮的 4px）|
| **行操作图标**（查看/编辑/打印标签…）| 容器 `.icon-button` **28×24** · 内含 svg **20×20** · 本身无文字无 title，**功能名在 hover 出来的 tooltip 里** · 整列是**固定列**（`el-table-fixed-column`）|

**④e 列表页功能入口的交互形态**（2026-10-30 · RPA 逐个点开实测 · 两系统 82 个列表页 / **258 个功能入口** / 抓到 179 个界面）

复刻时照这个形态做，别自己定。统计口径是"点下去实际发生了什么"：

| 形态 | 占比 | 具体 |
|---|---|---|
| **跳转整页** | 82 | **查看 ×39 → `/…/detail`** · **新增 ×13 → `/…/add`** · **编辑 ×7 → `/…/edit`** |
| **下拉菜单** | 50 | **导出 ×36 一律是「按勾选导出 / 按筛选导出」两项**（最强的一条模式）；导入是「新建商品 / 更新商品」 |
| 提示消息 | 20 | 未勾选就点批量操作 → `请选择数据` / `请选择商品` |
| 弹窗 | ~20 | 停用、标记、打印标签这类**操作确认/参数填写**才用弹窗 |
| 行内展开 | 8 | 见 §④c |

> 🔴 **查看 / 新增 / 编辑一律是【整页】，不是弹窗** —— 59 个样本无一例外，URL 就是 `/detail`、`/add`、`/edit`。
> 这与 §2026-09-15 既有铁律一致（"整页表单必须用 `cfg.pageForm` 做成整页，禁做成弹窗"），现在有了全量实测佐证。
> **弹窗只用于**：操作确认（停用）、少量参数填写（标记、打印标签）。
>
> 🔴 **列表里的单据号是可点链接，点进详情页**（如 `BOKFX2609150001` → `/…/detail`）。
> ⚠️ 我曾据"元素是 SPAN、没有 `<a>`、色 `#333` 不是蓝链、旁边有 copy-icon"判定它是"复制"——**那是错的**，
> 实际点下去会跳详情。**判断一个元素是什么，要点一下看后果，不能只看它长什么样。**

> ⚠️ **日期控件圆角**：本表 §③ 写的是 `4px`，实测**组合态是 `0 4px 4px 0`**（左半边与前缀控件相接处不圆）。
> 这不是矛盾——独立日期框是 4px，范围/组合态只圆外侧。复刻时按**是否组合**取值。
| 字段行 | label `white-space:nowrap`（不逐字断）· 值 `word-break:break-word`（超长才换行）· line-height 20 · font-size 13 |

**④c 分组订单行列表 Grouped-order rows**（真系统「一件代发出库订单」列表实测·2026-09-17 冻结件提炼）

> 真出库订单列表**不是扁平一行一单**，而是每单占**三段**（用 el-table `span-method` 让头/尾行跨全列实现）：

| 段 | 内容 |
|---|---|
| ① 订单头带（浅蓝底·跨全列）| ☐勾选 + `出库订单号：<蓝链>` + `(订单类型)` + `订单参考号：xxx` + `来源` + `作业状态：xxx` |
| ② 明细数据行（对齐列头）| 订单信息列=`多个(2)`蓝链（**不是订单号**·订单号在头带）· 平台列=`平台/单号/状态`多行 · 仓库 · 物流信息 · 收件人/地区 · 状态 · 人员=`创建：x/发货：y`两行 · 时间=`创建：/发货：`两行 · 操作图标 |
| ③ 备注带（跨全列）| `客服备注：-- ✎` + `买家备注：--` |

> ⚠ **判定**：当真系统某列表把「单据头信息 + 明细 + 备注」堆成一单多段（头带常为浅蓝/浅灰通栏）时=分组行，**别做成扁平聚合行**（那样丢了头带和备注带）。此形态在骨架里需 `span-method` 支持（复刻出库订单时启用）。像素级冻结件永远是最忠实的对照物（`<你的目录>\OMS像素级冻结件\02-出库订单列表.html` 断网可开）。

**⑤ 状态页签 Tabs**（已启用/已停用/全部…）

| 态 | 值 |
|---|---|
| 容器 | 卡片式 `el-tabs--card` · nav 白底 · **底部 1px 边线 `#E4E7ED`** · 无 active-bar 下划线 |
| 选中 | **白底 `#fff`**（不是灰底！）· **顶+侧边框 1px `#E4E7ED`** · 底边白色盖住容器线（卡片连内容）· 圆角 `8px 8px 0 0` · 文字 `#3363ff` · 字号 `14px` · 字重 `500` · height `40px`(含边框 41px) · padding `0 20px` |
| 未选 | 文字 **`#909399`**（灰·不是 #303133）· 透明底 · 字号 `14px` · 字重 `500` |
| 计数 | **行内文字**「(3706)」继承页签色（选中蓝 / 未选灰）· **非灰色药丸**（旧灰药丸=画蛇添足） |

> 🔴 **2026-09-16 三次校正（登录真 OMS `Page.captureSnapshot` 机器抽 getComputedStyle 逐值·与 §2026-07-09 note③ 一致）**：列表状态页签（已启用/已停用·全部/待提交…）实测 = **选中白底 #fff + 边框 #E4E7ED + 蓝字 / 未选透明 + 灰字 #909399**。我 09-16 §2.0 一度回退成「灰底 #f2f2f2 / 未选 #303133」是**错的**（那是【浏览器页签】layout-tabs 首页/商品管理的值，两种页签别混）——已改回。骨架 `.status-tabs` 同步修正。

**⑤b 顶部导航 + 浏览器页签（layout-tabs·2026-09-17 冻结件提炼·灰底 #f2f2f2 的正主·别跟 ⑤ 状态页签混）**

| 部位 | 值 |
|---|---|
| 顶部主导航条 | 背景 **`#122041`**（深蓝 rgb 18,32,65）· height **`52px`** · 横向菜单 `14px`（首页/订单/商品/…/设置）· 悬停出多列大菜单 |
| 浏览器页签条 `.el-tabs__header` | 白底 · height `48px` · 在主导航下方（可关闭页签：首页/商品管理×/商品详情×…）|
| 页签选中（layout-tab）| **灰底 `#f2f2f2`** · 文字 `#3363ff` · 圆角 `8px 8px 0 0` · height `40px` · pad `0 20px` · fw `500` |
| 页签未选（layout-tab）| 文字 `#303133`（≠状态页签未选的 #909399）· 透明底 |

> **两种页签一句话记牢**：**浏览器页签（首页/商品管理·可关×）= 灰底 #f2f2f2 选中**；**列表状态页签（已启用/全部·带计数）= 白底 #fff 选中**。两者都是 `el-tabs--card` 但选中底色相反，**别抄错**（我 09-16 就抄反过·见 §⑤ 校正）。

**⑥ 分页 Pagination**：文字 `#303133` / `14px`；当前页码 = 文字 `#fff` · 背景 `#3363ff` · **圆角 `2px`** · min-width `32px` · height `32px`。

**⑦ 整页表单 Form**（新增商品/创建出库单范式）

| 部位 | 值 |
|---|---|
| 字段标签 `.el-form-item__label` | 色 `#909399` · `14px` · 字重 `400` · line-height `22px` · **label 在字段上方(top)** · 右留白 `12px` · 左对齐 |
| 字段行距 `.el-form-item` | `margin-bottom: 10px`（文本域行 18px）|
| 分区标题（基本信息/规格/产品配对）| 色 `#333333` · **字号 `16px`** · 字重 `600` · padding `24px 0 10px` · **无左边框竖条** |
| 表单输入框内框 | height `30px` · radius `4px` · 白底 · padding `1px 11px` |
| 表单下拉 `.el-select__wrapper` | height `32px` · radius `4px` · 白底 |
| 页脚 footer | 白底 · **按钮居中(center)** · 取消/保存 或 关闭/存草稿/提交 |
| 上传按钮（主）| height `32px` · 蓝底 `#3363ff` · 白字 · 实线边框 |

> **导入/导出是下拉按钮**（非直接弹窗）：真系统「导入」点开= `新建商品 / 更新商品` 两项，选一项才弹「导入商品」对话框（导入说明 6 条 + 下载模板 + 拖拽上传区「将文件拖到此处，或 点击上传」+ 取消/导入）；**「导出」点开= `按勾选导出 / 按筛选导出`**，选一项→导出进度弹窗(绿进度条+总计/成功/失败·成功挂"xxx.zip 已就绪·下载")。整页新增走 `/add` 路由（非弹窗）。

> 🔴 **列表批量工具栏的左右分区（2026-09-18 实测·必守）**：真系统批量工具栏 = **左侧批量操作**（`已选:N` + 新增 + 停用/标记/税务信息/打印标签…依赖勾选的批量按钮）+ **右侧工具**（`公制/英制` 单位分段切换[英制默认选中·选中蓝底白字] + `导入▾` + `导出▾`）。**导入/导出永远在右端·不要混进左边那排批量按钮**。骨架写法：右端项放 `cfg.listTools` + `cfg.toolsPos:'toolbar'`；单位切换 `{segment:['公制','英制'],active:'英制'}`；导入/导出 `{label:'导入',icon:'import',menu:[{label:'新建商品',opens:'importDlg'},{label:'更新商品',opens:'importDlg'}]}`。出库订单同理（无公制/英制·只有导入▾/导出▾）。

**⑦b 查看/详情页 View**（商品查看 / 订单查看范式·2026-09-17 冻结件提炼·**整页新页签·非弹窗·非[取消][提交]**）

| 部位 | 值（实测） |
|---|---|
| 顶部状态步骤条 | **仅过程型单据有**（出库订单详情实测：头部 = **左侧订单摘要卡**（出库订单号+订单类型+`●已发货`绿点状态）+ **右侧横向步骤条**：创建→提交→发货·每步蓝勾圆圈+账号+时间戳·蓝线连接·height ~100）；**数据详情无步骤条**（商品查看就没有·别硬加）|
| 分区标题 | 色 `#333333` · 字号 `16px` · 字重 `600`（同整页表单分区标题）|
| 只读字段 | **3列·label 灰在上 + 值在下**（label `#909399`/`14px`/`fw400`·line-height 18-22；值 `#333`/`14px`）· **空值一律 `--`**（禁留空/禁臆造）|
| 字段帮助 | 部分字段带灰 `?` 帮助图标（商品编号/参考SKU编号/条形码等）·悬停出说明 |
| 特殊值渲染 | 条形码值 = **浅蓝药丸标签**（`#3363ff` 系浅底圆角小标签·非纯文字）；商品图片 = 缩略图；相关附件 = 内嵌子表（文件名称/大小/上传时间/操作）|
| 底部 | **单个「返回」按钮·居中**（白底 `#333`·height 32·圆角 4·= 次按钮样式）；**绝不是 `[取消][提交]`**（那是新增/编辑）|

> ⚠ **查看 vs 新增/编辑 别混**：查看=**只读回显 + 居中单「返回」**；新增/编辑=**可填 + sticky 底部 `[取消][保存]`**。都走整页新页签（§8.2/§8.3），但按钮与可编辑性相反。

**⑧ 行内操作图标（列表「操作」列·真系统实测·2026-09-16·必守）**：真系统行操作是**细线 SVG 矢量图标**（**不是文字链接、不是 emoji**），色 `rgba(51,99,255,.8)`（主色蓝 80%）· 尺寸 ~20px（容器 24px）· 间距 8px · **hover 变实色 `#3363ff` + 浅蓝底 `rgba(51,99,255,.08)`** · 每个带 tooltip（悬停出中文名）。骨架图标集 `ACT_ICONS`（细线 SVG）：`view`(查看/眼睛) · `edit`(编辑/铅笔) · `print`(打印) · `return`(退货/退回箭头) · `delete` · `copy` · `download` · `log` · `sync` · `check` · `void` · `import` · `export` · `more`(三点) · `mail` · `link`。写法 `actions:[{label:"查看",icon:"view"},{label:"编辑",icon:"edit"}…]`（**只写 `["查看"]` 纯字符串会退成文字链接·必带 icon**）。真系统各列表的图标组合按真值（例：商品列表=查看/编辑/打印；出库订单=查看/退货）。**列表若真系统无「操作」列 / 靠点单号进详情，就不加操作列**（禁画蛇添足）。**行图标数随状态变（2026-09-18 实测·必守）**：同一列表不同状态行的操作图标不同——真系统出库订单：`待提交/待发货`行=查看/提交/编辑/删除/拦截，`已发货`行=查看/退货。骨架用 `actions:[{label,icon,hideIf:'状态词'}]`（`hideIf` 命中该行文本即隐藏，如退货 `hideIf:'待'` 只在非待状态显示）。**别所有行套同一组图标·也别只给 1-2 个**（真系统某行可达 5-6 个）。机器闸 ㊹ 行图标维已升级：复刻件某行最多图标数 < 真系统 = 红。

**⑨ 整页表单 = 按业务分区（真系统实测·2026-09-16）**：新增/编辑整页表单**不是一大块**，而是按业务拆成多个分区（真系统「新增商品」= 基本信息 / 规格 / 产品配对 / 税务信息 / 其他；「创建出库单」= 基本信息 / 收件人信息 / 物流信息 / 商品信息）。每区一个 §⑦ 的**分区标题**（16px/600/#333 + 底边线 1px #dcdfe6 + padding 24 0 10）。写法 `pageForm.sections:[{title:"基本信息",cols:3,fields:[…]},{title:"商品信息",table:{btn:"选择商品",columns,rows}},…]`。**整行字段**（备注/上传/条形码）用 `span:3` 占满；上传带说明用 `hint`（如「仅支持PDF格式文件，且文件大小不超过5M」）；子表带「选择商品/选择产品」按钮用 `table.btn`；主色上传按钮 `uploadPrimary:true`。分区/字段/顺序/必填一律照真系统，**禁合并成一块、禁少分区**。

**⑩ 交互行为（真系统实测·2026-09-16·默认必守）**：
- **按钮 hover 边框变蓝**：见 §③ 上方 hover 表——次按钮 hover 边框+文字变实蓝 `#3363ff`（底仍白），主按钮 hover 变 `rgba(51,99,255,.8)`。EP 默认浅蓝 hover 已被骨架令牌改写掉。
- **批量工具栏按钮默认可点·不置灰**：真系统「停用/标记/税务信息/打印标签/导入/导出」等依赖勾选的批量入口**任何时候都能点**，点了没勾选才 toast「请选择数据」——**不是置灰禁用**（置灰点不动=用户不知为何不能用）。骨架 `selectActions` 默认即此行为（`needSel` 只控点击校验、不加 `disabled`）。
- **列表查看=点单号链接**：真系统列表「订单号/单号」是蓝色可点链接（`link-txt`），点它进详情；操作列的「查看」图标与之并存或二选一，按真系统。

**⑪ 弹窗类型 Dialogs（真系统实测·2026-09-18 冻结件机器抽·按用途分四型·别一套宽度套所有）**

| 弹窗 | 宽 | 圆角 | 标题 | 底部按钮 | 结构要点 |
|---|---|---|---|---|---|
| **二次确认**（停用/删除…）| **480px** | **8px** | `18px` / `700` + **⚠橙图标** | `[取消(白)] [确定(蓝·主)]` | el-messagebox 式·一行提示语「确认停用所选商品？」·居中 |
| **筛选选择**（标记）| **580px** | `4px` | `16px` / `600` | `[取消] [确定]` | 顶部「标记名称」输入 + `[查询(蓝)][重置(白)]` + 右上「标记管理」蓝链；下方**彩色标签芯片**分组（商品状态类：预售商品紫/需冷链绿/需商检红/易碎品黄/临期商品橙/直邮商品青/保税备货蓝；物流状态类：部分上架/待上架/部分收货/待收货/部分签收/待签收）——芯片=描边小标签 |
| **批量编辑**（税务信息等）| **780px** | `4px` | `16px` / `600`「**批量编辑**」 | `[取消] [**继续**(蓝)]`（注意=继续·非确定）| **左右两栏**：左=勾选树（税务信息▸税种/NCM/CEST/单位/原产地·全勾）· 右=对应字段（select/input）|
| **打印**（打印标签）| **1100px** | `4px` | `16px` / `600` | `[取消] [打印(蓝)]` | **左右两栏**：左=表单(*模板名称下拉「北京仓库-sku条码(40mm x 30mm)」/ *纸张类型卷纸•平面纸 radio / *排边距 / 水平间距) + **预览**框；右=**商品信息表**(SKU编号/商品名称/**打印数量**输入·可批量) |
| **选择商品/产品**（子表选择）| **1200px** | `4px` | `16px` / `600` | `[取消] [确定(蓝)]` | 见 §5.3「选择产品类弹窗」·内含查询+表格+全量选中/清空 |
| **表单弹窗**（通用小表单）| **480px** | `4px` | `16px` / `600` | 底部右对齐 | label-top·见 §5.3d |

> ⚠ **别混**：确认弹窗 480/圆角8/标题18px；其余业务弹窗圆角4/标题16px。**底部主按钮文案照真系统**（确认弹窗=确定·批量编辑=继续·打印=打印·选择=确定），别一律写「确定」。骨架用 `cfg.dialogs[名]={title,width,fields?|tabs?|table?|confirm?,footer}` + 工具栏按钮 `{label,opens:'弹窗名'}`；二次确认走 `confirm:{icon:'warn',text:'确认停用所选商品？'}`。导入=先下拉(新建商品/更新商品)再弹导入弹窗（§⑦）。

> 🔴 **保真审计器 ㊹**（见 CLAUDE.md「复刻/默认规范·三条死规矩」）：以上 ⑧⑨⑩⑪ 及全部 §2.0 值，复刻任何系统时由 `qa/fidelity-audit.js` 机器逐维 diff 真系统、列出所有不一致、改到全绿=1:1，不靠肉眼、不等用户逐个指。

### 2.1 颜色 Color

> **来源**：从真实 B 端 WMS/OMS 系统源码（`basic.scss` / `el-table.scss` / `layout`）提取的设计 token（**2026-07-07 以最新代码为准更新**·已匿名），团队默认权威值。
> **2026-07-07 校准记录**：主色 #3363FF / 语义色 / 表头背景 #F7F8FA / 操作图标 rgba(51,99,255,.8) 与代码一致（未变）；正文 #444→**#333333**、三级/表头文字 #999→**#909399**、页面背景 #F2F3F5→**#F2F2F2**、表格字号→**14px**（均按 basic.scss/el-table.scss）；**导航经代码确认为顶部 #122041·高 50px（无侧栏，Sidebar 已注释禁用）**；新增边框 #DCDFE6 / 筛选区背景 #f7f8fa / 页签导航条 #F0F2F5 / 表格选中 #F6FFF0。
> **2026-07-09 补充实测（对真代码校 5 处·前 4 项旧 spec 缺/错，已修）**：① 页面布局最小宽 **`min-width:1350px`**（index.vue）；② 表格**表头 sticky 吸顶**（下边框 #DCDFE6）+ **分页 sticky 吸底**（padding `12px 24px`·上边框 #DCDFE6·`justify-content:space-between` → **total 左 / pager 右**·total-box 行高 32px）；③ **状态页签选中 = 白底 #fff + 边框 1px #E4E7ED + 圆角 8px 8px 0 0 + 41px**（旧写的灰底 #F2F2F2/4px/40px 是错的，已改·见 §状态Tab）；④ **i18n = 自研 `lang()` 默认 pt**（旧写 vue-i18n 已改·见 §1）；⑤ **筛选区固定宽 210/564/112px**（非 33% 等宽网格·见 §5.3）。
> **2026-09-15 登录真 某 OMS（中文态）逐值复校（RPA + getComputedStyle·DPR 处理·复刻商品管理/一件代发出库订单）**：确认并**修回骨架漂移** —— ① **表头** 背景 `#F7F8FA` / 文字 `#999` / 字号 `14px` / 字重 `600`（骨架此前渲染成 EP 默认 白底/#909399/14px = 未套规范·已修）；② **表格行文字 `#444`**（骨架此前继承 body `#333` = 漂移·已修回 #444，与本文 §表格 一致）；③ **工具条/筛选按钮** 高 `32px` · `min-width:80px` · 圆角 `4px` · padding `8px 15px`（骨架此前只给 primary 加 min-width，致重置/新增=auto·已修为全按钮 80）；④ **筛选下拉默认文案 = `options[0]`**（如「全部商品分类」；骨架占位符此前无 ph/label 时退成通用「全部」·已修为退到 options[0]·见 §5.3 占位符）。**新建机器闸 ㊸** `qa/computed-style-gate.js` + `qa/design-baseline.json`：headless 渲染（DeviceScaleFactor=1）**逐元素逐属性 diff 真值基线**，挂进 `deliver-gate` 自动跑、红了禁交付 —— **根治「复刻/默认皮 只对文字结构、漏了 computed 样式」**。**新建骨架能力「整页表单页」`cfg.pageForm`**：导航页内容**直接是一整页 `el-form`（非弹窗）** —— 真系统「新增商品 / 创建出库单」范式（菜单/新增钮点开即整页填单）。写法 `pageForm:{title?, sections:[{cols?(默3), fields:[{label,required?,type?(select/date/textarea/upload/input),ph?,options?,span?(2/3)}]} | {title,table:{columns,rows}}], footer:[{label,primary?}]}`；**字段行距实测 10px·文本域 18px·3 列 label-top·页脚居中带上边框**；列表「新增」钮走 `primaryBtn:{label,goto:'<表单页>'}` 跳整页（对齐真系统 /add 路由），菜单入口走 `nav` 项。**禁再把整页表单做成弹窗**（弹窗≠真系统·2026-09-15 用户逮到「创建出库单是弹窗不对」根治）。**⑤ Element Plus 版本升级 `2.4.4 → 2.6.3`（2026-09-15·对齐真系统）**：真系统用新版 EP（下拉是 `el-select__wrapper` 结构·32px/圆角4），原骨架 EP 2.4.4 是 `el-input__inner`（30px/圆角0）——这是**组件库版本级结构差·CSS 改不掉**，故**把默认皮的 EP 升到 2.6.3**（骨架 CDN + `make-offline.ps1` + `qa/_gate-vendor.js` 三处同步·Vue 3.4.21 兼容不变）。升级后：**筛选下拉 == 真系统 32px/圆角4**（㊸ 基线已转【强制】·非容差）；全量 deliver-gate 45 道全绿（含标注注入⑯——升版本后 `_gate-vendor` 须清旧缓存·已在其加【`.url` 版本标记】按 URL 失效重下·根治"升 EP 用旧缓存致版本错配假红"）。**待定（未改·工程决定）**：字体族（真中文系统 `Noto Sans SC` vs 现 Helvetica 栈·跨地区未动）。
> **2026-09-16 登录真 某 OMS 全组件补校（→ 全部固化进 §2.0 全组件真值总表，以 §2.0 为准）**：① **状态页签 = 卡片式 `el-tabs--card`·选中灰底 `#f2f2f2`/圆角 8 8 0 0/蓝字**（**作废** 2026-07-09 记的「白底 #fff+边框」——那是旧值，真系统实测是灰底卡片，见 §2.0 ⑤ + §4.5）；② **行内操作图标 = 细线 SVG（view/edit/print/return…）·色 rgba(51,99,255,.8)·hover 实色+浅蓝底**（**作废** emoji·见 §2.0 ⑧）；③ **按钮 hover 边框变蓝**（次按钮实蓝 #3363ff/底白·主按钮 rgba .8·见 §2.0 ③）；④ **整页表单按业务分区**（基本信息/规格/产品配对/税务信息/其他…·每区 16px/600 标题+底边线 #dcdfe6·见 §2.0 ⑨）；⑤ **批量工具栏按钮默认可点·不置灰**（点了没勾选才 toast·见 §2.0 ⑩）；⑥ **列表查看=点单号链接**；⑦ 分区标题 16px（非 14）·底边线 #dcdfe6·padding 24 0 10。**新建保真审计器 ㊹ `qa/fidelity-audit.js`**（真系统 ⇄ 复刻件逐维 diff·配置驱动·随包）+ **㊹交付件自检闸 `qa/deliverable-verify-gate.js`**（新旧检查+逐页渲染）+ `rebuild-deliverable.ps1`（交付件重建纪律·见 CLAUDE.md）。

#### 主色 Primary（蓝色系）

| Token | HEX | CSS变量实测值 | 用途 |
|---|---|---|---|
| `primary` | `#3363FF` | `--el-color-primary: #3363ff` | 主操作按钮、链接、激活态 |
| `primary-80` | `rgba(51,99,255,0.8)` | — | **操作列图标颜色（实测）** |
| `primary-hover` | `rgba(51,99,255,0.9)` | — | 操作图标 hover 升至全色 |
| `primary-active` | `#1E4BDD` | — | 点击/按下态 |
| `primary-light` | `rgba(51,99,255,0.08)` | — | 操作图标 hover 背景浅蓝 |
| `primary-bg` | `rgba(51,99,255,0.06)` | — | 选中行浅蓝底 |

#### 状态色 Status

| Token | HEX | CSS变量实测值 | 用途 |
|---|---|---|---|
| `success` | `#67C23A` | `--el-color-success: #67c23a` | 成功状态 |
| `danger` | `#F56C6C` | `--el-color-danger: #f56c6c` | 危险/错误 |
| `warning` | `#F2AC3A` | `--el-color-warning: #f2ac3a` | 警告（≠EP默认#E6A23C）|

#### 文字 Text（实测）

| Token | HEX | 实测来源 | 用途 |
|---|---|---|---|
| `text-body` | `#333333` | basic.scss `$font-color`（实测 2026-07-07） | 表格 td、正文、标题 |
| `text-label` | `#606266` | EP `--el-text-color-regular` | 次级文字、Form Label |
| `text-muted` | `#909399` | basic.scss `$font-color-tip/$font-color-detail`（实测 2026-07-07） | **表格列头**、详情标题、提示、三级文字 |
| `text-placeholder` | `#A8ABB2` | — | 占位文字 |
| `text-link` | `#3363FF` | `rgb(51,99,255)` 充值编号链接 | **可点击的单据编号** |

#### 背景 Background（实测）

| Token | HEX | 实测来源 | 用途 |
|---|---|---|---|
| `bg-page` | `#F2F2F2` | basic.scss `$layout-background-color`（实测 2026-07-07） | 页面整体背景 |
| `bg-card` | `#FFFFFF` | basic.scss `$background-color` | 卡片/弹窗/筛选区 |
| `bg-table-header` | `#F7F8FA` | `rgb(247,248,250)` 表头 | **表格列头背景** |
| `bg-search` | `#f7f8fa` | basic.scss `.search-box` | **筛选区背景** |
| `bg-tab-nav` | `#F0F2F5` | el-table.scss `#tabsBox` | **状态页签导航条背景** |
| `bg-table-selected` | `#F6FFF0` | basic.scss `$table-active-color` | **表格选中行背景** |
| `bg-hover` | `#F5F7FA` | — | 下拉项 hover |
| `bg-nav` | `#122041` | `.header` background（代码确认 2026-07-07·高 50px） | **顶部导航背景**（本系统为顶部横向导航·无侧栏；代码里 Sidebar 组件已注释禁用） |
| `border-base` | `#DCDFE6` | basic.scss `$main-border-color` | 主边框（表格/分割线） |
| `bg-source-tag` | `#EEEEEE` | `rgb(238,238,238)` | 来源标签背景（手动创建/API对接）|
| `bg-platform-tag` | `rgba(230,31,17,0.06)` | 实测 | 平台状态标签背景 |

#### 特殊色

| Token | HEX | 用途 |
|---|---|---|
| `color-platform-status` | `#E61F11` | 平台/业务状态标签文字+边框 |
| `color-warning-text` | `#F56C6C` | 截单倒计时等时间警告文字 |

### 2.2 字体 Typography

**字体家族**：`"Noto Sans SC", system-ui, -apple-system, sans-serif`（2026-07-12 真系统实测 body font = Noto Sans SC；旧写 Inter 有误）

| Token | 字号 | 字重 | 用途 |
|---|---|---|---|
| `text-h-sub` | 18pt / 24px | Medium (500) | 次要标题、卡片小段落标题 |
| `text-h-main` | 16pt / 22px | Regular (400) | 正文 / 主要标题 / 弹窗标题 |
| `text-base` | 14pt / 19px | Regular (400) | 次要文字 / 辅助标题 / 表格内容 |
| `text-input` | 13pt / 17px | Regular (400) | 输入框辅助文字 |
| `text-caption` | 12pt / 16px | Regular (400) | 辅助性 / 提示文字 |

**行高**：默认 `1.5`，紧凑场景 `1.3`

### 2.3 间距 Spacing（标准阶梯）

| Token | 值 | 用途 |
|---|---|---|
| `space-1` | 4px | 最小间距，图标-文字 |
| `space-2` | 8px | 按钮间距、紧凑布局 |
| `space-3` | 12px | 字段内间距 |
| `space-4` | 16px | 卡片内边距 / 字段间距 |
| `space-5` | 20px | 表单字段垂直间距 |
| `space-6` | 24px | 弹窗内边距 / 区块间距 |
| `space-8` | 32px | 区块大间距 |
| `space-10` | 40px | 页面级间距 |

### 2.4 圆角 Border Radius

| Token | 值 | 用途 |
|---|---|---|
| `rounded-sm` | 2px | 标签 / Tag |
| `rounded` | 4px | **默认**（按钮、输入框、卡片、弹窗）|
| `rounded-md` | 6-8px | 大型卡片 / 弹窗（按需）|
| `rounded-full` | 9999px | 头像 / 圆形按钮 |

### 2.5 阴影 Shadow

| Token | 值 | 用途 |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgba(0,0,0,0.04)` | 卡片轻阴影 |
| `shadow` | `0 2px 8px rgba(0,0,0,0.08)` | 下拉菜单 / 工具提示 |
| `shadow-lg` | `0 4px 16px rgba(0,0,0,0.12)` | 弹窗 / Modal |
| `mask` | `rgba(0,0,0,0.5)` | 弹窗蒙层 |

---

## 3. 基础组件

### 3.1 Button 按钮

**4 类型 × 4 状态 × 3 尺寸**：

| 类型 | 用法 | Element Plus |
|---|---|---|
| **主要** | 主操作（保存/确认/查询）| `type="primary"` |
| **默认（白底灰边）** | 次操作（取消/重置）| 默认 |
| **默认（白底蓝边）** | 强调次操作 | `type="primary" plain` |
| **纯文字** | 链接型操作（导出/查看明细）| `type="primary" link` |

**3 尺寸**：`large` / `default` / `small`

**状态**：常规 / 悬浮（`#3363FF` @ 80%）/ 点击（`#1E4BDD`）/ 禁用（@ 40%）

**加载中**：`loading` 属性，主按钮浅蓝（约 60%）+ 旋转图标

```vue
<el-button type="primary" :icon="Plus">Nova</el-button>
<el-button>cancelamentos</el-button>
<el-button type="primary" plain>默认</el-button>
<el-button type="primary" link :icon="Download">Exportação</el-button>
<el-button type="primary" loading>加载中</el-button>
<el-button type="primary" size="large">大号</el-button>
```

### 3.2 Checkbox / Radio

**关键特色**：已选状态下**文字也变主色 `#3363FF`**（比 EP 默认更醒目）

```vue
<el-checkbox v-model="checked">备选项</el-checkbox>
<el-radio-group v-model="picked">
  <el-radio value="A">备选项 A</el-radio>
</el-radio-group>

<!-- 全局样式覆盖 -->
<style>
.el-checkbox.is-checked .el-checkbox__label,
.el-radio.is-checked .el-radio__label { color: #3363FF; }
</style>
```

### 3.3 Input 输入框（8 变体）

| 变体 | EP 写法 |
|---|---|
| 基础 | `<el-input v-model="text" placeholder="请输入" />` |
| 禁用 | `<el-input v-model="text" disabled />` |
| 可清空 | `<el-input v-model="text" clearable />` |
| 带 icon | `<el-input><template #prefix><el-icon><Calendar /></el-icon></template></el-input>` |
| 文本域 | `<el-input type="textarea" :rows="3" />` |
| 复合（左/右）| `<el-input><template #prepend>高度</template></el-input>` 或 `#append` |
| 标签输入（多选）| `<el-select multiple collapse-tags collapse-tags-tooltip />` |
| 字符限制 | `<el-input maxlength="10" show-word-limit />` |

**状态色**：
- 默认边框 `#DCDFE6`
- 聚焦边框 `#3363FF`
- 错误边框 `#F56C6C` + 字段下方红字
- 禁用底色 `#F7F7F7`
- 占位文字 `#A8ABB2`

### 3.4 Select / Dropdown 下拉

**触发器**：白底 + 灰边（默认）/ 蓝边（聚焦）+ `^/v` 箭头
**下拉项**：默认灰字 / hover 浅灰底 / **已选浅蓝底 + 蓝字**
**超长截断**：`...` 末尾，hover 显示 tooltip

```vue
<el-select v-model="value" placeholder="More" filterable>
  <el-option v-for="o in options" :key="o.value" :label="o.label" :value="o.value" />
</el-select>

<el-dropdown trigger="click">
  <el-button>More <el-icon><ArrowDown /></el-icon></el-button>
  <template #dropdown>
    <el-dropdown-menu>
      <el-dropdown-item v-for="item in items">{{ item.label }}</el-dropdown-item>
    </el-dropdown-menu>
  </template>
</el-dropdown>
```

### 3.5 DatePicker 日期选择器

**4 种模式**：选择某一天 / 带快速选项 / 选择日期区间 / 双日期

**选中日期**：实心圆 `#3363FF` + 白字
**今日/聚焦**：蓝字（无背景圆）
**范围内日期**（区间模式）：浅灰底高亮

**🇧🇷 BR 本地化**：
- 显示格式：`DD/MM/YYYY HH:mm:ss`（如 `04/05/2022`）
- 存储格式：ISO `YYYY-MM-DD HH:mm:ss`
- 星期表头：`Dom / Seg / Ter / Qua / Qui / Sex / Sáb`
- 分隔符 `至` → `até`

```vue
<el-date-picker
  v-model="date"
  type="date"
  format="DD/MM/YYYY"
  value-format="YYYY-MM-DD"
  :placeholder="t('common.select_date')"
/>

<el-date-picker
  v-model="dateRange"
  type="daterange"
  format="DD/MM/YYYY"
  value-format="YYYY-MM-DD"
  :range-separator="t('common.to')"
  :shortcuts="[
    { text: t('shortcuts.last_week'), value: ... },
    { text: t('shortcuts.last_month'), value: ... }
  ]"
/>
```

### 3.6 Upload 上传（6 变体）

| 变体 | EP 写法 |
|---|---|
| 基础按钮 | `<el-upload><el-button type="primary">Upload</el-button></el-upload>` |
| 按钮 + 文件列表 | 加 `v-model:file-list="list"` |
| 文件列表 hover | 浅蓝底 + 右侧 × |
| 文件列表成功 | 绿色 ✓ |
| 拖拽上传 | `<el-upload drag>` + 虚线框 + 文件夹图标 |
| 图片网格 | `<el-upload list-type="picture-card">` |

**说明文字**：组件下方 `text-caption` 灰字，如：
> 支持JPG、JPEG、PNG、BMP格式，单个文件大小不超过5M，最多上传10个文件

---

## 4. 数据展示组件

### 4.1 Table 表格（11 变体 + 数据对齐铁律）

**🔑 数据对齐铁律**：

| 字段类型 | 对齐方式 | EP 写法 |
|---|---|---|
| 文本类（编号、名称、状态）| **左对齐** | 默认 |
| **数值/金额类**（价格、数量、库存） | **右对齐** | `align="right"` |
| 日期时间 | 右对齐 | `align="right"` |
| 操作列 | 居中/左 | 自定义 |

**🏛 表头吸顶（真代码 `el-table.scss .gl-table` · 2026-07-09 校正）**：`el-table__header-wrapper` **`position: sticky` 吸顶**（滚动表体时列头始终可见）、下边框 `1px #DCDFE6`；单元格字号 `14px`。与"固定表头 height=600"不同——那是定高滚动，这是 sticky 吸顶。

**11 变体**：
1. 斑马纹（`stripe`）
2. 固定表头（`height="600"`）
3. 固定列（`fixed="left/right"`）
4. 固定列 + 固定表头
5. 数据对齐方式（左/右铁律）
6. 表头基础规范（短文本直接显示）
7. 表头长文本（截断 + tooltip）
8. 表头 + 帮助图标（? 圆形）
9. 完整分页 demo
10. 空状态（表头保留 + Empty 大图）
11. 表单内嵌空状态（小型 Empty）

**操作列图标按钮（实测 示例 WMS）**：
- 图标尺寸：20×20px，容器 26px
- **颜色：统一用 `rgba(51,99,255,0.8)`（主色80%透明）**，不区分蓝/红/橙
- Hover：颜色升为 `#3363FF`（100%）+ 背景 `rgba(51,99,255,0.08)`浅蓝
- 危险操作（删除）hover 才变红 `#F56C6C`，默认态仍为主色80%
- **行级删除不单独显示红色图标**，删除通过勾选 + 顶部工具栏「删除」按钮批量操作

**表格样式（代码实测 WMS/OMS 2026-07-07 · el-table.scss + basic.scss）**：

| 部位 | 值 |
|---|---|
| 表头背景 | `#F7F8FA`（`rgb(247,248,250)`）|
| 表头文字色 | **`#999999`**（2026-07-12 真系统实测 computed·旧写 #909399 有误）|
| 表头字号 | **`14px`**（2026-07-12 真系统登录态 getComputedStyle 实测·th .cell = 14px；曾一度误改13px，已修回）|
| 表头字重 | `600` |
| 表头 padding | **th `8px 0` + cell `0 12px`**（2026-07-12 实测）|
| 行文字色 | **`#444444`**（2026-07-12 真系统实测 computed·旧写 #333333 有误）|
| 行文字字号 | **`14px`**（2026-07-12 真系统实测·td .cell = 14px；曾一度误改12px，已修回）|
| 行 cell padding | **`0 12px`**（line-height `23px` 撑高·2026-07-12 实测）|
| 行分隔线 | `1px solid #EBEEF5` |
| 行高 | `86px`（财务模块，含多行内容）/ `40px`（普通模块）|
| 单据编号链接色 | `#3363FF`，cursor:pointer，fontWeight 400 |
| 空值展示 | `--`（非空字符串，非 null）|

**操作列图标（两种实现模式）**：

**模式 A — 财务模块（PNG 图片）**：
- 结构：`.option-btn > .option-btn-inner > .icon-button > .icon-container > .el-image > img`
- 图片尺寸：`20×20px`，容器 `26×26px`，`border-radius:4px`
- 颜色：`rgba(51,99,255,0.8)`（从父元素继承，图片使用 CSS `color` 属性着色）
- Hover：颜色 `#3363FF`，背景 `rgba(51,99,255,0.08)`
- 危险操作 hover：颜色 `#F56C6C`，背景 `rgba(245,108,108,0.08)`

**模式 B — 仓库模块（SVG 精灵）**：
- 结构：`.option-btn > .icon-button > svg.svg-icon.hover-icon`
- SVG 名称示例：`#icon-new_icon_view`（查看）、`#icon-new_icon_print`（打印）
- 尺寸：`20×20px`，`margin-right:8px`
- 颜色：`#333333`（默认灰），hover 变 `#3363FF`
- 原型中可用 SVG 内联图标替代

**原型中统一使用的简化实现**：
```css
/* 操作图标统一样式（原生 table 原型用） */
.op-icon {
  width:20px; height:20px; cursor:pointer;
  color: rgba(51,99,255,0.8); display:inline-flex;
  align-items:center; justify-content:center;
  border-radius:4px; margin-right:4px;
}
.op-icon:hover { color:#3363FF; background:rgba(51,99,255,0.08); }
.op-icon.danger:hover { color:#F56C6C; background:rgba(245,108,108,0.08); }
```

**标准列表表格骨架**：

```vue
<el-table :data="list" stripe border height="600" @selection-change="onSelect">
  <!-- 复选框列（左固定）-->
  <el-table-column type="selection" width="55" fixed="left" />
  
  <!-- 文本列（左对齐，默认）-->
  <el-table-column prop="name" label="Nome" min-width="180" show-overflow-tooltip />
  
  <!-- 数值列（右对齐）-->
  <el-table-column prop="price" label="Preço" align="right" header-align="right" width="120" />
  
  <!-- 带帮助图标的表头 -->
  <el-table-column prop="status" width="140">
    <template #header>
      Estado
      <el-tooltip content="说明文案"><el-icon><QuestionFilled /></el-icon></el-tooltip>
    </template>
  </el-table-column>
  
  <!-- 操作列（右固定）-->
  <el-table-column label="Operação" width="200" fixed="right">
    <template #default="{ row }">
      <el-button type="primary" link :icon="Edit" @click="onEdit(row)" />
      <el-button type="primary" link :icon="Delete" @click="onDelete(row)" />
    </template>
  </el-table-column>
  
  <template #empty>
    <el-empty :image-size="180" :description="t('empty.no_data')" />
  </template>
</el-table>
```

### 4.2 Pagination 分页

**布局**：`总条数 │ 每页选择 │ < │ 页码 │ > │ 跳转`

**位置**：表格底部

**🏛 吸底 + 容器布局（真代码 `el-table.scss .pagination-container`·2026-07-09 校正）**：分页条 **`position: sticky; bottom: 0` 吸底**（滚动列表时始终可见）；容器 padding `12px 24px`、上边框 `1px #DCDFE6`、`display:flex; justify-content: space-between` → **左侧 `total-box`（共 X 条·行高 32px）/ 右侧 `el-pagination`（页码组·`justify-content:flex-end`）**。

**4 种状态**：默认 / 悬浮（浅蓝底）/ 选中（蓝底白字）/ 禁用（40% 透明）

```vue
<el-pagination
  v-model:current-page="page"
  v-model:page-size="pageSize"
  :page-sizes="[10, 25, 50, 100]"
  :total="total"
  layout="total, sizes, prev, pager, next, jumper"
  background
  class="justify-end mt-4"
/>
```

#### 🏛 分页文案必须本地化（中文/葡语，不能用英文默认）（v1.0 强制 / 2026-06-21）

> 🏛 **铁律**：Element Plus 默认 locale 是**英文**，分页会显示 `Total / X/page / Go to`——**不合格**。中国版必须显示「**共 X 条 / X条/页 / 前往 X 页**」，巴西版显示对应葡语。
> - 做法：挂载时设置 locale：`app.use(ElementPlus, { locale: ElementPlusLocaleZhCn })`（CDN 全量包 `index.full.min.js` **不自带** zh-cn 语言包，需**额外引入** `element-plus/dist/locale/zh-cn.min.js`，全局名 `ElementPlusLocaleZhCn`）。
> - **离线铁律**：该语言包必须**内联进 HTML**（直接 `<script>…</script>` 内嵌，或确保 make-offline 一并内联），否则离线版分页又变回英文。
> - 巴西版同理引入 `pt-br` 语言包（或按地区切换 locale）。
> - 一致性：全站分页统一中文/葡语，禁止某页中文、某页英文。

### 4.3 Status Tag 状态标签（实测 示例 WMS/OMS 2026-06-10）

系统中有 **3 种标签形态**，语义不同，禁止混用：

#### 类型 1：平台/业务状态标签（红色边框）
用于订单平台状态、异常状态等需要醒目提示的场景。

| 属性 | 值 |
|---|---|
| 边框 | `1px solid #E61F11` |
| 背景 | `rgba(230,31,17,0.06)` |
| 文字色 | `#E61F11` |
| borderRadius | `2px`（很小，近矩形）|
| padding | `0 8px` |
| fontSize | `12px` |
| 类名 | `.platform-status` |

```css
.platform-status {
  display:inline-block; font-size:12px; border-radius:2px;
  padding:0 8px; border:1px solid #E61F11;
  background:rgba(230,31,17,0.06); color:#E61F11;
}
```

#### 类型 2：来源/类型标签（灰色方形）
用于标记数据来源（手动创建、API对接等），信息标注性质。

| 属性 | 值 |
|---|---|
| 背景 | `#EEEEEE`（`rgb(238,238,238)`）|
| 文字色 | `#444444` |
| borderRadius | `0px`（完全方形）|
| padding | `1px 10px` |
| fontSize | `14px` |
| 无边框 | — |

```css
.source-tag {
  display:inline-block; font-size:14px; border-radius:0;
  padding:1px 10px; background:#EEEEEE; color:#444444;
}
```

#### 类型 3：计数角标/通知徽章（红色圆形）
用于导航通知、未读计数等。

| 属性 | 值 |
|---|---|
| 背景 | `#F56C6C`（danger 色）|
| 文字色 | `white` |
| borderRadius | `10px` |
| padding | `0 6px` |
| fontSize | `12px` |
| border | `1px solid white` |

#### 类型 4：蓝色圆形计数（Tab 数量）
用于内容区 Tab 旁边的数量显示。

| 属性 | 值 |
|---|---|
| 背景 | `rgba(51,99,255,0.8)` |
| 文字色 | `white` |
| borderRadius | `50%` |
| fontSize | `12px` |

#### 状态文字（非标签）
"已完成"、"待审核" 等状态值直接作为表格 td 内容展示，**不加边框/背景**，颜色用：
- 完成/成功：`#67C23A`（可选，或直接默认文字色）
- 进行中：`#3363FF`
- 警告/待处理：`#F2AC3A`
- 失败/异常：`#F56C6C`

---

### 4.4 Empty 空状态

**2 尺寸 × 4 场景**：

| 尺寸 | 用途 | 图片尺寸 |
|---|---|---|
| 大版 | 独立页 / 全屏列表 | 180×180 |
| 小版 | 表格内嵌 | 100×100 |

| 场景 | 文案 | 触发 |
|---|---|---|
| 暂无数据 | "Não há dados" / "暂无数据" | 列表为空 |
| 网络异常 | "Erro de rede, tente novamente" | 请求失败 |
| 404 | "Página não encontrada" | 路由错误 |
| 无权限 | "Sem permissão para visualizar" | 权限不足 |

**文字规范**：`14px / #909399`

```vue
<!-- 推荐封装 -->
<BaseEmpty type="no-data" size="large" />

<!-- 表格嵌入小版 -->
<el-table :data="data">
  <template #empty>
    <BaseEmpty type="no-data" size="small" />
  </template>
</el-table>
```

### 4.5 Tabs 标签页（实测 示例 WMS/OMS 2026-06-10）

> ⚠️ **重要纠正**：TF 系统的 Tab 激活态**不是蓝底白字**，而是**灰底蓝字**。

**系统中实际存在两层 Tabs，样式完全一致：**

| 层级 | 位置 | 说明 |
|---|---|---|
| **多标签工作台** | 顶部导航下方 | 每个打开的页面对应一个 Tab，可关闭 |
| **内容区状态 Tab** | 列表页表格上方 | 如「全部(16) 已预报(2) 运输中(1)」 |

**实测样式（2026-07-09 按真代码 `el-table.scss #tabsBox` 校正·旧的灰底#F2F2F2/4px/40px 写错，作废）：**

| 状态 | bg | color | fontWeight | height | 圆角/边框 |
|---|---|---|---|---|---|
| **激活** | `#FFFFFF`（**白底**） | `#3363FF`（蓝） | `500` | `41px` | 圆角 `8px 8px 0 0` + 边框 `1px #E4E7ED`、下边框 none |
| 非激活 | `transparent` | `#909399` | `400` | `41px` | 无 |
| Tab 栏（nav-scroll）背景 | `#F0F2F5` | — | — | — | 顶部圆角 `8px 8px 0 0` |

**内容区 Tab 数量计数**：括号内数字用 `rgba(51,99,255,0.8)` 蓝色或灰色文字。item 内边距 `padding:20px`。

```css
/* 内容区状态 Tab 实现（原生 CSS·按真代码 el-table.scss #tabsBox 校正） */
.tab-bar { display:flex; background:#F0F2F5; border-radius:8px 8px 0 0; }   /* nav 条底色 */
.tab-item {
  height:41px; padding:0 20px; line-height:41px;
  font-size:14px; color:#909399; cursor:pointer; white-space:nowrap;
}
.tab-item.active {
  background:#fff; color:#3363FF; font-weight:500;                          /* 选中=白底 */
  border:1px solid #E4E7ED; border-bottom:none; border-radius:8px 8px 0 0;
}
```

```vue
<!-- 列表页状态 Tab (Vue/EP) -->
<el-tabs v-model="status" @tab-change="onSearch">
  <el-tab-pane v-for="s in statusList" :key="s.value" :name="s.value">
    <template #label>{{ s.label }} <span style="color:rgba(51,99,255,0.8)">({{ s.count }})</span></template>
  </el-tab-pane>
</el-tabs>

<style>
/* 覆盖 EP 默认下划线激活为【白底+边框】(真代码 #tabsBox) */
.el-tabs__nav-scroll { background:#F0F2F5; border-radius:8px 8px 0 0; }
.el-tabs__item { height:41px; color:#909399; }
.el-tabs__item.is-active { background:#fff !important; border:1px solid #E4E7ED; border-bottom:none; border-radius:8px 8px 0 0; color:#3363FF; }
.el-tabs__active-bar { display:none; }
</style>
```

### 4.6 对账类列表标准字段（财务对账 / 单据核对 强制）

> 适用：采购对账、门店销售对账、应收/应付对账、各类需"对账/核对"语义的单据列表（含各地区版本，如中国版/巴西版）。

**核心概念**：
- 「对账人/对账时间」= **实际执行对账确认操作的人和时间**（点「对账」确认的人），**不是制单人**；未对账时为空，显示 `—`。
- 「创建人/创建时间」= 制单人和制单时间，始终有值。
- 单据是否同时有这两组角色，决定列表/查询采用「单角色」还是「双角色聚合」形态（见下）。

**强制规则**：

1. **列表展示人员/时间，分两种形态**（位置在业务数值列之后、状态/操作列之前）：
   - **单角色单据**（只有对账人，如门店销售对账——每日销售自动生成、无制单人）：列表用「对账人」「对账时间」两列；未对账显示 `—`。
   - **双角色单据**（同时有创建人和对账人，如采购对账——人工新建对账单）：列表用「人员」「时间」两个**聚合列**，每列两行：`创建：xxx` / `对账：xxx`（未对账的"对账"行显示 `—`）。聚合用 `cell-multi` + `cm-lbl` 结构，与成本调整单列表一致。
2. **禁止把"创建人/创建时间"当成对账信息列名**；对账结果一律叫「对账人/对账时间」（底层数据可为 auditor/auditTime）。
3. **筛选区查询条件，分两种形态**：
   - **单角色单据**：提供「对账人」文本框 + 「对账时间」日期区间。对账时间控件前必须有「对账时间」标题（`ff`+`ff-label`），占位符用「开始时间/结束时间」。**只保留一个时间区间**，禁止再并列其他日期区间（如营业日）。
   - **双角色单据**：用「维度下拉 + 控件」组合，避免堆叠多个日期框：
     - 时间：`时间类型下拉(创建时间/对账时间)` + 一个 `daterange`；下拉决定过滤哪个时间字段。**全程只有一个日期区间**。
     - 人员：`人员类型下拉(创建人/对账人)` + 一个文本框；下拉决定过滤哪个人员字段。
     - 日期 value-format 统一 `YYYY-MM-DD`，显示格式按地区（中国 `YYYY-MM-DD` / 巴西 `DD/MM/YYYY`）。
   - 重置时清空全部相关条件。
4. **一致性铁律**：所有对账类模块、所有地区版本，列名与筛选条件叫法、聚合形态必须一致；同为双角色单据的，必须都用「人员/时间聚合列 + 维度下拉查询」，不允许某处用 4 个独立列、某处用聚合列。
5. 详情页：双角色单据完整展示「创建人/创建时间」+「对账人/对账时间」四项；单角色单据展示「对账人/对账时间」。

| 字段 | 葡语 |
|---|---|
| 对账人 | Conferente / Responsável pela conciliação |
| 对账时间 | Data de conciliação |

> 采购对账（创建人 + 对账人）即下方 §4.7「多角色人员/时间」的一个特例；门店销售对账为单角色，用独立列即可。

### 4.7 多角色人员 / 时间：聚合列 + 维度下拉查询（通用，强制）

> 适用：任何一条记录带**多个"人员 + 时间"角色**的单据。例：采购对账（创建/对账）、成本调整单（创建/审核）、采购/出入库单（创建/发货/签收/收货/上架/取消）、审批流单据（提交/审核/复核）等，含所有地区版本。
> 目的：避免列表被 N 组「人/时间」列撑爆、避免筛选区堆叠多个日期框。

**判定**：一条记录的人员/时间角色 **≥ 2 组**（如"创建人/创建时间" + "审核人/审核时间"）→ 必须按本节聚合；只有 1 组（如仅"对账人/对账时间"）→ 用普通独立列即可，不必聚合。

**1. 列表：聚合成「人员」「时间」两列**（不要为每个角色各开两列）

每列内部多行，每行 `角色：值`，未发生的角色显示 `—`：

```html
<!-- 人员列 -->
<td><div class="cell-multi">
  <div><span class="cm-lbl">创建：</span>{{ row.creator }}</div>
  <div><span class="cm-lbl">审核：</span>{{ row.auditor || '—' }}</div>
</div></td>
<!-- 时间列 -->
<td><div class="cell-multi">
  <div><span class="cm-lbl">创建：</span>{{ row.createTime }}</div>
  <div><span class="cm-lbl">审核：</span>{{ row.auditTime || '—' }}</div>
</div></td>
```

```css
.cell-multi > div { line-height:1.6; white-space:nowrap; }
.cm-lbl { color:#999; }   /* 角色标签用次要色，值用正文色 */
```

- 表头用「人员」「时间」两个字（不写成"创建人/审核人..."一长串）。

**2. 筛选区：每类用「维度下拉 + 单一控件」，绝不堆多个框**

- **时间**：`时间类型下拉` + **一个** `el-date-picker daterange`。下拉项=各时间角色（创建时间/审核时间/发货时间…），决定过滤哪个时间字段。全程只有一个日期区间。
- **人员**：`人员类型下拉` + **一个** `el-input`。下拉项=各人员角色（创建人/审核人/发货人…），决定过滤哪个人员字段。

```html
<div class="ff" style="grid-column:span 2; display:flex; align-items:center">
  <el-select v-model="f.timeType" style="width:120px">
    <el-option v-for="t in timeTypes" :key="t" :label="t" :value="t"></el-option>
  </el-select>
  <el-date-picker v-model="f.dateRange" type="daterange" range-separator="至"
    start-placeholder="开始时间" end-placeholder="结束时间"
    value-format="YYYY-MM-DD" :format="isBR ? 'DD/MM/YYYY' : 'YYYY-MM-DD'"
    style="flex:1;margin-left:8px"></el-date-picker>
</div>
<div class="ff" style="display:flex; align-items:center">
  <el-select v-model="f.personType" style="width:110px">
    <el-option v-for="p in personTypes" :key="p" :label="p" :value="p"></el-option>
  </el-select>
  <el-input v-model="f.personKw" placeholder="请输入" clearable style="flex:1;margin-left:8px"></el-input>
</div>
```

过滤逻辑按下拉值映射到对应字段：

```javascript
// 时间：按 timeType 选字段
const tf = { '创建时间':'createTime', '审核时间':'auditTime' }[f.timeType];
if (f.dateRange?.length===2 && tf) list = list.filter(r => r[tf] && r[tf].slice(0,10)>=f.dateRange[0] && r[tf].slice(0,10)<=f.dateRange[1]);
// 人员：按 personType 选字段
const pf = { '创建人':'creator', '审核人':'auditor' }[f.personType];
if (f.personKw && pf) list = list.filter(r => (r[pf]||'').includes(f.personKw));
```

**3. 详情页：每个角色的人/时间各自独立成项，绝不聚合**

与列表相反，详情页要把每一组**拆开平铺**，各占一个字段项（`ro-item`），不要用 `创建：x 审核：y` 这种聚合写法：

```html
<div class="ro-item"><div class="ro-lbl">创建人</div><div class="ro-val">{{ d.creator }}</div></div>
<div class="ro-item"><div class="ro-lbl">创建时间</div><div class="ro-val">{{ d.createTime }}</div></div>
<div class="ro-item"><div class="ro-lbl">审核人</div><div class="ro-val">{{ d.auditor || '—' }}</div></div>
<div class="ro-item"><div class="ro-lbl">审核时间</div><div class="ro-val">{{ d.auditTime || '—' }}</div></div>
```

- 详情字段标签用完整名（创建人/创建时间/审核人/审核时间…），不用「人员/时间」。
- 未发生的角色显示 `—`。

**三处口径一览（务必一致）**：

| 位置 | 人员 / 时间形态 |
|---|---|
| 筛选区 | 维度下拉(创建人/审核人…) + 一个输入框；维度下拉(创建时间/审核时间…) + 一个日期区间 |
| 列表 | 聚合成「人员」「时间」两列，列内多行 `角色：值` |
| 详情页 | 每个角色的人/时间各自独立成项，**不聚合** |

**4. 铁律**

- value-format 统一 `YYYY-MM-DD`；显示格式按地区（中国 `YYYY-MM-DD` / 巴西 `DD/MM/YYYY`）。
- 同一系统内所有多角色单据**形态必须一致**：都用聚合列 + 维度下拉，不允许有的用聚合、有的拆成多列多框。
- 重置时清空下拉所选维度（回默认项）+ 日期区间 + 输入框。

---

## 5. 导航组件

### 5.1 主框架 Layout

**结构**：顶部导航 + 内容区（**无固定侧栏**，菜单全在顶部）

**🏛 页面最小宽（真代码 `index.vue` · 2026-07-09 校正）**：内容布局容器 **`min-width: 1350px`**（低于此宽出现横向滚动，保证 B 端表格/多列不挤压）。

```
┌────────────────────────────────────────────────────────────┐
│ 示例 WMS │ 12 个一级菜单（PT v / ? / 头像 右侧）              │ ← Header
├────────────────────────────────────────────────────────────┤
│ [Breadcrumb 多标签工作台]                                    │ ← 可选
├────────────────────────────────────────────────────────────┤
│ [Screening 筛选区]                                           │
│ [操作区：Nova / 批量操作 / Exportação]                       │ ← Content
│ [Table 表格]                                                 │
│ [Pagination 分页]                                            │
└────────────────────────────────────────────────────────────┘
```

**Header 规范（实测 2026-06-10）**：
- 背景：`#122041`（`rgb(18,32,65)`，比旧文档#0E1729更深）
- 高度：**50px**（实测，旧文档56px有误）
- Logo："示例 WMS" / "示例 OMS" 白字 + 图标
- 菜单文字：白字 **14px**（实测·2026-08-02），激活项蓝色背景 `#3363FF` + 白字
- Hover：显示悬浮 **Mega Menu**（白色多列下拉，按业务分组，有阴影）
- 右侧：语言切换（Portugués ▾）/ 铃铛通知（红色角标）/ 头像 + 用户名

**12 个一级菜单**（来自 Figma 截图，葡语）：
`Página Inicial / Cliente / Produto / Entrada no Depósito / Saídas / Estoque / Logística / Pós-venda / Financeiro / Dados / Configurações / Mensagens`

### 5.2 多标签工作台（浏览器 Tab 风格，实测 2026-06-10）

**不是传统层级面包屑**，而是 SaaS 浏览器多标签风格，支持同时打开多个页面：

- Tab 栏整体：白色背景（`#FFFFFF`），高度 40px，位于顶部导航正下方
- 当前激活 Tab：**`#F2F2F2` 灰色背景 + `#3363FF` 蓝色文字 + fontWeight 500**（⚠️ 不是蓝底白字）
- 非激活 Tab：透明背景 + `#303133` 深灰文字
- 每个 Tab 右侧有 `×` 关闭按钮
- 右侧有"关闭全部 ×"按钮
- 溢出时水平滚动（不折叠）
- 关闭 Tab 后回到前一个 Tab
- 新增/编辑/详情页均作为**新 Tab** 打开（不是弹窗），Tab 名 = 页面标题

```css
/* 多标签工作台（原型用） */
.tabs-bar {
  background:#fff; display:flex; align-items:center;
  border-bottom:1px solid #E4E7ED; height:40px; padding:0;
}
.tabs-bar .tab-item {
  height:40px; padding:0 20px; line-height:40px;
  font-size:14px; color:#303133; cursor:pointer;
  display:flex; align-items:center; gap:6px; white-space:nowrap;
}
.tabs-bar .tab-item.active {
  background:#F2F2F2; color:#3363FF; font-weight:500; border-radius:4px 4px 0 0;
}
.tabs-bar .tab-item .tab-close { color:#999; font-size:12px; }
```

### 5.3 Screening 筛选区（**无 label**·真系统 `zgl-search-box`）

> 🔴 **2026-07-12 登录态 getComputedStyle 实测·推翻旧值**：
> 旧规范写的「label 112px + 控件 210px + 灰底 #f7f8fa + padding 24px」来自**另一套组件**（WMS `basic.scss .search-box`），
> **与 某 OMS 真系统不符**。某 OMS 用 `zgl-search-box`，最大差别是——**没有 label**！

**真系统筛选区范式：无 label + 宽控件 + 字段名写在占位符里**

```
┌─────────────────────────────────────────────────────────────────┐  白底 #fff · 圆角 6px
│  [全部发票账号        ▾] [创建时间 ▾] [开始时间 - 结束时间     ]  │  padding 16px 16px 0
│                                                                  │
│  [订单号 ▾][⌕批量搜索用逗号,隔开][精确搜索 ▾]  [查询] [重置]      │
└─────────────────────────────────────────────────────────────────┘
   ↑ 字段名在占位符里，不写 label       控件高 32px · 字段 margin 右16 下16
```

| 规则 | 实测值 |
|---|---|
| **label** | **🔴 没有！** 字段名直接放在**占位符**里（`全部发票账号` / `创建时间` / `批量搜索用逗号,隔开`）。骨架 `.search-box .el-form-item__label{display:none}` |
| 卡片 | 背景 **`#fff`**（🔴 不是 #f7f8fa）、圆角 `6px`、padding **`16px 16px 0`**（🔴 不是 24px）|
| 字段宽 | 输入框/下拉 **`285px`**（🔴 不是 210px）、日期范围 **`427px`**（实测 2026-08-02·🔴 不是 447/564）|
| 字段间距 | `margin: 0 16px 16px 0`（右 16、下 16）·flex 横排 |
| **控件高** | **`32px`**（`.el-input__wrapper` / `.el-select__wrapper` / `.el-date-editor` / 按钮**都是 32px**；内部 `input` 元素 30px）·EP `--el-component-size: 32px` |
| 查询按钮 | 主色蓝底填充，高 32px，**min-width 80px**，padding `8px 15px` |
| 重置按钮 | 白底灰边框，高 32px |
| 组合筛选 | 见 §5.3b（真系统大量使用「下拉选字段 + 输入值 + 精确/模糊」三段控件）|

> 💡 **无 label 的好处**：省掉 label 宽度问题，多语言（葡/西/英 label 过长换行）这个老坑**自动消失**。

#### 🔴 2026-09-09 登录态再校（某 OMS·getComputedStyle 实测·补足"生成原型对不上真系统"缺口）

> 用户反馈生成原型在字号/尺寸上偏大、筛选与表单细节对不上。逐面实测后定位并已修入骨架：

| 项 | 真系统实测值 | 骨架修正 |
|---|---|---|
| **基准字号** | `body font-size: 14px` | 骨架 `body` 此前**缺省→浏览器 16px**（全页偏大 ~14% 的头号根因）→ 已补 `font-size:14px` |
| **筛选控件底色** | `.el-input__wrapper` / `.el-select__wrapper` **背景 `#fff` 白底·文字 `#333`**（2026-09-16 登录真系统逐值复校·**作废 09-09 的灰底 #f5f7fa**）| 骨架 `.search-box .el-input__wrapper,.search-box .el-select__wrapper{background:#fff;color:#333}` |
| **新增/编辑表单** | **多列网格（宽页实测 3 列·见 2026-09-10 精确网格）**·字段控件 `400px × 32px`（内部 input 30px）·**白底** radius4；**label 在控件上方·色 `#909399`·14px·label→控件 `margin-bottom:8px`**·必填红 `*`；**列间距 48px**·字段块间距约 20px；底部**居中** `[取消(白)] [保存(蓝#3363FF)]`，按钮 `32px × min-w80` / padding `8px 15px` / radius4 | 骨架 `.form-grid`；label 色补 `#909399`（`:not(.lbl-left)`）·详见下方 2026-09-10 精确网格 |
| **列表/工具栏按钮** | 高 `32px`·min-width `80px`·padding `8px 15px`·radius `4px`·14px/`500`；主按钮蓝底 `#3363FF`、次按钮白底+边框 `#dcdfe6` | 骨架已符（EP default + §5.3）|

> ⚠️ **区分**：筛选区输入框=**灰底 `#f5f7fa`**；新增/编辑表单输入框=**白底 `#fff`**；弹窗内筛选输入框=**白底**。三处别混。

**选择产品类弹窗（实测 2026-09-09）**：宽 **1200px** · 圆角 4px · body padding 0；**标题 16px / weight 600**；内部查询字段 `242–288px × 32px`（白底）+ `[查询(蓝)] [重置(白)]` 32×80；表格表头 14px / `#f7f8fa` / 行高 40px；顶部 `全量选中 / 全部清空` 为文字按钮；**底部 `[取消(白)] [确定(蓝 #3363FF)]` 32px × min-w80**。

**深测补充（2026-09-09·列表页组件内部）**：
- **表格**：表头高 `40px` / padding `8px 0` / **weight 600** / 色 `#999`；单元格 padding `0 12px` / 14px / `#444`；td padding `8px 0`；行分隔 `#ebeef5`。
- **页签（列表顶 tabs）**：高 40px / 14px / 选中色 `#3363FF` / weight 500。
- **分页选中页码**：底 `#3363FF` 白字 / min-w `32px` / radius `2px`（注意：页码 radius 2px，状态Tab radius 8px，二者不同）。
- **工具栏按钮**：`新增 / 查询 / 立即刷新` = **实心蓝 #3363FF 白字（默认 32px·非 small·非 plain）**；`重置 / 删除 / 停用` = 白底 + 边 `#dcdfe6` + 字 `#333`。→ 骨架 addBtn 已由 `size=small + plain` 修正为默认实心（2026-09-09）。
- **操作列图标**：20×20 · 色 `#333`。

**🧬 全站主题令牌 1:1（2026-09-09 从真系统 getComputedStyle 全量抽取 140 个 CSS 变量·已烙入骨架 `:root`）**：整套 Element Plus 主题令牌**原样复制真系统**，全站组件（按钮/输入/表格/标签/分页/弹窗/表单）由此自动派生，确保与真系统一致。关键定制（区别于 EP 原生默认）：
- 主色 `--el-color-primary:#3363ff` · 色阶 light-7 `#3363ff` / light-9 `#fff` / **dark-2(hover) `#1e4bdd`**（真系统用扁平色阶，非 EP 混白算法）
- 警告 `--el-color-warning:#f2ac3a`（EP 默认 #e6a23c）· 正文 `--el-text-color-regular:#333`（EP 默认 #606266）
- **字体族 `--el-font-family:"Helvetica Neue",Helvetica,"PingFang SC","Hiragino Sans GB","Microsoft YaHei",...`**（原骨架用 Noto Sans SC=漂移，已改）
- 组件尺寸 32/24/40 · 圆角 base4/small2 · fill-light `#f5f7fa` · bg-page `#f2f3f5` · 按钮边 `#b7babf`/hover `#1e4bdd`

**✅ WMS 系统实测同令牌（2026-09-09 登录 www.example-wms.com 抽取 140 令牌）**：WMS 与 OMS 的主题令牌**逐个相等**（primary #3363ff / 色阶 / warning #f2ac3a / 正文 #333 / 字体族 / 14px / 32px / 圆角4 / fill-light #f5f7fa / bg-page #f2f3f5 全同）→ **两系统同一套设计语言，本默认规范一套 1:1 覆盖 OMS + WMS**。

**✅ 查看/详情页实测（2026-09-09·OMS 商品查看 /goods/goodsManage/view）**：**整页**（非弹窗）· `el-form label-top` 只读回显；**label 在控件上方 · 色 #909399 · 14px · 字段 margin-bottom 10px**（与新增/编辑表单完全一致→骨架 `.form-grid` 已覆盖）；**分组标题（基本信息/规格/产品配对）16px / weight 600**；底部「返回」白底按钮 32px（§8.3 居中返回）。→ 查看页外观与令牌/表单规范一致，无需额外改。

> ✅ **页面类型范式已全覆盖**：列表/筛选/新增/编辑/**查看**/弹窗 六类页面类型的组件与数值均已实测对齐（OMS+WMS 同令牌）。剩余「各模块具体页面用哪些字段/列」属**内容组合**（按业务而定，非默认规范范畴）——要 1:1 复刻某个具体真实页面时，以该页为参考逐页比对，禁凭记忆臆造。

#### 🔴🔴 2026-09-10 RPA 全量实测·精确网格（纠正此前"两列"错误·根治"字段挤/重叠"）

> 用户报「查询筛选区 / 新增页 / 编辑页字段挤在一起、重叠」+「新增/编辑/查看尺寸没写进规范」。用 RPA 登录 OMS 逐页 getComputedStyle 精确量取（商品管理列表+新增表单、一件代发出库订单列表），**以下为强制网格底线，layout-sanity-gate（㊷）机器卡死重叠/溢出**：

**① 查询筛选区（列表页顶部·实测 商品管理 + 一件代发出库订单，两模块一致）**
| 项 | 实测值 |
|---|---|
| 控件宽 × 高 | **285px × 32px**（标准输入/下拉）；小下拉 140px；日期范围 445px；批量搜索输入 305px；前缀选字段下拉 114–140px |
| 每行列数 / 列间距 | **一行 4 列**；列 x = 40 / 341 / 642 / 943 → **列间距 301px**（控件 285 + 间隙 16） |
| 行间距（垂直） | 行 y = 130 / 178 / 226 / 274 → **行距 48px**（控件 32 + `margin-bottom:16px`） |
| label | 多数**无 label**（字段名进占位符）；有 label 时 `label-left` · 14px / 400 / `#333` |
| 卡片 padding | `16px 16px 0` · `[Buscar 蓝]`+`[Limpar 白]` 末行右对齐 |

**② 新增 / 编辑表单（整页·实测 /goods/goodsManage/add·⚠️纠正 §5.2b「两列」为实测「3 列」）**
| 项 | 实测值 |
|---|---|
| 列数 / 列间距 | **3 列**（宽页）；控件 x = 48 / 496 / 944 → **列间距 448px**（控件 400 + 间隙 48）。窄弹窗表单退化为 2 列/1 列 |
| 控件宽 × 高 | **400px × 32px**（内部 input 30px）· 白底 · radius4 |
| label（**在控件上方 label-top**）| 色 **`#909399`** · 14px / 400 · lineHeight 22px · **label→控件间距 `margin-bottom:8px`** · 必填红 `*` |
| 字段块行距（垂直） | 字段块（label 22 + 间隙 8 + 控件 32 = 62）+ **块间距约 20px** → 行 y 步进 ~82px。**禁把两行字段挤到 <62px 高、禁重叠** |
| 分区标题 | 「Informações Básicas」等分组标题 **加粗 + 下边框分隔线**，其上下留白 |
| 底部按钮 | **居中** `[Cancelar 白底+#dcdfe6] [Salvar 蓝#3363FF]` · 32px / min-w80 / padding 8-15 / radius4 |

**③ 查看/详情页**：整页 · label-top 只读回显（同 ② 的 label #909399 / 14px / 上方 / 8px 间距）· 分组标题加粗 · 底部「返回」白底按钮居中。

**④ 反挤/反重叠底线（㊷ layout-sanity-gate 机器强制）**：任意两个可见板块（卡片 / 筛选行 / 字段块 / 表格 / 分页）**boundingRect 不得相交**；页面**不得出现 body 横向滚动条**（内容撑爆=挤的根源）；字段块之间保留上表实测间距（筛选 16px、表单块 20px、列间隙 48px）。违反 = 闸红 = 禁交付。

### 5.2b 【默认规范 = 某 OMS 真系统】实测细节总表（2026-07-12 登录态 getComputedStyle）

> **用户选「默认 UI 设计规范」= 按本表落地。** 每条都是真系统实测值，不是推测。
> 画**任何业务**的原型都套这套皮（跟画的是发票、订单、库存无关）。

| 部件 | 真系统实测值 | 骨架落地 |
|---|---|---|
| **顶部导航** | 深色 `#122041` · 高 **50px** · 主菜单=各模块 · **悬停展开多列分组大菜单** | §5.3g |
| **页签条** | 高 **40px** · 白底 · 无下边框 · item `padding 0 20px` · 14px `#303133` · 可关闭 | `.pagetabs` |
| **内容左边距** | **24px** | `.content` |
| **筛选区卡片** | **白底 `#fff`** · radius **6px** · padding `16px 16px 0` | `.search-box` |
| **筛选字段** | **纯占位下拉，无 label**（见 §5.3a）· 输入内高 30px | §5.3a |
| **组合筛选** | 下拉选字段 + 输入 + 精确/模糊，三段合一（`zgl-search-box`）| §5.3b |
| **工具栏** | `已选 : N`（14px `#333`）+ 按钮（高 **32px** · padding `8px 15px` · 14px · radius 4px）| `.sel-toolbar` |
| **列表卡片** | 白底 · radius **4px** · padding 0 · **无阴影** | `.gl-table` |
| **表头** | bg `#f7f8fa` · **`#999` · 14px · weight 600** · th padding `8px 0` · cell `0 12px` | §4.3 |
| **表格正文** | **`#444` · 14px** · line-height 23px · cell padding `0 12px` | §4.3 |
| **行高** | **86px**（财务多行内容）/ 40px（普通）| — |
| **行内操作** | **蓝色图标**（`rgba(51,99,255,.8)` · ~24px · 带 tooltip），**不是文字链接** | §5.3j |
| **状态列** | ●圆点 + 彩色文字（绿=正常/已授权，红=失败/过期，灰=创建中）| `cell()` |
| **可点单元格** | 蓝链 `#3363FF` + 行内 ✎ 铅笔 | `cell()` |
| **标签单元格** | 蓝色 tag（如「样品/赠品税种」）· 12px | `cell()` |
| **报错单元格** | 红色 tag（如 `[TFFISCAL] products[0].ncm cannot be empty`）· 列宽 ≥280px | §5.3h |
| **分页** | 右对齐 · `total, sizes, prev, pager, next, jumper` · 14px `#303133` | §4.2 |
| **弹窗** | 480px · padding 20 · radius 4 · 标题 16px w600 · **label-top** · 底部右对齐 | §5.3d 区 |
| **查看（只读）** | **整页新页签**：顶部状态步骤条(过程型) + 3列label在上**只读回显**(空值`--`) + **底部居中单个「返回」**。**非弹窗·非[取消][提交]**。详见 §8.3、§8.0 | `detailView` |
| **新增/编辑** | **整页新页签**：3列label在上 + 必填红`*` + sticky 底部 `[取消][主操作]`。主操作文案**按流程**：标准新增/编辑=**保存**·设置配置类=**提交**·向导=**继续**。详见 §8.2、§8.0 | `detailView` |
| **注意事项框** | 橙底 `#fdf6ec` · ⓘ `#f2ac3a` · 标题「注意事项：」`#b3762a` | §5.3c |
| **左状态面板** | 白底卡片 · 条目右对齐计数 · 分组可折叠 · **点了要换数据** | §5.3i |
| **行内可编辑表格** | 单元格嵌 select/数字+%/勾选框/输入/🗑 | §5.3f |
| **空状态** | 插画 + 「暂无数据」 | EP 默认 |

#### 5.3k 表单字段类型必须齐全（⚠️缺一种就渲染成 `[object Object]`）

真系统弹窗/表单里出现的字段类型，骨架**三处渲染器（通用弹窗 / 编辑弹窗 / 详情整页）都必须支持**，否则该字段掉进默认 `el-input`，对象值被渲染成 **`[object Object]`**（2026-07-12 用户截图逮到：新增向导的「A1 证书」）。

| 类型 | 写法 | 渲染 |
|---|---|---|
| 上传 | `{"type":"upload","upText":"上传证书"}` | **「＋ 上传证书」蓝色文字链**（真系统就是链接，不是输入框）|
| 密码 | `{"type":"password","ph":"请输入"}` | 密码框 |
| 只读 | `{"disabled":true}` | 灰底禁用输入框（如 CNPJ）|
| 下拉/日期/开关/多行/只读文本 | `select` / `date` / `switch` / `textarea` / `readonly` | 对应控件 |

**必填红星**：`{"required":true}` → 标签前红 `*`（真系统 CNPJ*/A1证书*/A1密码* 都带）。
**按钮文案**：`okText` / `cancelText`（真系统新增向导是 **「继续」**，不是「确定」）。

#### 5.3m 工具栏按钮分两类（⚠️别一刀切禁用）

> 2026-07-12 用户逮到：「新增样品/赠品税种」**永远是灰的点不动**——因为被塞进 `selectActions`，而那类按钮一律"没勾选就禁用"。

| 类型 | 写法 | 禁用规则 |
|---|---|---|
| **真·批量操作**（删除 / 批量启用 / 批量停用）| `"删除"` 或 `{label:"删除"}` | **依赖勾选**：`已选=0` 时禁用（默认行为）|
| **新增类动作**（新增样品/赠品税种 / 导入 / 导出）| `{label:"新增样品/赠品税种", needSel:false, opens:"sampleTax"}` | **永不禁用**，任何时候都能点 |

两类都支持 `opens:"弹窗名"` → 点开对应 `dialogs[名]`；不写 `opens` 则弹提示。
骨架 `needSel(b)` 判定：**只有显式写 `needSel:false` 才不依赖勾选**（默认 true，保持批量操作行为不变）。

#### 5.3i2 按状态覆盖【整套页面配置】（🔴 2026-07-13 实测校正·不只是换数据）

> 真系统「发票管理」点左侧状态面板切换时，**列 / 工具栏 / 页签 / 行内操作 全都跟着换** —— 不是只换一批数据。我曾错用同一套 10 列，实测推翻。

| 状态 | 列 | 出库/入库页签 | 工具栏 |
|---|---|---|---|
| 开票中 / 开票失败 | **10 列**（序列号…创建时间·无状态无操作）| ✅ 有 | **无** |
| 近期发票 / 历史发票 | **12 列**（+ 状态 + 时间 + 操作）| ✅ 有 | 打印发票 / 开退票 / 开具CC-e / 取消发票 / 导出 |
| **异常发票** | 🔴 **完全不同的 7 列**：key / 订单信息 / 平台信息 / **异常原因** / **处理结果** / 时间 / 操作 | 🔴 **没有页签** | 开退票 / 取消发票 / 标记为已忽略 |

🔴 **2026-07-13 二次校正（我第一次扫描漏了）**：扫页签时**只找了「出库/入库」**，导致漏掉两处——

| 状态 | 真实页签（全部） |
|---|---|
| 开票中 / 开票失败 | 出库 \| 入库 |
| **近期发票 / 历史发票** | **全部 \| 出库 \| 入库 \| CC-e**（4个）|
| **异常发票** | **待处理 \| 处理中 \| 失败 \| 已处理 \| 已忽略**（5个·**不是"没有页签"**）|

**筛选条件：所有状态完全统一 8 项**（我曾以为各不同）：
`全部发票账号` `全部状态` `全部发票类型` `全部平台` `全部店铺` `全部异常原因` + `创建时间[开始~结束]` + 组合控件。
**唯一差异**：组合控件左侧**默认字段**随状态变 —— 开票中=`订单号`、失败/近期/历史=`发票号`、异常=`key`。
⚠️ 骨架里组合控件左下拉的占位符必须用 `f.label`（该状态默认字段），**不能用 `fields[0]`**（那样所有状态都显示同一个）。

**异常发票页顶部有专属说明块**（`alertTitle` + `alert`）：
> **异常发票认定：** ① 取消/退货订单发票：90天内取消（全平台）或退货（仅 Mercado Livre/Shopee/Shein）订单关联发票。② 重复发票：同一订单多张发票中，未上传平台且未取消、未开退票的发票（重开发票不认定为异常）
> **合规指引：** 可取消异常发票或开退票抵扣，避免多缴税

**数据写法**：
```json
"byStatus": {
  "issuing":  { "filters":[...8项·组合默认=订单号], "columns":[...10列], "actions":null, "selectActions":[], "statusTabs":[出库,入库], "rows":[...] },
  "recent":   { "filters":[...8项·组合默认=发票号], "columns":[...12列], "actions":[查看], "selectActions":[打印发票,开退票,开具CC-e,取消发票,导出], "statusTabs":[全部,出库,入库,CC-e] },
  "abnormal": { "filters":[...8项·组合默认=key],   "columns":[...7列],  "actions":[查看], "selectActions":[开退票,取消发票,标记为已忽略],
                "statusTabs":[待处理,处理中,失败,已处理,已忽略],
                "alertTitle":"异常发票认定：", "alert":["1、取消/退货订单发票…","2、重复发票…","合规指引：…"] }
}
```
骨架用 `curFilters / curColumns / curActions / curSelActions / curStatusTabs / curRows / curAlert / curAlertTitle` 渲染；`byStatus[当前状态]` 覆盖顶层 `cfg`，写 `null` 可**显式抹掉**。旧的 `rowsByStatus`（只换数据）仍兼容。

> 📌 **扫描教训**：抓真系统页签时**别加过滤条件**（我当时只 grep「出库|入库」→ 漏掉异常发票自己的 5 个 tab 和已开票的「全部/CC-e」）。**全抓，再分类**。

#### 5.3o 输入框：前缀标签 + 字数统计（真系统税种详情实测）

| 控件 | 写法 | 真系统实例 |
|---|---|---|
| **前缀标签** | `{ "label":"交易性质", "prefix":"出库", "max":60 }` | `[出库] Bonificação - Sem finalidade de Revenda` |
| **字数统计** | `{ "max": 1000 }` → 右下角显示 `39 / 60`、`2 / 1000` | 税种名称、交易性质 |
| textarea 字数 | `{ "type":"textarea", "max":200 }` | 补充信息（Fisco）`0 / 200` |

#### 5.3p 重复字段组（真系统税种详情 ICMS/IPI/PIS/COFINS）

税种详情里，每个税种块的字段**按「场景」重复 N 次**（不是简单表单）：

| 税种块 | 每组字段 | 组数 |
|---|---|---|
| ICMS | 场景* / 客户类型* / **CFOP*** / 纳税类型(CST)* | **4 组** |
| IPI | 场景* / 客户类型* / CST* / Código de enquadramento* / 税率* / 备注 | 2 组 |
| PIS / COFINS | 场景* / 客户类型* / CST* / 税率* / 备注 | 2 组 |

用 `sections[].fields` 直接把 N 组字段平铺展开即可（骨架 `cols:2` 双列自动排布）。

**整页底部主操作文案【按流程分·⚠️别一刀切】**：
- **标准新增/编辑**（如「新增商品」`/goods/goodsManage/add`·2026-07-26 DOM 实测）→ **`[取消][保存]`**
- **设置/配置类整页**（税种详情·发票主体设置·2026-07-12 实测）→ **`[取消][提交]`**
- **分步向导** → **`[继续]`**
- 查看（只读）→ **居中单个「返回」**（不是取消/提交，见 §8.3）
> 画哪个页用哪个页的真实文案；缺证时默认「保存」。曾误当"整页一律提交"→ 导致新增表单底部漂移。

#### 5.3q 空状态 / 加载态（真系统 2026-07-13 实测）

| | 实测值 |
|---|---|
| **空状态** | 容器高 **366px**·背景透明；**插画 180×180**（骨架用内联 SVG·离线也在）；文案「暂无数据」**#909399 · 14px** |
| **加载态** | 表格盖 `v-loading`：遮罩 **`rgba(255,255,255,0.9)`** + **主色 `#3363FF` 转圈**·**无文案**·absolute 覆盖表格区 |
| **何时 loading** | 点【查询】(700ms) / 【重置】(500ms) / **切换左侧状态项**(600ms) —— 真系统换数据都会转圈，**不许"点了瞬间就变"**，那不像真系统 |

> ℹ️ **表格列设置/排序/密度：真系统没有**（实测确认只有 EP 内部 hidden-columns，无列设置按钮）。别自己加。

#### 5.3r 弹窗：字段块 与 表格【可以同时有】（2026-07-14 实测逮到）

真系统的复杂弹窗常常是「**表单字段 + 内嵌表格**」组合，例如 某真实业务系统「生成采购单」：
> 上半：仓库\* / 供应商\* / 商品金额 / 运费 / 折扣 / 其他费用（自动算）/ 平均成本（当日汇率 CNY→BRL）
> 下半：**SKU 配对表**（发票商品 / 数量 / 仓库SKU配对[下拉] / 采购单价[输入] / 配对状态）+ [手动添加商品]

⚠️ 骨架旧版写成 `v-if 表格` / `v-else-if 字段` = **二选一** → 两者都配时**字段整块消失**。
现已改为**先渲染字段块、再渲染表格**（都要），且弹窗内表格同样支持**行内可编辑单元格**（`{ctrl:…}`）与 `addBtn`。

弹窗字段块也补齐了 `max`（字数统计）与 `prefix`（前缀标签），与详情页字段能力一致。

#### 5.3r 多选网格（弹窗里的「全选 + 两列勾选」·实测 某真实业务系统「同步采购发票」）

```
┌─ 同步采购发票 ────────────────────────────── ✕ ─┐
│  ☐ 全部公司                                      │
│  ──────────────────────────────────────────────  │
│  ☐ APAUL COM LTDA        ☐ TEX INC DISTRIBUICAO │
│    64.962.869/0001-08      49.018.828/0001-66   │  ← 灰色副行(CNPJ)
│  ☐ OMEGA COMERCIAL       ☐ LIBERAL COMERCIAL    │
│    …（可滚动）                                    │
│                              [取消]  [确定]      │
└──────────────────────────────────────────────────┘
```

| 部件 | 实测 |
|---|---|
| 全选 | `☐ 全部公司` 在最上，下方**发丝分割线**；勾它 → 全部勾上；任一项取消 → 全选框**自动取消** |
| 网格 | **两列**（`grid-template-columns: 1fr 1fr`）·可滚动（`max-height:340px`）|
| 每项 | 勾选框 + **名称**（14px #333）；下方**灰色副行**（12px `#a8abb2`，如 CNPJ）|

**数据写法**：`{ "type":"checkGrid", "allLabel":"全部公司", "items":[{"label":"APAUL COM LTDA","sub":"64.962.869/0001-08"}, …] }`

#### 5.3s 页面级右上角主按钮（⚠️ 别和表格工具栏的按钮混）

真系统「同步发票」在**筛选区右上角**，**不在表格工具栏里**。两个是不同位置：

| 位置 | 数据字段 | 例子 |
|---|---|---|
| **页面右上角**（筛选区之上·右对齐）| `cfg.pageBtn` | 同步发票、导入 & 导出 |
| **表格工具栏**（「已选:N」那一行）| `cfg.primaryBtn` + `cfg.selectActions` | 新增、删除、发票声明、忽略 |

#### 5.3t 行内操作「可点但拦截」（🔴 用户定·2026-07-14·别用隐藏）

> **规则不符时，不要把按钮藏起来 —— 藏了用户根本不知道有这条规则。**
> 正确做法：**按钮照常显示，点了给拦截提示**（把规则说出来）。这也是真系统的做法。

**真系统的拦截话术（原文）**：
- 「超过 24 小时不可取消，请开退票」
- 「历史发票不支持取消，请使用开退票」
- 「金额类信息不可通过 CC-e 修正，请重开发票」
- 「该发票 CC-e 已达 20 次上限」
- 「交易未完成 (Operação Não Realizada) 是终态，不可再做发票声明」

**数据写法**：
```json
{ "label":"发票声明", "opens":"manifest",
  "blockIf": { "when":"Não Realizada", "msg":"交易未完成是终态，不可再做发票声明" } }
```
→ 该行任一单元格文本含 `when` 时，点击 = **弹 warning，不执行**。骨架 `actBlocked()`。

#### 5.3i3 顶部状态页签也能覆盖配置（不只是视觉高亮）

真系统的页签（待处理/已处理、出库/入库、待处理/处理中/失败/已处理/已忽略）切换时，**数据 / 行内操作 / 工具栏 都会变**。

**优先级**：`statusTabs[当前页签]` > `byStatus[左面板状态]` > 顶层 `cfg`

页签项直接挂覆盖字段：
```json
"statusTabs": [
  { "key":"pending", "label":"待处理", "count":6,
    "rows":[…], "actions":[查看, 发票声明], "selectActions":[发票声明, 忽略] },
  { "key":"done", "label":"已处理", "count":4,
    "rows":[…], "actions":[查看, 发票声明], "selectActions":[发票声明] }
]
```
⚠️ **`curRows` 必须走 `pick2`** —— 否则切页签只换了操作、数据还是旧的（2026-07-14 实测逮到）。

#### 5.3n 增删改必须真能操作（🔴 用户铁律·2026-07-12）

> **"所有的新增、编辑、删除，凡是页面有按钮的，都要可以进行操作。"** —— 不许出现点了没反应、或永远灰着点不动的按钮。

骨架已内置，**不用逐页配数据**：

| 动作 | 骨架行为 |
|---|---|
| **删除**（行内 🗑 / 批量）| **真删行**：弹二次确认「确定删除选中的 N 条记录？删除后不可恢复。」→ 确定后从数据里 splice 掉、清空勾选。识别三种写法：`"删除"` / `{label:"删除"}` / **裸三语对象 `{zh:"删除",en:"Delete"}`**，或显式 `{act:"delete"}` |
| **新增 / 新建**（主按钮）| 配 `opens:"弹窗名"` + `dialogs[名]` → 开弹窗。**每个新增按钮都必须配弹窗**，只弹 toast 不算数 |
| **编辑**（行内 ✎）| `opens:"detailView"`（整页）或 `"formDialog"`（弹窗）|
| **导入**（含"批量导入"）| 骨架**内置导入弹窗**（选文件 .xlsx/.xls/.csv + 模板提示 + 确定），无需配数据 |
| **导出** | 骨架内置反馈「已导出 N 条记录」|
| 其它按钮 | 兜底 toast「XX：已执行」——**保证任何按钮点了都有可见反馈，绝不静默** |

⚠️ 行内操作必须把当前行传进去：`@click="fireBtn(a, row)"`，否则删除不知道删哪行。

#### 5.3l 交互必须真能用（⚠️不许"点了没反应"）

- **「添加XX」按钮必须真加行**：`sec.table.addRow` 配模板行 → 点击 push 一行（骨架 `addTableRow`，深拷贝防共享）。没配模板则克隆末行并清空可编辑值。
- 同理：状态面板点了要换数据（§5.3i）、页签点了要切换、行内 ✎ 点了要进详情。
- **判定标准**：原型上任何可点的东西，点了都得有可见反馈。"点了没反应" = 未完成。

#### 5.3j 行内操作 = 图标（真系统实测·⚠️不要用文字链接）

真系统操作列是**图标按钮**：色 `rgba(51,99,255,.8)`（主色 80% 透明）、约 24px、hover 变实色、**带 tooltip 显示操作名**。
**写法**：`"actions": [ {"label":"设置","icon":"edit","opens":"detailView"}, {"label":"删除","icon":"delete"} ]`
内置图标名：`edit ✎` / `delete 🗑` / `view 👁` / `copy ⧉` / `download ⤓`。**不写 `icon` 才退回文字链接**（老原型兼容）。

#### 5.3a 筛选字段 = **纯占位下拉，不写 label**（真系统实测·2026-07-12·⚠️最易做错）

> **真系统的筛选条件没有前缀 label**，靠 placeholder「全部XXX」表意。实测 `/finance/invoiceManage/{invoice,taxation}` 采集到的 filters **label 全是空字符串**。

```
真系统 ✅  [全部发票账号▾] [全部状态▾] [全部发票类型▾] [全部平台▾] [全部店铺▾] [全部异常原因▾] [创建时间范围] [订单号▾|输入|精确搜索▾] [查询][重置]
错误 ❌    发票账号 [全部]   状态 [全部]   发票类型 [全部]  …      ← 多加了一堆 label
```

| 规则 | 内容 |
|---|---|
| **下拉字段** | **省略 `label`**，只写 `ph`（占位）= 「全部XXX」；下拉第一项也是「全部XXX」。写法：`{ "type":"select", "ph":"全部状态", "options":["全部状态","正常","停用"] }` |
| 何时才写 label | 仅当真实界面确有前缀标签时。骨架规则：**写了 `label` 才渲染标签，不写就是纯占位下拉**。 |
| 日期范围 | `{ "type":"date", "ph":"创建时间" }` → 渲染「开始时间 － 结束时间」区间选择器 |
| 组合筛选 | 见 §5.3b（三段合一，本身也无 label） |

#### 5.3b 组合筛选控件（真系统 `zgl-search-box`·2026-07-12 登录态实测）

> 真系统的搜索区**大量使用"三段组合控件"**：`[下拉选字段 ▾] + [输入值(带🔍)] + [精确/模糊 ▾]` 三段合一，后跟 `[查询][重置]`。这是 某 OMS 最典型的筛选范式，骨架用 `type:'combo'` 表达。

```
┌──────────┬────────────────────────┬──────────┐  ┌──────┐ ┌──────┐
│ 发票账号 ▾│ ⌕ 批量搜索用逗号,隔开    │ 精确搜索 ▾│  │ 查询 │ │ 重置 │
└──────────┴────────────────────────┴──────────┘  └──────┘ └──────┘
  下拉选字段(150px)   输入值(264px)      匹配方式(130px)   蓝底     白底
```

| 部件 | 实测值 |
|---|---|
| 左·下拉选字段 | `el-select` 宽 ~150px，圆角只留左侧 `4px 0 0 4px` |
| 中·输入值 | `el-input` 宽 264px，内高 30px，圆角 0，前缀🔍图标(#a8abb2)，占位"批量搜索用逗号,隔开" |
| 右·匹配方式 | `el-select` 宽 ~130px，圆角只留右侧 `0 4px 4px 0`，值 精确搜索/模糊搜索 |
| 三段 | `margin-left:-1px` 合并边框，看起来是一个整体控件 |

**数据写法**（project-data `filters` 项）：`{ "type":"combo", "label":"发票账号", "fields":["发票账号","公司名称","CNPJ"], "ph":"批量搜索用逗号,隔开", "match":["精确搜索","模糊搜索"] }`。骨架 `.combo-filter` 渲染，无 label。
独立下拉（如「全部状态」）可与组合控件**并存同排**（真系统税种管理页实测）。

> **🔴 商品查询固定标准【强制·默认规范·2026-07-26 用户定】**：**任何页面涉及"商品"的查询条件，一律用这一个组合控件**，字段与匹配项固定、顺序固定，禁各处写零散 SKU/商品名称输入框：
> `{ "type":"combo", "label":"SKU编号", "fields":["SKU编号","商品名称","商品条形码","参考SKU编号","商品别名"], "match":["精确搜索","模糊搜索","前缀搜索"], "ph":"批量搜索用逗号,隔开" }`
> 覆盖：库存策略 / 库存分配 / 分销库存统计 / 分销商品 等所有商品列表页。详见真理源提取档 §2.1.1（维护者本地保留·未随公开包）。
>
> **🔴 列表"商品信息"单元格固定标准【强制·同上】**：所有列表"商品信息"列一律用同一张卡片 = `[缩略图 44×44·无图显示 No photo]` + 四行 `编号：<SKU 蓝链 #3363FF>` / `名称：<商品名·超长两行截断>` / `条码：<barcode>` / `参考：<refSKU 或 -->`。见 `§2.1.2`。

#### 5.3c 注意事项框（真系统 `el-alert` warning·2026-07-12 实测）

> 真系统在编辑页各 tab、列表页顶部**大量使用**橙色注意事项框说明业务规则。

橙底 `#fdf6ec`、圆角 4px、padding `12px 16px`；ⓘ 图标 `#f2ac3a`；标题「注意事项：」`#b3762a` 加粗独占一行；条目 14px `#7d5a2a`、行高 22px。
**数据写法**：页面级 `cfg.alert`、详情分块级 `sec.alert`；值为 `"单条"` 或 `["条1","条2"]`。骨架 `.tf-alert` 渲染。

#### 5.3d 开关规则块（真系统「高级规则」·2026-07-12 实测）

`[switch] 主说明（14px #444，开关右侧）` + 下方**整行**灰色副说明（12px `#a8abb2`）。
**数据写法**：`{ "label":"买家主体", "type":"switch", "desc":"开启后…按产品全额开票", "sub":"匹配该规则后，不再执行其他规则" }`。
⚠️ 副说明必须 `flex-basis:100%`（`el-form-item__content` 是 flex，否则挤到同一行）。

#### 5.3e 表格单选(radio)列（真系统「默认税种」）

详情分块表格支持首列单选：`sec.table.radio = "默认税种"`，选中值绑定该行首列。

#### 5.3f2 顶栏右侧控件 = **固定顺序**（2026-07-12 用户定·不许乱序）

```
… [🌐 多语言切换 ▾] [▤▥ 菜单模式] [🔔³³ 消息图标] [admin Ⓣ 头像] [标注 ●━]
```

| 控件 | 说明 |
|---|---|
| **① 多语言切换** | `🌐 中文 ▾`（单语原型不显示）|
| **② 菜单模式** | `▤` 顶部导航 / `▥` 左侧菜单（见 §5.3g）|
| **③ 消息图标** | 🔔 + **红色圆角标**（`#F56C6C`·>99 显示 `99+`）·数据 `topbar.notif` |
| **④ 头像** | 账号名 + **圆形头像**（主色底·首字母）·点开下拉：个人中心 / **修改密码** / 退出登录（实测）·数据 `topbar.user` |
| **⑤ 标注开关** | 放在头像**之后**（默认关闭·见验收清单二） |
| **⑥ 标注工具条（开关打开后显示）** | 【复制已圈功能】【导出分享版】【导出对接料·喂AI】【一键生成代码】【清空】【恢复标注】。**按顶栏实际剩余宽度自适应**（2026-11-13 用户明令·标注层 1.11.7 起内置，任何原型自动生效）：放得下 → 一行完整文字；放不下 → 一行紧凑（小字号+短文字）；仍放不下 → 不常用的依次收进【更多 ▾】（恢复标注 → 清空 → 一键生成代码 → 导出对接料），标注开关、复制已圈功能、导出分享版常显。**不得**超出顶栏、撑出页面横向滚动条、压住顶部菜单、撑高顶栏；“标注”两字不折行。窗口大小、菜单个数、语言、系统切换时自动重算。工具条和【更多】弹层不参与标注号的锚点查找。开/关标注时弹出的提示条不得遮挡【标注】开关和工具条上的任何按钮，统一显示在顶部导航栏（顶栏、模块菜单、页签栏）下方（标注层 1.11.9 起）。只读分享版只显示标注开关。 |

**数据写法**：project-data 加 `"topbar": { "user": "admin", "notif": 33 }`（缺省 `admin` / `0`）。

#### 5.3g 导航 = **双模式可切换（顶部导航 ⇄ 左侧菜单）**·默认顶部导航

> **默认 = 顶部导航**（真系统 某 OMS 就是顶栏）。但**两种模式都保留**，用户可在原型里随时切换。

- **切换器位置**：顶栏 **语言切换器 🌐 与 标注开关之间**（`.menusw`，两个小按钮 ▤ 顶部导航 / ▥ 左侧菜单）。
- **选择记忆**：`localStorage['__proto_menu__']`，下次打开沿用（默认 `top`）。
- **`menuMode='top'`**：菜单在顶栏（下方规则），无侧栏、内容全宽。
- **`menuMode='side'`**：经典 B 端左侧栏（248px，深色 `@@SIDEBAR_BG@@`，`el-menu` 分组折叠），顶栏菜单自动隐藏，`.main` 让出 248px。
- 两种模式**共用同一份 `nav` 数据**，不需要写两套。

- 顶栏：深色 `#122041`、高 **50px**、sticky；左起 `LOGO/标题` → **横向主菜单** → 右侧（系统切换器(>1个才显示) / 语言 / 标注开关）。
- **主菜单映射**：`nav` 的**分组**（`{group,items}`）= 顶级菜单，**悬停展开**下拉子项；`nav` 的**单项**（`{id,label}`）= 直接可点的顶级菜单。子项/分组均支持 `badge`（如「新」）。
- 当前页所在的顶级菜单高亮（主色蓝底白字）。
- 顶栏下方是**可关闭页签**条（sticky·top:50px），与真系统一致。
- 页面级左侧面板（如发票管理的「开票中/开票失败/已开票…」状态面板）属于**页面内容**，不是全局导航。

- **多系统（`systems.length>1`）= 双行顶栏**：**第一行**放系统视图切换（如 WMS·货主端 / OMS·分销商端），**第二行**（`.modnav`）放模块导航 + 右侧工具组（`当前:X系统 / 语言 / 菜单模式切换 / 消息 / 头像`）。单系统时退化为单行（模块在顶栏、工具在右侧）。
- **【铁律·菜单模式切换按钮任何情况都不可消失】**：双行顶栏时，第二行的**右侧工具组（含菜单模式 ▤/▥ 切换）必须在 `top` 和 `side` 两种模式下都渲染**——只有第二行的**模块导航按钮**才随 `menuMode==='top'` 显隐。绝不能把整条第二行都 `v-show="menuMode==='top'"`，否则切到左侧栏模式后切换器一起消失、再也切不回顶部（2026-07-26 事故根治）。骨架实现：`.modnav` 用 `v-show="systems.length>1"`，模块循环单独包 `<template v-if="menuMode==='top'">`，`.mn-right` 工具组始终渲染。

#### 5.3f 行内可编辑表格（真系统「已绑定店铺」·2026-07-12 实测）

> 真系统在详情页把**表单控件直接嵌进表格单元格**（不是弹窗编辑）：下拉 / 数字+`%` / 勾选框 / 输入框 / 删除图标。

```
[添加店铺]
┌────────┬──────────┬────────────────┬────────┬──────────────────┬──────────────┬──────┐
│ 平台   │ 店铺     │ 产品总价        │ 比例   │ 含买家运费开票     │ 免费样品/赠品 │ 操作 │
├────────┼──────────┼────────────────┼────────┼──────────────────┼──────────────┼──────┤
│ TikTok │ LZF(蓝链)│ [自定义:按… ▾] │ [30] % │ ☐ 含买家运费开票  │ [zp        ] │  🗑  │
└────────┴──────────┴────────────────┴────────┴──────────────────┴──────────────┴──────┘
```

**数据写法**（`sec.table.rows` 的单元格）：

| 控件 | 写法 |
|---|---|
| 下拉 | `{"ctrl":"select","options":["A","B"],"value":"A"}` |
| 数字+后缀 | `{"ctrl":"number","value":"30","suffix":"%"}` |
| 勾选框 | `{"ctrl":"checkbox","value":false,"text":"含买家运费开票"}` |
| 输入框 | `{"ctrl":"input","value":"zp","ph":"请输入"}` |
| 删除图标 | `{"ctrl":"del"}` |
| 顶部按钮 | `sec.table.addBtn = "添加店铺"` |

⚠️ 可编辑单元格**必须渲染真 EP 组件**（骨架 `isCtrl()` 分支），不能走 `cell()` 吐 HTML 字符串——`v-html` 渲染不出 Vue 组件。

#### 5.3h 列宽按内容配置（长内容列不许挤成竖排）

真系统表格**内部横向滚动**，列有合适宽度。骨架列可写 `"名"` 或 **`{ "label":"key", "width":280 }`**。
长内容列（报错信息 / 税种名称 / 地址等）**必须给足宽度**（250–300px），否则文字逐字竖排换行（2026-07-12 截图逮到）。
⚠️ 页面**不允许横向溢出**：外层 `.main` 必须 `min-width:0`（flex 项默认 `min-width:auto`，宽表格会把整页撑出滚动条）。

#### 5.3i 左侧状态面板 + 按状态切数据（真系统「发票管理」）

- **状态面板**：白底卡片，条目**右对齐计数**，支持分组折叠。
  写法：`cfg.statusPanel = { title, items:[ {key,label,count} | {group, items:[{key,label,count}]} ] }`
- **点状态换数据（铁律：任何状态都不能显示空表）**：
  `cfg.rowsByStatus = { <状态key>: [...行] }` + `cfg.totalByStatus = { <状态key>: 总数 }`。
  骨架自动：进页面默认选中**第一项**并加载其数据；点其它状态换该状态的数据与分页总数。
  **每个状态都必须配模拟数据**——空表 = 未完成。

### 5.4 操作区（列表页顶部）

```
已选: 0  [新增▲]  [删除]  [启用]  [停用]  [审核通过]  [审核不通过]  [标记]        [↑ 导出]
←——— 左侧：选中计数 + 主操作 + 批量操作 ——————————————————————————→  ←— 右侧 —→
```

| 位置 | 内容 | 样式 |
|---|---|---|
| 最左 | `已选: N` 计数器 | 灰色小字 |
| 左 1 | 新增 | **主色填充按钮**（蓝色） |
| 左 2~N | 删除 / 启用 / 停用 / 业务操作 | 默认白底边框按钮 |
| 右 | 导入（如适用）/ 导出 | 默认白底边框按钮，右对齐 |

#### 🏛🏛 列表标配铁律：**勾选列 + 导出，两样都是默认标配**（2026-11-04 用户明确要求 · 强制 · 随包）

> 用户原话：「默认的 UI 设计规范，所有的列表没有复选框吗？如果没有，你更新到默认的 UI 设计规范里，包括所有的列表都需要有导出按钮，这个也是默认的设计规范。」
> 立此条的背景：导出在 2026-06-21 就已是铁律（见下一节），但**勾选列此前只是隐含**（§5.4 操作区画了「已选: N」、§3 定了勾选框样式、代码范式里有 `el-table-column type="selection"`），没有一条明文说“每个列表都要有”。骨架的 `cfg.selectable` **默认是关的**，于是靠 AI 自觉 → 必漏。现在写死。

> 🏛 **铁律（两条，缺一即不合规）**：
> 1. **每个列表页都必须有勾选列**：表格第一列固定为复选框列（`<el-table-column type="selection" width="44">`），表头带全选。骨架写法 `cfg.selectable = true`，**所有列表页一律要写**。
>    - 配套：操作区最左显示 `已选: N` 计数；依赖勾选的批量按钮放 `cfg.selectActions`，**默认可点不置灰**，没勾选时点了 toast「请选择数据」（见 §5.3 批量工具栏铁律）。
>    - **唯一例外**：单行配置页（系统参数这类一个页面只有一条记录的），以及明确不做任何批量/导出动作的只读看板。例外必须在 `project-data` 里写明理由，不能默认省略。
> 2. **每个列表页都必须有导出**：按钮固定在操作区右端（`cfg.listTools` + `cfg.toolsPos:'toolbar'`），样式为白底边框按钮。具体行为与文件格式见下一节。
>
> **机器兜底**：`qa/list-standard-gate.js` 逐页检查“有 columns 的页面是否 `selectable:true` 且 listTools 含导出”，红即禁交付。

#### 🏛🏛 列表右侧三件套：**导出 + 列配置 + 刷新，一个都不能少**（2026-11-04 用户明确要求 · 强制 · 随包）

> 用户原话：「列表的导出、列配置图标、刷新图标（放在列表的右侧）、复选框，都必须要有。」

> **真系统实测（某 OMS / WMS·2026-11-04 用 `skills/rpa/layout.js` 抽 5 个模块页）**，证据分三档写清，别把"我的决定"混成"真系统如此"：
>
> | 件 | 某 OMS / WMS 实测 | 依据 |
> |---|---|---|
> | **刷新图标** | ✅ 有。class `el-icon refresh-icon el-tooltip__trigger`，**20×20**，位于**工具条行最右端**（在批量按钮那一行，不是表头行）。OMS-商品、WMS-商品均有 | 实测真值 |
> | **勾选列** | ✅ 有。第 1 列，206 个列表页里 **172 页**有 | 实测真值 |
> | **导出** | ✅ 有。206 页里 **98 页**有，带 `∨` 下拉（按勾选导出 / 按筛选导出） | 实测真值 |
> | **列配置（自定义列）** | ❌ **某 OMS / WMS 这两个系统的 5 个模块页都没有抽到** | 实测为"无" |
>
> ⚠️ **列配置这一件是【用户决定】，不是从 某 OMS/WMS 抄来的**：用户 2026-11-04 要求把它纳入默认规范标配。
> 这么标注是为了守住「真系统有=必拷，真系统没有=一个都不许加」那条宪法 —— 它在**复刻模式 A** 下依然不许加（模式 A 以对方系统实测为唯一基线）；
> 本条只对 **模式 C（画原型选默认 UI 规范）** 生效。骨架里早有现成写法（v3.27 起 `listTools` 支持 `⚙自定义列`），所以不用新造轮子。

> 🏛 **铁律（模式 C 每个列表页都要满足，缺一即不合规）**：
> 1. **刷新图标**：`cfg.table = { refresh: true }` → 渲染 `.tb-refresh`（16px，色 `#909399`，hover 变主色 `#3363FF`），位于表格卡右上角。点了要**真的重拉数据并 toast 提示**，不能是死图标。
> 2. **列配置（自定义列）**：骨架标配自带（`cfg.listStd` 可关），放工具条行右端、刷新图标左边。**只显示齿轮图标，不显示“自定义列”文字，鼠标悬停提示“自定义列”**（2026-11-06 用户明令；`listTools` 里 `icon:'gear'` 的也一样只显示图标）。点了要**真打开列勾选弹窗**，勾掉某列后表格真的少一列。**弹窗里的字段名必须和表头逐字一致**（多语原型按当前语言显示，不许出现 [object Object]），勾掉一列只隐藏这一列（2026-11-06 用户逮到弹窗字段名显示错误，骨架 v7.1 已修）。弹窗布局：顶部【全选】，下面两列复选框，底部【重置】【确定】。
> 3. **导出**：见下一节「导出 / 导入标配铁律」，位置同样在工具条行右端。
> 4. **勾选列**：`cfg.selectable = true`，见上一节。
> 5. **四件的相对位置**（照 某 OMS 实测的那一行）：
>    `已选:N  [新增] [停用] [标记] [打印标签] [导入∨] [导出∨]  ……………  [⚙] [⟳]`
>    左端是计数 + 主操作 + 批量操作 + **导出（在左侧那排的末尾，不许放右端）**；右端只有自定义列图标和刷新图标两个图标。骨架 v7.1 起标配导出自动渲染在左侧（2026-11-06 用户指出原型把导出放在右端、不符合本条）。
>    不需要导出的页面（如已开票-近期发票、历史发票）用 `listStd:{export:false}` 关掉。
>
> **机器兜底**：`qa/list-standard-gate.js` 同时卡这四件 —— 任一缺失判红，禁交付。
>
> 🏛 **复制图标铁律（2026-11-05 用户定·默认规范）**：凡是编号类内容（序列号、发票号、Key、各类单据号、CPF/CNPJ、发票账号等）配复制图标的，**图标平时不显示，鼠标移到哪个编号上，就只显示那个编号后面的复制图标**，移开即隐藏；同一格有多个编号（如订单号、平台订单号）时互不影响。图标位置预留，出现时不挤动文字。悬停浮层（如 Key 浮层）里也一样：鼠标移进浮层、停在哪个编号上，才显示那个编号的复制图标，全原型交互统一。点击图标复制，提示“已复制”。骨架实现：`.copy-ic` 默认透明，`copyHoverInit` 按鼠标下的文字找紧跟的图标显示。
>
> 🏛 **两个编号放同一格时分两行（2026-11-05 用户定）**：如“序列号/发票号”这类合在一格的编号，分两行显示（第一行序列号、第二行发票号），每行各带复制图标；不许直接连写成一串（如 001000000802），也不用斜杠挤在一行。
>
> 🏛 **图标统一（2026-11-05 用户定）**：【导出】【自定义列】按钮里的图标和刷新图标，一律用同一套线条（描边）图标（骨架 `ACT_ICONS` 的 `export`、`gear`、`reload`，描边 1.6、按钮内 18px）。不许用 ⚙ ⟳ 这类文字符号：风格和线条图标不一致，而且显示效果受字体影响。

#### 🏛🏛🏛 一次性到位铁律：**每个模块都必须像真系统一样能用，不许交半成品**（2026-11-04 用户明确要求 · 最高优先 · 随包）

> 用户原话：「我要求你做的每个模块都必须像真系统一样，一次性到位，这个是铁律，你更新到规范里」「别给我做的页面都是无法点击的」「你画的原型，在列表的各个状态不能切换的吗？默认的 UI 设计规范，没有约束你吗？如果没有，你给我记住，这个是铁律」

> 🏛 **铁律（交付前逐条自查，任一条不满足 = 这个模块没做完）**：
> 1. **状态页签必须真切换数据。** 页签只有标签、点了不换行 = 摆设 = 不合格。
>    - 🔴 **写法（2026-11-04 踩过的坑，必看）**：顶部状态页签的数据要挂在**页签项自己**身上 —— `cfg.statusTabs = [{key:'t0', label:'全部', count:8, rows:[…], total:8}, {key:'t1', label:'待确认', count:3, rows:[…], total:3}, …]`。
>    - ⚠️ **`cfg.rowsByStatus` 只对【左侧面板状态】(`byStatus`/`curPanel`) 生效，挂它点顶部页签不换数据**（骨架 `curRowsRaw` 读的是 `m[curPanel.value]`）。这个坑让整套列表的页签全成了摆设。
>    - **每个页签都要带 `count`**（真系统页签后面都有计数），且**任何页签都不能是空表**（见 §5.3 点状态换数据铁律）。
> 2. **页面上每一个可见控件都必须可点、点了有反应。** 按钮、行操作、页签、链接、分页、筛选、勾选，一个都不许是装饰。点了应当出现弹窗、跳转、换数据、toast 之一。
> 3. **一个模块要一次做完整**：列表（筛选 + 勾选 + 工具栏 + 状态页签 + 分页 + 行操作）、新增页/弹窗、详情页、以及该模块特有的业务动作（确认 / 下发 / 上传 / 预约 等），**一次性交齐**，不许"先搭个列表，细节以后补"。
> 4. **批量与单条两条路都要有**：凡是"可以批量做"的动作（确认、预约、删除、启用停用），**工具栏批量入口和行内单条入口都要有**，不能只给一个。
> 5. **自查方式**：交付前必须自己在**交付件**里逐个点过（不是看渲染结果、不是看截图），并把"点了什么、看到什么"写进 `原型改动清单.md` 的证据栏。

#### 🏛 导出 / 导入标配铁律（v1.0 强制 / 2026-06-21 用户明确要求）

> 🏛 **铁律**：
> 1. **凡是"有查询条件 + 列表"的模块（报表、台账、单据列表、记录列表等），都必须有「导出」**——无一例外。导出按钮固定在操作区右侧。
> 2. **创建单据类、商品/基础资料类模块，除导出外还必须有「导入」**（批量录入/批量建档场景），导入按钮放在导出左侧。
> 3. **导出内容必须"字段完整、逐行自成一体"**：导出的每一行要包含定位该行所需的全部关键字段，**即使屏幕上某些信息是放在卡片/页头而非列里的**（典型：收发存明细表屏幕用卡片显示商品信息，但导出每行必须带 商品编号/商品名称/规格名称/规格编号），保证导出文件脱离系统也能独立看懂。
> 4. **导出必须是"真实可下载"效果，不能只弹提示**（v1.0 强制 / 2026-06-21）：原型里点「导出」要**真的下载一个文件**——前端用 JS 拼 CSV（首字节加 BOM `﻿` 保证 Excel 打开中文不乱码）+ `Blob` + 临时 `<a download>` 触发下载，内容是**当前筛选后的真实列表数据**。**禁止**只 `ElMessage.success('已导出…')` 而不产生文件。导入同理，应有真实的文件选择/解析交互（至少 `el-upload` + 模拟解析回填），不能只弹提示。
>    - 可复用统一助手：`exportCSV(filename, headers, rows)`（拼表头+数据行、转义、加 BOM、触发下载）。
> 5. **一致性**：同一系统所有列表的导出/导入按钮位置、样式、命名一致；CN/BR 等多地区版本同步具备。

**自检清单**（每做一个有列表的模块都要过）：
- [ ] 该列表有「导出」吗？
- [ ] 导出是**真实下载文件**吗（CSV+BOM+Blob 下载），还是只弹了提示？（只弹提示=不合格）
- [ ] 是创建单据/商品类吗？是 → 有「导入」吗（真实文件选择/解析交互）？
- [ ] 导出每行字段是否完整自成一体（含屏幕上放在卡片/页头的标识字段）？
- [ ] CN/BR 两版都加了吗？

---

### 5.5 语言切换器 Language Switcher（原型多语言·强制）

> **来源**：真实系统 i18n = 自研 `lang()`（zh/en/pt/spa，见 §1）。原型用等价的**文案层三语**机制模拟，
> 保证将来【导出研发版】时 i18n 键与后端 `XxxCodeMsg extends LanguageMsg` 一一对应。
> **标准件**：`components/prototype-skeleton.html`（`L()` / `K()` / `T()` / `UI_DICT` / `LOCALE_META` / `setLang`）。**AI 不重打，装配器逐字复制。**

**位置**：顶栏 `.right` 内、标注开关**左侧**，内联不浮层（不得遮挡标注开关）。

**语言集合**：由三问答案经装配器写入 `window.__DESIGN_CHOICE__`：

```json
{ "locales": ["zh", "en", "pt"], "defaultLocale": "zh" }
```

| Key | 显示名 | `<html lang>` |
|---|---|---|
| `zh` | 中文 | `zh-CN` |
| `en` | English | `en-US` |
| `pt` | Português | `pt-BR` |
| `spa` | Español | `es` |

- `locales` 缺省 `["zh"]`（单语，向后兼容旧 project-data）；单语时切换器**不渲染**。
- `defaultLocale` 必须 ∈ `locales`；`region=BR` 时 `locales` **必须含 `pt`**。
- 用户所选语言存 `localStorage['__proto_lang__']`，刷新保持。

**切换范围 = 文案层全切**（铁律）：

| ✅ 切（属于文案层）| ❌ 不切（属于 mock 业务数据）|
|---|---|
| 菜单 / 页签 / 分组名 | 单号（`NF-000128`）|
| 按钮 / 操作列 / 工具条 | 日期、金额（`R$ 12.400,00`）|
| 表头 / 字段 label / 占位符 | 客户名、商品名、地址等实例值 |
| 统计卡 / 图表标题 / 空状态 / banner | |
| 分页 / 消息提示 / 标注栏（`UI_DICT` 固定件）| |
| **枚举值**：状态标签、类型、单据种类…… | |

> ⚠️ **判据（2026-07-10 澄清·别再含糊）**：分界不是"在不在表格里"，而是**"它是 UI 词汇还是数据实例"**。
> `已开票 / 待开票`、`销售发票 / 采购发票` 是**产品定义的枚举**，真实系统里也走 i18n → **必须三语**；
> `NF-000128`、`张三贸易公司` 是**某一条数据的值**，真实系统里存在库里 → **不翻**。
> 状态标签单元写 `{"t":{"zh":"已开票","en":"Issued","pt":"Emitida"},"c":"green"}`（`cell()` 已支持）。

**写法**：项目数据里任何文案，写成三语对象即自动跟随切换；写成普通字符串则各语言同显。

```json
{ "prop": "issueDate", "label": { "zh": "开票日期", "en": "Issue Date", "pt": "Data de Emissão" } }
```

- `L(v)` 解析当前语言；`K(v)` 取**稳定原始键**（`v-for :key` / `:index` / `:value` 用，绝不随语言变）。
- **`custom` 复杂页同理**：整块原始 HTML 写成 `{"zh":"<div>…","en":"…","pt":"…"}` 才会跟随切换；
  写成裸中文 HTML 字符串 → 切到 en/pt 仍是中文（`i18n-completeness-gate` 的 I4 会点名警告）。
- 多语原型里，**任一文案对象缺 `en`/`pt` → 判红**（`i18n-completeness-gate.js`）。
- **PRD 侧不受影响**：`__PRD_DATA__` / 字段规范 / 标注同步一律取 `.zh` 当字段名。

**🏛 圈选 / PRD 一律以中文为准**（2026-07-10 用户拍板·强制）

标注层采集的是**当前 DOM 上显示的文字**。若在葡语下圈选，`fp_name` 会变成 `Lista de NF`，
葡语功能名混进中文 PRD，同一功能还会因语言不同被圈成两个 PIN。故骨架强制：

1. **开启标注** → 自动切回中文，并提示「标注与 PRD 以中文为准，已切回中文」（不静默）。
2. **标注开启期间** → 语言锁定，切换器点了只提示、不生效；关掉标注才能切。

> `fp_key` 由 `pageId + 硬编码操作名` 生成，本来就语言无关；会漂的是 `fp_name` / `zoneLabel`。
> 只在**骨架**实现（`onAnnoToggle` / `uiSetLang`），**不动标注层** → 无需 bump 层版本、无需重注入存量原型。
> 葡语 PRD 属于"把 PRD 翻译一遍"的独立工作，不由"圈选时切了语言"决定。

---

## 6. 反馈组件

### 6.1 Dialog 弹窗（5 种用法）

**通用结构**：默认上下布局、左对齐

```
┌─────────────────────────────────┐
│ 标题                          × │  ← 头部
├─────────────────────────────────┤
│ Label                           │
│ ┌────────────────────────┐     │
│ │ 字段输入               │     │
│ └────────────────────────┘     │
│ 灰色提示文字                    │
│ ...                             │
├─────────────────────────────────┤
│         [cancelamentos] [Confirmar] │
└─────────────────────────────────┘
```

**5 种用法**：
1. 简单新增（单/多字段 + 提交）
2. 简单原因输入（Textarea + 提交）
3. 复杂编辑（含只读区 Status/Fundador/Tempo）
4. 选择型表格（搜索 + 表格 + 分页 + 选中确认）
5. 信息展示（列表 + 单按钮 `encerramento`）

**尺寸标准**：
- 小型（1-3 字段）：`500px`
- 中型（3-7 字段）：`600px`
- **表单/选择型弹窗（如「标记」选择弹窗）：实测 `580px`·圆角 `4px`**（2026-08-02 实测·选择型走这一档）
- 大型（含表格）：`800-900px`
- 高度：自适应，max `80vh`
> 注：**确认框**（el-message-box·二次确认/删除/审批）实测 `480px`；**表单/选择弹窗**（el-dialog）实测 `580px`——两者别混。

```vue
<el-dialog v-model="visible" title="Adicionar Subconta" width="500px">
  <el-form :model="form" :rules="rules" label-position="top">
    <el-form-item label="Conta" prop="conta">
      <el-input v-model="form.conta" placeholder="Por favor, insira a conta" />
      <span class="text-caption text-text-tertiary">
        Formato: 4-20 caracteres, início com letra
      </span>
    </el-form-item>
    <el-form-item label="Pessoas Associadas" prop="pessoas">
      <el-select v-model="form.pessoas" placeholder="Selecione" />
    </el-form-item>
  </el-form>
  <template #footer>
    <el-button @click="visible = false">cancelamentos</el-button>
    <el-button type="primary" @click="onSubmit">Confirmar</el-button>
  </template>
</el-dialog>
```

### 6.2 MessageBox 消息弹出框（确认弹窗）

**2 种典型场景**：

| 场景 | 图标 | 内容 |
|---|---|---|
| 警告类（删除/停用）| ⚠ 橙 `#F2AC3A` | "确认删除该商品吗？" |
| 信息确认（发货/提交）| ℹ 蓝 `#3363FF` | "确认已对该出库单发货？" |

宽度约 420-480px，比常规 Dialog 紧凑。

```typescript
ElMessageBox.confirm(
  'Confirma a exclusão deste produto?',
  'Excluir produto',
  { confirmButtonText: 'Confirmar', cancelButtonText: 'Cancelar', type: 'warning' }
)
```

### 6.3 Message 消息提示（Toast，3 状态 × 2 模式）

| 状态 | 颜色 |
|---|---|
| 成功 | 绿 `#67C23A` + 浅绿底 `#F0F9EB` |
| 错误 | 红 `#F56C6C` + 浅红底 `#FEF0F0` |
| 警告 | 橙 `#F2AC3A` + 浅橙底 `#FDF6EC` |

**模式**：基础（3 秒自动消失）/ 可关闭（手动 ×）

从顶部出现，多消息向下堆叠（间距 8-12px）。

```typescript
ElMessage.success('保存成功')
ElMessage.error({ message: '操作失败', showClose: true, duration: 0 })
```

---

## 7. 表单规范

### 7.1 标签布局：**Top（标签在字段上方）**

```vue
<el-form :model="form" :rules="rules" label-position="top">
  ...
</el-form>
```

### 7.2 必填标记

- 红色 `*`，位置在标签**右侧**
- Element Plus 自动渲染（`prop` + 规则中 `required: true`）

### 7.3 帮助图标

- 灰色 `?` 圆形，hover 显示 tooltip
- 位置：标签右侧（与 * 并存）

```vue
<el-form-item prop="numero">
  <template #label>
    Número
    <el-tooltip content="参考说明">
      <el-icon><QuestionFilled /></el-icon>
    </el-tooltip>
  </template>
  <el-input v-model="form.numero" />
</el-form-item>
```

**宽 tooltip（防文字截断 · 强制写法）**：Element Plus tooltip 默认 `white-space:nowrap`，长文案会被截断成一行溢出。需要换行加宽时**必须用双类选择器** `.<custom>.el-popper`（单类选择器优先级压不过 EP 默认样式）：

```html
<el-tooltip popper-class="th-tip-wide" content="较长的说明文案……" placement="top">
  <el-icon><QuestionFilled /></el-icon>
</el-tooltip>
```
```css
/* 全局 <style> 写一次，所有 th-tip-wide 共享；双类 .th-tip-wide.el-popper 才能压过默认 nowrap */
.th-tip-wide.el-popper { max-width:320px !important; white-space:normal !important; word-break:break-word; line-height:1.6; }
```

### 7.4 校验状态

| 状态 | 边框 | 提示 |
|---|---|---|
| 默认 | `#DCDFE6` | 占位灰字 |
| 聚焦 | `#3363FF` 蓝边 | - |
| 错误 | `#F56C6C` 红边 | 字段下方红色小字 |
| 禁用 | 灰底 + 灰边 | 显示 `-` 或灰字 |

### 7.5 字段间距

垂直 16-20px，标签与控件 4-8px。

---

## 8. 页面结构模板

### 8.0 共性操作范式总纲【🔴 唯一标准·画默认原型必遵·禁自由发挥】
> **背景**：选默认规范 = 一比一照一套生产级 OMS+WMS 真系统（提炼自真实生产代码），同类操作**长一个样**、不许每页自己编。DOM 实测证据见真理源提取档（维护者本地保留·未随公开包）。
> **标注**：✅=已登真系统实测坐实；🟡=按钮名已实测、弹窗内部细节待一次干净实测（先按此推断·禁当已证）。

| 操作 | 唯一标准（详见章节） | 证 |
|---|---|---|
| **菜单** | 顶部横向主菜单+悬停多列大菜单；内容区多页签(列表×/详情×可关)；可切经典左侧栏。§5.1/§5.2/§5.3g | ✅ |
| **查询条件** | 筛选区**无 label·字段名进占位符**；下拉默「全部XX」；日期=`维度下拉+[开始]to[结束]`；**商品查询=统一三段组合**(字段▾+批量搜索+匹配▾)；末尾`[查询蓝][重置白]`。§5.3/§5.3a/§5.3b。🚫禁"搜索/清空" | ✅ |
| **列表** | 筛选区→状态(多=左导航列带计数/少=页签带计数)→工具栏(`已选:N`+主操作·**新增类永不禁用**)→表格→分页。操作列**一律图标**(§5.3j)非文字；可点单元格=蓝链。**3 子变体**：①单据类(状态流转+审批)②主数据(增删改查)③**报表类**(只`查询/重置/导出`·**无 CRUD**·**分组数字列**如良品/不良品×总/锁定/可用·表体可 13/12px 密集)。§8.1/§5.4 | ✅(WMS 11模块全扫) |
| **新增** | **整页新页签**(`/add`)·分区标题·**3列 label在上**·必填红`*`·帮助灰`?`·占位「请输入/请选择」·底部 sticky **`[取消][保存]`**(保存主色)。**不是弹窗、标准新增=保存**。§8.2 | ✅ |
| **编辑** | 同新增布局·字段**回显**·`/edit`·标题「编辑」·**比新增多只读回显 meta 区**(Status/创建人/创建时间)·底部`[取消][保存]`(设置/配置类整页=`[取消][提交]`)。§8.2 | ✅实测(商品31字段) |
| **删除** | **不进整页**：行内🗑或勾选后工具栏「删除」→**二次确认框**「确认删除该XX？」`[取消][确定]`→toast「删除成功」+刷新。产操作日志。**⚠️删除受状态前置约束**(如商品仅「待审核/已驳回」可删)：状态不符**不弹确认框·弹拦截 toast**(§5.3t)。§6.2 | ✅状态拦截实测(确认框逐字文案待实测) |
| **查看** | **整页新页签**(`/detail`/`/view`)·(过程型)顶部**横向状态步骤条+时间戳**·分区标题·**3列 label在上只读回显**(空`--`)·底部**居中单个「返回」**。**绝不是弹窗、绝不是`[取消][提交]`**。§8.3 | ✅ |
| **审批通过** | 勾选待审核行→工具栏**「审核通过」**→(通常)二次确认→toast+状态转「已通过」+通知申请人。§6.2/§4.7 | 🟡(按钮名✅·弹窗待实测) |
| **审批不通过** | 勾选待审核行→工具栏**「审核不通过」**→**二次确认框**「确认驳回该XX？」`[取消][确定]`→状态转「已驳回」。**🔴实测纠正：客户审批无「驳回原因」输入框**——别默认加原因框；其它模块是否有原因字段未实测·别假设。§6.2 | ✅实测(客户) |

**按钮命名铁律（中/葡·画原型一字照抄）**：新增(Adicionar Novo)｜删除(Excluir)｜启用/停用(Ativar/Desativar)｜**审核通过/审核不通过**(Aprovado/Reprovado)｜标记(Marca)｜**查询**(Buscar)｜**重置**(Limpar)｜导入/导出｜**返回**(Voltar)｜同步订单｜配置分销｜公制/英制。🚫**禁用叫法**：新建·创建·搜索·清空·清除·驳回(单独)·拒绝·保存(设置类整页应为提交)。

**通用组件/行为/格式（同样必遵·详见各节）**：状态标签●圆点+彩色(绿正常/红失败过期/灰创建停用/橙待处理)§4.3｜分页`共N条·每页[10/25/50/100]·前往[]页`§4.2｜空状态「暂无数据」+插画/加载态换数据必转圈500-700ms§4.4/§5.3q｜聚合列(人员/时间·双角色)§4.7｜操作日志(时间/账号/模块/功能/明细/IP·查询查看不记)§13｜消息通知4列表(场景/标题/内容/接收方)｜二次确认统一§6.2｜权限拦截「按钮不隐藏·点了弹提示」§5.3t｜多值字段`[＋添加]`｜上传方块+格式提示｜导入弹窗(下模板+传文件)/导出「下载中心」§12｜金额千分位点+2位小数+货币前缀·日期`DD-MM-YYYY HH:mm:ss`+America/Sao_Paulo§9。

**画原型自检（每类操作过一遍）**：查看页→(整页+步骤条[过程型]+3列只读+居中返回)？新增/编辑→(整页+3列+`[取消][保存/提交]`)？删除/审批→(勾选或行内→确认框/原因弹窗→toast+状态变)？按钮→(全是规范词·无禁用叫法)？缺任一即偏离真系统，**禁交付**。

#### 8.0.1 🔴 全功能可操作铁律（用户定·2026-07-12 立·07-26 重申并含导入导出）
> **原型上每一个功能都必须【真能操作·点了有反应】，不是"元素在那"就算完**。像真系统一样可用，不是静态图。详见 §5.3n/§5.3l/§5.3j，骨架已内置以下能力（模式1装配自动获得）：
- **新增/编辑**：点了 → 打开整页表单或弹窗（真能填、真能提交回列表）；`sec.table.addRow` 真加行。
- **删除**：行内🗑或勾选后「删除」→ 二次确认 → **真从列表移除** + toast「删除成功」。
- **查看**：点👁或蓝链 → 真进详情整页（§8.3）。
- **导入**：点「导入」→ **内置导入弹窗**（选文件 + 模板提示 + 确定）。
- **导出**：点「导出」→ **内置反馈**「已导出 N 条记录」/「导出任务已生成，请在下载中心下载」。
- **审批通过/不通过**：勾选 → 点按钮 → 确认/原因弹窗 → 状态真变 + toast。
- **筛选/查询/重置/页签/状态栏/分页**：点了都要真换数据（转圈 500-700ms）。
- **兜底**：任何其它按钮点了至少给 toast「XX：已执行」，**绝不静默无反应**。
- **判定**：原型上任何可点的东西，点了没反应 = **未完成、禁交付**（㊱全量交互回归闸机器校验）。
- ⚠️ **模式2 手搓外壳最易漏**——手写 HTML 时容易只画样子不接行为；手搓也必须逐个接上真反应。

#### 8.0.2 实测样式基线（🔴 getComputedStyle 复核·2026-08-02 当前真系统·画原型照此像素）
> 登录一套生产级 WMS 逐元素 getComputedStyle 实测。全量证据见真理源提取档「实测样式」节（维护者本地保留·未随公开包）。
- **导航**：顶栏高 **50px** · 底色 **#122041** · 菜单项**白字 14px/400** · 主色 var `--el-color-primary` = **#3363FF**。
- **查询条件（筛选区）**：卡片**白底 #fff** · padding **16px 16px 0** · 圆角 **6px**；控件高 **32px**（内部 input **30px**·圆角 **0**）；**日期范围控件宽 ~427px**；**查询**按钮 高32px·**min-width 80px**·#3363FF·白字·圆角4·padding **8px 15px**；**重置**按钮 白底·#333·边 **1px #dcdfe6**；**无 label**（字段名进占位符）。
- **查看详情**：字段 **label 14px · #909399 灰 · 在值上方 · margin-bottom 8px**；**值 14px · #333**；布局 flex-wrap **3 列**；**返回按钮 32px×80px · 白底 · 边1px #dcdfe6 · 圆角4 · 父容器 text-align:center 居中**（印证 §8.3）。
- **过程型单据详情**（入库单详情实测）：顶部**状态步骤条**（步骤=单据流转节点·如入库单 创建→提交→发货→签收→收货→上架·每步带账号+时间戳·步骤圈样式见 §8.3 CSS）；下方**商品明细行内表**（列典型：`# · 商品信息 · 实际尺寸/重量 · 计划入库 · 已收良品/不良品 · 已上架良品/不良品 · 费用项/扣费方式/金额/支付状态`）；底部同样居中「返回」。
- **表格字号**：**标准列表 表头/表体均 14px**（表头 #999 w600 · bg **#f7f8fa** · 表体 #444 · lh 23px）；**统计/报表密集表**为 **13px/12px** 特例（仅数据模块那种超多列报表），标准列表**不要**用 13/12。
- **新增/编辑表单**（新增商品实测）：**分区标题 16px · 600 · #333**；字段 **label 14px · #909399 · label-top**（在控件上方）；**必填 = 红 `*`**（EP is-required）；字段项宽 **400px** · marginBottom 10px → **flex-wrap 3 列**；底部 **`[取消（白底·边1px #dcdfe6）][保存（#3363FF 主色）]` 均高 32px · min-width 80px · 圆角4 · 居中**（标准新增/编辑=保存·配置类=提交·见 §8.0）。
- 令牌一致：主色 #3363FF · 边框 #dcdfe6 · 圆角默认 4px（按钮/卡片，筛选卡片 6px）· 灰字 #909399 · 表头灰 #999 · 正文 #444/#333。

### 8.1 列表页（最常见）

```vue
<template>
  <PageWrapper>
    <!-- 1. 筛选区 -->
    <FilterForm v-model="filters" :collapsible="filterCount > 8" />
    
    <!-- 2. 操作区 -->
    <div class="flex items-center mb-3">
      <el-button type="primary" :icon="Plus" @click="onCreate">Nova</el-button>
      <el-button :icon="Delete" @click="onBatchDelete">Excluir</el-button>
      <el-button :icon="Download" type="primary" link class="ml-auto">
        Exportação
      </el-button>
    </div>
    
    <!-- 3. 状态 Tab（可选）-->
    <el-tabs v-model="status" type="border-card" @tab-change="onSearch">
      <el-tab-pane v-for="s in statusList" :key="s.value" :name="s.value">
        <template #label>{{ s.label }} <span class="text-text-tertiary">({{ s.count }})</span></template>
      </el-tab-pane>
    </el-tabs>
    
    <!-- 4. 表格 -->
    <el-table :data="list" stripe border height="600">
      ...（参考 Table 章节）
    </el-table>
    
    <!-- 5. 分页 -->
    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      :total="total"
      :page-sizes="[10, 25, 50, 100]"
      layout="total, sizes, prev, pager, next, jumper"
      background
      class="justify-end mt-4"
    />
  </PageWrapper>
</template>
```

### 8.2 新增/编辑全页表单

**默认使用全页跳转**（路由到 `/xxx/add` 或 `/xxx/edit?id=N`），不用弹窗：
- 多分组卡片（基本信息 / 联系信息 / ...）
- 每组：3 列等宽，标签在字段上方（`label-position="top"`）
- 分组卡片：白色背景，`border-radius:6px`，**无 box-shadow**（实测 shadow=none）
- **分组标题**：`font-size:16px; font-weight:600; color:#333333; border-bottom:1px solid #DCDFE6; padding-bottom:10px; margin-bottom:16px`
- **Form 标签**：`color:#909399; font-size:14px; font-weight:400; line-height:22px`（在字段上方）
- **表单字段间距**：`margin-bottom:10px`
- **输入框**（Element Plus 3 实测）：使用 **box-shadow inset** 而非 border 属性
  - `box-shadow: rgb(220,223,230) 0px 0px 0px 1px inset; border-radius:4px; font-size:14px`
  - 聚焦：`box-shadow: #3363FF 0 0 0 1px inset`
  - 错误：`box-shadow: #F56C6C 0 0 0 1px inset`
- **筛选区输入框高度**：`30px`（比表单输入框矮，filter 专用）
- **底部操作栏**（固定在页面底部）：
  - `position:fixed; bottom:0; background:#fff; box-shadow:rgba(0,0,0,0.1) 0 -1px 4px 0`
  - `text-align:center`，按钮间距 `8px`
  - 按钮规格：`height:32px; width:80px; border-radius:4px`
  - 取消：`background:#fff; border:1px solid #DCDFE6; color:#333333`
  - 保存：`background:#3363FF; color:#fff`

```vue
<template>
  <!-- Tab 页签会自动显示当前页名称 -->
  <div class="page-form">
    <!-- 分组卡片 1 -->
    <div class="form-card">
      <div class="section-title">基本信息</div>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="form-grid"><!-- 3列 -->
          <el-form-item label="客户名称" prop="name" required>
            <el-input v-model="form.name" placeholder="请输入" />
          </el-form-item>
          <el-form-item label="客户简称" prop="shortName">
            <el-input v-model="form.shortName" placeholder="请输入" />
          </el-form-item>
          <el-form-item label="客户类型" prop="type">
            <el-select v-model="form.type" placeholder="请选择" style="width:100%" />
          </el-form-item>
        </div>
      </el-form>
    </div>
    <!-- 更多分组卡片 ... -->

    <!-- 底部按钮（居中）：标准新增/编辑主操作=「保存」(实测)；设置/配置类整页才用「提交」；存草稿仅特定流程加 -->
    <div class="form-footer">
      <el-button @click="router.back()">取消</el-button>
      <el-button @click="onSaveDraft">存草稿</el-button><!-- 可选·仅有草稿需求时 -->
      <el-button type="primary" @click="onSave">保存</el-button>
    </div>
  </div>
</template>

<style>
.form-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0 24px; }
/* 分组卡片：无边框，轻阴影（来自 示例 OMS 截图） */
.form-card { background: #fff; border-radius: 4px; box-shadow: 0 1px 4px rgba(0,0,0,.06); padding: 20px 24px; margin-bottom: 12px; }
/* 输入框高度 38px */
.form-grid .el-input__wrapper,
.form-grid .el-select__wrapper { min-height: 38px !important; }
.form-footer { text-align: center; padding: 20px; background: #fff; }
.section-title { font-size: 16px; font-weight: 600; border-bottom: 1px solid #E4E7ED; padding-bottom: 12px; margin-bottom: 20px; }
</style>
```

> 弹窗（Dialog）仍用于字段少（≤5个）的快速操作，参考 §6.1。

### 8.3 详情/查看页（实测 示例 WMS 2026-06-10）

**布局结构**（与新增/编辑页相同，但字段只读）：
- 页面顶部：订单概要卡片（订单号 + 状态 + 步骤进度条）
- 下方：多个「基本信息」分组块
- 字段：3 列等宽网格，标签在上（灰色），值在下（正文色）
- 空值显示 `--`
- 底部固定：居中「返回」按钮（`height:32px; width:80px`）

**顶部订单概要卡片**：
```
┌──────────────────┬────────────────────────────────────────┐
│  入库订单号       │  ① 创建  ━━  ② 提交  ━━  ③ 发货       │
│  POKFX260610001  │     admin       admin      admin        │
│                  │     10-06-2026  10-06-2026 10-06-2026   │
│  ✓ 已完成        │                                         │
└──────────────────┴────────────────────────────────────────┘
```

**步骤进度条实测样式**：
```css
/* 步骤圆圈 */
.step-icon {
  width:24px; height:24px; border-radius:50%;
  border:2px solid #3363FF; color:#3363FF;
  background:#fff; display:flex; align-items:center; justify-content:center;
}
/* 已完成步骤：实心蓝 + 白色勾 */
.step-icon.done { background:#3363FF; color:#fff; }
/* 步骤连接线 */
.step-line { flex:1; height:2px; background:#3363FF; }
/* 未到达步骤 */
.step-icon.pending { border-color:#DCDFE6; color:#999; }
.step-line.pending { background:#DCDFE6; }
```

**状态文字（"已完成"）**：`font-size:18px; font-weight:500; color:#333333`，前面配 `.option-icon__success` CSS 图标（绿色圆圈+勾）

```vue
<!-- 详情页分组块（与表单页共用 CSS） -->
<div class="form-card">
  <div class="section-title">基本信息</div>
  <div class="detail-grid">
    <div v-for="field in fields" :key="field.key">
      <div class="detail-label">{{ field.label }}</div>
      <div class="detail-value">{{ data[field.key] || '--' }}</div>
    </div>
  </div>
</div>

<style>
/* 详情字段：标签小灰字，值正文色 */
.detail-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:20px 24px; }
.detail-label { font-size:14px; color:#909399; margin-bottom:8px; } /* 实测 mb 8px */
.detail-value { font-size:14px; color:#333; }
</style>
```

---

## 9. 巴西本地化

### 9.1 日期时间

| 层 | 格式 |
|---|---|
| UI 展示 | `DD/MM/YYYY HH:mm:ss`（如 `04/05/2022 14:30:00`） |
| 数据存储 / API | ISO `YYYY-MM-DD HH:mm:ss` |
| 操作日志（审计）| ISO `YYYY-MM-DD HH:mm:ss`（国际标准） |

### 9.2 币种

- 默认 **BRL**（巴西雷亚尔），符号 R$
- 数字格式：`1.234,56`（千分位 `.`、小数点 `,`） ⚠️ 与中文相反
- 保留 2 位小数

### 9.3 葡语字段字典模板

```typescript
// src/locales/pt-BR.ts
export default {
  common: {
    confirm: 'Confirmar',
    cancel: 'cancelamentos',
    save: 'Salvar',
    delete: 'Excluir',
    edit: 'Editar',
    add: 'Nova',
    search: 'Consultar',
    reset: 'Reprovisão',
    export: 'Exportação',
    close: 'encerramento',
    to: 'até',
    yes: 'Sim',
    no: 'Não',
  },
  form: {
    please_input: 'Por favor, insira',
    please_select: 'Selecione',
    required: 'Obrigatório',
  },
  empty: {
    no_data: 'Não há dados',
    network_error: 'Erro de rede, verifique sua conexão e tente novamente',
    not_found: 'Página não encontrada',
    no_permission: 'Sem permissão para visualizar',
  },
  // 业务术语
  business: {
    expedidor: 'Expedidor',
    numero: 'Número',
    fornecedor_logistica: 'Fornecedor de Logística',
    tipo_mercadoria: 'Tipo de Mercadoria',
    comprimento: 'Comprimento',
    altura: 'Altura',
    horario_entrega: 'Horário de Entrega Programadaao Armazém',
  },
  menu: {
    home: 'Página Inicial',
    customer: 'Cliente',
    product: 'Produto',
    inbound: 'Entrada no Depósito',
    outbound: 'Saídas',
    stock: 'Estoque',
    logistics: 'Logística',
    after_sales: 'Pós-venda',
    finance: 'Financeiro',
    data: 'Dados',
    settings: 'Configurações',
    messages: 'Mensagens',
  }
}
```

### 9.4 字段命名习惯（葡语）

| 中文 | 葡语 |
|---|---|
| 编号 | Número |
| 名称 | Nome |
| 类型 | Tipo |
| 状态 | Estado / Status |
| 操作 | Operação |
| 创建时间 | Tempo de criação / Data de criação |
| 创建人 | Fundador / Criador |
| 客户 | Cliente |
| 产品 | Produto |
| 仓库 | Depósito / Armazém |

---

## 10. Tailwind 完整配置

```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 主色
        primary: {
          DEFAULT: '#3363FF',
          hover: '#3363FFCC',   // 80%
          active: '#1E4BDD',
          disabled: '#3363FF66', // 40%
          bg: '#3363FF1A',       // 10%
        },
        // 状态
        success: '#67C23A',
        danger: '#F56C6C',
        warning: '#F2AC3A',
        // 文字
        text: {
          primary: '#333333',
          secondary: '#666666',
          tertiary: '#909399',
          quaternary: '#A8ABB2',
          placeholder: '#DCDFE6',
        },
        // 背景
        background: {
          DEFAULT: '#F7F7F7',
          card: '#FFFFFF',
          hover: '#F5F7FA',
          nav: '#1F2937',
        },
      },
      fontFamily: {
        sans: ['Noto Sans SC', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'h-sub':     ['24px', { fontWeight: '500', lineHeight: '1.5' }],
        'h-main':    ['22px', { fontWeight: '400', lineHeight: '1.5' }],
        'base':      ['19px', { fontWeight: '400', lineHeight: '1.5' }],
        'input':     ['17px', { fontWeight: '400', lineHeight: '1.5' }],
        'caption':   ['16px', { fontWeight: '400', lineHeight: '1.5' }],
      },
      spacing: {
        '1': '4px',
        '2': '8px',
        '3': '12px',
        '4': '16px',
        '5': '20px',
        '6': '24px',
        '8': '32px',
        '10': '40px',
      },
      borderRadius: {
        DEFAULT: '4px',
        'sm': '2px',
        'md': '6px',
        'lg': '8px',
      },
      boxShadow: {
        'sm':   '0 1px 2px rgba(0,0,0,0.04)',
        DEFAULT: '0 2px 8px rgba(0,0,0,0.08)',
        'lg':   '0 4px 16px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config
```

---

## 11. 输出原型时的强制约束

AI 生成 HTML/Vue 原型时，**必须**遵守：

### 11.1 视觉一致性

- ✅ 主色用 `#3363FF`（不用 EP 默认 `#409EFF`）
- ✅ 字体用 **Noto Sans SC**（真系统字体·2026-07-12 实测；CDN 引入或 system fallback）
- ✅ 圆角默认 4px
- ✅ 间距按 4 的倍数（4 / 8 / 12 / 16 / 20 / 24 / 32 / 40）
- ✅ 阴影按 shadow 三级标准

### 11.2 组件用法

- ✅ 表格数据：文本左对齐、**数值右对齐**（铁律）
- ✅ Form 标签：**Top 位置**（label-position="top"）
- ✅ Checkbox/Radio 已选时**文字也变蓝**（覆盖 EP 默认黑字）
- ✅ Tab 列表页用 `type="border-card"` + 计数 `(N)`
- ✅ Dialog 底部按钮右对齐
- ✅ 分页器底部右对齐

### 11.3 文案规范

- ✅ 葡语优先（部署 BR）
- ✅ 中文 fallback（开发参考）
- ✅ 不混用："Confirmar" 不要写成 "Confirm"

### 11.4 日期时间

- ✅ UI 显示：`DD/MM/YYYY HH:mm:ss`
- ✅ 内部数据：ISO `YYYY-MM-DD HH:mm:ss`
- ✅ 分隔符：葡语模式 `até`；中文模式 `至`（来自 示例 OMS 截图）；不用 `~`

### 11.5 禁止

- ❌ 不用其他 UI 库（如 Vant、Ant Design Vue）
- ❌ 不用 EP 默认色板（主色必须 `#3363FF`）
- ❌ 不臆造组件（如果规范里没有，先问用户）
- ❌ 不写出 100% 拟真业务逻辑（原型仅展示 UI + 基本交互）

---

## 12. 导入 / 导出交互规范（原型强制标准）

> 来源：示例 OMS 截图 + 2026-06-09 实现验证。所有后续原型的导入/导出均必须按此规范，**不得只用 ElMessage 代替**。

### 12.1 导出（Export）

**效果**：点击导出 → 立即触发浏览器下载 CSV 文件，同时 ElMessage 提示导出条数。

| 规则 | 内容 |
|---|---|
| 触发方式 | `Blob + URL.createObjectURL` → `<a>.click()` → 自动下载 |
| 文件格式 | `.csv`（UTF-8 BOM `﻿`，保证 Excel 正确显示中文） |
| 文件名 | `{页面名称}_{YYYYMMDD}.csv`，如 `充值管理_20260609.csv` |
| 导出范围 | **当前筛选后的数据**（`filteredList`），不是全量 |
| 导出字段 | 与列表页全字段一致（PRD 规定"导出字段=列表全字段"） |
| 提示文案 | `ElMessage.success('已导出 N 条 XXX 记录')` |

**代码模板**：

```javascript
/* 可复用的 CSV 下载工具函数 */
const downloadCsv = (rows, cols, filename) => {
  const header = cols.map(c => c.label);
  const body = rows.map(r => cols.map(c => {
    const v = c.get(r);
    if (v === null || v === undefined || v === '') return '';
    const s = String(v).replace(/"/g, '""');
    return s.includes(',') ? `"${s}"` : s;
  }));
  const csv = [header, ...body].map(r => r.join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
};
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
};

/* 各页面导出函数示例（按实际字段替换 cols） */
const exportXxx = () => {
  const cols = [
    { label:'单号',   get: r => r.orderNo },
    { label:'金额',   get: r => r.amount.toFixed(2) },
    // ... 其余列
  ];
  downloadCsv(filteredList.value, cols, `XXX管理_${todayStr()}.csv`);
  ElMessage.success(`已导出 ${filteredList.value.length} 条记录`);
};
```

---

### 12.2 导入（Import）

**效果**：点击导入 → 弹出标准导入对话框 → 用户选择/拖拽文件 → 点击「导入」→ 模拟处理 ~1.2s → 追加 mock 数据到列表 → 对话框关闭 + ElMessage 成功提示。

#### 对话框结构（来自 示例 OMS 截图）

```
┌─ 导入 XXX  ─────────────────────────────── × ─┐
│ ┌─ 导入说明（灰底 #F7F9FA）──────────────────┐ │
│ │ 1、请先下载导入模板  [下载模板]              │ │
│ │ 2、将需要导入的信息添加到模板中              │ │
│ │ 3、上传添加信息后的模板                      │ │
│ │ 4、最多可导入5000条数据                      │ │
│ │ 5、导入成功的数据，[业务状态说明]            │ │
│ │ 6、支持导入格式为.xlsx/.xls的文件           │ │
│ └────────────────────────────────────────────┘ │
│ ┌─ 上传区（白底，虚线边框）──────────────────┐ │
│ │         [文件夹+上传图标 SVG]               │ │
│ │              导入文件                        │ │
│ │    将文件拖到此处，或 [点击上传]             │ │
│ └────────────────────────────────────────────┘ │
├─────────────────────────────────────────────────┤
│                          [取消]  [导入（蓝）]   │
└─────────────────────────────────────────────────┘
```

| 规则 | 内容 |
|---|---|
| Dialog 宽度 | `640px` |
| 说明卡片 | `background:#F7F9FA; border-radius:6px; padding:16px 20px;` |
| 上传区 | 虚线边框 `1.5px dashed #D0D3D9`，hover/拖拽时变蓝边蓝底 |
| 接受格式 | `accept=".xlsx,.xls"` |
| 拖拽支持 | `@dragover.prevent` / `@dragleave` / `@drop.prevent` |
| 文件选中后 | 隐藏上传图标，显示文件名 + 大小 + × 删除 |
| 下载模板 | 生成包含表头 + 示例行的 CSV，直接下载 |
| 导入处理 | `setTimeout(callback, 1200)` 模拟异步；追加 mock 数据到 `records.value` |
| 成功提示 | 对话框关闭后 `ElMessage.success('导入完成，成功导入 N 条 XXX，状态为"XXX"')` |

**代码模板**：

```javascript
const importDlg      = ref(false);
const importFile     = ref(null);   // null | { name, size }
const importLoading  = ref(false);
const importDragover = ref(false);

const openImportDlg = () => { importFile.value=null; importLoading.value=false; importDlg.value=true; };

const onImportFileChange = (e) => {
  const f = e.target.files[0]; if (!f) return;
  const ext = f.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls'].includes(ext)) { ElMessage.error('请上传 .xlsx 或 .xls 格式的文件'); return; }
  importFile.value = { name: f.name, size: f.size };
};
const onImportFileDrop = (e) => {
  importDragover.value = false;
  const f = e.dataTransfer.files[0]; if (!f) return;
  const ext = f.name.split('.').pop().toLowerCase();
  if (!['xlsx','xls'].includes(ext)) { ElMessage.error('请上传 .xlsx 或 .xls 格式的文件'); return; }
  importFile.value = { name: f.name, size: f.size };
};
const removeImportFile = () => { importFile.value = null; };

const downloadImportTpl = () => {
  const header = ['字段1（必填）', '字段2（必填）', '字段3', '备注'];
  const example = ['示例值1', '示例值2', '', ''];
  const csv = [header, example].map(r=>r.join(',')).join('\r\n');
  const blob = new Blob(['﻿'+csv], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download = 'XXX导入模板.csv';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(a.href);
};

const submitImport = () => {
  if (!importFile.value) { ElMessage.warning('请先选择要导入的文件'); return; }
  importLoading.value = true;
  setTimeout(() => {
    // 追加 mock 数据（按实际业务字段补充）
    const newRows = [ /* 3 条 mock 记录 */ ];
    records.value = [...records.value, ...newRows];
    importLoading.value = false;
    importDlg.value = false;
    ElMessage.success('导入完成，成功导入 3 条 XXX，状态为"待审核"');
  }, 1200);
};
```

**Dialog HTML 模板**：

```html
<el-dialog v-model="importDlg" title="导入XXX" width="640px" :close-on-click-modal="false">
  <div class="import-desc-card">
    <div style="font-size:15px;font-weight:600;margin-bottom:12px;">导入说明</div>
    <ol class="import-desc-list">
      <li>请先下载导入模板<span class="import-dl-link" @click="downloadImportTpl">下载模板</span></li>
      <li>将需要导入的信息填写到模板中</li>
      <li>上传填写好的模板文件</li>
      <li>最多可导入5000条数据</li>
      <li>导入成功的数据状态为"待审核"（按业务调整）</li>
      <li>支持导入格式为.xlsx/.xls的文件（手动修改文件后缀无效）</li>
    </ol>
  </div>
  <div class="upload-card">
    <div class="upload-zone" :class="{'has-file':importFile,'dz-over':importDragover}"
         @dragover.prevent="importDragover=true" @dragleave="importDragover=false"
         @drop.prevent="onImportFileDrop">
      <input v-if="!importFile" type="file" accept=".xlsx,.xls" @change="onImportFileChange" />
      <template v-if="importFile">
        <div class="file-selected">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3B7DFF" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          <span class="fs-name">{{ importFile.name }}</span>
          <span class="fs-size">{{ (importFile.size/1024).toFixed(1) }} KB</span>
          <span class="fs-del" @click.stop="removeImportFile">×</span>
        </div>
      </template>
      <template v-else>
        <div class="uz-icon">
          <!-- 文件夹+上传云图标 SVG（固定，不替换）-->
          <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
            <rect x="4" y="20" width="44" height="34" rx="3" fill="#E8ECF0"/>
            <path d="M4 30h44" stroke="#BCC0C8" stroke-width="1.5"/>
            <path d="M4 20l8-10h12l6 10" fill="#D4D8DF"/>
            <circle cx="46" cy="46" r="12" fill="#303133"/>
            <path d="M46 40v12M40 46l6-6 6 6" stroke="#fff" stroke-width="2"
                  stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="uz-title">导入文件</div>
        <div class="uz-hint">将文件拖到此处，或 <span class="uz-link">点击上传</span></div>
      </template>
    </div>
  </div>
  <template #footer>
    <el-button @click="importDlg=false">取消</el-button>
    <el-button type="primary" :loading="importLoading" @click="submitImport">导入</el-button>
  </template>
</el-dialog>
```

**CSS（添加到 `<style>` 末尾）**：

```css
.import-desc-card { background:#F7F9FA; border-radius:6px; padding:16px 20px; margin-bottom:16px; }
.import-desc-list { padding-left:20px; margin:0; }
.import-desc-list li { font-size:14px; color:var(--text-1); line-height:2.2; }
.import-dl-link { color:var(--primary); cursor:pointer; margin-left:6px; }
.import-dl-link:hover { text-decoration:underline; }
.upload-card { border:1px solid var(--border); border-radius:6px; padding:16px; }
.upload-zone { border:1.5px dashed #D0D3D9; border-radius:6px; padding:40px 20px; text-align:center; cursor:pointer; position:relative; transition:border-color .15s,background .15s; }
.upload-zone:hover, .upload-zone.dz-over { border-color:var(--primary); background:#F5F8FF; }
.upload-zone input[type=file] { position:absolute; inset:0; width:100%; height:100%; opacity:0; cursor:pointer; }
.uz-title { font-size:15px; font-weight:500; color:var(--text-1); margin-bottom:6px; }
.uz-hint { font-size:13px; color:var(--text-3); }
.uz-hint .uz-link, .uz-link { color:var(--primary); }
.upload-zone.has-file { border-color:var(--primary); background:#F5F8FF; border-style:solid; }
.file-selected { display:flex; align-items:center; gap:10px; padding:4px 0; justify-content:center; }
.file-selected .fs-name { font-size:14px; color:var(--text-1); }
.file-selected .fs-size { font-size:12px; color:var(--text-3); }
.file-selected .fs-del { cursor:pointer; color:var(--text-3); font-size:20px; line-height:1; }
.file-selected .fs-del:hover { color:var(--danger); }
```

---

## 13. 用户自标注系统规范（原型强制标准）

> 来源：2026-06-09 实现验证。所有后续原型必须内置此系统，**不得省略**。

### 13.1 功能说明

| 功能 | 说明 |
|---|---|
| 用户标注模式 | 导航栏「✏️ 用户标注」按钮开启，主内容区顶部出现功能区域芯片栏 |
| AI 草稿预填 | 首次点击某区域 → 自动从 `window.__PRD_DATA__` 生成草稿内容，用户可修改后保存 |
| 编辑已有标注 | 点击已有标注芯片（橙点标记）→ 打开编辑弹窗，可修改或删除 |
| 查看全部标注 | 导航栏「查看全部」→ 右侧抽屉，列出所有标注 + 导出按钮 |
| 导出 JSON | 生成结构化 JSON，粘贴给 AI 即可更新 PRD |
| 分享只读版 | 导出 JSON → 告诉 AI「嵌入原型 HTML 并设为只读」→ 收到 HTML 的人只能查看 |
| localStorage 持久化 | 标注存 `u-annotations` 键，刷新/关闭不丢失 |

### 13.2 权限与只读机制

| 变量 | 值 | 含义 |
|---|---|---|
| `window.__ANNO_READONLY__` | `true` | **只读模式**：编辑按钮隐藏，区域芯片点击只能查看 |
| `window.__ANNO_READONLY__` | `false` / 未定义 | **编辑模式**：完整编辑权限 |
| `window.__USER_ANNOTATIONS__` | `{ zoneId: {...} }` | AI 嵌入的标注数据（只读模式下展示给他人看） |

**分享只读版生成流程**：
1. 用户标注完毕 → 导出 JSON
2. 告诉 AI：「请把这些标注嵌入原型 HTML，并设为只读」
3. AI 在 HTML `<head>` 注入：
   ```html
   <script>
   window.__USER_ANNOTATIONS__ = { /* ...JSON 内容... */ };
   window.__ANNO_READONLY__ = true;
   </script>
   ```
4. 分发修改后的 HTML → 收到者只能查看标注，不能编辑

### 13.3 功能区域定义（标准 Zone 映射）

每个原型页面的可标注区域由 JS `uAnnoZones` computed 动态生成，规则如下：

| page 值 | 标准 Zone 集合 |
|---|---|
| `home` | 首页仪表盘、账户余额卡片 |
| `recharge-list` | 筛选区、工具栏、数据列表、充值表单、单据详情、审核弹窗（WMS）、导入对话框 |
| `balance` | 筛选区、工具栏、数据列表 |
| `flow` | 筛选区、工具栏、数据列表 |
| 自定义 | 开发者按 `{ id: '${sys}-${page}-${type}', label: '...' }` 格式扩展 |

### 13.4 AI 草稿生成规则

当用户首次点击某个 Zone（尚无已保存标注）时，自动调用 `genAnnoDraft(zoneId, zoneLabel)` 预填内容：

| Zone 类型 | 草稿来源 |
|---|---|
| `filter` | 从 PRD 查询功能点的 `operation_flow` 生成说明 |
| `toolbar` | 从 PRD 菜单定义的 `functions` 列表生成 |
| `table` | 固定模板：排序/分页/操作列权限说明 |
| `form` | 从 PRD 新增功能点的 `field_specs.groups.fields` 生成字段清单 |
| `audit` | 从 PRD 审核功能点的 `operation_flow` 生成 |
| `detail` | 固定模板：详情只读说明 |
| `import` | 固定模板：导入规则说明 |

草稿显示时，编辑弹窗顶部显示黄色提示条「以下内容由 AI 自动生成，请确认或修改后保存」，按钮文字变为「确认并保存」。

### 13.5 导出 JSON 格式

```json
{
  "exportedAt": "2026-06-09T...",
  "prototype": "充值管理",
  "prototypeVersion": "v1.0",
  "annotations": [
    {
      "zoneId": "btn-OMS-recharge-list-充值",
      "zoneLabel": "按钮：充值",
      "title": "按钮：充值",
      "type": "业务规则",
      "content": "发起充值申请，仅充值权限用户可见...",
      "updatedAt": "2026-06-09T..."
    }
  ],
  "fieldSpecEdits": [
    { "fpKey": "充值管理-OMS.充值", "fieldName": "申请充值金额", "prop": "constraint", "newValue": "最小 100，最大 500000" }
  ]
}
```

### 13.6 画布标注规范（Canvas Annotation）

**原则**：原型整页是画布，标注模式开启后**任意元素**均可标注。与 UI 设计规范无关，适用所有原型（默认规范/临时学习规范/自定义规范）。

#### 实现机制

| 步骤 | 说明 |
|---|---|
| 开启标注模式 | 点击「✏️ 用户标注」→ `body.canvas-anno-on` 类设置，全局 hover 监听启动 |
| 悬停触发 | 鼠标悬停到可标注元素时，右上角出现橙色圆形铅笔按钮 `#fld-anno-btn` |
| 点击铅笔 | 打开用户标注弹窗，**自动预填 AI 草稿**（用户在草稿基础上修改，不写空白表单）|
| 保存 | 写入 `localStorage.u-annotations`，铅笔按钮变为橙底（已标注状态）|
| 退出标注模式 | 点击「退出标注」，铅笔按钮隐藏，页面恢复正常交互 |

#### 可标注元素类型与 Zone ID 命名规则

| 元素 CSS 选择器 | Zone ID 前缀 | AI 草稿来源 |
|---|---|---|
| `table.pt thead th` / `.el-form-item__label` | `fld-{sys}-{page}-{字段名}` | PRD `field_specs` 字段规格 |
| `.el-button` | `btn-{sys}-{page}-{按钮文字}` | 内置按钮语义映射（充值/审核/驳回/导出/导入/查询/重置等）|
| `.stab`（状态标签）| `stab-{sys}-{page}-{状态名}` | 内置状态语义映射（全部/待审核/已通过/已驳回/已取消）|
| `.el-tabs__item` | `tab-{sys}-{page}-{Tab名}` | 内置 Tab 说明模板 |
| `table.pt tbody td` | `td-{sys}-{page}-{单元格文字}` | 通用数据字段说明模板 |

**CSS 视觉反馈**（标注模式开启时）：
```css
body.canvas-anno-on .el-button:hover,
body.canvas-anno-on table.pt thead th:hover,
body.canvas-anno-on .stab:hover { outline:2px dashed #3B7DFF; cursor:crosshair; }
```

#### AI 草稿自动生成规则（`genAnnoDraft` 完整行为）

所有 Zone 类型首次打开时**必须自动生成草稿**，用户不需要手写任何内容：

| Zone 前缀 | 草稿策略 |
|---|---|
| `fld-` | 从 PRD `field_specs` 取 type/required/default/constraint；找不到则生成通用列说明模板 |
| `btn-` | 内置按钮 → 映射表（充值/审核/驳回/导出/导入/查询/重置/取消/确认/提交/下载模板）；未映射按钮 → 结构化空白模板（触发条件/权限要求/操作结果/异常提示）|
| `stab-` | 内置状态 → 映射表（全部/待审核/已通过/已驳回/已取消）；未映射状态 → 结构化模板 |
| `tab-` | 内置 Tab → 映射表（充值管理/账户余额/资金流水）；未映射 → 结构化模板 |
| `td-` | 通用数据字段规则模板（数据来源/格式/空值处理/特殊显示）|
| `filter/toolbar/table/form/audit/detail/import` | 原有 PRD 数据提取逻辑（§13.4）|

**草稿 UI 必须**：弹窗顶部显示「以下内容由 AI 根据 PRD 数据自动生成，请确认或修改后再保存」黄色提示条；按钮文字为「确认并保存」而非「保存」。

### 13.7 字段规格直接编辑规范

在 ℹ️ 功能点标注弹窗（`anno-dialog`）的「字段规范」Tab 中，提供**直接编辑字段规格**的能力：

#### 触发方式

「字段规范」Tab 顶部始终显示「✎ 编辑字段规格」按钮；点击后：
- 所有字段行的 `类型/是否必填/默认值/约束规则` 列变为可编辑输入框（黄色背景高亮）
- 按钮区变为「保存修改」+「取消」
- 「保存修改」按钮在有任何修改时才可点击

#### 技术实现要点

```javascript
// 进入编辑模式时预填 prdFieldEdits（确保 v-model 有初始值）
const enterEditMode = () => {
  fp.field_specs.groups.forEach((g, gi) => {
    g.fields.forEach((f, fi) => {
      ['type','required','default','constraint'].forEach(prop => {
        prdFieldEdits[fek(gi, fi, prop)] = f[prop] || '';
      });
    });
  });
  annoEditMode.value = true;
};

// fek = field edit key，使用 currentFpKey.value（避免 ref 解包歧义）
const fek = (gi, fi, prop) => `${currentFpKey.value}:::${gi}:::${fi}:::${prop}`;
```

**注意**：模板中用 `v-model="prdFieldEdits[fek(gi, fi, 'type')]"` 而非 `:value + @input`，避免 Vue 3 in-DOM 模板对 ref 解包的歧义问题。

#### 保存后行为

1. `prdFieldEdits` 的所有键值应用到 `window.__PRD_DATA__` 对应字段
2. 清空 `prdFieldEdits`，退出编辑模式
3. 「复制 PRD 更新指令」按钮导出的 JSON 中自动包含 `fieldSpecEdits` 字段，AI 可精确 patch PRD 文件

---

## 13b. 开票失败提示与【怎么改】处理指引（原型强制标准·2026-10-28 用户定稿）

凡「开票失败 / 被税局拒收」的地方（发票管理、各业务单据列表与详情、收银台订单管理），一律同一套，禁各模块各写一套：

**① 失败提示条（列表行下方 / 详情发票信息下方）**：一行 `⚠ 原因标题 ：税局返回：<税局原话> ｜ 怎么改 ›`，各模块同一样式。

**② 【怎么改】弹窗**（宽 600px）：
- 标题固定「怎么改」（en How to fix / pt Como corrigir），不写具体原因。
- 内容三段：① 系统报的异常（税局原话，等宽灰底）→ ② 这句话的意思是（一句大白话 + 必要的背景说明，同一块；下面一行橙色「影响：…」）→ ③ 怎么解决（表格）。
- ③ 表格行固定顺序：已自动核查 / 去哪儿改 / 要改什么 / ⚠ 别做什么 / 谁来做 / 改完怎么办。六行都要有，「别做什么」红字。
- 「去哪儿改」能对应到原型里某一页的，路径写成可点链接（`<span class="cell-link" data-go="页id">路径 ›</span>`），点了关弹窗、切到对应顶栏系统并打开那一页；就在本页或系统外（州税局、官网）的保持文字。
- 「改完怎么办」里写的【按钮名】必须等于用户当时所在页面上真实存在的按钮（如发票管理开票失败＝【更多 › 修改重提】→【开票提交】；业务单据＝【开票】；退货发票＝【重新开票】）。
- 底部按钮只有【关闭】【复制排查信息】。

---

## 14. 版本与维护

| 版本 | 日期 | 变更 |
|---|---|---|
| v1.0 | 2026-05-27 | 首次发版，覆盖 18 类组件 + Tailwind 配置 + 巴西本地化 |
| v1.1 | 2026-06-09 | §5.3 筛选区输入框 36px + 按钮右对齐规范；§8.2 表单卡片无边框改阴影 + 输入框 38px + 存草稿按钮；§11.4 日期分隔符中英双模式 |
| v1.2 | 2026-06-09 | 新增 §12 导入/导出交互规范：导出 Blob+CSV+BOM 代码模板 + 命名规范；导入 640px 对话框布局规范 + 完整 HTML/CSS/JS 代码模板 |
| v1.3 | 2026-06-09 | 新增 §13 用户自标注系统规范：AI 草稿预填 + 用户可编辑 + 只读分享机制 + 导出 JSON 同步 PRD |
| v1.4 | 2026-06-09 | §13.6 画布标注规范（任意元素 hover 铅笔 + 5 类元素 AI 草稿自动生成）；§13.7 字段规格直接编辑规范；通用性声明：标注系统与 UI 规范无关，适用所有原型 |

**后续**：
- 用户提供新规范图 → 增量更新到 v1.3+
- 每次更新同步 `prototype-template.md`

---

**规范结束。AI 生成原型时必须 100% 遵守本文档。**
