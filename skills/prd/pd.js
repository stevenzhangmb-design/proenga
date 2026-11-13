#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   pd.js —— prd-data 快速查看（改 PRD 用·p.js 的 PRD 版·2026-10-09）
   ────────────────────────────────────────────────────────────────────────
   为什么：改 PRD 前要先看"这个功能点现在写了啥"。prd-data.json 动辄几 MB，
   整份读进来 token 爆炸。pd.js 像 p.js 一样【定点查】：列功能点 / 看某个功能点的
   字段规范+7节用例规则 / 取某一节全文 / 全局找一句话——不整份读。
   【只读】：改 PRD 的写入走 /anno-inject（anno-server 会重算 md/docx），直接改 prd-data
   会让 md/docx 脱节，所以 pd.js 不写、只帮你看清再去 inject 改。

   用法：node pd.js <prd-data.json> <子命令> …
     list                      列所有功能点：key · 类型 · 有无字段规范/用例规则
     show  <功能点>             这个功能点：字段规范(分组+字段) + 7节用例规则(哪节有内容)
     get   <功能点> [节]        取全文：节=preconditions/operation_flow/postconditions/
                                validations/prompt_messages/message_notifications/operation_log
                                （或中文：前置/流程/后置/校验/提示/通知/日志）；省节=整个 use_cases
     find  "<文字>"             这句话在哪个功能点（fp_name/字段名/规则正文里找）

   功能点可写全 key（商品管理.商品库.新增-无规格）或只写末段（新增-无规格）/任意子串，自动匹配。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const LOC = ['zh', 'en', 'pt', 'spa'];
const isI18n = v => !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length > 0 && Object.keys(v).every(k => LOC.includes(k));
const L = v => isI18n(v) ? (v.zh || Object.values(v)[0]) : v;
const flat = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

const argv = process.argv.slice(2);
if (argv.length < 2) { console.log(fs.readFileSync(__filename, 'utf8').split('════')[1]); process.exit(1); }
const PD = argv[0], CMD = argv[1], rest = argv.slice(2);
if (!fs.existsSync(PD)) { console.error('✗ 找不到 ' + PD); process.exit(1); }
const data = JSON.parse(fs.readFileSync(PD, 'utf8').replace(/^﻿/, ''));
const FPS = data.function_points || {};

const SECTIONS = [
  ['preconditions', '前置条件', ['前置']], ['operation_flow', '操作流程', ['流程', '操作']],
  ['postconditions', '后置条件', ['后置']], ['validations', '校验规则', ['校验']],
  ['prompt_messages', '提示消息', ['提示']], ['message_notifications', '消息通知', ['通知']],
  ['operation_log', '操作日志', ['日志']]
];
const secKey = q => { const s = SECTIONS.find(x => x[0] === q || x[1] === q || x[2].some(a => q.indexOf(a) >= 0)); return s ? s[0] : q; };
const fsOf = fp => fp.field_specs || fp._draft_fieldSpecs || null;
const ucOf = fp => fp.use_cases || fp._draft_useCaseRules || null;
const hasContent = v => v != null && !(Array.isArray(v) && !v.length) && !(typeof v === 'string' && !v.trim()) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length);

function matchFp(q) {
  if (FPS[q]) return q;
  const ks = Object.keys(FPS);
  const hit = ks.filter(k => k === q || k.endsWith('.' + q) || k.indexOf(q) >= 0 || flat(L((FPS[k] || {}).fp_name)).indexOf(q) >= 0);
  if (!hit.length) { console.error('✗ 没找到功能点：' + q + '（node pd.js ' + PD + ' list 看全部）'); process.exit(1); }
  if (hit.length > 1) console.error('⚠ 匹配到 ' + hit.length + ' 个，取第一个「' + hit[0] + '」。更精确就写全 key。');
  return hit[0];
}
const fieldNames = fs0 => { const out = []; ((fs0 && fs0.groups) || []).forEach(g => (g.fields || g.rows || []).forEach(f => out.push(flat(L(f.name || f.field || f.label))))); return out.filter(Boolean); };

function cmdList() {
  const ks = Object.keys(FPS);
  console.log('共 ' + ks.length + ' 个功能点：');
  ks.forEach(k => {
    const fp = FPS[k]; const fs0 = fsOf(fp); const uc = ucOf(fp);
    const nSec = uc ? SECTIONS.filter(s => hasContent(uc[s[0]])).length : 0;
    console.log('  ' + k.padEnd(34) + (flat(L(fp.fp_type)) || '?').padEnd(6) + ' 字段' + (fs0 ? fieldNames(fs0).length : 0) + ' · 用例' + nSec + '/7节');
  });
}
function cmdShow() {
  const k = matchFp(rest[0]); const fp = FPS[k]; const fs0 = fsOf(fp); const uc = ucOf(fp);
  console.log('【' + k + '】' + (flat(L(fp.fp_name)) || '') + '　类型=' + (flat(L(fp.fp_type)) || '?') + (fp.page_key ? '　页=' + fp.page_key : ''));
  if (Array.isArray(fp.menu_path)) console.log('  归属：' + fp.menu_path.map(L).join(' / '));
  if (fs0) { console.log('  字段规范：'); ((fs0.groups) || []).forEach(g => console.log('    [' + flat(L(g.group_name)) + '] ' + (g.fields || g.rows || []).map(f => flat(L(f.name || f.field)) + (String(L(f.required)).match(/是|必填|true/) ? '*' : '')).join(' | '))); }
  else console.log('  字段规范：(无)');
  if (uc) { console.log('  用例规则（7节）：'); SECTIONS.forEach(s => { const v = uc[s[0]]; const ok = hasContent(v); const brief = ok ? (Array.isArray(v) ? v.length + ' 条' : (typeof v === 'object' ? 'fixed_intro+明细' : flat(L(v)).slice(0, 30))) : '空'; console.log('    ' + (ok ? '✓' : '·') + ' ' + s[1].padEnd(5) + ' ' + brief); }); }
  else console.log('  用例规则：(无·待生成)');
}
function cmdGet() {
  const k = matchFp(rest[0]); const fp = FPS[k]; const uc = ucOf(fp);
  if (!rest[1]) { console.log(k + '.use_cases =\n' + JSON.stringify(uc, null, 1)); return; }
  const sk = secKey(rest[1]);
  if (!uc) { console.log('(无 use_cases)'); return; }
  console.log(k + '.' + sk + ' =\n' + JSON.stringify(uc[sk], null, 1));
}
function cmdFind() {
  const q = rest[0]; if (!q) { console.error('✗ find 要给一句文字'); process.exit(1); }
  let n = 0;
  Object.keys(FPS).forEach(k => {
    const blob = flat(L(FPS[k].fp_name)) + ' ' + JSON.stringify(FPS[k]);
    if (blob.indexOf(q) >= 0) { n++; console.log('  ' + k + '　' + flat(L(FPS[k].fp_name))); }
  });
  console.log('「' + q + '」命中 ' + n + ' 个功能点');
}

if (CMD === 'list') cmdList();
else if (CMD === 'show') cmdShow();
else if (CMD === 'get') cmdGet();
else if (CMD === 'find') cmdFind();
else { console.error('✗ 不认识的子命令：' + CMD + '（list/show/get/find）'); process.exit(1); }
