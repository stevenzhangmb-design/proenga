#!/usr/bin/env node
/**
 * proto-copy-writing-gate.js — 原型文案中文书面用语闸（机器闸 / 随包发）
 *
 * 2026-11-04 用户铁律：原型上的提示语、异常判断及所有文案，全部使用中文书面用语；
 *   不用「」（功能/页面/按钮用【】，状态/类型/提示原文用“”）；不用口语、简写、破折号旁注。
 *   规则正文见 skills/prd/SKILL.md「中文书面用语 / 直白写法铁律」。
 *
 * 只查【项目数据】三个字面量（SYSTEMS / NAV / PAGECFG）里含汉字的字符串；
 *   标准件自带文案（骨架、标注层）不在此闸范围；charRules / pattern / bad 等校验规则正则跳过。
 * 11-03 之前构建、之后未再构建的旧原型只提示不拦（不擅自改其他产品的存量原型）。
 *
 * 用法：node proto-copy-writing-gate.js [原型.html]　无参 → 自动发现 archive 里的交付原型
 * 退出码：0 通过 / 1 有红 / 2 用法错
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ORAL = ['就是', '其实', '说白了', '咱们', '搞定', '去哪儿', '打回来', '照开', '一眼看出', '兜底', '多了这张票',
  '号没被占用', '隔几分钟', '大白话', '白话原因', '怎么改', '谁来做', '改完怎么办', '不做任何操作', '——'];
const SKIP_KEYS = new Set(['charRules', 'pattern', 'bad', 'regex', 're']);

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

function checkOne(file) {
  const html = fs.readFileSync(file, 'utf8');
  const legacy = fs.statSync(file).mtime < new Date('2026-11-03T00:00:00');
  const seen = new Set(); let brk = 0; const brkEx = []; const oral = {};
  function walk(node, p) {
    if (typeof node === 'string') {
      if (!/[\u4e00-\u9fff]/.test(node) || seen.has(node)) return; seen.add(node);
      const t = node.replace(/<[^>]+>/g, '');
      const n = (t.match(/「/g) || []).length; if (n) { brk += n; if (brkEx.length < 5) brkEx.push(p + '：' + t.slice(Math.max(0, t.indexOf('「') - 10), t.indexOf('「') + 20)); }
      for (const w of ORAL) { const c = t.split(w).length - 1; if (c) { oral[w] = oral[w] || { n: 0, ex: p }; oral[w].n += c; } }
      return;
    }
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach((v, i) => walk(v, p + '[' + i + ']')); return; }
    for (const k of Object.keys(node)) { if (SKIP_KEYS.has(k)) continue; walk(node[k], p ? p + '.' + k : k); }
  }
  let parsed = 0;
  for (const decl of ['const SYSTEMS=', 'const NAV=', 'const PAGECFG=']) {
    const raw = grabLiteral(html, decl); if (!raw) continue;
    try { walk(JSON.parse(raw), decl.replace(/const |=/g, '')); parsed++; } catch (_) { /* 解析失败交给其它闸 */ }
  }
  console.log('  ' + path.basename(file) + (legacy ? '（旧原型·仅提示）' : ''));
  if (!parsed) { console.log('    ⊘ 未找到项目数据字面量，跳过'); return false; }
  const reds = [];
  if (brk) reds.push('仍有 ' + brk + ' 处「」——功能/页面/按钮须用【】，状态/类型/提示原文须用“”。例：' + brkEx.join(' ｜ '));
  const hits = Object.entries(oral);
  if (hits.length) reds.push('出现口语、简写或破折号旁注：' + hits.map(([w, o]) => w + '×' + o.n + '（如 ' + o.ex + '）').join('、'));
  if (!reds.length) { console.log('    ✅ 全部为中文书面用语'); return false; }
  reds.forEach(r => console.log((legacy ? '    ⚠ ' : '    ❌ ') + r));
  return !legacy;
}
function autoDiscover() {
  let dirs = []; try { dirs = require('./_archive-dir').archiveDirs(); } catch (_) {}
  const isDeliv = f => /装配版/.test(f) && /offline/i.test(f) && f.endsWith('.html') && !/分享版|备份|\.bak/i.test(f);
  const out = [];
  for (const d of dirs) {
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { continue; }
    for (const e of ents) {
      if (e.isFile() && isDeliv(e.name)) out.push(path.join(d, e.name));
      else if (e.isDirectory() && !/node_modules|_planning|vendor|assets|草稿/i.test(e.name)) {
        try { for (const f of fs.readdirSync(path.join(d, e.name))) if (isDeliv(f)) out.push(path.join(d, e.name, f)); } catch (_) {}
      }
    }
    if (out.length) break;
  }
  return [...new Set(out)];
}
const target = process.argv[2];
if (target && !fs.existsSync(target)) { console.error('✘ 目标不存在：' + target); process.exit(2); }
console.log('\n════════ ㊾ 原型文案书面用语闸 ════════');
const files = target ? [target] : require('./_sample-deliverable').orSample(autoDiscover());
if (!files.length) { console.log('  ⊘ 未找到交付原型，跳过'); process.exit(0); }
let red = false; for (const f of files) if (checkOne(f)) red = true;
if (red) { console.log('  FAIL ❌ —— 按 skills/prd/SKILL.md「中文书面用语铁律」改到 0 再交付'); process.exit(1); }
console.log('  PASS ✅'); process.exit(0);
