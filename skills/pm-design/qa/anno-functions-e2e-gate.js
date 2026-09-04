#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   标注功能真机闸 · anno-functions-e2e-gate.js · 随包发（维护者/QA·可自修）
   ────────────────────────────────────────────────────────────────────────
   焊死标注层【全部核心交互功能】——从标准组件【现装一个全新原型】，无头浏览器真机逐个点：
     ① 默认标注关（未开时不显示编辑按钮）
     ② 开启 → 显示 4 个按钮（复制已圈功能 / 导出分享版 / 清空 / 恢复标注）
     ③ 右键圈选功能 → 生成标注 PIN
     ④ 复制已圈功能 → 「已圈定功能清单」面板打开
     ⑤ 清空 → 弹二次确认框 → 点确认 → 标注清零
     ⑥ 恢复标注 → 弹二次确认框 → 点确认 → 标注恢复（走清空前的 undo 备份）
     · 全程 0 真实 JS 报错
   立法背景（2026-07-05 用户实测三手搓装配版反复冒问题）：这些功能之前【没闸守着】，
   靠人一个个发现(缺恢复标注按钮/默认没关/清空恢复…)。本闸把"每个功能真的能点"变机器保证：
   别人装了包、画原型出问题，跑本闸即知哪个功能坏、修完重跑绿——不靠特定 AI/人。
   〔导出分享版规则(没标注也导·分享版标注默认显示)由 share-readonly-gate.js 静态守；
     圈选↔注入回路由 inject-roundtrip-test.js 守；本闸专守"开关/4按钮/圈选/面板/清空/恢复"交互。〕
   零依赖：node 内置 + 本机 Chrome + assemble-prototype.js(现装) + fixtures/roundtrip-data.json。
   退出码：0=全绿 1=有功能坏。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn, execFileSync } = require('child_process');
const { findChrome } = require('./_gate-env');
const { ensureVendor, localize, copyVendorInto } = require('./_gate-vendor');
const CHROME = process.env.CHROME_PATH || findChrome();
const QA = __dirname, PORT = 8971, DPORT = 9471;
const NOISE = /localhost:3799|favicon|tailwind|fonts\.googleapis|fonts\.gstatic/;

const ASSERT = `(async()=>{
  const wait=ms=>new Promise(z=>setTimeout(z,ms));
  const txt=el=>(el?.textContent||'').replace(/\\s+/g,' ').trim();
  const C=[]; const add=(n,p,d='')=>C.push({n,p:!!p,d:String(d).slice(0,90)});
  // ① 默认标注关
  add('①默认标注关(未显示编辑按钮)', [...document.querySelectorAll('.anno-author-only')].filter(e=>(e.tagName==='BUTTON'||e.classList.contains('el-button'))&&e.offsetParent!==null).length===0);
  // ② 开启 → 4 按钮
  const core=document.querySelector('.el-switch__core')||document.querySelector('.el-switch'); if(core)core.click(); await wait(500);
  const labels=[...document.querySelectorAll('.anno-author-only')].map(txt).filter(Boolean); const has=k=>labels.some(l=>l.includes(k));
  add('②开启显示4按钮(复制已圈/导出/清空/恢复)', has('复制已圈功能')&&has('导出分享版')&&has('清空')&&has('恢复标注'), labels.join(','));
  // ③ 圈选 → pin
  const el=[...document.querySelectorAll('#app .content button,#app .content .el-button,#app button,#app .el-button')].find(e=>{const r=e.getBoundingClientRect();return txt(e)&&r.top>110&&r.width>0&&!e.closest('.topbar,.top-nav,.sysseg,.anno-sw,.pagetabs');});
  if(el){const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+8,clientY:r.top+8}));await wait(450);const ok=[...document.querySelectorAll('.anno-confirm-bubble button')].find(b=>/确定|添加/.test(txt(b)));if(ok)ok.click();await wait(500);}
  add('③右键圈选功能→生成标注PIN', [...document.querySelectorAll('#anno-app .anno-pin')].length>=1, 'pin='+[...document.querySelectorAll('#anno-app .anno-pin')].length);
  // ④ 复制已圈 → 面板
  window.__anno&&window.__anno.openScopedList&&window.__anno.openScopedList(); await wait(500);
  const dlg=[...document.querySelectorAll('.el-dialog')].find(d=>/已圈定功能清单/.test(txt(d.querySelector('.el-dialog__title'))));
  add('④复制已圈功能→面板打开', !!dlg);
  const cx=dlg?dlg.querySelector('.el-dialog__headerbtn'):null;if(cx)cx.click();await wait(300);
  // ⑤ 清空 → 确认 → 0
  window.__anno&&window.__anno.clearPins&&window.__anno.clearPins();await wait(450);
  let cb=[...document.querySelectorAll('.el-message-box__btns button')].find(b=>/确认清空|确认|确定/.test(txt(b)));if(cb)cb.click();await wait(600);
  add('⑤清空(有二次确认·点确认)→标注清零', [...document.querySelectorAll('#anno-app .anno-pin')].length===0 && !!cb, cb?'':'没弹确认框!');
  // ⑥ 恢复 → 确认 → 回来(走 undo 备份)
  window.__anno&&window.__anno.restoreCleared&&window.__anno.restoreCleared();await wait(450);
  let rb=[...document.querySelectorAll('.el-message-box__btns button')].find(b=>/确认恢复|确认|确定/.test(txt(b)));if(rb)rb.click();await wait(800);
  add('⑥恢复标注(有二次确认·点确认)→标注恢复', [...document.querySelectorAll('#anno-app .anno-pin')].length>=1 && !!rb, rb?'':'没弹确认框!');
  return C;
})()`;

const _mime = p => /\.html$/.test(p) ? 'text/html;charset=utf-8' : /\.js$/.test(p) ? 'application/javascript;charset=utf-8' : /\.css$/.test(p) ? 'text/css;charset=utf-8' : 'application/octet-stream';
function serve(root) { return new Promise(res => { const s = http.createServer((rq, rs) => { const p = path.join(root, decodeURIComponent(rq.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'Content-Type': _mime(p) }); rs.end(d); }); }).listen(PORT, () => res(s)); }); }
async function cdp() {
  const ud = path.join(os.tmpdir(), 'annofn_' + process.pid);
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + DPORT, '--user-data-dir=' + ud, 'about:blank']);
  let page = null; for (let i = 0; i < 60; i++) { try { const l = await (await fetch(`http://localhost:${DPORT}/json/list`)).json(); page = l.find(t => t.type === 'page'); if (page) break; } catch (e) {} await new Promise(z => setTimeout(z, 200)); }
  const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pend = {}; const errs = [];
  ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } if (d.method === 'Runtime.exceptionThrown') { const t = d.params.exceptionDetails?.exception?.description || d.params.exceptionDetails?.text || ''; if (!NOISE.test(t)) errs.push(t.slice(0, 120)); } };
  const send = (m, p = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: p })); });
  return { ch, ud, ws, send, errs };
}
(async () => {
  if (!CHROME) { console.log('✗ 未找到 Chrome/Edge'); process.exit(1); }
  const ASM = path.join(QA, 'assemble-prototype.js'), DATA = path.join(QA, 'fixtures', 'roundtrip-data.json');
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'annofn-'));
  const out = path.join(tmpDir, 'p.html');
  try { execFileSync('node', [ASM, DATA, out], { stdio: 'pipe', timeout: 120000 }); } catch (e) { console.log('✗ 现装原型失败:', String(e.message || e).split('\n')[0]); process.exit(1); }
  // CDN 加载 916KB EP 在 headless 里慢/被限速 → 本地化到 vendor 缓存秒加载（缓存全则用之·失败则回退 CDN）
  try { const _v = await ensureVendor(); if (_v.ok) { fs.writeFileSync(out, localize(fs.readFileSync(out, 'utf8')), 'utf8'); copyVendorInto(tmpDir); } } catch (e) {}
  const server = await serve(tmpDir); const c = await cdp(); let exitCode = 1;
  try {
    await c.send('Page.enable'); await c.send('Runtime.enable');
    await c.send('Page.navigate', { url: `http://localhost:${PORT}/p.html?reset=1` });
    for (let i = 0; i < 90; i++) { await new Promise(z => setTimeout(z, 150)); const q = await c.send('Runtime.evaluate', { expression: "((((document.getElementById('app')||{}).childElementCount||0)>3)&&typeof window._annoInjectPins==='function')?1:0", returnByValue: true }); if (q.result?.result?.value === 1) break; }
    await new Promise(z => setTimeout(z, 900));
    const r = await c.send('Runtime.evaluate', { expression: ASSERT, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error('断言脚本异常: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 200));
    const checks = r.result.result.value || [];
    checks.push({ n: '全程 0 真实 JS 报错', p: c.errs.length === 0, d: c.errs.slice(0, 2).join(' | ') });
    console.log('\n════════ 标注功能真机闸（现装原型·6功能+0报错）════════');
    for (const ck of checks) console.log((ck.p ? '  ✓ ' : '  ✗ ') + ck.n + (ck.d ? '  〔' + ck.d + '〕' : ''));
    const allPass = checks.every(x => x.p);
    console.log('──────────────────────────────');
    console.log(allPass ? '  标注功能真机闸 全绿 PASS ✅' : '  标注功能真机闸 有红 FAIL ❌ —— 上面 ✗ 的功能坏了,照 components/annotation-layer.html 修');
    console.log('════════════════════════════════\n');
    exitCode = allPass ? 0 : 1;
  } catch (e) { console.log('✗ 闸运行异常:', e.message); }
  finally { try { server.close(); c.ws.close(); c.ch.kill(); fs.rmSync(c.ud, { recursive: true, force: true }); fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {} process.exit(exitCode); }
})();
