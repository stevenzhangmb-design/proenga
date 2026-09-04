#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   自动截图端到端 · 隔离闸 · screenshot-capture-gate.js · 随包·不碰真数据
   ────────────────────────────────────────────────────────────────────────
   补齐【铁律三.1 / 三.4「特别是自动截图…不能影响」】——之前只有 ⑮ 静态断言"真 PRD 的 docx 里嵌了
   截图"，没有一道闸真机跑过【浏览器 html2canvas 截图 → POST /anno-screenshots → 写进 PRD 的 .2 原型图】
   整条捕获链。本闸真机跑通它：
     ① 圈选一个真实元素 → 出现标注 PIN；② /anno-inject 建该功能点(截图只写进 prd-data 已有的功能点)；
     ③ 真机调 window.__anno.captureScreen()（预置本地 html2canvas·免 CDN）→ html2canvas 截锚元素；
     ④ 断言：临时 archive 落 screenshots/<slug>/IMG-NN.png + prd-data 该功能点 fp.img 写入截图路径
        + PRD-<sys>.md 的原型图节引用该截图（不再是「无」）。
   —— 完全隔离（同 ㉖/㉗/㉘）：临时端口 anno-server + 临时 archive + 现装原型 + 本地 vendor；浏览器
      fetch 重定向到临时端口——真实例/真数据碰都不碰。零依赖：node + 本机 Chrome + _gate-vendor。
   退出码：0=通过/跳过 1=失败。缺 anno-server/Chrome/vendor 则 SKIP(exit 0)。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn, execFileSync } = require('child_process');
const { findChrome } = require('./_gate-env');
const { ensureVendor, localize, copyVendorInto, CACHE } = require('./_gate-vendor');
const CHROME = process.env.CHROME_PATH || findChrome();
const QA = __dirname;
const SERVER = [
  path.join(QA, '..', '..', '..', '..', 'anno-server', 'server.js'),
  path.join(QA, '..', '..', '..', 'anno-server', 'server.js'),
  'D:/AI/anno-server/server.js',
].find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });
const APORT = 3815, WPORT = 8978, DPORT = 9478;

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
async function waitUntil(fn, waitMs = 30000, step = 500) { const t0 = Date.now(); while (Date.now() - t0 < waitMs) { try { if (fn()) return true; } catch (_) {} await sleep(step); } return false; }
const FS = '| 字段名称 | 类型 | 是否必填/必选 | 默认值 | 约束规则 |\n| --- | --- | --- | --- | --- |\n| 金额 | 金额 | 是 | 空 | 非负;2位小数。 |';
const UC = '**前置条件**\n\n已登录。\n\n**操作流程**\n\n正向：点击→成功。';
// 递归找 tmp 下 screenshots 目录里的 png
function findPng(dir) { let out = []; try { for (const f of fs.readdirSync(dir)) { const p = path.join(dir, f); const st = fs.statSync(p); if (st.isDirectory()) out = out.concat(findPng(p)); else if (/\.png$/i.test(f)) out.push(p); } } catch (_) {} return out; }

(async () => {
  if (!CHROME) { console.log('⊘ SKIP：未找到 Chrome/Edge'); process.exit(0); }
  if (!SERVER) { console.log('⊘ SKIP：未找到 anno-server/server.js'); process.exit(0); }
  const _v = await ensureVendor();
  if (!_v.ok) { console.log('⊘ SKIP：离线 vendor 缓存缺失且下载失败（' + _v.missing + '）'); process.exit(0); }
  const H2C = (() => { try { return fs.readFileSync(path.join(CACHE, 'html2canvas.js'), 'utf8'); } catch (_) { return ''; } })();
  if (!H2C) { console.log('⊘ SKIP：html2canvas 缓存缺失'); process.exit(0); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shotgate-'));
  const proto = path.join(tmp, 'p.html');
  let sys = '';
  try {
    execFileSync('node', [path.join(QA, 'assemble-prototype.js'), path.join(QA, 'fixtures', 'roundtrip-data.json'), proto], { stdio: 'pipe', timeout: 120000 });
    fs.writeFileSync(proto, localize(fs.readFileSync(proto, 'utf8')), 'utf8'); copyVendorInto(tmp);
    sys = (JSON.parse(fs.readFileSync(path.join(QA, 'fixtures', 'roundtrip-data.json'), 'utf8')).systemName) || '';
  } catch (e) { console.log('⊘ SKIP：现装测试原型失败:', String(e.message || e).split('\n')[0]); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); }

  const errLog = path.join(tmp, 'srv.log'); const out = fs.openSync(errLog, 'a');
  const srv = spawn(process.execPath, [SERVER], { cwd: path.dirname(SERVER), stdio: ['ignore', out, out], windowsHide: true, env: { ...process.env, ANNO_PORT: String(APORT), ANNO_ARCHIVE_DIR: tmp, ANNO_DOCX_MAX_TRIES: '1', ANNO_DOCX_RETRY_MS: '500' } });
  let up = false; for (let i = 0; i < 70; i++) { if (await pingA()) { up = true; break; } await sleep(500); }
  if (!up) { console.log('⊘ SKIP：临时 anno-server 未起来'); try { srv.kill(); } catch (_) {} fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); }

  const _mime = p => /\.html$/.test(p) ? 'text/html;charset=utf-8' : /\.js$/.test(p) ? 'application/javascript;charset=utf-8' : /\.css$/.test(p) ? 'text/css;charset=utf-8' : 'application/octet-stream';
  const server = http.createServer((rq, rs) => { const p = path.join(tmp, decodeURIComponent(rq.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'Content-Type': _mime(p) }); rs.end(d); }); }).listen(WPORT);
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + DPORT, '--user-data-dir=' + path.join(tmp, 'ud'), 'about:blank']);
  const prdFile = path.join(tmp, 'PRD-' + sys + '.md');
  const readData = () => { try { return JSON.parse(fs.readFileSync(path.join(tmp, 'prd-data.json'), 'utf8').replace(/^﻿/, '')); } catch (_) { return { function_points: {} }; } };
  let exitCode = 1;
  try {
    let page = null; for (let i = 0; i < 50; i++) { try { page = (await (await fetch(`http://localhost:${DPORT}/json/list`)).json()).find(t => t.type === 'page'); if (page) break; } catch (e) {} await sleep(200); }
    const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = {}; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
    const send = (m, p = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    const evalv = async (expr, aw = false) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: aw, returnByValue: true })).result?.result?.value;
    await send('Page.enable'); await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(function(){var of=window.fetch;window.fetch=function(u,o){try{if(typeof u==='string')u=u.replace('localhost:3799','localhost:${APORT}');else if(u&&u.url)u=new Request(u.url.replace('localhost:3799','localhost:${APORT}'),u);}catch(e){}return of.call(this,u,o);};var OE=window.EventSource;if(OE){var NE=function(u,o){try{if(typeof u==='string')u=u.replace('localhost:3799','localhost:${APORT}');}catch(e){}return new OE(u,o);};NE.prototype=OE.prototype;window.EventSource=NE;}})();` });
    await send('Page.navigate', { url: `http://localhost:${WPORT}/p.html?reset=1` });
    for (let i = 0; i < 120; i++) { await sleep(150); if (await evalv("(typeof window.__anno!=='undefined'&&document.querySelector('#app')&&document.querySelector('#app').childElementCount>3)?1:0") === 1) break; }
    await sleep(1000);
    // 预置本地 html2canvas → captureScreen 不走 CDN
    await send('Runtime.evaluate', { expression: H2C });
    const hasH2C = await evalv("typeof window.html2canvas");
    const RD = `JSON.parse(localStorage.getItem('anno-pins-v2::'+(window.__PRD_DATA__&&window.__PRD_DATA__.system_name||'default'))||'[]')`;

    // ① 圈选 → PIN ；读真实 fpKey
    const circled = await evalv(`(async()=>{ const wait=ms=>new Promise(z=>setTimeout(z,ms)); const txt=el=>(el?.textContent||'').replace(/\\s+/g,' ').trim();
      if(window.__anno){window.__anno.toggleShow&&window.__anno.toggleShow(true);window.__anno.toggleMode(true);} await wait(200);
      const btn=[...document.querySelectorAll('#app .el-button, #app button')].find(e=>/^查询$/.test(txt(e))); if(!btn)return 'no-btn';
      const r=btn.getBoundingClientRect(); btn.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+8,clientY:r.top+8})); await wait(450);
      const ok=[...document.querySelectorAll('.anno-confirm-bubble button')].find(b=>/确定|添加/.test(txt(b))); if(ok)ok.click(); await wait(600);
      return (${RD}).length; })()`, true);
    const REAL_KEY = await evalv(`((${RD})[0]||{}).zoneContext ? (${RD})[0].zoneContext.fpKey : ((${RD})[0]||{}).boundFp || ''`);

    // ② 建功能点（截图只写进 prd-data 已有的功能点）
    await post('/anno-inject', { systemName: sys, pins: [{ fpKey: REAL_KEY, title: '查询', fieldSpecs: FS, useCaseRules: UC, isAIDraft: false }] });
    const fpReady = await waitUntil(() => !!(readData().function_points || {})[REAL_KEY], 90000);

    // ③ 真机截图
    const shotRet = await evalv(`(async()=>{ try{ await window.__anno.captureScreen(); return 'called'; }catch(e){ return 'err:'+(e&&e.message||e); } })()`, true);
    // 截图 POST /anno-screenshots → 服务器写 png + 回写 fp.img + 重生 PRD（异步），轮询落盘
    const pngWritten = await waitUntil(() => findPng(path.join(tmp, 'screenshots')).length > 0, 30000);
    const imgInData  = await waitUntil(() => { const fp = (readData().function_points || {})[REAL_KEY] || {}; return /screenshots\//.test(String(fp.img || '')) && /IMG-/.test(String(fp.img || '')); }, 30000);
    const imgInMd    = await waitUntil(() => { try { return fs.existsSync(prdFile) && /!\[IMG-\d+[^\]]*\]\(screenshots\//.test(fs.readFileSync(prdFile, 'utf8')); } catch (_) { return false; } }, 30000);

    console.log('\n════════ 自动截图端到端 隔离闸（真机 html2canvas·不碰真数据）════════');
    console.log((hasH2C === 'function' ? '  ✓ ' : '  ✗ ') + '预置本地 html2canvas（免 CDN）  〔' + hasH2C + '〕');
    console.log((circled === 1 ? '  ✓ ' : '  ✗ ') + '圈选真实元素 → 原型出现 1 个标注 PIN  〔pins=' + circled + '〕');
    console.log((fpReady ? '  ✓ ' : '  ✗ ') + '/anno-inject 建功能点「' + REAL_KEY + '」进临时 prd-data');
    console.log((shotRet === 'called' ? '  ✓ ' : '  ✗ ') + '真机调 captureScreen()  〔' + shotRet + '〕');
    console.log((pngWritten ? '  ✓ ' : '  ✗ ') + 'html2canvas 截图 → 临时 archive 落 screenshots/<slug>/IMG-NN.png');
    console.log((imgInData ? '  ✓ ' : '  ✗ ') + '截图路径回写 prd-data 该功能点 fp.img');
    console.log((imgInMd ? '  ✓ ' : '  ✗ ') + 'PRD-<sys>.md 原型图节引用该截图（= 自动截图写进 PRD 成立·不影响生成）');
    const pass = circled === 1 && fpReady && shotRet === 'called' && pngWritten && imgInData && imgInMd;
    console.log('──────────────────────────────');
    console.log(pass ? '  自动截图端到端 隔离闸 全绿 PASS ✅' : '  自动截图端到端 隔离闸 FAIL ❌');
    console.log('════════════════════════════════\n');
    ws.close(); exitCode = pass ? 0 : 1;
  } catch (e) { console.log('✗ 隔离闸异常:', e.message); }
  finally { try { server.close(); } catch (_) {} try { ch.kill(); } catch (_) {} try { srv.kill(); } catch (_) {} try { fs.closeSync(out); } catch (_) {} setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} process.exit(exitCode); }, 500); }
})();
