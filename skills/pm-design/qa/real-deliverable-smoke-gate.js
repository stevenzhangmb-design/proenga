#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   真实交付物·冒烟闸 · real-deliverable-smoke-gate.js · 随包·不碰真数据
   ────────────────────────────────────────────────────────────────────────
   其它闸验的都是【标准组件】(fixture 现装)；本闸验【你实际要交付的那几个装配版 offline 文件本身】
   真的能跑——落实"我画的原型达到本地效果 / 打包后别人达到一样效果"。
   逐个真实交付原型（archive/*装配版*offline.html）headless 真机验：
     ① 离线挂载：内嵌 Vue/ElementPlus 成功挂载(#app)、标注层 window.__anno 存在、0 真实 JS 报错。
     ② 默认标注关：window.__anno.showPins === false。
     ③ 开启后 4 按钮：点顶栏「标注」开关 → 复制已圈功能 / 导出分享版 / 清空 / 恢复标注 出现。
     ④ 圈选：右键一个真实元素(查询)+确定 → 出现标注 PIN。
   —— 不碰真数据：把真文件【拷到临时目录】再开 + 【屏蔽对 3799 的 fetch】(重定向到死端口)，
      避免圈选触发 /anno-persist 让真 anno-server 把 pin 烤回真交付文件。localStorage 用临时 Chrome profile 隔离。
   零依赖：node + 本机 Chrome（交付文件是离线版·不需网络/vendor/anno-server）。退出码 0=通过/跳过 1=失败。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const { findChrome } = require('./_gate-env');
const CHROME = process.env.CHROME_PATH || findChrome();
const sleep = ms => new Promise(z => setTimeout(z, ms));

// 真实交付原型：archive 里 *装配版*offline.html（排除分享版/备份）
function findDeliverables() {
  const dirs = require('./_archive-dir').archiveDirs();
  const isDeliv = f => /装配版/.test(f) && /offline/i.test(f) && f.endsWith('.html') && !/分享版|备份|\.bak/i.test(f);
  for (const d of dirs) {
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { continue; }
    const out = [];
    for (const e of ents) {
      if (e.isFile() && isDeliv(e.name)) out.push(path.join(d, e.name));
      // 扫一层子目录（如 竞品分析报告 里的发票装配版）；排除草稿/依赖/资源目录
      else if (e.isDirectory() && !/^_|^\.|node_modules|screenshots|images/i.test(e.name)) {
        try { for (const f of fs.readdirSync(path.join(d, e.name))) if (isDeliv(f)) out.push(path.join(d, e.name, f)); } catch (_) {}
      }
    }
    if (out.length) return out;
  }
  return [];
}

async function smoke(file, base) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'realsmoke-'));
  fs.copyFileSync(file, path.join(tmp, 'p.html'));           // 隔离副本：绝不在真文件上操作
  const WPORT = base, DPORT = base + 1000;
  const server = http.createServer((rq, rs) => { const p = path.join(tmp, decodeURIComponent(rq.url.split('?')[0])); fs.readFile(p, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'Content-Type': /\.html$/.test(p) ? 'text/html;charset=utf-8' : 'application/octet-stream' }); rs.end(d); }); }).listen(WPORT);
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--remote-debugging-port=' + DPORT, '--user-data-dir=' + path.join(tmp, 'ud'), 'about:blank']);
  const R = { name: path.basename(file), mounted: false, anno: false, defOff: false, buttons: false, circled: false, noerr: false };
  try {
    let page = null; for (let i = 0; i < 50; i++) { try { page = (await (await fetch(`http://localhost:${DPORT}/json/list`)).json()).find(t => t.type === 'page'); if (page) break; } catch (e) {} await sleep(200); }
    const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = {}; const errs = [];
    const NOISE = /localhost:3799|favicon|tailwind|fonts\.googleapis|fonts\.gstatic|net::ERR|Failed to fetch|AbortError/;
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } if (d.method === 'Runtime.exceptionThrown') { const t = d.params.exceptionDetails?.exception?.description || d.params.exceptionDetails?.text || ''; if (!NOISE.test(t)) errs.push(t.slice(0, 140)); } };
    const send = (m, p = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    const evalv = async (e, aw = false) => (await send('Runtime.evaluate', { expression: e, awaitPromise: aw, returnByValue: true })).result?.result?.value;
    await send('Page.enable'); await send('Runtime.enable');
    // 屏蔽对 3799 的 fetch（重定向到死端口）——圈选触发的 /anno-persist 打不到真 anno-server → 真交付文件绝不被回写
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(function(){var of=window.fetch;window.fetch=function(u,o){try{var s=typeof u==='string'?u:(u&&u.url)||'';if(s.indexOf('localhost:3799')>=0)return Promise.reject(new Error('blocked-in-smoke'));}catch(e){}return of.call(this,u,o);};})();` });
    await send('Page.navigate', { url: `http://localhost:${WPORT}/p.html?reset=1` });
    // 挂载判据【结构无关·通用】：EP 真渲染了顶栏「标注」开关内部结构(.el-switch__core·只有 Vue+EP 挂载成功才有)
    // + #app 内容够长(业务真渲染)。兼容装配器(el-menu/el-table·内容富)与手搓外壳(nav+wrap 或稀疏仪表盘)。
    // 旧判据踩过两个坑：①#app childCount>3 对 nav+wrap(顶层2子元素但深层全渲染)误判发票；②交互元素≥6 对充值稀疏仪表盘(只1个业务按钮)误判。
    const MOUNTED = `(()=>{ const a=document.getElementById('app'); if(!a)return false; return document.querySelectorAll('#app .el-switch__core').length>=1 && (a.innerHTML||'').length>3000; })()`;
    for (let i = 0; i < 130; i++) { await sleep(150); if (await evalv(`(${MOUNTED} && typeof window.__anno!=='undefined')?1:0`) === 1) break; }
    await sleep(800);
    R.mounted = (await evalv(MOUNTED)) === true;
    R.anno = (await evalv("typeof window.__anno!=='undefined'")) === true;
    R.defOff = (await evalv("(window.__anno&&window.__anno.showPins)===false")) === true;
    // 点顶栏「标注」开关 → 4 按钮出现
    const btnRes = await evalv(`(async()=>{ const wait=ms=>new Promise(z=>setTimeout(z,ms)); const txt=el=>(el?.textContent||'');
      const sw=document.querySelector('.el-switch'); if(sw){ sw.click(); } else if(window.__anno){ window.__anno.toggleShow(true); window.__anno.toggleMode(true); } await wait(500);
      const all=[...document.querySelectorAll('button, .el-button')].map(txt).join('|');
      const has=k=>all.indexOf(k)>=0;
      return JSON.stringify({ copy:has('复制已圈功能'), share:has('导出分享版'), clear:has('清空'), restore:has('恢复标注') }); })()`, true);
    try { const b = JSON.parse(btnRes); R.buttons = b.copy && b.share && b.clear && b.restore; R._btn = b; } catch (_) {}
    // 圈选一个真实【业务】元素 → PIN（右键业务按钮/菜单项/页签·排除标注层自身元素和 × 关闭元素·兼容手搓版/装配器不同结构）
    const circled = await evalv(`(async()=>{ const wait=ms=>new Promise(z=>setTimeout(z,ms)); const txt=el=>(el?.textContent||'').replace(/\\s+/g,' ').trim();
      const vis=e=>{ if(!e||!e.offsetParent)return false; const r=e.getBoundingClientRect(); return r.width>10&&r.height>6; };
      const biz=e=>vis(e)&&!/anno/.test(e.className||'')&&!/复制已圈|导出分享|清空|恢复标注|×/.test(txt(e));
      if(window.__anno){window.__anno.toggleShow&&window.__anno.toggleShow(true);window.__anno.toggleMode(true);} document.body.classList.remove('annotations-hidden'); await wait(300);
      let btn=[...document.querySelectorAll('#app .el-button, #app button')].find(biz)
           || [...document.querySelectorAll('#app .el-menu-item, #app .stab, #app .el-tabs__item')].find(biz); if(!btn)return -1;
      const r=btn.getBoundingClientRect(); btn.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+Math.min(8,r.width/2),clientY:r.top+Math.min(6,r.height/2)})); await wait(600);
      const ok=[...document.querySelectorAll('.anno-confirm-bubble button')].find(b=>/确定|添加/.test(txt(b))); if(ok)ok.click(); await wait(700);
      const sysN=(window.__PRD_DATA__&&window.__PRD_DATA__.system_name)||'default';
      return (JSON.parse(localStorage.getItem('anno-pins-v2::'+sysN)||'[]')).length; })()`, true);
    R.circled = circled >= 1; R._circled = circled;
    R.noerr = errs.length === 0; R._errs = errs.slice(0, 2);
    ws.close();
  } catch (e) { R._ex = e.message; }
  finally { try { server.close(); } catch (_) {} try { ch.kill(); } catch (_) {} setTimeout(() => { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }, 400); }
  return R;
}

(async () => {
  if (!CHROME) { console.log('⊘ SKIP：未找到 Chrome/Edge'); process.exit(0); }
  const files = findDeliverables();
  if (!files.length) { console.log('⊘ SKIP：archive 未找到 *装配版*offline.html 交付原型'); process.exit(0); }
  console.log('\n════════ 真实交付物 冒烟闸（真文件·隔离副本·屏蔽写真数据）════════');
  let allPass = true;
  for (let i = 0; i < files.length; i++) {
    const R = await smoke(files[i], 8990 + i * 3);
    const ok = R.mounted && R.anno && R.defOff && R.buttons && R.circled && R.noerr;
    allPass = allPass && ok;
    console.log('\n  ▸ ' + R.name);
    console.log((R.mounted ? '    ✓ ' : '    ✗ ') + '离线挂载(#app 内嵌Vue/EP)');
    console.log((R.anno ? '    ✓ ' : '    ✗ ') + '标注层 window.__anno 存在');
    console.log((R.defOff ? '    ✓ ' : '    ✗ ') + '默认标注关(showPins=false)');
    console.log((R.buttons ? '    ✓ ' : '    ✗ ') + '开启后 4 按钮(复制已圈/导出分享/清空/恢复)' + (R._btn ? '  〔' + JSON.stringify(R._btn) + '〕' : ''));
    console.log((R.circled ? '    ✓ ' : '    ✗ ') + '圈选查询 → 出现标注 PIN');
    console.log((R.noerr ? '    ✓ ' : '    ✗ ') + '0 真实 JS 报错' + (R._errs && R._errs.length ? '  〔' + R._errs.join(' | ') + '〕' : ''));
    if (R._ex) console.log('    ✗ 异常: ' + R._ex);
  }
  console.log('\n──────────────────────────────');
  console.log(allPass ? '  真实交付物 冒烟闸 全绿 PASS ✅' : '  真实交付物 冒烟闸 FAIL ❌ —— 上面 ✗ 的交付文件坏了');
  console.log('════════════════════════════════\n');
  process.exit(allPass ? 0 : 1);
})();
