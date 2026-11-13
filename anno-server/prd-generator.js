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
  // 行业术语【不写死】：AI 据真实系统生成、存 prd-data._prd_meta.terms（[[术语,说明],...]）。
  // 铁律：skill 里的术语全是【举例】，禁当通用模板硬塞进任意系统（防"发货单/退货单/订单流程"泄漏到充值这类系统）。
  const _todo = (w) => `（待 AI 据原型/业务真值生成${w}——skill 仅举例，须写本系统真实场景，禁照抄/通用臆造/占位）`;
  const metaTerms = (prdData._prd_meta && Array.isArray(prdData._prd_meta.terms)) ? prdData._prd_meta.terms : [];
  const termRows = metaTerms.length ? [...baseTerms, ...metaTerms] : [...baseTerms, ['—', _todo('本系统业务术语')]];
  const termsTable = termRows
    .map(([term, desc]) => `| ${term} | ${desc} |`)
    .join('\n');

  // § 4.1 产品定义【不写死】：AI 据真实系统生成、存 _prd_meta.product_def；生成器不按系统类型猜（防"OMS=订单/发货"这类通用臆造套到充值上）
  const productDef = hardWrapForPandoc((prdData._prd_meta && prdData._prd_meta.product_def && String(prdData._prd_meta.product_def).trim())
    || _todo('产品定义（本系统是什么、解决什么业务、覆盖哪些模块）'));

  // § 4.3 业务流程图：必须 mermaid（prd 铁律 §2.1，禁纯文字）。编号自 4.3.1 顺延、不重复。
  //   优先用 prdData.business_flows（PM/AI 真推理的业务流，[{title, mermaid}]）；否则按检测到的系统给默认 mermaid 起点。
  let flowIdx = 0, flowDesc = '';
  // slug 与 saveScreenshotsAndRegen / renderBusinessFlows 一致：让 §4.3 引用已渲染的 FLOW-N.png（docx 可嵌入）
  const _flowSafe = (prdData.system_name || 'PRD').replace(/[/\\:*?"<>|]/g, '-');
  const _flowSlug = _flowSafe.replace(/[\s·]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '') || 'prd';
  // 读 PNG 真实像素宽高（IHDR：字节16-24），零依赖；失败返回 null
  const _pngSize = (file) => {
    try {
      const b = fs.readFileSync(file);
      if (b.length < 24 || b.toString('ascii', 1, 4) !== 'PNG') return null;
      return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
    } catch (e) { return null; }
  };
  const mkFlow = (title, body) => {
    flowIdx++;
    const _png = path.join(ARCHIVE_DIR, 'screenshots', _flowSlug, 'FLOW-' + flowIdx + '.png');
    // 渲染好了 → 引用图片（pandoc cwd=archive 时嵌进 docx）；没渲染（无 Chrome/库 或渲染失败）→ 降级保留 mermaid 源码
    let _block;
    if (fs.existsSync(_png)) {
      // 按真实宽高比给 pandoc 显示宽度：宽图占满页宽、高图放到接近整页高——杜绝 Word 把流程图压成小图
      const sz = _pngSize(_png);
      const USABLE_W = 6.2, USABLE_H = 8.0;  // 页面可用区(英寸·留边)
      let attr = '{width=100%}';
      if (sz && sz.w > 0 && sz.h > 0) {
        const win = Math.min(USABLE_W, USABLE_H * (sz.w / sz.h));
        attr = `{width=${(Math.round(win * 100) / 100)}in}`;
      }
      _block = `![业务流程图：${title}](screenshots/${_flowSlug}/FLOW-${flowIdx}.png)${attr}`;
    } else {
      _block = `\`\`\`mermaid\n${String(body).trim()}\n\`\`\``;
    }
    return `\n#### 4.3.${flowIdx} ${title}\n\n${_block}\n\n`;
  };
  const customFlows = (prdData._prd_meta && Array.isArray(prdData._prd_meta.business_flows)) ? prdData._prd_meta.business_flows
    : (Array.isArray(prdData.business_flows) ? prdData.business_flows : []);
  if (customFlows.length) {
    for (const f of customFlows) flowDesc += mkFlow(f.title || '业务流程', f.mermaid || 'flowchart TD\n    A([开始]) --> Z([结束])');
  } else {
    // 不写死订单/发货/充值流程（那是 skill 举例）；AI 没给真实业务流就明确待生成，闸拦住不让交
    flowDesc = mkFlow('业务流程图', 'flowchart TD\n    A([待生成]) --> B[需 AI 据本系统真实业务流程绘制] --> Z([待生成])');
  }

  const sysBoundary = systems.length
    ? `本系统涉及 **${systems.join('、')}** ${systems.length} 个子系统，系统边界与集成关系详见架构设计文档。`
    : `（系统视图边界 — 请 PM 补充）`;
  // §4.3.x 系统视图边界：仅多系统视图必填（prd 铁律 §1.3.1）；编号紧接业务流程图顺延
  let boundarySection = '';
  if (systems.length >= 2) { flowIdx++; boundarySection = `#### 4.3.${flowIdx} 系统视图边界\n\n${sysBoundary}\n\n`; }

  // §1 开发目的、§4.2 产品框架【不写死】：优先 _prd_meta（AI 据真值生成）；无则 §1 用数据派生的中性描述、§4.2 明确待生成（不占位"请PM补充"）
  // ★ 套 hardWrapForPandoc：AI 自由文本(§1/§4.2)里若含「• …」或「N、…」行、下一行非空 → 补行尾两空格，
  //   否则 pandoc 合并成一坨（⑪ 结构闸 F-WRAP）。此前只对 _draft 字段/用例套了，meta 章节漏套 → 充值 §4.2 的「• OMS/WMS」判红。根因修。
  const purposeFinal = hardWrapForPandoc((prdData._prd_meta && prdData._prd_meta.dev_purpose && String(prdData._prd_meta.dev_purpose).trim()) || purpose);
  const productFramework = hardWrapForPandoc((prdData._prd_meta && prdData._prd_meta.product_framework && String(prdData._prd_meta.product_framework).trim()) || _todo('产品框架（系统/模块拓扑、视图划分、模块间关系）'));

  return `# ${productName} PRD

> 版本：v1.0.0　生成日期：${date}

---

## 1 开发目的

${purposeFinal}

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

${productFramework}

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

function draftToMd(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) {
    if (!v.length) return '';
    if (v.every(x => x && typeof x === 'object' && !Array.isArray(x))) {   // [{字段对象}] → 标准 5 列表格
      const cell = x => (x === undefined || x === null) ? '' : String(x).replace(/\|/g, '\\|').replace(/\n/g, ' ');
      const rows = v.map(x => {
        const req = x.required === true ? '是' : x.required === false ? '否' : (x.是否必填 ?? x.是否必填必选 ?? x.required ?? '');
        return `| ${cell(x.field ?? x.name ?? x.字段名称 ?? x.字段 ?? '')} | ${cell(x.type ?? x.类型 ?? '')} | ${cell(req)} | ${cell(x.default ?? x.默认值 ?? '')} | ${cell(x.rule ?? x.desc ?? x.约束规则 ?? x.说明 ?? '')} |`;
      });
      return ['| 字段名称 | 类型 | 是否必填/必选 | 默认值 | 约束规则 |', '| --- | --- | --- | --- | --- |', ...rows].join('\n');
    }
    return v.map(x => '- ' + (typeof x === 'string' ? x : JSON.stringify(x))).join('\n');   // 其它数组 → 项目符号
  }
  if (typeof v === 'object') return String(v.markdown ?? v.md ?? v.text ?? JSON.stringify(v));
  return String(v);
}

function hardWrapForPandoc(md) {
  if (!md) return md;
  const ls = md.split('\n');
  return ls.map((l, i) => {
    if (!/^•\s/.test(l) && !/^\s+\d+、/.test(l)) return l;              // 只处理 • 七节标签行 与 N、子项行
    if ((ls[i + 1] || '').trim() !== '' && !/  $/.test(l)) return l.replace(/\s*$/, '') + '  ';  // 下一行非空且本行尾无两空格→补
    return l;
  }).join('\n');
}

function renderFp(it, num) {
  const fp = it.fp;
  // 标题层级随编号深度（prd 铁律 §1.2：# 数 = 编号段数 + 1，markdown 封顶 6）
  /* 2026-11-13 用户：Word 左侧目录要显示全部章节 → 功能点和它下面的 位置/原型图/字段规范/用例规则 都写成真标题
     （以前小节写成 **加粗文字**，Word 目录看不到）。markdown 只有 6 级，7～9 级用 pandoc custom-style 写 Word 标题。 */
  const head = (lv, text) => lv <= 6 ? `\n${'#'.repeat(lv)} ${text}\n` : `\n::: {custom-style="Heading ${Math.min(lv, 9)}"}\n${text}\n:::\n`;
  const lv = num.split('.').length + 1;
  let md = head(lv, `${num} ${it.fpName}`);
  const loc = [it.sys, ...it.menuPath, it.fpName].join('-');
  md += head(lv + 1, `${num}.1 位置`) + `\n${loc}\n`;
  md += head(lv + 1, `${num}.2 原型图`) + `\n${(fp.img && String(fp.img).trim()) || '无'}\n`;
  const fs = hardWrapForPandoc(draftToMd(fp._draft_fieldSpecs).trim());
  const uc = hardWrapForPandoc(draftToMd(fp._draft_useCaseRules).trim());
  /* 无字段规范 → 该节写「无」（与原型图空值写「无」一致）；用例规则固定 .4，编号不再随有无字段规范挪动 */
  md += head(lv + 1, `${num}.3 字段规范`) + `\n${fs || '无'}\n`;
  md += head(lv + 1, `${num}.4 用例规则`) + `\n${uc || '（待生成）'}\n`;
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
    const mlv = menuNum.split('.').length + 1;   /* 超过 6 级用 Word 7～9 级标题，目录才能逐级显示 */
    md += mlv <= 6 ? `\n${'#'.repeat(mlv)} ${menuNum} ${g.name}\n` : `\n::: {custom-style="Heading ${Math.min(mlv, 9)}"}\n${menuNum} ${g.name}\n:::\n`;
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

function normalizePrdMd(md) {
  let inCode = false, k = 0;
  const out = [];
  md.split('\n').forEach(l => {
    if (/^```/.test(l)) { inCode = !inCode; k = 0; out.push(l); return; }
    if (inCode) { out.push(l); return; }
    let m;
    if (/^- \S/.test(l)) { k = 0; l = '• ' + l.slice(2); if (!/  $/.test(l)) l = l.replace(/\s*$/, '') + '  '; }
    else if ((m = l.match(/^[ \t]+- (\S.*)$/))) { k++; l = '  ' + k + '、' + m[1]; if (!/  $/.test(l)) l = l.replace(/\s*$/, '') + '  '; }
    else k = 0;
    if (/^\|/.test(l) && out.length && !/^\|/.test(out[out.length - 1]) && out[out.length - 1].trim() !== '') out.push('');
    out.push(l);
  });
  return fixSentenceEnd(out.join('\n'));
}

function generatePrdMd(prdData) {
  const date = new Date().toISOString().slice(0, 10);
  return normalizePrdMd(prdHeader(prdData, date) + buildFpSections(prdData));
}
  return { parseFpKey, mergePinIntoPrd, prdHeader, generatePrdMd, buildFpSections, fpMeta, renderFp, renderMenuTree };
});
