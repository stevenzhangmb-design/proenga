# PRD-Data 数据契约（v1.0）

> 用途：原型 HTML 的标注层与 PRD `.md` 文档共享同一份**结构化数据**——`prd-data.json`。本文件定义该 JSON 的 schema、字段语义与生成约定。
>
> 引用方：
> - `prototype-template.md` — 原型 HTML 嵌入 `window.__PRD_DATA__`，标注 Drawer 从中读取字段规范与用例规则
> - `prd skill` — 写完 PRD `.md` 时同步输出 `prd-data.json`
> - 未来 Capture Mode（原型 ↔ PRD 同步）— 改 JSON 即同步原型与 PRD

---

## 1. 顶层结构

```json
{
  "version": "1.0",
  "schema_version": "prd-data-schema.md@v1.0",
  "generated_at": "2026-06-05T20:00:00+08:00",
  "deployment_locale": "BR",
  "prd_meta": {
    "title": "零售连锁系统-商品管理",
    "system_view": "零售连锁系统",
    "prd_version": "v1.0",
    "source_prd_md": "./archive/PRD-零售连锁系统-商品管理-2026-06-05.md"
  },
  "systems": null,
  "menus": {
    "<menu-key>": { ... }
  },
  "function_points": {
    "<fp-key>": { ... }
  },
  "annotations": [
    { ... }
  ]
}
```

### 1.1 字段说明

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `version` | string | ✅ | `prd-data.json` 自身版本号，遵循 SemVer |
| `schema_version` | string | ✅ | 本 schema 文档版本，便于未来兼容性管理 |
| `generated_at` | ISO 8601 | ✅ | 生成时间戳，含时区 |
| `deployment_locale` | enum | ✅ | `CN` / `BR` / `US` / `JP` / `DE` 等 — 决定原型与 PRD 的本地化输出 |
| `prd_meta` | object | ✅ | PRD 元信息（标题 / 系统视图 / 版本 / 源 .md 路径）|
| `systems` | array\|null | ❌ | 跨系统原型时填写（见 §5），单系统填 `null` 即可 |
| `menus` | object | ✅ | 菜单结构树（系统视图 → 一级菜单 → 末级菜单）|
| `function_points` | object | ✅ | 所有功能点的字段规范 + 用例规则（按 `<menu-key>.<fp-name>` 索引）|
| `annotations` | array | ✅ | 原型上的标注定位信息（哪个 DOM 元素挂哪个功能点）|

---

## 2. `menus` — 菜单结构

```json
"menus": {
  "商品管理": {
    "system": "OMS",
    "system_view": "零售连锁系统",
    "level_1": "商品",
    "level_2": "商品管理",
    "children": {
      "商品库": {
        "menu_key": "商品管理.商品库",
        "menu_path": "零售连锁系统-商品-商品管理-商品库",
        "functions": ["新增-无规格", "新增-保质期", "编辑", "删除", "..."],
        "prd_section": "§4.4.1.1"
      },
      "门店商品": { ... }
    }
  }
}
```

| 字段 | 说明 |
|---|---|
| `system` | 跨系统原型时填写（如 `"OMS"` / `"WMS"`），单系统时可省略 |
| `menu_key` | 唯一标识，按"一级.末级"格式（如 `商品管理.商品库`），用于 `function_points` 索引 |
| `menu_path` | 完整菜单路径（用户原始命名）|
| `functions` | 该末级菜单下的功能点名清单（顺序与原型一致） |
| `prd_section` | 对应 PRD `.md` 中的章节号（用于跳转）|

---

## 3. `function_points` — 功能点详情（核心）

每个功能点用 `<menu-key>.<fp-name>` 索引，含**字段规范 + 用例规则 7 项**：

> **§4.4 归属字段（2026-06-23 新增，供 anno-server 按 [`skills/prd/_rules/prd-directory-numbering.mdc`](../prd/_rules/prd-directory-numbering.mdc) 装配 §4.4 编号树）**：
> - `system`：所属系统视图（OMS/WMS/APP…）→ 对应 `4.4.X`
> - `menu_path`：归属菜单**数组**（变长，如 `["财务","财务管理","充值管理"]`）→ 每级顺延一个编号段，末级为末级菜单，功能点(`fp_name`)挂其下
> - `page_key`：圈选所在页面键（`系统-页面`，如 `OMS-recharge-list`）
> - `img`：原型图编号（`IMG-xx` 或 `无`）→ 对应功能点 `.2 原型图`
>
> **顶层另有 `page_menus`**：`{ "页面key": "一级 / 二级 / 三级菜单" }` —— 标注层「归属目录」列据此显示，anno-server 注入时若 pin 无 `menuPath` 则据此回退派生 `menu_path`。宿主原型须在 `window.__PRD_DATA__.page_menus` 配齐**所有可圈选页面**，否则该页归属会退化为页面原名（不准）。

```json
"function_points": {
  "商品管理.商品库.新增-无规格": {
    "menu_key": "商品管理.商品库",
    "fp_name": "新增-无规格",
    "fp_type": "新增",
    "prd_section": "§4.4.1.1.1",
    "system": "OMS",
    "menu_path": ["商品管理", "商品库"],
    "page_key": "OMS-goods-list",
    "img": "IMG-01",
    "field_specs": {
      "groups": [
        {
          "group_name": "基本信息",
          "fields": [
            {
              "name": "商品名称",
              "type": "文本",
              "required": "是",
              "default": "空",
              "constraint": "1~60 字符；同一商品库内唯一"
            },
            { ... }
          ]
        },
        { "group_name": "价格规格信息", "fields": [...] },
        { "group_name": "商品属性", "fields": [...] },
        { "group_name": "税务信息", "fields": [...] }
      ]
    },
    "use_cases": {
      "preconditions": [
        "用户已登录零售连锁系统",
        "具备「商品-商品管理-商品库-新增-无规格」权限"
      ],
      "operation_flow": [
        "用户在商品库列表，点击「新增」按钮，系统弹出新增弹窗。",
        "用户填写表单字段，点击「保存」按钮。",
        "系统弹出二次确认提示框：确认提交该商品？",
        "用户点击「确认」，系统校验通过后保存商品，关闭弹窗，列表自动刷新，新商品出现在列表顶部并提示"商品新增成功"。",
        "用户点击「取消」，系统关闭弹窗，不执行任何操作。"
      ],
      "postconditions": [
        "生成一条商品数据；可在商品库列表查询到。"
      ],
      "validations": [
        "字段级校验见提示消息表；本功能点无跨字段、状态、权限、业务逻辑或异常类校验。"
      ],
      "prompt_messages": [
        {
          "field": "商品名称",
          "empty_prompt": "请输入商品名称",
          "error_prompt": "长度 1~60 字符；同一商品库内唯一"
        }
      ],
      "message_notifications": "无。",
      "operation_log": {
        "fixed_intro": "用户操作成功后，系统在操作日志模块记录：操作时间、操作账号、操作模块、操作功能、操作明细、IP地址。",
        "detail_format": "<动作><对象类型>：<对象唯一标识>=<值>",
        "detail_example": "新增商品：编号=SPU0000001234，名称=可口可乐 330ml"
      }
    }
  }
}
```

### 3.1 `fp_type` 取值（9 大标准功能 + 业务下发类 + 自定义）

| fp_type | 用例规则特征 | 内置模板 |
|---|---|---|
| `查询` | 列表筛选 + 分页 + 表头字段 | ✅ |
| `查看` | 详情页 3 步固定文案（§3.3.1.1） | ✅ |
| `新增` | 4 类必出字段表 + 二次确认 + 双路径 | ✅ |
| `编辑` | 同新增 + 商品编号置灰 + 旧值→新值操作日志 | ✅ |
| `删除` | 二次确认 + 软删除 + 后置"列表移除" | ✅ |
| `启用` | 二次确认 + 状态机校验 + 单条/多条文案 | ✅ |
| `停用` | 同启用 | ✅ |
| `导入` | 异步任务 + 模板下载 + 错误清单返回 | ✅ |
| `导出` | 按筛选条件导出 + 字段表 | ✅ |
| **业务下发类**：`上架`/`下架`/`改价格`/`发布到门店`/`复制`/`打印` | 必含双消息（§4.6.4） | ✅ |
| `自定义` | 用户定义（如"调拨"）| 需用户填 |

详见 `annotation-templates.md`。

---

## 4. `annotations` — 原型 DOM 标注定位

```json
"annotations": [
  {
    "annotation_id": "anno-001",
    "fp_key": "商品管理.商品库.新增-无规格",
    "target_selector": "[data-annotation='商品管理.商品库.新增-无规格']",
    "anchor_position": "top-right",
    "icon_style": "info-filled"
  },
  {
    "annotation_id": "anno-002",
    "fp_key": "商品管理.商品库.查询",
    "target_selector": "[data-annotation='商品管理.商品库.查询']",
    "anchor_position": "top-left"
  }
]
```

| 字段 | 说明 |
|---|---|
| `annotation_id` | 唯一 ID，便于追踪 |
| `fp_key` | 指向 `function_points` 的索引 |
| `target_selector` | CSS 选择器，定位原型中的目标 DOM（推荐用 `data-annotation` 属性约定） |
| `anchor_position` | `top-right` / `top-left` / `inline` —— ℹ️ 图标的相对位置 |
| `icon_style` | 图标视觉风格（默认 `info-filled`） |

**约定**：原型 HTML 中需要标注的功能点元素，必须加 `data-annotation="<fp_key>"` 属性，标注层 JS 通过此属性挂载 ℹ️ 图标。

> 🏛 **错配根治前置纪律（商业级强制 / 外部用户会投诉）**：`data-annotation` 是"框/点标注绝不错配功能点"的**结构性前提**——标注层只认精确绑定、**绝不按名字模糊猜功能点**（见 annotation-templates 北极星「错配彻底根治」）。因此：
> 1. **每个 `function_points` 里的功能点**，在原型里**必须有**对应 `data-annotation="<fp_key>"` 的元素（包括首页/仪表盘上的展示卡，如 `账户余额-OMS.首页右侧顶部`，与同名列表页 `账户余额-OMS.查询` 各自独立绑定）。
> 2. **生成原型后必自检覆盖率**：遍历 `function_points` 的每个 key，确认原型 HTML 里能搜到 `[data-annotation='<key>']`；**漏打的逐个列出补上**，不允许遗漏。
> 3. 漏打的后果：该元素退回"如实描述真实内容/待 AI 生成"（不会错配，但不如精确绑定直达）——所以**必须打满**，才能让草稿当场就精确。

---

## 5. 双向同步约定

### 5.1 PRD `.md` 是源 / `prd-data.json` 是派生
- prd skill 写 PRD `.md` 时**同步**生成 `prd-data.json`
- PRD `.md` 与 `prd-data.json` 一一对应（同 PRD 版本号）

### 5.2 原型 HTML 嵌入 `prd-data.json`
- 生成原型时 pm-design 把 `prd-data.json` 内联到 HTML 顶部 `<script>window.__PRD_DATA__ = {...}</script>`
- 标注 Drawer 通过 `window.__PRD_DATA__.function_points[fp_key]` 读字段规范与用例规则

### 5.2.1 原型图自动截图（PRD `.2 原型图` 用真实图，不用裸 IMG-xx）
- 原型支持 URL 参数深链（`?sys=&page=&open=&anno=`，见 [prototype-template.md §16](./prototype-template.md)）→ 用 [make-screenshots.ps1](./make-screenshots.ps1) 无头批量截图 → PRD 的 `<功能点>.2 原型图` 嵌入 `![IMG-xx](screenshots/img-xx.png)`
- AI 必须用 Read 工具逐张核验截图渲染正确再嵌入；无头截图必须带 `--user-data-dir`（否则静默不出图）

### 5.3 浏览器内编辑 → 导出新 PRD（v1.x 完整版功能，MVP 不做）
- 用户在 Drawer 里改字段 → 实时更新 `window.__PRD_DATA__`
- 点"导出新 PRD" → JS 用 `window.__PRD_DATA__` 重新生成 `.md` + 下载

### 5.4 MVP 阶段范围
- ✅ 标注层 UI（ℹ️ 图标 + Drawer + 总开关）
- ✅ prd-data.json 嵌入原型
- ✅ Drawer 内**只读**展示字段规范 + 用例规则
- ❌ 编辑能力（v1.x 加）
- ❌ 导出新 PRD 按钮（v1.x 加）
- ❌ Capture Mode 反向同步（v1.x 加）

---

## 5.5 跨系统原型（方案 A：单文件 + 系统切换 Tab）

当一个业务流程横跨多个系统（如 OMS 创建 → WMS 审核），使用**方案 A**：单 HTML 文件 + 顶部系统切换栏。

### 5.5.1 `prd-data.json` 跨系统写法

```json
{
  "systems": ["OMS", "WMS"],
  "menus": {
    "调拨管理-OMS": {
      "system": "OMS",
      "system_view": "OMS-订单管理系统",
      "level_1": "调拨",
      "level_2": "调拨管理",
      "children": {
        "调拨单": {
          "menu_key": "调拨管理-OMS.调拨单",
          "functions": ["新增", "提交审核", "查询"],
          "prd_section": "§4.1"
        }
      }
    },
    "调拨审核-WMS": {
      "system": "WMS",
      "system_view": "WMS-仓储管理系统",
      "level_1": "调拨",
      "level_2": "调拨审核",
      "children": {
        "待审核列表": {
          "menu_key": "调拨审核-WMS.待审核列表",
          "functions": ["审核通过", "审核驳回", "查询"],
          "prd_section": "§4.2"
        }
      }
    }
  }
}
```

### 5.5.2 跨系统流转标注规则

- 跨系统触发点必须加标注层，说明"→ 流转至 [目标系统] [目标菜单]"
- 示例标注文本：`提交后 → WMS 待审核列表（状态：待审核）`
- 流转箭头用原型内文字 + 颜色标注，不要图形连线（单 HTML 无法跨页面画线）

### 5.5.3 系统切换 UI 规范

详见 [prototype-template.md §14](./prototype-template.md) — 系统切换器骨架代码。

---

## 6. 校验规则

生成 `prd-data.json` 时 AI 必须满足：

1. **JSON 合法**：所有字符串转义、数字非 NaN
2. **menu_key 唯一**：`<level_2>.<menu_name>` 全局唯一
3. **fp_key 唯一**：`<menu_key>.<fp_name>` 全局唯一
4. **annotation_id 唯一**：递增 `anno-001`、`anno-002`
5. **fp_key 引用闭合**：`annotations[].fp_key` 必须存在于 `function_points`
6. **target_selector 可解析**：必须是合法 CSS selector
7. **本地化对齐**：`deployment_locale` 与字段约束、默认值、日期格式一致
8. **铁律对齐**：用例规则 7 项的内容必须符合 `_rules/prd-template-structure.mdc` §4 规范

---

## 8. 标注层 UI 渲染规范要求（v1.0 强制）

> ⚠️ **本章为强制规范**，AI 生成原型时**必须严格遵守**。任何偏差都视为违规，必须删除后重做。

### 8.1 弹窗形态规范

| 维度 | 规范要求 |
|---|---|
| **组件** | ✅ 必须用 `<el-dialog>` <br> ❌ 禁用 `<el-drawer>` 侧边抽屉（用户已明确反对） |
| **模态性** | ✅ 必须 `:modal="false"`（非模态） <br> 理由：用户需要**边看原型边查标注**，模态遮罩阻塞操作 |
| **可拖拽** | ✅ 必须 `draggable`，支持拖标题栏移动 |
| **关闭方式** | ✅ **双击标题栏关闭**（必须实现 `bindHeaderDblclick` 函数）<br> ✅ 按 ESC 关闭（`:close-on-press-escape="true"`）<br> ✅ 点关闭图标 ❌ 关闭 |
| **尺寸** | ✅ `width="720px"`, `top="5vh"`（标准尺寸） |
| **样式** | ✅ 必须有阴影 `box-shadow: 0 12px 32px rgba(0,0,0,0.18)` <br> ✅ 标题栏 `cursor: move` 提示可拖拽 |
| **内容滚动** | ✅ `max-height: 70vh; overflow-y: auto`（防内容超长撑爆屏幕）|

### 8.2 弹窗 Tab 数量与可见性规则

| 规范要求 | 状态 |
|---|---|
| **最多 2 个 Tab** | ✅ 字段规范 / 用例规则 |
| 禁用第 3 个 "原型位置" Tab | ❌ 不展示（用户已明确去掉）|
| **字段规范 Tab 可见性条件** | 字段规范 Tab **始终显示**；有字段规范 → 渲染字段表（对象含 `groups` 数组）；无字段规范（空 / 字符串「无」/「无（删除无字段表）」等）→ Tab 内显示 **「无」**（与 PRD 文档"字段规范：无"一字一致，**不隐藏 Tab、不省略**）|
| 用例规则 Tab 可见性条件 | 永远显示（所有功能点都有用例规则）|
| 默认 active Tab 智能判定 | 打开标注弹窗时，AI 必须按以下规则判定：① 有字段规范 → 默认 active `fields` ② 无字段规范 → 默认 active `usecases` |

**代码实现要求**（必须严格遵守）：

```html
<el-tab-pane label="字段规范" name="fields"
             v-if="currentFp.field_specs && typeof currentFp.field_specs !== 'string'">
  <!-- 字段规范内容 -->
</el-tab-pane>
```

```js
const openAnnotationDrawer = (fpKey) => {
  currentFpKey.value = fpKey;
  const fp = window.__PRD_DATA__?.function_points?.[fpKey];
  const hasFieldSpecs = fp && fp.field_specs && typeof fp.field_specs !== 'string';
  annoActiveTab.value = hasFieldSpecs ? 'fields' : 'usecases';
  annotationDrawerVisible.value = true;
};
```

**禁止做法**：
- ❌ 显示"字段规范" Tab 但内部用 `<el-empty>` 占位（垃圾交互，用户已明确反对）
- ❌ 显示"字段规范" Tab 内容为 "无（XX无字段表）" 字符串提示

**正确做法**：
- ✅ 完全不渲染该 Tab，弹窗只有"用例规则"一个 Tab

### 8.3 用例规则 7 项渲染规范（严格按 PRD 铁律）

**条款 1：前置 / 流程 / 后置 / 校验 必须用 `1、2、3、` 中文全角顿号编号**

```html
<div v-for="(p, i) in arr" :key="i" class="anno-step">
  <span class="anno-step-num">{{ i + 1 }}、</span>{{ p }}
</div>
```

CSS：
```css
.anno-step-num {
  color: var(--primary);  /* 蓝色突出 */
  font-weight: 600;
  margin-right: 4px;
  display: inline-block;
  min-width: 1.6em;
}
```

❌ **严禁用** `<ol><li>` 浏览器默认编号（半角点 `1.`，与 PRD 风格不符）

**条款 2：操作日志严格按 PRD 铁律 §4.7.1 — 固定说明语 + 6 行字段表（行序锁定）**

| 行 | 字段 | 字段说明 | 规则/示例 |
|---|---|---|---|
| 1 | 操作时间 | 本次操作发生的时间 | 按部署地区展示（BR `DD/MM/YYYY HH:mm:ss`、CN `YYYY-MM-DD HH:mm:ss`…）。**对外文档/标注只显示该展示格式，不在表内标注"底层存储 ISO"**——底层仍按 ISO 存储，属内部实现，不对外暴露 |
| 2 | 操作账号 | 执行操作的登录账号 | 当前登录账号 |
| 3 | 操作模块 | 操作所属的完整菜单路径 | `<menu_path>`（从 menus 查 menu_key）|
| 4 | 操作功能 | 本次操作的具体功能点 | `<fp_name>` |
| 5 | 操作明细 | 本次操作的详细信息 | 格式 + 示例（来自 prd-data.json）|
| 6 | IP地址 | 操作用户的客户端 IP | 用户 IP，如 192.168.1.1 |

**约束**：
- ❌ 严禁简化为"操作明细格式 + 示例"两段（不符合 §4.7.1 三列六行规范）
- ❌ 严禁改变行序
- ❌ 严禁增删字段（必须严格 6 行）
- ✅ 表头固定为 `| 字段 | 字段说明 | 规则/示例 |`
- ✅ 查询/查看 等不输出操作日志的功能点，显示 `查询/查看不输出操作日志。` 字符串

**条款 3：提示消息按 PRD 铁律 §4.5 — 仅 4 类功能点写字段表**

- 新增 / 编辑 / 改价格 / 设置类 → 渲染 3 列字段表（字段名称 / 未填写提示 / 输入错误提示）
- 其它（查询/查看/删除/启用/停用/导入/导出/上下架/发布/复制/打印 等）→ 显示 `无。` 字符串
- ❌ 严禁混入校验逻辑包装（如"失焦或提交时..."/"则拦截..."等）

**条款 4：消息通知按 PRD 铁律 §4.6（必须用表格呈现）**

- 未列出 = 显示 `无。` 字符串
- 有内容时**一律以表格呈现**（与 PRD §4.6.4 一致），表头固定 `| 字段 | 字段说明 | 规则/示例 |`，行含 `消息标题` / `消息内容`（接收人写在消息内容列末尾 `；接收人=<具体角色>`）/ `通知渠道`（站内信）。**禁止**用"消息标题：xx / 消息内容：xx / 接收人：xx"的纯文本块或灰底卡片呈现。
- **双消息 / 多场景**：每条（消息 1 操作人确认 / 消息 2 受影响方通知；或 审核通过 / 审核驳回 等）各渲染**一张独立表格**，表上方加中文小标题（如 `【消息 1：操作人确认】` / `【审核通过】`）。
- 接收人禁写"操作人/发起人"，必须具体角色

### 8.4 字段规范 Tab 渲染规范

按 PRD 铁律 §3.1：
- 必须 5 列表头：`字段名称 / 类型 / 是否必填 / 默认值 / 约束规则`
- `是否必填` 列取值仅限 `是 / 否 / 条件必填`
- 字段名称加粗（用 `<strong>` 包裹）
- 分块标题（如「基本信息」「价格规格信息」）必须按 prd-data.json 的 `groups[].group_name` 渲染，禁臆造

### 8.5 顶栏标注总开关

| 规范要求 | 状态 |
|---|---|
| 顶栏右上角必须有 `el-switch` 总开关 | ✅ |
| 标签文字：`ℹ️ 标注` | ✅ |
| 状态持久化到 localStorage（key=`show-annotations`） | ✅ |
| 关闭时 `body.classList.add('annotations-hidden')` 隐藏所有 `.annotation-icon` | ✅ |
| 必须支持按 `A` 键快捷切换（绑在 document keydown） | ✅ |

### 8.5.0 所有导航元素必须可点击（v1.0 强制 / 通用规范 / 任何产品形态适用）

> ⚠️ **铁律**：原型 HTML 里**所有可点击元素必须真实可操作**，包括所有层级菜单、面包屑、Tab、关闭按钮、返回按钮、Logo、头像、语言、购物车、消息铃铛 等。即使是单页 demo，也要用 toast 或 ElMessageBox 模拟点击响应——**就像模拟一个用户的真实使用操作场景**。

#### 8.5.0.1 适用范围（所有产品形态通用）

按产品形态对应的导航元素清单：

| 产品形态 | 必须可点击的导航元素 |
|---|---|
| **B 端后台系统**（ERP / WMS / OMS / CRM 等）| 顶栏一级菜单 / 左侧二级菜单 / 左侧三级菜单 / 面包屑 / 系统 Logo / 头像 / 语言切换 / 通知铃铛 / 帮助中心 |
| **B2C 商城网站** | 顶部分类菜单 / 商品分类左侧栏 / 搜索按钮 / 购物车图标 / 个人中心 / 登录注册 / 商品卡片 / 收藏按钮 / 关注按钮 / 底部 footer 链接 |
| **B2B 平台** | 行业分类 / 厂商分类 / 询盘按钮 / 报价单 / 消息中心 / 企业认证 |
| **移动 App** | 底部 Tab Bar（每个 Tab）/ 顶部 NavBar / 抽屉式侧边栏 / 浮动 FAB 按钮 / 卡片 / 列表行 / 返回箭头 |
| **小程序** | 底部 Tab Bar / 自定义导航栏 / 胶囊按钮（关闭 / 返回首页）|
| **IM / 协作工具** | 左侧会话列表（每条会话）/ 联系人列表 / 顶部 Tab（消息 / 联系人 / 工作台）/ + 号新建会话 / 表情 / 附件 / 视频通话按钮 |
| **CMS / 博客** | 顶部菜单 / 侧边栏分类 / 标签云 / 归档列表 / 分页 / 上一篇 / 下一篇 |
| **教育系统** | 课程列表 / 章节目录 / 试题导航 / 进度条 / 收藏 / 笔记 |
| **医疗系统** | 患者列表 / 病历 Tab / 处方模板 / 检验项目 / 影像列表 |
| **金融 / 钱包** | 账户切换 / 资产入口 / 交易类型 / 历史记录 |
| **IoT / 设备管理** | 设备分组树 / 设备列表 / 实时 / 历史切换 / 报警铃铛 |

#### 8.5.0.1.5 点击响应方式规范（v1.0 强制 / 修复用户反馈）

> ⚠️ **铁律**：导航类元素的点击响应**必须分类处理**——切换型元素**静默切换 + 视觉高亮**，确认型元素**弹弹窗**。**严禁所有点击都弹 toast 干扰用户**。

| 元素类型 | 正确响应方式 | 禁止做法 |
|---|---|---|
| **菜单切换型**（顶栏一/二/三级菜单 / 侧边栏菜单 / Tab 切换）| ✅ 静默更新 active 状态 + 视觉高亮 | ❌ 每次点击都弹 ElMessage toast |
| **面包屑非当前页项** | ✅ 单页 demo 静默无响应（或写注释说明）；多页应用真实跳转 | ❌ 弹 toast "已返回 XX" |
| **关闭按钮**（弹窗 × / Tab × / Toast ×）| ✅ 静默关闭对应元素 | ❌ 弹确认（用户已主动点关闭，无需二次确认）|
| **Logo / 系统名** | ✅ 单页静默；多页跳转首页 | ❌ 弹 toast |
| **确认型操作**（退出登录 / 切换语言 / 重要状态修改）| ✅ 弹 `ElMessageBox.confirm` 二次确认 | — |
| **业务动作**（新增/编辑/删除/启用/停用/审核 等）| ✅ 校验 → 弹 `ElMessageBox.confirm` → 真实落库 + 成功 toast | — |

**正确做法的核心**：
- ✅ 切换型 = 静默 + 高亮（用户已经从视觉上看到切换了，不需要 toast 再说一遍）
- ✅ 确认型 = 弹窗（确认型操作有"提交"语义，用户需要二次确认）
- ✅ 业务动作 = 校验 + 确认 + 落库 + 成功 toast

**禁止做法**：
- ❌ 点菜单每次都弹 "已切换到 XX" toast（用户已明确反对，干扰阅读）
- ❌ 点面包屑弹 "已返回 XX" toast
- ❌ 点关闭 × 弹"已关闭"toast

#### 8.5.0.2 通用可点击元素清单（任何产品形态都必须做）

| 元素 | 必须可点击 |
|---|---|
| **所有层级菜单**（一/二/三级及以上）| ✅ 每个菜单项必有 `@click` |
| **所有面包屑项**（除最后一项当前页外）| ✅ 加 `@click.native` |
| **所有关闭按钮**（弹窗 × / Tab × / Toast × / Drawer ×）| ✅ 必须真实关闭对应元素 |
| **所有返回按钮**（移动端顶栏返回箭头 / 浏览器后退模拟）| ✅ 模拟返回 |
| **Logo / 系统名** | ✅ 点击模拟回首页 |
| **用户头像 / 用户名** | ✅ 点击模拟打开个人中心 / 退出登录 |
| **语言切换** | ✅ 点击模拟切换语言 |
| **通知铃铛 / 消息红点** | ✅ 点击模拟打开消息中心 |
| **购物车图标** | ✅ 点击模拟跳转购物车 |
| **搜索按钮 / 搜索框** | ✅ 点击模拟搜索 |
| **筛选 / 排序 / 切换视图** | ✅ 真实生效 |

#### 8.5.0.2 实现规范

```js
// 顶栏菜单点击（模拟切换，原型为单页所以用 toast 提示）
const onNavClick = (menuName, fullPath) => {
  if (menuName === '<当前菜单>') {
    ElMessage.info(`已在「${fullPath}」菜单`);
    return;
  }
  ElMessage.success(`已切换到「${fullPath}」（原型 demo，单页模拟）`);
};

// 面包屑点击（模拟回到上级）
const onCrumbClick = (crumbName) => {
  ElMessage.success(`已返回「${crumbName}」（原型 demo，单页模拟）`);
};
```

```html
<!-- 顶栏菜单 -->
<div class="nav-item" @click="onNavClick('首页', '首页')">首页</div>
<div class="nav-item active" @click="onNavClick('会员', '会员')">会员</div>

<!-- 面包屑（最后一项即当前页，不可点击）-->
<el-breadcrumb separator="/">
  <el-breadcrumb-item :to="''" @click.native="onCrumbClick('会员')">
    <a href="javascript:void(0)">会员</a>
  </el-breadcrumb-item>
  <el-breadcrumb-item :to="''" @click.native="onCrumbClick('会员中心')">
    <a href="javascript:void(0)">会员中心</a>
  </el-breadcrumb-item>
  <el-breadcrumb-item>会员等级</el-breadcrumb-item>  <!-- 当前页，不挂事件 -->
</el-breadcrumb>
```

#### 8.5.0.3 当前位置高亮

- 顶栏当前菜单必须加 `class="active"`（已有的高亮 CSS）
- 面包屑最后一项不可点击（当前页面已经在这里）

#### 8.5.0.4 禁止做法

- ❌ 顶栏菜单只是 `<div>` 文本，没 `@click`
- ❌ 面包屑全是不可点击的 `<el-breadcrumb-item>`
- ❌ 系统名 / Logo / 用户头像 / 语言切换 没点击响应
- ❌ 点击导航元素无任何视觉反馈（连 toast 都没有）

#### 8.5.0.5 正确做法

- ✅ 每个导航元素都有 `cursor: pointer` + `@click` 事件
- ✅ 点击触发 `ElMessage.success/.info` 模拟切换
- ✅ 当前位置高亮（顶栏 `.active`、面包屑最后一项不挂事件）

---

### 8.5.0.6 页签导航必须支持（v1.0 强制 / B 端框架标配）

> ⚠️ **铁律**：B 端后台系统（ERP / WMS / OMS / CRM 等）的原型 HTML 框架**必须**支持「页签导航」（Page Tabs / Tag Tabs），位于顶栏下方、主内容区上方。

#### 8.5.0.6.1 适用产品形态

| 产品形态 | 是否必须 |
|---|---|
| B 端后台系统（ERP / WMS / OMS / CRM / HR / 财务 等）| ✅ **必须** |
| B2B 平台 | ✅ 必须 |
| 复杂业务 SaaS | ✅ 必须 |
| 商城前端 / 移动 App / 小程序 | ❌ 不需要（这些用 Bottom Tab 或 Drawer）|

#### 8.5.0.6.2 行为规范

| 行为 | 要求 |
|---|---|
| **默认 Tab** | 至少有 1 个不可关闭的「首页」Tab |
| **当前页 Tab** | 进入页面时自动生成 1 个 Tab，标签为模块名 |
| **点击侧边栏菜单** | 如果该 Tab 不存在 → 新增 Tab + 切换；如果已存在 → 直接切换 |
| **点击 Tab** | 静默切换到该页（同步 activeMenu）|
| **点击 Tab × 关闭按钮** | 关闭该 Tab；如果关闭的是当前 active → 自动切到前一个 Tab |
| **「首页」不可关闭** | `closable: false` |
| **样式** | 当前 active Tab 高亮（蓝色字 + 白底）、其它 Tab 灰底；hover 反馈 |

#### 8.5.0.6.3 数据结构

```js
const activeTab = ref('home');
const openTabs = reactive([
  { key: 'home', label: '首页', closable: false },
  { key: '<fp_key>', label: '<模块名>', closable: true }
]);
```

#### 8.5.0.6.4 禁止做法

- ❌ 没有页签导航（用户已明确要求加）
- ❌ 「首页」可关闭
- ❌ 点 Tab × 弹确认框（用户已主动点 ×，无需二次确认）
- ❌ 关闭 active Tab 后不自动切换到其它 Tab

---

### 8.5.1 页面头部信息冗余规范（v1.0 强制 / 修复用户反馈）

> ⚠️ **铁律**：当面包屑已经显示当前模块名时，**禁止再渲染 H2/H3 模块标题**（避免冗余）。

**禁止做法**：
```html
<!-- 面包屑：会员 / 会员中心 / 会员等级 -->
<el-breadcrumb>...</el-breadcrumb>

<!-- ❌ 禁止：H2 与面包屑末项重复信息 -->
<h2>会员等级管理</h2>
```

**正确做法**：
```html
<!-- 面包屑：会员 / 会员中心 / 会员等级 -->
<el-breadcrumb>...</el-breadcrumb>

<!-- ✅ 直接进入业务区，无单独模块标题 -->
<el-card>...</el-card>
```

**例外情况**：
- 详情页 / 编辑页（需要显示对象名）→ 可以保留 H2 显示"<对象名> 详情"等动态标题
- 复合模块（一个页面承载多个子模块）→ 可以保留 H2 区分各子模块
- **单一模块 CRUD 页面（如本 demo）** → **禁止**显示 H2

---

### 8.6 ℹ️ 图标渲染规范 + 锚点位置规范

#### 8.6.1 锚点位置规范（v1.0 强制 / 修复用户反馈）

> ⚠️ **铁律**：ⓘ 标注必须挂在**功能点的入口动作元素**旁，**禁止挂在导航元素 / 模块标题旁**。

| 元素类型 | 是否挂 ⓘ | 理由 |
|---|---|---|
| H1 / H2 / H3 **模块标题**（如"会员等级管理"）| ❌ **禁止** | 是导航元素，不是功能点；用户已明确反对 |
| **面包屑** | ❌ 禁止 | 是导航元素 |
| 顶栏 / 侧边栏菜单项 | ❌ 禁止 | 是导航元素 |
| **「查询」/「重置」按钮**旁 | ✅ 挂在「查询」按钮旁（查询功能点入口）|
| **「新增」按钮**旁 | ✅ 挂在「新增」按钮旁 |
| 表格行**操作列每个动作按钮**（「编辑」/「删除」/「启用」/「停用」/「上架」/「下架」/「改价」/「审核」/「打印」/「导出」 等）旁 | ✅ 每个按钮各挂一个 ⓘ |
| 列表表格本身 | ❌ 不挂（查询功能点的 ⓘ 在查询按钮旁，覆盖整个查询区）|
| 单条字段下方（用于显示字段约束）| ❌ 不挂（字段规范通过功能点 ⓘ 查看，不重复挂在字段上）|

**通用判定原则**：
- ⓘ 必须挂在**用户能点击触发该功能点的入口元素**旁
- **ⓘ 紧跟在功能按钮 / 入口元素的「正后面」**（同一行、`margin-left` 紧贴其右侧），不换行、不另起区域。如：`<el-button>充值</el-button><i class="annotation-icon" @click="openAnno(ak('充值管理','充值'))">i</i>`
- 入口是按钮 → ⓘ 紧贴按钮右侧；入口是行内链接（如列表里蓝色「单据号 / 业务单号 / 金额」链接代表查看类功能）→ ⓘ 紧贴该链接右侧
- **同一功能点有多个并列入口时，每个入口各挂一个 ⓘ（指向同一功能点）**——典型：「查看」既有列表里的**单据号 / 编号蓝色链接**入口，又有操作列的**「查看」按钮**入口，则**两处都要挂 ⓘ**（都指向该模块的"查看"功能点）。这与"同一入口只挂一个 ⓘ"不冲突（禁止的是在同一个元素上堆多个，不是禁止多入口）
- 如果该元素是表单区 / 卡片 → ⓘ 挂在该区的**主按钮**旁（如「查询」按钮旁），不挂在区头标题旁
- **跨系统共享按钮**：fp_key 用 `ak(menu, fn)` 按当前系统动态生成（如 `ak('充值管理','充值')` → `充值管理-WMS.充值` / `充值管理-OMS.充值`），同一模板元素自动对应各系统功能点
- ⓘ 默认隐藏，由顶栏「ℹ️ 标注」总开关（+`A` 键）控制 `body.annotations-hidden`；默认视图不出现 ⓘ，开关打开后每个功能按钮后才显示

**禁止做法**：
- ❌ **另设独立的「标注栏 / 标注芯片条 / 功能点清单 bar」集中列出功能点**（用户已明确反对——标注必须紧跟在每个功能按钮后面，不能脱离按钮单独成区）
- ❌ 在模块标题旁挂 ⓘ（用户反馈："模块标题不是功能点"）
- ❌ 一个功能点入口挂多个 ⓘ（同一入口只挂一个；同一功能点在 OMS/WMS 两套模板中各出现一次属正常，因 v-if 只渲染当前系统）
- ❌ 在不可点击的元素（如纯文本、Label、Tag）旁挂 ⓘ
- ❌ ⓘ 换行另起一行、或与按钮拉开距离（必须紧贴按钮右侧）

#### 8.6.2 图标样式规范

| 规范要求 | 状态 |
|---|---|
| 图标用 `<i class="annotation-icon">i</i>`（字母 i） | ✅ |
| 主色背景圆形（直径 18px） | ✅ |
| `data-anno-target="<fp_key>"` 必填 | ✅ |
| 点击触发 `openAnnotationDrawer(fp_key)` | ✅ |
| 鼠标悬停 scale 1.1 + 变实色 | ✅ |
| **位置**：紧贴入口按钮右侧（margin-left: 4px），不另起一行 | ✅ |
| 受顶栏「ℹ️ 标注」开关控制：关闭时 `body.classList.add('annotations-hidden')` 隐藏全部 ⓘ | ✅ |

#### 8.6.3 可标注元素类型（v1.0 通用 / 所有产品形态适用）

原型中以下元素**均可作为标注锚点**，悬停时触发 PIN 标注气泡（见 §8.10）：

| 元素类型 | CSS 选择器 | 适用场景 | 说明 |
|---|---|---|---|
| **功能按钮** | `.el-button:not([class*="pagination"])` | 所有产品形态 | B 端工具栏 / 操作栏按钮；APP 主操作按钮 |
| **Tab 页签** | `.el-tabs__item` | B 端 / APP | 切换类 Tab，每个页签可单独标注 |
| **自定义 Tab 按钮** | `.stab` | B 端扩展 | 非 el-tabs 实现的页签按钮 |
| **操作列图标** | `.op-icon` | 表格行操作 | 列表操作列的查看 / 编辑 / 删除等图标；需在 `<el-table-column>` 里对每个图标加 `class="op-icon" data-tip="查看"` |
| **单据号 / 编号链接** | `.order-link` | 列表蓝色链接 | 可跳转到详情的单据号 / 业务单号链接；需加 `class="order-link"` |
| **通用标注区域** | `[data-anno-zone]` | APP / 小程序 / 网站 | 无明确按钮的功能区；给容器加 `data-anno-zone="区域名称"` 即可标注；适用于 APP 页面区域 / 小程序功能区 / 网站内容区 |

**实现要点**：
- `.op-icon` 写法：`<i class="el-icon-view op-icon" data-tip="查看" @click="handleView(row)"></i>`
- `.order-link` 写法：`<a class="order-link" @click="handleViewDetail(row)">{{ row.orderNo }}</a>`
- `[data-anno-zone]` 写法：`<div data-anno-zone="商品规格选择区">...</div>`

**SELECTORS 完整列表**（原型 JS 悬停检测必须包含）：
```js
const SELECTORS = [
  '.el-button:not([class*="pagination"])',
  '.el-tabs__item',
  '.stab',
  '.order-link',
  '.op-icon',
  '[data-anno-zone]',
].join(', ');
```

### 8.7 原型业务流程必须真实可操作（v1.0 强制 / 通用规范）

#### 8.7.0 总原则：AI 必须以 prd-data.json 为单一真理源，动态生成原型代码

> 🏛 **核心铁律**：AI 生成的原型 HTML 中**每个字段的校验规则**、**每个动作的业务流程**、**每个状态的跳转逻辑**、**每个提示的文案**——都**必须严格映射** prd-data.json 里对应功能点的字段规范和用例规则。**禁止脱离 prd-data.json 凭空写**。

**适用范围**：**任何产品形态**——ERP / WMS / OMS / CRM / 零售门店 / B2C 商城 / B2B 平台 / CMS / 移动 App / IM 协作 / 教育 / 医疗 / 金融 / 物流 / IoT / DevOps / 设备管理 / 智慧城市 / 餐饮 / 旅游 / 政务 等等。**业务对象**也任意——商品 / 订单 / 仓库 / 客户 / 用户 / 设备 / 课程 / 病历 / 账户 / 物流单 / 项目 / 任务 / 工单 / 凭证 / 报表 / 工艺路线 等。

**映射对照表**（AI 生成原型代码时必须严格按此表转换 prd-data.json 内容）：

| prd-data.json 内容（数据源） | 原型 HTML 必须实现的代码 |
|---|---|
| `field_specs.groups[].fields[].required = "是"` | el-form-item 加 `prop` + formRules 加 `{ required: true, message: '请输入<field.name>', trigger: 'blur' }` |
| `constraint` 含「X~Y 字符」 | `{ min: X, max: Y, message: '长度 X~Y 字符', trigger: 'blur' }` |
| `constraint` 含「X~Y 数值」/「X~Y 之间」 | `{ type: 'number', min: X, max: Y, message: '范围 X~Y', trigger: 'blur' }` |
| `constraint` 含「同 X 内唯一」 | 自定义 validator 在 mockTableData 中查重 |
| `constraint` 含「正则 / 格式 / 国际标准」（如手机号 / EAN-13 / RFC 5322）| `{ pattern: /<regex>/, message: '<格式说明>', trigger: 'blur' }` |
| `constraint` 含「> 上一级」「< 当前库存」等跨字段比较 | 自定义 validator 实现跨字段对比 |
| `default` = "VL0001（自动）" / "SPU + 10位数字" 等编号 | 新增时按业务对象类型自动生成下一个编号 |
| `type` = "下拉选择" + constraint 列举值 | `<el-select>` + `<el-option>` 渲染所有候选 |
| `type` = "日期" / "金额" / "数值" / "文本域" / "上传" | 对应 Element Plus 控件 + 格式化 |
| `use_cases.preconditions` 含业务前置（如"列表中存在 X 状态的 Y"）| 动作 handler 顶部业务校验，不符则 `ElMessage.error/warning` 拦截 |
| `use_cases.operation_flow` 含「弹出二次确认」 | `ElMessageBox.confirm(<文案>)` |
| `use_cases.operation_flow` 含「用户点击 X 按钮 / 链接」 | 列表 / 操作区 / 表单底栏对应按钮 + click handler |
| `use_cases.operation_flow` 含「用户填写表单字段」 | `<el-form>` + `<el-form-item prop>` + 字段约束 |
| `use_cases.operation_flow` 含「用户点击「取消」」 | 取消路径按 §4.3.2 弹窗类用 `用户点击「取消」，系统关闭弹窗，不执行任何操作。` |
| `use_cases.postconditions` 含「<对象>从<模块>列表移除」 | `mockTableData.splice(idx, 1)` + `tableData.value = [...mockTableData]` |
| `use_cases.postconditions` 含「状态变为 X」 | `target.status = 'X'` + `tableData.value = [...mockTableData]` |
| `use_cases.postconditions` 含「列表数据同步刷新」 | `tableData.value = [...mockTableData]` + `total.value = mockTableData.length` |
| `use_cases.postconditions` 含「生成一条<对象>数据」 | `mockTableData.push({...form, [idKey]: newId, ...})` |
| `use_cases.validations` 每条非字段级校验 | 动作 handler 内对应业务校验 + 拦截提示（用 schema §8.7.3 4 类前置）|
| `use_cases.prompt_messages` 字段表 | formRules 包含对应字段的 message |
| `use_cases.message_notifications` = "无。" | 不弹通知 |
| `use_cases.message_notifications.type` = "双消息" | `ElMessage.success`（操作人确认）+ `ElMessage.info`（受影响方通知）2 个 toast |
| `use_cases.operation_log` = "查询/查看不输出..." | 不模拟操作日志 |
| `use_cases.operation_log` 含 `detail_example` | 在 Console 输出操作日志条目（仅用于演示，可选）|

**实现约束**：
- 每个 fp_key 的 7 项用例规则**都必须**在原型代码中有对应实现
- **1 项 = 1 段代码**，逐项映射，**禁止跳过、禁止简化、禁止臆造**
- 若 prd-data.json 中某项为"无。"，原型代码该段**不实现**（不要画蛇添足）

**通用原则**：任何 fp_type（不限于 9 大 CRUD，也包括上架/下架/审核/驳回/作废/调拨/打印/复制 等业务下发类），AI 都必须**先从 prd-data.json 提取字段规范 + 用例规则**，**再按映射表转换为原型代码**。**禁止脱离数据源凭空写校验或业务流程**。

下方所有代码示例**字段名都是占位符**（`<fieldKey>` / `<idKey>` 等），AI 必须按 prd-data.json 实际内容替换。

#### 8.7.1 表单字段失焦校验 + 提交校验

**要求**：
1. **每个 `<el-form-item>` 必须有 `prop` 属性绑定到表单字段名**
2. **`<el-form :rules="formRules">` 必须配置完整校验规则**
3. **失焦触发**：`trigger: 'blur'`（用户离开字段立即在字段下方显示错误）
4. **提交触发**：点保存按钮触发 `formRef.value.validate()`，**所有不符合规则的字段同时在各自下方显示错误**
5. **错误显示位置**：用 el-form-item 默认机制（错误以红色文字显示在该字段正下方）

**通用代码模板**（`<fieldKey>` / `<idKey>` 是占位符，AI 按实际场景替换）：

```html
<el-form
  ref="formRef"
  :model="form"
  :rules="formRules"
  label-position="top"
>
  <!-- 重复：每个数据字段一个 el-form-item -->
  <el-form-item label="<字段标签>" prop="<fieldKey>">
    <el-input v-model="form.<fieldKey>" placeholder="请输入" />
  </el-form-item>
</el-form>
```

```js
// 自定义业务校验器（按字段语义实现，常见：唯一性 / 跨字段 / 业务约束）
const validate<FieldKey>Unique = (rule, value, callback) => {
  if (!value) { callback(); return; }
  const exists = mockTableData.some(r =>
    r.<fieldKey> === value && r.<idKey> !== form.<idKey>
  );
  if (exists) callback(new Error('<字段标签>已存在'));
  else callback();
};

// 校验规则按字段语义自动生成（必填 / 格式 / 长度 / 范围 / 业务唯一性 / 跨字段）
const formRules = {
  <fieldKey1>: [
    { required: true, message: '请输入<字段标签>', trigger: 'blur' },
    { min: <minLen>, max: <maxLen>, message: '长度 <minLen>~<maxLen> 字符', trigger: 'blur' },
    { validator: validate<FieldKey1>Unique, trigger: 'blur' }
  ],
  <fieldKey2>: [
    { required: true, message: '请输入<字段标签>', trigger: 'blur' },
    { type: 'number', min: <min>, max: <max>, message: '范围 <min>~<max>', trigger: 'blur' }
  ]
  // ...
};

// 通用保存流程：校验 → 二次确认 → 真实落库 → 关闭弹窗
const onSave = async () => {
  if (!formRef.value) return;
  try {
    await formRef.value.validate();
  } catch {
    ElMessage.error('请检查表单字段，修正后再提交');
    return;
  }
  try {
    await ElMessageBox.confirm('确认提交该<业务对象>？', '提示', {
      confirmButtonText: '确认', cancelButtonText: '取消', type: 'warning'
    });
  } catch { return; }
  // 真实修改 mockTableData
  if (isEdit.value) {
    const idx = mockTableData.findIndex(r => r.<idKey> === form.<idKey>);
    if (idx >= 0) Object.assign(mockTableData[idx], form);
    ElMessage.success('<业务对象>编辑成功');
  } else {
    mockTableData.push({ ...form, ...生成业务字段（如关联会员数=0、创建时间=now 等） });
    ElMessage.success(`<业务对象>"${form.<nameKey>}"新增成功`);
  }
  tableData.value = [...mockTableData];
  total.value = mockTableData.length;
  dialogVisible.value = false;
};
```

#### 8.7.2 通用业务动作模拟（不限于 9 大 CRUD，覆盖所有功能点类型）

**核心要求**：每个动作必须真正影响 `mockTableData`（或对应业务数据数组），而不只是弹 Toast。

| 动作类型 | 通用行为模式 |
|---|---|
| **查询** | 真实按筛选条件 filter mockTableData → 更新 tableData → Toast 显示筛选数量 |
| **重置** | 清空 filters → `tableData = [...mockTableData]` → 恢复全部 |
| **查看** | 弹窗 / 跳转详情页，回显当前行所有字段（只读模式）|
| **新增** | 校验通过 → 二次确认 → `mockTableData.push(...)` → 列表自动出现新行 + 编号自动递增 |
| **编辑** | 校验通过 → 二次确认 → 找到对应行更新字段 → 列表同步刷新 |
| **删除** | 业务前置校验（关联依赖 / 状态机限制）→ 二次确认 → `splice` 移除 → 列表少一行 |
| **启用 / 停用** | 状态机校验（已启用/已停用拦截）→ 二次确认 → 修改 status → Tag 切换 |
| **导入** | 上传文件 → 进度条/Loading → 完成后批量新增 + 错误清单 |
| **导出** | 按筛选条件汇总 → 模拟下载（ElMessage 或 console.log）|
| **复制** | 取当前行字段 → 编号自增 → push 新行（名称加"副本_"前缀）|
| **打印** | 选模板弹窗 → 选打印份数 → 模拟 window.print() 或 toast 提示 |
| **业务下发**<br>（上架/下架/改价格/发布到门店/发货/签收/退货等 §4.6.4 八类）| 业务校验 → 二次确认 → 修改对应字段 → 模拟**双消息通知** toast（消息 1 给操作人，消息 2 给受影响方）|
| **审批 / 状态机变更**<br>（审核通过/驳回/作废/冻结/解冻/反结案 等）| 状态机校验（合法跳转）→ 二次确认 → 切换状态 → 必要时通知下一环节 |
| **跨模块联动**<br>（调拨/分配/绑定 等）| 模拟源数据扣减 + 目标数据增加 + 双消息通知 |
| **自定义动作** | AI 按业务语义自动套近似模板，遵守用例规则 7 项 |

**通用模式 — push/update/splice 三类操作**：

```js
// 新增
mockTableData.push({ ...form, [idKey]: newId, createdAt: now, ...defaultFields });

// 编辑
const idx = mockTableData.findIndex(r => r[idKey] === form[idKey]);
if (idx >= 0) Object.assign(mockTableData[idx], form);

// 删除（含业务校验）
if (row.relatedCount > 0) { ElMessage.error('有关联数据，不可删除'); return; }
mockTableData.splice(idx, 1);

// 状态切换
target.status = 'active'; // 或其他状态值

// 同步触发 Vue 响应式
tableData.value = [...mockTableData];
total.value = mockTableData.length;
```

#### 8.7.3 业务前置校验必须真实执行（按业务规则）

按用户实际业务规则执行**业务前置校验**，常见 4 类：

| 类型 | 例子 |
|---|---|
| **关联依赖校验** | 删除有关联子数据时拦截（如"该分类下有 N 个商品，不可删除"）|
| **状态机校验** | 非法跳转拦截（如"已售罄商品不可上架"、"已撤销订单不可再撤销"）|
| **业务唯一性校验** | 同业务域内唯一（如名称/编号/手机号唯一）|
| **业务时效校验** | 超期拦截（如"超过 90 天的调拨单不可撤销"、"已结案订单不可改价"）|

**必须先于二次确认执行**，并用 `ElMessage.error / warning` 提示。

#### 8.7.4 编号自动生成（按业务对象类型）

新增类必须自动生成主键编号，AI 按业务对象类型推断前缀：

| 业务对象 | 编号前缀 | 示例 |
|---|---|---|
| 商品（SPU/SKU） | SPU/SKU | `SPU0000001234` / `SKU0000001234` |
| 订单 | ORD/SO/PO | `SO20260605001` / `PO20260605001` |
| 客户/会员 | CST/MEM/CUS | `CST00001` |
| 用户/账号 | UID/USR | `UID000001` |
| 仓库/库位 | WH/LOC | `WH001` / `LOC001` |
| 设备 | DEV/IoT | `DEV000001` |
| 课程 | CRS | `CRS000001` |
| 项目/任务 | PROJ/TASK | `TASK000001` |
| 自定义业务对象 | 用户/PM 命名 | 按业务命名 |

**编号不可手填**（必须置灰）；点击新增时**自动生成下一个序号**。

#### 8.7.5 状态变化即时反馈

启用/停用/改价等动作后，状态字段（Tag / 颜色 / 文字）必须立即在列表上反映变化（不要"假装成功但状态没变"）。

#### 8.7.6 弹窗关闭路径必须真实生效

所有 `<el-dialog>` 类弹窗（新增/编辑/导入/导出/批量编辑 等含「取消」按钮的配置类弹窗）**必须支持 4 个关闭路径**：

| 关闭路径 | 实现方式 |
|---|---|
| **右上角 × 关闭按钮** | el-dialog 默认行为（不要禁用） |
| **取消按钮** | `<el-button @click="dialogVisible = false">取消</el-button>` |
| **保存按钮**（校验通过 + 二次确认通过）| `dialogVisible.value = false` 在 onSave 末尾 |
| **ESC 键** | el-dialog 默认行为（`:close-on-press-escape` 不要设 false） |

**禁止做法**：
- ❌ 关闭按钮 × 被屏蔽（用户无法关闭弹窗）
- ❌ 取消按钮没绑事件
- ❌ 保存成功后弹窗不关闭（用户必须手动点 × 或取消）
- ❌ ESC 不能关闭

**配套要求（数据持久化）**：
- 关闭弹窗时必须 `formRef.value?.resetFields()` 重置校验状态（避免下次打开时残留红字提示）
- 用 `@close="onDialogClose"` 监听
- `:close-on-click-modal="false"` 是合理设置（防止误点遮罩关闭丢数据），但 × / 取消 / ESC 必须保留

#### 8.7.7 数据持久化范围（演示用，不要求 localStorage）

- 在浏览器内存中维护 `mockTableData` 数组作为业务真实数据源
- **当次浏览器会话内**所有修改必须保留并反映到 UI
- 刷新页面后 mock 数据**重置**为初始值（演示用途，无需持久化）

#### 8.7.8 Vue 3 + Element Plus CDN 模式下必须解构的全局变量（v1.0 强制 / 易遗漏致命坑）

> 🐛 **常踩坑**：原型 HTML 用 CDN 模式时，setup 函数体内直接写 `ElMessage`、`ElMessageBox` 等会 `ReferenceError`，导致**所有 handler 静默崩溃**（按钮看似没反应，但其实是 try/catch 吞了错误）。

**必须在 `<script>` 顶部全局解构所有用到的 ElementPlus 全局**：

```js
// Vue 解构
const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

// Element Plus 图标（如果用到）
const { Plus, Edit, Delete, View } = ElementPlusIconsVue;

// 🔥 关键：ElementPlus 的常用 API 必须显式解构
// 仅 app.use(ElementPlus) 不够 —— 它注册全局组件 + 指令，但不会让 ElMessage 在 setup 作用域可访问
const { ElMessage, ElMessageBox, ElNotification, ElLoading } = ElementPlus;

const app = createApp({ ... });
app.use(ElementPlus);
app.mount('#app');
```

**易遗漏的全局变量清单**（AI 生成原型时**必须**全部解构）：

| 全局变量 | 用途 | 必须解构 |
|---|---|---|
| `ElMessage` | 顶部 toast 提示（success/error/warning/info）| ✅ 必须 |
| `ElMessageBox` | 二次确认弹窗（confirm/alert/prompt）| ✅ 必须 |
| `ElNotification` | 右下角通知 | 如有使用必须 |
| `ElLoading` | 全屏 Loading | 如有使用必须 |

#### 8.7.9 全场景禁止 / 正确做法清单

**禁止做法**（任何业务场景都禁）：
- ❌ 点保存只弹 "新增成功" Toast，列表里看不到新数据
- ❌ 点删除只弹 Toast，列表里数据没消失
- ❌ 点启用 / 停用 / 上架 / 下架 / 改价 只弹 Toast，状态 / 数值没变
- ❌ 表单字段没 `:rules`，随便填都能提交
- ❌ 校验错误用 alert / 顶部 Toast 弹出（应该用 el-form-item 默认在字段下方红字）
- ❌ 业务前置校验缺失（如删除时不检查关联依赖）
- ❌ 状态机非法跳转不拦截
- ❌ 编号不自动生成（让用户手填）
- ❌ 弹窗关闭路径被屏蔽（× / 取消 / ESC）
- ❌ 关闭弹窗后下次打开还残留旧校验红字

**正确做法**（任何业务场景都必须）：
- ✅ 用户填错字段 → 离开字段 → 字段**下方**立即出现红字提示
- ✅ 用户点保存 → 多个字段**同时在各自下方**显示错误
- ✅ 提交成功 → 列表**立即**出现新行 / 更新行 / 少一行 / 状态切换
- ✅ 业务前置校验**先于二次确认**执行，用 `ElMessage.error / warning` 提示
- ✅ 编号自动按业务对象类型生成（SPU / ORD / CST / DEV 等）
- ✅ 关闭弹窗后自动 `formRef.resetFields()` 重置校验
- ✅ 状态变化即时反映到列表 Tag / 颜色 / 数值

### 8.7.9.5 PRD ↔ 原型标注双向同步（v1.0 关键铁律）

> 🏛 **核心铁律**：**prd-data.json 是单一真理源**。原型与 PRD 的字段规范 / 用例规则任意一方变化，都通过 prd-data.json 同步到对方。

#### 8.7.9.5.1 双向同步示意

```
原型 HTML ←→ prd-data.json ←→ PRD .md
            (单一真理源)
                ↑
          标注层从此拉取
```

#### 8.7.9.5.2 触发场景与同步动作

| 用户触发 | 同步动作 |
|---|---|
| "原型里 X 字段加一条约束" | 1. 更新 prd-data.json 对应 field_specs<br>2. 重新生成原型 HTML（标注层显示新约束）<br>3. 重新生成 PRD .md（§3 字段规范同步）|
| "PRD §3.X 字段约束改成 Y" | 1. 更新 prd-data.json 对应 field_specs<br>2. 重新生成 PRD .md<br>3. 重新生成原型 HTML（标注层同步）|
| "原型里加一个新功能点" | 1. 更新 prd-data.json 加新 fp_key + use_cases<br>2. 重新生成原型 HTML（新增按钮 + 新 ⓘ 标注）<br>3. 重新生成 PRD .md（§4.X 新增章节）|
| "PRD 删一个功能点" | 1. 删除 prd-data.json 对应 fp_key<br>2. 重新生成原型 HTML（移除按钮 + ⓘ）<br>3. 重新生成 PRD .md |

#### 8.7.9.5.3 必须遵守的同步顺序

```
1. 接收用户变更指令
2. 确认变更点（字段名/约束/规则等）→ 主动复述给用户："你是要把 X 改成 Y，对吧？"
3. 用户确认后：
   a. 更新 prd-data.json（**第一步必做**，因为是源头）
   b. 重新生成原型 HTML（标注层会自动拉新数据）
   c. 重新生成 PRD .md
   d. 重新跑 make-offline.ps1 出离线版
4. 在文件头加变更日志：与上一版相比，本次主要变更 X → Y
5. 告知用户："已同步原型 + PRD，请重新核对"
```

#### 8.7.9.5.3.5 增量同步铁律（v1.0 / 关键新增）

> 🏛 **核心**：用户改某一处时，AI **只更新 3 处**，**不全文重写**。

**触发场景**：原型已生成 → 用户在对话框说"改 X" / "加 Y" / "删 Z" 这类**单点改动**。

**AI 必须只改的 3 处**：

| # | 改的位置 | 操作 |
|---|---|---|
| 1 | **原型 HTML** | 精准定位 DOM → 只改那段（如某个 form-item / 列 / 按钮）|
| 2 | **prd-data.json** | 只改对应字段节点（让原型标注同步显示新值）|
| 3 | **PRD .md** | 只改对应段落（如某字段的字段表行 / 某用例规则的某步）|

**禁止做法**：
- ❌ 全文重写原型 HTML
- ❌ 全文重写 PRD .md
- ❌ 整个重新生成 prd-data.json
- ❌ 改一处顺手"优化"其他无关内容
- ❌ 自创不在用户意图内的改动

**正确做法**：
- ✅ 精准定位用户要改的内容
- ✅ 只改 3 处对应位置
- ✅ 改完告诉用户："已增量同步 [原型 HTML 第 N 行 / prd-data.json X 字段 / PRD §X.Y]，其他无关内容未动"
- ✅ 必须跑 make-offline.ps1 出新离线版

**示例场景**：

| 用户说 | AI 只改 |
|---|---|
| "等级名称字段最大长度改 50" | 原型 maxlength="50" + prd-data.json constraint + PRD §3.1 该行 |
| "新增按钮文字改为「+ 添加」" | 原型按钮 text + PRD operation_flow 该步 |
| "删除有关联会员时拦截文案改成 XX" | 原型 onDelete 提示 + use_cases.validations 文案 + PRD §4.4 该条 |
| "状态机加一个「已审核」中间态" | 原型 status enum + prd-data 状态机 + PRD 状态机段 + 操作日志 detail_format |

**菜单结构改的特殊性**（PRD §4 章节命脉）：

菜单是 PRD §4 章节编号的源头，改菜单时必须同步 3 处：

| 用户说 | AI 同步 3 处 |
|---|---|
| "加一个三级菜单 Z 在 §A0" | ① 原型侧栏 + 面包屑加 Z 入口 ② prd-data.json `menus.children` 加 Z ③ PRD §4.x.y.z 新增章节（编号自动）|
| "删菜单 Y" | ① 原型侧栏删 Y ② prd-data.json `menus` 删 Y ③ PRD §4.x.y 整段删除 + 后续章节编号自动重排 |
| "把菜单 X 改名为 X'" | ① 原型侧栏 + 面包屑改名 ② prd-data.json `menus.menu_key` + `menu_path` 改 ③ PRD §4.x.y 章节标题改名 |

**禁止**：菜单改一处 → 重新生成整个 PRD §4 章节 / 重新画整个原型。

---

#### 8.7.9.5.4 禁止做法

- ❌ 只改原型不改 PRD（或反之）→ 数据脱钩
- ❌ 不通过 prd-data.json 直接改 HTML / .md → 破坏单一真理源
- ❌ 改完不通知用户重新核对
- ❌ 改完不重新生成离线版（用户拿到的还是旧版）

#### 8.7.9.5.5 正确做法

- ✅ 任何变更都先更 prd-data.json
- ✅ 原型 + PRD 同时重新生成
- ✅ 标注层自动从 prd-data.json 拉新数据（前端 reactive）
- ✅ 离线版必须重新跑（最终交付）
- ✅ 主动告知用户"已同步，请重新核对"

---

### 8.8 标注内容严格遵守 PRD 铁律源

所有标注层显示的内容（字段规范 + 用例规则 7 项）**必须严格遵守** [_rules/prd-template-structure.mdc](../prd/_rules/prd-template-structure.mdc) 的全部 §1-§4 铁律，包括但不限于：

- §1.5 术语章节标配（软删除 / 双消息 / 状态机 / 二次确认弹窗 / 异步任务 / 回显 / 条件必填）
- §3.1 字段规范 5 列表头 + §3.1.4 71 类行业标准库 + §3.1.5 22 类默认值库 + §3.1.6 分块标题禁臆造
- §4.2.1 前置条件三要素 + §4.2.2 后置条件 15 类标准句式
- §4.3 操作流程入口动作句式 + §4.3.2 双路径 + UI 类型分流
- §4.4 校验规则单条边界（1 条 = 1 个完整链）+ §4.4.1 与提示消息表职责分离
- §4.5 提示消息仅 4 类功能点写字段表 + 列 3 仅纯文案
- §4.6 消息通知未列=无 + §4.6.4 双消息适用范围 8 类
- §4.7.1 操作日志固定说明语 + 三列六行 + 操作明细句式 + §4.7.2 适用范围

**违反任一条 = 必须重写**。

---

---

## 8.9 审核弹窗两套范式（强制）

> 任何涉及"审核"功能点的原型，**必须**按以下两种场景选择对应实现，不得混用。

### 场景一：有单据详情页（推荐默认）

**适用条件**：列表有「查看」入口（眼睛图标 / 单据号蓝色链接可进详情页）。

**交互流程**：
1. 列表审核按钮（审核图标/按钮）→ `openDetail(row)`，**直接跳转详情页**，不弹 modal
2. 详情页底部操作栏（仅 `状态===待审核 && 当前系统有审核权限` 时显示）：
   - `<el-button type="danger"  @click="openAudit(dr,'reject')">审核驳回</el-button>`
   - `<el-button type="primary" @click="openAudit(dr,'approve')">审核通过</el-button>`
3. 点击后弹**简单弹窗**（无单据信息回显）：
   - 标题：审核通过 / 审核驳回
   - 原因输入框标签：通过原因（非必填）/ 驳回原因（**必填**，空时拦截提示"请输入驳回原因"）
   - 字数上限 200 字符（`maxlength="200" show-word-limit`）
   - Footer：取消 + 确定（一个按钮）
   - 禁止在简单弹窗里再放驳回/通过两个按钮

### 场景二：无单据详情页（直接从列表审核）

**适用条件**：列表没有可跳转的详情页，或业务场景中审核必须在列表快速完成。

**交互流程**：
1. 列表审核按钮 → 弹**带核心信息的审核弹窗**（防止用户点错）
2. 弹窗结构：
   - **顶部信息区**：展示「能让用户判断是否审核了正确单据」的字段——字段数量和内容以实际业务为准（无固定数量），通常包括：单据编号、申请方名称、核心金额/数量、单据来源、创建时间
   - **原因输入区**：同场景一规则（通过原因非必填 / 驳回原因必填）
   - **Footer**：取消 + 审核驳回（danger）+ 审核通过（primary）三个按钮

### 通用规则（两套场景均适用）

| 规则 | 说明 |
|---|---|
| 审核通过原因 | 标签「通过原因」，**非必填**，placeholder="选填" |
| 审核驳回原因 | 标签「驳回原因」，**必填**，placeholder="必填，将同步通知申请方"；空时前端拦截不落库 |
| 字数限制 | 两种原因均 1~200 字符，`show-word-limit` 实时计数 |
| 校验时机 | 点「确定」时统一校验；驳回空原因 → `ElMessage warning` 提示，不关弹窗 |
| 成功反馈 | 通过 → `ElMessage success`；驳回 → `ElMessage warning`；文案含"已同步"字样 |
| prd-data.json | `use_cases.validations` 必须含驳回必填拦截条款；`prompt_messages` 含驳回原因空时提示 |

---

## 8.10 PIN 标注系统（右键触发标注 / v1.1）

> ⚠️ **本章为强制规范**。凡生成带标注层的原型，必须实现 PIN 系统（区别于静态 ℹ️ 图标体系：PIN 系统允许用户**在运行时动态添加/编辑标注**，ℹ️ 体系是**静态内嵌**）。

### 8.10.1 两套标注体系的关系

| 体系 | 触发方式 | 适用场景 | 数据源 |
|---|---|---|---|
| **ℹ️ 内联图标体系**（§8.6）| 标注开关开启后，预定义功能点元素旁自动出现 ⓘ 图标 | AI 已预填 prd-data.json 时展示已知标注 | `window.__PRD_DATA__` 静态嵌入 |
| **PIN 标注系统**（本章）| 右键单击触发（见 §8.10.3）| 用户在浏览器里**动态新增**或**编辑**标注内容 | `pins` reactive 数组（运行时） |

**两套体系共存**，互不冲突。

### 8.10.2 标注模式总开关

```js
// body.anno-mode-on 控制整个标注模式
const annoMode = ref(false);
// 切换时
document.body.classList.toggle('anno-mode-on', annoMode.value);
```

- 开启后：标注开关为蓝色，右键可触发标注气泡
- 关闭后：PIN 图标隐藏，操作流程回归普通原型浏览

### 8.10.3 右键两路径 → 气泡 → 放置 PIN 流程

```
【路径 A：右键命中"点"（按钮/op-icon/状态页签/列标题）】
用户右键单击具体元素
    ↓ 系统识别元素类型（_detectZone）
弹出气泡："是否为 [功能名] 生成 PRD？"
    [确定添加]  [跳过]
    ↓ 点「确定添加」
PIN 放置在元素右侧

【路径 B：右键命中"面"（列表行/区域空白/容器）】
用户右键单击区域空白
    ↓ 进入画框模式（光标变十字，ElMessage 提示）
用户按住左键拖拽框选区域（蓝色虚线框）
    ↓ 松开左键
弹出气泡："是否为 [区域名] 生成 PRD？"
    [确定添加]  [跳过]
    ↓ 点「确定添加」
PIN 放置在框中心
    pin.id = `pin-${Date.now()}-${pinCounter}`
    pin.docX = x + window.scrollX  ← 文档绝对坐标（防滚动漂移）
    pin.docY = y + window.scrollY
    pin.title = 自动识别的功能点名
    pin.fieldSpecs / pin.useCaseRules = genAnnoDraft() 自动生成草稿
    ↓
annoChangelog 记录 { action:'add', pin }
```

**防滚动漂移规则（强制）**：

```js
// PIN 坐标必须存文档绝对坐标
pin.docX = x + window.scrollX;
pin.docY = y + window.scrollY;

// 渲染时用响应式 scroll 偏移还原到视口坐标
// :style="{ left: (pin.docX - pinScrollX) + 'px', top: (pin.docY - pinScrollY) + 'px' }"

// 滚动监听（必须 passive）
window.addEventListener('scroll', () => {
  pinScrollX.value = window.scrollX;
  pinScrollY.value = window.scrollY;
}, { passive: true });
```

❌ 禁止用 `position:fixed` + `vx/vy` 百分比坐标——页面有内容撑高时滚动后 PIN 漂移

### 8.10.4 PIN 弹窗规范

| 维度 | 规范 |
|---|---|
| **触发** | 点击 PIN 图标 |
| **形态** | `el-dialog`，非模态（`:modal="false"`），可拖拽（`draggable`） |
| **尺寸** | `width="720px"`, `top="5vh"` |
| **标题** | `功能点标注 · [功能名]`；**编辑模式下标题改为输入框**（可修改功能点名）|
| **Tab** | 字段规范 / 用例规则（同 §8.2）|
| **模式** | 查看模式（默认）+ 编辑模式（点「编辑」按钮切换）|

**查看 / 编辑模式切换**：

```js
const pinEditMode = ref('view'); // 'view' | 'edit'
const pinEditTitle = ref('');

const enterPinEdit = (pin) => {
  pinEditMode.value = 'edit';
  pinEditTitle.value = pin.title.replace('功能点：', '') || '';
  // 同步复制 fieldSpecs / useCaseRules 到编辑缓存
};

const savePinEdit = (pin) => {
  if (pinEditTitle.value.trim()) pin.title = pinEditTitle.value.trim();
  // 将编辑缓存写回 pin
  pinEditMode.value = 'view';
  annoChangelog.push({ action: 'edit', pin });
};
```

标题区编辑模式实现：
```html
<!-- 查看模式 -->
<div class="pin-modal-title" v-if="pinEditMode==='view'">
  功能点标注 · {{ activePinData.title.replace('功能点：','') }}
</div>
<!-- 编辑模式 -->
<div class="pin-modal-title" v-else style="display:flex;align-items:center;gap:6px">
  功能点标注 ·
  <input v-model="pinEditTitle"
    style="flex:1;border:1px solid #3B7DFF;border-radius:4px;padding:2px 6px;font-size:14px"/>
</div>
```

### 8.10.5 「让AI更新PRD」按钮

- **位置**：顶栏右侧，标注模式开启时可见（或始终可见）
- **触发**：收集 `annoChangelog` 所有变更，序列化后 POST 到 `http://localhost:3799/anno-queue`
- **回退**：本地服务未启动时，自动 fallback → 复制到剪贴板 + 提示用户粘贴给 AI
- **发送后**：清空 `annoChangelog`，提示"已推送 X 条变更"

```js
const pushToAI = async () => {
  const payload = { changes: annoChangelog, timestamp: new Date().toISOString() };
  try {
    await fetch('http://localhost:3799/anno-queue', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    ElMessage.success(`已推送 ${annoChangelog.length} 条变更到 PRD 同步服务`);
  } catch {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    ElMessage.warning('本地服务未启动，变更内容已复制到剪贴板，请粘贴给 AI');
  }
  annoChangelog.splice(0);
};
```

### 8.10.6 用例规则草稿自动生成（genAnnoDraft）

PIN 放置后，系统**自动为功能点生成七节结构草稿**，作为用户编辑的起点：

```
【前置条件】
【操作流程】
【后置条件】
【校验规则】
【提示消息】
【消息通知】
【操作日志】
```

- 草稿内容来源：优先从 `window.__PRD_DATA__.function_points[fp_key]` 读取
- 若 prd-data.json 无对应记录，则按功能点类型套 `annotation-templates.md` 对应模板生成
- 消息通知渲染为 4 列表格（触发场景 / 通知标题 / 消息内容 / 接收方）
- 操作日志渲染为带固定说明 + 格式 + 示例的卡片

### 8.10.7 CSS 悬停高亮规则（anno-mode-on 状态）

```css
body.anno-mode-on .el-button:hover,
body.anno-mode-on .el-tabs__item:hover,
body.anno-mode-on .stab:hover,
body.anno-mode-on .order-link:hover,
body.anno-mode-on .op-icon:hover,
body.anno-mode-on [data-anno-zone]:hover {
  outline: 2px dashed rgba(59,125,255,.7) !important;
  outline-offset: 3px;
  cursor: crosshair !important;
}
```

❌ 禁止在非标注模式下出现虚线边框（`!important` 只在 `body.anno-mode-on` 内生效）

---

## 9. 版本演进

| 版本 | 日期 | 变更点 |
|---|---|---|
| v1.0 | 2026-06-05 | 初版：菜单 + 功能点 + 标注定位三段结构 |
| v1.0.1 | 2026-06-05 | 加 §8 标注层 UI 渲染规范要求（强制条款）：浮动弹窗（非模态+可拖拽+双击关闭）/ 1、2、3、中文编号 / 操作日志 6 行字段表 / 仅 2 Tab / 严格遵守 _rules/ 铁律 |
| v1.0.2 | 2026-06-08 | 加 §8.9 审核弹窗两套范式：场景一（有详情页，审核入口在详情页底部，简单弹窗）/ 场景二（无详情页，弹窗顶部回显核心字段）；通用规则：驳回原因必填 / 通过原因选填 |
| v1.0.3 | 2026-06-10 | 加 §8.6.3 可标注元素类型（`.op-icon` / `.order-link` / `[data-anno-zone]`）；加 §8.10 PIN 标注系统完整规范（悬停气泡 / 放置PIN / 防滚动漂移 docX/docY / 编辑模式 / 「让AI更新PRD」按钮 / genAnnoDraft 七节草稿）；适用所有产品形态 |

未来如加编辑/同步能力，本 schema 加：
- `edit_history`：用户编辑历史
- `sync_status`：与 PRD `.md` 的同步状态
- `field_constraints`：字段级精细约束（用于编辑时的实时校验）
