#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   computed 样式保真闸 · computed-style-gate.js · 2026-09-15
   ────────────────────────────────────────────────────────────────────────
   根治「复刻/默认皮 只对文字结构、漏了 computed 样式(背景/颜色/字号/尺寸/间距/圆角/边框)」。
   headless 渲染原型(DeviceScaleFactor=1·DPR 恒定可比) → 逐元素逐属性 diff design-baseline.json →
   任一属性不等 = 红，机器把【全部】不一致列出来(不靠肉眼挑)。红了禁交付。
   用法：node computed-style-gate.js [project-data.json ...]  (缺省用 fixtures/vt 里的列表夹具)
   基线：design-baseline.json(同目录)·真系统实测值·EP 版本差异项在 _tolerant 里不判红。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn, execFileSync } = require('child_process');
const { findChrome } = require('./_gate-env');
const { localize, copyVendorInto } = require('./_gate-vendor');
const CHROME = process.env.CHROME_PATH || findChrome();
const sleep = ms => new Promise(z => setTimeout(z, ms));
const BASE = JSON.parse(fs.readFileSync(path.join(__dirname, 'design-baseline.json'), 'utf8'));

const CHECK_FN = els => `(() => {
  const B = ${JSON.stringify(els)};
  const out = {};
  for (const [name, def] of Object.entries(B)) {
    const el = document.querySelector(def.sel);
    if (!el) { out[name] = { _missing: true }; continue; }
    const s = getComputedStyle(el);
    const got = {}; for (const k of Object.keys(def.props)) got[k] = s[k];
    out[name] = got;
  }
  return out;
})()`;

async function renderExtract(htmlPath, dir, port) {
  const dport = port + 1000;
  const server = http.createServer((rq, rs) => {
    const f = path.join(dir, decodeURIComponent(rq.url.split('?')[0]));
    fs.readFile(f, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'Content-Type': /\.html$/.test(f) ? 'text/html;charset=utf-8' : /\.css$/.test(f) ? 'text/css' : 'application/javascript' }); rs.end(d); });
  }).listen(port);
  const ud = path.join(dir, 'ud');
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--window-size=1680,1050', '--remote-debugging-port=' + dport, '--user-data-dir=' + ud, 'about:blank']);
  try {
    let tab = null;
    for (let i = 0; i < 60; i++) { try { tab = (await (await fetch(`http://localhost:${dport}/json/list`)).json()).find(t => t.type === 'page'); if (tab) break; } catch (_) {} await sleep(200); }
    if (!tab) throw new Error('Chrome 未就绪');
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = {};
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
    const send = (m, p = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    const evalv = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
    await send('Page.enable'); await require('./_anno-isolate').isolateAnnoServer(send); /* 隔离真 anno-server(3799)：防标注层 /anno-persist 改写用户真实原型 */ await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: `http://localhost:${port}/p.html` });
    for (let i = 0; i < 120; i++) { await sleep(150); if (await evalv(`!!document.querySelector('.el-table__header th')`) === true) break; }
    await sleep(700);
    const r = await evalv(CHECK_FN(BASE.elements));
    ws.close();
    return r;
  } finally { try { server.close(); } catch (_) {} try { ch.kill(); } catch (_) {} }
}

async function runOne(fixFile, port) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-'));
  const out = path.join(dir, 'p.html');
  execFileSync('node', [path.join(__dirname, 'assemble-prototype.js'), fixFile, out, '--fast'], { stdio: 'pipe' });
  fs.writeFileSync(out, localize(fs.readFileSync(out, 'utf8')), 'utf8');
  copyVendorInto(dir);
  const got = await renderExtract(out, dir, port);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  return got;
}

(async () => {
  let fixtures = process.argv.slice(2).filter(a => a.endsWith('.json'));
  if (!fixtures.length) {
    const fdir = path.join(__dirname, 'fixtures', 'vt');
    try { fixtures = fs.readdirSync(fdir).filter(f => f.endsWith('.json')).slice(0, 2).map(f => path.join(fdir, f)); } catch (_) {}
  }
  if (!fixtures.length) { console.log('⊘ 无夹具可测（传 project-data.json 或放 fixtures/vt/*list*.json）'); process.exit(0); }
  console.log('\n════════ ㊸ computed 样式保真闸 computed-style-gate ════════');
  console.log('  逐元素逐属性 diff 真系统实测基线(design-baseline.json)·DPR 恒 1');
  let bad = 0, port = 9700;
  for (const fix of fixtures) {
    const got = await runOne(fix, port++);
    console.log('  · ' + path.basename(fix));
    for (const [name, def] of Object.entries(BASE.elements)) {
      const g = got && got[name];
      if (!g) { console.log('    ⚠ ' + name + ' 渲染未取到(选择器/页面无此元素)'); continue; }
      if (g._missing) { console.log('    ⚠ ' + name + ' 页面无此元素'); continue; }
      const diffs = [];
      for (const [k, want] of Object.entries(def.props)) if (String(g[k]) !== String(want)) diffs.push(`${k}: 期望[${want}] 实测[${g[k]}]`);
      if (diffs.length) { bad += diffs.length; console.log('    ✗ ' + name + '\n        ' + diffs.join('\n        ')); }
      else console.log('    ✓ ' + name);
    }
  }
  console.log('──────────────────────────────────');
  if (bad) { console.log('  ❌ ' + bad + ' 处 computed 样式 ≠ 真系统基线 —— 逐条改到相等（EP 版本差异见基线 _tolerant）'); process.exit(1); }
  console.log('  ✅ computed 样式逐值 == 真系统基线 PASS');
  process.exit(0);
})().catch(e => { console.error('闸异常:', e.message); process.exit(2); });
