# CHANGELOG

## 2026-11-13

### 标注与 PRD
- PRD 直接转成原型标注：写好的 PRD 可以一键生成原型上的标注，不用再逐个圈选。
- 标注号跟着元素走：页面滚动、切换页签、窗口缩放后，标注号仍贴在对应的按钮或区域上。
- PRD 标题层级规范化：生成的 Word 能直接用“引用 › 目录”自动生成目录。
- PRD 检查新增两类规则：标准写法检查、一级标题检查，不合规会直接提示。
- 新增 PRD 在线网页版生成工具（`skills/prd/publish-prd-html.js`），可把 PRD 发布成只读网页分享。
- PRD 的 Word 统一使用模板 `skills/prd/prd-reference.docx`（微软雅黑、正文五号）。

### 原型
- 原型顶部工具栏自适应窗口宽度，窄屏不再挤压或换行错位。
- 修复【导出分享版】【一键生成代码】的若干问题。
- 修复自检工具的端口问题。
- 新增改原型提速工具（`p.js`、`scaffold.js`、`mockgen.js`、`pd-patch.js` 等）和更多交付前检查。
- Vue / Element Plus 等资源随包提供（`skills/pm-design/vendor/`），离线生成原型不再需要联网下载。

### 其它
- 新增 `skills/rpa`：登录参考系统抓取页面结构与样式真值，供复刻和提炼规范使用。
- 新增需求清单机制（`skills/_shared/requirement-ledger.md`），每条要求逐条记录、逐条核对。

## v1.0.0 — 2026-06-19

首次正式发布。

### 核心能力
- 原型 HTML 双通道标注（对话框 ① + 右键框选 ②）
- PRD 三步同步铁律（prd-data.json → .md/.docx → window.__PRD_DATA__）
- SSE 自动刷新（anno-server 推送 `prd-updated`，原型 2 秒后自动重载）
- anno-server 四路径自动搜索启动（无需用户手动指定路径）
- 框选卡片识别：`_AREA_TITLE_SEL` / `_CARD_TITLE_SEL` 通配模式，覆盖任意 SaaS 命名
- 表格行框选：自动读取 `<th>` 列头而非单元格数值
- 客户安装零依赖：仅需 Node.js 18+ 和 pandoc

### 包含 Skills
- `pm-design`：UI 原型生成 + 标注层注入
- `prd`：PRD 文档生成与同步
- `tech-design`：技术设计文档（HLD + LLD）
- `test-case`：测试用例生成
- `user-manual`：操作手册生成
- `product-pitch`：售前方案生成

---

> 更新方法：在 `ai-rules/` 目录执行 `git pull`，刷新 AI 工具即生效。
