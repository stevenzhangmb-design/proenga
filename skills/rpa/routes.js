#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   routes.js · 从已登录的真系统里【导出完整路由表】—— 抓全的前提
   ────────────────────────────────────────────────────────────────────────
   2026-10-29 建。为什么必须有它：

     在此之前我是"点菜单 → 抓这一页"，抓了 11 个页面就以为覆盖了系统。
     实测从 某 WMS 的 Vue router 里导出来：**221 条路由、123 个候选列表页**。
     也就是说此前的覆盖率不到 10%，而且**没有任何机制能发现这件事** ——
     菜单要悬停才展开、二级菜单藏在里面，靠点是点不全的。

     SPA 的路由表就是这个系统的"全部页面清单"，它在前端代码里，直接取最可靠。

   取法：Vue 3 的 app 实例挂在 #app.__vue_app__，路由表走
   `config.globalProperties.$router.getRoutes()`；Vue 2 走 #app.__vue__.$router。

   用法：
     node routes.js <port> [--out routes.json] [--list-only]
       --list-only  只输出候选列表页（滤掉 详情/编辑/新增/打印 这类从属页）
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
try { require('../_shared/qa/_tmp-sandbox'); } catch (_) {}
const fs = require('fs');
const { connect } = require('./_cdp');

/* 从属页：带参数的、以及详情/编辑/新增/打印/结果页 —— 它们要从列表页点进去，
   不能直接导航（直接开往往是空白或报错），所以不作为抓取入口。 */
const SUB = /(:|\/detail|\/details|\/edit|\/view|\/add|\/create|\/designer|\/sign|\/received|\/print|\/preview|\/result|\/success|\/404|\/login|\/redirect|\/scan|\/batchAdd)/i;

const EXPR = `(function(){
  var app = document.querySelector('#app');
  var vm = app && (app.__vue_app__ || app.__vue__);
  var rs = null;
  try {
    if (vm && vm.config && vm.config.globalProperties && vm.config.globalProperties.$router)
      rs = vm.config.globalProperties.$router.getRoutes();      // Vue 3
    else if (vm && vm.$router) rs = vm.$router.getRoutes ? vm.$router.getRoutes() : null;  // Vue 2
  } catch (e) {}
  if (!rs) return JSON.stringify({ ok: false, why: '没取到 router 实例（可能不是 Vue，或还没登录进系统）' });
  return JSON.stringify({ ok: true, origin: location.origin,
    paths: rs.map(function(r){ return r.path; }).filter(Boolean) });
})()`;

(async () => {
  const port = +(process.argv[2] || 9222);
  const ai = f => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
  const out = ai('--out');
  const listOnly = process.argv.includes('--list-only');

  const c = await connect(port);
  try {
    try { await c.send('Page.bringToFront'); } catch (_) {}
    const r = JSON.parse(await c.evalv(EXPR) || '{}');
    if (!r.ok) { console.error('✗ ' + (r.why || '取路由失败')); process.exit(1); }

    const all = [...new Set(r.paths)].filter(p => p && p !== '/').sort();
    const pages = all.filter(p => !SUB.test(p));
    const byMod = {};
    pages.forEach(p => { const m = p.split('/')[1] || '其它'; (byMod[m] = byMod[m] || []).push(p); });

    console.log('【路由表】' + r.origin);
    console.log('  全部路由 ' + all.length + ' 条 · 候选列表页 ' + pages.length + ' 条 · 模块 ' + Object.keys(byMod).length + ' 个');
    Object.keys(byMod).sort().forEach(m => console.log('    ' + m.padEnd(20) + byMod[m].length + ' 页'));

    if (out) {
      fs.writeFileSync(out, JSON.stringify({
        origin: r.origin, 导出时间: new Date().toISOString(),
        全部路由: all, 候选列表页: pages, 按模块: byMod
      }, null, 1), 'utf8');
      console.log('  → ' + out);
    }
    if (listOnly) pages.forEach(p => console.log(p));
  } finally { try { c.close(); } catch (_) {} }
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
