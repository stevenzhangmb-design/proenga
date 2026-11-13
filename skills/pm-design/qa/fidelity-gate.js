#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   ㊶ 复刻保真闸 · fidelity-gate.js · 随包·治「画蛇添足」的机器
   ────────────────────────────────────────────────────────────────────────
   2026-09-10 用户明令「我要一套规则约束你·别画蛇添足·真系统有什么就拷什么」。
   光文字规则约束不住 → 这道闸自动 diff：把复刻原型逐页渲染、抽它自己的【结构文案】
   （列头 / 筛选占位 / 按钮 / 表单label / 分区标题 / 状态页签），与 RPA 实测的真系统
   基线逐条比：**原型渲染出基线里没有的结构文案 = 画蛇添足 = 红**。表格行内 mock 业务
   数据不在校验范围（那本就允许不同）。
   触发：project-data.json 里声明 "_fidelityBaseline":"<baseline.json>" → deliver-gate
   自动纳入（无需手动），Stop 钩子在收尾自动逼跑。
   用法：node fidelity-gate.js <project-data.json> [baseline.json]
   退出码：0 全绿/跳过 · 1 有画蛇添足 · 2 环境错
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn, execFileSync } = require('child_process');
const { findChrome } = require('./_gate-env');
const { ensureVendor, localize, copyVendorInto } = require('./_gate-vendor');
const CHROME = process.env.CHROME_PATH || findChrome();
const sleep = ms => new Promise(z => setTimeout(z, ms));

// 全站通用 chrome 文案（顶栏/分页/多选条等·非模块内容·不算画蛇添足）
const GLOBAL_OK = new Set(['Selecionados', 'Total', 'Ir para', 'pagina', '10/pagina', '~', '至', 'to', 'Anotação', '标注']);
const norm = s => (s || '').replace(/\s+/g, ' ').replace(/\s*\*\s*$/, '').trim();

const EXTRACT = `(() => {
  const norm = s => (s||'').replace(/\\s+/g,' ').replace(/\\s*\\*\\s*$/,'').trim();
  const chrome = el => !!el.closest('.topbar,.anno-bar,.anno-toolbar,.pagetabs,.el-pagination,.pagination-container');
  const out = { columns:[], filters:[], buttons:[], tabs:[], titles:[], formLabels:[] };
  document.querySelectorAll('.el-table__header th').forEach(th => { const t=norm(th.innerText); if(t) out.columns.push(t); });
  document.querySelectorAll('.search-box .el-input__inner, .search-box textarea').forEach(i => { const p=i.getAttribute('placeholder'); if(p) out.filters.push(norm(p)); });
  document.querySelectorAll('.search-box .el-select').forEach(s => { const ph=s.querySelector('.el-select__placeholder'); const inp=s.querySelector('.el-input__inner'); const t=norm(ph?ph.innerText:(inp?(inp.value||inp.getAttribute('placeholder')):'')); if(t) out.filters.push(t); });
  document.querySelectorAll('.el-button').forEach(b => { if(chrome(b)) return; const t=norm(b.innerText); if(t) out.buttons.push(t); });
  document.querySelectorAll('.status-tabs .stab').forEach(s => { const c=s.cloneNode(true); c.querySelectorAll('.stab-badge').forEach(x=>x.remove()); const t=norm(c.innerText); if(t) out.tabs.push(t); });
  document.querySelectorAll('.new-banner').forEach(b => { const t=norm(b.innerText); if(t) out.titles.push(t); });
  document.querySelectorAll('.rep-sec, .form-section-title, .dv-sec-title').forEach(h => { const t=norm(h.innerText); if(t) out.titles.push(t); });
  document.querySelectorAll('.rep-f label, .el-form-item__label').forEach(l => { const t=norm(l.innerText); if(t) out.formLabels.push(t); });
  return out;
})()`;

(async () => {
  const pdPath = process.argv[2];
  if (!pdPath || !fs.existsSync(pdPath)) { console.error('用法: node fidelity-gate.js <project-data.json> [baseline.json]'); process.exit(2); }
  const pd = JSON.parse(fs.readFileSync(pdPath, 'utf8').replace(/^﻿/, ''));
  const blPath = process.argv[3] || pd._fidelityBaseline;
  console.log('\n════════ ㊶ 复刻保真闸 fidelity-gate ════════');
  console.log('  治「画蛇添足」：原型多出真系统没有的结构文案 = 红');
  if (!blPath) { console.log('⊘ SKIP：project-data 未声明 _fidelityBaseline（非复刻项目）'); process.exit(0); }
  const blAbs = path.isAbsolute(blPath) ? blPath : path.resolve(path.dirname(pdPath), blPath);
  if (!fs.existsSync(blAbs)) { console.log('✘ 基线文件不存在: ' + blAbs); process.exit(1); }
  const baseline = JSON.parse(fs.readFileSync(blAbs, 'utf8').replace(/^﻿/, ''));
  if (!CHROME) { console.log('⊘ SKIP：未找到 Chrome/Edge'); process.exit(0); }
  const v = await ensureVendor(); if (!v.ok) { console.log('⊘ SKIP：vendor 缓存不全'); process.exit(0); }

  // pageId → sysKey（从 nav 推）
  const pageSys = {};
  for (const [sys, items] of Object.entries(pd.nav || {})) {
    const walk = it => { if (!it) return; if (Array.isArray(it)) { pageSys[it[0]] = sys; } else if (it.group && it.items) it.items.forEach(walk); else if (it.id) pageSys[it.id] = sys; };
    (items || []).forEach(walk);
  }

  // 装配 + 本地化 + 起服务 + headless
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fid-'));
  const out = path.join(dir, 'p.html');
  execFileSync('node', [path.join(__dirname, 'assemble-prototype.js'), pdPath, out, '--fast'], { stdio: 'pipe' });  // --fast：只装配不再触发体检（否则 gate↔assemble 死循环）
  fs.writeFileSync(out, localize(fs.readFileSync(out, 'utf8')), 'utf8');
  copyVendorInto(dir);
  const port = 8940, dport = port + 1000;
  const server = http.createServer((rq, rs) => { const f = path.join(dir, decodeURIComponent(rq.url.split('?')[0])); fs.readFile(f, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'Content-Type': /\.html$/.test(f) ? 'text/html;charset=utf-8' : /\.css$/.test(f) ? 'text/css' : 'application/javascript' }); rs.end(d); }); }).listen(port);
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--window-size=1680,1050', '--remote-debugging-port=' + dport, '--user-data-dir=' + path.join(dir, 'ud'), 'about:blank']);
  let bad = 0;
  try {
    let tab = null; for (let i = 0; i < 60; i++) { try { tab = (await (await fetch(`http://localhost:${dport}/json/list`)).json()).find(t => t.type === 'page'); if (tab) break; } catch (_) {} await sleep(200); }
    const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = {}; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
    const send = (m, p = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    const evalv = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(function(){var of=window.fetch;window.fetch=function(u,o){try{var s=typeof u==='string'?u:(u&&u.url)||'';if(s.indexOf('localhost:3799')>=0)return Promise.reject(new Error('blocked'));}catch(e){}return of.call(this,u,o);};})();` });

    for (const [pid, spec] of Object.entries(baseline.pages || {})) {
      if (spec._noBaseline) { console.log(`  ⊘ ${pid} — 无真实基线（${spec._noBaseline.slice(0, 40)}…）跳过`); continue; }
      const sys = pageSys[pid] || pd.defaultSystem || '';
      await send('Page.navigate', { url: `http://localhost:${port}/p.html?sys=${encodeURIComponent(sys)}&page=${encodeURIComponent(pid)}` });
      for (let i = 0; i < 100; i++) { await sleep(150); if (await evalv(`!!document.querySelector('#app')`) === true) break; }
      await sleep(700);
      const got = await evalv(EXTRACT) || {};
      const allowed = new Set();
      ['columns', 'filters', 'buttons', 'tabs', 'titles', 'formLabels'].forEach(k => (spec[k] || []).forEach(x => allowed.add(norm(x))));
      const extras = [];
      for (const k of ['columns', 'filters', 'buttons', 'tabs', 'titles', 'formLabels']) {
        for (const t of (got[k] || [])) { const n = norm(t); if (!n || allowed.has(n) || GLOBAL_OK.has(n)) continue; extras.push(k + ':「' + t + '」'); }
      }
      const uniq = [...new Set(extras)];
      if (uniq.length) { bad += uniq.length; console.log(`  ✘ ${pid} — 画蛇添足 ${uniq.length} 处（真系统没有）：`); uniq.slice(0, 15).forEach(e => console.log('       + ' + e)); }
      else console.log(`  ✓ ${pid} — 无画蛇添足（结构文案都在真系统基线内）`);
    }
    ws.close();
  } finally { try { server.close(); } catch (_) {} try { ch.kill(); } catch (_) {} try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
  console.log('───────────────────────────────────────');
  console.log(bad ? '  复刻保真闸：有红 ✘ —— 原型加了真系统没有的东西（画蛇添足），删掉再交付' : '  复刻保真闸：全绿 ✓（1:1·无画蛇添足）');
  console.log('════════════════════════════════════════\n');
  process.exit(bad ? 1 : 0); // 硬退出：画蛇添足=红=非0，装配器/deliver-gate 据此拦交付（2026-09-10 由报告态改真闸）
})().catch(e => { console.error('闸异常:', e.message); process.exit(2); });
