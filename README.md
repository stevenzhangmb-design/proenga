# Proenga

**Turn one conversation into a clickable prototype, a full spec suite, and compilable code.**
AI 产研协同工具 —— 原型 · PRD · 代码，同出一源。

> 别人给你一段对话，**Proenga 给你一个能点的原型 + 全套规格**：
> 描述你想做的系统 → 得到一个**可操作原型（它本身就是规格真理源）** → 一次扇出 PRD / 技术设计 / 测试 / 手册 / 售前 → 再**自己生成前后端可编译骨架代码**。原型或 PRD 一改，下游全部同步重生。
> **这是 Claude / Cursor / Codex 的聊天给不了的。**
>
> 🔧 AI 工具无关 · 🌍 多地区（中/巴/美） · 📐 内置设计规范 · 🛡 40+ 道机器闸把关

---

## 谁用 · 拿到什么

| 角色 | 一句话 | 到手的东西 |
|---|---|---|
| 🧭 **产品经理** | 说清需求，就出规格 | 可操作原型 + PRD 真理源（字段/流程/校验都以原型为准，需求一改自动同步） |
| ⚙️ **研发** | 出骨架代码，直接开工 | 技术设计 + 接口契约 + `schema.sql` + 前后端**可编译**骨架 |
| 🎁 **交付/售前** | 一键出方案 | 操作手册 + 售前方案 + 只读分享版，全从同一个原型长出 |

---

## 由什么组成

| 组成 | 作用 |
|---|---|
| **`skills/pm-design`** | 画可交互 HTML 原型（内置设计规范 / 多语 / 多地区）+ 右键圈选功能标注 |
| **`skills/prd`** | 按 PRD 铁律**真推理**生成规范 PRD（4 章 + 字段规范 + 7 节用例规则） |
| **`skills/dev-codegen`** | 📦 导出对接料（喂任意 AI）／ 🚀 一键生成前后端**可编译**工程代码 |
| **`skills/tech-design · test-case · dev-prompts · product-pitch · user-manual`** | 下游文档：技术设计 / 测试用例 / 研发提示词 / 售前方案 / 用户手册 |
| **`anno-server`** | 本地同步引擎：原型 ↔ PRD ↔ 对话框**实时同步**；自动截图 + mermaid 流程图 + Word（pandoc） |
| **`skills/**/qa`** | 40+ 道机器闸（`deliver-gate` 总闸统管）：交付前跑绿才算完，每条规则焊成断言 |

---

## 核心工作流

```
画原型(四问：UI规范/端/地区币种/语言)
  → 右键圈选功能范围
  → 复制清单给 AI 对话框 → AI 真推理生成 PRD
  → 回填到原型标注 + 本地生成 PRD.md / .docx + 自动截图 + 流程图
  → 原型 ↔ PRD ↔ 对话框 双向同步
  → 导出分享版(给客户) / 导出对接料(喂AI) / 一键生成代码
```

一份 `prd-data` 派生原型、PRD、代码——不漂移。

---

## 🚀 一键生成代码（亮点）

一份数据一键产出 **契约 + 开箱即编译的前后端工程**：

| 前端 ＼ 后端 | Java + Spring | Node + NestJS | Python + FastAPI |
|---|---|---|---|
| **Vue3 + Element Plus** | ✅ | ✅ | ✅ |
| **React + Ant Design** | ✅ | ✅ | ✅ |

**6 组合**，每种「开箱即编译」都由真编译器验证（`mvn compile` / `tsc` / `vue-tsc` / `import`），含 `openapi` 契约 + `schema.sql`（MySQL / PostgreSQL）+ 主子表 + 工程脚手架。

> **诚实边界（L3 天花板）**：生成的是**可编译可跑的骨架**——CRUD / 列表 / 表单 / 详情 / 契约齐全；**复杂业务逻辑那 20%**（校验细节 / 状态流转 / 权限 / 租户隔离 / 计费）原型里没有可执行规则，需研发或 AI 逐功能补。**不吹「一键生成可直接上线的完整系统」。**

---

## 快速开始

### 前置
- **Node.js 18+**（跑 `anno-server` 原型↔PRD 同步）
- **pandoc**（可选：PRD `.md` → Word `.docx`；不装则跳过 docx）

### 1. 安装 skills
```bash
# 全局（所有项目可用）
cp -r skills/* ~/.claude/skills/
# 或项目级
cp -r skills/* .claude/skills/
```

### 2. 启动本地同步服务
```bash
cd anno-server
node start-anno-server.js      # 跨平台后台监督器·崩溃自愈·防双开
# Windows 可双击 start-anno-server.vbs（全隐藏后台）
```

### 3. 在你的 AI 工具里开工
```
画一个 XX 系统的原型            # → pm-design 弹四问 → 出可交互原型
（原型上圈选功能）→ 复制已圈功能 → 粘到对话框 → 生成 PRD
一键生成代码 / 导出对接料        # → dev-codegen 出料/出码
```

---

## AI 工具无关

规则（`skills/`）、机器闸（`qa/`）、验收清单（`skills/_shared/acceptance-checklist.md`）**全部随包**。无论在 Claude Code / Cursor / Codex 里，AI 读规则 + 跑闸自愈即可达到一致效果——**不锁定某一家 AI**。

---

## 多地区本地化（无默认·按需选）

| 地区 | 字段语言 | 日期 | 货币 | 时区 |
|---|---|---|---|---|
| CN | 中文 | `YYYY-MM-DD` | `¥1,234.56` | Asia/Shanghai |
| BR | 葡语（Português） | `DD/MM/YYYY` | `R$ 1.234,56` | America/Sao_Paulo |
| US | 英语 | `MM/DD/YYYY` | `$1,234.56` | America/New_York |
| 其他 | AI 主动询问 | — | — | — |

多语原型（中/英/葡/西）：每条文案写成 `{"zh":…,"en":…,"pt":…}`，业务数据不翻译。

---

## 学习外部设计规范（learned-specs）

`pm-design` 可从**公开设计系统 / 网站**逐字抓取设计令牌，按「一站一文件」存 `skills/pm-design/learned-specs/`（如移动电商→Ant Design Mobile、移动社交→WeUI）。画原型时指定 `用 learned-specs/<名> 画…` 即按该设计语言输出。详见 [learned-specs/README.md](skills/pm-design/learned-specs/README.md)。

---

## 质量保障：机器闸

每条铁律都焊成一道可执行的断言（`skills/**/qa/*.js`），`deliver-gate.js` 一键跑全部。交付前全绿才算完——**用可复现的证据代替口头保证**。涵盖：标注层回归 / 注入回路 / 导出分享版行为 / PRD 结构合规 / 工程命名硬卡 / anno-server 崩溃隔离 / 代码生成多栈护栏 等。

---

## License / 授权

**专有软件（Proprietary）— 版权所有，保留一切权利。**
Copyright (c) 2026 Proenga. All rights reserved.

本仓库**公开可见**，供评估与在遵守许可前提下使用，但**不是开源软件**：

- ✅ 允许：下载、安装，用于你自己的内部工作；为自用而修改
- ❌ 禁止（未经书面许可）：销售 / 再许可 / 出租；以任何形式再分发（含改名或并入其他产品发布）；去除署名

完整条款见 [LICENSE](LICENSE)。如需**商业授权、托管版（Proenga Agent）或合作**，请联系版权持有人。
