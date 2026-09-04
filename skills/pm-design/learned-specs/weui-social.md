---
slug: weui-social
source: https://github.com/Tencent/weui （master · src/style/base/theme/vars/light.less + dark.less · WebFetch 逐字抓官方开源令牌）
type: 公开设计系统
method: WebFetch 逐字抓取腾讯 WeUI 官方开源 less 令牌源码（非记忆/非截图逆推）
learned_at: 2026-09-01
updated_at: 2026-09-01
confidence: 3
status: 首版·参考行业规范·组件尺寸待补完善
covered_pages:
  - 设计令牌（浅色 + 深色主题·品牌/语义色/文字前景 FG/背景 BG·逐字来自源码）✅ 已坐实
  - 组件清单（WeUI 官方 widget 全集）✅ 已列
  - 布局/交互原则（微信社交端惯例）✅ 已列
known_gaps:
  - 组件【精确尺寸】未抓：cell 行高/内边距、button 高度/圆角、navbar/tabbar 高度、字号阶梯、间距阶梯——本轮只抓了颜色令牌，尺寸待下一轮抓 weui.wxss dist 补全
  - 字号/行高令牌：WeUI 用固定 px（如标题 17px、正文 17px、说明 14px、提示 12px 属事实基准）——未从源码逐字核，待补
  - 圆角：按钮/卡片圆角值未从源码抓（WeUI 事实基准约 button 8px、dialog 12px·待核）
  - 微信小程序 weui-wxss(rpx 版) 的 rpx 换算未纳入·本文件是 h5(px) 版
  - 深色主题 BG-4/BG-5 等未抓全（只抓了 BG-0~3）
  - 不代表微信 App 逐像素现状——要精确当前微信 App 皮需用户给截图（见 [[feedback_mobile_spec_by_category]] 第 2 档）
ui_framework: WeUI（腾讯·微信官方设计团队开源·h5 CSS 变量 --weui-*）
license_note: 仅设计语言参考·不复制微信商标/配图·不逆推登录后 App。这是腾讯官方开源设计体系。
---

# 移动社交端设计规范 · 微信系（WeUI · 学习快照·首版）

> **定位**：画【移动社交】类原型选「默认」时的参照皮（对照 [[feedback_mobile_spec_by_category]]：电商→阿里 [[antd-mobile-ecommerce]]、社交→本文件、B端→TF OMS）。
> **数据来源**：设计令牌逐字来自 WeUI 官方开源 `src/style/base/theme/vars/light.less` / `dark.less`（见 frontmatter）。
> **诚实**：**首版**——颜色令牌已坐实；**组件精确尺寸/字号阶梯/圆角本轮未抓**（见 known_gaps），标注为参照级，后续抓 `dist/weui.wxss` 补全。不是微信 App 逐像素还原。
> **令牌都是 CSS 变量** `--weui-*`，换皮=改变量（天然利于代码生成的令牌契约·与 antd/TF OMS 同思路）。

---

## 1 设计令牌（✅ 逐字来自源码）

### 1.1 品牌 / 语义色

| 令牌 | 浅色 | 深色 | 说明 |
|---|---|---|---|
| 品牌主色 `--weui-BRAND` | `#07c160` | `#07c160` | 微信绿·主按钮/开关/选中 |
| 链接 `--weui-LINK` | `#576b95` | `#7d90a9` | 链接/可点文字（微信蓝灰） |
| 文字绿 `--weui-TEXTGREEN` | `#06ae56` | `#259c5c` | 绿色文字（成功/金额正向） |
| 危险/警告 `--weui-RED` | `#fa5151` | `#fa5151` | 删除/错误/警示 |
| 橙 `--weui-ORANGE` | `#fa9d3b` | — | 次警示 |
| 黄 `--weui-YELLOW` | `#ffc300` | — | 提醒 |
| 绿 `--weui-GREEN` | `#91d300` | — | |
| 蓝 `--weui-BLUE` | `#10aeff` | — | |
| 靛 `--weui-INDIGO` | `#1485ee` | — | |
| 紫 `--weui-PURPLE` | `#6467f0` | — | |
| 浅绿 `--weui-LIGHTGREEN` | `#95ec69` | — | 气泡/标签 |
| 橙红 `--weui-ORANGERED` | `#ff6146` | — | 强提醒 |

### 1.2 文字前景（FG·分层透明度·微信核心用法）

| 令牌 | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--weui-FG-0` | `rgba(0,0,0,.9)` | `rgba(255,255,255,.8)` | 标题/主文字 |
| `--weui-FG-1` | `rgba(0,0,0,.55)` | `rgba(255,255,255,.5)` | 描述/次文字 |
| `--weui-FG-2` | `rgba(0,0,0,.3)` | `rgba(255,255,255,.3)` | 提示/占位 |
| `--weui-FG-3` | `rgba(0,0,0,.1)` | `rgba(255,255,255,.1)` | 分割线/浅线 |
| `--weui-FG-HALF` | `rgba(0,0,0,.9)` | — | 深色遮罩上文字 |

> 🏛 **微信文字铁律**：文字色**不用纯黑/固定灰**，用**黑透明度分层**（FG-0/1/2/3）——同一套色在浅深主题自动成立。画社交原型时文字必须走这四层，别硬编码 #333/#999。

### 1.3 背景（BG·分层）

| 令牌 | 浅色 | 深色 | 用途 |
|---|---|---|---|
| `--weui-BG-0` | `#ededed` | `#111` | 页面最底（列表页灰底） |
| `--weui-BG-1` | `#f7f7f7` | `#1e1e1e` | 次级背景 |
| `--weui-BG-2` | `#fff` | `#191919` | 卡片/cell 白底 |
| `--weui-BG-3` | `#f7f7f7` | `#202020` | 输入框/按下态 |
| `--weui-BG-4` | `#4c4c4c` | — | 深色气泡/toast |
| `--weui-BG-5` | `#fff` | — | 浮层 |

> 🏛 **微信背景铁律**：社交页典型是**灰底(BG-0 #ededed) + 白色 cell/卡片(BG-2)** 的分组列表结构——不是通栏白。这是微信"设置/我/聊天列表"的标志性版式。

---

## 2 组件范式（WeUI 官方 widget 全集·参照级·尺寸待补）

> ⚠️ 以下为 WeUI 官方组件清单 + 用法要点；**精确尺寸/圆角/字号本轮未逐字抓**（known_gaps），画时先按微信事实基准，后续抓 dist 补精确值。

- **顶部导航 navigationbar**：左返回 + 居中标题 + 右操作；标题 17px 粗。
- **列表 cells / list**（社交端核心）：分组 cell·左标签右值/箭头·白底 BG-2·组间灰底 BG-0·分割线 FG-3·带 `access`(箭头跳转)/`switch`(开关绿 BRAND)/`checkbox`/`radio` 变体。
- **按钮 button**：`primary`(微信绿 BRAND 实底白字) / `default`(浅底) / `warn`(RED) / `mini`(小尺寸)；通栏主按钮是微信标志（登录/提交）。
- **表单 form**：input/textarea/select/switch(绿)/checkbox/radio/uploader(图片上传九宫格)/vcode(验证码)；表单也走 cell 结构。
- **对话框 dialog**：居中·标题+正文+底部横向按钮（取消灰 / 确定绿）；圆角约 12px(待核)。
- **半屏弹窗 half-screen dialog**：底部升起·微信近年主流交互。
- **操作菜单 actionsheet**：底部升起动作列表 + 取消；社交端常用（分享/更多）。
- **弹出提示**：`toast`(成功打勾/失败) / `loading`(转圈) / `msg`(成功页/警告页整屏)。
- **标签栏 tabbar**：底部 3–5 项·图标+文字·选中 BRAND 绿·微信"微信/通讯录/发现/我"式。
- **导航标签 navbar**：顶部横向 tab 切换。
- **宫格 grid**：九宫格入口（发现页式）。
- **搜索栏 searchbar** / **徽标 badge**(红点/数字·社交未读) / **面板 panel** / **媒体列表 media-box**(图文列表·朋友圈/资讯式) / **进度条 progress** / **footer**(版权/加载更多)。

---

## 3 布局 / 交互原则（微信社交惯例）

- **视口**：h5 px 版（本文件）；小程序用 rpx（750rpx=屏宽·待补换算表）。
- **安全区**：iOS 刘海/底部 Home 条 → `env(safe-area-inset-*)`；tabbar 底部留安全区。
- **触控区**：最小可点 ≥ 44px（微信事实基准·源码未显式令牌）。
- **分组列表版式**：灰底 + 白 cell 分组，是社交/设置类页的默认结构。
- **主色克制**：整页大面积白/灰，绿色(BRAND)只用在**主操作/选中/开关**——不铺满。
- **文字分层**：标题 FG-0、说明 FG-1、提示 FG-2，严格走透明度层，主题自适应。

---

## 4 待补完善（下一轮）

1. 抓 `Tencent/weui-wxss/dist/style/weui.wxss` 的 `:root` + 各组件 class → 补**精确尺寸**（cell 高/padding、button 高/圆角、navbar 44px/tabbar 50px 核实、字号阶梯、间距阶梯、圆角令牌）。
2. rpx（小程序）↔ px（h5）换算表。
3. 若要**精确当前微信 App 皮**（非开源设计体系）→ 需用户给截图（[[feedback_mobile_spec_by_category]] 第 2 档）。

> 关联：[[feedback_mobile_spec_by_category]] · [[antd-mobile-ecommerce]] · [[system-design-spec-mobile]]（主移动规范·按品类路由到本文件）
