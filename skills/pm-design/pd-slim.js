#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   project-data 无损瘦身 · pd-slim.js（随包·零依赖·2026-11-13）
   ────────────────────────────────────────────────────────────────────────
   用法：
     node pd-slim.js <in.json> <out.json> [--report] [--no-dedupe] [--styles] [--line=200]
     node pd-slim.js --expand <slim.json> <out.json>     还原成普通 project-data（缩进 1，和 p.js 存盘格式一样）

   做三件事（全部无损：装配器读入后展开出来的对象和原件逐键逐序相等 → 原型 HTML 逐字节一样）：
     ① 紧凑排版（默认·对所有读 project-data 的工具都透明）：短于 --line 字符的对象/数组写成一行，
        长的照旧逐行缩进 1。仍是普通 JSON，Grep/Edit 定点改照常可用。
     ② 重复子树共享（默认开·--no-dedupe 关）：完全相同的行/对象（≥ 200 字符、出现 ≥ 2 次）只存一份到
        顶层 "_pdslim".shared，原位置写 {"$pd":"r<n>"}。三语对象 {zh,en,pt} 本身绝不合并、不改写。
     ③ 样式字典（默认关·--styles 开）：非三语字符串里的 style="..." 换成 {{pdS:n}}，原文存 "_pdslim".styles。
        三语对象里的字符串一个字不动（三语完整性闸和后续翻译依赖原文）。
   ★ 写出前自检：把结果展开后和原件 JSON.stringify 逐字比较，不等就不写文件、退出码 3。
   ★ 读取方：assemble-prototype.js 已在读入时自动展开（旧数据无 "_pdslim" → 原样不动·输出逐字节一致）。
     其它直接读 project-data 的脚本（p.js / mockgen / scaffold / 部分 qa 闸）不认识 ② ③，
     用了 ② ③ 的文件要先 --expand 还原再交给它们改；只用 ① 的文件对它们完全透明。
   退出码：0 成功；2 用法/读取错误；3 自检不等（未写文件）；4 原件里已有保留字（$pd / _pdslim / {{pdS:），未处理。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const crypto = require('crypto');

const LOC = ['zh', 'en', 'pt', 'spa'];
const isTri = o => o && typeof o === 'object' && !Array.isArray(o) && (() => { const ks = Object.keys(o); return ks.length > 0 && ks.every(k => LOC.includes(k)); })();
const isRef = o => o && typeof o === 'object' && !Array.isArray(o) && typeof o.$pd === 'string' && Object.keys(o).length === 1;
const STY_RE = /\{\{pdS:(\d+)\}\}/g;
const setOwn = (obj, k, v) => { if (k === '__proto__') Object.defineProperty(obj, k, { value: v, enumerable: true, writable: true, configurable: true }); else obj[k] = v; };

/* ── 展开（装配器与 --expand 共用）：无 _pdslim → 原对象原样返回（零开销·旧数据零变化） ── */
function expand(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data) || !Object.prototype.hasOwnProperty.call(data, '_pdslim')) return data;
  const meta = data._pdslim || {};
  const shared = meta.shared || {}, styles = meta.styles || {};
  const hasSty = Object.keys(styles).length > 0;
  const fixStr = s => (hasSty && s.indexOf('{{pdS:') >= 0) ? s.replace(STY_RE, (m, n) => {
    if (!Object.prototype.hasOwnProperty.call(styles, n)) throw new Error('样式字典缺 ' + n); return styles[n]; }) : s;
  const stack = [];
  function ex(n) {
    if (typeof n === 'string') return fixStr(n);
    if (!n || typeof n !== 'object') return n;
    if (Array.isArray(n)) { const a = new Array(n.length); for (let i = 0; i < n.length; i++) a[i] = ex(n[i]); return a; }
    if (isRef(n)) {
      const id = n.$pd;
      if (!Object.prototype.hasOwnProperty.call(shared, id)) throw new Error('共享表缺 ' + id);
      if (stack.includes(id)) throw new Error('共享表循环引用 ' + id);
      stack.push(id); const v = ex(shared[id]); stack.pop(); return v;
    }
    const o = {}; for (const k in n) if (Object.prototype.hasOwnProperty.call(n, k)) setOwn(o, k, ex(n[k])); return o;
  }
  const out = {};
  for (const k in data) if (Object.prototype.hasOwnProperty.call(data, k) && k !== '_pdslim') setOwn(out, k, ex(data[k]));
  return out;
}

/* ── 紧凑排版：短容器一行，长容器缩进 1（与 JSON.stringify(x,null,1) 同风格） ── */
function fmt(v, line) {
  const parts = [];
  (function w(x, ind) {
    const s = JSON.stringify(x);
    if (x === null || typeof x !== 'object' || s.length <= line) { parts.push(s); return; }
    const pad = '\n' + ' '.repeat(ind + 1), end = '\n' + ' '.repeat(ind);
    if (Array.isArray(x)) {
      if (!x.length) { parts.push('[]'); return; }
      parts.push('[');
      x.forEach((y, i) => { parts.push((i ? ',' : '') + pad); w(y === undefined ? null : y, ind + 1); });
      parts.push(end + ']');
    } else {
      const ks = Object.keys(x).filter(k => x[k] !== undefined && typeof x[k] !== 'function');
      if (!ks.length) { parts.push('{}'); return; }
      parts.push('{');
      ks.forEach((k, i) => { parts.push((i ? ',' : '') + pad + JSON.stringify(k) + ': '); w(x[k], ind + 1); });
      parts.push(end + '}');
    }
  })(v, 0);
  return parts.join('');
}

/* ── 瘦身 ── */
function slim(orig, opt) {
  const MIN = opt.min || 200;
  // 保留字检查：原件里出现就不处理（避免把原有数据误当成引用/样式占位）
  let clash = Object.prototype.hasOwnProperty.call(orig, '_pdslim') ? '_pdslim' : '';
  (function w(n) { if (clash) return;
    if (typeof n === 'string') { if (opt.styles && n.indexOf('{{pdS:') >= 0) clash = '{{pdS:'; return; }
    if (!n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach(w); return; }
    if (Object.prototype.hasOwnProperty.call(n, '$pd')) { clash = '$pd'; return; }
    for (const k in n) w(n[k]); })(orig);
  if (clash) return { clash };

  const styles = {}; const styIdx = new Map(); let styHits = 0;
  // ③ 样式字典（只动非三语字符串）
  function sty(n, tri) {
    if (typeof n === 'string') {
      if (!opt.styles || tri || n.indexOf('style="') < 0) return n;
      return n.replace(/style="[^"]*"/g, m => { let id = styIdx.get(m); if (id === undefined) { id = String(styIdx.size + 1); styIdx.set(m, id); styles[id] = m; } styHits++; return '{{pdS:' + id + '}}'; });
    }
    if (!n || typeof n !== 'object') return n;
    if (Array.isArray(n)) return n.map(x => sty(x, tri));
    const t = tri || isTri(n); const o = {}; for (const k in n) setOwn(o, k, sty(n[k], t)); return o;
  }
  let work = {}; for (const k in orig) setOwn(work, k, sty(orig[k], false));

  // ② 重复子树共享：自底向上算哈希 + 大小，再自顶向下替换
  const shared = {}; let refN = 0;
  if (opt.dedupe) {
    const info = new Map(); // node -> {h, size}
    const count = new Map();
    function hs(n) {
      if (n === null || typeof n !== 'object') { const s = JSON.stringify(n); return { h: 'p' + s, size: s.length }; }
      const H = crypto.createHash('sha1'); let size = 2;
      if (Array.isArray(n)) { H.update('A'); for (const x of n) { const c = hs(x); H.update(c.h.length + ':' + c.h); size += c.size + 1; } }
      else { H.update('O'); for (const k in n) { const c = hs(n[k]); H.update(JSON.stringify(k) + c.h.length + ':' + c.h); size += k.length + 3 + c.size + 1; } }
      const r = { h: 'h' + H.digest('base64'), size }; info.set(n, r); count.set(r.h, (count.get(r.h) || 0) + 1); return r;
    }
    for (const k in work) hs(work[k]);
    const idOf = new Map(); const uses = new Map();
    function dd(n) {
      if (!n || typeof n !== 'object') return n;
      const r = info.get(n);
      if (r && r.size >= MIN && count.get(r.h) >= 2 && !isTri(n)) {
        let id = idOf.get(r.h);
        if (!id) { id = 'r' + (++refN); idOf.set(r.h, id); shared[id] = null; shared[id] = inner(n); }
        uses.set(id, (uses.get(id) || 0) + 1);
        return { $pd: id };
      }
      return inner(n);
    }
    function inner(n) {
      if (Array.isArray(n)) return n.map(dd);
      const o = {}; for (const k in n) setOwn(o, k, dd(n[k])); return o;
    }
    const w2 = {}; for (const k in work) setOwn(w2, k, dd(work[k])); work = w2;
    // 只被用一次的共享项（父级被共享后子级计数虚高）→ 回填原位
    const once = new Set([...uses].filter(([, c]) => c < 2).map(([id]) => id));
    if (once.size) {
      const fill = n => { if (!n || typeof n !== 'object') return n;
        if (Array.isArray(n)) return n.map(fill);
        if (isRef(n) && once.has(n.$pd)) return fill(shared[n.$pd]);
        const o = {}; for (const k in n) setOwn(o, k, fill(n[k])); return o; };
      const w3 = {}; for (const k in work) setOwn(w3, k, fill(work[k])); work = w3;
      for (const id of Object.keys(shared)) if (once.has(id)) delete shared[id]; else shared[id] = fill(shared[id]);
    }
    // 重新编号 r1..rN（文件好读）
    const ren = new Map(); let i = 0; for (const id of Object.keys(shared)) ren.set(id, 'r' + (++i));
    const rn = n => { if (!n || typeof n !== 'object') return n; if (Array.isArray(n)) return n.map(rn);
      if (isRef(n)) return { $pd: ren.get(n.$pd) }; const o = {}; for (const k in n) setOwn(o, k, rn(n[k])); return o; };
    const w4 = {}; for (const k in work) setOwn(w4, k, rn(work[k])); work = w4;
    const s2 = {}; for (const [id, v] of Object.entries(shared)) s2[ren.get(id)] = rn(v);
    Object.keys(shared).forEach(k => delete shared[k]); Object.assign(shared, s2);
  }
  const nShared = Object.keys(shared).length, nSty = Object.keys(styles).length;
  if (nShared || nSty) {
    const meta = { v: 1, note: '由 pd-slim.js 生成的共享表/样式字典；装配器读入时自动展开。改这里=改所有引用处；要单独改某一处先 node pd-slim.js --expand 还原' };
    if (nShared) meta.shared = shared;
    if (nSty) meta.styles = styles;
    work._pdslim = meta;
  }
  return { out: work, nShared, nSty, styHits };
}

/* ── CLI ── */
if (require.main === module) {
  const args = process.argv.slice(2);
  const flags = args.filter(a => a.startsWith('--')); const pos = args.filter(a => !a.startsWith('--'));
  const has = f => flags.includes(f);
  const lineArg = flags.find(f => f.startsWith('--line=')); const LINE = lineArg ? parseInt(lineArg.slice(7), 10) || 200 : 200;
  if (pos.length < 2) { console.error('用法: node pd-slim.js <in.json> <out.json> [--report] [--no-dedupe] [--styles] [--line=200]\n      node pd-slim.js --expand <slim.json> <out.json>'); process.exit(2); }
  const [inP, outP] = pos;
  let raw, data;
  const t0 = Date.now();
  try { raw = fs.readFileSync(inP, 'utf8').replace(/^﻿/, ''); data = JSON.parse(raw); }
  catch (e) { console.error('读取/解析失败: ' + e.message); process.exit(2); }
  const bytesIn = Buffer.byteLength(raw, 'utf8');
  if (has('--expand')) {
    const full = expand(data);
    fs.writeFileSync(outP, JSON.stringify(full, null, 1), 'utf8');
    console.log('✅ 已还原 → ' + outP + '（' + (fs.statSync(outP).size / 1048576).toFixed(1) + ' MB）');
    process.exit(0);
  }
  const origFull = expand(data); // 输入本身是瘦身件也能再瘦（先展开）
  const r = slim(origFull, { dedupe: !has('--no-dedupe'), styles: has('--styles') });
  if (r.clash) { console.error('原件里已有保留字 "' + r.clash + '"，为免误判不处理（退出码 4）'); process.exit(4); }
  // 自检：展开后逐字等于原件
  const want = JSON.stringify(origFull), got = JSON.stringify(expand(r.out));
  if (want !== got) { console.error('❌ 自检不等：展开结果和原件不一致，未写文件'); process.exit(3); }
  const text = fmt(r.out, LINE);
  if (JSON.stringify(expand(JSON.parse(text))) !== want) { console.error('❌ 自检不等（排版后重读），未写文件'); process.exit(3); }
  fs.writeFileSync(outP, text, 'utf8');
  const bytesOut = fs.statSync(outP).size;
  const mb = b => (b / 1048576).toFixed(1) + ' MB';
  console.log('✅ 已瘦身 → ' + outP + '：' + mb(bytesIn) + ' → ' + mb(bytesOut) + '（-' + Math.round((1 - bytesOut / bytesIn) * 100) + '%）·自检：展开后与原件逐字相同');
  if (has('--report')) {
    const minified = Buffer.byteLength(want, 'utf8');
    console.log('  · 原件不含空白时 ' + mb(minified) + '（排版空白占 ' + mb(bytesIn - minified) + '）');
    console.log('  · 共享子树 ' + r.nShared + ' 份' + (has('--no-dedupe') ? '（已关）' : ''));
    console.log('  · 样式字典 ' + r.nSty + ' 条 / 替换 ' + r.styHits + ' 处' + (has('--styles') ? '' : '（未开·加 --styles）'));
    console.log('  · 用时 ' + (Date.now() - t0) + ' ms');
    if (r.nShared || r.nSty) console.log('  ⚠ 用了共享/样式字典：p.js、mockgen、scaffold 等直接读 JSON 的工具要改它前，先 node pd-slim.js --expand 还原');
  }
}

module.exports = { expand, slim, fmt };
