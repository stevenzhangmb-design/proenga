#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   生成 前端(.ts/.vue) 静态结构校验 · verify-ts.js · 零依赖
   ⚠️【非 vue-tsc 类型检查】——真类型检查需项目脚手架 + node_modules(vue/element-plus/@别名)。
   本校验只做能不装依赖就查的结构错（真会导致构建失败）：
     ① {} () [] 配平（跳过字符串/注释）
     ② .vue 必须有 <template> 与 <script setup>，且各标签配对
     ③ import 语句基本成形（from '...' 结尾）
   真类型/模板校验仍需 vue-tsc——本校验是"廉价前哨"。
   用法：node verify-ts.js <目录>     退出码 0=通过 · 1=有疑似
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const root = process.argv[2];
if (!root) { console.error('用法: node verify-ts.js <目录>'); process.exit(2); }

function collect(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collect(fp, acc);
    else if (/\.(ts|vue)$/.test(e.name)) acc.push(fp);
  }
  return acc;
}
// 配平（跳过 ' " ` 字符串 与 // /* */ 注释）
function balance(src, open, close) {
  let d = 0, s = null, line = false, block = false, esc = false, prev = '';
  for (const ch of src) {
    if (line) { if (ch === '\n') line = false; prev = ch; continue; }
    if (block) { if (prev === '*' && ch === '/') block = false; prev = ch; continue; }
    if (s) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === s) s = null; prev = ch; continue; }
    if (prev === '/' && ch === '/') { line = true; prev = ch; continue; }
    if (prev === '/' && ch === '*') { block = true; prev = ch; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { s = ch; prev = ch; continue; }
    if (ch === open) d++; else if (ch === close) d--;
    prev = ch;
  }
  return d;
}
function checkOne(fp) {
  const src = fs.readFileSync(fp, 'utf8');
  const problems = [];
  const isVue = fp.endsWith('.vue');
  // .vue：拆出 <script> 内容做括号配平（模板里的 {{ }} 不算 JS 花括号）
  let js = src;
  if (isVue) {
    const tpl = (src.match(/<template[\s>]/g) || []).length, tplc = (src.match(/<\/template>/g) || []).length;
    const scr = (src.match(/<script/g) || []).length, scrc = (src.match(/<\/script>/g) || []).length;
    if (tpl < 1) problems.push('缺 <template>');
    if (tpl !== tplc) problems.push(`<template> 标签不配对(开 ${tpl}/闭 ${tplc}·含 slot)`);
    if (!/<script setup/.test(src)) problems.push('缺 <script setup>');
    if (scr !== scrc) problems.push(`<script> 标签不配对(${scr}/${scrc})`);
    const m = src.match(/<script[^>]*>([\s\S]*?)<\/script>/);
    js = m ? m[1] : '';
  }
  const b = balance(js, '{', '}'); if (b !== 0) problems.push(`{} 不配平(差 ${b})`);
  const p = balance(js, '(', ')'); if (p !== 0) problems.push(`() 不配平(差 ${p})`);
  const k = balance(js, '[', ']'); if (k !== 0) problems.push(`[] 不配平(差 ${k})`);
  // import 基本成形
  for (const ln of js.split('\n')) {
    const t = ln.trim();
    if (/^import\b/.test(t) && !/from\s+['"][^'"]+['"]\s*;?$/.test(t) && !/^import\s+['"][^'"]+['"]\s*;?$/.test(t) && !/^import\s+type\b/.test(t))
      if (!/from\s+['"][^'"]+['"]/.test(t)) problems.push('import 语句不完整: ' + t.slice(0, 50));
  }
  return problems;
}
const files = collect(root, []);
console.log('\n════════ 生成 前端 静态结构校验（非 vue-tsc·前哨）════════');
if (!files.length) { console.log('  未发现 .ts/.vue'); process.exit(0); }
let bad = 0;
for (const fp of files) {
  const ps = checkOne(fp), nm = path.relative(root, fp);
  if (ps.length) { bad++; console.log('  ✗ ' + nm); ps.forEach(x => console.log('      · ' + x)); }
  else console.log('  ✓ ' + nm);
}
console.log('──────────────────────────────────────────────');
if (bad) { console.log(`  ❌ ${bad} 个文件有结构问题`); process.exit(1); }
console.log('  ✅ 全部通过结构校验（括号/标签配平·import 成形）·真类型检查仍需 vue-tsc');
process.exit(0);
