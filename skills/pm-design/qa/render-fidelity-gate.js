#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   ⓵ 渲染保真闸 —— 查「渲染出来对不对」，不是「配置里写没写」
   ────────────────────────────────────────────────────────────────────────
   2026-11-04 建。这是三层根治方案的第三层。前两层（骨架默认值、页型模板）
   管的是"写出来容易对"，这一层管的是"**最后呈现给用户的到底对不对**"。

   为什么必须有：2026-11-04 供应商平台实测到一个谁都没发现的 bug ——
     project-data 里 `listTools=[导出,自定义列]` + `toolsPos:'toolbar'` 写得
     **完全正确**，但交付件里那条工具条整个不渲染（骨架的 showSelToolbar
     判定里没算上 listTools），导出就这么凭空消失了。
   当时所有闸都是绿的：
     · ㊿列表标配闸查的是 **project-data 里有没有写** → 绿
     · ㊱全量交互回归查的是 **按钮点了有没有反应** → 按钮根本不存在，它也不报
   「配置 → 渲染」之间是一段**没有任何校验的空白**，这道闸就是补它。

   判什么（只卡**真系统一致率高、该写死**的项，出处 page-templates.json）：
     1. 列表页四件标配真的**渲染出来**了：勾选列 / 导出 / 自定义列 / 刷新
     2. 分页右对齐（真系统 182 样本 100% flex-end）
     3. 筛选区**没有**展开/收起（真系统 191 样本 100% 没有 → 多出来 = 画蛇添足）
     4. 状态页签是卡片式、在列表上方（95% / 93%）
     5. 表单 label 在上、字号 14px（96% / 98%）
     6. 表单页脚按钮固定在底部、居中（97% / 85%）
   一致率不到 80% 的项**不判红**（它们本来就随页面变），只在报告里列出来参考。

   ⚠️ 只对【模式 C：默认 UI 规范】生效。复刻模式 A 以对方系统实测为基线，
      这里的真值（某 OMS/WMS）不适用，自动跳过。

   用法：
     node render-fidelity-gate.js <project-data.json> [--pages a,b,c] [--port 9222]
   退出码：0 = 全绿；1 = 有不一致。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
try { require('../../_shared/qa/_tmp-sandbox'); } catch (_) {}
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const src = process.argv[2];
if (!src || !fs.existsSync(src)) {
  console.log('【⓵ 渲染保真闸】没有传入 project-data —— 跳过');
  console.log('   用法: node render-fidelity-gate.js <project-data.json> [--pages a,b] [--port 9222]');
  process.exit(0);
}
const pi = process.argv.indexOf('--port');
const PORT = pi > 0 ? process.argv[pi + 1] : '9222';
const gi = process.argv.indexOf('--pages');
const ONLY = gi > 0 ? String(process.argv[gi + 1]).split(',').map(s => s.trim()).filter(Boolean) : null;

let data;
try { data = JSON.parse(fs.readFileSync(src, 'utf8').replace(/^﻿/, '')); }
catch (e) { console.log('🔴 读不出 project-data：' + e.message); process.exit(1); }

/* 复刻模式 A 跳过（真值基线不是 某 OMS/WMS） */
const choiceStr = JSON.stringify(data.__DESIGN_CHOICE__ || data._choice || data.choice || {}) + String(data._mode || '');
if (/模式\s*A|"mode"\s*:\s*"A"|复刻|replica/i.test(choiceStr)) {
  console.log('【⓵ 渲染保真闸】复刻模式 A —— 以对方系统实测为基线，本闸跳过');
  process.exit(0);
}

/* 列表页 / 表单页清单（和 list-standard-gate 同一套认法：有 columns 且不在弹窗/详情里） */
const INNER = /^(dialogs?|modal|popup|detail|detailView|subTable|inner|tabsContent|sections|form|drawer)$/i;
const listPages = [], formPages = [];
(function walk(node, key, inner) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach(v => walk(v, key, inner)); return; }
  const id = node.id || node.key || node.pageId || key;
  if (!inner && id) {
    if (Array.isArray(node.columns) && node.columns.length >= 2) listPages.push(String(id));
    else if (Array.isArray(node.sections) && node.sections.length) formPages.push(String(id));
  }
  Object.keys(node).forEach(k => { if (k !== 'columns') walk(node[k], k, inner || INNER.test(k)); });
})(data, '', false);

let targets = [...new Set(listPages)].concat([...new Set(formPages)].filter(p => !listPages.includes(p)));
if (ONLY) {
  const miss = ONLY.filter(p => !targets.includes(p));
  if (miss.length) { console.log('🔴 --pages 里有不存在的页：' + miss.join('、') + '（防止静默少验）'); process.exit(1); }
  targets = ONLY;
}
if (!targets.length) { console.log('【⓵ 渲染保真闸】这份源里没有列表页/表单页 —— 跳过'); process.exit(0); }

/* ⚠️ 2026-11-04 实测补的封顶：这道闸**逐页开浏览器**，每页要等 Vue 挂载（约 2~4 秒）。
   事故现场：总闸裸跑时猜到的源是发票系统（46MB、457 个列表页候选），
   这道闸就开始逐页渲染 457 页 —— 必然撞 deliver-gate 的 300 秒超时判红，
   把一个本来健康的总闸拖成 FAIL，还白耗几十分钟。
   封顶规则：
     · --warn-only（源是猜来的，不是本次要交付的）→ 最多抽验 5 页
     · 平时                                       → 最多 12 页（够覆盖各种页型）
     · --all                                      → 全验（交付前想彻底过一遍时用）
   抽样取**列表页优先 + 均匀分布**，不是只取前 N 个（前 N 个常常是同一个模块的同类页）。 */
const WARN_ONLY_EARLY = process.argv.includes('--warn-only');
const CAP = process.argv.includes('--all') ? Infinity : (WARN_ONLY_EARLY ? 5 : 12);
let capped = false;
if (!ONLY && targets.length > CAP) {
  const step = targets.length / CAP;
  const picked = [];
  for (let i = 0; i < CAP; i++) picked.push(targets[Math.floor(i * step)]);
  capped = targets.length;
  targets = [...new Set(picked)];
}

/* ⚠️ 2026-11-04：--warn-only 表示这份源是**从 ledgers 猜来的**，不是本次要交付的项目。
   这道闸要【装配】并把 _bld.html 写进源所在目录 —— 那是**别人的地盘**，不能碰；
   而且装配一个 46MB 的源 + 逐页渲染要好几分钟，对一个不相干的项目毫无意义。
   所以猜来的源直接跳过整道闸，只提示怎么显式验它。 */
if (WARN_ONLY_EARLY) {
  console.log('【⓵ 渲染保真闸】跳过 —— 这份源是从 ledgers 猜的（' + path.basename(src) + '），不是本次要交付的项目。');
  console.log('   本闸要装配并在源目录写 _bld.html，不在别人的项目目录上做这件事。');
  console.log('   要验某个项目，显式跑：node render-fidelity-gate.js <它的 project-data.json>');
  process.exit(0);
}

/* 装配出预览（快路，85ms 级，不跑别的闸） */
const ASM = path.resolve(__dirname, 'assemble-prototype.js');   /* 装配器在 qa/ 下，不在 pm-design 根 */
const OUT = path.join(path.dirname(src), '_bld.html');
try { execFileSync('node', [ASM, src, OUT, '--fast'], { stdio: 'ignore', timeout: 180000 }); }
catch (e) { console.log('🔴 装配失败：' + e.message); process.exit(1); }
if (!fs.existsSync(OUT)) { console.log('🔴 装配没产出 ' + OUT); process.exit(1); }

/* ── 浏览器里抽【真实渲染结果】────────────────────────────────────────── */
const { connect } = require('../../rpa/_cdp');

const PROBE = `(function(){
  var R=function(e){return e.getBoundingClientRect();};
  var vis=function(e){ if(!e) return false; var r=R(e), s=getComputedStyle(e);
    return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'; };
  var o={};
  /* ① 列表四件标配：必须真的在 DOM 里 */
  var std=document.querySelector('.tb-std');
  o.hasTable=!![].slice.call(document.querySelectorAll('thead th')).filter(vis).length;
  o.cols=[].slice.call(document.querySelectorAll('thead th')).filter(vis).length;
  o.chkCol=!!(document.querySelector('thead th .el-checkbox'));
  o.stdTxt=std?(std.textContent||'').replace(/\\s+/g,''):'';
  o.hasExport=/导出|Export|Exportar/.test(o.stdTxt) ||
    [].slice.call(document.querySelectorAll('.sel-toolbar button,.sel-toolbar .el-button')).filter(vis)
      .some(function(b){return /导出|Export|Exportar/.test(b.textContent||'');});
  o.hasColCfg=/自定义列|Customize|Personalizar/.test(o.stdTxt);
  o.hasRefresh=!!document.querySelector('.tb-std .tb-refresh-ic');
  /* ② 分页对齐 */
  var pg=[].slice.call(document.querySelectorAll('.el-pagination')).filter(vis)[0];
  o.pager=pg?getComputedStyle(pg).justifyContent:null;
  /* ③ 筛选区有没有展开/收起（真系统 100% 没有） */
  var sb=document.querySelector('.search-box,.filter-box');
  o.filterFold=!!(sb&&/展开|收起|Expandir|Recolher/.test(sb.textContent||''));
  /* ④ 状态页签 */
  var tabs=[].slice.call(document.querySelectorAll('.status-tabs .stab')).filter(vis);
  o.statusTabs=tabs.length;
  if(tabs.length){ var s=getComputedStyle(tabs[0]);
    o.tabRadius=s.borderTopLeftRadius; o.tabH=Math.round(R(tabs[0]).height);
    o.tabsAboveTable=(function(){ var th=document.querySelector('thead th');
      return th? R(tabs[0]).bottom<=R(th).top+8 : true; })();
    o.tabsHaveCount=tabs.some(function(t){return /\\(\\d+\\)/.test(t.textContent||'');});
  }
  /* ⑤⑥ 表单 */
  var lab=document.querySelector('.el-form-item__label');
  if(lab){ var ls=getComputedStyle(lab);
    o.labFont=ls.fontSize;
    var fi=lab.closest('.el-form-item'), ct=fi&&fi.querySelector('.el-form-item__content');
    o.labTop=ct?(R(lab).bottom<=R(ct).top+4):null;
  }
  var ft=document.querySelector('.page-footer,.form-footer,.footer-btns,.dv-footer');
  if(ft){ var fs2=getComputedStyle(ft);
    o.footFixed=(fs2.position==='fixed'||fs2.position==='sticky');
    o.footAlign=fs2.justifyContent||fs2.textAlign; }
  o.jsErr=(window.__gateErrs||[]).slice(0,3);
  return JSON.stringify(o);
})()`;

(async () => {
  const cdp = await connect(PORT);
  const base = 'file:///' + OUT.replace(/\\/g, '/');
  const bad = [], warn = [];
  let checked = 0;

  for (const id of targets) {
    try {
      await cdp.send('Page.navigate', { url: base + '?page=' + encodeURIComponent(id) });
      await cdp.evalv('window.__gateErrs=[];window.addEventListener("error",function(e){window.__gateErrs.push(String(e.message))});');
      /* 等挂载：Vue + EP 要时间，按"有内容"判，不是固定 sleep */
      let ok = false;
      for (let t = 0; t < 40; t++) {
        await new Promise(r => setTimeout(r, 300));
        try { if (await cdp.evalv('!!(document.readyState==="complete"&&document.querySelector("#app *"))')) { ok = true; break; } } catch (_) {}
      }
      if (!ok) { bad.push({ 页: id, 项: '渲染', 实际: 'Vue 没挂上 / 页面崩了', 期望: '能渲染' }); continue; }
      await new Promise(r => setTimeout(r, 600));
      const r = JSON.parse(await cdp.evalv(PROBE) || '{}');
      checked++;
      const isList = listPages.includes(id) && r.hasTable;

      if (isList) {
        /* ① 四件标配必须**渲染出来**（不是配置里写了就算） */
        if (!r.chkCol)     bad.push({ 页: id, 项: '勾选列', 实际: '没渲染出来', 期望: '表格第 1 列是复选框（真系统 206 页里 172 页有）' });
        if (!r.hasExport)  bad.push({ 页: id, 项: '导出', 实际: '没渲染出来', 期望: '工具条右端有导出（真系统 98 页有）' });
        if (!r.hasColCfg)  bad.push({ 页: id, 项: '自定义列', 实际: '没渲染出来', 期望: '工具条右端有自定义列（2026-11-04 用户要求）' });
        if (!r.hasRefresh) bad.push({ 页: id, 项: '刷新图标', 实际: '没渲染出来', 期望: '工具条右端有 ⟳（真系统实测 20×20）' });
        /* ② 分页右对齐：真系统 182 样本 100% */
        if (r.pager && r.pager !== 'flex-end')
          bad.push({ 页: id, 项: '分页对齐', 实际: r.pager, 期望: 'flex-end（真系统 182 样本 100%）' });
        /* ③ 筛选区不许有展开/收起：真系统 191 样本 100% 没有 */
        if (r.filterFold)
          bad.push({ 页: id, 项: '筛选区展开/收起', 实际: '有', 期望: '没有（真系统 191 样本 100% 没有 —— 多出来就是画蛇添足）' });
        /* ④ 状态页签 */
        if (r.statusTabs) {
          if (r.tabsAboveTable === false)
            bad.push({ 页: id, 项: '状态页签位置', 实际: '不在列表上方', 期望: '列表上方（真系统 93%）' });
          if (r.tabsHaveCount === false)
            warn.push({ 页: id, 项: '状态页签计数', 实际: '页签没带 (N)', 期望: '真系统页签后面都有计数，如「全部 (478)」' });
        }
      }
      /* ⑤⑥ 表单（列表页里的新增弹窗也可能有，有 label 就查） */
      if (r.labFont && r.labFont !== '14px')
        bad.push({ 页: id, 项: '表单 label 字号', 实际: r.labFont, 期望: '14px（真系统 108 样本 98%）' });
      if (r.labTop === false)
        warn.push({ 页: id, 项: '表单 label 位置', 实际: 'label 在左', 期望: 'label 在上（真系统 96%，但有 4% 确实在左）' });
      if (r.footAlign && formPages.includes(id)) {
        if (!/center/.test(r.footAlign))
          warn.push({ 页: id, 项: '表单页脚对齐', 实际: r.footAlign, 期望: '居中（真系统 85%）' });
        if (r.footFixed === false)
          warn.push({ 页: id, 项: '表单页脚', 实际: '随内容流', 期望: '固定在视口底部（真系统 97%）' });
      }
      if ((r.jsErr || []).length)
        bad.push({ 页: id, 项: 'JS 报错', 实际: r.jsErr.join(' / '), 期望: '无报错' });
    } catch (e) {
      bad.push({ 页: id, 项: '抽取', 实际: e.message, 期望: '能抽到' });
    }
  }
  try { cdp.close(); } catch (_) {}

  console.log('【⓵ 渲染保真闸】逐页在浏览器里抽真实渲染结果，对 某 OMS/WMS 实测基线');
  console.log('  检查 ' + checked + '/' + targets.length + ' 页（列表 ' + listPages.length + ' · 表单 ' + formPages.length + '）');
  if (capped) console.log('  ⚠ 本次是**抽验**：这份源共 ' + capped + ' 页，均匀抽了 ' + targets.length +
    ' 页（逐页开浏览器很慢，全验会撞总闸超时）。交付前想全验：加 --all');
  if (warn.length) {
    console.log('\n  ⚠ 参考项（真系统一致率不到 100%，不判红）：');
    warn.slice(0, 12).forEach(w => console.log('     ' + w.页 + ' › ' + w.项 + '：' + w.实际 + ' —— ' + w.期望));
    if (warn.length > 12) console.log('     …另 ' + (warn.length - 12) + ' 条');
  }
  if (!bad.length) {
    console.log('\n✅ 渲染出来的样子和真系统基线一致 —— 四件标配都真在页面上，不是"配置里写了"');
    process.exit(0);
  }
  console.log('\n🔴 ' + bad.length + ' 处和真系统对不上（注意：这些是**渲染结果**，配置写对了也可能在这里红）：');
  const byPage = {};
  bad.forEach(b => { (byPage[b.页] = byPage[b.页] || []).push(b); });
  Object.keys(byPage).slice(0, 15).forEach(p => {
    console.log('   【' + p + '】');
    byPage[p].forEach(b => console.log('      ' + b.项 + '：实际 ' + b.实际 + ' | 期望 ' + b.期望));
  });
  const n = Object.keys(byPage).length;
  if (n > 15) console.log('   …另 ' + (n - 15) + ' 页');
  console.log('\n  「配置里写了」不等于「渲染出来了」—— 2026-11-04 供应商平台实测：listTools 写得完全正确，');
  console.log('  但骨架 showSelToolbar 判定里没算上它，整条工具条不渲染，导出凭空消失，而所有别的闸都是绿的。');
  /* --warn-only 同 list-standard-gate：猜来的源只警告，不追溯判死历史项目 */
  if (process.argv.includes('--warn-only')) {
    console.log('\n⚠ 只警告不判红：这份源不是本次显式要交付的项目（从 ledgers 猜的）。');
    process.exit(0);
  }
  process.exit(1);
})().catch(e => { console.log('🔴 闸自身出错：' + e.message); process.exit(1); });
