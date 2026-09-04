#!/usr/bin/env node
/**
 * product-filter-gate.js — 商品查询组合筛选一致性闸（机器闸 / 随包发）
 *
 * 目的：固化「商品查询条件一律用三段组合搜索」这条默认规范铁律
 *       （system-design-spec.md §5.3b 商品查询固定标准 / oms-wms-ui-extract §2.1.1）。
 *       防"各处又写零散 SKU/商品名称输入框"的漂移。
 *
 * 用法：node product-filter-gate.js <原型.html | 目录>
 * 退出码：0 全绿 / 1 有红(禁交付) / 2 用法错。
 *
 * 豁免：含 __NOT_A_PROTOTYPE__ / 分享版 / .bak / backup / 备份 / __DESIGN_SPEC_CUSTOM__（用户选了非默认规范）。
 *
 * 规则（对"默认规范"原型）：
 *   P1 每个页面的 filters 里，凡是"商品字段筛选"（label 或 fields 命中商品词表）
 *      必须是 type:'combo'（三段组合），否则红 = 零散商品筛选。
 *   P2 商品 combo 的 match 三选项须含「精确/模糊/前缀搜索」（缺前缀=警告，缺精确/模糊=红）。
 *   ※ 单号类筛选（label=申请单号/退回单号/充值单号…）即使占位符里提到 SKU，也不算商品字段（放行）。
 */
'use strict';
const fs = require('fs');
const path = require('path');

// 商品字段词表（label 命中即视为"商品字段"）
const PRODUCT_LABELS = ['SKU', 'SKU编号', '商品名称', '商品条形码', '参考SKU编号', '商品别名', '商品'];
// 单号类（doc-number）——即使占位符含 SKU 也放行（主字段是单号）
const DOCNO_LABELS = ['申请单号', '退回单号', '退货单号', '充值单号', '订单号', '单号', '发票号'];

function zh(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'object') return String(v.zh || v.t && (v.t.zh || v.t) || Object.values(v)[0] || '');
  return String(v);
}
function labelHits(label, list) { const s = zh(label); return list.some(w => s === w || s.indexOf(w) > -1); }

/** 从 `const NAME =` 之后括号配对提取完整字面量原文 */
function grabLiteral(src, decl) {
  const i = src.indexOf(decl);
  if (i < 0) return '';
  let p = i + decl.length;
  while (p < src.length && /\s/.test(src[p])) p++;
  const open = src[p];
  if (open !== '{' && open !== '[') return '';
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false, q = '';
  for (let j = p; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === q) inStr = false; continue; }
    if (c === '"' || c === "'") { inStr = true; q = c; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return src.slice(p, j + 1); }
  }
  return '';
}

function checkFile(file) {
  const html = fs.readFileSync(file, 'utf8');
  const base = path.basename(file);
  if (/__NOT_A_PROTOTYPE__|__DESIGN_SPEC_CUSTOM__/.test(html) || /分享版|\.bak|backup|备份/i.test(base)) {
    console.log('  ⊘ 跳过（豁免）：' + base);
    return { skip: true, fails: [] };
  }
  const lit = grabLiteral(html, 'const PAGECFG =') || grabLiteral(html, 'const PAGECFG=');
  if (!lit) { console.log('  ⊘ 跳过（无 PAGECFG）：' + base); return { skip: true, fails: [] }; }
  let cfg;
  try { cfg = JSON.parse(lit); }
  catch (e) { return { skip: false, fails: [{ page: '(PAGECFG)', msg: 'PAGECFG 不是合法 JSON，无法校验：' + e.message }] }; }

  const fails = [], warns = [];
  for (const [pid, page] of Object.entries(cfg)) {
    if (!page || !Array.isArray(page.filters)) continue;
    for (const f of page.filters) {
      if (!f || typeof f !== 'object') continue;
      const isDocNo = labelHits(f.label, DOCNO_LABELS);
      const isProductLabel = labelHits(f.label, PRODUCT_LABELS) && !isDocNo;
      const comboHasProductField = f.type === 'combo' && Array.isArray(f.fields) && f.fields.some(x => labelHits(x, PRODUCT_LABELS));
      const isProductFilter = isProductLabel || comboHasProductField;
      if (!isProductFilter) continue;
      // P1：商品字段必须 combo
      if (f.type !== 'combo') {
        fails.push({ page: pid, msg: '商品筛选「' + zh(f.label) + '」不是三段组合控件（type:combo）——零散商品筛选，违反默认规范 §5.3b' });
        continue;
      }
      // P2：match 三选项
      const match = (f.match || []).map(zh);
      if (!match.some(m => m.indexOf('精确') > -1) || !match.some(m => m.indexOf('模糊') > -1)) {
        fails.push({ page: pid, msg: '商品组合筛选「' + zh(f.label) + '」缺「精确/模糊搜索」匹配项' });
      } else if (!match.some(m => m.indexOf('前缀') > -1)) {
        warns.push({ page: pid, msg: '商品组合筛选「' + zh(f.label) + '」缺「前缀搜索」（规范建议三选项）' });
      }
    }
  }
  return { skip: false, fails, warns };
}

// ---------- main ----------
const arg = process.argv[2];
if (!arg) { console.error('用法：node product-filter-gate.js <原型.html | 目录>'); process.exit(2); }
let files = [];
try {
  const st = fs.statSync(arg);
  if (st.isDirectory()) files = fs.readdirSync(arg).filter(n => /^原型.*\.html$/.test(n) && !/分享版/.test(n)).map(n => path.join(arg, n));
  else files = [arg];
} catch (e) { console.error('✘ 读取失败：' + arg); process.exit(2); }

console.log('════════ 商品查询组合筛选一致性闸（默认规范 §5.3b）════════');
let anyFail = false;
for (const f of files) {
  const r = checkFile(f);
  if (r.skip) continue;
  if (r.fails.length === 0) {
    console.log('  ✓ ' + path.basename(f) + (r.warns && r.warns.length ? '（' + r.warns.length + ' 警告）' : ''));
  } else {
    anyFail = true;
    console.log('  ✗ ' + path.basename(f) + ' — ' + r.fails.length + ' 处红：');
    r.fails.forEach(x => console.log('      · [' + x.page + '] ' + x.msg));
  }
  (r.warns || []).forEach(x => console.log('      ⚠ [' + x.page + '] ' + x.msg));
}
console.log('──────────────────────────────');
if (anyFail) { console.log('  商品筛选闸 有红 FAIL ❌（商品查询须用统一三段组合控件）'); process.exit(1); }
console.log('  商品筛选闸 全绿 PASS ✅');
process.exit(0);
