---
name: prd
description: PM 用的 PRD 撰写 skill (PRD-only 主流程 / 无原型场景) — 按 _rules/ 宪法层铁律输出结构化 PRD（固定 4 章：开发目的 / 版本变更 / 术语 / 功能需求）。适用于所有产品形态：ERP / WMS / 零售门店 / SaaS 等 B 端系统、APP、小程序、H5 / PC 网站；层级深度以实际原型结构为准（详见 _rules/prd-directory-numbering.mdc §产品形态自适应规则）。支持 2 种 PRD-only 场景：场景 A 文字增量（仅口述改动，无截图）/ 场景 B 截图驱动（拖现有系统截图，不画原型，走 image-recognition 5 段辅助）。用于用户提到"只要 PRD 文档"、"已有 UI 截图但只要 PRD"、"补需求文档"、"PRD-only 增量"、"外部协作/监管申报/评审场景需要 PRD"等场景。如需 AI 画原型 + PRD 三件套 → 走 pm-design Capture Mode 联合主流程。
---

# PRD

> 🏛 **本 skill 100% 遵守 [_rules/](./_rules/) 下的铁律——任何冲突以 [_rules/prd-template-structure.mdc](./_rules/prd-template-structure.mdc) 为准；本 SKILL.md 不复述、不覆盖铁律。**

本 skill 只描述 PRD 的**写作流程、模板选型与输出顺序**。所有铁律（章节、字段规范、用例规则七项、操作日志/提示消息/消息通知、二次确认、动作类规则、图片优先、请参考与完整不合并）以 [_rules/prd-template-structure.mdc](./_rules/prd-template-structure.mdc) 为唯一口径，本文件不再复述。

## 🏛 宪法层（_rules/）

| 文件 | 角色 | 修改注意 |
|---|---|---|
| [_rules/prd-template-structure.mdc](./_rules/prd-template-structure.mdc) | **PRD 写作铁律主文件**（章节 / 字段规范 / 七项用例规则 / 操作日志 / 提示消息 / 消息通知 / 二次确认 / 动作类规则 等） | 修改前确保理解全部下游影响 |
| [_rules/prd-directory-numbering.mdc](./_rules/prd-directory-numbering.mdc) | 第 4 章目录与 `4.4.*` 编号约定（单/多系统视图） | 与主文件 §1.3 联动 |
| [_rules/prd-post-generation-deepcheck.mdc](./_rules/prd-post-generation-deepcheck.mdc) | **生成后强制深检铁律**（全量通读规则原文 + 逐功能点全量深检细到标点 + 机器闸 `qa/prd-structure-lint.js` 必绿 + 不擅自主张）；适用 AI 画新原型 + 打包后所有用户 | 任何 PRD 生成/更新后必走，缺一不可 |

**与 references/ 的层次关系**：
- `_rules/` = **宪法层**（不可违反，AI 写 PRD 全程对齐）
- `SKILL.md` = **入口路由**（不复述铁律，只引用）
- `references/` 与本目录其他文件 = **工具与示例**（按需加载，遵守宪法）

## ⚠️ 四条顶级红色铁律（PRD 必过）

- **R-A 图片识别 5 段绝不进 PRD 文件**：`图片绑定表 / 图片识别结果 / 图片归档清单 / 待确认项 / 合理化建议` 仅作对话辅助输出，**严禁**写入 PRD `.md` 文件；PRD 引用图片只用 `IMG-xx` 编号。
- **R-B PRD 固定 4 章**：仅 1 开发目的 / 2 版本变更 / 3 术语 / 4 功能需求；功能点直挂第 4 章对应末级菜单下（`##### 4.4.x.y` → `###### 4.4.x.y.z`），严禁另起 `## 5`。
- **R-C 字段规范仅收录数据字段**：按钮 / 操作链接 / 底部操作区 / 关闭图标等非数据元素一律不进字段表，由 `用例规则-操作流程` 承载。
- **R-D PRD 须用户触发，AI 不得自行凭空撰写**：有原型→用户**点选/框选**圈定范围 + 对话框说"为 XX 生成 PRD"，AI 才真推理生成（anno-inject）；无原型→用户明确场景 A/B 并给输入后才生成。未经圈选/对话框触发即产出的 PRD 性质内容一律违规删除。竞品分析/方案等非 PRD 文档不受限，但不得以"方案"之名输出"字段规范+七项用例规则"行 PRD 之实。

详细判定标准与禁止形式见 [prd-template-structure.mdc](./_rules/prd-template-structure.mdc) 文件开头「顶级红色铁律」段。

## 适用场景（PRD-only 主流程 / 无原型）

- "只要 PRD 文档，不需要原型"
- "把这个需求整理成 PRD 文档"
- "补齐验收标准/范围边界"
- "已有 UI 截图，只要 PRD"（外部协作 / 监管申报 / 评审）
- "在现有 X 模块加 Y 功能写 PRD"（**场景 A 文字增量**）
- "拖现有系统截图写 PRD"（**场景 B 截图驱动**）

⚠️ **如果你要 AI 画原型 + PRD 三件套** → 请走 [pm-design Capture Mode 联合主流程](../pm-design/prototype-prd-prompt-template.md)

## ⚠️ 2 种 PRD-only 场景（v1.0 / 都不画原型）

### 场景 A：文字增量改造（无原型，无截图）

- **输入**：现有模块菜单路径 + 改动文字描述 + （可选）旧 PRD 文件路径
- **AI 处理**：文字复述对改动的理解 → 用户确认 → 仅描述增量功能点，旧功能点用 `详见旧 PRD §x.y.z` 引用
- **输出**：**增量 PRD**（仅 §4 修改/新增部分，章节顺序保持，标"v1.X 增量"）+ 增量 `prd-data.json`
- **图片识别 5 段**：**跳过**（无截图）

### 场景 B：截图驱动（有现有系统截图，不画原型）

- **输入**：用户拖现有系统截图清单（直接填基础信息 + 业务背景）
- **AI 处理**：走 [references/standards/image-recognition.md](./references/standards/image-recognition.md) **5 段对话辅助流程** → 用户确认 → 生成完整 PRD
- **输出**：完整 PRD 4 章 + `prd-data.json`
- **5 段对话辅助**：图片绑定表 / 图片识别结果 / 图片归档清单 / 待确认项 / 合理化建议（仅对话输出，**严禁**写入 PRD 文件，铁律 R-A）

## 🤖 场景自动识别（AI 行为）

```
1. 用户输入引用 .html 原型路径，或说"画原型/帮我做一个"？
   YES → 改走 pm-design Capture Mode 联合主流程（不属于本 skill）
   NO  → 进 2

2. 用户输入是否描述"在 X 模块加 Y 功能" + 无截图？
   YES → 场景 A（文字增量）

3. 用户输入是否拖了现有系统截图 + 要 PRD 文档？
   YES → 场景 B（截图驱动 / 走 image-recognition 5 段辅助）

4. 不清晰 → 询问："您要走 ① 文字增量（无截图）② 截图驱动（有现有系统截图）？
              或者您需要 AI 帮您画原型 + PRD 三件套（改用 pm-design Capture Mode）？"
```

## 执行流程

1. 识别 Mode（见上）
2. 明确业务背景、目标用户、核心问题（**场景 A 时仅问最少必要**）
3. 收集约束条件（资源、合规）
4. 用 [references/templates/prd-template-clean.md](./references/templates/prd-template-clean.md) 作模板生成 PRD 初稿
5. 按 [_rules/prd-template-structure.mdc](./_rules/prd-template-structure.mdc) 校对字段规范、用例规则七项与操作日志等铁律
6. 用 [references/quality-checklist.md](./references/quality-checklist.md) 做成文自检
7. **⚠️ 生成后强制深检门（铁律，缺一不可）**：按 [_rules/prd-post-generation-deepcheck.mdc](./_rules/prd-post-generation-deepcheck.mdc) 执行四步——⑴ 全量通读规则原文（不靠记忆/摘要）⑵ 逐功能点对照每条规则全量深检细到标点（严禁抽检）⑶ 运行 `node qa/prd-structure-lint.js <PRD.md>` 退出码必 0 ⑷ 判断类逐条人工核、不擅自主张（有疑义问用户）。**未全绿不得告知用户"已完成"。**
8. 通过后输出
9. **⚠️ 双向同步（强制）**：每次更新 PRD 内容后，必须按 `CLAUDE.md §PRD双向同步铁律` 同步执行：
   - 更新 `prd-data.json` 对应功能点条目
   - 回写原型 HTML 的 `window.__PRD_DATA__`
   - 输出三步确认提示给用户

## 缺失信息处理

关键信息不足时，先提最少必要问题再写正文。优先询问：

1. 目标用户是谁？
2. 要解决的核心问题是什么？
3. 成功指标如何衡量？
4. 本期范围与不做项是什么？
5. 系统视图是否分端、菜单结构、各菜单下功能点清单（按 `菜单路径：功能点1、功能点2` 格式给出）？

## 输出要求

- 默认输出结构化 Markdown。
- 每条需求项必须含：用户故事、业务规则、验收标准。
- 明确区分"本期范围"与"非目标"。
- 系统视图、菜单名、功能点名一律取用户当次输入的真实命名，不套用示例。
- 文档语言要求清晰、易懂、可直接执行；优先短句；术语首次出现需就地解释。

## 提示词模板

仅保留一份通用模板：[references/templates/prompt-template-common.md](./references/templates/prompt-template-common.md)。

- 日常起稿、迭代、内部评审：直接复制使用。
- 对外交付 / 跨团队评审 / 首次发版 / 签字归档：使用同一份 prompt 输出后，**额外**逐条对照 [references/quality-checklist.md](./references/quality-checklist.md) 做自检。
- 功能点写作示例参考：[references/templates/prd-template-clean.md](./references/templates/prd-template-clean.md) 中的填空示意。

### 配套示例

- `references/examples/` 下 PRD-only 示例（v1.0 后旧示例已迁移，本目录暂未提供新示例；如需 PRD-only 完整样本，请告知 AI 生成）
- 如需"原型+PRD 联合"示例 → [pm-design/examples/mode3-retail-product-management.md](../pm-design/examples/mode3-retail-product-management.md)

## 输出顺序

按场景不同走不同流程：

| 场景 | 输出内容 |
|---|---|
| **场景 A**（文字增量 / 无截图）| 文字复述确认 → 增量 PRD（仅 §4 修改/新增，旧的用 `详见旧 PRD §x.y.z` 引用）+ 增量 `prd-data.json` |
| **场景 B**（截图驱动 / 有现有截图）| 5 段对话辅助（图片绑定表 / 识别结果 / 归档清单 / 待确认 / 合理化建议）→ 完整 PRD 4 章 + `prd-data.json`。**前 5 段对话辅助严禁写入 PRD 文件**（R-A 铁律）|

🆕 **关于 `prd-data.json`**（v1.0 新增）：
- 与 PRD `.md` 同步生成，结构遵守 [pm-design/prd-data-schema.md](../pm-design/prd-data-schema.md)
- 含：menus（菜单树）+ function_points（每个功能点的字段规范 + 用例规则 7 项）+ annotations（原型 DOM 定位）
- 由 pm-design 的原型 HTML 嵌入 `window.__PRD_DATA__`，作为标注层数据源
- 实现 PRD 与原型**单一真理源**：改一处全局同步

## 配套文档

- [references/templates/prd-template-clean.md](./references/templates/prd-template-clean.md) — 正文模板
- [references/quality-checklist.md](./references/quality-checklist.md) — 成文自检
- [references/templates/prompt-template-common.md](./references/templates/prompt-template-common.md) — ⭐ **用户主用模板：PRD-only 主流程（2 场景共用）**
- [references/standards/confirmation-dialog.md](./references/standards/confirmation-dialog.md) — 二次确认文案统一口径
- [references/standards/image-recognition.md](./references/standards/image-recognition.md) — 截图识别 / 多图绑定 / 输出顺序

## 与 pm-design skill 的衔接

- **上游**：[pm-design skill](../pm-design/SKILL.md) 生成 `.html` 原型（含标注层）
- **本 skill**：把原型 HTML 当作字段提取来源（替代传统截图）→ 生成 PRD `.md` + `prd-data.json`
- **数据流**：
  ```
  用户写 1 份 prompt
    ↓
  pm-design 出原型 HTML（默认带标注层，预留 data-annotation 属性）
    ↓
  用户确认
    ↓
  prd skill 出 PRD .md + 同步生成 prd-data.json
    ↓
  pm-design 把 prd-data.json 内联回原型 HTML 的 window.__PRD_DATA__
    ↓
  用户打开 .html → 标注层可用（点 ℹ️ 查看字段规范 / 用例规则）
  ```

- **双向同步**（v1.0 MVP 阶段是只读，v1.x 加编辑能力）：
  - PRD `.md` 与 `prd-data.json` 与原型 HTML 三者**单一数据源**
  - MVP：用户改 `.md` → 让 AI 同步刷新 `prd-data.json` 和原型 HTML
  - v1.x：用户在原型抽屉里编辑字段 → 浏览器导出新 `.md` + `.json`
