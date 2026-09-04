#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   导出分享版·行为闸 · share-export-behavior-gate.js · 随包·不碰真数据
   ────────────────────────────────────────────────────────────────────────
   补齐【铁律二.3 ①②③④】——原 ㉓ 只是【静态断言】(检查标准件代码里没"没标注不让导"拦截 +
   showPins=ref(true))，没有一道闸【真机点导出按钮】跑通导出流程。本闸真机跑：
     ① 没标注也导：0 个标注时点导出 → 仍产出分享版 HTML（无"没标注不让导"拦截）。
     ② 有标注也导：圈选 1 个标注后点导出 → 分享版 HTML 内嵌该标注。
     ③ 只读+标注默认显示+无编辑功能：分享版 HTML 烤入 __ANNO_READONLY__=true + body.anno-preview-mode
        (CSS 从加载即隐藏 .anno-author-only 编辑控件) + __USER_ANNOTATIONS__(嵌入定位标注)。
     ④ 可另存：导出走 _saveWithPicker（showSaveFilePicker 选保存位置）——本闸注入【假 picker】捕获导出内容，
        picker 路径真的执行 = 另存机制成立（真浏览器 file:// 禁则退回下载，此处只验 picker 代码路径跑通）。
   —— 完全隔离（同 ㉖-㉙）：临时端口 anno-server + 临时 archive + 现装原型 + 本地 vendor；fetch 重定向临时端口。
   零依赖：node + 本机 Chrome + _gate-vendor。退出码：0=通过/跳过 1=失败。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn, execFileSync } = require('child_process');
const { findChrome } = require('./_gate-env');
const { ensureVendor, localize, copyVendorInto } = require('./_gate-vendor');
const CHROME = process.env.CHROME_PATH || findChrome();
const QA = __dirname;

/* ── ④静态顺序断言（2026-07-09 真 bug 回归防线）──────────────────────────────
   真 bug：旧代码「先 await fetch 拿内容 → 再弹保存框」。Chrome 要求 showSaveFilePicker 必须在
   【用户手势有效期内】调用；await 之后手势已过期 → 框根本弹不出来 → 抛 AbortError → 被误判成
   "用户取消" → 永远提示「已取消保存」，另存红线④实际从未工作。
   而本闸下方的真机部分【注入假 picker】，绕开了真实手势限制，所以 runtime 抓不到这个 bug（判绿·虚假安全感）。
   故此处加静态断言：exportShareVersion 里必须【先调 _pickSaveHandle → 再 fetch】。顺序反了即红。 */
(function assertPickerBeforeFetch() {
  const LAYER = path.join(QA, '..', 'components', 'annotation-layer.html');
  let src; try { src = fs.readFileSync(LAYER, 'utf8'); } catch (e) { console.log('✗ ④静态: 读不到 annotation-layer.html'); process.exit(1); }
  const start = src.indexOf('const exportShareVersion');
  if (start < 0) { console.log('✗ ④静态: 找不到 exportShareVersion —— 闸需更新'); process.exit(1); }
  const body = src.slice(start, start + 2500);
  const iPick = body.indexOf('_pickSaveHandle(');
  const iFetch = body.indexOf('fetch(');
  if (iPick < 0) { console.log('✗ ④静态: exportShareVersion 未先调用 _pickSaveHandle(弹保存框拿 handle)'); process.exit(1); }
  if (iFetch >= 0 && iPick > iFetch) {
    console.log('✗ ④静态: showSaveFilePicker 被放到 fetch 之后 → 用户手势过期、另存框弹不出(退化成"已取消保存")。');
    console.log('         必须【① 先弹框拿 handle → ② 再 fetch 内容 → ③ 最后写入】。');
    process.exit(1);
  }
  console.log('  ✓ ④静态: 先弹保存框(_pickSaveHandle) → 再 fetch 内容 —— 用户手势顺序正确');

  /* ④静态-b（2026-07-10）：AbortError 必须用【耗时判据】区分"用户真取消" vs "框弹不出来"。
     真 bug：双击打开的 file:// 页面被 Chrome 禁 File System Access API → 瞬时抛 AbortError
     → 旧写法一律当"用户取消" → 永远提示「已取消保存」且什么都没存（红线④在真实使用场景里是坏的）。
     谁把耗时判据删掉、退回"AbortError 一律当取消"，此断言判红。 */
  const pickFn = src.slice(src.indexOf('const _pickSaveHandle'), src.indexOf('const _pickSaveHandle') + 1200);
  const hasMin = /_PICKER_MIN_MS/.test(src) && /AbortError[\s\S]{0,80}_dt\s*>=\s*_PICKER_MIN_MS/.test(pickFn);
  if (!hasMin) {
    console.log('✗ ④静态-b: _pickSaveHandle 里 AbortError 没有用耗时判据区分「用户取消」和「框弹不出来」。');
    console.log('         → file:// (双击打开) 场景会误报「已取消保存」且不保存。必须保留 _dt >= _PICKER_MIN_MS 判据。');
    process.exit(1);
  }
  console.log('  ✓ ④静态-b: AbortError 用耗时判据区分「真取消」与「弹不出来」—— file:// 不会误报');
})();
const SERVER = [
  path.join(QA, '..', '..', '..', '..', 'anno-server', 'server.js'),
  path.join(QA, '..', '..', '..', 'anno-server', 'server.js'),
  'D:/AI/anno-server/server.js',
].find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });
const APORT = 3817, WPORT = 8982, DPORT = 9482;

const pingA = () => new Promise(res => { const r = http.get(`http://localhost:${APORT}/anno-queue`, x => { res(x.statusCode === 200); x.resume(); }); r.on('error', () => res(false)); r.setTimeout(1500, () => { r.destroy(); res(false); }); });
const sleep = ms => new Promise(z => setTimeout(z, ms));

(async () => {
  if (!CHROME) { console.log('⊘ SKIP：未找到 Chrome/Edge'); process.exit(0); }
  if (!SERVER) { console.log('⊘ SKIP：未找到 anno-server/server.js'); process.exit(0); }
  const _v = await ensureVendor();
  if (!_v.ok) { console.log('⊘ SKIP：离线 vendor 缓存缺失且下载失败（' + _v.missing + '）'); process.exit(0); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'shareexp-'));
  const proto = path.join(tmp, 'p.html');
  try {
    execFileSync('node', [path.join(QA, 'assemble-prototype.js'), path.join(QA, 'fixtures', 'roundtrip-data.json'), proto], { stdio: 'pipe', timeout: 120000 });
    fs.writeFileSync(proto, localize(fs.readFileSync(proto, 'utf8')), 'utf8'); copyVendorInto(tmp);
  } catch (e) { console.log('⊘ SKIP：现装测试原型失败:', String(e.message || e).split('\n')[0]); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); }

  const out = fs.openSync(path.join(tmp, 'srv.log'), 'a');
  const srv = spawn(process.execPath, [SERVER], { cwd: path.dirname(SERVER), stdio: ['ignore', out, out], windowsHide: true, env: { ...process.env, ANNO_PORT: String(APORT), ANNO_ARCHIVE_DIR: tmp, ANNO_DOCX_MAX_TRIES: '1', ANNO_DOCX_RETRY_MS: '500' } });
  let up = false; for (let i = 0; i < 70; i++) { if (await pingA()) { up = true; break; } await sleep(500); }
  if (!up) { console.log('⊘ SKIP：临时 anno-server 未起来'); try { srv.kill(); } catch (_) {} fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); }

  const _mime = p => /\.html$/.test(p) ? 'text/html;charset=utf-8' : /\.js$/.test(p) ? 'application/javascript;charset=utf-8' : /\.css$/.test(p) ? 'text/css;charset=utf-8' : 'application/octet-stream';
  const server = http.createServer((rq, rs) => { const p = path.join(tmp, decodeURIComponent(rq.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'Content-Type': _mime(p) }); rs.end(d); }); }).listen(WPORT);
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + DPORT, '--user-data-dir=' + path.join(tmp, 'ud'), 'about:blank']);
  let exitCode = 1;
  try {
    let page = null; for (let i = 0; i < 50; i++) { try { page = (await (await fetch(`http://localhost:${DPORT}/json/list`)).json()).find(t => t.type === 'page'); if (page) break; } catch (e) {} await sleep(200); }
    const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = {}; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
    const send = (m, p = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    const evalv = async (expr, aw = false) => (await send('Runtime.evaluate', { expression: expr, awaitPromise: aw, returnByValue: true })).result?.result?.value;
    await send('Page.enable'); await send('Runtime.enable');
    // fetch 重定向临时端口 + 注入【假 showSaveFilePicker】捕获导出内容（真机走 exportShare→_saveWithPicker→picker 路径）
    await send('Page.addScriptToEvaluateOnNewDocument', { source:
      `(function(){var of=window.fetch;window.fetch=function(u,o){try{if(typeof u==='string')u=u.replace('localhost:3799','localhost:${APORT}');else if(u&&u.url)u=new Request(u.url.replace('localhost:3799','localhost:${APORT}'),u);}catch(e){}return of.call(this,u,o);};` +
      `window.__lastSave=null;window.showSaveFilePicker=async function(opts){return {name:(opts&&opts.suggestedName)||'share.html',createWritable:async function(){return {write:async function(blob){window.__lastSave={name:(opts&&opts.suggestedName)||'',content:(blob&&blob.text)?await blob.text():String(blob),viaPicker:true};},close:async function(){}};}};};})();` });
    await send('Page.navigate', { url: `http://localhost:${WPORT}/p.html?reset=1` });
    for (let i = 0; i < 120; i++) { await sleep(150); if (await evalv("(typeof window.__anno!=='undefined'&&document.querySelector('#app')&&document.querySelector('#app').childElementCount>3)?1:0") === 1) break; }
    await sleep(1000);
    const RD = `JSON.parse(localStorage.getItem('anno-pins-v2::'+(window.__PRD_DATA__&&window.__PRD_DATA__.system_name||'default'))||'[]')`;
    const doExport = async () => { await evalv(`(async()=>{ window.__lastSave=null; try{ await window.__anno.exportShare(); }catch(e){} return 1; })()`, true);
      for (let i = 0; i < 24; i++) { await sleep(400); const s = await evalv(`window.__lastSave?window.__lastSave.content:''`); if (s) return s; } return ''; };

    // ── ① 没标注也导（0 pins）──────────────────────────────────────────────
    const pins0 = await evalv(`(${RD}).length`);
    const capA = await doExport();
    const aProduced = !!capA && capA.length > 500;
    const aReadonly = /__ANNO_READONLY__\s*=\s*true/.test(capA);
    const aPreview  = /anno-preview-mode/.test(capA);

    // ── ② 有标注也导（圈选 1 个）+ ③ 只读/嵌入/preview ─────────────────────
    const circled = await evalv(`(async()=>{ const wait=ms=>new Promise(z=>setTimeout(z,ms)); const txt=el=>(el?.textContent||'').replace(/\\s+/g,' ').trim();
      if(window.__anno){window.__anno.toggleShow&&window.__anno.toggleShow(true);window.__anno.toggleMode(true);} await wait(200);
      const btn=[...document.querySelectorAll('#app .el-button, #app button')].find(e=>/^查询$/.test(txt(e))); if(!btn)return 'no-btn';
      const r=btn.getBoundingClientRect(); btn.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+8,clientY:r.top+8})); await wait(450);
      const ok=[...document.querySelectorAll('.anno-confirm-bubble button')].find(b=>/确定|添加/.test(txt(b))); if(ok)ok.click(); await wait(600);
      return (${RD}).length; })()`, true);
    const capB = await doExport();
    const bProduced = !!capB && capB.length > 500;
    const bReadonly = /__ANNO_READONLY__\s*=\s*true/.test(capB);
    const bPreview  = /anno-preview-mode/.test(capB);
    const bHasPin   = /__USER_ANNOTATIONS__\s*=\s*\[[^\]]*查询[^\]]*\]/.test(capB) || (/__USER_ANNOTATIONS__\s*=\s*\[/.test(capB) && /查询/.test(capB.split('__USER_ANNOTATIONS__')[1] || ''));

    console.log('\n════════ 导出分享版 行为闸（真机点导出·假picker捕获·不碰真数据）════════');
    console.log((pins0 === 0 && aProduced ? '  ✓ ' : '  ✗ ') + '① 没标注(0 pin)也导 → 产出分享版 HTML  〔pins=' + pins0 + ' len=' + (capA ? capA.length : 0) + '〕');
    console.log((circled === 1 && bProduced ? '  ✓ ' : '  ✗ ') + '② 圈选 1 个标注后也导 → 产出分享版 HTML  〔pins=' + circled + '〕');
    console.log((bHasPin ? '  ✓ ' : '  ✗ ') + '② 分享版内嵌该标注（__USER_ANNOTATIONS__ 含「查询」）');
    console.log((aReadonly && bReadonly ? '  ✓ ' : '  ✗ ') + '③ 分享版烤入只读 __ANNO_READONLY__=true（别人打开即只读）');
    console.log((aPreview && bPreview ? '  ✓ ' : '  ✗ ') + '③ 分享版 body.anno-preview-mode（隐藏编辑控件=其他功能没有·只看标注）');
    console.log((!!capA || !!capB ? '  ✓ ' : '  ✗ ') + '④ 导出走 _saveWithPicker→showSaveFilePicker（另存位置机制·picker 路径真执行捕获到内容）');
    const pass = pins0 === 0 && aProduced && aReadonly && aPreview && circled === 1 && bProduced && bReadonly && bPreview && bHasPin;
    console.log('──────────────────────────────');
    console.log(pass ? '  导出分享版 行为闸 全绿 PASS ✅' : '  导出分享版 行为闸 FAIL ❌');
    console.log('════════════════════════════════\n');
    ws.close(); exitCode = pass ? 0 : 1;
  } catch (e) { console.log('✗ 闸异常:', e.message); }
  finally { try { server.close(); } catch (_) {} try { ch.kill(); } catch (_) {} try { srv.kill(); } catch (_) {} try { fs.closeSync(out); } catch (_) {} setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} process.exit(exitCode); }, 500); }
})();
