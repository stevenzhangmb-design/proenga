# Learned Specs 索引

本目录存储 **Mode 0 学到的外部设计规范**，按"一站一文件"组织。

由 pm-design skill 的 Mode 0 自动写入；用户后续画原型时可指定用哪份规范。

---

## 文件命名约定

`<slug>.md` — slug 为来源标识符（**kebab-case，全小写**）

| 来源类型 | slug 取法 | 示例 |
|---|---|---|
| 公开网站 | 主域名去掉 TLD | `linear-app` / `stripe` / `notion` |
| 公开设计系统 | 设计系统名 | `polaris` / `material-3` / `ant-design` |
| 国内 App | 产品拼音/英文名 | `feishu` / `dingtalk` / `xiaohongshu` |
| 私有系统 | 自定义可读名 | `our-erp` / `internal-crm` / `team-portal` |

slug 全局唯一；同一来源更新时**覆盖原文件**（保留 frontmatter 中 `learned_at` 历史，加 `updated_at`）。

---

## 已学规范清单

> Mode 0 完成学习时，AI 会自动在下表插入新行。

| Slug | 来源 | 类型 | 学习方式 | 学习时间 | 置信度 | 覆盖度 |
|---|---|---|---|---|---|---|
| `wms-oms-sample` | 某 B 端 WMS+OMS 系统（私有样本，已匿名） | 私有系统 | Playwright 自动截图 | 2026-06-09 | 4 | 登录页/首页/列表/表单；未覆盖详情/弹窗 |
| `antd-mobile-ecommerce` | Ant Design Mobile v5（阿里官方开源·**电商移动端默认参照**） | 公开设计系统 | WebFetch 逐字抓 .less 源码 | 2026-08-04 | 4 | 全令牌(浅/深色)+18 组件范式；无价格色/商品卡/spacing/shadow 官方令牌(见 gaps) |
| `weui-social` | 腾讯 WeUI（微信官方开源·**社交移动端默认参照**） | 公开设计系统 | WebFetch 逐字抓 less 令牌源码 | 2026-09-01 | 3 | ✅令牌(浅/深色·品牌绿#07c160/FG-BG分层)+组件全清单+社交版式；⚠首版·组件精确尺寸/字号/圆角待补(见 gaps) |

---

## 单文件标准格式

每份 learned-spec 文件**必须**以下面这段 frontmatter 开头：

```yaml
---
slug: linear-app
source: https://linear.app
type: 公开网站                   # 公开网站 / 公开设计系统 / 国内App / 私有系统
method: WebFetch + 截图分析       # 抓取方式（决定置信度）
learned_at: 2026-06-04           # 首次学习日期
updated_at: 2026-06-04           # 最后更新日期（无更新与 learned_at 相同）
confidence: 4                    # 1-5；5 = 完整公开设计系统，1 = 仅 1 张截图
covered_pages:                   # 学到的页面/模块清单
  - home
  - command-palette
  - issue-list
  - issue-detail
known_gaps:                      # AI 必须如实列出"没抓全的部分"
  - 暗色模式未抓全（仅识别了亮色）
  - 命令面板交互动效未抓
  - 任务卡片悬停态未抓
ui_framework: 自研                # Element Plus / Material / Ant Design / Tailwind UI / 自研 / 未识别
license_note: 仅供学习参考，画原型时勿照搬商标 / 配图
---

# Linear App 设计规范（学习快照）

## 1 颜色 token
...

## 2 字体
...

## 3 间距 / 圆角 / 阴影
...

## 4 组件识别
...

## 5 限制 / 抓不全的部分（已在 frontmatter known_gaps 列出）
...
```

---

## 后续如何使用学到的规范

### 画原型时指定 spec

在 Mode 1 / Mode 2.2 的 prompt 里加一句：

```
用 learned-specs/linear-app.md 画一个任务列表
用 learned-specs/our-erp.md 风格画一个客户管理页
```

不指定则默认用团队规范 [../system-design-spec.md](../system-design-spec.md)。

### 多 spec 混合（可选）

```
主框架用 our-erp.md（公司风格），但卡片样式参考 linear-app.md
```

AI 会以第一份为主，第二份为视觉细节灵感。

---

## 规范不污染原则

⚠️ **Mode 0 学到的内容只写入本目录**，**禁止**写入 [../system-design-spec.md](../system-design-spec.md)（团队规范的演进必须由人工决策，不可被外部 spec 静默污染）。

如发现 learned-spec 中有想纳入团队规范的优秀设计，需用户**显式说**：
> "把 learned-specs/linear-app.md 里的 X 加入团队规范"

AI 才会动 system-design-spec.md。

---

## 法律 / 道德边界

- learned-specs 仅作**设计语言参考**，不复制商标 / 配图 / 文案
- 商业产品的设计专利 / Trade Dress 不可直接照搬
- 私有系统的 spec 仅在你**有权访问**的前提下学习
- 公司内部规范请勿上传 / 公开分享
