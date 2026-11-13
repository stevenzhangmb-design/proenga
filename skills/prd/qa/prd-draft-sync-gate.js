#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   prd-draft 固定件同步闸 · prd-draft-sync-gate.js · 2026-10-08（零依赖·静态）
   ────────────────────────────────────────────────────────────────────────
   prd-draft.js 吐的固定件（操作日志固定说明语 / 查询类固定句 / 通知 4 列表头）必须
   与单一真理源 annotation-templates.md 【逐字一致】。这道闸断言它们都在真理源里出现，
   防 prd-draft 与模板漂移（漂了=吐错固定件=工具反而害人）。红 → exit 1。
   用法：node prd-draft-sync-gate.js
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const draft = fs.readFileSync(path.join(__dirname, '..', 'prd-draft.js'), 'utf8');
const tpl = fs.readFileSync(path.join(__dirname, '..', '..', 'pm-design', 'annotation-templates.md'), 'utf8');

// 从 prd-draft.js 抽出 3 个固定件常量的字面值
const grab = re => { const m = draft.match(re); return m ? m[1] : null; };
const LOG_INTRO = grab(/const LOG_INTRO\s*=\s*'([^']+)'/);
const LOG_QUERY = grab(/const LOG_QUERY\s*=\s*'([^']+)'/);
const NOTIF_HEAD = '| 通知场景 | 通知标题 | 通知内容 | 接收方 |';   // prd-draft NOTIF_TABLE 第一行

const checks = [
  ['操作日志固定说明语', LOG_INTRO],
  ['查询类固定句', LOG_QUERY],
  ['消息通知 4 列表头', NOTIF_HEAD],
];
let bad = 0;
console.log('\n════════ prd-draft 固定件同步闸（prd-draft ⇄ annotation-templates 逐字一致）════════');
for (const [name, val] of checks) {
  if (!val) { bad++; console.log('  ✗ ' + name + '：在 prd-draft.js 里没抽到（常量名改了？）'); continue; }
  if (tpl.indexOf(val) >= 0) console.log('  ✓ ' + name + ' 与真理源一致');
  else { bad++; console.log('  ✗ ' + name + ' 漂移！prd-draft 里是：「' + val.slice(0, 40) + '…」但 annotation-templates.md 里找不到这句'); }
}
console.log('──────────────────────────────');
console.log(bad ? '  ✗ 有红 FAIL ❌（' + bad + ' 项漂移）—— 同步 prd-draft 固定件到真理源原文' : '  ✓ 全绿 PASS ✅（固定件与真理源逐字一致）');
console.log('════════════════════════════════');
process.exit(bad ? 1 : 0);
