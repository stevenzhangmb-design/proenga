#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   脚手架冒烟闸 · scaffold-smoke-gate.js · 2026-10-07（回归闸·零依赖 findChrome+CDP·随包）
   ────────────────────────────────────────────────────────────────────────
   目的（补"每个修复必配一道闸"的缺口）：scaffold/mockgen/build 是生成原型的新工具，
   以前没机器闸守——谁改坏了没人逮。这道闸内置一个【覆盖全页型】的 plan，一条命令 build 出整套，
   再 headless 逐页验：挂载 / 0 JS报错 / 无横向溢出；并点开弹窗验其真能打开。
   红 = scaffold 产出退化（结构错/崩/弹窗打不开），exit 1。
   用法：node scaffold-smoke-gate.js
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn, execFileSync } = require('child_process');
const { findChrome } = require('./_gate-env');
const CHROME = process.env.CHROME_PATH || findChrome();
const PM = path.join(__dirname, '..');            // skills/pm-design
const sleep = ms => new Promise(z => setTimeout(z, ms));

// 覆盖全页型的内置 plan：仪表盘 / 列表(状态页签+主按钮跳转+mock行) / 整页表单 / 过程型单据(步骤条+摘要卡) / 自定义 / 弹窗
const PLAN = {
  init: { title: '脚手架冒烟', 'system-name': 'Smoke', region: 'BR' },
  pages: [
    { cmd: 'add-home', id: 'sg_home', nav: '仪表盘', stats: '今日:100:+5%:up;预警:3::warn' },
    { cmd: 'add-list', id: 'sg_list', title: '列表', nav: '列表', cols: '名称,金额,状态', filters: '名称,状态@select:全部|在售|下架', tabs: '全部,在售,下架', primary: '新增', newpage: 'sg_form', rows: 5 },
    { cmd: 'add-form', id: 'sg_form', title: '新增', hidden: true, fields: '名称*,金额@money*,分类@select:A|B,备注@textarea' },
    { cmd: 'add-view', id: 'sg_view', title: '详情', hidden: true, fields: '名称=X,金额=R$9', summary: 'label=单,no=N1,status=处理中', steps: '建:done,审:current,完:pending' },
    { cmd: 'add-custom', id: 'sg_custom', nav: '说明', html: "<div class='gcard'><h4>说明页</h4><p>自定义 HTML</p></div>" },
    { cmd: 'add-dialog', id: 'sg_list', name: 'sg_dlg', title: '编辑', fields: '名称*,金额@money', trigger: '批量编辑' }
  ]
};
const VERIFY_PAGES = ['sg_home', 'sg_list', 'sg_form', 'sg_view', 'sg_custom'];

const ERRHOOK = "window.__ERRS__=[];addEventListener('error',function(e){try{__ERRS__.push(String(e.message||(e.error&&e.error.message)||e))}catch(_){}} ,true);addEventListener('unhandledrejection',function(e){try{__ERRS__.push('reject:'+String((e.reason&&e.reason.message)||e.reason))}catch(_){}} );var _e=console.error;console.error=function(){try{__ERRS__.push('err:'+Array.prototype.map.call(arguments,function(a){return (a&&a.message)||String(a)}).join(' ').slice(0,160))}catch(_){} return _e.apply(console,arguments)};";
const CHECK = "(function(){var de=document.documentElement;return {mounted:!!document.querySelector('#app *'),overflowX:de.scrollWidth>de.clientWidth+2,errs:(window.__ERRS__||[]).slice(0,6)};})()";
const DLGOPEN = "(function(){var b=[].slice.call(document.querySelectorAll('.el-button,.sel-link')).find(function(e){return (e.textContent||'').replace(/\\s+/g,'').trim()==='批量编辑';});if(!b)return 'no-btn';b.click();return 'clicked';})()";
const DLGSEE = "(function(){var d=[].slice.call(document.querySelectorAll('.el-dialog')).find(function(e){return e.getBoundingClientRect().width>0});if(!d)return null;var t=d.querySelector('.el-dialog__title');return {title:t?t.textContent.replace(/\\s+/g,'').trim():'',fields:d.querySelectorAll('.el-form-item').length};})()";

(async () => {
  if (!CHROME) { console.log('⚠ 未找到 Chrome（设 CHROME_PATH）·跳过 scaffold 冒烟'); process.exit(0); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sg-'));
  const pd = path.join(dir, 'pd.json'), bld = path.join(dir, '_bld.html'), planP = path.join(dir, 'plan.json');
  let fail = 0;
  console.log('\n════════ 脚手架冒烟闸 scaffold-smoke（build 全页型 → 逐页验）════════');
  // ① build 整套
  try {
    fs.writeFileSync(planP, JSON.stringify(PLAN), 'utf8');
    execFileSync(process.execPath, [path.join(PM, 'scaffold.js'), pd, 'build', planP, '--assemble'], { stdio: 'pipe' });
    if (!fs.existsSync(bld)) throw new Error('未产出 _bld.html');
    console.log('  ✓ build 全页型 + 装配成功');
  } catch (e) { console.log('  ✗ build/装配失败：' + (e.message || e)); process.exit(1); }

  // ② headless 逐页验
  const dport = 9823;
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--window-size=1680,1050', '--force-device-scale-factor=1', '--remote-debugging-port=' + dport, '--user-data-dir=' + path.join(dir, 'ud'), 'about:blank']);
  let ws;
  try {
    let tab = null;
    for (let i = 0; i < 60; i++) { try { tab = (await (await fetch(`http://localhost:${dport}/json/list`)).json()).find(t => t.type === 'page'); if (tab) break; } catch (_) {} await sleep(200); }
    if (!tab) throw new Error('Chrome 未就绪');
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = {};
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
    const send = (meth, p = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: meth, params: p })); });
    const evalv = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: ERRHOOK });
    const url = pg => 'file:///' + bld.replace(/\\/g, '/') + '?page=' + pg;
    const load = async pg => { await send('Page.navigate', { url: 'about:blank' }); await sleep(120); await send('Page.navigate', { url: url(pg) }); for (let i = 0; i < 70; i++) { await sleep(120); if (await evalv("!!document.querySelector('#app *, .el-table, .page-form, .el-form, .gcard')") === true) break; } await sleep(500); };

    // 预热：新起的 headless Chrome 首次解析 Vue+EP 冷启慢，先热跑一次(丢弃)，否则第一页会冷启假红
    await load(VERIFY_PAGES[0]); await sleep(1200);

    for (const pg of VERIFY_PAGES) {
      await load(pg);
      const r = await evalv(CHECK);
      const bad = [];
      if (!r || !r.mounted) bad.push('未挂载');
      if (r && r.overflowX) bad.push('横向溢出');
      if (r && r.errs && r.errs.length) bad.push('JS报错:' + JSON.stringify(r.errs));
      if (bad.length) { fail++; console.log('  ✗ ' + pg + ' —— ' + bad.join(' · ')); }
      else console.log('  ✓ ' + pg + ' 挂载·无报错·无溢出');
    }
    // ③ 弹窗真打开
    await load('sg_list');
    const op = await evalv(DLGOPEN);
    await sleep(500);
    const seen = await evalv(DLGSEE);
    if (op !== 'clicked') { fail++; console.log('  ✗ 弹窗触发按钮「批量编辑」没找到'); }
    else if (!seen) { fail++; console.log('  ✗ 弹窗点了没打开'); }
    else if (seen.title !== '编辑' || seen.fields < 2) { fail++; console.log('  ✗ 弹窗内容不对（title=' + seen.title + ' 字段=' + seen.fields + '）'); }
    else console.log('  ✓ 弹窗真打开（title=' + seen.title + '·' + seen.fields + ' 字段）');
    ws.close();
  } catch (e) { console.log('  ✗ 验证异常：' + (e.message || e)); fail++; }
  finally { try { ch.kill(); } catch (_) {} try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }

  console.log('──────────────────────────────');
  console.log(fail ? '  ✗ 脚手架冒烟闸 有红 FAIL ❌（' + fail + ' 项）—— scaffold 产出退化，禁交付' : '  ✓ 脚手架冒烟闸 全绿 PASS ✅（全页型 build→装配→渲染→弹窗 都正常）');
  console.log('════════════════════════════════');
  process.exit(fail ? 1 : 0);
})();
