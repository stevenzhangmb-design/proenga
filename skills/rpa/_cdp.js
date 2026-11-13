/* RPA·_cdp.js —— 连到 launch.js 起的调试 Chrome，用原生 CDP 驱动（零依赖·Node18+ 全局 fetch/WebSocket）。
   不关 Chrome（只断开 WebSocket），保会话持久，供多步复刻脚本接力。 */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

/* §2026-10-13 根治「连不上调试 Chrome」——今天为此折返 8 次，前后台都试过。
   真因不是 launch.js 判断错，而是：**launch.js 这个 node 进程一退出，它启的 Chrome 就被回收了**
   （AI 工具跑命令的进程树会被整体收掉；`detached+unref` 在 Windows 作业对象下不管用）。
   所以「先跑 launch.js，再跑 act.js / extract.js」这种跨命令共用，在这种环境里必然失败；
   而 p.js 一直好用，正是因为它在**同一个进程里自己拉浏览器**。
   现在把这个能力下沉到连接层：**连不上就自己拉一个**，整条 RPA 链都不用再依赖外部先启动。
   Chrome 随本进程存活——这正是我们要的（一条命令内跑完，结束自动收干净，不留僵尸）。 */
let _child = null;   // 持有引用，防止被回收
/* 浏览器档案（含登录态）要长期保留，不进用完即删的沙盒，只放到配置的临时根（本机 = D 盘）；单拷 rpa 时退回系统临时目录 */
function tmpBase() { try { return require('../_shared/qa/_tmp-root').tmpRoot(); } catch (_) { return os.tmpdir(); } }
/* §2026-10-28 登录档案【不能放临时沙盒】—— 2026-10-28 抓 WMS 时逮到的自相残杀：
   档案原来放在临时根（路径含 temp）下，而 deliver-gate 清理僵尸浏览器时按
   `--user-data-dir=*(Temp|tmp)*` 匹配（不区分大小写）→ **把我刚登录好的真系统浏览器当僵尸杀了**。
   表现：每条 RPA 命令都打印「调试 Chrome 没开，自动拉起中」，登录态永远保不住，抓取根本做不下去。
   而且道理上也不该放那儿：登录档案是要【持久】的资产，临时沙盒是「用完就删」的。
   现在放到临时根的【同级目录】rpa-profiles：跟着用户配置的盘走（不写死盘符）、路径不含 temp。 */
function profileBase() {
  try { return path.join(path.dirname(require('../_shared/qa/_tmp-root').tmpRoot()), 'rpa-profiles'); }
  catch (_) { return path.join(os.homedir(), '.proenga-rpa-profiles'); }
}
function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const c = process.platform === 'win32'
    ? [process.env['ProgramFiles'] + '\\Google\\Chrome\\Application\\chrome.exe',
       process.env['ProgramFiles(x86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
       process.env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe',
       process.env['ProgramFiles(x86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe']
    : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  return c.find(x => x && fs.existsSync(x)) || null;
}
async function findTab(port, tries) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${port}/json/list`);   // 用 127.0.0.1：localhost 可能解析到 IPv6 而 Chrome 只听 IPv4
      if (r.ok) { const t = (await r.json()).find(x => x.type === 'page'); if (t) return t; }
    } catch (_) {}
    await new Promise(z => setTimeout(z, 200));
  }
  return null;
}

async function connect(port = 9222) {
  let tab = await findTab(port, 10);                 // 先看现成的（2 秒）
  if (!tab && !_child) {                             // 没有就自己拉一个
    const chrome = findChrome();
    if (!chrome) throw new Error('找不到 Chrome/Edge，请设 CHROME_PATH 环境变量');
    const profile = path.join(profileBase(), 'rpa-chrome-' + port);
    console.log('  调试 Chrome 没开，自动拉起中…');
    _child = spawn(chrome, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile,
      '--no-first-run', '--no-default-browser-check', 'about:blank'], { stdio: 'ignore' });
    _child.on('error', () => {});
    tab = await findTab(port, 150);                  // 冷启动 + 全新 profile 实测可超过 6 秒，给到 30 秒
  }
  if (!tab) throw new Error('连不上调试 Chrome（端口 ' + port + ' 没有页面目标；自动拉起也失败，检查 CHROME_PATH）');
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  /* §2026-10-28 根治「静默失败」（抓 WMS 出库订单列表时逮到）：
     旧的 send 只有 resolve、没有超时、也没有断线处理 —— Chrome 对某些页面的
     Page.captureSnapshot 迟迟不回应时，Promise 永远挂起，WebSocket 一断事件循环就空，
     **进程以 exit=0 正常退出，但一个文件都没写**。freeze.js 连跑两次都"成功"却没产物，
     根因就在这里。这类假成功比报错危险得多：上次抓 OMS 19 页若也遇到，我会以为全抓到了。
     现在：每个请求带超时并 reject，断线时把所有未完成请求一起 reject，让调用方真的报错。 */
  let id = 0; const pend = {};
  /* §2026-10-29 事件订阅。用途：取样式表清单（CSS.styleSheetAdded 在 CSS.enable 时
     会把已有的全部重放），进而用 CSS.getStyleSheetText 拿每份样式表的文本 ——
     它能读到【跨域样式表】，而页面里 `document.styleSheets[i].cssRules` 对跨域表
     抛 SecurityError。

     ⚠️ 更正（同日）：我一度把这当成"冻结件失真的根因"，**那是误判**。
     实测 某 WMS 真系统：跨域读不到的样式表 = 0，CSS 规则 38352 条、冻结件里 38980 条，
     `--el-border`/`--el-border-width` 等变量在冻结件里全部正常解析，
     `.el-button` 的 EP 基础规则（1459 字符那条）也在。**冻结件的 CSS 并没有丢。**
     按钮 border 在冻结件里渲染成 UA 默认 `2px outset` 的真因**尚未查清**，不是跨域。
     这段代码保留，因为走 CDP 取样式表本身更健壮（真遇到跨域 CDN 时不会静默丢），
     但**别再拿"跨域"去解释冻结件失真**。 */
  const _subs = {};
  const on = (method, fn) => { (_subs[method] = _subs[method] || []).push(fn); };
  /* §2026-10-10 收集页面的 console 与未捕获异常。为什么要有：页面白屏时只知道"没渲染出来"，
     不知道为什么；以前只能靠肉眼猜或一行行注释代码试。连上就开始收，navigate 之后读 logs()。 */
  const _logs = [];
  ws.onmessage = m => {
    const d = JSON.parse(m.data);
    if (d.id && pend[d.id]) { const p = pend[d.id]; delete pend[d.id]; p.res(d); return; }
    if (d.method && _subs[d.method]) _subs[d.method].forEach(f => { try { f(d.params); } catch (_) {} });
    if (d.method === 'Runtime.exceptionThrown') {
      const e = d.params && d.params.exceptionDetails || {};
      _logs.push('❌ ' + (e.text || '') + ' ' + ((e.exception && e.exception.description) || '') +
                 (e.url ? ' @' + e.url + ':' + (e.lineNumber + 1) : ''));
    } else if (d.method === 'Runtime.consoleAPICalled' && /error|warning/.test(d.params.type)) {
      _logs.push((d.params.type === 'error' ? '❌ ' : '⚠ ') +
        (d.params.args || []).map(a => a.value != null ? a.value : (a.description || a.type)).join(' '));
    }
  };
  /* 断线 = 把所有还在等的请求一起 reject，绝不让它们永远挂着（那会变成 exit=0 的假成功） */
  ws.onclose = () => {
    Object.keys(pend).forEach(k => {
      const p = pend[k]; delete pend[k];
      try { p.rej(new Error('CDP 连接已断开，' + p.method + ' 未完成')); } catch (_) {}
    });
  };
  const send = (method, params = {}, timeoutMs = 120000) => new Promise((res, rej) => {
    const i = ++id;
    const timer = setTimeout(() => {
      delete pend[i];
      rej(new Error('CDP 超时：' + method + ' 在 ' + timeoutMs + 'ms 内没有回应'));
    }, timeoutMs);
    pend[i] = { method, res: d => { clearTimeout(timer); res(d); }, rej: e => { clearTimeout(timer); rej(e); } };
    try { ws.send(JSON.stringify({ id: i, method, params })); }
    catch (e) { clearTimeout(timer); delete pend[i]; rej(e); }
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('DOM.enable');
  /* ════ §2026-10-30 根治「点了没反应」的一大类：视口太窄，控件在屏幕外 ════
     事故：OMS 商品管理的行操作图标（查看/编辑/打印标签）坐标 x=1210~1266，
     而 Chrome 实际视口 innerWidth 只有 **1037** —— 整个操作列在屏幕右侧之外。
     表现极具迷惑性：`getBoundingClientRect()` 照样给出坐标（它不管可见性），
     于是抓取器以为点得到，CDP 把点击打在视口外，结果全是「点了没反应」，
     而且 `elementFromPoint` 返回 null 也只在专门去查时才会发现。
     真系统本身的布局 min-width 就是 1350（见 system-design-spec §2026-07-09），
     用 1037 的视口抓它，**连布局类的真值都是被挤压的**。
     所以：连上就把视口锁成 1600×900、dpr=1。
       · 1600 > 1350，横向不再有内容被挤到屏幕外；
       · dpr=1 让「截图上量到的坐标 == 点击坐标」（dpr=2 时截图是设备像素，踩过）。
     需要别的尺寸时设环境变量 RPA_VIEWPORT=宽x高，设 RPA_VIEWPORT=0 则完全不干预。 */
  try {
    const vp = process.env.RPA_VIEWPORT;
    if (vp !== '0') {
      const m = /^(\d+)x(\d+)$/.exec(vp || '');
      const W = m ? +m[1] : 1600, H = m ? +m[2] : 900;
      await send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
    }
  } catch (_) { /* 老版本 Chrome 没有这个域就算了，不该因此中断抓取 */ }
  /* 注：send 的第三个参数是超时毫秒（默认 120 秒）。整页快照这类重活要显式放宽，
     见 freeze.js —— 真系统列表页快照体积大，默认超时不够。 */
  const evalv = async (expr, awaitPromise = false) => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise, returnByValue: true });
    if (r.result && r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.text || 'eval error');
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  const url = async () => await evalv('location.href');
  /* §2026-10-10 截图一律输出 **CSS 像素**，不是设备像素。
     为什么：Page.captureScreenshot 默认按 devicePixelRatio 出图。某零售系统 这台机器 dpr=2，
     截图 2074px 宽而 CSS 视口只有 1037px；我照着截图量坐标喂给 Input.dispatchMouseEvent
     （它收的是 CSS 像素），每次都点在 2 倍远的地方 —— "POS 数字键盘/模块抽屉点不开"的真因，
     白白卡掉一整轮（原型改动清单 #343）。用 clip.scale=1/dpr 把图缩回 CSS 像素后，
     **截图上量到的坐标可以直接当 tap 坐标用**，这个坑从工具层消失。 */
  const screenshot = async (out) => {
    await new Promise(z => setTimeout(z, 400));
    let params = { format: 'png' };
    try {
      const m = await evalv('JSON.stringify({w:innerWidth,h:innerHeight,d:devicePixelRatio||1})');
      const v = JSON.parse(m);
      // clip.scale 会再乘上 deviceScaleFactor，所以要传 1/dpr 才得到 CSS 像素尺寸的图
      if (v.d && v.d !== 1) params = { format: 'png', clip: { x: 0, y: 0, width: v.w, height: v.h, scale: 1 / v.d } };
    } catch (_) {}
    const { result } = await send('Page.captureScreenshot', params);
    fs.writeFileSync(out, Buffer.from(result.data, 'base64')); return out;
  };
  const navigate = async (u) => { await send('Page.navigate', { url: u }); await new Promise(z => setTimeout(z, 1500)); };
  const close = () => { try { ws.close(); } catch (_) {} };
  const logs = () => _logs.slice();
  /* 取【所有】样式表的文本，含跨域的 —— 页面里的 cssRules 读不到跨域表，CDP 读得到。
     冻结真系统页面必须用这个，否则 CDN 上的框架基础样式会整个丢掉。 */
  const allCss = async () => {
    const heads = [];
    on("CSS.styleSheetAdded", p => { if (p && p.header) heads.push(p.header); });
    try { await send("CSS.enable"); } catch (_) { return null; }
    await new Promise(z => setTimeout(z, 800));          // 等它把已有样式表重放完
    /* ⚠️ 必须【并发 + 短超时】。串行 + 单表 30 秒超时的写法在真系统上会卡死：
       一个页面可能有几十份样式表，其中若干取不到（动态插入后又被移除的、
       已失效的 styleSheetId），每个都等满 30 秒 → 几十分钟（2026-10-29 实测卡超 280 秒）。
       样式表之间互不依赖，没有任何理由串行。 */
    let got = 0, failed = 0;
    const texts = await Promise.all(heads.map(async h => {
      try {
        /* 真系统的框架样式表能到 19MB，8 秒取不回来 —— 超时必须给够 */
        const r = await send("CSS.getStyleSheetText", { styleSheetId: h.styleSheetId }, 90000);
        const t = r && r.result && r.result.text;
        if (!t) { failed++; return ""; }
        got++;
        return "\n/* " + (h.sourceURL || "inline") + " */\n" + t;
      } catch (_) { failed++; return ""; }
    }));
    /* ⚠️ 少一份都不算成功。2026-10-29 实测：3 份样式表只取到 1 份（那 2 份是 19MB 的
       框架大表，8 秒超时没取回来），而旧代码把这当成功返回 —— 冻结件就少了一大半样式，
       外表看着正常（有 CSS、能渲染），值却是错的。**部分成功当成功，比彻底失败更危险**：
       失败会报错让人去查，部分成功会一路静默到"提炼出来的设计规范是错的"。
       宁可返回 null 让调用方退回页面内 cssRules（那条路虽然读不到跨域表，但至少不会半截）。 */
    if (failed) return { css: "", sheets: heads.length, got, failed, incomplete: true };
    return { css: texts.join(""), sheets: heads.length, got, failed };
  };
  return { send, evalv, url, screenshot, navigate, close, logs, on, allCss };
}
module.exports = { connect };
