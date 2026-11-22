#!/usr/bin/env node
/**
 * form-field-spec-gate.js — 表单字段规范检查（机器检查 / 随包发）
 *
 * 2026-11-22 用户定：选了默认 UI 设计规范的原型，所有表单（弹窗、整页新增/编辑表单）
 *   必须遵守默认设计规范和 PRD 字段规范。规则正文见 system-design-spec.md §7.6、§7.7。
 *
 * 查交付件里的项目数据（PAGECFG），只看【表单】：每页的 dialogs 和 pageForm。
 * 筛选区不在范围内（筛选区另有写法：无字段名、下拉默认“全部××”）；
 * 带表格的选择类弹窗（选单据、选商品）上方的下拉是查询条件，同样不查。
 *
 *   ① 下拉没有业务默认值，却会被自动选中第一项
 *      骨架对没写 value / default 的下拉会兜底选第一项。表单里这会让用户以为“已经选好了”。
 *      正确写法：有业务默认值就写 value；没有就写 optional:true，显示“请选择 + 字段名”。
 *   ② 表单下拉里出现“全部……”选项（那是筛选区的写法，表单里没有“全部”这种取值）
 *   ③ 编辑弹窗没回显原值：标题是“编辑……”的弹窗，可填字段既没写 editFrom（从点的那一行取值）、
 *      也没写 value → 打开是空的，等于让用户重填一遍
 *
 * 用法：node form-field-spec-gate.js <交付件.html> [--warn]
 *   --warn：只提示不拦（给还没按新规范改过的存量原型用）
 * 退出码：0 通过 / 1 有红 / 2 用法错
 */
'use strict';
const fs = require('fs');
const path = require('path');

function grabLiteral(src, decl) {
  const i = src.indexOf(decl);
  if (i < 0) return null;
  let p = i + decl.length;
  while (p < src.length && /\s/.test(src[p])) p++;
  const open = src[p];
  if (open !== '{' && open !== '[') return null;
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let j = p; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return src.slice(p, j + 1); }
  }
  return null;
}
/* 多语文字取中文：'|中|英|葡' / {zh:…} / 普通字符串 */
const zh = v => {
  if (v && typeof v === 'object') return String(v.zh || v.label || '');
  const s = String(v == null ? '' : v);
  return s.charAt(0) === '|' ? (s.split('|')[1] || '') : s;
};
const optText = o => zh(o && typeof o === 'object' && !('zh' in o) ? (o.label || o.value || '') : o);

function fieldsOf(dlg) {
  const out = [];
  (dlg.fields || []).forEach(f => out.push(f));
  (dlg.sections || []).forEach(s => (s && s.fields || []).forEach(f => out.push(f)));
  return out.filter(f => f && typeof f === 'object');
}

function check(file, warnOnly) {
  const html = fs.readFileSync(file, 'utf8');
  const raw = grabLiteral(html, 'const PAGECFG=');
  console.log('  ' + path.basename(file) + (warnOnly ? '（只提示）' : ''));
  if (!raw) { console.log('    ⊘ 没找到项目数据，跳过'); return false; }
  let pc; try { pc = JSON.parse(raw); } catch (_) { console.log('    ⊘ 项目数据解析失败，跳过'); return false; }

  const autoFirst = [], allOpt = [], noEcho = [];
  const scan = (where, f, isEdit) => {
    const t = f.type || 'text';
    const lab = zh(f.label);
    if (!lab) return;
    if (t === 'select' && Array.isArray(f.options) && f.options.length && !f.multiple) {
      if (f.value == null && typeof f.default !== 'number' && !f.optional && f.editFrom == null)
        autoFirst.push(where + '›' + lab + '（会自动选中“' + optText(f.options[0]) + '”）');
      if (f.options.some(o => /^全部/.test(optText(o)))) allOpt.push(where + '›' + lab);
    }
    if (isEdit && !/^(readonly|switch|radio|checkbox|upload|file|html|button|tag)$/.test(t)
        && f.editFrom == null && f.value == null && !f.fromRow) noEcho.push(where + '›' + lab);
  };
  for (const [pid, p] of Object.entries(pc || {})) {
    if (!p || typeof p !== 'object') continue;
    for (const [dn, d] of Object.entries(p.dialogs || {})) {
      if (!d || typeof d !== 'object') continue;
      /* 带表格的选择类弹窗（选单据、选商品）：表格上方的下拉是查询条件，按筛选区写法（“全部××”），不在本检查范围 */
      if (d.table || d.picker) continue;
      const title = zh(d.title) || dn;
      const isEdit = /^(编辑|修改)/.test(title);
      fieldsOf(d).forEach(f => scan(pid + '›' + title, f, isEdit));
    }
    if (p.pageForm && Array.isArray(p.pageForm.sections)) {
      const title = zh(p.pageForm.title) || pid;
      p.pageForm.sections.forEach(s => (s && s.fields || []).forEach(f => f && scan(pid + '›' + title, f, false)));
    }
  }

  const reds = [];
  if (autoFirst.length) reds.push('有 ' + autoFirst.length + ' 个表单下拉没有默认值，却会被自动选中第一项。有业务默认值就写 value，没有就写 optional:true（显示“请选择 + 字段名”）：\n      ' + autoFirst.slice(0, 12).join('\n      ') + (autoFirst.length > 12 ? '\n      ……共 ' + autoFirst.length + ' 个' : ''));
  if (allOpt.length) reds.push('有 ' + allOpt.length + ' 个表单下拉里有“全部……”选项（那是筛选区写法，表单里删掉）：' + allOpt.slice(0, 8).join('、'));
  if (noEcho.length) reds.push('有 ' + noEcho.length + ' 个编辑弹窗字段打开是空的，没回显原值。写 editFrom:列下标（可改的）或 type:\'readonly\', fromRow:{col}（不可改的）：' + noEcho.slice(0, 8).join('、'));
  if (!reds.length) { console.log('    ✅ 表单下拉默认值、选项、编辑回显都合规'); return false; }
  reds.forEach(r => console.log((warnOnly ? '    ⚠ ' : '    ❌ ') + r));
  return !warnOnly;
}

const args = process.argv.slice(2);
const warnOnly = args.includes('--warn');
const target = args.find(a => !a.startsWith('--'));
if (!target) { console.error('用法：node form-field-spec-gate.js <交付件.html> [--warn]'); process.exit(2); }
if (!fs.existsSync(target)) { console.error('✘ 目标不存在：' + target); process.exit(2); }
console.log('\n════════ 表单字段规范检查 ════════');
if (check(target, warnOnly)) { console.log('  FAIL ❌ —— 按 system-design-spec.md §7.6、§7.7 改到 0 再交付'); process.exit(1); }
console.log('  PASS ✅'); process.exit(0);
