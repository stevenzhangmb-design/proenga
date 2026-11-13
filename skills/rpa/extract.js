#!/usr/bin/env node
/* RPA·extract.js —— 抽【列表/筛选/查询页】结构 + 计算样式 → JSON（1:1 复刻的真值来源）。
   抽：筛选控件(占位符/类型/宽高/底色) · 表格列(表头文案/宽/字号/色/底色/padding) ·
       按钮(文案/主次/高宽/配色/圆角) · 标签页 · 分页 · 令牌(body/主按钮/输入框)。
   用法：node extract.js <out.json> [port=9222]（先 launch.js 开到目标列表页） */
'use strict';
const { connect } = require('./_cdp');
const fs = require('fs');
const out = process.argv[2] || 'extract.json';
const port = process.argv[3] || 9222;
const FN = `(() => {
  const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const cs = (el, props) => { const s = getComputedStyle(el); const o = {}; props.forEach(p => o[p] = s[p]); return o; };
  const txt = el => (el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : '');
  const BTN = ['height','minWidth','padding','fontSize','fontWeight','color','backgroundColor','borderRadius','borderColor','borderWidth','fontFamily'];
  const FLD = ['height','width','fontSize','color','backgroundColor','borderRadius','borderColor'];
  const filters = [];
  document.querySelectorAll('.el-input, .el-select, .el-date-editor, .el-textarea').forEach(w => {
    if (!vis(w)) return; const r = w.getBoundingClientRect(); if (r.top > 520) return;
    const inp = w.querySelector('input,textarea');
    filters.push({ ph: (inp && inp.getAttribute('placeholder')) || '', cls: w.className.split(' ').filter(c=>/el-(input|select|date|textarea)/.test(c)).join(' '), w: Math.round(r.width), h: Math.round(r.height), style: inp ? cs(inp, FLD) : null });
  });
  const cols = [];
  document.querySelectorAll('.el-table__header th, table thead th').forEach(th => { if (!vis(th)) return; cols.push({ label: txt(th), w: Math.round(th.getBoundingClientRect().width), style: cs(th, ['fontSize','fontWeight','color','backgroundColor','padding','height']) }); });
  const btns = [];
  document.querySelectorAll('button, .el-button').forEach(b => { if (!vis(b)) return; const t = txt(b); if (!t) return; const r = b.getBoundingClientRect(); btns.push({ label: t, primary: /el-button--primary/.test(b.className), y: Math.round(r.top), w: Math.round(r.width), style: cs(b, BTN) }); });
  const tabs = [...document.querySelectorAll('.el-tabs__item, [role="tab"]')].filter(vis).map(txt);
  const pg = document.querySelector('.el-pagination');
  const pager = pg ? { text: txt(pg) } : null;
  const primaryBtn = [...document.querySelectorAll('.el-button--primary')].filter(vis)[0];
  const anyInput = [...document.querySelectorAll('.el-input__inner')].filter(vis)[0];
  const tokens = { body: cs(document.body, ['fontFamily','fontSize','color','backgroundColor']), primaryButton: primaryBtn ? cs(primaryBtn, BTN) : null, input: anyInput ? cs(anyInput, FLD) : null };
  return { url: location.href, title: document.title, filters, cols, btns, tabs, pager, tokens };
})()`;
(async () => {
  const cdp = await connect(port);
  const data = await cdp.evalv(FN);
  fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
  console.log('抽取完成 →', out);
  console.log('  筛选:', data.filters.length, '· 列:', data.cols.length, '· 按钮:', data.btns.length, '· 页签:', data.tabs.join('/'));
  cdp.close(); process.exit(0);
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
