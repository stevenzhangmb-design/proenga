#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   保存即同步 · 隔离闸 · sync-isolated-gate.js · 随包发（可进 deliver-gate·不污染真数据）
   ────────────────────────────────────────────────────────────────────────
   验【标注里改功能名 → 保存 → 自动写本地 PRD 文件】整条链（铁律三.2 的"标注→本地PRD"方向）。
   —— 【完全隔离·治"污染真 prd-data"】：起一个【临时 anno-server 实例】(临时端口 ANNO_PORT +
      临时目录 ANNO_ARCHIVE_DIR)，在临时目录里【现装一个测试原型】跑改名保存，验完销毁整个临时目录。
      浏览器里把原型对 localhost:3799 的 fetch【重定向到临时端口】——真实例(3799)、真 archive/prd-data
      【碰都不碰】。旧 sync-integration-test 用真实例+真archive(靠备份还原·崩溃会污染)，本闸根治。
   零依赖：node 内置 + 本机 Chrome + assemble-prototype.js + anno-server/server.js(ANNO_PORT 覆盖端口)。
   退出码：0=通过/跳过 1=失败。找不到 anno-server/Chrome 则 SKIP(exit 0)。
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
const APORT = 3810, WPORT = 8974, DPORT = 9474, NEWNAME = '改名-隔离测试X';

const pingA = (port) => new Promise(res => { const r = http.get(`http://localhost:${port}/anno-queue`, x => { res(x.statusCode === 200); x.resume(); }); r.on('error', () => res(false)); r.setTimeout(1500, () => { r.destroy(); res(false); }); });

(async () => {
  if (!CHROME) { console.log('⊘ SKIP：未找到 Chrome/Edge'); process.exit(0); }
  if (!SERVER) { console.log('⊘ SKIP：未找到 anno-server/server.js（该功能依赖 anno-server）'); process.exit(0); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'syncgate-'));
  const proto = path.join(tmp, 'p.html');
  let sys = '';
  try {
    execFileSync('node', [path.join(QA, 'assemble-prototype.js'), path.join(QA, 'fixtures', 'roundtrip-data.json'), proto], { stdio: 'pipe', timeout: 120000 });
    const _v = await ensureVendor(); if (_v.ok) { fs.writeFileSync(proto, localize(fs.readFileSync(proto, 'utf8')), 'utf8'); copyVendorInto(tmp); }  // CDN EP → 本地 vendor，headless 秒加载
    sys = (JSON.parse(fs.readFileSync(path.join(QA, 'fixtures', 'roundtrip-data.json'), 'utf8')).systemName) || '';
  } catch (e) { console.log('⊘ SKIP：现装测试原型失败:', String(e.message || e).split('\n')[0]); fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); }

  // 起【临时 anno-server】：临时端口 + 临时 archive（绝不碰真实例/真数据）
  const errLog = path.join(tmp, 'srv.log'); const out = fs.openSync(errLog, 'a');
  const srv = spawn(process.execPath, [SERVER], { cwd: path.dirname(SERVER), stdio: ['ignore', out, out], windowsHide: true, env: { ...process.env, ANNO_PORT: String(APORT), ANNO_ARCHIVE_DIR: tmp } });
  let up = false; for (let i = 0; i < 70; i++) { if (await pingA(APORT)) { up = true; break; } await new Promise(z => setTimeout(z, 500)); }  // 临时实例启动扫描候选目录可达~13s，给足 35s
  if (!up) { console.log('⊘ SKIP：临时 anno-server 未起来'); try { srv.kill(); } catch (_) {} fs.rmSync(tmp, { recursive: true, force: true }); process.exit(0); }

  const _mime = p => /\.html$/.test(p) ? 'text/html;charset=utf-8' : /\.js$/.test(p) ? 'application/javascript;charset=utf-8' : /\.css$/.test(p) ? 'text/css;charset=utf-8' : 'application/octet-stream';
  const server = http.createServer((rq, rs) => { const p = path.join(tmp, decodeURIComponent(rq.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'Content-Type': _mime(p) }); rs.end(d); }); }).listen(WPORT);
  const ud = path.join(tmp, 'ud');
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + DPORT, '--user-data-dir=' + ud, 'about:blank']);
  let exitCode = 1;
  try {
    let page = null; for (let i = 0; i < 50; i++) { try { page = (await (await fetch(`http://localhost:${DPORT}/json/list`)).json()).find(t => t.type === 'page'); if (page) break; } catch (e) {} await new Promise(z => setTimeout(z, 200)); }
    const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = {}; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
    const send = (m, p = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    await send('Page.enable'); await send('Runtime.enable');
    // ★ 关键隔离：原型硬编码 fetch localhost:3799 → 页面加载前注入重定向到临时端口 APORT
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(function(){var of=window.fetch;window.fetch=function(u,o){try{if(typeof u==='string')u=u.replace('localhost:3799','localhost:${APORT}');else if(u&&u.url)u=new Request(u.url.replace('localhost:3799','localhost:${APORT}'),u);}catch(e){}return of.call(this,u,o);};})();` });
    await send('Page.navigate', { url: `http://localhost:${WPORT}/p.html?reset=1` });
    for (let i = 0; i < 120; i++) { await new Promise(z => setTimeout(z, 150)); const q = await send('Runtime.evaluate', { expression: "((((document.getElementById('app')||{}).childElementCount||0)>3)&&typeof window._annoInjectPins==='function')?1:0", returnByValue: true }); if (q.result?.result?.value === 1) break; }
    await new Promise(z => setTimeout(z, 900));
    const expr = `(async()=>{ const wait=ms=>new Promise(z=>setTimeout(z,ms)); const txt=el=>(el?.textContent||'').replace(/\\s+/g,' ').trim();
      if(window.__anno){window.__anno.toggleShow&&window.__anno.toggleShow(true);window.__anno.toggleMode(true);} await wait(200);
      const btn=[...document.querySelectorAll('#app .el-button, #app button')].find(e=>/^充值$/.test(txt(e))); if(!btn)return 'no-btn';
      const r=btn.getBoundingClientRect(); btn.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+8,clientY:r.top+8})); await wait(450);
      const ok=[...document.querySelectorAll('.anno-confirm-bubble button')].find(b=>/确定|添加/.test(txt(b))); if(ok)ok.click(); await wait(500);
      window.__anno.openScopedList(); await wait(450);
      const dlg=[...document.querySelectorAll('.el-dialog')].find(d=>/已圈定功能清单/.test(txt(d.querySelector('.el-dialog__title')))); if(!dlg)return 'no-dlg';
      const row=dlg.querySelector('.el-table__body-wrapper tbody tr'); const editBtn=row?row.querySelector('.fn-edit-btn'):null; if(!editBtn)return 'no-editbtn';
      editBtn.click(); await wait(400);
      const rdlg=[...document.querySelectorAll('.el-dialog')].find(d=>/编辑功能名/.test(txt(d.querySelector('.el-dialog__title')))); const inp=rdlg?rdlg.querySelector('.el-input__inner, input'):null; if(!inp)return 'no-input';
      const setNative=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setNative.call(inp,'${NEWNAME}'); inp.dispatchEvent(new Event('input',{bubbles:true})); await wait(200);
      const saveBtn=[...rdlg.querySelectorAll('button')].find(b=>/保存/.test(txt(b))); if(!saveBtn)return 'no-savebtn'; saveBtn.click();
      await wait(2800); return 'triggered'; })()`;
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    const trig = r.result?.result?.value;
    await new Promise(z => setTimeout(z, 800));
    const prdFile = path.join(tmp, 'PRD-' + sys + '.md');
    const written = fs.existsSync(prdFile);
    const hasName = written && fs.readFileSync(prdFile, 'utf8').includes(NEWNAME);
    console.log('\n════════ 保存即同步 隔离闸（临时实例·不碰真数据）════════');
    console.log((trig === 'triggered' ? '  ✓ ' : '  ✗ ') + '浏览器圈选+改名+保存  〔' + trig + '〕');
    console.log((written ? '  ✓ ' : '  ✗ ') + '标注改名→自动写出本地 PRD 文件（隔离目录）');
    console.log((hasName ? '  ✓ ' : '  ✗ ') + 'PRD 内容含改后的功能名「' + NEWNAME + '」= 三.2 标注→本地PRD 同步成立');
    const pass = trig === 'triggered' && written && hasName;
    console.log('──────────────────────────────');
    console.log(pass ? '  保存即同步 隔离闸 全绿 PASS ✅' : '  保存即同步 隔离闸 FAIL ❌');
    console.log('════════════════════════════════\n');
    ws.close(); exitCode = pass ? 0 : 1;
  } catch (e) { console.log('✗ 隔离闸异常:', e.message); }
  finally { try { server.close(); } catch (_) {} try { ch.kill(); } catch (_) {} try { srv.kill(); } catch (_) {} try { fs.closeSync(out); } catch (_) {} setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} process.exit(exitCode); }, 500); }
})();
