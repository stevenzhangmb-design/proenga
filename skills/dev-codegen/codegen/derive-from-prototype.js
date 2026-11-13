#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   阶段1·兜底数据源 · 原型结构 → data_model · derive-from-prototype.js · 零依赖
   ────────────────────────────────────────────────────────────────────────
   目的：让「导出对接料 / 一键生成代码」【不依赖是否生成过 PRD】——只要画了原型就能出料。
   当 prd-data 没有 _draft_fieldSpecs（没圈选/没生成 PRD）时，改从原型内嵌的
   `const PAGECFG={...}`（每页 columns 表格列 / filters 筛选 / rows 样例行）推**基线 data_model**：
     · 列名/筛选名 → 字段（英文列名走词表，英文表头直接规范化）
     · 类型：样例值含 R$/￥/金额 → decimal(14,2)；YYYY-MM-DD → date；带时间 → datetime；
             状态列(样例是 {t,c} 标签) / select 筛选 → 枚举 tinyint；纯数字+数量类 → int；否则 varchar(255)
   输出 data_model 与 derive-datamodel.js 同结构（enums/entities/functionPoints），emit-* 可直接吃。
   有 PRD 字段规范时仍应优先用 derive-datamodel（更精确）；本脚本是「无 PRD 也能出料」的兜底。
   用法：node derive-from-prototype.js <原型.html> <out-data_model.json> [glossary.json]
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const [, , inPath, outPath, gloPath] = process.argv;
if (!inPath || !outPath) { console.error('用法: node derive-from-prototype.js <原型.html> <out.json> [glossary.json]'); process.exit(2); }
const html = fs.readFileSync(inPath, 'utf8');

// ── 大括号计数法抽 const PAGECFG={...}（JSON.stringify 产物·仅 " 作字符串定界）──
function extractConstObj(name) {
  const marker = 'const ' + name + '=';
  let i = html.indexOf(marker);
  if (i < 0) return null;
  i += marker.length;
  while (i < html.length && html[i] !== '{' && html[i] !== '[') i++;
  const open = html[i], close = open === '{' ? '}' : ']';
  if (!open) return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = i; j < html.length; j++) {
    const ch = html[j];
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; continue; }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) { depth--; if (depth === 0) return html.slice(i, j + 1); }
  }
  return null;
}
let PAGECFG = {};
try { const raw = extractConstObj('PAGECFG'); PAGECFG = raw ? JSON.parse(raw) : {}; }
catch (e) { console.error('解析 PAGECFG 失败: ' + e.message); process.exit(2); }

const GLO = gloPath && fs.existsSync(gloPath) ? JSON.parse(fs.readFileSync(gloPath, 'utf8')) : {};
const BASE_GLO = {
  '付款方式': 'payment_method', '充值金额': 'amount', '金额': 'amount', '交易号': 'transaction_no',
  '上传水单': 'voucher_url', '备注': 'remark', '名称': 'name', '状态': 'status', '类型': 'type',
  '数量': 'qty', '客户': 'customer_id', '商品': 'goods_id', '仓库': 'warehouse_id', '单号': 'order_no',
  '创建时间': 'create_time', '手机号': 'mobile', '邮箱': 'email', '地址': 'address',
  '开票日期': 'invoice_date', '开票主体': 'issuer', '发票号': 'invoice_no',
};
const glo = Object.assign({}, BASE_GLO, GLO);
const warn = [];
/* §2026-09-16 修：列/筛选项在多语原型里不是字符串，而是 {label:{zh,en,pt}, width…} 或直接 {zh,en,pt}；
   原来直接 .trim() 会抛 "trim is not a function"，整个导出对接料/一键生成代码当场失败。
   这里统一拍平成中文名（取 zh，没有就退 en/pt/第一个值）。 */
const LOCALE_KEYS = ['zh', 'en', 'pt', 'spa'];
function zhOf(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v !== 'object' || Array.isArray(v)) return String(v);
  if (v.label != null) return zhOf(v.label);                  // {label:…, width:…}
  for (const k of LOCALE_KEYS) if (typeof v[k] === 'string') return v[k];   // {zh,en,pt}
  if (v.t != null) return zhOf(v.t);                          // 标签单元 {t,c}
  return '';
}
/* §2026-11-13 修：多语标签取英文名当标识符（{zh,en,pt} 的 en；en 与 zh 相同/含中文则视为没有） */
function enOf(v) {
  if (v == null || typeof v !== 'object' || Array.isArray(v)) return '';
  if (v.label != null) return enOf(v.label);
  return typeof v.en === 'string' ? v.en : '';
}
function snake(s) {
  const t = String(s || '').replace(/[ºª°]/g, '').normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  if (!t || !/^[a-z]/.test(t) || t.length > 48) return '';
  return t;
}
/* 标识符来源顺序：词表 → 纯英文表头(Chave/XML/CPF/CNPJ) → 多语 en 标签 → 确定性占位 field_<序号>（中文名留在 comment）。
   ★ 不再用 hex 编码中文名（旧 field_e58f91e7… 不可读）。序号=该字段在本实体中的位置·同一原型重跑结果不变。 */
function toCol(raw, idx) {
  const s = zhOf(raw).trim();
  if (glo[s]) return glo[s];
  if (/^[A-Za-z][A-Za-z0-9 _\-\/.]*$/.test(s)) { const t = snake(s); if (t) return t; }   // 英文表头直接规范化
  const en = enOf(raw).trim();
  if (en && !/[㐀-鿿]/.test(en)) { const t = snake(en); if (t) return t; }
  warn.push('字段「' + s + '」无英文列名映射 → 占位 field_' + idx + '·需人补词表');
  return 'field_' + idx;
}
/* 筛选项没有 label、只有占位文字时：「全部发票账号」「请选择状态」→ 取字段名；
   「批量搜索请用逗号,分隔」「08/2026」「请输入」这类提示语/示例值不是字段 → 返回空（不当列）。 */
function fieldFromPlaceholder(ph) {
  let s = zhOf(ph).trim();
  if (!s) return '';
  s = s.replace(/^(全部|请选择|请输入|请填写|按|选择|输入)/, '').replace(/(筛选|搜索)$/, '').trim();
  if (!s || s.length > 12) return '';
  if (/[,，;；。…]|请|搜索|分隔|批量|双击|多个值|逗号/.test(s)) return '';
  if (/^[\d\/\-.: ]+$/.test(s)) return '';                       // 08/2026、2026-01-01 这类示例值
  return s;
}
/* 把 {zh,en,pt} 原样带进 toCol（取 en），中文名做 field/comment */
function fieldRef(raw) { return { zh: zhOf(raw).trim(), raw }; }
function inferType(colName, samples) {
  /* 单元格值同样可能是多语对象 / {t,c} 标签单元 —— 一律先拍平成中文，别直接 String() 出 [object Object] */
  const objTags = samples.filter(v => v && typeof v === 'object' && v.t != null).map(v => zhOf(v.t).trim()).filter(Boolean);
  if (objTags.length) return { type: 'tinyint', enumVals: [...new Set(objTags)] };   // 状态标签列 → 枚举
  const strs = samples.map(v => zhOf(v)).map(s => s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean);
  const joined = colName + ' ' + strs.join(' ');
  if (/R\$|￥|\$|金额|价格|费用|amount|valor|preç/i.test(joined) && /\d/.test(strs.join(''))) return { type: 'decimal', scale: 2 };
  if (strs.length && strs.every(x => /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}/.test(x))) return { type: 'datetime' };
  if (strs.length && strs.every(x => /^\d{4}-\d{2}-\d{2}$|^\d{2}\/\d{2}\/\d{4}$/.test(x))) return { type: 'date' };
  if (/数量|个数|库存|qty|count|数\b/i.test(colName) && strs.every(x => /^\d+$/.test(x.replace(/[.,]/g, '')))) return { type: 'int' };
  return { type: 'varchar', len: 255 };
}

const enums = {}, entities = {}, functionPoints = {};
for (const [pid, cfg] of Object.entries(PAGECFG)) {
  if (!cfg || !Array.isArray(cfg.columns) || !cfg.columns.length) continue;          // 只从"列表页"推实体
  if (/home|dashboard|看板|仪表|dash/i.test(pid)) continue;
  const rows = Array.isArray(cfg.rows) ? cfg.rows : [];
  let ent = String(pid).replace(/^[a-z]_/i, '').replace(/[^A-Za-z0-9]+/g, '') || 'entity';
  ent = ent.replace(/^\w/, m => m.toLowerCase());
  const cols = [];
  let fIdx = 0;                                                                      // 占位标识符序号（field_<n>）
  cfg.columns.forEach((cnRaw, ci) => {
    const cn = zhOf(cnRaw).trim();                                                   // 列可能是 {label:{zh,en,pt},width}
    fIdx++;
    if (!cn || /操作|action|操作栏/i.test(cn)) return;                                // 操作列非字段
    const d = inferType(cn, rows.map(r => Array.isArray(r) ? r[ci] : undefined));
    const _col = toCol(cnRaw, fIdx);
    if (['id', 'tenant_id', 'create_time', 'update_time'].includes(_col)) return;
    const c = { field: cn, col: _col, type: d.type, nullable: true, comment: cn };
    if (d.len) c.len = d.len;
    if (d.scale != null) c.scale = d.scale;
    if (d.enumVals) { const ek = _col.replace(/_id$/, '') + '_enum'; enums[ek] = { comment: cn, values: d.enumVals.map((z, i) => ({ code: i + 1, zh: z })) }; c.enum = ek; c.type = 'tinyint'; }
    cols.push(c);
  });
  /* 筛选项 → 补列：有 label 用 label；组合搜索(combo) 用它的 fields（可搜字段）；只有占位文字时按 fieldFromPlaceholder 取字段名，
     提示语（「批量搜索请用逗号,分隔」）一律不当列。 */
  const fRefs = [];
  (cfg.filters || []).forEach(f => {
    if (f == null) return;
    if (typeof f !== 'object') { fRefs.push({ f: {}, ...fieldRef(f) }); return; }
    if (f.label != null && zhOf(f.label).trim()) { fRefs.push({ f, ...fieldRef(f.label) }); return; }
    if (Array.isArray(f.fields) && f.fields.length) { f.fields.forEach(x => { const r = fieldRef(x); if (r.zh) fRefs.push({ f: { type: 'input' }, ...r }); }); return; }
    const z = fieldFromPlaceholder(f.ph);
    if (z) fRefs.push({ f, zh: z, raw: { zh: z, en: enOf(f.ph).replace(/^(all|select|enter|choose|search)\s+/i, '').trim() } });   // 「All stores」→ stores
  });
  fRefs.forEach(({ f, zh: label, raw }) => {
    if (!label) return;
    if (cols.some(c => c.field === label)) return;
    fIdx++;
    const _col = toCol(raw, fIdx);
    if (['id', 'tenant_id', 'create_time', 'update_time'].includes(_col)) return;
    if (cols.some(c => c.col === _col)) return;
    let c = { field: label, col: _col, type: 'varchar', len: 255, nullable: true, comment: label + '(筛选)' };
    if (f.type === 'select' && Array.isArray(f.options)) {
      const opts = f.options.map(zhOf).filter(o => o && !/全部|^all$/i.test(o));
      if (opts.length) { const ek = _col + '_enum'; enums[ek] = { comment: label, values: opts.map((z, i) => ({ code: i + 1, zh: z })) }; c = { field: label, col: _col, type: 'tinyint', enum: ek, nullable: true, comment: label }; }
    } else if (f.type === 'date' || /日期|时间|date/i.test(label)) { c = { field: label, col: _col, type: 'date', nullable: true, comment: label }; }
    cols.push(c);
  });
  if (!cols.length) continue;
  const seen = {};
  for (const c of cols) { if (seen[c.col] == null) seen[c.col] = 1; else { seen[c.col]++; c.col = c.col + '_' + seen[c.col]; } }
  const table = 'wms_' + ent.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  const label = (zhOf(cfg.listTitle) || zhOf(cfg.banner) || ent).trim() || ent;    // 多语标题 {zh,en,pt} → 中文（旧代码直接用对象 → [object Object]）
  entities[ent] = { table, label, comment: label, columns: cols };
  const base = '/api/oms/' + ent.replace(/([A-Z])/g, '-$1').toLowerCase();
  functionPoints[label + '.' + ent + '.列表'] = { entity: ent, api: { method: 'GET', path: base + '/page' } };
  functionPoints[label + '.' + ent + '.新增'] = { entity: ent, api: { method: 'POST', path: base } };
}

const dm = {
  _source: 'prototype-pagecfg',
  _note: '无 PRD 字段规范时从原型结构(PAGECFG)推的基线 data_model：类型按列名/样例值猜；生成 PRD 后可用 derive-datamodel 增强为精确规范。emit-* 消费 data_model.entities + function_points（与 derive-datamodel 同结构）。',
  data_model: { enums, entities },
  function_points: functionPoints,
  warnings: warn,
};
fs.writeFileSync(outPath, JSON.stringify(dm, null, 2), 'utf8');
console.log('✅ 从原型结构(PAGECFG)推出 data_model → ' + outPath);
console.log('   实体(' + Object.keys(entities).length + '): ' + (Object.keys(entities).join(', ') || '(无列表页)'));
console.log('   枚举: ' + Object.keys(enums).length + ' · 字段警告: ' + warn.length);
process.exit(0);
