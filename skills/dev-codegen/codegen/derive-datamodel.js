#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   阶段1 · prd-data → data_model 推导桥 · derive-datamodel.js · 零依赖
   ────────────────────────────────────────────────────────────────────────
   把【真实原型 prd-data】里 function_points[fp]._draft_fieldSpecs（Markdown 字段表）
   → 推导成生成器要吃的【data_model】（DB 类型/长度/可空/枚举 自动推·照 §3 规则）。
   桥通了 = 生成器不再吃我手编样例，而吃【真原型真实字段】。
   【类型推导 §3】金额/币种→DECIMAL(14,2)·日期时间→DATETIME·日期→DATE·数字/整数→INT·
     下拉+已知选项→枚举TINYINT·上传/文件/图片→VARCHAR(255)(url)·文本→VARCHAR(约束里的位数,默认255)。
   【可空】必填「是」→NOT NULL·否→NULL。【长度】约束里「N~M位/字符」「最大M」「不超过M」「≤M」取 M。
   【英文列名】中文推不出规范英文名 → 用词表(glossary.json: {中文字段名:英文col})；缺则 field_N + ⚠️（需人补）。
   【实体英文名】从 page_key 推（OMS-recharge-list → recharge）。
   用法：node derive-datamodel.js <prd-data.json> <out-data_model.json> [glossary.json]
   ⚠️ 表关系(外键)/接口细节 仍需人确认（本桥只推单表字段·输出后由 AI/研发补 fk/api）。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const [, , inPath, outPath, fpFilter, gloPath] = process.argv;
if (!inPath || !outPath) { console.error('用法: node derive-datamodel.js <prd-data.json> <out.json> [fp关键词过滤] [glossary.json]'); process.exit(2); }
const prd = JSON.parse(fs.readFileSync(inPath, 'utf8').replace(/^﻿/, ''));
const GLO = gloPath && fs.existsSync(gloPath) ? JSON.parse(fs.readFileSync(gloPath, 'utf8')) : {};
// 内置常用词表（可被外部 glossary.json 覆盖/补充）
const BASE_GLO = {
  '付款方式': 'payment_method', '充值金额': 'amount', '金额': 'amount', '交易号': 'transaction_no',
  '上传水单': 'voucher_url', '备注': 'remark', '名称': 'name', '状态': 'status', '类型': 'type',
  '数量': 'qty', '客户': 'customer_id', '商品': 'goods_id', '仓库': 'warehouse_id', '单号': 'order_no',
  '创建时间': 'create_time', '手机号': 'mobile', '邮箱': 'email', '地址': 'address'
};
const glo = Object.assign({}, BASE_GLO, GLO);
const warn = [];

function toCol(zh) {
  if (glo[zh]) return glo[zh];
  warn.push(`字段「${zh}」无英文列名映射 → 用占位·需人补词表`);
  return 'field_' + Buffer.from(zh).toString('hex');   // ★ 全名 hex·不截断：旧 slice(0,8) 只取前4字节→同前缀中文名(审核结果/审核时间/审核原因)全撞成 fieldE5aea1e6→Java 重复字段编译错。根因修。
}
function maxLen(constraint) {
  let m = constraint.match(/(\d+)\s*[~～至\-]\s*(\d+)\s*(?:位|字符|个字)/); if (m) return +m[2];
  m = constraint.match(/(?:最大|不超过|最多|上限|≤|<=|长度建议[^0-9]*\d+[~～\-])\s*(\d+)/); if (m) return +m[1];
  m = constraint.match(/(\d+)\s*(?:位|字符|个字)(?:以内|以下)/); if (m) return +m[1];
  return null;
}
function deriveType(typeRaw, constraint) {
  const t = (typeRaw || '') + ' ' + (constraint || '');
  if (/金额|币种|价格|费用|BRL|CNY|R\$|￥|价\b/.test(t)) {
    const sc = (constraint.match(/(\d+)\s*位小数/) || [])[1]; return { type: 'decimal', scale: sc ? +sc : 2 };
  }
  if (/日期时间|时间日期|datetime|年月日.*时/.test(t)) return { type: 'datetime' };
  if (/(^|[^时])日期|date\b/.test(t) && !/时间/.test(typeRaw)) return { type: 'date' };
  if (/上传|文件|图片|附件|水单|照片|image|upload/.test(t)) return { type: 'varchar', len: 255, note: 'url' };
  if (/下拉|单选|选择|枚举|radio|select/.test(typeRaw)) {
    const opts = extractOptions(constraint);
    if (opts.length) return { type: 'tinyint', enumVals: opts };
    return { type: 'varchar', len: maxLen(constraint) || 32 };
  }
  if (/开关|是否|switch|布尔|boolean/.test(t)) return { type: 'tinyint' };
  if (/数字|整数|数量|个数|number|int\b/.test(typeRaw) && !/金额/.test(t)) return { type: /小数|金额/.test(t) ? 'decimal' : 'int' };
  // 默认文本
  return { type: 'varchar', len: maxLen(constraint) || 255 };
}
function extractOptions(constraint) {
  // 从"（转账）"或"（A/B/C）"或"选项：A、B、C"提取
  let m = constraint.match(/[（(]([^）)]{1,40})[）)]/);
  let raw = m ? m[1] : '';
  if (!raw) { m = constraint.match(/选项[：:]\s*([^\n；;。]{1,60})/); raw = m ? m[1] : ''; }
  if (!raw) return [];
  return raw.split(/[、\/,，]/).map(s => s.trim()).filter(s => s && !/[a-zA-Z]{4,}/.test(s) && s.length <= 12);
}
// 解析 markdown 字段表 → [{name,typeRaw,required,constraint}]
function parseTable(md) {
  if (!md || typeof md !== 'string' || md.indexOf('|') < 0) return [];
  const rows = md.split('\n').map(l => l.trim()).filter(l => l.startsWith('|'));
  const out = [];
  for (const r of rows) {
    const cells = r.split('|').map(c => c.trim()).filter((c, i, a) => i > 0 && i < a.length - 1 || (i > 0 && a[a.length - 1] !== ''));
    const c = r.split('|').slice(1, -1).map(x => x.trim());
    if (c.length < 3) continue;
    if (/字段名称|^---|字段名$/.test(c[0]) || /^-+$/.test(c[0])) continue;
    out.push({ name: c[0], typeRaw: c[1] || '', required: /是|必填|必选|✓|Y/i.test(c[2] || ''), constraint: c[c.length - 1] || '' });
  }
  return out;
}

// ── 收集：按 system+module 聚合字段（多个动作 fp 的字段表去重合并成一个实体）──
const fps = prd.function_points || {};
const buckets = {}; // key = entityName → {system, module, pageKey, fields:Map}
for (const [fpk, fp] of Object.entries(fps)) {
  // 跳过首页看板/统计区(zone-*/home page_key)——那是仪表盘小部件·非实体字段
  if (/^zone-/i.test(fpk) || /home|dashboard|看板|首页/i.test((fp.page_key || '') + fpk)) continue;
  // 可选：只取指定功能点(如"编辑"·取表单字段最干净·避免混入查询列/审核字段)
  if (fpFilter && !fpk.includes(fpFilter)) continue;
  const fields = parseTable(fp._draft_fieldSpecs);
  if (!fields.length) continue;
  const pageKey = fp.page_key || '';
  // 实体英文名：page_key 去掉 system 前缀与 list/detail/add/edit 后缀
  let ent = pageKey.replace(/^[A-Za-z]+-/, '').replace(/-(list|detail|view|add|edit|manage).*$/i, '').replace(/[^A-Za-z0-9]+/g, '') || 'entity';
  ent = ent.replace(/(^\w)/, m => m.toLowerCase());
  const b = buckets[ent] || (buckets[ent] = { system: fp.system || '', module: (fp.menu_name || fp.fp_name || ''), pageKey, fields: new Map() });
  for (const f of fields) if (!b.fields.has(f.name)) b.fields.set(f.name, f);
}

const enums = {}, entities = {}, functionPoints = {};
for (const [ent, b] of Object.entries(buckets)) {
  const cols = [];
  for (const f of b.fields.values()) {
    const d = deriveType(f.typeRaw, f.constraint);
    const _colName = toCol(f.name);
    // ★ 跳过映射到基类保留列的业务字段：id/tenant_id/create_time/update_time 由 TenantBasePO 提供，
    //   再声明会与基类审计字段【重复/遮蔽】（如业务字段「创建时间」→create_time 撞审计 createTime → Java 重复变量编译错）。根因修。
    if (['id', 'tenant_id', 'create_time', 'update_time'].includes(_colName)) continue;
    const col = { field: f.name, col: _colName, type: d.type, nullable: !f.required, comment: f.name + (f.constraint ? '·' + f.constraint.replace(/\s+/g, '').slice(0, 24) : '') };
    if (d.len) col.len = d.len;
    if (d.scale != null) { col.scale = d.scale; }
    if (d.enumVals) {
      const ek = col.col.replace(/_id$/, '') + '_enum';
      enums[ek] = { comment: f.name, values: d.enumVals.map((z, i) => ({ code: i + 1, zh: z })) };
      col.enum = ek; col.type = 'tinyint';
    }
    if (/唯一|unique|不能重复/.test(f.constraint)) col.unique = true;
    cols.push(col);
  }
  // ★ 列名去重兜底：占位/词表若仍产生同名 col（真有重复字段·或残余碰撞）→ 后者补 _2/_3，杜绝 Java「重复变量」编译错
  const _seen = {};
  for (const c of cols) {
    if (_seen[c.col] == null) _seen[c.col] = 1;
    else { _seen[c.col]++; c.col = c.col + '_' + _seen[c.col]; }
  }
  const table = 'wms_' + ent.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '');
  entities[ent] = { table, label: b.module, comment: b.module, columns: cols };
  const base = '/api/' + (b.system || 'oms').toLowerCase() + '/' + ent.replace(/([A-Z])/g, '-$1').toLowerCase();
  const qCols = cols.filter(c => c.enum || c.unique || /name|no|code|status/.test(c.col)).slice(0, 3).map(c => c.col.replace(/_([a-z])/g, (_, x) => x.toUpperCase()));
  functionPoints[b.module + '.' + ent + '.新增'] = {
    entity: ent,
    api: {
      list: { method: 'GET', path: base, query: qCols },
      detail: { method: 'GET', path: base + '/{id}' },
      create: { method: 'POST', path: base },
      update: { method: 'PUT', path: base + '/{id}' },
      delete: { method: 'DELETE', path: base + '/{id}' }
    }
  };
}

const out = { _note: '由 derive-datamodel.js 从真实原型 prd-data 推导（DB类型/长度/可空/枚举 自动·英文列名走词表·表关系/接口细节需人确认）', data_model: { enums, entities }, function_points: functionPoints };
fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
console.log('════════ prd-data → data_model 推导桥 ════════');
console.log('  实体:', Object.keys(entities).join(', ') || '(无·未找到字段表)');
for (const [e, ent] of Object.entries(entities)) console.log(`  ${e}(${ent.table}): ${ent.columns.length} 列 [` + ent.columns.map(c => `${c.col}:${c.type}${c.len ? '(' + c.len + ')' : ''}${c.enum ? '·枚举' : ''}`).join(', ') + ']');
console.log('  枚举:', Object.keys(enums).join(', ') || '无');
if (warn.length) { console.log('  ⚠️ 需人补:'); [...new Set(warn)].forEach(w => console.log('     · ' + w)); }
console.log('  → ' + outPath);
process.exit(0);
