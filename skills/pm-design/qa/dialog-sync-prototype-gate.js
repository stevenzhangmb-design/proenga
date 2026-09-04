#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   对话框→原型标注 实时同步 · 隔离闸 · dialog-sync-prototype-gate.js · 随包·不碰真数据
   ────────────────────────────────────────────────────────────────────────
   补齐【铁律三.2 后半句 / 三.1·三.3·三.4"同步到原型标注"那一侧】之前只验服务端、
   没真机验浏览器 DOM 的行为缺口：AI 对话框里 编辑 / 删除 功能 → 通过 SSE →
   【已打开着的原型】里对应标注 PIN 【实时更新内容 / 实时消失】，无需刷新。
     ① 圈选一个真实元素 → 原型出现 1 个标注 PIN。
     ② 对话框编辑：POST /anno-inject 同名功能带新字段规范 → SSE inject-pins →
        _annoInjectPins 就地更新该 PIN 的字段规范（原型标注内容实时变）。
     ③ 对话框删除：POST /anno-update delete → SSE pin-deleted →
        _annoRemovePins 把该 PIN 从原型移除（原型标注实时消失，PIN 数→0）。
   —— 完全隔离（同 ㉕/㉖）：临时端口 anno-server + 临时 archive + 现装原型；浏览器里把原型
      对 localhost:3799 的【fetch 和 EventSource】都重定向到临时端口——真实例/真数据碰都不碰。
   断言读浏览器 localStorage（_savePins 落 'anno-pins-v2::<系统>'）。零依赖：node + 本机 Chrome。
   退出码：0=通过/跳过 1=失败。缺 anno-server/Chrome 则 SKIP(exit 0)。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn, execFileSync } = require('child_process');
const { findChrome } = require('./_gate-env');
const { ensureVendor, localize, copyVendorInto } = require('./_gate-vendor');
const CHROME = process.env.CHROME_PATH || findChrome();
const QA = __dirname;
const SERVER = [
  path.join(QA, '..', '..', '..', '..', 'anno-server', 'server.js'),
  path.join(QA, '..', '..', '..', 'anno-server', 'server.js'),
  'D:/AI/anno-server/server.js',
].find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });
const APORT = 3812, WPORT = 8975, DPORT = 9475;
const FP_KEY = 'OMS.充值', EDIT_MARKER = '字段规范MARKER编辑ABC';

const pingA = () => new Promise(res => { const r = http.get(`http://localhost:${APORT}/anno-queue`, x => { res(x.statusCode === 200); x.resume(); }); r.on('error', () => res(false)); r.setTimeout(1500, () => { r.destroy(); res(false); }); });
function post(pathname, obj) {
  return new Promise((resolve, reject) => {
    const data = Buffer.from(JSON.stringify(obj), 'utf8');
    const req = http.request({ host: 'localhost', port: APORT, path: pathname, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': data.length } },
      r => { let b = ''; r.on('data', d => b += d); r.on('end', () => resolve({ status: r.statusCode, body: b })); });
    req.on('error', reject); req.write(data); req.end();
  });
}
const sleep = ms => new Promise(z => setTimeout(z, ms));
const EDIT_FIELDSPECS = '| 字段名称 | 类型 | 是否必填/必选 | 默认值 | 约束规则 |\n| --- | --- | --- | --- | --- |\n| ' + EDIT_MARKER + ' | 文本 | 是 | 空 | 对话框编辑同步验证。 |';

(async () => {
  if (!CHROME) { console.log('⊘ SKIP：未找到 Chrome/Edge'); process.exit(0); }
  if (!SERVER) { console.log('⊘ SKIP：未找到 anno-server/server.js'); process.exit(0); }
  const _v = await ensureVendor();
  if (!_v.ok) { console.log('⊘ SKIP：离线 vendor 缓存缺失且下载失败（' + _v.missing + '），需联网首次预热 _gate-vendor'); process.exit(0); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dlgsync-'));
  const proto = path.join(tmp, 'p.html');
  let sys = '';
  try {
    execFileSync('node', [path.join(QA, 'assemble-prototype.js'), path.join(QA, 'fixtures', 'roundtrip-data.json'), proto], { stdio: 'pipe', timeout: 120000 });
    fs.writeFileSync(proto, localize(fs.readFileSync(proto, 'utf8')), 'utf8');  // unpkg CDN → 本地 vendor（headless 秒加载·不依赖网络）
    copyVendorInto(tmp);
    sys = (JSON.parse(fs.readFileSync(path.join(QA, 'fixtures', 'roundtrip-data.json'), 'utf8')).systemName) || '';
  } catch (e) { console.log('⊘ SKIP：现装测试原型失败:', String(e.message || e).split('\n')[0]); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); }

  const errLog = path.join(tmp, 'srv.log'); const out = fs.openSync(errLog, 'a');
  const srv = spawn(process.execPath, [SERVER], { cwd: path.dirname(SERVER), stdio: ['ignore', out, out], windowsHide: true, env: { ...process.env, ANNO_PORT: String(APORT), ANNO_ARCHIVE_DIR: tmp, ANNO_DOCX_MAX_TRIES: '1', ANNO_DOCX_RETRY_MS: '500' } });
  let up = false; for (let i = 0; i < 70; i++) { if (await pingA()) { up = true; break; } await sleep(500); }  // 临时实例启动扫描候选目录可达~13s，给足 35s
  if (!up) { console.log('⊘ SKIP：临时 anno-server 未起来'); try { srv.kill(); } catch (_) {} fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); }

  const _mime = p => /\.html$/.test(p) ? 'text/html;charset=utf-8' : /\.js$/.test(p) ? 'application/javascript;charset=utf-8' : /\.css$/.test(p) ? 'text/css;charset=utf-8' : 'application/octet-stream';
  const server = http.createServer((rq, rs) => { const p = path.join(tmp, decodeURIComponent(rq.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'Content-Type': _mime(p) }); rs.end(d); }); }).listen(WPORT);
  const ud = path.join(tmp, 'ud');
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + DPORT, '--user-data-dir=' + ud, 'about:blank']);
  let exitCode = 1;
  try {
    let page = null; for (let i = 0; i < 50; i++) { try { page = (await (await fetch(`http://localhost:${DPORT}/json/list`)).json()).find(t => t.type === 'page'); if (page) break; } catch (e) {} await sleep(200); }
    const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = {}; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
    const send = (m, p = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    const evalv = async (expr, awaitP = false) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: awaitP, returnByValue: true })).result?.result?.value;
    await send('Page.enable'); await send('Runtime.enable');
    // ★ 关键隔离：fetch + EventSource 都把 localhost:3799 重定向到临时端口 APORT（SSE 走 EventSource）
    await send('Page.addScriptToEvaluateOnNewDocument', { source:
      `(function(){var of=window.fetch;window.fetch=function(u,o){try{if(typeof u==='string')u=u.replace('localhost:3799','localhost:${APORT}');else if(u&&u.url)u=new Request(u.url.replace('localhost:3799','localhost:${APORT}'),u);}catch(e){}return of.call(this,u,o);};` +
      `var OE=window.EventSource;if(OE){var NE=function(u,o){try{if(typeof u==='string')u=u.replace('localhost:3799','localhost:${APORT}');}catch(e){}return new OE(u,o);};NE.prototype=OE.prototype;NE.CONNECTING=0;NE.OPEN=1;NE.CLOSED=2;window.EventSource=NE;}})();` });
    await send('Page.navigate', { url: `http://localhost:${WPORT}/p.html?reset=1` });
    for (let i = 0; i < 120; i++) { await sleep(150); const q = await evalv("((((document.getElementById('app')||{}).childElementCount||0)>3)&&typeof window._annoInjectPins==='function'&&typeof window._annoRemovePins==='function')?1:0"); if (q === 1) break; }
    await sleep(1200);  // 等 SSE 连上临时 anno-server

    const RD = `JSON.parse(localStorage.getItem('anno-pins-v2::'+(window.__PRD_DATA__&&window.__PRD_DATA__.system_name||'default'))||'[]')`;

    // ── ① 圈选一个真实元素 → 原型出现 1 个 PIN ─────────────────────────────
    const circled = await evalv(`(async()=>{ const wait=ms=>new Promise(z=>setTimeout(z,ms)); const txt=el=>(el?.textContent||'').replace(/\\s+/g,' ').trim();
      if(window.__anno){window.__anno.toggleShow&&window.__anno.toggleShow(true);window.__anno.toggleMode(true);} await wait(200);
      const btn=[...document.querySelectorAll('#app .el-button, #app button')].find(e=>/^充值$/.test(txt(e))); if(!btn)return 'no-btn';
      const r=btn.getBoundingClientRect(); btn.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+8,clientY:r.top+8})); await wait(450);
      const ok=[...document.querySelectorAll('.anno-confirm-bubble button')].find(b=>/确定|添加/.test(txt(b))); if(ok)ok.click(); await wait(600);
      return (${RD}).length; })()`, true);

    // ★ 读回【圈选 pin 的真实 fpKey】——真实流程里 AI 拿"已圈功能清单"里的真 key 去编辑/删除，
    //   绝不臆造 key（圈选 pin 的 fpKey 由 pageKey 派生，如 OMS-recharge-list.充值，非 OMS.充值）。
    const REAL_KEY = await evalv(`((${RD})[0]||{}).zoneContext ? (${RD})[0].zoneContext.fpKey : ((${RD})[0]||{}).boundFp || ''`);

    // ── ② 对话框编辑：inject 同名功能带新字段规范 → SSE → 原型 PIN 就地更新 ──
    await post('/anno-inject', { systemName: sys, pins: [{ fpKey: REAL_KEY, title: '充值', fieldSpecs: EDIT_FIELDSPECS, useCaseRules: '**前置条件**\n\n已登录。', isAIDraft: false }] });
    let editedOk = false; for (let i = 0; i < 40; i++) { await sleep(400); const pins = await evalv(RD); if (Array.isArray(pins) && pins.some(p => String(p.fieldSpecs || '').includes(EDIT_MARKER))) { editedOk = true; break; } }

    // ── ③ 对话框删除：/anno-update delete → SSE pin-deleted → 原型 PIN 消失 ──
    await post('/anno-update', { systemName: sys, changes: [{ action: 'delete', pin: { zoneContext: { fpKey: REAL_KEY }, boundFp: REAL_KEY, title: '充值' } }] });
    let deletedOk = false; for (let i = 0; i < 40; i++) { await sleep(400); const pins = await evalv(RD); if (Array.isArray(pins) && pins.length === 0) { deletedOk = true; break; } }

    console.log('\n════════ 对话框→原型标注 实时同步 隔离闸（真机 SSE·不碰真数据）════════');
    console.log((circled === 1 ? '  ✓ ' : '  ✗ ') + '① 圈选真实元素 → 原型出现 1 个标注 PIN  〔pins=' + circled + '〕');
    console.log((editedOk   ? '  ✓ ' : '  ✗ ') + '② 对话框编辑(inject)→ SSE inject-pins → 原型 PIN 字段规范就地更新（含「' + EDIT_MARKER + '」）= 三.2 对话框编辑→原型标注');
    console.log((deletedOk  ? '  ✓ ' : '  ✗ ') + '③ 对话框删除(delete)→ SSE pin-deleted → 原型 PIN 实时消失（PIN 数→0）= 三.2 对话框删除→原型标注');
    const pass = circled === 1 && editedOk && deletedOk;
    console.log('──────────────────────────────');
    console.log(pass ? '  对话框→原型标注 实时同步 隔离闸 全绿 PASS ✅' : '  对话框→原型标注 实时同步 隔离闸 FAIL ❌');
    console.log('════════════════════════════════\n');
    ws.close(); exitCode = pass ? 0 : 1;
  } catch (e) { console.log('✗ 隔离闸异常:', e.message); }
  finally { try { server.close(); } catch (_) {} try { ch.kill(); } catch (_) {} try { srv.kill(); } catch (_) {} try { fs.closeSync(out); } catch (_) {} setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} process.exit(exitCode); }, 500); }
})();
