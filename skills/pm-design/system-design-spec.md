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

### 2.1 颜色 Color

> **来源**：从真实 B 端 WMS/OMS 系统源码（`basic.scss` / `el-table.scss` / `layout`）提取的设计 token（**2026-07-07 以最新代码为准更新**·已匿名），团队默认权威值。
> **2026-07-07 校准记录**：主色 #3363FF / 语义色 / 表头背景 #F7F8FA / 操作图标 rgba(51,99,255,.8) 与代码一致（未变）；正文 #444→**#333333**、三级/表头文字 #999→**#909399**、页面背景 #F2F3F5→**#F2F2F2**、表格字号→**14px**（均按 basic.scss/el-table.scss）；**导航经代码确认为顶部 #122041·高 50px（无侧栏，Sidebar 已注释禁用）**；新增边框 #DCDFE6 / 筛选区背景 #f7f8fa / 页签导航条 #F0F2F5 / 表格选中 #F6FFF0。
> **2026-07-09 补充实测（对真代码校 5 处·前 4 项旧 spec 缺/错，已修）**：① 页面布局最小宽 **`min-width:1350px`**（index.vue）；② 表格**表头 sticky 吸顶**（下边框 #DCDFE6）+ **分页 sticky 吸底**（padding `12px 24px`·上边框 #DCDFE6·`justify-content:space-between` → **total 左 / pager 右**·total-box 行高 32px）；③ **状态页签选中 = 白底 #fff + 边框 1px #E4E7ED + 圆角 8px 8px 0 0 + 41px**（旧写的灰底 #F2F2F2/4px/40px 是错的，已改·见 §状态Tab）；④ **i18n = 自研 `lang()` 默认 pt**（旧写 vue-i18n 已改·见 §1）；⑤ **筛选区固定宽 210/564/112px**（非 33% 等宽网格·见 §5.3）。

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
> **与 TF OMS 真系统不符**。TF OMS 用 `zgl-search-box`，最大差别是——**没有 label**！

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

### 5.2b 【默认规范 = TF OMS 真系统】实测细节总表（2026-07-12 登录态 getComputedStyle）

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

> 真系统的搜索区**大量使用"三段组合控件"**：`[下拉选字段 ▾] + [输入值(带🔍)] + [精确/模糊 ▾]` 三段合一，后跟 `[查询][重置]`。这是 TF OMS 最典型的筛选范式，骨架用 `type:'combo'` 表达。

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

**数据写法**：project-data 加 `"topbar": { "user": "admin", "notif": 33 }`（缺省 `admin` / `0`）。

#### 5.3g 导航 = **双模式可切换（顶部导航 ⇄ 左侧菜单）**·默认顶部导航

> **默认 = 顶部导航**（真系统 TF OMS 就是顶栏）。但**两种模式都保留**，用户可在原型里随时切换。

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
