---
slug: antd-mobile-ecommerce
source: https://github.com/ant-design/ant-design-mobile （master 分支 src/global + src/components 原始 .less）
type: 公开设计系统
method: WebFetch 逐字抓取官方开源 .less 源码（非记忆/非截图逆推）
learned_at: 2026-08-04
updated_at: 2026-08-04
confidence: 4
covered_pages:
  - 设计令牌（浅色 + 深色主题·语义色/文字/背景/字号/圆角/字体族）
  - 基础布局（视口px策略/安全区/栅格/NavBar·TabBar高度）
  - 组件范式（NavBar/TabBar/SearchBar/List/Card/Button/Badge/Tag/Grid/Swiper/Tabs/Stepper/Toast/Dialog/ActionSheet/PullToRefresh/FloatingBubble/SafeArea）
known_gaps:
  - 官方【无】价格色/促销色专用令牌（电商促销红=借用 danger #ff3141 或 orange #ff6430·属惯例非规范）
  - 官方【无】商品卡(Product Card) 组件（需 Card+Image+Grid+Price 自由组合）
  - 官方【无】Price 价格展示组件·无价格专用字号
  - 官方【无】集中 spacing 令牌（间距为组件硬编码·12px 是事实基准）
  - 官方【无】阴影(shadow) 令牌
  - 官方【无】最小可点区域(touch target) 数值
  - 浅色主题 --adm-color-background-body 未显式赋值（仅深色定义）
  - InfiniteScroll(上拉加载) 具体令牌本轮未抓
  - Fusion Design 令牌未纳入（其令牌页为 SPA·未抓到可验证官方数值·不编造）
ui_framework: Ant Design Mobile v5（阿里官方开源·React·CSS 变量 --adm-*）
license_note: 仅设计语言参考·不复制商标/配图；**这是阿里官方开源设计体系，不代表淘宝/天猫 App 逐像素现状**·要精确当前 App 皮需用户提供截图
---

# 电商移动端设计规范 · 阿里系（Ant Design Mobile v5 · 学习快照）

> **定位**：画【移动电商】原型选「默认」时的参照皮。数据全部逐字来自 antd-mobile 官方开源 `.less` 源码（见 frontmatter `source`），属阿里官方公开设计体系。**不是淘宝/天猫 App 的逐像素还原**——要那个得用户给截图（见 [[feedback_mobile_spec_by_category]] 第 2 档）。
> **令牌都是 CSS 变量** `--adm-*`，换皮=改变量即可（天然利于代码生成的令牌契约）。

---

## 1 设计令牌

### 1.1 语义色 / 品牌色（浅色主题 · TOKEN_SRC = `src/global/theme-default.less`）
| 令牌 | 值 | 说明 |
|---|---|---|
| 主色 primary | `#1677ff` | 也是链接色（`a{color:var(--adm-color-primary)}`）|
| 成功 success | `#00b578` | |
| 警告 warning | `#ff8f1f` | |
| 危险/错误 danger | `#ff3141` | 也是 highlight |
| 黄 yellow | `#ff9f18` | 辅助 |
| 橙 orange | `#ff6430` | 辅助（电商促销常借用）|
| 浅蓝底 wathet | `#e7f1ff` | |

### 1.2 文字色
| 令牌 | 值 |
|---|---|
| 文字-主要 text | `#333333` |
| 文字-次要 text-secondary | `#666666` |
| 文字-弱化/占位 weak | `#999999`（同 placeholder）|
| 文字-禁用/更浅 light | `#cccccc` |
| 浅底反白 text-light-solid | `#ffffff` |
| 深底反白 text-dark-solid | `#000000` |

### 1.3 背景 / 填充 / 边框
| 令牌 | 值 |
|---|---|
| 背景 background | `#ffffff` |
| 填充/内容底 box · fill-content | `#f5f5f5` |
| 边框/分割线 border | `#eeeeee` |

### 1.4 字号阶梯（10 级）
`9 / 10 / 11 / 12 / 13 / 14 / 15 / 16 / 17 / 18 px`（font-size-1 … font-size-10）
**主字号 font-size-main = 13px（=font-size-5）**。常用锚点：徽标 9、TabBar 标题 10、Tag 11、弹窗正文 14、导航左区/搜索/列表标题 15、按钮/列表项/Tabs 标题 17、导航栏标题/弹窗标题 18。

### 1.5 字重 / 行高 / 字体族
- 默认字重 normal；**标题类 bold**（Card/Dialog 标题）。
- 无全局 line-height 令牌；按钮 1.4、列表项/正文/Toast 1.5。
- 字体族：`-apple-system, blinkmacsystemfont, 'Helvetica Neue', helvetica, segoe ui, arial, roboto, 'PingFang SC', 'miui', 'Hiragino Sans GB', 'Microsoft Yahei', sans-serif`

### 1.6 圆角阶梯
`radius-s 4px · radius-m 8px · radius-l 12px`
组件惯例：Button 4 · Card/List卡片 8 · SearchBar 6 · Tag 2 · Stepper 2 · Badge 100（胶囊）· 圆角按钮 shape-rounded 1000。

### 1.7 间距 / 阴影
- **无集中 spacing 令牌**；间距为组件硬编码，**12px 是事实基准内边距**（NavBar/List/Card/Grid）。
- **无阴影令牌**（theme-default.less 无 shadow）。

### 1.8 深色主题（`src/global/theme-dark.less` · `html[data-prefers-color-scheme='dark']`）
primary `#3086ff` · success `#34b368` · warning `#ffa930` · danger `#ff4a58` · yellow `#ffa930` · orange `#e65a2b` · wathet `#0d2543`
text `#e6e6e6` · text-secondary `#b3b3b3` · weak `#808080` · light `#4d4d4d` · border `#2b2b2b` · box `#0a0a0a` · background `#1a1a1a`

---

## 2 基础 / 布局
| 项 | 值 |
|---|---|
| 单位策略 | 直接用 **px**（v5 已弃 rem；提供 `.adm-px-tester` 探测 1px 物理像素）|
| 安全区 | SafeArea 组件：`padding-top/bottom: calc(env(safe-area-inset-*) × --multiple)`，multiple 默认 1 |
| 栅格 Grid | `repeat(--columns, minmax(0,1fr))`；默认 grid-gap 10px（`--gap`/`--gap-horizontal`/`--gap-vertical` 覆盖）|
| NavBar 高度 | `45px`（`--height`）|
| TabBar 高度 | `min-height 48px` |
| tap 高亮 | `-webkit-tap-highlight-color: rgba(0,0,0,0)`（去点按灰块）|
| 最小可点区域 | 未验证（无官方令牌）|

---

## 3 组件范式（关键规格·逐字来自各组件 `.less`）

**NavBar 顶栏**：高 45px · 内边距 0 12px · flex（left/right flex:1，title 居中省略）· 返回箭头 24px（右距 4，返回区右 margin 16）· 左区字号 15 · 标题 18。默认无底边框。

**TabBar 底栏**：min-height 48 · item flex:1 纵排(icon上/title下) padding 4 8 · 默认色 #666 / 激活 primary · 图标 24px · 标题 10px(line-height 15，带图标 margin-top 2) · 图标角标 top6 / 标题角标 right-2 top-2。

**SearchBar 搜索框**：高 32 · 左内边距 8 · 底 #f5f5f5 · 圆角 6 · 占位色 #999 · 图标 #ccc/16px · 输入 15px · **聚焦态边框=primary、底变白** · 取消按钮 padding 3 12。

**List/Cell 列表**：容器字号 17 · 左右内边距 12 · extra 最大宽 70% · 表头 #999/15px(padding 8 12) · 分割线 1px #eee · item main 区 padding 12 0 · 标题/描述 #999·13px·行高1.5 · 右箭头 #ccc/19px · 按下态底 #eee · card 模式 margin 12+圆角 8 · 禁用 opacity .4 + pointer-events none。

**Card 卡片**：底 #fff · 圆角 8 · 横向内边距 12 · header flex 两端(gap 8, padding 12 0，非末项底 0.5px #eee) · header 标题 15px bold 行高1.4 · body padding 12 0。

**Button 按钮**：默认 padding 7 12 · 字号 17 行高1.4 · 圆角 4 · 边框 1px #eee(default) · 按下 ::before 叠 #000 opacity .08。
- color：default(文字色边框) / primary #1677ff / success / danger / warning
- fill：fill-solid(默认实底) / fill-outline(透明底+彩边彩字) / fill-none(纯文字)
- size：mini(padding 3上下·13px) / small(3上下·15px) / 默认(7上下·17px) / large(11上下·18px)
- shape：default 4 / rounded 1000(胶囊) / rectangular 0；block=width 100% 通栏
- 禁用 opacity .4 · loading opacity .6

**Badge 角标**：色=highlight #ff3141 · 圆角 100(胶囊) · 白字·min-width 8·padding 1 4·9px(line-height 12) · dot 10×10 圆角5 · fixed 右上 translate(50%,-50%) · bordered 1px 白描边。
**Tag 标签**：圆角 2(round 变体 100) · padding 2 4 · 11px 行高1 · 边框 1px(随 color)。

**Grid 宫格**：`repeat(--columns,minmax(0,1fr))` · gap 默认 10（`--gap`/`--gap-horizontal`/`--gap-vertical`）· item `span --item-span`。

**Swiper/Banner**：令牌 --height auto / --width 100% / --border-radius 0 / --slide-size 100% · 横向 pan-y、纵向 pan-x · 指示器 横向底 bottom6 居中 / 纵向右 right6 居中。

**Tabs 标签页**：标题 17px · 内容内边距 12 · 激活下划线 2px(圆角=线高，色 primary) · 激活标题 primary · header 底 1px #eee · tab padding 8 0 10(可横滚) · 两侧渐隐遮罩 30px。

**Stepper 数量步进**：高 28 · 输入框宽 44(总宽=44+2×按钮) · 输入 13px 居中 底 #f5f5f5 · 圆角 2 · 按钮 宽=28 字号15 字色 primary 底 #f5f5f5 · 禁用按钮字色 #999。

**Toast**：屏幕居中 · 最大宽 204/最大高70% · 白字 底 rgba(0,0,0,.7) 圆角 8 · 15px 行高1.5 · 纯文字 padding 12 / 带图标 padding 35 12+min-width 150+图标36 · loading --size 48。

**Dialog 对话框**：z-index 1000 · body 最大高 70vh·14px(无图时上内边距20) · 标题 18px bold 居中 行高25(底距8) · 内容 padding 0 12 20·15px 行高1.4 色 text · 底部按钮 上边框0.5px·padding10·18px 行高25 圆角0(多按钮 0.5px 分隔·加粗变体 bold) · 图片区 margin-bottom12 max-height40vh。

**ActionSheet 动作面板**：顶部左右圆角 8 · extra 说明区 居中 #999·15px·padding 18 12(底1px) · 按钮项 居中 底 background padding16(按下底 #eee) · 名称 text·18px、描述14px #999(上距4) · **危险项 danger #ff3141 + bold** · 取消区 底 #f5f5f5(上内边距8)。

**PullToRefresh 下拉刷新**：头部内容 绝对定位底部居中·色 #999。（上拉加载=InfiniteScroll，本轮未抓令牌。）

**FloatingBubble 悬浮气泡**（可作悬浮购物车按钮）：--size 48 · 圆角 50%(圆形) · 底=primary · 图标白 · z-index 1 · fixed 可拖拽(touch-action none) · --edge-distance 边界留白。

**SafeArea 安全区**：上/下 = `calc(env(safe-area-inset-*) × --multiple)`，multiple 默认 1。

---

## 4 电商落地补充（官方无专用组件时的组合惯例·⚠️非官方规范）

antd-mobile 官方**没有** Product Card / Price 组件，也没有价格色令牌。生成移动电商原型时按以下惯例组合（并在原型里注明是惯例、非官方）：

- **商品卡** = `Card(圆角8·内边距12)` + 顶部 `Image`(1:1 或 3:4) + 标题(2 行省略·15px #333) + `Grid`/flex 排价格与操作。
- **价格强调** = 用 **danger `#ff3141`** 或 **orange `#ff6430`** + 较大字号（如 17-18px bold），货币符号小一号；划线原价用 weak `#999` + line-through。
- **促销/活动标签** = `Tag`(圆角2·11px) 或 `Badge`，底色借用 danger/orange。
- **加购/悬浮购物车** = `FloatingBubble`(48px 圆·primary)；数量选择用 `Stepper`(高28)。
- **底部结算栏** = 固定底栏 + `SafeArea` 下安全区 + 通栏 `Button`(block·rounded 胶囊或 rectangular)。

---

## 5 抓不全 / 未验证（已在 frontmatter known_gaps 列全）
见 frontmatter。核心：价格色/商品卡/Price/spacing/shadow/touch-target 官方均无专用令牌或组件；Fusion Design 未纳入（SPA 抓不到可验证数值，不编造）。要补齐这些或对齐淘宝 App 当前皮，需用户提供截图/参考素材。
