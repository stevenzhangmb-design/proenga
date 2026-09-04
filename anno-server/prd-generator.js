/* ⚠ 自动生成，请勿手改！源 = anno-server/server.js，由 build-shared-generator.js 派生。
   共享 PRD 生成器（isomorphic：node + 浏览器都跑，单一来源）。改生成器请改 server.js 后重跑 build。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.prdGenerator = factory();
})(typeof self !== 'undefined' ? self : this, function () {
function parseFpKey(fpKey) {
  fpKey = (fpKey || '').trim();
  // 通用化（产品级）：系统码 = 模块与功能点之间、点号前的【大写短码段】，不写死枚举。
  // 覆盖 OMS/WMS/APP/H5/PC/B2B/B2C/ADMIN 之外的任意系统/版本码（如中巴双版 CN/BR、门店 POS、海外 SG 等）。
  const m = fpKey.match(/^(.+?)-([A-Z][A-Z0-9]{0,9})\.(.+)$/);
  if (m) return { module: m[1], system: m[2].toUpperCase(), fp: m[3] };
  const dot = fpKey.indexOf('.');
  if (dot > 0) return { module: fpKey.slice(0, dot), system: '', fp: fpKey.slice(dot + 1) };
  return { module: fpKey, system: '', fp: fpKey };
}

function mergePinIntoPrd(prdData, pin) {
  const fpKey = (pin.zoneContext && pin.zoneContext.fpKey) || pin.boundFp || '';
  if (!fpKey) return null;

  const { system, module, fp } = parseFpKey(fpKey);
  const existing = prdData.function_points[fpKey] || {};

  // 归属菜单树（变长，供 §4.4 编号）：优先 pin.menuPath（数组/「A / B / C」串），回退 page_menus[页面]，再回退 module
  const resolveMenuPath = () => {
    let mp = pin.menuPath;
    if (Array.isArray(mp)) return mp.map(s => String(s).trim()).filter(Boolean);
    if (typeof mp === 'string' && mp.trim()) return mp.split(/\s*[\/／>›]\s*/).map(s => s.trim()).filter(Boolean);
    // page_menus 回退：pin.pageKey = "系统-页面"，取页面段查 prdData.page_menus
    const pk = pin.pageKey || '';
    const page = pk.includes('-') ? pk.slice(pk.indexOf('-') + 1) : pk;
    const pm = (prdData.page_menus || {})[page];
    if (pm) return String(pm).split(/\s*[\/／>›]\s*/).map(s => s.trim()).filter(Boolean);
    if (Array.isArray(existing.menu_path) && existing.menu_path.length) return existing.menu_path;
    return module ? [module] : [];
  };

  // Q2修复：始终用 PIN 的最新内容覆盖草稿字段（不管是否有结构化数据）
  // pin.isAIDraft=false 表示用户已编辑，内容必须写入；isAIDraft=true 是 AI 草稿同样写入
  // 只有 pin.fieldSpecs/useCaseRules 为空时才保留旧值
  const menu_path = resolveMenuPath();
  prdData.function_points[fpKey] = {
    ...existing,
    fp_name:              pin.title || fp,
    menu_name:            existing.menu_name || module,
    system:               (pin.pageKey && pin.pageKey.includes('-') ? pin.pageKey.split('-')[0] : '') || existing.system || system,
    menu_path:            menu_path,
    page_key:             pin.pageKey || existing.page_key || '',
    img:                  pin.img || existing.img || '无',
    // pin._fullEdit=true（浏览器"保存即同步"传入）→ 以 pin 当前值为准，含清空（删除内容也同步）；
    // 否则（如 AI 局部注入）→ 空值回退保留旧值，避免漏传字段把已有内容冲掉
    _draft_fieldSpecs:    pin._fullEdit ? (pin.fieldSpecs   || '') : (pin.fieldSpecs    || existing._draft_fieldSpecs    || ''),
    _draft_useCaseRules:  pin._fullEdit ? (pin.useCaseRules || '') : (pin.useCaseRules  || existing._draft_useCaseRules  || ''),
    _isUserEdited:        pin.isAIDraft === false,  // 标记是否用户亲手编辑过
    updatedAt:            new Date().toISOString(),
  };
  return fpKey;
}

function prdHeader(prdData, date) {
  const productName = prdData.system_name || '产品需求文档';
  const fps = prdData.function_points || {};

  // 分析 prd-data：提取系统类型 + 模块列表
  const systemsSet = new Set();
  const modulesSet = new Set();
  const fpNames    = [];
  for (const [key, fp] of Object.entries(fps)) {
    const { system, module } = parseFpKey(key);
    if (system) systemsSet.add(system);
    if (module) modulesSet.add(module);
    if (fp.fp_name) fpNames.push(fp.fp_name);
  }
  const systems  = [...systemsSet];
  const modules  = [...modulesSet];
  const hasSys   = s => systems.includes(s);

  // § 1 开发目的：列出实际涉及的系统 + 模块
  const sysList = systems.length ? systems.join('、') : 'WMS/OMS';
  const modList = modules.length ? modules.join('、') : '各功能模块';
  const fpDesc  = fpNames.length
    ? `，涵盖 ${fpNames.slice(0, 6).join('、')}${fpNames.length > 6 ? ' 等' : ''} ${fpNames.length} 个功能点`
    : '';
  const purpose = `本文档描述 **${productName}** 的产品功能需求，作为研发团队设计与开发的依据。\n\n当前版本覆盖 **${sysList}** 系统下的 **${modList}**${fpDesc}，通过原型标注工具持续同步更新，确保文档与产品原型保持一致。`;

  // § 3 术语：基础术语 + 按检测到的系统动态添加行业专属术语
  const baseTerms = [
    ['PRD',      '产品需求文档（Product Requirements Document）'],
    ['PM',       '产品经理（Product Manager）'],
    ['fp_key',   '功能点唯一标识，格式：模块名-系统.功能名'],
  ];
  const wmsTerms = [
    ['WMS',      '仓储管理系统（Warehouse Management System）'],
    ['入库',      '货物从供应商/生产端进入仓库的作业流程'],
    ['出库',      '货物从仓库发往客户/目的地的作业流程'],
    ['库存盘点',  '对仓库实物与系统账面数量进行核对的操作'],
    ['充值',      '客户向账户预存金额以支付仓储费用'],
    ['计费',      '按仓储合同约定对货主进行费用结算的操作'],
  ];
  const omsTerms = [
    ['OMS',      '订单管理系统（Order Management System）'],
    ['发货单',    '指导仓库进行货物拣选、包装、发运的订单凭证'],
    ['退货单',    '客户将货物退回仓库时产生的处理单据'],
    ['账户余额',  '货主预充值后可用于抵扣仓储/运费的账户金额'],
    ['对账',      '货主与仓储方核对账目、确认费用的周期性操作'],
  ];
  const retailTerms = [
    ['门店',      '连锁品牌下的单个实体销售网点'],
    ['总部',      '管理多个门店的品牌总公司视角'],
    ['挂账',      '暂不结算、记入应收/应付账户的账务处理方式'],
    ['进销存',    '采购入库（进）、销售出库（销）、库存管理（存）的统称'],
  ];

  let termRows = [...baseTerms];
  if (hasSys('WMS')) termRows = [...wmsTerms, ...termRows];
  if (hasSys('OMS')) termRows = [...termRows, ...omsTerms];
  // 零售/连锁关键词检测
  if (/门店|连锁|零售|retail/i.test(productName + modules.join('')))
    termRows = [...termRows, ...retailTerms];

  const termsTable = termRows
    .map(([term, desc]) => `| ${term} | ${desc} |`)
    .join('\n');

  // § 4.1 产品定义：基于系统类型生成贴切描述
  let productDef = '';
  if (hasSys('WMS') && hasSys('OMS')) {
    productDef = `${productName}是面向 **B 端仓储/供应链** 场景的综合管理系统，包含：\n\n- **WMS（仓储管理）**：负责货物入库、出库、库存盘点及仓储费用计费，是仓库运营的核心系统。\n- **OMS（订单管理）**：负责客户订单受理、发货调度、退货处理及账单对账，面向客户服务侧。\n\n两系统通过统一账户体系关联，货主可在 OMS 查看消费明细，财务人员在 WMS 进行充值审核与费用结算。`;
  } else if (hasSys('WMS')) {
    productDef = `${productName}是面向 **B 端仓储** 场景的 WMS 系统，覆盖 **${modList}** 等核心业务模块，支持货物入库、出库、库存盘点及财务结算全流程。`;
  } else if (hasSys('OMS')) {
    productDef = `${productName}是面向 **B 端电商/供应链** 场景的 OMS 系统，覆盖 **${modList}** 等核心业务模块，支持订单管理、发货调度、退货处理及账单对账全流程。`;
  } else if (/门店|连锁|零售/i.test(productName + modules.join(''))) {
    productDef = `${productName}是面向 **连锁零售** 场景的管理系统，覆盖 **${modList}** 等核心业务模块，支持总部统管、门店自主操作双视图。`;
  } else {
    productDef = `${productName}覆盖 **${modList}** 等 ${fpNames.length} 个功能点，详见 §4.4 功能点明细。`;
  }

  // § 4.3 业务流程图：必须 mermaid（prd 铁律 §2.1，禁纯文字）。编号自 4.3.1 顺延、不重复。
  //   优先用 prdData.business_flows（PM/AI 真推理的业务流，[{title, mermaid}]）；否则按检测到的系统给默认 mermaid 起点。
  let flowIdx = 0, flowDesc = '';
  const mkFlow = (title, body) => { flowIdx++; return `\n#### 4.3.${flowIdx} ${title}\n\n\`\`\`mermaid\n${String(body).trim()}\n\`\`\`\n\n`; };
  const customFlows = Array.isArray(prdData.business_flows) ? prdData.business_flows : [];
  if (customFlows.length) {
    for (const f of customFlows) flowDesc += mkFlow(f.title || '业务流程', f.mermaid || 'flowchart TD\n    A([开始]) --> Z([结束])');
  } else {
    if (hasSys('WMS')) flowDesc += mkFlow('WMS 核心业务流程',
`flowchart TD
    A([货主签约]) --> B[开立账户] --> C[提交充值申请]
    C --> D{财务审核}
    D -->|通过| E[账户到账]
    D -->|驳回| C
    E --> F[货物入库] --> G[拣货出库] --> H[月底计费] --> I([对账确认])`);
    if (hasSys('OMS')) flowDesc += mkFlow('OMS 订单处理流程',
`flowchart TD
    A([客户下单]) --> B[创建发货单] --> C[推送 WMS]
    C --> D[仓库拣货出库] --> E[物流揽收] --> F{是否退货}
    F -->|否| G([签收完成])
    F -->|是| H[退货审核] --> I[仓库收货] --> J([退款完成])`);
    if (!flowDesc) flowDesc = mkFlow('核心业务流程', `flowchart TD\n    A([开始]) --> B[业务处理] --> Z([结束])`);
  }

  const sysBoundary = systems.length
    ? `本系统涉及 **${systems.join('、')}** ${systems.length} 个子系统，系统边界与集成关系详见架构设计文档。`
    : `（系统视图边界 — 请 PM 补充）`;
  // §4.3.x 系统视图边界：仅多系统视图必填（prd 铁律 §1.3.1）；编号紧接业务流程图顺延
  let boundarySection = '';
  if (systems.length >= 2) { flowIdx++; boundarySection = `#### 4.3.${flowIdx} 系统视图边界\n\n${sysBoundary}\n\n`; }

  return `# ${productName} PRD

> 版本：v1.0.0　生成日期：${date}

---

## 1 开发目的

${purpose}

---

## 2 版本变更

| 版本 | 日期 | 变更人 | 变更内容 |
|---|---|---|---|
| v1.0 | ${date} | PM | 首次发版：覆盖 ${modList} 等 ${fpNames.length} 个功能点 |

---

## 3 术语 / 图例定义

| 术语 | 说明 |
|------|------|
${termsTable}

---

## 4 功能需求

### 4.1 产品定义

${productDef}

### 4.2 产品框架

（产品整体架构图 — 请 PM 补充；建议在此插入系统模块拓扑图）

### 4.3 业务流程图
${flowDesc}${boundarySection}### 4.4 功能点明细

`;
}

function fpMeta(key, fp) {
  const parsed = parseFpKey(key);
  const sys = fp.system || parsed.system || '通用';
  let mp = Array.isArray(fp.menu_path) ? fp.menu_path.slice()
         : (typeof fp.menu_path === 'string' ? fp.menu_path.split(/\s*[\/／>›]\s*/) : []);
  mp = mp.map(s => String(s).trim()).filter(Boolean);
  if (!mp.length) mp = [fp.menu_name || parsed.module || '未分类'];
  return { key, fp, sys, menuPath: mp, fpName: fp.fp_name || parsed.fp || '功能点' };
}

function renderFp(it, num) {
  const fp = it.fp;
  // 标题层级随编号深度（prd 铁律 §1.2：# 数 = 编号段数 + 1，markdown 封顶 6）
  const h = '#'.repeat(Math.min(num.split('.').length + 1, 6));
  let md = `\n${h} ${num} ${it.fpName}\n`;
  const loc = [it.sys, ...it.menuPath, it.fpName].join('-');
  md += `\n**${num}.1 位置**\n\n${loc}\n`;
  md += `\n**${num}.2 原型图**\n\n${(fp.img && String(fp.img).trim()) || '无'}\n`;
  const fs = (fp._draft_fieldSpecs || '').trim();
  const uc = (fp._draft_useCaseRules || '').trim();
  /* 无字段规范 → 该节写「无」（与原型图空值写「无」一致）；用例规则固定 .4，编号不再随有无字段规范挪动 */
  md += `\n**${num}.3 字段规范**\n\n${fs || '无'}\n`;
  md += `\n**${num}.4 用例规则**\n\n${uc || '（待生成）'}\n`;
  return md;
}

function renderMenuTree(items, prefix, depth) {
  let md = '';
  const groups = [];
  const idx = {};
  for (const it of items) {
    const name = it.menuPath[depth];
    if (name === undefined) continue;
    if (idx[name] === undefined) { idx[name] = groups.length; groups.push({ name, items: [] }); }
    groups[idx[name]].items.push(it);
  }
  let i = 0;
  for (const g of groups) {
    i++;
    const menuNum = `${prefix}.${i}`;
    // 标题层级随编号深度（prd 铁律 §1.2：# 数 = 编号段数 + 1，markdown 封顶 6）
    const h = '#'.repeat(Math.min(menuNum.split('.').length + 1, 6));
    md += `\n${h} ${menuNum} ${g.name}\n`;
    const deeper = g.items.filter(it => it.menuPath.length > depth + 1);
    const leaf   = g.items.filter(it => it.menuPath.length <= depth + 1);
    if (deeper.length) md += renderMenuTree(deeper, menuNum, depth + 1);
    let j = 0;
    for (const it of leaf) { j++; md += renderFp(it, `${menuNum}.${j}`); }
  }
  return md;
}

function buildFpSections(prdData) {
  const fps = prdData.function_points || {};
  const keys = Object.keys(fps);
  if (!keys.length) return '\n（暂无功能点标注）\n';

  const items = keys.map(k => fpMeta(k, fps[k]));
  const bySys = {};
  const seen = [];
  for (const it of items) { if (!bySys[it.sys]) { bySys[it.sys] = []; seen.push(it.sys); } bySys[it.sys].push(it); }
  // 系统顺序：跟随实际出现顺序；prdData.system_order 显式给定时优先（严格跟随用户菜单顺序，不写死）
  const order = Array.isArray(prdData.system_order) ? prdData.system_order : [];
  const systems = [...new Set([...order, ...seen])].filter(s => bySys[s]);

  let md = '';
  let si = 0;
  for (const sys of systems) {
    si++;
    md += `\n#### 4.4.${si} ${sys}\n`;
    md += renderMenuTree(bySys[sys], `4.4.${si}`, 0);
  }
  return md;
}

function generatePrdMd(prdData) {
  const date = new Date().toISOString().slice(0, 10);
  return prdHeader(prdData, date) + buildFpSections(prdData);
}
  return { parseFpKey, mergePinIntoPrd, prdHeader, generatePrdMd, buildFpSections, fpMeta, renderFp, renderMenuTree };
});
