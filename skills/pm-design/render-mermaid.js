/* render-mermaid.js - render ```mermaid blocks to trimmed PNGs for make-doc.ps1 (2026-11-13 speed-up).
   Why: make-doc used to launch headless Chrome TWICE per chart (dump-dom + screenshot), ~8.6 s per chart,
   ~208 s for a PRD with 24 charts, on every run even when no chart changed.
   Now:
     1) content-hash cache: key = sha256(render settings + HTML template + mermaid lib bytes + chart source).
        Hit -> copy the cached PNG (same bytes every time). Unchanged charts are never re-rendered.
     2) misses are rendered in ONE headless Chrome (CDP, a few tabs in parallel), not one launch per chart.
   Same render rules as before: same HTML template (padding 16, YaHei, useMaxWidth:false),
   viewport = svg natural width/height + 34 (trims whitespace), fallback 1600x700 when no svg size is found,
   device scale 1, scrollbars hidden.
   Usage: node render-mermaid.js <job.json>
     job = { "mermaidSrc": "<file:///... or https://...>", "outDir": "<screenshots dir>",
             "charts": [ "<mermaid source 1>", "<mermaid source 2>", ... ] }   -> outDir/flow-1.png, flow-2.png ...
   Cache dir: env PROENGA_FLOW_CACHE, else <parent of temp root>/.proenga-cache/mermaid-png (not on the system temp; kept between runs).
   Exit 0 = every chart has its PNG; 1 = at least one failed (make-doc prints it). Zero dependencies (Node 18+). */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto');
const { spawn } = require('child_process');
let sandbox = null;
try { sandbox = require('../_shared/qa/_tmp-sandbox').sandboxDir(); } catch (_) { }   // temp files auto-deleted on exit
if (!sandbox) sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mmd-'));

const RENDER_VER = 'mmd-png-v1|pad34|fallback1600x700|dsf1|wait9000';
const PARALLEL = Math.max(1, +(process.env.MMD_PARALLEL || 4));
const WAIT_MS = 9000;

function htmlFor(src, code) {
  // keep byte-for-byte the template make-doc.ps1 used before (CRLF as in the .ps1 here-string)
  return '<!DOCTYPE html><html lang="zh"><head><meta charset="utf-8">\r\n' +
    '<style>body{margin:0;padding:16px;background:#fff;display:inline-block}.mermaid{font-family:"Microsoft YaHei",sans-serif}</style>\r\n' +
    '<script src="' + src + '"></script></head>\r\n' +
    '<body><pre class="mermaid">\r\n' + code + '\r\n' +
    "</pre><script>mermaid.initialize({startOnLoad:true,securityLevel:'loose',flowchart:{useMaxWidth:false}});</script></body></html>";
}

function cacheDir() {
  let d = process.env.PROENGA_FLOW_CACHE;
  if (!d) {
    try { d = path.join(path.dirname(require('../_shared/qa/_tmp-root').tmpRoot()), '.proenga-cache', 'mermaid-png'); }
    catch (_) { d = path.join(os.homedir(), '.proenga-cache', 'mermaid-png'); }
  }
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function libHash(src) {
  const h = crypto.createHash('sha256');
  if (/^file:\/\/\//i.test(src)) {
    const p = decodeURI(src.replace(/^file:\/\/\//i, ''));
    try { h.update(fs.readFileSync(p)); return h.digest('hex'); } catch (_) { }
  }
  return h.update('url:' + src).digest('hex');
}
function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const c = process.platform === 'win32'
    ? ['C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
       'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', 'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
       (process.env.LOCALAPPDATA || '') + '\\Google\\Chrome\\Application\\chrome.exe']
    : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  return c.find(x => x && fs.existsSync(x)) || null;
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* minimal CDP client over the browser websocket, flat sessions */
function cdpClient(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    let id = 0; const pend = new Map(); const listeners = [];
    ws.onmessage = ev => {
      const m = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
      if (m.id && pend.has(m.id)) { const p = pend.get(m.id); pend.delete(m.id); m.error ? p.rej(new Error(m.error.message)) : p.res(m.result); }
      else if (m.method) listeners.forEach(f => f(m));
    };
    ws.onerror = e => reject(new Error('CDP websocket error'));
    ws.onopen = () => resolve({
      send(method, params = {}, sessionId) {
        return new Promise((res, rej) => { const i = ++id; pend.set(i, { res, rej }); ws.send(JSON.stringify(sessionId ? { id: i, method, params, sessionId } : { id: i, method, params })); });
      },
      on(f) { listeners.push(f); },
      off(f) { const k = listeners.indexOf(f); if (k >= 0) listeners.splice(k, 1); },
      close() { try { ws.close(); } catch (_) { } }
    });
  });
}

async function launch(chrome) {
  const prof = path.join(sandbox, 'chrome-prof');
  fs.mkdirSync(prof, { recursive: true });
  const child = spawn(chrome, ['--headless=new', '--disable-gpu', '--no-sandbox', '--no-first-run', '--no-default-browser-check',
    '--hide-scrollbars', '--remote-debugging-port=0', '--user-data-dir=' + prof, 'about:blank'], { stdio: 'ignore' });
  const portFile = path.join(prof, 'DevToolsActivePort');
  for (let i = 0; i < 150; i++) {
    if (fs.existsSync(portFile)) {
      const [port, p] = fs.readFileSync(portFile, 'utf8').split(/\r?\n/);
      if (port && p) return { child, ws: 'ws://127.0.0.1:' + port + p };
    }
    await sleep(100);
  }
  try { child.kill(); } catch (_) { }
  throw new Error('headless Chrome did not start');
}

async function renderOne(cdp, code, src, outPng, n) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const S = (m, p) => cdp.send(m, p, sessionId);
  try {
    const htmlFile = path.join(sandbox, '_mmd_' + n + '.html');
    fs.writeFileSync(htmlFile, htmlFor(src, code), 'utf8');
    await S('Page.enable');
    await S('Emulation.setDeviceMetricsOverride', { width: 800, height: 600, deviceScaleFactor: 1, mobile: false });
    let loaded = false; const onEv = m => { if (m.sessionId === sessionId && m.method === 'Page.loadEventFired') loaded = true; };
    cdp.on(onEv);
    await S('Page.navigate', { url: 'file:///' + htmlFile.replace(/\\/g, '/') });
    const t0 = Date.now();
    while (!loaded && Date.now() - t0 < WAIT_MS) await sleep(30);
    cdp.off(onEv);
    // wait until mermaid has put its svg in (same moment dump-dom used to read it), then fonts + 2 frames
    let dom = '';
    while (Date.now() - t0 < WAIT_MS) {
      const r = await S('Runtime.evaluate', { expression: "(function(){var p=document.querySelector('pre.mermaid');return (p&&p.querySelector('svg'))?document.documentElement.outerHTML:''})()", returnByValue: true });
      dom = (r.result && r.result.value) || '';
      if (dom) break;
      await sleep(50);
    }
    await S('Runtime.evaluate', { expression: 'document.fonts?document.fonts.ready.then(function(){return new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(function(){r(1)})})})}):1', awaitPromise: true, returnByValue: true });
    if (dom) { const r2 = await S('Runtime.evaluate', { expression: 'document.documentElement.outerHTML', returnByValue: true }); dom = r2.result.value || dom; }
    const sm = /<svg[^>]*width="([0-9.]+)"[^>]*height="([0-9.]+)"/.exec(dom);
    const w = sm ? Math.ceil(+sm[1]) + 34 : 1600, h = sm ? Math.ceil(+sm[2]) + 34 : 700;
    await S('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
    await S('Runtime.evaluate', { expression: 'new Promise(function(r){requestAnimationFrame(function(){requestAnimationFrame(function(){r(1)})})})', awaitPromise: true });
    const shot = await S('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: w, height: h, scale: 1 }, captureBeyondViewport: false });
    fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'));
    return { ok: !!sm, w, h };
  } finally {
    try { await cdp.send('Target.closeTarget', { targetId }); } catch (_) { }
  }
}

function sameBytes(a, b) { try { const x = fs.readFileSync(a), y = fs.readFileSync(b); return x.length === y.length && x.equals(y); } catch (_) { return false; } }
function place(cached, dest) { if (!sameBytes(cached, dest)) fs.copyFileSync(cached, dest); const now = new Date(); try { fs.utimesSync(cached, now, now); } catch (_) { } }
function prune(dir) {   // drop cache entries unused for 120 days
  const lim = Date.now() - 120 * 864e5;
  try { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); try { if (fs.statSync(p).mtimeMs < lim) fs.unlinkSync(p); } catch (_) { } } } catch (_) { }
}

(async () => {
  const job = JSON.parse(fs.readFileSync(process.argv[2], 'utf8').replace(/^\uFEFF/, ''));
  const charts = Array.isArray(job.charts) ? job.charts : [job.charts];
  fs.mkdirSync(job.outDir, { recursive: true });
  const cdir = cacheDir();
  const base = crypto.createHash('sha256').update(RENDER_VER + '\n' + htmlFor('', '') + '\n' + libHash(job.mermaidSrc)).digest('hex');
  const todo = []; let hits = 0, failed = 0;
  charts.forEach((code, i) => {
    const n = i + 1, key = crypto.createHash('sha256').update(base + '\n' + code).digest('hex');
    const cached = path.join(cdir, key + '.png'), dest = path.join(job.outDir, 'flow-' + n + '.png');
    if (fs.existsSync(cached)) { place(cached, dest); hits++; console.log('  flow-' + n + ' cached'); }
    else todo.push({ n, code, cached, dest });
  });
  if (todo.length) {
    const chrome = findChrome();
    if (!chrome) { console.log('  No Chrome/Edge found - ' + todo.length + ' flowchart(s) not rendered'); process.exit(1); }
    const { child, ws } = await launch(chrome);
    try {
      const cdp = await cdpClient(ws);
      let next = 0;
      const worker = async () => {
        while (next < todo.length) {
          const t = todo[next++];
          const tmpPng = path.join(sandbox, 'flow-' + t.n + '.png');
          try {
            const r = await renderOne(cdp, t.code, job.mermaidSrc, tmpPng, t.n);
            // only a real svg size goes into the cache (a fallback 1600x700 = mermaid failed; retry next run)
            if (r.ok) { fs.copyFileSync(tmpPng, t.cached); place(t.cached, t.dest); }
            else fs.copyFileSync(tmpPng, t.dest);
            console.log('  flow-' + t.n + ' rendered  ' + r.w + 'x' + r.h + '  ' + (fs.statSync(t.dest).size / 1024).toFixed(1) + ' KB' + (r.ok ? '' : '  (no svg size found - fallback size, not cached)'));
          } catch (e) { failed++; console.log('  flow-' + t.n + ' FAILED to render (' + e.message + ')'); }
        }
      };
      await Promise.all(Array.from({ length: Math.min(PARALLEL, todo.length) }, worker));
      try { await cdp.send('Browser.close'); } catch (_) { }
      cdp.close();
    } finally {
      await sleep(300);
      try { child.kill(); } catch (_) { }
    }
  }
  prune(cdir);
  console.log('  flowcharts: ' + charts.length + ' total, ' + hits + ' from cache, ' + (todo.length - failed) + ' rendered' + (failed ? ', ' + failed + ' FAILED' : ''));
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log('  flowchart renderer error: ' + e.message); process.exit(1); });
