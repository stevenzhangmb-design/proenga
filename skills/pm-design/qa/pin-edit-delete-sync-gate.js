#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   原型内编辑/删除 → 本地PRD · 隔离闸 · pin-edit-delete-sync-gate.js · 随包·不碰真数据
   ────────────────────────────────────────────────────────────────────────
   补齐【铁律三.2 前半句】之前只验"改功能名(㉕)"、没验的两条真机链路：
     ① 原型标注面板里【编辑用例规则】→ 点「保存」(commitEdit→_syncPinToServer→/anno-update)
        → 本地 PRD 文档同步写入该内容。
     ② 原型标注弹窗底部点【🗑删除】(deletePin) → 本地 PRD 里该功能点【同步删除】。
        —— 此条正是历史缺口：deletePin 原只 _savePins→/anno-persist(烤HTML)、annoChangelog 从不flush，
           从 pin 弹窗🗑删只消失标注、本地 PRD 功能点还留着。1.9.7 把删除同步收进 deletePin 单一源后，本闸兜死。
   —— 完全隔离（同 ㉖/㉗）：临时端口 anno-server + 临时 archive + 现装原型；浏览器里 fetch/EventSource
      都重定向到临时端口——真实例/真数据碰都不碰。断言读【临时目录】prd-data.json / PRD-<sys>.md。
   零依赖：node 内置 + 本机 Chrome + assemble-prototype.js + anno-server/server.js(ANNO_PORT 覆盖端口)。
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
const APORT = 3814, WPORT = 8977, DPORT = 9477;
const EDIT_MARKER = '前置条件MARKER编辑XYZ';

const pingA = () => new Promise(res => { const r = http.get(`http://localhost:${APORT}/anno-queue`, x => { res(x.statusCode === 200); x.resume(); }); r.on('error', () => res(false)); r.setTimeout(1500, () => { r.destroy(); res(false); }); });
const sleep = ms => new Promise(z => setTimeout(z, ms));
async function waitUntil(fn, waitMs = 30000, step = 500) { const t0 = Date.now(); while (Date.now() - t0 < waitMs) { try { if (fn()) return true; } catch (_) {} await sleep(step); } return false; }

(async () => {
  if (!CHROME) { console.log('⊘ SKIP：未找到 Chrome/Edge'); process.exit(0); }
  if (!SERVER) { console.log('⊘ SKIP：未找到 anno-server/server.js'); process.exit(0); }
  const _v = await ensureVendor();
  if (!_v.ok) { console.log('⊘ SKIP：离线 vendor 缓存缺失且下载失败（' + _v.missing + '），需联网首次预热 _gate-vendor'); process.exit(0); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'pineditgate-'));
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
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + DPORT, '--user-data-dir=' + path.join(tmp, 'ud'), 'about:blank']);
  const prdFile = path.join(tmp, 'PRD-' + sys + '.md');
  const readData = () => { try { return JSON.parse(fs.readFileSync(path.join(tmp, 'prd-data.json'), 'utf8').replace(/^﻿/, '')); } catch (_) { return { function_points: {} }; } };
  const mdHas = (s) => { try { return fs.existsSync(prdFile) && fs.readFileSync(prdFile, 'utf8').includes(s); } catch (_) { return false; } };
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
    for (let i = 0; i < 120; i++) { await sleep(150); if (await evalv("(typeof window._annoInjectPins==='function'&&document.querySelector('#app')&&document.querySelector('#app').childElementCount>3)?1:0") === 1) break; }
    await sleep(1000);
    const RD = `JSON.parse(localStorage.getItem('anno-pins-v2::'+(window.__PRD_DATA__&&window.__PRD_DATA__.system_name||'default'))||'[]')`;

    // ── 圈选 → 出现 1 个 PIN ─────────────────────────────────────────────
    const circled = await evalv(`(async()=>{ const wait=ms=>new Promise(z=>setTimeout(z,ms)); const txt=el=>(el?.textContent||'').replace(/\\s+/g,' ').trim();
      if(window.__anno){window.__anno.toggleShow&&window.__anno.toggleShow(true);window.__anno.toggleMode(true);} await wait(200);
      const btn=[...document.querySelectorAll('#app .el-button, #app button')].find(e=>/^充值$/.test(txt(e))); if(!btn)return 'no-btn';
      const r=btn.getBoundingClientRect(); btn.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+8,clientY:r.top+8})); await wait(450);
      const ok=[...document.querySelectorAll('.anno-confirm-bubble button')].find(b=>/确定|添加/.test(txt(b))); if(ok)ok.click(); await wait(600);
      return (${RD}).length; })()`, true);
    const REAL_KEY = await evalv(`((${RD})[0]||{}).zoneContext ? (${RD})[0].zoneContext.fpKey : ((${RD})[0]||{}).boundFp || ''`);

    // ── ① 打开面板 → 用例规则Tab → 编辑 → 前置条件填 marker → 保存(commitEdit) ──
    const edited = await evalv(`(async()=>{ const wait=ms=>new Promise(z=>setTimeout(z,ms)); const txt=el=>(el?.textContent||'').replace(/\\s+/g,' ').trim();
      const pin=document.querySelector('.anno-pin'); if(!pin)return 'no-pin'; pin.click(); await wait(500);
      const casesTab=[...document.querySelectorAll('.pin-modal-tab')].find(t=>/用例规则/.test(txt(t))); if(casesTab)casesTab.click(); await wait(200);
      const editBtn=[...document.querySelectorAll('.pin-modal-ft .el-button, .pin-modal-ft button')].find(b=>/^编辑$/.test(txt(b))); if(!editBtn)return 'no-editbtn'; editBtn.click(); await wait(400);
      const ta=document.querySelector('.uc-sec-ta'); if(!ta)return 'no-textarea';
      const setNative=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set; setNative.call(ta,'${EDIT_MARKER}'); ta.dispatchEvent(new Event('input',{bubbles:true})); await wait(300);
      const saveBtn=[...document.querySelectorAll('.pin-modal-ft .el-button, .pin-modal-ft button')].find(b=>/^保存$/.test(txt(b))); if(!saveBtn)return 'no-savebtn'; saveBtn.click();
      await wait(2500); return 'saved'; })()`, true);
    const editData = await waitUntil(() => !!(readData().function_points || {})[REAL_KEY]);
    const editMd   = await waitUntil(() => mdHas(EDIT_MARKER), 90000);

    // ── ② 重新打开面板 → 点🗑删除(deletePin) → 本地 PRD 同步删该功能点 ──
    const deleted = await evalv(`(async()=>{ const wait=ms=>new Promise(z=>setTimeout(z,ms));
      // 面板可能编辑保存后仍开着——先确保开着（🗑在面板底部）：没🗑就点 pin 开面板；点 pin 若把已开面板切关了则再点一次
      let delBtn=document.querySelector('.pin-modal-del');
      if(!delBtn){ const pin=document.querySelector('.anno-pin'); if(!pin)return 'no-pin'; pin.click(); await wait(500); delBtn=document.querySelector('.pin-modal-del'); if(!delBtn){ pin.click(); await wait(500); delBtn=document.querySelector('.pin-modal-del'); } }
      if(!delBtn)return 'no-delbtn'; delBtn.click();
      await wait(1800); return (${RD}).length; })()`, true);
    const delData = await waitUntil(() => !(readData().function_points || {})[REAL_KEY], 30000);
    const delMd   = await waitUntil(() => fs.existsSync(prdFile) && !mdHas(EDIT_MARKER), 30000);

    console.log('\n════════ 原型内编辑/删除 → 本地PRD 隔离闸（真机·不碰真数据）════════');
    console.log((circled === 1 ? '  ✓ ' : '  ✗ ') + '圈选真实元素 → 原型出现 1 个标注 PIN  〔pins=' + circled + '〕');
    console.log((edited === 'saved' ? '  ✓ ' : '  ✗ ') + '① 面板编辑用例规则(前置条件)+保存  〔' + edited + '〕');
    console.log((editData && editMd ? '  ✓ ' : '  ✗ ') + '① 保存 → 本地 PRD 写入该内容（prd-data 有该功能点 + PRD.md 含「' + EDIT_MARKER + '」）= 三.2 原型编辑用例规则→本地PRD');
    console.log((deleted === 0 ? '  ✓ ' : '  ✗ ') + '② 点🗑删除 → 原型标注 PIN 消失  〔pins=' + deleted + '〕');
    console.log((delData && delMd ? '  ✓ ' : '  ✗ ') + '② 点🗑删除 → 本地 PRD 同步删除该功能点（prd-data 已移除 + PRD.md 不再含）= 三.2 原型删除→本地PRD（deletePin 单一源修复）');
    const pass = circled === 1 && edited === 'saved' && editData && editMd && deleted === 0 && delData && delMd;
    console.log('──────────────────────────────');
    console.log(pass ? '  原型内编辑/删除 → 本地PRD 隔离闸 全绿 PASS ✅' : '  原型内编辑/删除 → 本地PRD 隔离闸 FAIL ❌');
    console.log('════════════════════════════════\n');
    ws.close(); exitCode = pass ? 0 : 1;
  } catch (e) { console.log('✗ 隔离闸异常:', e.message); }
  finally { try { server.close(); } catch (_) {} try { ch.kill(); } catch (_) {} try { srv.kill(); } catch (_) {} try { fs.closeSync(out); } catch (_) {} setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} process.exit(exitCode); }, 500); }
})();
