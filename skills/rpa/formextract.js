#!/usr/bin/env node
/* RPA·formextract.js —— 抽【新增/编辑/查看】表单结构 + 计算样式 → JSON（1:1 复刻表单的真值来源）。
   布局无关：以每个可见控件为锚，找 label（上方/左侧文字），量控件宽高、label 位置/颜色/字号、
   列数(按 x 聚类)、字段行距、是整页还是弹窗(.el-dialog 宽)、底部按钮。
   用法：node formextract.js <out.json> [port=9222]（先 launch.js/act.js 开到新增或编辑页/弹窗） */
'use strict';
const { connect } = require('./_cdp');
const fs = require('fs');
const out = process.argv[2] || 'form.json';
const port = process.argv[3] || 9222;
const FN = `(() => {
  const vis = el => { if (!el) return false; const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
  const cs = (el, props) => { const s = getComputedStyle(el); const o = {}; props.forEach(p => o[p] = s[p]); return o; };
  const txt = el => (el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : '');
  const dialog = [...document.querySelectorAll('.el-dialog')].filter(vis)[0];
  const dialogInfo = dialog ? { width: Math.round(dialog.getBoundingClientRect().width), title: txt(dialog.querySelector('.el-dialog__title')), titleStyle: cs(dialog.querySelector('.el-dialog__title')||dialog, ['fontSize','fontWeight','color']) } : null;
  const sections = [];
  document.querySelectorAll('.el-divider__text, .form-section-title, h2, h3, .section-title, b, strong').forEach(h => { if (vis(h) && txt(h) && txt(h).length < 40 && !h.querySelector('input,button')) { const st = cs(h, ['fontSize','fontWeight']); if (parseInt(st.fontWeight) >= 600) sections.push({ text: txt(h), style: cs(h, ['fontSize','fontWeight','color','marginTop','marginBottom']) }); } });
  const items = [];
  const controls = [...document.querySelectorAll('.el-input, .el-select, .el-date-editor, .el-textarea, .el-input-number')].filter(vis);
  controls.forEach(control => {
    const cr = control.getBoundingClientRect(); if (cr.top > 3000) return;
    let labelText = '', labelEl = null, wrapper = control, labelPos = 'top';
    for (let up = 0; up < 3 && !labelText; up++) {
      wrapper = wrapper.parentElement; if (!wrapper) break;
      const cand = [...wrapper.children].filter(ch => ch !== control && !ch.contains(control) && (ch.textContent || '').trim() && ch.getBoundingClientRect().width > 0);
      const above = cand.find(ch => ch.getBoundingClientRect().bottom <= cr.top + 6);
      const left = cand.find(ch => ch.getBoundingClientRect().right <= cr.left + 6);
      labelEl = above || left; if (labelEl) { labelText = (labelEl.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 40); labelPos = above ? 'top' : 'left'; }
    }
    const inp = control.querySelector('input,textarea');
    items.push({ label: labelText, labelPos, required: labelEl ? /\\*/.test(labelText) : false, x: Math.round(cr.left), y: Math.round(cr.top), controlW: Math.round(cr.width), controlH: Math.round(cr.height), controlType: control.className.split(' ').find(c => /^el-(input|select|date|textarea|input-number)/.test(c)), labelStyle: labelEl ? cs(labelEl, ['fontSize','fontWeight','color','lineHeight','marginBottom']) : null, ph: inp ? inp.getAttribute('placeholder') : '' });
  });
  const xs = [...new Set(items.map(it => it.x))].sort((a,b)=>a-b);
  const colClusters = []; xs.forEach(x => { if (!colClusters.some(c => Math.abs(c - x) < 30)) colClusters.push(x); });
  const footer = [...document.querySelectorAll('.el-dialog__footer, .form-footer, .page-footer')].filter(vis)[0];
  const footerBtns = (footer ? [...footer.querySelectorAll('button,.el-button')] : [...document.querySelectorAll('button,.el-button')]).filter(vis).map(b => txt(b)).filter(t => /Salvar|Cancelar|Guardar|Confirmar|确定|取消|保存|返回/.test(t));
  return { url: location.href, title: document.title, isDialog: !!dialog, dialog: dialogInfo, cols: colClusters.length, colX: colClusters, itemCount: items.length, sections, items, footerBtns };
})()`;
(async () => {
  const cdp = await connect(port);
  const data = await cdp.evalv(FN);
  fs.writeFileSync(out, JSON.stringify(data, null, 2), 'utf8');
  console.log('表单抽取 →', out);
  console.log('  弹窗?', data.isDialog, '· 列数:', data.cols, '(x=' + (data.colX||[]).join(',') + ') · 字段:', data.itemCount, '· 底部:', data.footerBtns.join('/'));
  cdp.close(); process.exit(0);
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
