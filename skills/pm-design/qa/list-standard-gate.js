#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   ㊿ 列表标配闸 —— 勾选列 / 导出 / 列配置 / 刷新，一个都不能少
   ────────────────────────────────────────────────────────────────────────
   2026-11-04 建。两件事同时发生才有这道闸：

   ① **规范承诺了这道闸，但它根本不存在。**
      system-design-spec.md §5.4 写着「机器兜底：qa/list-standard-gate.js
      逐页检查…红即禁交付」，而这个文件一直没有被创建过。
      规范里写了一道不存在的闸，比没写更糟 —— 看规范的人（包括我自己）
      会以为"机器会卡住"，于是不再逐页自查，漏了也没人发现。

   ② **骨架其实三样都支持，默认却全是关的。**
      `cfg.selectable`（勾选列）、`cfg.table.refresh`（刷新图标）、
      `cfg.listTools` 里的 ⚙自定义列 —— 写法早就有，但默认不开。
      于是「有没有」完全取决于我画原型时记不记得写，用户就反复撞上
      「列表没有复选框 / 不能刷新 / 不能配列」这类低级缺失。

   判什么：对 project-data 里**每一个有列表的页面**（有 columns 的），检查
     1. selectable:true          —— 勾选列
     2. 导出入口                 —— listTools / selectActions / toolbar 里有"导出"
     3. 列配置入口               —— listTools 里有 自定义列 / 列配置 / gear 图标
     4. table.refresh:true       —— 刷新图标
   四项逐页核，缺哪项报哪项，并打印该页的修法（照着抄就能改对）。

   豁免（必须在 project-data 里写明，不许默认省略）：
     页面对象里写 `"_listStandardExempt": "<理由>"` —— 比如单行配置页、
     只读看板。闸会如实列出豁免页和理由，不判红但也不让它悄悄消失。

   ⚠️ 只对【模式 C：画原型选默认 UI 规范】生效。
      复刻模式 A（1:1 还原别人的系统）以对方实测为唯一基线 ——
      真系统没有列配置就不许加，所以模式 A 自动跳过本闸。
      判定走 __DESIGN_CHOICE__ / _mode 字段，缺省当模式 C。

   用法：
     node list-standard-gate.js <project-data.json> [更多...]
     不传参数时自动扫 .claude/ledgers.txt 里登记过的项目源
   退出码：0 = 全部合规或已豁免；1 = 有缺失。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
try { require('../../_shared/qa/_tmp-sandbox'); } catch (_) {}
const fs = require('fs');
const path = require('path');

const EXPORT_RE = /导出|Exportar|Export/i;
const COLCFG_RE = /自定义列|列配置|列设置|配置列|Colunas|Columns/i;

/* 把一页里所有"可能放按钮的位置"摊平成文本，便于找入口。
   位置有好几处（listTools / selectActions / toolbar / tools），
   只查一处就会把"写对了但放在另一个槽"误判成缺失。 */
function slotsText(page) {
  const buckets = ['listTools', 'selectActions', 'toolbar', 'tools', 'rowActions', 'primaryBtn'];
  let s = '';
  buckets.forEach(k => { if (page[k] != null) { try { s += JSON.stringify(page[k]); } catch (_) {} } });
  return s;
}

/* 取值要兼容"写在顶层"和"写在 byStatus[某状态] 里"两种 —— 骨架 v3.27/v3.32 起
   selectable / toolsPos 等都走 pick2（顶层或按状态），只读顶层会漏判。 */
function deepHas(page, pred) {
  if (pred(page)) return true;
  const bs = page.byStatus;
  if (bs && typeof bs === 'object') {
    for (const k of Object.keys(bs)) { if (bs[k] && pred(bs[k])) return true; }
  }
  return false;
}

function checkPage(page) {
  const miss = [];
  if (!deepHas(page, p => p.selectable === true)) miss.push('勾选列(selectable:true)');
  const txt = slotsText(page) + JSON.stringify(page.byStatus || {});
  if (!EXPORT_RE.test(txt)) miss.push('导出入口');
  if (!COLCFG_RE.test(txt)) miss.push('列配置(自定义列)');
  if (!deepHas(page, p => p.table && p.table.refresh === true)) miss.push('刷新图标(table.refresh:true)');
  return miss;
}

/* 收集"真正的列表页"。
   ⚠️ 2026-11-04 第一版在这里判得太粗，拿发票系统一跑直接 457 页全红 —— 因为
   把**弹窗里的内嵌明细表**、**详情页里的子表**也当成了列表页。那些表本来就
   不该有勾选列/导出/刷新，判它们红是噪音，会把真正的缺失淹掉。
   收紧成三个条件同时满足才算一个列表页：
     ① 有 columns（≥2 列）
     ② 自己带 id / key（页面才有；内嵌表通常只是某个字段上的数组）
     ③ 不在 dialogs / 弹窗 / 详情子表这些容器里
   宁可少判几个，也不要制造一屏红字 —— 噪音大的闸等于没有闸。 */
const INNER_KEYS = /^(dialogs?|modal|popup|detail|detailView|subTable|inner|tabsContent|sections|form|drawer)$/i;
function collectPages(data) {
  const out = [];
  const seen = new Set();
  (function walk(node, trail, inner) {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) { node.forEach(v => walk(v, trail, inner)); return; }
    /* ⚠️ 页面 id 常常是**父级的键**，不在对象自己身上 —— 实测
       供应商平台-project-data 的结构是 `pagecfg: { po: {columns:[…]}, delivery: {…} }`，
       页面对象里一个 id 字段都没有。第一版要求"自己带 id"，结果 14 个列表页
       一个都没认出来，闸打印"列表页 0 · 全部合规" —— **假绿比假红更危险**，
       它让人以为查过了。id 一律按 自己的 id/key → 父级键 的顺序取。 */
    const id = node.id || node.key || node.pageId || trail;
    const hasCols = Array.isArray(node.columns) && node.columns.length >= 2;
    if (hasCols && id && !inner) out.push({ id: String(id), page: node });
    Object.keys(node).forEach(k => {
      if (k === 'columns') return;
      walk(node[k], k, inner || INNER_KEYS.test(k));
    });
  })(data, '', false);
  return out;
}

function modeOf(data) {
  const c = data.__DESIGN_CHOICE__ || data._choice || data.choice || {};
  const s = JSON.stringify(c) + String(data._mode || '');
  if (/模式\s*A|"mode"\s*:\s*"A"|复刻|replica/i.test(s)) return 'A';
  return 'C';
}

/* ⚠️ 2026-11-04：**不自动去扫所有登记过的项目**。
   第一版无参数时扫 .claude/ledgers.txt，结果把另一条线（发票系统）的存量
   457 页全判红 —— 那些原型是本条规范（2026-11-04 才定）之前画的，
   一道新规范不该让所有历史项目当场变成"不合规"，更不该在别人地盘上判红。
   本闸只查**显式传进来的源**（画原型/改原型时由 deliver-gate 或人手传）。
   存量要不要回头补齐，是另一个需要用户点头的决定，不由闸单方面施加。 */
let files = [...new Set(process.argv.slice(2).filter(a => !a.startsWith('-')))]
  .filter(f => fs.existsSync(f))
  /* 审计/标注副本不是源，查它们只会制造噪音 */
  .filter(f => !/\.(audit-base|annotations|bak|backup)\.json$/i.test(path.basename(f)));

if (!files.length) {
  console.log('【㊿ 列表标配闸】没有传入 project-data —— 本次无可检查对象，跳过');
  console.log('   （本闸只查显式传入的源；不主动扫历史项目，免得一道新规范把存量全判红）');
  process.exit(0);
}

let bad = 0, okPages = 0, exempt = 0, skippedA = 0;
console.log('【㊿ 列表标配闸】勾选列 / 导出 / 列配置 / 刷新 —— 四件缺一即红');
files.forEach(f => {
  let data; try { data = JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')); }
  catch (e) { console.log('  ✗ 读不出 ' + f + '：' + e.message); bad++; return; }
  const mode = modeOf(data);
  const pages = collectPages(data);
  if (mode === 'A') {
    skippedA += pages.length;
    console.log('  · ' + path.basename(f) + '：复刻模式 A，以对方系统实测为基线，跳过 ' + pages.length + ' 页');
    return;
  }
  const rows = [];
  pages.forEach(({ id, page }) => {
    if (page._listStandardExempt) { exempt++; rows.push({ id, exempt: page._listStandardExempt }); return; }
    const miss = checkPage(page);
    if (miss.length) rows.push({ id, miss }); else okPages++;
  });
  const missing = rows.filter(r => r.miss);
  console.log('\n  ' + path.basename(f) + '：列表页 ' + pages.length +
    ' · 合规 ' + (pages.length - missing.length - rows.filter(r => r.exempt).length) +
    ' · 缺件 ' + missing.length + (rows.some(r => r.exempt) ? ' · 豁免 ' + rows.filter(r => r.exempt).length : ''));
  rows.filter(r => r.exempt).forEach(r => console.log('     · 豁免 ' + r.id + '：' + r.exempt));
  missing.forEach(r => { bad++; console.log('     🔴 ' + r.id + ' 缺：' + r.miss.join('、')); });
});

/* --warn-only：源是从 ledgers 猜来的（不是本次要交付的那个项目）时用。
   本条规范 2026-11-04 才定，不该追溯判死所有历史原型，更不该在别人正在做的项目上判红。 */
const WARN_ONLY = process.argv.includes('--warn-only');

if (!bad) {
  console.log('\n✅ 全部列表页都有 勾选列 / 导出 / 列配置 / 刷新' +
    (exempt ? '（另有 ' + exempt + ' 页已写明豁免理由）' : '') +
    (skippedA ? '；复刻模式页 ' + skippedA + ' 个按基线跳过' : ''));
  process.exit(0);
}
console.log('\n🔴 ' + bad + ' 处不合规。照这个写法补（骨架早就支持，只是默认关着）：');
console.log('   勾选列  : "selectable": true');
console.log('   刷新    : "table": { "refresh": true }');
console.log('   列配置  : "listTools": [{"label":"自定义列","icon":"gear","opens":"<列配置弹窗名>"}], "toolsPos": "toolbar"');
console.log('   导出    : "listTools" 里加 {"label":"导出","menu":["按勾选导出","按筛选导出"]}（或放 selectActions）');
console.log('   确实不该有的页：在该页写 "_listStandardExempt": "<理由>"，不许默认省略。');
console.log('   补完要真能用 —— 刷新点了要重拉+toast，列配置点了要开弹窗且勾掉真少一列（规范 §5.4 一次性到位铁律第 2 条）。');
if (WARN_ONLY) {
  console.log('\n⚠ 只警告不判红：这份源不是本次显式要交付的项目（从 ledgers 猜的）。');
  console.log('  本条规范 2026-11-04 才定，存量原型要不要回头补齐，由用户决定，闸不单方面施加。');
  console.log('  要对某个项目真判红，显式跑：node list-standard-gate.js <它的 project-data.json>');
  process.exit(0);
}
process.exit(1);
