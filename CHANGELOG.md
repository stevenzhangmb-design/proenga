# CHANGELOG

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
