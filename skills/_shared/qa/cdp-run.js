#!/usr/bin/env node
/* 共用快速浏览器检查器 · cdp-run.js（零依赖·原生 CDP·Node 22+ 内置 WebSocket）
   为什么有它：以前每个检查脚本各自起一个 Chrome、导航后死等 6 秒、每步再死等约 1 秒；
   实测原型约 1.3 秒就渲染完、切一个页面只要 15～273 毫秒——时间几乎全耗在“死等”上。
   本工具改成“等到就绪就走”：轮询页面条件（#app 已挂载 + 网络空闲 + Vue 没有待刷新的更新 + DOM 安静），
   一次运行只起一个 Chrome，所有步骤共用。

   命令行：node cdp-run.js <原型.html|URL> <脚本.js> [--width 1440] [--height 900] [--dpr 1] [--strict]
     脚本导出 async (api) => { ... }，返回值（可 JSON 化）会打印出来。
     --strict：页面有 JS 报错时退出码 2（默认只打印）。脚本抛错退出码 1。
   当库用：const { launch } = require('<本目录>/cdp-run.js'); const api = await launch({ width: 1440 });
          await api.open(html); ...; await api.close();

   api：
     open(file|url, {timeout})        导航并等就绪（ready）
     ready({timeout, quiet, idle})    等：#app 挂载有内容、document 完成、网络空闲 idle 毫秒（忽略 SSE/WebSocket/长连接）、
                                      Vue nextTick 落定、两帧绘制、DOM 连续 quiet 毫秒没变化、没有可见的加载遮罩。超时不抛错，返回 {ok:false}
     evaluate(fn|表达式, arg, {timeout})  页面里执行函数（可 async），按值取回结果；页面里出错会抛错
     S()                              取 Vue 根组件的 setupState 键名列表（调试用）
     go(page) / goPanel(name) / goTab(text|{key})  切页面 / 面板 / 页签后自动 ready；
                                      go 调 setupState.go（没有就设 currentPage）；goPanel 调 setupState 里 goPanel/setPanel/openPanel（没有就按文字点）；
                                      goTab('文字') 按文字点页签（.el-tabs__item/.stab/[role=tab] 等）；goTab({key}) 调 setupState.goTab(key)
     click(选择器|{text}) / tap(x,y)  DOM 点击 / 真实鼠标点击（CSS 像素），之后自动 ready
     shot(path, {height, width, selector, full})  截图（CSS 像素：clip.scale = 1/devicePixelRatio，防 DPR 坐标错位）
     errors / dialogs                 收集到的页面 JS 报错 / 被自动关掉的 alert·confirm 文本
     send(method, params)             直接发 CDP 命令
     close()                          关浏览器、删临时配置目录
   临时文件：接 _tmp-sandbox.js（本机临时根，退出自动删）；空闲端口由 Chrome 自己选（--remote-debugging-port=0 + DevToolsActivePort）。
   交互前一律 Page.bringToFront（后台标签页不跑 CSS 过渡，会造成“弹窗关不掉”的假象）。 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
try { require('./_tmp-sandbox'); } catch (_) {}

let findChrome;
for (const p of ['../../pm-design/qa/_gate-env', '../../rpa/_cdp']) {
  try { const m = require(p); if (typeof m.findChrome === 'function') { findChrome = m.findChrome; break; } } catch (_) {}
}
if (!findChrome) findChrome = () => {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const home = os.homedir();
  const c = process.platform === 'win32'
    ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', path.join(home, 'AppData/Local/Google/Chrome/Application/chrome.exe'), 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']
    : process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium']
    : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/microsoft-edge'];
  return c.find(x => fs.existsSync(x)) || null;
};

const sleep = t => new Promise(z => setTimeout(z, t));
const toUrl = t => /^(https?|file|about|data):/i.test(t) ? t : 'file:///' + path.resolve(t).replace(/\\/g, '/');

// 页面内：等 Vue 落定 + 两帧 + DOM 安静 + 无加载遮罩（一次调用，内部轮询，不靠固定等待）
const PAGE_SETTLE = async function (o) {
  const now = () => performance.now();
  const end = now() + o.timeout;
  if (!window.__cdpMut) {
    window.__cdpMut = { t: now() };
    try { new MutationObserver(() => { window.__cdpMut.t = performance.now(); }).observe(document, { subtree: true, childList: true, attributes: true, characterData: true }); } catch (e) {}
  }
  const frame = () => new Promise(z => { let d = 0; const f = () => { if (!d) { d = 1; z(); } }; try { requestAnimationFrame(f); } catch (e) {} setTimeout(f, 50); });
  const vis = el => { if (!el || !el.offsetParent) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const root = () => document.getElementById('app') || document.querySelector('[data-v-app]');
  let why = '';
  while (now() < end) {
    why = '';
    if (document.readyState !== 'complete') why = 'document 未完成';
    const A = root();
    if (!why && o.needApp) {
      if (!A) why = '没有 #app';
      else if (!(A.__vue_app__ || A._vnode) && !o.noVue) why = 'Vue 未挂载';
      else if (!A.innerText || !A.innerText.trim()) why = '#app 没内容';
    }
    if (!why) {
      const app = A && A.__vue_app__;
      const nt = (window.Vue && window.Vue.nextTick) || (app && app._instance && app._instance.proxy && app._instance.proxy.$nextTick);
      if (nt) { try { await nt(); } catch (e) {} }
      await frame(); await frame();
      let anim = false;   // 正在跑的有限 CSS 过渡/动画（弹窗淡出、页签滑块等）；无限循环的（加载转圈）不算
      try { anim = document.getAnimations().some(a => a.playState === 'running' && a.effect && isFinite(a.effect.getComputedTiming().endTime)); } catch (e) {}
      if ([...document.querySelectorAll('.el-loading-mask')].some(vis)) why = '加载遮罩';
      else if (anim) why = '动画进行中';
      else if (now() - window.__cdpMut.t < o.quiet) why = 'DOM 还在变';
      else return { ok: true };
    }
    await new Promise(z => setTimeout(z, 16));
  }
  return { ok: false, why };
};

async function launch(opt = {}) {
  const width = +opt.width || 1440, height = +opt.height || 900, dpr = +opt.dpr || 1;
  const chrome = opt.chrome || findChrome();
  if (!chrome) throw new Error('找不到 Chrome / Edge，可用环境变量 CHROME_PATH 指定');
  if (typeof WebSocket === 'undefined') throw new Error('需要 Node.js 22 及以上（内置 WebSocket）');
  const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'cdp-run-'));
  const args = ['--headless=new', '--remote-debugging-port=0', '--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows', '--disable-features=IntensiveWakeUpThrottling,CalculateNativeWinOcclusion',
    '--window-size=' + width + ',' + height, 'about:blank'];
  const ch = spawn(chrome, args, { stdio: 'ignore' });
  let dead = false; ch.on('exit', () => { dead = true; });
  // 端口：读 Chrome 写的 DevToolsActivePort（第一行 = 端口）
  let port = 0; const t0 = Date.now();
  while (!port && Date.now() - t0 < 30000 && !dead) {
    try { port = +fs.readFileSync(path.join(prof, 'DevToolsActivePort'), 'utf8').split(/\r?\n/)[0] || 0; } catch (_) {}
    if (!port) await sleep(50);
  }
  if (!port) { try { ch.kill(); } catch (_) {} throw new Error('浏览器没起来（30 秒内没写出 DevToolsActivePort）'); }
  let tab;
  for (let i = 0; i < 200 && !tab; i++) { try { tab = (await (await fetch('http://127.0.0.1:' + port + '/json/list')).json()).find(x => x.type === 'page'); } catch (_) {} if (!tab) await sleep(50); }
  if (!tab) { try { ch.kill(); } catch (_) {} throw new Error('拿不到页面标签'); }
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((z, f) => { ws.onopen = z; ws.onerror = f; });

  let id = 0; const pend = new Map(); const errors = []; const dialogs = []; const listeners = [];
  const net = new Map(); let netT = Date.now();   // requestId → 开始时间；最后一次网络活动时间
  const LONG = new Set(['EventSource', 'WebSocket']);
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); return; }
    const p = d.params || {};
    switch (d.method) {
      case 'Runtime.exceptionThrown': errors.push(String(p.exceptionDetails.exception ? p.exceptionDetails.exception.description : p.exceptionDetails.text).slice(0, 500)); break;
      case 'Runtime.consoleAPICalled': if (p.type === 'error') errors.push('console: ' + p.args.map(a => a.value !== undefined ? a.value : a.description).join(' ').slice(0, 500)); break;
      case 'Page.javascriptDialogOpening': dialogs.push(p.message); raw('Page.handleJavaScriptDialog', { accept: false }); break;   // alert/confirm 会卡死页面脚本：自动关
      case 'Network.requestWillBeSent': if (!LONG.has(p.type) && !/^data:/.test(p.request.url)) net.set(p.requestId, Date.now()); netT = Date.now(); break;
      case 'Network.loadingFinished': case 'Network.loadingFailed': net.delete(p.requestId); netT = Date.now(); break;
    }
    for (const l of listeners) try { l(d); } catch (_) {}
  };
  const raw = (method, params = {}) => { const i = ++id; try { ws.send(JSON.stringify({ id: i, method, params })); } catch (_) {} return i; };
  const send = (method, params = {}, timeout = 60000) => new Promise((z, f) => {
    if (dead) return f(new Error('浏览器已退出'));
    const i = ++id; const tm = setTimeout(() => { pend.delete(i); f(new Error(method + ' 超时 ' + timeout + 'ms')); }, timeout);
    pend.set(i, d => { clearTimeout(tm); d.error ? f(new Error(method + '：' + d.error.message)) : z(d.result); });
    try { ws.send(JSON.stringify({ id: i, method, params })); } catch (e) { clearTimeout(tm); pend.delete(i); f(e); }
  });

  await Promise.all([send('Runtime.enable'), send('Page.enable'), send('Network.enable')]);
  const metrics = (w, h) => send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: dpr, mobile: false });
  let curW = width, curH = height; await metrics(curW, curH);
  const front = () => send('Page.bringToFront').catch(() => {});
  await front();

  async function evaluate(fn, arg, o = {}) {
    const expression = typeof fn === 'function' ? '(' + fn + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')' : String(fn);
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, o.timeout || 60000);
    if (r.exceptionDetails) throw new Error('页面脚本出错：' + (r.exceptionDetails.exception && r.exceptionDetails.exception.description || r.exceptionDetails.text || '').slice(0, 500));
    return r.result.value;
  }
  // 网络空闲：在途请求为 0（超过 longMs 还没完的视为长连接，不计）且连续 idle 毫秒无活动
  async function netIdle(idle, until, longMs) {
    while (Date.now() < until) {
      const n = Date.now(); let busy = 0; for (const t of net.values()) if (n - t < longMs) busy++;
      if (!busy && n - netT >= idle) return true;
      await sleep(20);
    }
    return false;
  }
  async function ready(o = {}) {
    const timeout = o.timeout || 30000, until = Date.now() + timeout;
    const nOk = await netIdle(o.idle == null ? 100 : o.idle, until, o.longMs || 5000);
    let r;
    try { r = await evaluate(PAGE_SETTLE, { timeout: Math.max(500, until - Date.now()), quiet: o.quiet == null ? 60 : o.quiet, needApp: o.needApp !== false, noVue: !!o.noVue }, { timeout: timeout + 5000 }); }
    catch (e) { r = { ok: false, why: e.message }; }
    if (!nOk) r = { ok: false, why: '网络不空闲' + (r.why ? '；' + r.why : '') };
    if (!r.ok && !o.silent) process.stderr.write('[cdp-run] ready 超时：' + r.why + '\n');
    return r;
  }
  async function open(target, o = {}) {
    await front();
    if (o.width || o.height) { curW = o.width || curW; curH = o.height || curH; await metrics(curW, curH); }
    const loaded = new Promise(z => { const l = d => { if (d.method === 'Page.loadEventFired') { listeners.splice(listeners.indexOf(l), 1); z(); } }; listeners.push(l); });
    await send('Page.navigate', { url: toUrl(target) });
    await Promise.race([loaded, sleep(o.timeout || 60000)]);
    return ready(Object.assign({ timeout: o.timeout || 60000 }, o));
  }
  // 页面内取 Vue 根 setupState（通用：#app 或 [data-v-app]）
  const ROOT_S = "(()=>{const A=document.getElementById('app')||document.querySelector('[data-v-app]');if(!A)return null;return (A._vnode&&A._vnode.component&&A._vnode.component.setupState)||(A.__vue_app__&&A.__vue_app__._instance&&A.__vue_app__._instance.setupState)||null;})()";
  const S = () => evaluate('Object.keys(' + ROOT_S + '||{})');
  const clickText = async (sel, text) => evaluate(new Function('a', `const N=s=>String(s||'').replace(/\\s+/g,'').trim();
    const el=[...document.querySelectorAll(a.sel)].find(e=>e.offsetParent&&!e.closest('#anno-app')&&N(e.innerText)===N(a.text));
    if(!el)return false; el.scrollIntoView({block:'center'}); el.click(); return true;`), { sel, text });
  async function go(page, o = {}) {
    await front();
    const r = await evaluate(new Function('p', `const S=${ROOT_S}; if(!S) return 'no-vue';
      if(typeof S.go==='function'){ S.go(p); return 'go'; } if('currentPage' in S){ S.currentPage=p; return 'currentPage'; } return 'no-go';`), page);
    if (r !== 'go' && r !== 'currentPage') throw new Error('go(' + page + ')：' + r);
    return ready(o);
  }
  async function goPanel(name, o = {}) {
    await front();
    const r = await evaluate(new Function('p', `const S=${ROOT_S}; if(!S) return false;
      for(const k of ['goPanel','setPanel','openPanel','switchPanel']) if(typeof S[k]==='function'){ S[k](p); return true; } return false;`), name);
    if (!r && !(await clickText('a,button,.el-button,.el-menu-item,.el-sub-menu__title,span,div', name))) throw new Error('goPanel 找不到：' + name);
    return ready(o);
  }
  async function goTab(text, o = {}) {
    await front();
    if (text && typeof text === 'object' && text.key != null) {
      const r = await evaluate(new Function('k', `const S=${ROOT_S}; if(!S||typeof S.goTab!=='function') return false; S.goTab(k); return true;`), text.key);
      if (!r) throw new Error('goTab：setupState 里没有 goTab');
      return ready(o);
    }
    if (!(await clickText('.el-tabs__item,.stab,.sp-item,.el-radio-button__inner,[role=tab],.el-segmented__item,.qf-item,.el-check-tag', text))) throw new Error('goTab 找不到页签：' + text);
    return ready(o);
  }
  async function click(target, o = {}) {
    await front();
    let ok;
    if (target && typeof target === 'object' && target.text) ok = await clickText(target.sel || 'a,button,.el-button,.el-link,span,div,td,li', target.text);
    else ok = await evaluate(new Function('s', "const el=document.querySelector(s); if(!el) return false; el.scrollIntoView({block:'center'}); el.click(); return true;"), target);
    if (!ok) throw new Error('click 找不到：' + JSON.stringify(target));
    return ready(o);
  }
  async function tap(x, y, o = {}) {   // CSS 像素坐标
    await front();
    for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased']) await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
    return ready(o);
  }
  async function shot(file, o = {}) {
    await front();
    if (o.width || o.height) { curW = o.width || curW; curH = o.height || curH; await metrics(curW, curH); }
    await ready(Object.assign({ silent: true, timeout: 10000 }, o));
    const m = await evaluate(new Function('a', `let r={x:0,y:0,width:innerWidth,height:innerHeight};
      if(a.sel){const e=document.querySelector(a.sel); if(!e) return null; e.scrollIntoView({block:'start'}); const b=e.getBoundingClientRect(); r={x:b.left+scrollX,y:b.top+scrollY,width:b.width,height:b.height};}
      else if(a.full){r.height=Math.max(document.documentElement.scrollHeight,document.body.scrollHeight); r.y=0;}
      else {r.x=scrollX; r.y=scrollY;}
      return {r, dpr: devicePixelRatio||1};`), { sel: o.selector || null, full: !!o.full });
    if (!m) throw new Error('shot 找不到元素：' + o.selector);
    const clip = Object.assign({}, m.r, { scale: 1 / m.dpr });   // 出图 = CSS 像素（DPR 坐标错位铁律）
    const r = await send('Page.captureScreenshot', { format: 'png', clip, captureBeyondViewport: !!(o.full || o.selector) });
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
    fs.writeFileSync(file, Buffer.from(r.data, 'base64'));
    return file;
  }
  let closed = false;
  async function close() {
    if (closed) return; closed = true;
    try { await send('Browser.close', {}, 3000); } catch (_) {}
    try { ws.close(); } catch (_) {}
    for (let i = 0; i < 40 && !dead; i++) await sleep(50);
    try { if (!dead) ch.kill(); } catch (_) {}
    try { fs.rmSync(prof, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch (_) {}
  }
  process.on('exit', () => { try { if (!dead) ch.kill(); } catch (_) {} });
  return { open, ready, evaluate, ev: evaluate, S, go, goPanel, goTab, click, tap, shot, send, close, errors, dialogs, width, height, on: l => listeners.push(l) };
}

module.exports = { launch, findChrome, PAGE_SETTLE };

if (require.main === module) {
  (async () => {
    const argv = process.argv.slice(2); const pos = []; const o = {};
    for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a === '--strict') o.strict = true; else if (a.startsWith('--')) o[a.slice(2)] = argv[++i]; else pos.push(a); }
    const [target, script] = pos;
    if (!target || !script) { console.error('用法：node cdp-run.js <原型.html|URL> <脚本.js> [--width 1440] [--height 900] [--dpr 1] [--strict]\n  脚本导出 async (api) => {}'); process.exit(1); }
    const t0 = Date.now(); let code = 0;
    const api = await launch({ width: o.width, height: o.height, dpr: o.dpr });
    try {
      const r0 = await api.open(target);
      console.log(`[cdp-run] 打开就绪 ${Date.now() - t0}ms${r0.ok ? '' : '（未完全就绪：' + r0.why + '）'}`);
      const out = await require(path.resolve(script))(api);
      if (out !== undefined) console.log(typeof out === 'string' ? out : JSON.stringify(out, null, 2));
    } catch (e) { console.error('[cdp-run] 脚本出错：', e && e.stack || e); code = 1; }
    console.log(`[cdp-run] JS 报错 ${api.errors.length} 条${api.errors.length ? '：\n  ' + api.errors.slice(0, 10).join('\n  ') : ''}${api.dialogs.length ? `；自动关掉弹框 ${api.dialogs.length} 个` : ''}；总用时 ${Date.now() - t0}ms`);
    if (!code && o.strict && api.errors.length) code = 2;
    await api.close();
    process.exit(code);
  })().catch(e => { console.error('[cdp-run] 出错：', e && e.stack || e); process.exit(1); });
}
