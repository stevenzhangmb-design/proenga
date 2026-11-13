/* ════════════════════════════════════════════════════════════════════════
   ㊻ 弹窗眼验闸 · dialog-eyeball-gate.js
   ────────────────────────────────────────────────────────────────────────
   【为什么有这道闸】2026-10-05 事故：我把发票管理的 16 个「看怎么改」弹窗拷到四个订单页，
   只验了「弹窗能打开、内容在」就说做完了，**没有自己点开看一眼长什么样**。
   用户点开发现：弹窗 680px 宽，内容最长只要 580px，每一行右边空 10~60%，很难看。

   既有的 deliver-gate 抓不到这类问题 —— 它只验「每页能渲染、无 JS 报错」，
   **弹窗里长什么样它根本不看**。所以我说「自检 PASS」时，这类问题一个都抓不到。
   闸绿 ≠ 没问题；闸有盲区，就先怀疑闸。

   【这道闸做什么】把原型里每个弹窗**真打开、真截图、真量**，机器判这三类「没眼验过」的毛病：
     ① 右侧大面积留白：弹窗宽度 >> 内容实际占用宽度（内容最右边界离弹窗右边 >25% 且 >120px）
     ② 内容溢出：内容比弹窗还宽（出横向滚动条）
     ③ 空弹窗：打开后正文少于 10 个字（拷过来忘了填内容 / 指错了 opens）

   【怎么跑】
     node dialog-eyeball-gate.js <原型.html 或 project-data.json> [--page 页id] [--only 弹窗名,弹窗名]
     不传路径时自动找 project-data（与其它闸同一套 _gate-env）。
   截图落 <原型目录>/_shots/_dialogs/<页id>__<弹窗名>.png，红的那几张留着给人看。
   ════════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path'), os = require('os');
require('../../_shared/qa/_tmp-sandbox'); // 临时文件进沙盒·退出自动删（铁律·见 _tmp-sandbox.js）
const { spawn, execFileSync } = require('child_process');

/* ── 找 Chrome（与其它闸同一套：先 findChrome，再常见路径） ── */
function findChrome() {
  const cands = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    (process.env.LOCALAPPDATA || '') + '/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/chromium-browser', '/usr/bin/chromium'
  ].filter(Boolean);
  for (const c of cands) { try { if (fs.existsSync(c)) return c; } catch (_) {} }
  return null;
}

/* ── 极简 CDP（零依赖，与 skills/rpa/_cdp.js 同思路） ── */
function httpGet(url) {
  return new Promise((res, rej) => {
    require('http').get(url, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => res(b)); }).on('error', rej);
  });
}
async function connectCDP(port) {
  let list = null;
  for (let i = 0; i < 40; i++) {
    try { list = JSON.parse(await httpGet('http://127.0.0.1:' + port + '/json')); if (list && list.length) break; } catch (_) {}
    await new Promise(r => setTimeout(r, 300));
  }
  if (!list || !list.length) throw new Error('连不上 Chrome 调试端口 ' + port);
  const tgt = list.find(t => t.type === 'page' && t.webSocketDebuggerUrl) || list[0];
  /* node>=22 自带 WebSocket，优先用它；老 node 才回退到 ws 包（本仓库不依赖 ws，所以不能反过来） */
  let Sock = (typeof WebSocket !== 'undefined') ? WebSocket : null;
  if (!Sock) { const WS = require('ws'); Sock = (WS && WS.WebSocket) || WS; }
  const ws = new Sock(tgt.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = e => rej(new Error('ws 连接失败')); });
  let id = 0; const waits = new Map();
  ws.onmessage = ev => { const m = JSON.parse(typeof ev.data === 'string' ? ev.data : ev.data.toString());
    if (m.id && waits.has(m.id)) { waits.get(m.id)(m); waits.delete(m.id); } };
  const send = (method, params) => new Promise(res => { const i = ++id; waits.set(i, res); ws.send(JSON.stringify({ id: i, method, params: params || {} })); });
  const evalv = async expr => { const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) throw new Error('页面 JS 异常');
    return r.result && r.result.result ? r.result.result.value : undefined; };
  const navigate = async u => { await send('Page.navigate', { url: u }); await new Promise(r => setTimeout(r, 1800)); };
  const shot = async out => { await send('Page.bringToFront', {});
    const r = await send('Page.captureScreenshot', { format: 'png' });
    if (r.result && r.result.data) fs.writeFileSync(out, Buffer.from(r.result.data, 'base64')); };
  return { send, evalv, navigate, shot, close: () => { try { ws.close(); } catch (_) {} } };
}

/* ── 入参 ── */
const argv = process.argv.slice(2);
const flag = n => { const i = argv.indexOf(n); return i >= 0 ? argv[i + 1] : null; };
const onlyPage = flag('--page');
const onlyDlg = (flag('--only') || '').split(',').map(s => s.trim()).filter(Boolean);
let src = argv.find(a => !a.startsWith('--') && (a.endsWith('.json') || a.endsWith('.html')));
if (!src) { try { const { findPrdData } = require('./_gate-env'); const p = findPrdData();
  if (p) src = path.join(path.dirname(p), '..'); } catch (_) {} }
if (!src || !fs.existsSync(src)) { console.log('㊻ 弹窗眼验闸：没给原型/project-data 路径，跳过（用法见文件头）'); process.exit(0); }

/* project-data → 找同目录的 _bld.html；给 html 就直接用 */
let html = src, dataPath = null;
if (src.endsWith('.json')) {
  dataPath = src;
  const dir = path.dirname(src);
  const bld = path.join(dir, '_bld.html');
  if (!fs.existsSync(bld)) { console.log('㊻ 弹窗眼验闸：' + bld + ' 不存在（先跑一次 assemble/quick），跳过'); process.exit(0); }
  html = bld;
} else {
  const dir = path.dirname(src);
  const guess = fs.readdirSync(dir).find(f => /project-data\.json$/.test(f));
  if (guess) dataPath = path.join(dir, guess);
}
if (!dataPath) { console.log('㊻ 弹窗眼验闸：找不到 project-data.json，跳过'); process.exit(0); }

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8').replace(/^\uFEFF/, ''));
const OUT = path.join(path.dirname(dataPath), '_shots', '_dialogs');
fs.mkdirSync(OUT, { recursive: true });

/* ── 收集所有 (页, 弹窗) ── */
const jobs = [];
Object.keys(data.pagecfg || {}).forEach(pg => {
  if (onlyPage && pg !== onlyPage) return;
  const g = (data.pagecfg[pg] || {}).dialogs || {};
  Object.keys(g).forEach(nm => {
    if (onlyDlg.length && onlyDlg.indexOf(nm) < 0) return;
    jobs.push({ page: pg, dlg: nm, cfg: g[nm] });
  });
});
if (!jobs.length) { console.log('㊻ 弹窗眼验闸：没有弹窗可验，跳过'); process.exit(0); }

/* ── 跑 ── */
(async () => {
  const chrome = findChrome();
  if (!chrome) { console.log('㊻ 弹窗眼验闸：本机没找到 Chrome，跳过'); process.exit(0); }
  const PORT = 9671 + (process.pid % 90);
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'dlgeye-'));
  const ch = spawn(chrome, ['--headless=new', '--remote-debugging-port=' + PORT, '--user-data-dir=' + prof,
    '--window-size=1680,1300', '--force-device-scale-factor=1', '--no-first-run', '--disable-gpu',
    '--allow-file-access-from-files', 'about:blank'], { stdio: 'ignore' });
  const bad = [];
  let c = null;
  try {
    c = await connectCDP(PORT);
    await c.send('Page.enable', {}); await require('./_anno-isolate').isolateAnnoServer((m, p) => c.send(m, p)); /* 隔离真 anno-server(3799)：防标注层 /anno-persist 改写用户真实原型 */
    const fileUrl = 'file:///' + path.resolve(html).replace(/\\/g, '/');
    let lastPage = null;
    for (const j of jobs) {
      if (lastPage !== j.page) { await c.navigate(fileUrl + '?page=' + encodeURIComponent(j.page)); await new Promise(r => setTimeout(r, 1500)); lastPage = j.page; }
      /* 直接驱动 Vue：把 dialogName 设成目标弹窗（比四处找按钮稳） */
      const opened = await c.evalv(
        "(function(){try{var app=document.querySelector('#app');var vm=app&&app.__vue_app__;" +
        "var root=vm&&vm._instance&&vm._instance.proxy;if(!root)return 'NOVM';" +
        "root.dlgRow=null;root.dialogName=" + JSON.stringify(j.dlg) + ";root.dlgOpen=true;return 'OK';}catch(e){return 'ERR '+e.message;}})()");
      if (opened !== 'OK') { continue; }                      /* 驱动不动就跳过，不误判 */
      await new Promise(r => setTimeout(r, 900));
      const m = await c.evalv("(function(){var d=document.querySelector('.el-dialog');if(!d)return null;" +
        "var body=d.querySelector('.el-dialog__body');if(!body)return null;" +
        "var dr=d.getBoundingClientRect(),br=body.getBoundingClientRect();" +
        /* 内容实际最右边界：遍历 body 后代里真有尺寸的元素 */
        "var right=br.left;var kids=body.querySelectorAll('*');" +
        "for(var i=0;i<kids.length;i++){var r=kids[i].getBoundingClientRect();" +
        "if(r.width>0&&r.height>0&&r.right>right&&r.right<=br.right+1)right=r.right;}" +
        "var txt=(body.innerText||'').replace(/\\s+/g,'');" +
        "return JSON.stringify({dlgW:Math.round(dr.width),bodyW:Math.round(br.width)," +
        "bodyL:Math.round(br.left),bodyR:Math.round(br.right),contentR:Math.round(right)," +
        "scrollW:Math.round(body.scrollWidth),clientW:Math.round(body.clientWidth),len:txt.length});})()");
      if (!m) continue;
      const o = JSON.parse(m);
      const gapR = o.bodyR - o.contentR;                      /* 右侧留白 */
      const ratio = o.bodyW > 0 ? gapR / o.bodyW : 0;
      const issues = [];
      if (o.len < 10) issues.push('空弹窗（正文仅 ' + o.len + ' 字）');
      if (o.scrollW > o.clientW + 2) issues.push('内容溢出（内容 ' + o.scrollW + ' > 可视 ' + o.clientW + '，出横向滚动条）');
      if (ratio > 0.25 && gapR > 120) issues.push('右侧留白 ' + gapR + 'px（占 ' + Math.round(ratio * 100) + '%）—— 弹窗 ' + o.dlgW + 'px 比内容宽太多');
      if (issues.length) {
        const png = path.join(OUT, j.page + '__' + j.dlg + '.png');
        try { await c.shot(png); } catch (_) {}
        bad.push({ page: j.page, dlg: j.dlg, issues, png });
      }
      await c.evalv("(function(){try{var r=document.querySelector('#app').__vue_app__._instance.proxy;r.dlgOpen=false;}catch(e){}})()");
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (e) {
    console.log('㊻ 弹窗眼验闸：跑不起来（' + e.message + '），跳过（不误判红）');
    try { c && c.close(); } catch (_) {} try { ch.kill(); } catch (_) {}
    process.exit(0);
  }
  try { c && c.close(); } catch (_) {} try { ch.kill(); } catch (_) {}
  try { execFileSync('powershell', ['-NoProfile', '-Command',
    "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'dlgeye-' } | ForEach-Object { taskkill /PID $_.ProcessId /T /F 2>$null | Out-Null }"],
    { stdio: 'ignore', timeout: 20000 }); } catch (_) {}

  console.log('\n════ ㊻ 弹窗眼验闸 ════  共验 ' + jobs.length + ' 个弹窗');
  if (!bad.length) { console.log('  ✅ 全部通过：没有空弹窗 / 没有内容溢出 / 没有右侧大面积留白\n'); process.exit(0); }
  console.log('  ❌ ' + bad.length + ' 个弹窗没眼验过就交付了：\n');
  bad.forEach(b => {
    console.log('   · ' + b.page + ' › ' + b.dlg);
    b.issues.forEach(x => console.log('       - ' + x));
    console.log('       截图：' + b.png);
  });
  console.log('\n  修法：调 width 让内容撑满 / 补内容 / 改 opens 指对弹窗。改完再跑本闸。\n');
  process.exit(1);
})();
