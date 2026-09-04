# Prototype HTML 输出模板

> **用途**：AI 生成原型时使用此模板作为骨架。所有原型都是**单文件 HTML**，双击浏览器即可打开预览。
> **依赖**：Vue 3 + Element Plus + Tailwind CSS（全部走 CDN，无需安装）。
> **必须配套**：[system-design-spec.md](./system-design-spec.md) 的 token 与组件规范。
>
> 🏛 **v1.0 强制规范遵守声明**：AI 生成原型时必须严格遵守 [prd-data-schema.md §8](./prd-data-schema.md)（标注层 UI + 原型业务流程通用铁律），包括但不限于：
> - **§8.7.0 总原则**：以 prd-data.json 为单一真理源，**禁止脱离数据源凭空写**校验或业务流程
> - **§8.7.1-§8.7.8**：表单校验 / 业务动作真实模拟 / 业务前置校验 / 编号自动生成 / 状态即时反馈 / 4 个关闭路径
> - **§13 研发可直接用**（v1.0 新增）：原型 = 研发生产资产，字段命名对齐后端 / 组件模块化 / 业务逻辑有注释 / CSS 工程化 / API 调用层封装
> - 适用于**任何产品形态**（ERP / WMS / 零售 / SaaS / APP / 教育 / 医疗 / 金融 / IoT 等）和**任何业务对象**
> - 违反任一条款 = 必须删除后按规范重写

---

## 13. 研发可直接用铁律（v1.0 强制 / 生产资产）

> 🏛 **核心**：生成的原型 HTML **不只是给 PM 看的演示**，必须是**研发可直接复制到生产项目的资产**。前端不应该看到原型后还要"重新画一遍"。

### 13.1 五项强制条款

#### 13.1.1 字段命名对齐后端规范

- ❌ 中文字段名 / 随意命名（如 `name`, `data1`）
- ✅ 业务对象前缀 + 驼峰（如 `vipLevelCode`, `vipLevelName`, `customerEmail`, `orderTotalAmount`）
- ✅ 替换 mock 即可对接后端 API

**示例**：
```js
// ❌ 错
const form = reactive({ 等级名称: '', 阈值: 0 });

// ✅ 对
const form = reactive({
  vipLevelCode: '',     // 等级编号
  vipLevelName: '',     // 等级名称
  upgradeThreshold: 0   // 升级阈值
});
```

#### 13.1.2 组件模块化拆分

- ❌ 全部塞在 1 个 HTML 文件里几千行
- ✅ 逻辑组件拆分（虽然原型是单文件，但 JS 内必须按组件组织）：
  - `VipLevelList`（列表组件）
  - `VipLevelForm`（新增/编辑弹窗组件）
  - `VipLevelDetail`（详情弹窗组件）
  - `useVipLevelStore`（状态管理）

**注**：研发拿到原型，按这个结构拆 `.vue` 文件即可。

#### 13.1.3 关键业务逻辑有注释

- ✅ 业务前置 4 类校验必标注释
- ✅ 状态机切换必标注释
- ✅ 双消息发送必标注释
- ✅ 复杂表达式必标注释

**示例**：
```js
// 业务前置校验：删除前查关联会员数（PRD §4.4.x.x 校验规则）
const onDelete = (row) => {
  if (row.memberCount > 0) {
    // 拦截：有关联会员不可删除
    ElMessage.error(`有 ${row.memberCount} 个关联会员，不可删除`);
    return;
  }
  // ... 二次确认 + 软删除
};
```

#### 13.1.4 CSS 工程化

- ❌ 大量 inline style + 魔法数字（`style="color: #3363FF; padding: 13px"`）
- ✅ 用 `<style scoped>` + BEM 命名 + 项目变量

**示例**：
```css
/* ✅ 对 */
.vip-level-list {
  padding: var(--space-md);
}
.vip-level-list__filter {
  display: flex;
  gap: var(--space-sm);
}
.vip-level-list__filter--active {
  background: var(--primary-light);
}
```

#### 13.1.5 API 调用层封装

- ❌ mock data 内联在组件里
- ✅ 抽象到 `src/api/<resource>.ts` 风格的对象

**示例**：
```js
// ===== API 调用层（研发把 mock 替换为真实 fetch 即可对接后端）=====
const vipLevelApi = {
  // 分页查询
  async pageList(query) {
    // 🔧 研发对接：把下面替换为真实 fetch('/api/vip-levels?...', { method: 'GET' })
    return mockPageList(query);
  },
  // 新增
  async create(data) {
    // 🔧 研发对接：fetch('/api/vip-levels', { method: 'POST', body: JSON.stringify(data) })
    return mockCreate(data);
  },
  // 编辑
  async update(id, data) {
    // 🔧 研发对接：fetch(`/api/vip-levels/${id}`, { method: 'PUT', body: JSON.stringify(data) })
    return mockUpdate(id, data);
  },
  // 删除（软删）
  async remove(id) {
    // 🔧 研发对接：fetch(`/api/vip-levels/${id}`, { method: 'DELETE' })
    return mockRemove(id);
  },
  // 状态切换
  async updateStatus(id, status) {
    // 🔧 研发对接：fetch(`/api/vip-levels/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) })
    return mockUpdateStatus(id, status);
  }
};

// ===== 业务组件只调 vipLevelApi.xxx，不直接操作 mockTableData =====
const onSave = async () => {
  await formRef.value.validate();
  await ElMessageBox.confirm('确认提交？');
  await vipLevelApi.create(form);   // ✅ 研发替换底层即可
  ElMessage.success('新增成功');
  fetchList();
};
```

### 13.2 视觉规范来源 3 选 1

拖竞品时 AI **必先问**用哪套（详见 SKILL.md Capture Mode 段）：
- A 默认团队 system-design-spec.md
- B 当次竞品（AI 临时抓视觉 token 应用）
- C 已学过的 learned-specs/X

### 13.3 自检清单（AI 出原型后必跑）

- [ ] 字段命名是驼峰 + 业务前缀？
- [ ] JS 按组件逻辑组织（列表/表单/详情/store）？
- [ ] 业务前置 4 类校验都有注释？
- [ ] CSS 用 scoped + BEM + 项目变量？
- [ ] mock data 抽到 `<resource>Api` 对象，研发可替换？

**任一项不达标 = 必须自我修正后再交付**。

---

## 14. 跨系统原型：系统切换器（方案 A / v1.0）

> 🏛 **触发条件**：`prd-data.json` 中 `systems` 字段不为 `null`（含 2+ 个系统），AI 必须在原型顶部生成**系统切换栏**。

### 14.1 系统切换器骨架

```html
<!-- 系统切换栏（跨系统原型专用，单系统时不加此元素）-->
<div class="system-switcher">
  <span
    v-for="sys in systems"
    :key="sys.key"
    class="system-tab"
    :class="{ active: currentSystem === sys.key }"
    @click="switchSystem(sys.key)"
  >
    {{ sys.label }}
  </span>
  <!-- 跨系统流转提示（仅当前系统有流转节点时显示）-->
  <span v-if="currentFlowTip" class="flow-tip">
    <i class="el-icon-arrow-right"></i> {{ currentFlowTip }}
  </span>
</div>

<style>
.system-switcher {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 16px;
  background: #1F2937;
  border-bottom: 1px solid #374151;
}
.system-tab {
  padding: 4px 16px;
  border-radius: 4px;
  font-size: 13px;
  color: #9CA3AF;
  cursor: pointer;
  transition: background .15s, color .15s;
}
.system-tab:hover  { background: #374151; color: #fff; }
.system-tab.active { background: var(--primary); color: #fff; }
.flow-tip {
  margin-left: auto;
  font-size: 12px;
  color: #F2AC3A;
}
</style>
```

### 14.2 Vue 逻辑骨架

```js
// 跨系统切换逻辑（放在 setup() 顶部）
const systems = [
  { key: 'OMS', label: 'OMS · 订单管理' },
  { key: 'WMS', label: 'WMS · 仓储管理' },
];
const currentSystem = ref('OMS');

// 各系统的"流转到对方"提示文字（由 prd-data.json 的跨系统标注驱动）
const flowTips = {
  OMS: '调拨单提交后 → 流转至 WMS 待审核',
  WMS: '审核通过后 → 通知 OMS 库存调整',
};
const currentFlowTip = computed(() => flowTips[currentSystem.value] || '');

const switchSystem = (sysKey) => {
  currentSystem.value = sysKey;
  // 切换系统时同步切换侧边菜单和主内容区
  // 用 v-show="currentSystem === 'OMS'" 控制各系统菜单显示
};
```

### 14.3 菜单/内容区切换方式

```html
<!-- OMS 侧边菜单 -->
<el-aside v-show="currentSystem === 'OMS'" class="sidebar">
  <!-- OMS 的菜单（从 prd-data.json systems=OMS 的 menus 渲染）-->
</el-aside>

<!-- WMS 侧边菜单 -->
<el-aside v-show="currentSystem === 'WMS'" class="sidebar">
  <!-- WMS 的菜单（从 prd-data.json systems=WMS 的 menus 渲染）-->
</el-aside>

<!-- 主内容区同理，用 v-show 切换 -->
```

### 14.4 跨系统流转标注规则

- 业务流转触发点（如"提交审核"按钮）必须加标注层 ℹ️
- 标注内容格式：`→ 流转至 [WMS · 待审核列表]，状态变更为"待审核"`
- 流转提示颜色：`#F2AC3A`（warning 黄，区分普通业务标注）

### 14.5 适用场景示例

| 业务场景 | 系统 A | 系统 B |
|---|---|---|
| 调拨管理 | OMS 创建调拨单 / 提交 | WMS 审核 / 出库 |
| 采购协同 | 采购系统 发起采购 | WMS 收货 / 入库 |
| 退货处理 | OMS 客户发起退货 | WMS 验货 / 退库 |
| 配送调度 | OMS 订单派单 | TMS 路线规划 / 派送 |

### 14.6 页签联动（page-tabs 显示当前打开页面 / v1.0 强制）

> 🏛 **铁律**：页面标识用页签，不用面包屑 / 顶部标题块（见 [§15.1 要点 9](#151-表单页范式三列网格--label-顶部)）。打开子页面（表单 / 详情）→ **新增并高亮对应页签**；返回 / 关闭 / 切系统 → 移除临时页签、回到列表页签。

```js
/* 页签：列表为常驻页签，表单/详情为临时子页签 */
const openTabs = ref([
  { key:'recharge', label:'充值管理', page:'recharge-list' },
  { key:'balance',  label:'账户余额', page:'balance' },
]);
const activeTabKey = ref('recharge');
/* 打开子页面：新增/激活页签 + 切 page（页签反映当前实际页面）*/
const openSubTab = (key, label, pg) => {
  const ex = openTabs.value.find(t => t.key === key);
  if (ex) ex.label = label; else openTabs.value.push({ key, label, page: pg });
  activeTabKey.value = key; page.value = pg;
};
/* 清理临时子页签，回列表页签 */
const dropSubTabs = () => {
  openTabs.value = openTabs.value.filter(t => !['recharge-form','recharge-detail'].includes(t.key));
};
const openForm   = (row) => { /* ...assign fd... */ openSubTab('recharge-form', row?'编辑':'新增', 'recharge-form'); };
const openDetail = (row) => { dr.value=row; openSubTab('recharge-detail', '详情', 'recharge-detail'); };
const goList     = ()    => { page.value='recharge-list'; dropSubTabs(); activeTabKey.value='recharge'; };
const switchSys  = (s)   => { sys.value=s; page.value='recharge-list'; dropSubTabs(); activeTabKey.value='recharge'; };
```

### 14.7 双系统数据联动（共享数据源 / 单据流双向同步 / v1.0 强制）

> 🏛 **铁律**：跨系统原型必须**共用同一份响应式数据源**（如 `const records = ref([...])`），**任一系统的增 / 删 / 改 / 审核，另一系统切过去即时可见**——真实模拟单据流双向状态变更，禁止两系统各存各的 mock。

**要点**：
1. **单一数据源**：`records` 定义在 `createApp` 外或顶层，两系统视图共用
2. **视图按角色过滤，不复制数据**：如 OMS（货主端）`records.filter(r => r.ownerName === 当前货主)`；WMS（仓库端）看全部
3. **操作直接改源数据**：创建 `records.unshift(...)`、审核 `item.status = '已审核'`、删除 `records.splice(...)`
4. **切换系统不重置数据**：`switchSys` 只改 `sys` / `page` / 页签，**不动 `records`**
5. **闭环可演示**：OMS 创建（待审核）→ 切 WMS 看到 → WMS 审核通过 → 切回 OMS 看到「已审核」+ 余额同步
6. ⚠️ 前端 mock 无持久化，**刷新页面回到初始数据**——演示足够，持久化属开发阶段
7. （可选增强）详情页加「单据流转时间线」：创建 → 提交 → 审核 → 生效，带操作人 / 系统 / 时间

```js
/* ✅ 正确：单一数据源 + 视图过滤 */
const records = ref([ /* 所有单据，含 ownerName / source / status */ ]);
const baseList = computed(() => sys.value === 'OMS'
  ? records.value.filter(r => r.ownerName === '当前货主')   // 货主端只看自己
  : records.value);                                          // 仓库端看全部
const doAudit = (id, result) => {                            // 审核直接改源数据 → 双系统同步
  const it = records.value.find(r => r.id === id);
  if (it) { it.status = result==='approved' ? '已审核' : '已驳回'; it.auditTime = nowStr(); }
};
/* ❌ 错误：OMS 一份 mock、WMS 另一份 mock → 操作不联动 */
```

---

## 15. 默认设计规范范式（v1.0 / 表单·列表·图标三套）

> 🏛 **触发**：§13.2 视觉规范来源**选 A（默认团队规范）**时 → 本节是表单 / 列表 / 图标的**权威组件范式**，直接套用。
> 🏛 **让位**：用户**拖了竞品（选 B）**或**指定 learned-specs（选 C）**→ **以用户参考为最高优先级**，本节不强制（仅作缺失补全的兜底）。
> 本节是"视觉 / 交互范式"，与 §3 列表骨架、§4 弹窗骨架**并存互补**：§3/§4 给结构，本节定默认的排版与交互。

### 15.1 表单页范式（三列网格 + label 顶部）

**要点清单（默认即套用）**：
1. **信息密集表单 → 三列网格**，不要单列竖排
2. **label 在字段上方**（`label-position="top"`），不用左侧对齐
3. **长文本字段（备注 / 描述）全宽** + `maxlength` + `show-word-limit` 字数统计
4. **附件 = 「点击上传」文字链接 + 下方灰字说明**（格式 / 大小 / 数量），不用图片卡片 ➕ 号
5. **底部 sticky 操作栏**：按钮居中，文案统一 **「取消 / 提交」**
6. **无强制流程顺序的多步骤 → 合并为单块「基本信息」**，不滥用"第一步 / 第二步"
7. **必填红 `*` 在 label 右侧**（`require-asterisk-position="right"`），不放左侧
8. **所有字段引导（placeholder）左对齐**；⚠️ `el-input-number` 默认内容居中，**必须强制左对齐**（见 CSS）
9. **页面标识统一用页签（page-tabs）显示当前实际打开的功能页面**——打开子页面（如"充值"表单 / "详情"）时**新增并高亮对应页签**；**不用面包屑、不用顶部"← 标题"大标题块**。返回 / 关闭时移除该临时页签、回到列表页签（见 §14 页签联动写法）
10. **字段校验双触发**（强制）：**失焦**（`blur` / `select` 用 `change`）即时在字段下方报错；**提交**时 `formRef.validate()` 全量校验，不通过则所有错误字段同时显示。**选填项若有约束（格式 / 长度）也要校验**，仅"空值"放行

```css
/* 表单三列网格（label 在上方）*/
.fm-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:2px 28px; }
.fm-grid .el-form-item { margin-bottom:20px; }
.fm-grid .el-form-item__label { font-size:13px; color:var(--text-2); padding-bottom:6px !important; }
.fm-full { grid-column:1 / -1; }                 /* 长文本字段全宽 */
.upload-tip { font-size:12px; color:var(--text-3); line-height:1.6; margin-top:2px; }
/* el-input-number 默认内容居中 → 强制左对齐（要点 8）*/
.el-input-number .el-input__inner { text-align:left; }
/* 底部操作栏（sticky，居中）*/
.form-footer {
  position:sticky; bottom:0; z-index:10;
  background:var(--bg-card); border-top:1px solid var(--border);
  padding:14px 20px; margin:16px -20px 0;
  display:flex; justify-content:center; gap:12px;
  box-shadow:0 -2px 8px rgba(0,0,0,.04);
}
```

```html
<!-- 页面标识交给页签（page-tabs，见 §14 页签联动），不用面包屑/顶部"← 标题"块 -->
<div class="form-sec">
  <div class="form-sec-title">基本信息</div>
  <!-- ref + :rules + require-asterisk-position（要点 7/10）-->
  <el-form ref="formRef" :model="fd" :rules="formRules" label-position="top" require-asterisk-position="right">
    <div class="fm-grid">
      <el-form-item label="<字段1>" prop="x">
        <el-select v-model="fd.x" placeholder="请选择" style="width:100%">...</el-select>
      </el-form-item>
      <el-form-item label="<字段2>" prop="y">
        <el-input v-model="fd.y" placeholder="请输入" style="width:100%"/>
      </el-form-item>
      <!-- 附件：点击上传文字链接 + 说明 -->
      <el-form-item label="上传附件" prop="file">
        <div style="width:100%">
          <el-upload action="#" :auto-upload="false" :limit="1" :show-file-list="true">
            <el-button type="primary" link>点击上传</el-button>
          </el-upload>
          <div class="upload-tip">支持 JPG、JPEG、PNG、BMP、PDF 格式，单个文件不超过 5M，最多 1 个</div>
        </div>
      </el-form-item>
      <!-- 长文本：全宽 + 字数统计 -->
      <el-form-item label="备注" prop="remark" class="fm-full">
        <el-input type="textarea" v-model="fd.remark" :rows="4" maxlength="200" show-word-limit
          placeholder="请输入备注（选填）" style="width:100%"/>
      </el-form-item>
    </div>
  </el-form>
</div>
<!-- 底部操作栏 -->
<div class="form-footer">
  <el-button @click="goList">取消</el-button>
  <el-button type="primary" @click="submitForm">提交</el-button>
</div>
```

**校验规则与提交（要点 10 / setup 内）**：

```js
const formRef = ref(null);
const formRules = {
  // 必填：select 用 change，input/number 用 blur
  x:      [{ required:true, message:'请选择<字段1>', trigger:'change' }],
  y:      [{ required:true, message:'请输入<字段2>', trigger:'blur' }],
  amount: [{ required:true, message:'请输入金额',     trigger:'blur' }],
  // 选填但有约束：不加 required，空值自动放行，有值才校验格式
  txNo:   [{ pattern:/^[A-Za-z0-9\-]{4,32}$/, message:'4-32 位字母 / 数字 / 横线', trigger:'blur' }],
};
// 打开表单时清除上次残留错误
const openForm = (row) => { /* ...赋值 fd... */ setTimeout(() => formRef.value && formRef.value.clearValidate(), 0); };
// 提交：全量校验通过才落库
const submitForm = () => {
  if (!formRef.value) return;
  formRef.value.validate((valid) => {
    if (!valid) { ElMessage.warning('请检查表单：存在未填写或不符合规则的字段'); return; }
    doSubmit();   // 真实修改 mock 数据，见 §4 强制要求
  });
};
```

### 15.2 列表页范式（筛选卡片 + 列表卡片 + 操作图标）

**要点清单**：
1. **筛选区 = 独立卡片**（白底 + 边框 + 圆角，多行网格），与列表分离。**所有筛选字段统一等宽**：用同一套 `repeat(4,minmax(0,1fr))` 网格，每个下拉 / 输入框占 1 列、宽度一致；**不要把下拉拉成整行超宽**，也不要把日期 / 单号另起一套不同列宽的网格。日期区间（daterange）占 2 列；带前置标签的字段用 `.ff`（标签左 + 控件占满 `.ff .el-input/.el-date-editor{flex:1}`）
2. **状态 Tabs + 工具栏 + 表格 + 分页 = 连体列表卡片**（Tabs 顶部圆角，向下无缝接表格）
3. **操作列 = 图标按钮 + hover 黑色气泡 tooltip**，不用文字平铺
4. **列表字段全平铺**，不靠隐藏 / 挤压列
5. 状态 Tabs 用 `全部 (7)` 行内括号计数格式
6. **同类多值字段聚合成一列**（多行 label+value），不要平铺成多列。常见：
   - **人员**列 = 创建 / 审核（人）——值是**系统登录账号**，不是公司名 / 客户名
   - **时间**列 = 创建 / 审核（时间）
   - **label 统一两字**（「创建」「审核」），不写"审核人""审核时间"等长 label
   - 节点按状态出现：待审核仅"创建"，已审核 / 已驳回再加"审核"行
7. **列表克制用色**：除单据号 / 可点击链接用**深蓝加粗**（`#1E40AF` + `font-weight:600`，比 `#1D4ED8` 更醒目）外，**其余一律默认文本色**——金额不用蓝 / 绿强调、状态不用彩色点、单据来源不用彩色标签（强调色、状态色、标签色都留给详情页）
8. **页面内不重复流程引导**：流程引导条（flow-tip / flow-bar）若顶部系统栏已有一处，**页面内容区不再放第二条**，避免与顶部重复
9. **金额列正负显示（财务 / 资金流水类列表特例）**：金额字段按方向区分——**增加（入账 / 收入 / 充值 / 退款）= 红色 `#F5222D` + 加粗 + `+` 前缀**（如 `+1,000.0000`）；**减少（扣款 / 扣费）= 默认文本色，自带 `-` 号**。这是要点 7「克制用色」的**明确特例**：资金流水 / 账单 / 流水明细等财务列表需靠红色高亮"进账"。注意 **账户余额 / 账户总余额列不加 `+` 号**（余额是状态值不是变动值），仅作蓝色链接展示。**金额前加币种前缀**：金额 / 余额数字前显示币种（如 `CNY +1,000.0000`、`USD -450.00`），币种用 `.amt-cur`（中性灰、不随金额变红、字号略小）；币种值**按行取**（`row.currency`，多币种列表才对得上），不要写死 CNY
10. **筛选控件范式（三种）**：
    - **单选下拉**：默认占位用**字段自身名称**或 `全部XX`，**不要用泛泛的「请选择」**——「可不选/默认全部」语义的字段用 `全部XX`（如全部仓库 / 全部币种）；其余字段直接用字段名作占位（如占位「费用类型」，下拉项才是 扣款 / 入款）。`clearable`。
    - **多选下拉 + 默认全选（自定义弹层）**：当某维度希望默认覆盖所有取值、用户再做减法时（如流水类型、业务类型），用**自定义多选弹层**（`multi-filter` 组件），而非 `el-select multiple` 的即时多选。弹层结构（自上而下）：① 顶部**搜索框**（🔍 请输入，实时过滤选项）；② **「全选」**复选项（勾选 = 全选 / 取消 = 清空）；③ 复选选项列表；④ 底部 **取消 / 确认** 按钮。交互要点：**暂存确认**——打开时把当前值拷进 `temp`，勾选只改 `temp`，点「确认」才 `emit` 回写、点「取消」丢弃；触发器单行高度（24px，同 small 控件），label 显示占位（全选/空时）或 `占位 (n)`。`v-model` 初值 = 全部选项数组；过滤逻辑 `if (arr.length) list = list.filter(r => arr.includes(r.x))`（空数组视为不限）。
    - **字段聚合查询**：同一类、成对/多个的字段（**单号类**：费用单号 / 业务单号 / 账单号 / 运单号…；**人员类**：创建人 / 审核人；**时间类**：创建时间 / 审核时间）**不平铺成多个控件**，合并为「**字段下拉**（选哪个字段）+ 值控件（输入框 / 日期区间）」，字段下拉默认第一个字段；过滤时按所选字段 key 动态匹配（`r[fieldKeyMap[sel]].includes(val)`，时间类则比较所选时间字段是否落在区间内）。该聚合单元用 `.ff` + `grid-column:span 2`，字段下拉统一 `el-select size="small" style="width:120px;flex:none"`、值控件 `flex:1`。
    - **客户 / 货主等"主体"筛选**：列表是多主体（如 WMS 看全部客户）时，主体筛选统一用上面的**多选弹层 `multi-filter`**（占位「全部客户」、默认全选），充值管理 / 账户余额 / 资金流水等同模块保持一致；单主体视图（如 OMS 只看自己）则不放筛选，改为在页顶直接显示「客户名称：XXX」标明当前主体。
11. **筛选项与列表数据自洽**：mock / 演示数据必须**完整覆盖每个筛选下拉的所有选项值**，且**按角色过滤后的子集也要覆盖**——例如 OMS 只看自己（单客户）的列表，该客户的数据也要能命中全部费用类型 / 流水类型 / 业务类型选项，否则用户切筛选会出现"选了却没数据"的空结果，演示不可信。
12. **筛选下拉内容 = 列表字段值（强制，动态生成）**：凡是"枚举型字段"的筛选下拉（仓库 / 客户 / 币种 / 状态 / 类型…），其**选项必须从列表数据动态去重生成**，与列表里实际出现的值**严格一致**——列表里有几个仓库 / 几个客户 / 几种币种（CNY/USD/BRL…），下拉就只列这几个；**禁止手写一份和数据对不上的固定选项**。实现：`const xOpts = [...new Set(listData.map(r => r.x))]`，下拉 `<el-option v-for="o in xOpts" .../>` 或 `<multi-filter :options="xOpts">`。多主体维度（仓库 / 客户）用多选弹层 `multi-filter`（默认全选），少量枚举（币种 / 状态）用单选 `el-select`，但**选项来源都走 `xOpts`**。这样新增一条数据带出新值时，筛选项自动跟着出现，不会遗漏。

```css
/* 列表聚合单元格（人员 / 时间：多行 label+value）*/
.cell-multi { display:flex; flex-direction:column; gap:3px; font-size:12px; line-height:1.5; }
.cell-multi .cm-lbl { color:var(--text-3); }
/* 单据号 / 链接：深蓝加粗（醒目）*/
.order-link { color:#1E40AF; font-weight:600; cursor:pointer; }
.order-link:hover { text-decoration:underline; }
/* 金额列：增加（入账 / 收入）红色 + "+" 号；减少默认色自带 "-" */
.amt-plus { color:#F5222D; font-weight:600; }
/* 金额前币种前缀：中性色，不随金额变红 */
.amt-cur { color:var(--text-3); font-weight:400; font-size:12px; }
```

```js
// 金额格式化：正数加 "+"，负数自带 "-"；余额列用 fmtNum（不加 "+"）
const fmtSigned = (n) => (n>0?'+':'') + Number(n).toLocaleString('zh-CN',{minimumFractionDigits:4});
const fmtNum    = (n) => Number(n).toLocaleString('zh-CN',{minimumFractionDigits:4});
```

```html
<!-- 金额列：币种前缀 + 正数标红加 "+"；账户余额列不加 "+"，蓝色链接 -->
<td><span :class="{ 'amt-plus': row.amount>0 }"><span class="amt-cur">{{ row.currency || 'CNY' }}</span> {{ fmtSigned(row.amount) }}</span></td>
<td><a class="order-link"><span class="amt-cur">{{ row.currency || 'CNY' }}</span> {{ fmtNum(row.balance) }}</a></td>

<!-- 人员列：创建 + 审核（label 统一两字，按状态动态出现）-->
<td>
  <div class="cell-multi">
    <div><span class="cm-lbl">创建：</span>{{ creatorOf(row) }}</div>
    <div v-if="['已审核','已驳回'].includes(row.status)"><span class="cm-lbl">审核：</span>{{ auditorOf(row) }}</div>
  </div>
</td>
<!-- 时间列：创建 + 审核 -->
<td>
  <div class="cell-multi">
    <div><span class="cm-lbl">创建：</span>{{ row.createTime }}</div>
    <div v-if="['已审核','已驳回'].includes(row.status)"><span class="cm-lbl">审核：</span>{{ row.auditTime }}</div>
  </div>
</td>
```

```css
/* 筛选区：独立卡片 */
.filter-wrap { background:var(--bg-card); border:1px solid var(--border);
  border-radius:6px; padding:16px 16px 12px; margin-bottom:10px; }
/* 筛选字段统一等宽网格：所有下拉 / 输入框同宽，daterange 占 2 列 */
.filter-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; margin-bottom:12px; align-items:center; }
/* 只铺满网格直接子元素；.ff 内控件交给 flex，避免 width:100% 与 flex 冲突导致输入框塌缩不占满 */
.filter-grid > .el-select, .filter-grid > .el-input { width:100%; }
/* 带前置标签 / 字段选择器的聚合单元：左侧固定、右侧值控件 flex 占满 */
.ff { display:flex; align-items:center; gap:8px; min-width:0; }
.ff-label { font-size:13px; color:var(--text-2); white-space:nowrap; }
.ff > .el-date-editor, .ff > .el-input { flex:1; min-width:0; width:auto; }
.filter-actions { display:flex; gap:8px; padding-top:2px; }
/* 状态 Tabs：列表卡片顶部 */
.stabs { display:flex; background:var(--bg-card); border:1px solid var(--border);
  border-radius:6px 6px 0 0; padding:0 16px; }
.stab { padding:0 20px; height:40px; line-height:40px; font-size:14px; cursor:pointer; color:#303133; }
/* 激活 tab：灰底蓝字（实测 示例 WMS/OMS 2026-06-10，不是蓝底白字）*/
.stab.active { color:var(--primary); font-weight:500; background:#F2F2F2; border-radius:4px 4px 0 0; }
/* 列表卡片主体（接 stabs 下方，无顶边框）*/
.table-card { background:var(--bg-card); border:1px solid var(--border);
  border-top:none; border-radius:0 0 6px 6px; overflow-x:auto; }
.table-toolbar { display:flex; align-items:center; gap:10px; padding:10px 16px; border-bottom:1px solid var(--border); }
/* 操作列图标 + hover 气泡 tooltip */
.op-cell { display:flex; gap:6px; align-items:center; }
/* op-icon 颜色：实测 示例 WMS 统一用 rgba(51,99,255,0.8)，不区分蓝/红/橙 */
.op-icon { position:relative; display:inline-flex; align-items:center; justify-content:center;
  width:26px; height:26px; border-radius:4px; cursor:pointer;
  color:rgba(51,99,255,0.8); transition:all .15s; }
.op-icon svg { width:18px; height:18px; display:block; }
.op-icon:hover { color:#3363FF; background:rgba(51,99,255,0.08); }
/* 危险操作 hover 才变红，默认态仍为主色80% */
.op-icon.danger:hover { color:#F56C6C; background:rgba(245,108,108,0.08); }
.op-icon.warn   { color:var(--warning); } .op-icon.warn:hover  { background:#FFFBE6; }
.op-icon::after { content:attr(data-tip); position:absolute; bottom:calc(100% + 8px); left:50%;
  transform:translateX(-50%); background:#303133; color:#fff; font-size:12px; line-height:1;
  padding:7px 10px; border-radius:4px; white-space:nowrap; opacity:0; visibility:hidden;
  transition:opacity .15s; pointer-events:none; z-index:50; }
.op-icon::before { content:''; position:absolute; bottom:calc(100% + 2px); left:50%; transform:translateX(-50%);
  border:6px solid transparent; border-top-color:#303133; opacity:0; visibility:hidden; transition:opacity .15s; z-index:50; }
.op-icon:hover::after, .op-icon:hover::before { opacity:1; visibility:visible; }
```

```js
// 筛选控件范式（要点 10）：选项字典 + 多选默认全选 + 单号聚合
const flowTypeOpts = ['业务费用','费用补收','费用回退','充值','账单扣费'];
const bizTypeOpts  = ['一件代发入库','一件代发出库','B2B入库','B2B出库','一件代发退货入库','工单','仓租账单'];
const noFieldOpts  = ['费用单号','业务单号','账单号'];
const noFieldKey   = { '费用单号':'feeNo','业务单号':'bizNo','账单号':'billNo' };
const fFeeType  = ref('');                  // 单选，默认请选择
const fFlowType = ref([...flowTypeOpts]);   // 多选，默认全选
const fBizType  = ref([...bizTypeOpts]);    // 多选，默认全选
const fNoField  = ref('费用单号'), fNoVal = ref('');  // 单号聚合
// 过滤：多选空数组=不限；单号按所选字段动态匹配
if (fFeeType.value)         list = list.filter(r => r.feeType === fFeeType.value);
if (fFlowType.value.length) list = list.filter(r => fFlowType.value.includes(r.flowType));
if (fBizType.value.length)  list = list.filter(r => fBizType.value.includes(r.bizType));
if (fNoVal.value)           list = list.filter(r => (r[noFieldKey[fNoField.value]]||'').includes(fNoVal.value));
```
```html
<!-- 多选默认全选：自定义弹层（搜索 + 全选 + 取消/确认），用法见下方 multi-filter 组件 -->
<!-- ⚠ 自定义组件在「DOM 内模板」中禁止自闭合，必须写显式闭合标签，否则后续同级元素会被吞成其子内容 -->
<multi-filter v-model="fFlowType" :options="flowTypeOpts" placeholder="全部流水类型"></multi-filter>
<multi-filter v-model="fBizType"  :options="bizTypeOpts"  placeholder="全部业务类型"></multi-filter>
<!-- 单号聚合查询：字段下拉 + 输入框（.ff 占 2 列）-->
<div class="ff" style="grid-column:span 2">
  <el-select v-model="fNoField" size="small" style="width:120px;flex:none">
    <el-option v-for="o in noFieldOpts" :key="o" :label="o" :value="o"/>
  </el-select>
  <el-input v-model="fNoVal" placeholder="请输入" size="small" clearable/>
</div>
```

可复用的 `multi-filter` 组件（注册到 app：`.component('multi-filter', {...})`）：
```js
{
  props: { modelValue:{type:Array,default:()=>[]}, options:{type:Array,default:()=>[]}, placeholder:{type:String,default:''} },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const open=ref(false), keyword=ref(''), temp=ref([]);
    const filteredOpts = computed(() => props.options.filter(o => o.includes(keyword.value)));
    const allChecked   = computed(() => props.options.length>0 && temp.value.length===props.options.length);
    const displayLabel = computed(() => { const n=props.modelValue.length; return (n===0||n===props.options.length)?props.placeholder:props.placeholder+' ('+n+')'; });
    const toggle=()=>{ if(!open.value){ temp.value=[...props.modelValue]; keyword.value=''; } open.value=!open.value; };
    const toggleItem=(o)=>{ const i=temp.value.indexOf(o); if(i>=0)temp.value.splice(i,1); else temp.value.push(o); };
    const toggleAll=()=>{ temp.value=allChecked.value?[]:[...props.options]; };
    const cancel=()=>{ open.value=false; };
    const confirm=()=>{ emit('update:modelValue',[...temp.value]); open.value=false; };
    return { open,keyword,temp,filteredOpts,allChecked,displayLabel,toggle,toggleItem,toggleAll,cancel,confirm };
  },
  template: `
    <div class="mf">
      <div class="mf-trigger" :class="{active:open}" @click="toggle">
        <span class="mf-text">{{ displayLabel }}</span><span class="mf-arrow" :class="{up:open}">▾</span>
      </div>
      <template v-if="open">
        <div class="mf-mask" @click="cancel"></div>
        <div class="mf-panel">
          <div class="mf-search"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#909399" stroke-width="2"><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><input v-model="keyword" placeholder="请输入"/></div>
          <div class="mf-list">
            <label class="mf-item"><input type="checkbox" :checked="allChecked" @change="toggleAll"/><span>全选</span></label>
            <label class="mf-item" v-for="o in filteredOpts" :key="o"><input type="checkbox" :checked="temp.includes(o)" @change="toggleItem(o)"/><span>{{ o }}</span></label>
            <div v-if="!filteredOpts.length" class="mf-empty">无匹配项</div>
          </div>
          <div class="mf-footer"><button class="mf-btn" @click="cancel">取消</button><button class="mf-btn primary" @click="confirm">确认</button></div>
        </div>
      </template>
    </div>`
}
```
```css
.mf { position:relative; width:100%; }
.mf-trigger { display:flex; align-items:center; justify-content:space-between; gap:6px; height:24px; padding:0 8px; border:1px solid #DCDFE6; border-radius:4px; background:#fff; font-size:13px; cursor:pointer; box-sizing:border-box; }
.mf-trigger.active { border-color:var(--primary); }
.mf-text { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:var(--text-2); }
.mf-arrow { color:#A8ABB2; font-size:12px; transition:transform .2s; flex:none; }
.mf-arrow.up { transform:rotate(180deg); }
.mf-mask { position:fixed; inset:0; z-index:2000; }
.mf-panel { position:absolute; top:calc(100% + 4px); left:0; z-index:2001; width:260px; max-width:92vw; background:#fff; border:1px solid var(--border); border-radius:6px; box-shadow:0 6px 20px rgba(0,0,0,.12); padding:12px; }
.mf-search { display:flex; align-items:center; gap:8px; border-bottom:1px solid var(--primary); padding:4px 2px 8px; margin-bottom:6px; }
.mf-search input { flex:1; border:none; outline:none; font-size:14px; background:transparent; }
.mf-list { max-height:300px; overflow-y:auto; }
.mf-item { display:flex; align-items:center; gap:10px; padding:9px 2px; font-size:14px; color:var(--text-1); cursor:pointer; }
.mf-item input { width:16px; height:16px; cursor:pointer; flex:none; }
.mf-footer { display:flex; justify-content:flex-end; gap:10px; padding-top:10px; }
.mf-btn { height:30px; padding:0 16px; border:1px solid #DCDFE6; border-radius:4px; background:#fff; font-size:13px; cursor:pointer; }
.mf-btn.primary { border-color:var(--primary); color:var(--primary); }
.mf-btn.primary:hover { background:var(--primary); color:#fff; }
```

### 15.3 图标范式（内联 SVG / 语义映射）

> 🏛 **图标一律内联 SVG（lucide 描边风格），不依赖图标字体 / 组件库图标**——离线可用、100% 渲染。

**操作图标语义标准映射**（默认即套用）：

| 操作 | 图标 | 颜色 class |
|---|---|---|
| 查看 | 眼睛 eye | `op-icon`（蓝）|
| 编辑 | 铅笔 pencil | `op-icon`（蓝）|
| 删除 | 垃圾桶 trash | `op-icon danger`（红）|
| 审核 / 通过 | 对勾圆圈 check-circle | `op-icon warn`（橙）|

```js
/* 内联 SVG 图标（lucide 风格，离线可用）— 放进 setup() 并 return */
const ICON = {
  view:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>',
  edit:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  del:   '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
  audit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
};
```

```html
<!-- 操作列：图标 + data-tip（hover 气泡）-->
<div class="op-cell">
  <span class="op-icon"        data-tip="查看" @click="handleBtn('view',row)"   v-html="ICON.view"></span>
  <span class="op-icon warn"   data-tip="审核" @click="handleBtn('audit',row)"  v-html="ICON.audit"></span>
  <span class="op-icon"        data-tip="编辑" @click="handleBtn('edit',row)"   v-html="ICON.edit"></span>
  <span class="op-icon danger" data-tip="删除" @click="handleBtn('delete',row)" v-html="ICON.del"></span>
</div>
```

### 15.4 技术踩坑铁律（必守 / 否则白底空白·表头叠影）

| 坑 | 现象 | 铁律 |
|---|---|---|
| **`<el-icon>` + 注册图标组件** | 部分图标白底空白、不渲染 | 操作图标**一律内联 SVG**（§15.3），不用 `<el-icon><View/></el-icon>` |
| **`el-table` 多列 / 条件列** | 列渲染成**双行多级表头**、`v-if` 切列不重渲 | 复杂表格（多列 / 跨系统条件列）**优先原生 `<table class="pt">`** |
| **`el-table` fixed 列** | 左右固定列产生**叠影 / 内容堆叠** | 列不多时**去掉 fixed**，配 `min-width` + 容器 `overflow-x:auto` |
| **`el-tooltip` 加宽** | 长说明文案被默认 `white-space:nowrap` 截成一行溢出 | 需换行加宽**必须用双类选择器** `popper-class="th-tip-wide"` + `.th-tip-wide.el-popper { max-width:320px !important; white-space:normal !important; word-break:break-word; }`（单类优先级压不过 EP 默认，详见 [system-design-spec §7.3](./system-design-spec.md)）|
| **组件自闭合**（DOM 内模板，**含 `el-table-column` / `el-option` / 所有 `el-*` / 自定义组件**） | `<comp/>` 后面的**同级标签被吞成它的子节点**。典型表现：① **`el-table` 列错位**——写死的多列里凡是自闭合 `<el-table-column .../>` 的列，会把后续列吞成子节点 → `colgroup` 只生成部分 col、**表头列竖向堆叠（表头高度异常如 200px）、自闭合列被拉成超宽（如 400px）、只有带 `<template>` 显式闭合的列正常**（2026-06-22 EP 解耦 demo 实测根因；`doLayout()` 修不好，改显式闭合后 7 列恢复）；② **多选项下拉只剩最后/第二个选项**（`<el-option/>` 连写两个 → 第一个被吞）；③ 某区块后续元素整片消失 | 凡是「挂载到 DOM 元素的模板」（非 .vue 编译模板），**所有组件标签必须显式闭合**：`<el-table-column ...></el-table-column>`、`<el-option ...></el-option>`、`<multi-filter ...></multi-filter>`，**禁止 `<comp/>` 自闭合**。⚠ **例外**：用 `v-for` 的**单个** `<el-option v-for=.. />` / `<el-table-column v-for=.. />` 自闭合可用（模板里只有一个标签、无同级被吞，Vue 运行时再展开），所以"写死多个 el-table-column / el-option"时尤其要加闭合标签。排查"表格列错位 / 表头竖排"先查是不是自闭合 |
| **`setup()` 的 `return {}` 漏暴露**（模板引用的 ref / computed / 方法没写进 return） | 模板里用到的响应式变量（如 `notifRows`）没写进 `setup()` 的 `return {}` → 渲染时模板访问 `notifRows.length` 报错（`Cannot read properties of undefined`）→ **整个组件崩溃 → 页面 / 弹窗点不开、白屏** | **凡是在 `<template>` 里被引用的 ref / computed / 方法，必须无一遗漏地出现在 `setup()` 的 `return {}` 中**。新增模板里用到的响应式变量后，**第一件事就是回到 `return {}` 把它加进去**。⚠ **自查方法**：grep 模板里出现的每个变量名（`{{ xxx }}`、`v-if/v-for/v-model="xxx"`、`@click="xxx"`），逐个确认都能在 `return { ... }` 块里找到；找不到的立即补上 |
| **HTML 注释吞掉脚本块**（装饰性注释带 `{`/`=`/括号且跨越 `<script>` 边界） | 用 `<!-- ════ window.__PRD_DATA__ = { ════ -->` 这类带括号 / 等号 / `{` 的装饰性注释开头，注释里出现 `{` 后，若注释未正确闭合或注释体跨越了 `<script>` 边界，会把**整段 PRD 数据 + 后面的 Vue 主脚本一起吞成注释** → Vue 无法初始化 → 页面全乱码 / 空白 | **HTML 注释 `<!-- -->` 绝不能跨越 `<script>` 标签或 PRD 数据块**。装饰性分隔注释要**独立成行、写在 `<script>` 标签之外、`<!--` 与 `-->` 成对自我闭合完整**；`window.__PRD_DATA__` 数据块前后的注释**必须与 `<script>` 标签分行书写，注释不进脚本体内部**。⚠ **自查方法**：检查每个 `<!--` 都有对应 `-->` 在同一行 / 紧邻闭合，且 `<script>` 与 `</script>` 之间不夹任何 `<!-- -->`（脚本体内注释一律用 `//` 或 `/* */`） |

```css
/* 原生表格范式（替代复杂 el-table）— 实测 示例 WMS/OMS 2026-06-10 */
.pt { width:100%; border-collapse:collapse; table-layout:auto; }
.pt th { background:#F7F8FA; color:#999999; font-weight:600; font-size:13px; padding:8px 12px;
  text-align:left; border-bottom:1px solid #EBEEF5; white-space:nowrap; }
/* ⚠️ 行字号 12px（实测，非默认 14px）*/
.pt td { padding:8px 12px; border-bottom:1px solid #EBEEF5; white-space:nowrap;
  color:#444444; font-size:12px; vertical-align:middle; }
.pt tbody tr:hover td { background:#F4F7FF; }
.pt tbody tr:nth-child(even) td { background:#FAFBFC; }
.pt-empty { text-align:center; color:var(--text-3); padding:40px 0 !important; }
```

### 15.5 详情 / 查看页范式（按"是否有状态"分两种）

**要点清单**：
1. **有状态的单据**（有状态流转，如待审核 / 已审核 / 入库中 / 已完成）→ **顶部状态进度卡片**：左侧「单据号 + 状态」，右侧「步骤进度条」（`el-steps`，每步带操作人 / 时间）
2. **无状态的记录**（无流转，如客户 / 商品基础信息）→ **不加进度卡片**，直接展示字段
3. **字段一律用只读网格**（`.ro-grid` 三列，label 在上 value 在下），**不要用表格 / 双列单元格**（`detail-grid` 已弃用）
4. 底部 `form-footer`：**返回** + 条件操作按钮（如审核 / 编辑重提，按权限矩阵显示）
5. 状态进度条的"步数"由**该单据当前状态动态生成**——只展示已走到的节点，不预渲染未发生的步骤。例：
   - 充值单：**待审核 = 创建** ｜ **已审核 = 创建 → 审核** ｜ **已驳回 = 创建 → 驳回**（驳回节点标红 error）
   - 入库单：创建 → 提交 → 发货 → 签收 → 收货 → 上架（按实际进展逐节点点亮）

```css
/* 状态进度卡片（有状态单据）*/
.status-card { display:flex; background:var(--bg-card); border:1px solid var(--border);
  border-radius:6px; margin-bottom:16px; overflow:hidden; }
.sc-left { width:320px; flex-shrink:0; padding:28px 32px; border-right:1px solid var(--border);
  display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; }
.sc-no-lbl { font-size:13px; color:var(--text-3); }
.sc-no { font-size:18px; font-weight:700; color:var(--text-1); font-family:'Courier New',monospace; }
.sc-status { display:flex; align-items:center; gap:6px; font-size:15px; margin-top:6px; }
.sc-steps { flex:1; padding:30px 28px; display:flex; align-items:center; --el-color-primary:#409EFF; } /* 进度条左对齐 + 亮蓝线条 */
.sc-steps .el-steps { width:100%; }
/* 只读字段网格（label 上 value 下，三列，非表格）*/
.ro-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px 28px; }
.ro-item { display:flex; flex-direction:column; gap:8px; }
.ro-full { grid-column:1 / -1; }
.ro-lbl { font-size:13px; color:var(--text-3); }
.ro-val { font-size:14px; color:var(--text-1); word-break:break-all; }
```

```html
<!-- A. 有状态：状态进度卡片 -->
<div class="status-card">
  <div class="sc-left">
    <div class="sc-no-lbl">单据号</div>
    <div class="sc-no">{{ dr.orderNo }}</div>
    <div class="sc-status"><span class="dot" :class="dotCls(dr.status)"></span>{{ dr.status }}</div>
  </div>
  <div class="sc-steps">
    <!-- 步骤按状态动态生成（v-for），不预渲染未发生的节点；左对齐 + :space 固定间距（不铺满拉伸）-->
    <el-steps :active="detailActive" :space="200" :process-status="dr.status==='已驳回' ? 'error' : 'process'">
      <el-step v-for="(st,i) in detailSteps" :key="i" :title="st.title" :description="st.desc || '--'"/>
    </el-steps>
  </div>
</div>

<!-- 字段：只读三列网格（A 有状态 / B 无状态 都用这个，不用表格）-->
<div class="form-sec">
  <div class="form-sec-title">基本信息</div>
  <div class="ro-grid">
    <div class="ro-item"><div class="ro-lbl">字段A</div><div class="ro-val">{{ dr.a }}</div></div>
    <div class="ro-item"><div class="ro-lbl">字段B</div><div class="ro-val">{{ dr.b }}</div></div>
    <div class="ro-item ro-full"><div class="ro-lbl">备注</div><div class="ro-val">{{ dr.remark || '--' }}</div></div>
  </div>
</div>

<div class="form-footer">
  <el-button @click="goList">返回</el-button>
  <el-button v-if="canAudit" type="warning" @click="openAudit(dr)">审核</el-button>
</div>
```

```js
/* 步骤进度：按状态动态生成节点（el-steps 是 Element Plus 组件，全局已注册，无需单独引）*/
const detailSteps = computed(() => {
  const s = dr.value.status;
  const base = [{ title:'创建', desc: dr.value.createTime }];
  if (s === '已审核')      base.push({ title:'审核', desc: dr.value.auditTime || '--' });
  else if (s === '已驳回') base.push({ title:'驳回', desc: dr.value.auditTime || '--' });
  return base;  // 待审核 → 仅"创建"
});
const detailActive = computed(() => dr.value.status === '已驳回' ? 1 : detailSteps.value.length);
```

> 🏛 **无状态记录**（客户 / 商品等）：**省略 `.status-card`**，直接 `form-sec + .ro-grid` 展示字段即可。

---

## 1. 标准 HTML 骨架（必备 CDN + 主色覆盖）

```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{ 原型标题 }}</title>

  <!-- Vue 3（unpkg.com 国内实测可达，固定版本避免 minor 升级破坏）-->
  <script src="https://unpkg.com/vue@3.4.21/dist/vue.global.prod.js"></script>

  <!-- Element Plus（必须用 .full.min.js 全量打包版，含全局 ElementPlus 变量）-->
  <link rel="stylesheet" href="https://unpkg.com/element-plus@2.4.4/dist/index.css" />
  <script src="https://unpkg.com/element-plus@2.4.4/dist/index.full.min.js"></script>
  <script src="https://unpkg.com/@element-plus/icons-vue@2.3.1/dist/index.iife.min.js"></script>

  <!-- Tailwind CSS -->
  <script src="https://cdn.tailwindcss.com"></script>

  <!-- ⚠️ CDN 注意事项（AI 生成原型时必读）：
       1. **必须用 unpkg.com**（国内实测唯一稳定可达）
          ❌ jsdelivr.net 在国内网络下大概率超时
          ❌ npm.elemecdn.com / lib.baomitu.com / cdn.staticfile.org 都不稳定
          ✅ unpkg.com 是唯一实测稳定
       2. Element Plus 必须用 `dist/index.full.min.js`（含全局 ElementPlus 变量），
          不能用 `https://unpkg.com/element-plus`（默认指向 package.json，浏览器无法执行）
       3. Icons 必须用 `dist/index.iife.min.js`（暴露 ElementPlusIconsVue 全局变量）
       4. 所有 CDN 链接必须含明确版本号（不要用 @latest 或省略版本）
       5. **必须加 CDN 健康检测**（见下方 <script>），失败时给用户明确提示
  -->

  <!-- CDN 健康检测：3 秒内 Vue / ElementPlus 未就绪则报错提示用户 -->
  <script>
    window.addEventListener('load', () => {
      setTimeout(() => {
        if (typeof Vue === 'undefined') {
          document.body.innerHTML = '<div style="padding:40px;color:#F56C6C;font-size:16px;font-family:sans-serif;"><h2>❌ Vue 未加载</h2><p>请检查网络是否能访问 <code>unpkg.com</code>。</p></div>';
        } else if (typeof ElementPlus === 'undefined') {
          document.body.innerHTML = '<div style="padding:40px;color:#F56C6C;font-size:16px;font-family:sans-serif;"><h2>❌ Element Plus 未加载</h2><p>请检查网络是否能访问 <code>unpkg.com/element-plus</code>。</p></div>';
        }
      }, 3000);
    });
  </script>

  <!-- Inter Font -->
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />

  <style>
    /* === Design Tokens（来自 system-design-spec.md）=== */
    :root {
      --primary:           #3363FF;
      --primary-hover:     #3363FFCC;
      --primary-active:    #1E4BDD;
      --primary-disabled:  #3363FF66;
      --primary-bg:        #3363FF1A;

      --success:           #67C23A;
      --danger:            #F56C6C;
      --warning:           #F2AC3A;

      --text-primary:      #333333;
      --text-secondary:    #666666;
      --text-tertiary:     #909399;
      --text-quaternary:   #A8ABB2;
      --text-placeholder:  #DCDFE6;

      --bg:                #F7F7F7;
      --bg-card:           #FFFFFF;
      --bg-hover:          #F5F7FA;
      --bg-nav:            #1F2937;
    }

    body {
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: var(--bg);
      color: var(--text-primary);
      margin: 0;
    }

    /* === Element Plus 主色覆盖（核心）=== */
    .el-button--primary {
      --el-color-primary: var(--primary);
      --el-color-primary-light-3: var(--primary-hover);
      --el-color-primary-dark-2: var(--primary-active);
    }
    .el-link.el-link--primary {
      --el-link-text-color: var(--primary);
    }
    .el-pagination.is-background .el-pager li.is-active {
      background-color: var(--primary);
    }

    /* === 已选 Checkbox / Radio 文字也变蓝（团队特色，覆盖 EP 默认）=== */
    .el-checkbox.is-checked .el-checkbox__label,
    .el-radio.is-checked .el-radio__label {
      color: var(--primary);
    }

    /* === 顶部导航栏 === */
    .top-nav {
      background: var(--bg-nav);
      color: #fff;
      height: 56px;
      display: flex;
      align-items: center;
      padding: 0 16px;
      gap: 16px;
    }
    .top-nav .nav-item {
      padding: 0 12px;
      height: 100%;
      display: flex;
      align-items: center;
      cursor: pointer;
      color: #fff;
      font-size: 14px;
    }
    .top-nav .nav-item.active {
      background: var(--primary);
    }
    .top-nav .nav-item:hover:not(.active) {
      background: rgba(255,255,255,0.08);
    }
  </style>
</head>
<body>
  <div id="app">
    <!-- 原型内容 -->
  </div>

  <script>
    // Vue 解构（按需补充 watch / nextTick / onUnmounted 等）
    const { createApp, ref, reactive, computed, onMounted, watch, nextTick } = Vue;

    // 🔥 关键：ElementPlus 的常用 API 必须显式解构
    // 仅 app.use(ElementPlus) 不够 —— 它只注册全局组件 + 指令，
    // 不会让 ElMessage / ElMessageBox 等在 setup 作用域可访问
    // 不解构 → setup 里调用 ElMessage.success() 会 ReferenceError → 所有按钮静默崩溃
    const { ElMessage, ElMessageBox, ElNotification, ElLoading } = ElementPlus;

    const app = createApp({
      setup() {
        // 数据 / 方法
        return {};
      }
    });

    // 注册 Element Plus 全局组件 + 指令
    app.use(ElementPlus);

    // 注册全部 Element Plus 图标
    for (const [key, comp] of Object.entries(ElementPlusIconsVue)) {
      app.component(key, comp);
    }

    app.mount('#app');
  </script>
</body>
</html>
```

---

## 2. 主框架（顶部导航 + 内容区）

```html
<el-container class="min-h-screen">
  <!-- 顶部导航 -->
  <el-header class="top-nav" style="height: 56px;">
    <div class="text-lg font-medium mr-6" style="font-weight: 500;">示例 WMS</div>
    <div class="nav-item">Página Inicial</div>
    <div class="nav-item">Cliente</div>
    <div class="nav-item">Produto</div>
    <div class="nav-item">Entrada no Depósito</div>
    <div class="nav-item">Saídas</div>
    <div class="nav-item active">Estoque</div>
    <div class="nav-item">Logística</div>
    <div class="nav-item">Pós-venda</div>
    <div class="nav-item">Financeiro</div>
    <div class="nav-item">Dados</div>
    <div class="nav-item">Configurações</div>
    <div class="nav-item">Mensagens</div>
    <div class="ml-auto flex items-center gap-3">
      <span class="cursor-pointer">PT v</span>
      <el-icon><QuestionFilled /></el-icon>
      <el-avatar :size="32">U</el-avatar>
    </div>
  </el-header>

  <!-- 内容区 -->
  <el-main style="padding: 24px;">
    {{ 列表/弹窗/表单等 }}
  </el-main>
</el-container>
```

---

## 3. 列表页骨架（最常见）

> 🏛 **默认排版 / 交互以 [§15.2 列表页范式](#152-列表页范式筛选卡片--列表卡片--操作图标) 为准**：筛选独立卡片、操作列图标 + tooltip、复杂表格用原生 `<table>`（见 [§15.4](#154-技术踩坑铁律必守--否则白底空白表头叠影)）。本节为结构示例骨架，视觉与操作列写法按 §15 升级。

```html
<!-- 1. 状态 Tab（可选）-->
<el-tabs v-model="status" type="border-card" class="mb-4">
  <el-tab-pane name="all">
    <template #label>Todos <span style="color: var(--text-tertiary);">({{ counts.all }})</span></template>
  </el-tab-pane>
  <el-tab-pane name="active">
    <template #label>Ativo <span style="color: var(--text-tertiary);">({{ counts.active }})</span></template>
  </el-tab-pane>
</el-tabs>

<!-- 2. 筛选区 -->
<el-card class="mb-4" shadow="never">
  <el-form :model="filters" :inline="true">
    <el-form-item label="Número">
      <el-input v-model="filters.numero" placeholder="Por favor, insira" clearable />
    </el-form-item>
    <el-form-item label="Status">
      <el-select v-model="filters.status" placeholder="Selecione" clearable style="width: 180px;">
        <el-option label="Ativo" value="active"></el-option>
        <el-option label="Inativo" value="inactive"></el-option>
      </el-select>
    </el-form-item>
    <el-form-item>
      <el-button type="primary" @click="onSearch">Consultar</el-button>
      <el-button @click="onReset">Reprovisão</el-button>
    </el-form-item>
  </el-form>
</el-card>

<!-- 3. 操作区 -->
<div class="flex items-center mb-3">
  <el-button type="primary" :icon="Plus" @click="onCreate">Nova</el-button>
  <el-button :icon="Delete" @click="onBatchDelete" :disabled="selectedRows.length === 0">Excluir</el-button>
  <el-button type="primary" link :icon="Download" class="ml-auto" @click="onExport">Exportação</el-button>
</div>

<!-- 4. 表格 -->
<el-table :data="tableData" stripe border @selection-change="onSelectionChange" v-loading="loading">
  <el-table-column type="selection" width="55" fixed="left"></el-table-column>
  <el-table-column prop="numero" label="Número" width="180"></el-table-column>
  <el-table-column prop="nome" label="Nome" min-width="200" show-overflow-tooltip></el-table-column>
  <el-table-column prop="status" label="Status" width="120">
    <template #default="{ row }">
      <el-tag :type="row.status === 'active' ? 'success' : 'info'">
        {{ row.status === 'active' ? 'Ativo' : 'Inativo' }}
      </el-tag>
    </template>
  </el-table-column>
  <el-table-column prop="amount" label="Valor" width="140" align="right" header-align="right">
    <template #default="{ row }">R$ {{ row.amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 }) }}</template>
  </el-table-column>
  <el-table-column prop="createdAt" label="Tempo de criação" width="180" align="right" header-align="right"></el-table-column>
  <el-table-column label="Operação" width="200" fixed="right">
    <template #default="{ row }">
      <el-button type="primary" link :icon="Edit" @click="onEdit(row)" />
      <el-button type="primary" link :icon="DocumentCopy" @click="onCopy(row)" />
      <el-button type="primary" link :icon="Delete" @click="onDelete(row)" />
    </template>
  </el-table-column>
  <template #empty>
    <el-empty :image-size="180" description="Não há dados" />
  </template>
</el-table>

<!-- 5. 分页（底部右对齐）-->
<el-pagination
  v-model:current-page="page"
  v-model:page-size="pageSize"
  :page-sizes="[10, 25, 50, 100]"
  :total="total"
  layout="total, sizes, prev, pager, next, jumper"
  background
  class="mt-4"
  style="justify-content: flex-end;"
/>
```

---

## 4. 新增/编辑弹窗骨架（v1.0 规范：真实校验 + 真实业务流程）

> 🏛 **页面级表单的默认排版以 [§15.1 表单页范式](#151-表单页范式三列网格--label-顶部) 为准**：三列网格 + label 顶部、长文本全宽 + 字数、附件「点击上传」、底部 sticky「取消 / 提交」。本节弹窗骨架用于轻量表单；字段多的表单走 §15.1 页面式。

> ⚠️ **强制要求**（详见 [prd-data-schema.md §8.7](./prd-data-schema.md)）：
> - 每个 `<el-form-item>` 必须 `prop="..."` 绑定字段
> - `<el-form>` 必须 `:rules="formRules"`
> - 失焦触发：`trigger: 'blur'` → 离开字段立即字段下方显示错误
> - 提交触发：`formRef.value.validate()` → 所有错误字段同时显示
> - 校验通过后必须**真实修改 mockTableData**（不只弹 Toast）

```html
<el-dialog
  v-model="dialogVisible"
  :title="isEdit ? '编辑' : '新增'"
  width="500px"
  :close-on-click-modal="false"
  @close="onDialogClose"
>
  <el-form
    ref="formRef"
    :model="form"
    :rules="formRules"
    label-position="top"
  >
    <el-form-item label="名称" prop="name">
      <el-input v-model="form.name" placeholder="请输入" maxlength="30" show-word-limit />
    </el-form-item>

    <el-form-item label="Moeda" prop="moeda">
      <el-select v-model="form.moeda" placeholder="Selecione" style="width: 100%;">
        <el-option label="CNY" value="CNY"></el-option>
        <el-option label="BRL" value="BRL"></el-option>
      </el-select>
    </el-form-item>

    <el-form-item label="Data de início" prop="startDate">
      <el-date-picker
        v-model="form.startDate"
        type="date"
        format="DD/MM/YYYY"
        value-format="YYYY-MM-DD"
        placeholder="Selecione data"
        style="width: 100%;"
      />
    </el-form-item>
  </el-form>

  <template #footer>
    <el-button @click="dialogVisible = false">cancelamentos</el-button>
    <el-button type="primary" @click="onSubmit">Confirmar</el-button>
  </template>
</el-dialog>
```

**对话尺寸标准**：
- 简单弹窗（1-3 字段）：`width="500px"`
- 中型弹窗（含 4 区块或多 Tab）：`width="700px"`
- 大型弹窗（含表格选择）：`width="900px"`

---

## 5. 详情/查看页骨架（带 Tab + Descriptions）

```html
<el-card>
  <template #header>
    <div class="flex items-center justify-between">
      <h2 style="font-size: 18px; font-weight: 500; margin: 0;">{{ data.nome }}</h2>
      <div>
        <el-button :icon="Edit" @click="onEdit">Editar</el-button>
        <el-button :icon="Back" @click="onBack">Voltar</el-button>
      </div>
    </div>
  </template>

  <el-tabs v-model="activeTab">
    <el-tab-pane label="Informações básicas" name="basic">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="Número">{{ data.numero }}</el-descriptions-item>
        <el-descriptions-item label="Nome">{{ data.nome }}</el-descriptions-item>
        <el-descriptions-item label="Status">
          <el-tag :type="data.status === 'active' ? 'success' : 'info'">
            {{ data.status === 'active' ? 'Ativo' : 'Inativo' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="Criador">{{ data.criador }}</el-descriptions-item>
        <el-descriptions-item label="Tempo de criação" :span="2">
          {{ formatDate(data.createdAt) }}  <!-- DD/MM/YYYY HH:mm:ss -->
        </el-descriptions-item>
      </el-descriptions>
    </el-tab-pane>

    <el-tab-pane label="Logs de operação" name="logs">
      <el-table :data="logs" stripe>
        <el-table-column prop="time" label="Tempo" width="180"></el-table-column>
        <el-table-column prop="account" label="Conta" width="120"></el-table-column>
        <el-table-column prop="action" label="Ação" width="120"></el-table-column>
        <el-table-column prop="detail" label="Detalhes"></el-table-column>
      </el-table>
    </el-tab-pane>
  </el-tabs>
</el-card>
```

---

## 6. 二次确认 MessageBox（删除/启用/停用 等危险动作）

```javascript
// 警告类（删除/停用）
const onDelete = async (row) => {
  try {
    await ElMessageBox.confirm(
      'Confirma a exclusão deste item?',
      'Excluir',
      {
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'cancelamentos',
        type: 'warning',
      }
    );
    // 执行删除
    ElMessage.success('Excluído com sucesso');
  } catch {
    // 用户取消
  }
};

// 信息确认类（发货/提交）
const onShip = async (row) => {
  try {
    await ElMessageBox.confirm(
      'Confirma o envio deste pedido?',
      'Enviar',
      {
        confirmButtonText: 'Confirmar',
        cancelButtonText: 'cancelamentos',
        type: 'info',
      }
    );
    ElMessage.success('Enviado com sucesso');
  } catch {}
};
```

---

## 7. Toast Message（操作反馈）

```javascript
ElMessage.success('Salvo com sucesso');
ElMessage.error('Falha na operação');
ElMessage.warning('Atenção: dados incompletos');
ElMessage.info('Carregando dados...');
```

---

## 8. 巴西本地化工具函数

```javascript
// 日期格式化：YYYY-MM-DD HH:mm:ss → DD/MM/YYYY HH:mm:ss
const formatDate = (isoString) => {
  if (!isoString) return '';
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

// 金额格式化：1234.56 → R$ 1.234,56
const formatBRL = (amount) => {
  if (amount == null) return '';
  return 'R$ ' + amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

// 千分位（无币种）：1234567 → 1.234.567
const formatNumber = (n) => n.toLocaleString('pt-BR');
```

---

## 9. 示例数据（Mock）

每个原型都要包含示例数据，让用户在浏览器里能直接看到效果：

```javascript
const tableData = ref([
  {
    id: 1,
    numero: 'SPU0000001234',
    nome: 'Bebida Refrigerante 330ml',
    status: 'active',
    amount: 12.50,
    createdAt: '2026-04-13 10:30:45',
  },
  {
    id: 2,
    numero: 'SPU0000001235',
    nome: 'Leite Integral 1L',
    status: 'inactive',
    amount: 8.90,
    createdAt: '2026-04-14 11:20:30',
  },
  // 至少 5-10 行示例数据，让原型"有内容感"
]);
```

---

## 10. 完整页面示例（拼装好的）

把 1~9 节拼起来即可生成一个完整原型。AI 生成时按用户需求选取部分组合即可。

---

## 11. 标注层（v1.0 新增）

> 📐 **数据契约**：本章节实现遵守 [prd-data-schema.md](./prd-data-schema.md) v1.0
> 🎨 **模板库**：9 大标准功能模板见 [annotation-templates.md](./annotation-templates.md)

每个原型 HTML 默认**带标注层**——每个功能点旁有 `ℹ️` 图标，点击弹出右侧抽屉显示该功能点的字段规范 + 用例规则。顶栏含**总开关**可一键开/关所有标注。

### 11.1 嵌入 prd-data.json

在 `<head>` 标签内、所有 `<script>` 之后加：

```html
<!-- PRD-DATA：原型与 PRD 共享的数据源 -->
<script>
  window.__PRD_DATA__ = {
    "version": "1.0",
    "schema_version": "prd-data-schema.md@v1.0",
    "generated_at": "{{ ISO 8601 时间戳 }}",
    "deployment_locale": "{{ CN / BR / US }}",
    "prd_meta": {
      "title": "{{ 原型/PRD 标题 }}",
      "system_view": "{{ 系统视图 }}",
      "prd_version": "v1.0",
      "source_prd_md": "{{ 对应 PRD .md 路径 }}"
    },
    "menus": { /* 见 schema §2 */ },
    "function_points": { /* 见 schema §3 */ },
    "annotations": [ /* 见 schema §4 */ ]
  };
</script>
```

### 11.2 标注层 CSS（追加到 `<style>` 段末尾）

```css
/* === 标注层（v1.0 新增）=== */
.annotation-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  margin-left: 6px;
  border-radius: 50%;
  background: var(--primary-bg);
  color: var(--primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  vertical-align: middle;
  user-select: none;
}
.annotation-icon:hover {
  background: var(--primary);
  color: #fff;
  transform: scale(1.1);
}

/* 总开关关闭时隐藏所有 ℹ️ 图标 */
body.annotations-hidden .annotation-icon {
  display: none !important;
}

/* 抽屉内字段规范表 */
.anno-drawer-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.anno-drawer-table th,
.anno-drawer-table td {
  padding: 8px 12px;
  border: 1px solid #ebeef5;
  text-align: left;
  vertical-align: top;
}
.anno-drawer-table th {
  background: var(--bg-hover);
  color: var(--text-secondary);
  font-weight: 600;
  white-space: nowrap;
}
.anno-drawer-section {
  margin-bottom: 16px;
}
.anno-drawer-section-title {
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
  padding-left: 8px;
  border-left: 3px solid var(--primary);
}
.anno-uc-block {
  background: var(--bg-hover);
  padding: 10px 12px;
  border-radius: 4px;
  margin-bottom: 10px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-primary);
}
.anno-uc-block ol {
  margin: 4px 0 0 0;
  padding-left: 20px;
}
/* PRD 风格中文编号：1、2、3、（覆盖前置/流程/后置/校验四段）*/
.anno-step {
  margin-bottom: 6px;
  line-height: 1.8;
  padding-left: 0;
}
.anno-step:last-child {
  margin-bottom: 0;
}
.anno-step-num {
  color: var(--primary);
  font-weight: 600;
  margin-right: 4px;
  display: inline-block;
  min-width: 1.6em;
}
```

### 11.3 顶栏总开关（嵌入到 `top-nav` 右侧）

```html
<!-- 顶栏右侧加在 PT 切换之前 -->
<div class="ml-auto flex items-center gap-3">
  <!-- 标注总开关（v1.0 新增）-->
  <div class="flex items-center gap-2 px-3 py-1 rounded"
       style="background: rgba(255,255,255,0.08);">
    <span style="font-size: 12px;">ℹ️ 标注</span>
    <el-switch
      v-model="showAnnotations"
      size="small"
      @change="onToggleAnnotations"
      style="--el-switch-on-color: var(--primary);"
    />
  </div>

  <span class="cursor-pointer">PT v</span>
  <el-icon><QuestionFilled /></el-icon>
  <el-avatar :size="32">U</el-avatar>
</div>
```

### 11.4 ℹ️ 图标的 DOM 约定

需要标注的功能点元素，**必须**加 `data-annotation="<fp_key>"` 属性，**且**在元素旁插入 `<span class="annotation-icon">ℹ️</span>`：

```html
<!-- 按钮加标注示例 -->
<el-button
  type="primary"
  :icon="Plus"
  data-annotation="商品管理.商品库.新增-无规格"
  @click="onCreate"
>新增-无规格</el-button>
<span class="annotation-icon"
      data-anno-target="商品管理.商品库.新增-无规格"
      @click="openAnnotationDrawer('商品管理.商品库.新增-无规格')"
>i</span>

<!-- 表格列加标注示例（操作列）-->
<el-table-column label="Operação" width="200" fixed="right">
  <template #header>
    <span>Operação</span>
    <span class="annotation-icon"
          data-anno-target="商品管理.商品库.查询"
          @click="openAnnotationDrawer('商品管理.商品库.查询')"
    >i</span>
  </template>
  <template #default="{ row }">
    <el-button type="primary" link :icon="View" @click="onView(row)"
               data-annotation="商品管理.商品库.查看" />
    <el-button type="primary" link :icon="Edit" @click="onEdit(row)"
               data-annotation="商品管理.商品库.编辑" />
  </template>
</el-table-column>
```

### 11.5 标注浮动窗口模板（放在主框架末尾）

> ⚠️ **核心设计要求**（用户明确偏好）：
> 1. ✅ **非模态弹窗**（`:modal="false"`）—— 不挡原型，**用户可同时操作原型与查看标注**
> 2. ✅ **可拖拽**（`draggable`）—— 用户可拖到屏幕一侧不挡视线
> 3. ✅ **双击标题栏关闭** —— 不需要找关闭按钮，双击即关
> 4. ❌ **禁用 `<el-drawer>` 侧边抽屉** —— 体验差，用户已明确反对
> 5. ❌ **禁用模态遮罩** —— 模态会阻塞原型操作

```html
<!-- 标注浮动窗口（点 ℹ️ 弹出，非模态可拖拽双击关闭）-->
<el-dialog
  v-model="annotationDrawerVisible"
  :title="currentFp ? `${currentFp.fp_name}（${currentFp.menu_key}） — 双击标题栏关闭` : '标注详情'"
  width="720px"
  top="5vh"
  :modal="false"
  draggable
  :close-on-click-modal="false"
  :close-on-press-escape="true"
  destroy-on-close
  class="annotation-dialog"
  @opened="bindHeaderDblclick"
>
  <div v-if="currentFp">
    <!-- Tab 切换 -->
    <el-tabs v-model="annoActiveTab" type="border-card">

      <!-- Tab 1: 字段规范（v1.0 规范：field_specs 为字符串时整个 Tab 完全不显示）-->
      <el-tab-pane label="字段规范" name="fields"
                   v-if="currentFp.field_specs && typeof currentFp.field_specs !== 'string'">
        <div v-for="group in currentFp.field_specs.groups"
             :key="group.group_name"
             class="anno-drawer-section">
          <div class="anno-drawer-section-title">{{ group.group_name }}</div>
          <table class="anno-drawer-table">
            <thead>
              <tr>
                <th>字段名称</th>
                <th>类型</th>
                <th>是否必填</th>
                <th>默认值</th>
                <th>约束规则</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="field in group.fields" :key="field.name">
                <td><strong>{{ field.name }}</strong></td>
                <td>{{ field.type }}</td>
                <td>{{ field.required }}</td>
                <td>{{ field.default }}</td>
                <td>{{ field.constraint }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </el-tab-pane>

      <!-- Tab 2: 用例规则 -->
      <el-tab-pane label="用例规则" name="usecases">
        <div class="anno-drawer-section">
          <div class="anno-drawer-section-title">前置条件</div>
          <div class="anno-uc-block">
            <template v-if="Array.isArray(currentFp.use_cases.preconditions)">
              <div v-for="(p, i) in currentFp.use_cases.preconditions" :key="i" class="anno-step">
                <span class="anno-step-num">{{ i + 1 }}、</span>{{ p }}
              </div>
            </template>
            <div v-else>{{ currentFp.use_cases.preconditions }}</div>
          </div>
        </div>

        <div class="anno-drawer-section">
          <div class="anno-drawer-section-title">操作流程</div>
          <div class="anno-uc-block">
            <div v-for="(step, i) in currentFp.use_cases.operation_flow" :key="i" class="anno-step">
              <span class="anno-step-num">{{ i + 1 }}、</span>{{ step }}
            </div>
          </div>
        </div>

        <div class="anno-drawer-section">
          <div class="anno-drawer-section-title">后置条件</div>
          <div class="anno-uc-block">
            <template v-if="Array.isArray(currentFp.use_cases.postconditions)">
              <div v-for="(p, i) in currentFp.use_cases.postconditions" :key="i" class="anno-step">
                <span class="anno-step-num">{{ i + 1 }}、</span>{{ p }}
              </div>
            </template>
            <div v-else>{{ currentFp.use_cases.postconditions }}</div>
          </div>
        </div>

        <div class="anno-drawer-section">
          <div class="anno-drawer-section-title">校验规则</div>
          <div class="anno-uc-block">
            <template v-if="Array.isArray(currentFp.use_cases.validations)">
              <div v-for="(v, i) in currentFp.use_cases.validations" :key="i" class="anno-step">
                <span class="anno-step-num">{{ i + 1 }}、</span>{{ v }}
              </div>
            </template>
            <div v-else>{{ currentFp.use_cases.validations }}</div>
          </div>
        </div>

        <div class="anno-drawer-section">
          <div class="anno-drawer-section-title">提示消息</div>
          <div class="anno-uc-block">
            <div v-if="currentFp.use_cases.prompt_messages === '无。'">无。</div>
            <table v-else class="anno-drawer-table">
              <thead>
                <tr>
                  <th>字段名称</th>
                  <th>未填写/未选择提示</th>
                  <th>输入错误提示</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="msg in currentFp.use_cases.prompt_messages" :key="msg.field">
                  <td>{{ msg.field }}</td>
                  <td>{{ msg.empty_prompt }}</td>
                  <td>{{ msg.error_prompt }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="anno-drawer-section">
          <div class="anno-drawer-section-title">消息通知</div>
          <div class="anno-uc-block">
            <div v-if="currentFp.use_cases.message_notifications === '无。'">无。</div>
            <div v-else-if="currentFp.use_cases.message_notifications.type === '双消息'">
              <div style="margin-bottom: 10px;">
                <strong>消息 1：操作人确认</strong><br>
                接收人：{{ currentFp.use_cases.message_notifications.message_1_operator.recipient }}<br>
                内容：{{ currentFp.use_cases.message_notifications.message_1_operator.content }}<br>
                渠道：{{ currentFp.use_cases.message_notifications.message_1_operator.channel }}
              </div>
              <div>
                <strong>消息 2：受影响方通知</strong><br>
                接收人：{{ currentFp.use_cases.message_notifications.message_2_target.recipient }}<br>
                内容：{{ currentFp.use_cases.message_notifications.message_2_target.content }}<br>
                渠道：{{ currentFp.use_cases.message_notifications.message_2_target.channel }}
              </div>
            </div>
          </div>
        </div>

        <!-- 操作日志：严格按 PRD 铁律 §4.7.1 — 固定说明语 + 6 行字段表（行序锁定）-->
        <div class="anno-drawer-section">
          <div class="anno-drawer-section-title">操作日志</div>
          <div class="anno-uc-block">
            <!-- 查询/查看 等不输出操作日志的情况 -->
            <div v-if="typeof currentFp.use_cases.operation_log === 'string'">{{ currentFp.use_cases.operation_log }}</div>
            <!-- 6 行字段表（行序固定：操作时间→操作账号→操作模块→操作功能→操作明细→IP地址）-->
            <div v-else>
              <div style="margin-bottom: 12px;">{{ currentFp.use_cases.operation_log.fixed_intro }}</div>
              <table class="anno-drawer-table">
                <thead>
                  <tr>
                    <th>字段</th>
                    <th>字段说明</th>
                    <th>规则/示例</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>操作时间</strong></td>
                    <td>本次操作发生的时间</td>
                    <td>YYYY-MM-DD HH:mm:ss<br>如 2026-06-05 20:30:00</td>
                  </tr>
                  <tr>
                    <td><strong>操作账号</strong></td>
                    <td>执行操作的登录账号</td>
                    <td>当前登录账号<br>如 admin@example.com</td>
                  </tr>
                  <tr>
                    <td><strong>操作模块</strong></td>
                    <td>操作所属的完整菜单路径</td>
                    <td>{{ getMenuPath() }}</td>
                  </tr>
                  <tr>
                    <td><strong>操作功能</strong></td>
                    <td>本次操作的具体功能点</td>
                    <td>{{ currentFp.fp_name }}</td>
                  </tr>
                  <tr>
                    <td><strong>操作明细</strong></td>
                    <td>本次操作的详细信息</td>
                    <td>
                      <div>格式：<code>{{ currentFp.use_cases.operation_log.detail_format }}</code></div>
                      <div style="margin-top: 4px;">示例：<code>{{ currentFp.use_cases.operation_log.detail_example }}</code></div>
                    </td>
                  </tr>
                  <tr>
                    <td><strong>IP地址</strong></td>
                    <td>操作用户的客户端 IP</td>
                    <td>用户 IP 地址<br>如 192.168.1.1</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </el-tab-pane>

    </el-tabs>
  </div>
</el-dialog>
```

### 11.5.1 配套 CSS（追加到 §11.2 末尾）

```css
/* 标注浮动窗口：非模态时浮在原型上方 */
.annotation-dialog {
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  border-radius: 8px;
  overflow: hidden;
}
.annotation-dialog .el-dialog__header {
  cursor: move;
  background: var(--bg-hover);
  padding: 12px 20px;
  margin: 0;
  border-bottom: 1px solid #e4e7ed;
  user-select: none;
}
.annotation-dialog .el-dialog__title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}
.annotation-dialog .el-dialog__body {
  max-height: 70vh;
  overflow-y: auto;
  padding: 16px 20px;
}
.annotation-dialog .el-tabs--border-card {
  box-shadow: none;
  border: 1px solid #e4e7ed;
}
```

### 11.5.2 配套 JS：双击标题栏关闭（追加到 §11.6 setup 内）

```js
// 浮动窗口标题栏双击关闭
const bindHeaderDblclick = () => {
  setTimeout(() => {
    const header = document.querySelector('.annotation-dialog .el-dialog__header');
    if (header && !header.dataset.dblBound) {
      header.dataset.dblBound = '1';
      header.addEventListener('dblclick', () => {
        annotationDrawerVisible.value = false;
      });
      header.title = '可拖拽移动 / 双击关闭';
    }
  }, 50);
};

// 暴露到 return
return {
  // ... 其它
  bindHeaderDblclick
};
```
```

### 11.6 Vue setup 数据与方法（嵌入 `setup()`）

```js
setup() {
  // === 标注层（v1.0 新增）===

  // 总开关（从 localStorage 读，默认开）
  const showAnnotations = ref(
    localStorage.getItem('show-annotations') !== 'false'
  );

  // 抽屉状态
  const annotationDrawerVisible = ref(false);
  const currentFpKey = ref('');
  const annoActiveTab = ref('fields');

  // 当前展示的功能点数据
  const currentFp = computed(() => {
    if (!currentFpKey.value) return null;
    return window.__PRD_DATA__?.function_points?.[currentFpKey.value] || null;
  });

  // 初始化总开关状态
  onMounted(() => {
    document.body.classList.toggle('annotations-hidden', !showAnnotations.value);

    // 键盘快捷键：按 A 键切换标注
    document.addEventListener('keydown', (e) => {
      // 避免在输入框中触发
      if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
      if (e.key === 'a' || e.key === 'A') {
        showAnnotations.value = !showAnnotations.value;
        onToggleAnnotations(showAnnotations.value);
      }
    });
  });

  // 切换标注显示
  const onToggleAnnotations = (val) => {
    document.body.classList.toggle('annotations-hidden', !val);
    localStorage.setItem('show-annotations', val);
  };

  // 打开标注弹窗（v1.0 规范：自动选默认 Tab — 没字段规范则默认"用例规则"）
  const openAnnotationDrawer = (fpKey) => {
    currentFpKey.value = fpKey;
    const fp = window.__PRD_DATA__?.function_points?.[fpKey];
    const hasFieldSpecs = fp && fp.field_specs && typeof fp.field_specs !== 'string';
    annoActiveTab.value = hasFieldSpecs ? 'fields' : 'usecases';
    annotationDrawerVisible.value = true;
  };

  // 按 menu_key 查 menu_path（用于操作日志的"操作模块"列）
  const getMenuPath = () => {
    if (!currentFp.value) return '';
    const menus = window.__PRD_DATA__?.menus || {};
    for (const lvlKey in menus) {
      const children = menus[lvlKey].children || {};
      for (const childKey in children) {
        if (children[childKey].menu_key === currentFp.value.menu_key) {
          return children[childKey].menu_path || currentFp.value.menu_key;
        }
      }
    }
    return currentFp.value.menu_key;
  };

  // 滚动到原型对应位置
  const scrollToAnnotation = () => {
    const el = document.querySelector(`[data-annotation="${currentFpKey.value}"]`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.style.outline = '2px solid var(--primary)';
      setTimeout(() => { el.style.outline = ''; }, 2000);
      annotationDrawerVisible.value = false;
    }
  };

  return {
    // 标注层
    showAnnotations,
    annotationDrawerVisible,
    currentFpKey,
    currentFp,
    annoActiveTab,
    onToggleAnnotations,
    openAnnotationDrawer,
    scrollToAnnotation,
    // ... 其它原有数据
  };
}
```

### 11.7 标注层使用流程

```
用户打开原型 .html
↓
看到顶栏右上角「ℹ️ 标注 [开/关]」开关
↓
默认开 → 所有功能点旁显示 ℹ️ 图标
↓
点 ℹ️ → 右侧抽屉滑出 → 看字段规范 / 用例规则 / 原型位置
↓
点抽屉内"滚动到原型位置"→ 自动滚动并高亮目标元素
↓
点顶栏开关关闭 → 所有 ℹ️ 图标隐藏 → 纯净原型
↓
按 A 键 → 快速切换标注
↓
关闭后下次打开自动保持关闭状态（localStorage 持久化）
```

### 11.8 输出时的标注层校验（追加到 §✅ 检查清单）

- [ ] `window.__PRD_DATA__` 已嵌入并通过 `prd-data-schema.md` 校验
- [ ] 所有标注功能点都有 `data-annotation="<fp_key>"` 属性
- [ ] 每个标注点旁有 `.annotation-icon` 元素（带 `data-anno-target` + click handler）
- [ ] 顶栏含「ℹ️ 标注」开关 + 默认开
- [ ] `<el-dialog>` 浮动窗口模板正确嵌入（**非模态 + 可拖拽 + 双击标题关闭**，禁用 el-drawer）
- [ ] 标注 CSS 已追加到 `<style>` 段
- [ ] Vue setup 含 `showAnnotations` / `openAnnotationDrawer` / `onToggleAnnotations` 等方法
- [ ] 键盘快捷键 `A` 切换标注（绑定在 document keydown）
- [ ] localStorage 持久化总开关状态

---

## 12. 离线化（必跑 — 最终交付物必须是离线版）

> ⚠️ **铁律**：原型 HTML 默认用 unpkg.com CDN，对方无网络 / 内网时打不开。**所有给用户的最终交付物必须先跑离线化脚本**，输出 1.5 MB 自包含单文件。

### 12.1 离线化流程

```
AI 生成在线版 HTML（unpkg.com CDN，~40 KB）
      ↓
调用 make-offline.ps1
      ↓
脚本下载 4 个 CDN 资源（Vue + Element Plus JS/CSS + Icons）→ inline 到 HTML
      ↓
输出离线版 HTML（~1.5 MB，**无任何 CDN 依赖**）
      ↓
任何人双击就能打开（国内/海外/有网/无网）
```

### 12.2 调用 make-offline.ps1

```powershell
# 在 ai-rules 仓库根目录执行
cd <ai-rules-repo>
.\skills\pm-design\make-offline.ps1 -InputHtml "./archive/原型-<名称>-<日期>.html"

# 输出：./archive/原型-<名称>-<日期>-offline.html（~1.5 MB）
```

### 12.3 离线化原理

脚本做 4 件事：
1. 下载 4 个 CDN 资源到临时目录（用 `Invoke-WebRequest`，仅一次性下载）
2. 读取在线版 HTML
3. 用 `.Replace()` 字面替换 4 个 `<script>` / `<link>` CDN 标签为内联内容
4. 写出离线版 HTML（UTF-8 with BOM 保持中文不损坏），清理临时文件

### 12.4 文件大小说明

| 资源 | 大小 |
|---|---|
| Vue 3.4.21 | 144 KB |
| Element Plus 2.4.4 CSS | 319 KB |
| Element Plus 2.4.4 JS | 916 KB |
| Element Plus Icons 2.3.1 | 205 KB |
| 业务代码 + prd-data.json | 30-50 KB |
| **合计** | **~1.6 MB** |

### 12.5 输出物清单（每次必出两版）

| 文件 | 大小 | 用途 |
|---|---|---|
| `原型-XXX-<日期>.html` | 30-50 KB | 在线版（开发调试 / 本机有网时用）|
| `原型-XXX-<日期>-offline.html` | ~1.6 MB | **离线版（对外交付 / 评审 / 客户演示）**|

**默认只展示离线版给用户**，除非用户明确说"我要在线版"。

---

## ✅ 输出时的强制检查清单

AI 生成原型后**必须自检**：

- [ ] CDN 引入齐全（Vue + Element Plus + Tailwind + Inter）
- [ ] 主色覆盖正确（`--primary: #3363FF`）
- [ ] 部署 BR 时所有字段标签都是葡语
- [ ] 日期格式 DD/MM/YYYY（不是 YYYY-MM-DD）
- [ ] 货币 BRL 格式 `R$ 1.234,56`
- [ ] 表格数值列右对齐
- [ ] 已选 Checkbox/Radio 文字变蓝
- [ ] 弹窗 Form 标签 top 位置
- [ ] 按钮 / Tab / Pagination 视觉与 spec 一致
- [ ] 含示例数据（至少 5-10 行）
- [ ] 文件可双击在浏览器直接打开（无构建步骤）
- [ ] **`setup()` 的 `return {}` 无遗漏**：模板里引用的每个 ref / computed / 方法都能在 return 块里找到（见 [§15.4](#154-技术踩坑铁律必守--否则白底空白表头叠影)，否则白屏 / 弹窗点不开）
- [ ] **HTML 注释不跨脚本块**：每个 `<!--` 在同行 / 紧邻闭合，`<script>`…`</script>` 之间不夹 `<!-- -->`（见 [§15.4](#154-技术踩坑铁律必守--否则白底空白表头叠影)，否则 PRD 数据 + 主脚本被吞成注释 → 乱码）

自检通过后才输出给用户确认。

---

## 16 URL 参数直达状态 + 原型图自动截图（v1.0 强制 / 替代手工 IMG-xx）

> 🏛 **铁律**：PRD 的"原型图"**不再用裸 `IMG-xx` 占位**，改为**自动截取原型对应状态的真实截图**嵌入。两个前提缺一不可：① 原型支持「URL 参数直达任意状态」（§16.1）② 原型烤入截图清单 `window.__ANNO_SHOT_MANIFEST__`（§16.1.1）。生成 PRD 时由 [auto-screenshot.js](./qa/auto-screenshot.js) 用无头 Chrome/Edge **零配置全自动**批量出图（读 manifest，AI 不用手搓 states.json、PM 不用手点）。机器闸 F2 拦"原型图全为无"。

### 16.1 原型必须支持 URL 参数深链（onMounted 解析）

原型 `setup()` 里加 `onMounted`，解析 `location.search` 把界面切到指定状态，使**每个功能点的视图都有唯一可直达 URL**：

```js
const { createApp, ref, computed, reactive, onMounted, nextTick } = Vue;
onMounted(() => {
  const q = new URLSearchParams(location.search);
  if (!q.toString()) return;
  const s = q.get('sys');  if (s) sys.value = s;                 // 跨系统切换
  const p = q.get('page'); if (p) { page.value = p; /* 同步页签 activeTabKey */ }
  if (q.get('anno') === '1') { showAnnotations.value = true; onToggleAnno(); } // 可选：开标注层
  const open = q.get('open');  // 打开弹窗/详情/表单等子状态
  if (open) nextTick(() => {
    if (open === 'form')   openForm(null);
    else if (open === 'detail') { const r = listData.value[0]; if (r) openDetail(r); }
    else if (open === 'audit')  { const r = listData.value.find(x => x.status === '待审核'); if (r) openAudit(r); }
    // ...按业务对象扩展
  });
});
```

约定参数：`?sys=` 跨系统、`?page=` 末级页面 key、`?open=form|detail|audit|...` 子弹窗、`?pins=0` 隐藏标注 PIN（截图用）、`?anno=1` 开标注层。

### 16.1.1 ★ 同时烤入截图清单 `window.__ANNO_SHOT_MANIFEST__`（v1.0 强制 / 让截图零配置）

原型生成时，AI **本就知道**有哪些页/弹窗/功能点（`data-annotation` 就是它打的），所以**必须在原型里同时烤一段截图清单**，使 `auto-screenshot.js` 能直接读出、**AI 无需手搓 states.json**：

```html
<script>
window.__ANNO_SHOT_MANIFEST__ = [
  { id:"IMG-01", query:"sys=OMS&page=home&pins=0",                  fps:["首页-OMS.账户余额","首页-OMS.数据看板"] },
  { id:"IMG-02", query:"sys=OMS&page=recharge-list&pins=0",         fps:["充值管理-OMS.查询","充值管理-OMS.导出","充值管理-OMS.删除"] },
  { id:"IMG-03", query:"sys=OMS&page=recharge-list&open=form&pins=0",  fps:["充值管理-OMS.充值","充值管理-OMS.编辑"] }
  // 一视图一条；多功能点可共享一图；query 末尾带 pins=0 隐藏标注 PIN
];
</script>
```

每条 = `{ id: 图编号, query: 深链参数(末尾 pins=0), fps: [该视图覆盖的功能点 key...] }`。**覆盖全部功能点**（每个 fp 至少被一条 manifest 的 fps 命中），否则该 fp 原型图会是「无」、被机器闸 F2 拦。

### 16.2 用 auto-screenshot.js 自动出图（零配置·首选）

1. 先跑 `make-offline.ps1` 出离线版（CDN 内联，无头渲染不依赖网络）。
2. 跑 `node skills/pm-design/qa/auto-screenshot.js -Html <offline.html>`——**不给 -States 时自动读原型内 `window.__ANNO_SHOT_MANIFEST__`**，逐状态深链截图 → 写进每个功能点 `.2 原型图` → 重生 PRD。外部/无 manifest 的原型才用 `-States <states.json>` 手给。
3. **AI 必须用 Read 工具逐张查看 PNG 验证渲染正确、弹窗已打开**（无头渲染偶有空白/截断；prd 铁律：不侥幸）。
4. 关键坑（实测 2026-06-27）：**绝不加 `--virtual-time-budget`**（原型 SSE 持续重连→虚拟时间永不结算→Chrome 挂起无图）；URL 作单个参数传；图片子目录/路径用无空格 slug（含空格 markdown 截断、嵌不进 docx）。

> ⚠️ **无头截图致命坑（旧 make-screenshots.ps1）**：Chrome/Edge `--headless --screenshot` **不加 `--user-data-dir` 会静默不出图**（无报错、无 PNG）。auto-screenshot.js 已内置临时 user-data-dir，无需操心；用旧脚本时必传。

### 16.3 PRD 原型图写法

PRD `<功能点>.2 原型图` 不写裸 `IMG-xx`，写 Markdown 图片嵌入：

```markdown
<功能点编号>.2 原型图：![IMG-01 原型截图](screenshots/img-01.png)
```

多个功能点共用同一页面时引用同一张 `img-xx.png`；截图放在与 PRD 同目录的 `screenshots/` 下，原型改动后重跑脚本即可全量刷新。

### 16.4 对外在线文档交付：转「图片内嵌的 Word(.docx)」（v1.0 强制）

> 🏛 **铁律**：PRD 用相对路径引用截图（`![](screenshots/img-xx.png)`）——本地 / VS Code 看正常，但**直接把 `.md` 传到腾讯文档 / 飞书 / 石墨等在线文档，图会全部裂开**（在线文档导入 md 不带本地相对图、不会上传 `screenshots/` 文件夹）。

**所以：凡用户要把 PRD 发到在线文档 / 给外部评审，必须额外产出一份「图片 + 流程图都内嵌的 .docx」**。用 [make-doc.ps1](./make-doc.ps1) 一条命令搞定：

```powershell
.\make-doc.ps1 -InputMd "<PRD.md 绝对路径>" -Title "<PRD 标题>"   # 产出同名 .docx
```

make-doc.ps1 做两件 pandoc 单独做不到的事：
1. **截图相对路径内嵌**：`--resource-path` 指向 PRD 目录，把 `screenshots/img-xx.png` 内嵌进 docx（只传裸 md 到在线文档会裂图）。
2. **mermaid 流程图渲染成图**：pandoc 不渲染 mermaid（会变代码块）。脚本用「无头 Chrome + mermaid.js」把每个 ```mermaid``` 块渲染成贴合尺寸的 `screenshots/flow-N.png`（先 `--dump-dom` 读 svg 真实尺寸 → 按尺寸截图裁掉白边），再换进临时 md 交 pandoc。**原始 .md 不改**（保留 live mermaid 供 VS Code/Typora）。

- 产出 docx ≈ 所有图总大小（如 13 截图 + 2 流程图约 1.1MB），>1MB 即说明图都进去了。
- 交付物清单对外加这份 `.docx`；用户腾讯文档「导入 → Word」即可，图与流程图都不裂。
- 备选（按需）：Base64 内嵌进 md / 自包含 HTML——在线文档导入兼容性不如 docx，默认用 docx。
- 环境前提：`pandoc`（3.9 已验证）+ Chrome/Edge + 可访问 unpkg（mermaid CDN）。⚠️ dump-dom 取尺寸要写文件再读（PS 5.1 下变量捕获原生输出为空）；截图必带 `--user-data-dir`。

---

**模板结束。AI 生成原型时严格按此输出。**
