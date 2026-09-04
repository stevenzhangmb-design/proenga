# 移动版设计规范（Mobile · uni-app + uv-ui）

> **用途**：画**移动版**原型（APP / 小程序 / H5 / PDA）时的默认设计规范。画原型三问弹窗选「移动版」→ 走本规范；选「B 端后台」→ 走 [`system-design-spec.md`](./system-design-spec.md)。
> **来源**：从真实**移动版 WMS（PDA）**源码（`uni.scss` / 页面 `.nvue` / `main.js` / `manifest.json`）提炼（2026-07-07·已匿名）。uni-app/uv-ui/rpx/扫码为移动端通用范式，WMS 仅为业务内容。
> **主色与 B 端一致**（#3363FF），确保同一产品 B 端 + 移动端视觉统一。

---

## 1. 技术栈（默认·移动版）

| 分类 | 选型 |
|---|---|
| 跨端框架 | **uni-app**（一套码发 App / H5 / 各类小程序） |
| 框架 | Vue3（`createSSRApp`） |
| 语言 | **JavaScript**（不用 TS） |
| UI 库 | **uv-ui**（`@/uni_modules/uv-ui-tools`，`uv-*` 组件） |
| HTTP | **uni.$uv.http**（luch-request，`utils/request/` 封装 + 请求/响应拦截器） |
| 样式 | SCSS，**默认单位 rpx**（`uni.$uv.setConfig({config:{unit:'rpx'}})`） |
| i18n | **自研 `lang()`**，4 语 `zh/en/pt/spa`，**默认 pt** |
| IDE / 构建 | HBuilderX → Android APK（或小程序发布） |

---

## 2. 颜色令牌（rpx 版·沿用 B 端色板）

| Token | 值 | 用途 |
|---|---|---|
| 主色 primary | `#3363FF` | 主按钮、确认、激活（uv-modal `confirmColor="#3363FF"`）|
| 取消/次要 | `#999999` | 取消按钮、提示文字（uv-modal `cancelColor="#999999"`）|
| 语义色 | 安全 `#67C23A` · 警告 `#F2AC3A` · 错误 `#F56C6C` | 同 B 端 |
| 页面背景 | `#F2F3F5` | `.page` 背景 |
| 内容块背景 | `#FFFFFF` | 列表/卡片区 |
| 正文文字 | `#333333` | 主要文字 |
| 提示/次要文字 | `#999999` | 说明、计数、占位 |

---

## 3. 尺寸 / 字号 / 间距（rpx·750 设计稿基准）

> **rpx**：750rpx = 屏幕宽度，自动等比缩放。约算：iPhone(375pt) 下 `2rpx ≈ 1px`。

| 项 | 实测值 |
|---|---|
| 正文字号 | `30rpx`（≈15px） |
| 提示/小字 | `24rpx`（≈12px） |
| 行高 | 正文 `36rpx` · 小字 `24rpx` |
| 区块内边距 | `22rpx 32rpx`（上下 22 · 左右 32） |
| 区块间距 | `margin-bottom: 50rpx` |
| 图标/插图 | 常用 `40rpx`（图标）· `400rpx`（空状态插图）|
| action-sheet 圆角 | `round="32"` |

---

## 4. 布局 / 导航

- **页面类型**：`.nvue`（原生渲染·性能好）；用原生组件 `<view>` `<text>` `<image>` `<scroll-view>`，**不用 HTML `div`/`span`**。
- **导航**：`pages.json` 里 `navigationStyle: "custom"`（不用系统导航栏），页面顶部用 **`uv-navbar`**（`bgColor="#ffffff"`、`title="lang('...')"`、左返回箭头 `uv-icon name="arrow-left"`）。
- **页面骨架**：`<view class="page">`（bg #F2F3F5·flex）→ uv-navbar → 内容 `<scroll-view class="page-block">`（bg #fff）。

---

## 5. 常用 uv-ui 组件

| 组件 | 用途 |
|---|---|
| `uv-navbar` | 顶部自定义导航（title / 左返回 / 右信息）|
| `uv-list` / `uv-list-item` | 列表 |
| `uv-icon` | 图标 |
| `uv-modal` | 确认弹窗（`confirmColor="#3363FF"` `cancelColor="#999999"` `confirmText/cancelText=lang()`）|
| `uv-action-sheet` | 底部动作面板（`round="32"` `safeAreaInsetBottom`）|
| `uv-loading-page` | 全屏加载（`loadingMode="spinner"` `bgColor="rgba(255,255,255,0.7)"`）|
| `uv-form` / `uv-picker` / `uv-calendar` / `uv-keyboard` / `uv-qrcode` | 表单/选择/日历/键盘/二维码 |

---

## 6. 移动端核心交互

- **扫码（命脉）**：`<input>` + `@focus/@blur`（`onFocusCode`/`onConfirmCode`）承接扫码枪输入 / 手动输入；配 `manifest.json` `app-plus.modules` 的 **Barcode**（+ Camera / Bluetooth）原生模块。
- **多语言**：所有文案走 `lang('...')`，4 语 zh/en/pt/spa，默认 pt；页面可有 en/esp 变体。
- **安全区**：底部面板 `safeAreaInsetBottom`。

---

## 7. 一致性铁律

- **主色 #3363FF 与 B 端一致**——同一产品 B 端 + 移动端视觉统一。
- **移动版用 uv-ui + rpx，不用 Element Plus / px**（EP 跑不了小程序/App）——这是与 B 端规范的根本区别，两套按形态各走各的。
- **pt/spa 多语言必带**（巴西市场硬需求）。

---

## 8. 待补（后续吸收）

- **APP / 小程序** 的专属设计风格：用户后续提供素材/代码后，按本规范同法吸收、补充差异（如小程序 tabBar、APP 原生手势等）。当前 APP/小程序默认沿用本移动版规范。
