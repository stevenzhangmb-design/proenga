// 标注工具共用的无头浏览器小助手（零依赖·原生 CDP）。auto-anno-map.js / verify-anno-anchors.js 共用。
// 等待方式：切页面 / 点页签后不再死等，改用页面内就绪等待 __settle（来自 skills/_shared/qa/cdp-run.js 的 PAGE_SETTLE）。
// 用法：const { openPage } = require('./_anno-browser'); const b = await openPage(htmlPath, { width: 1600 });
//       await b.ev(fn, arg) 在页面里执行函数并取回结果；await b.close() 关浏览器并删临时目录。
// 临时文件：接 skills/_shared/qa/_tmp-sandbox.js（本机临时根，退出自动删）；单拷本 skill 时退回系统临时目录。
const fs = require('fs'), path = require('path'), os = require('os'), net = require('net');
const { spawn } = require('child_process');
try { require('../_shared/qa/_tmp-sandbox'); } catch (_) {}
let findChrome;
try { ({ findChrome } = require('../pm-design/qa/_gate-env')); } catch (_) {
  findChrome = () => {
    if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
    const home = os.homedir();
    const c = process.platform === 'win32'
      ? ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', path.join(home, 'AppData/Local/Google/Chrome/Application/chrome.exe'), 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe']
      : process.platform === 'darwin' ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium']
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/microsoft-edge'];
    return c.find(x => fs.existsSync(x)) || null;
  };
}
const sleep = t => new Promise(z => setTimeout(z, t));
const freePort = () => new Promise((ok, no) => { const s = net.createServer(); s.unref(); s.on('error', no); s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => ok(p)); }); });

async function openPage(html, opt = {}) {
  const width = opt.width || 1600, height = opt.height || 900;
  const chrome = findChrome(); if (!chrome) throw new Error('找不到 Chrome / Edge，可用环境变量 CHROME_PATH 指定');
  if (typeof WebSocket === 'undefined') throw new Error('需要 Node.js 22 及以上（内置 WebSocket）');
  const url = /^(https?|file):/.test(html) ? html : 'file:///' + path.resolve(html).replace(/\\/g, '/');
  const errs = []; const dialogs = [];
  let cur = null;   // 当前这一个浏览器实例 { ch, ws, send, prof }
  const launch = async () => {
    const port = await freePort();
    const prof = fs.mkdtempSync(path.join(os.tmpdir(), 'anno-chrome-'));
    const ch = spawn(chrome, ['--headless=new', '--remote-debugging-port=' + port, '--user-data-dir=' + prof, '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=IntensiveWakeUpThrottling,CalculateNativeWinOcclusion', '--window-size=' + width + ',' + height, 'about:blank'], { stdio: 'ignore' });
    let tab;
    for (let i = 0; i < 100 && !tab; i++) { try { const r = await fetch('http://127.0.0.1:' + port + '/json/list'); tab = (await r.json()).find(x => x.type === 'page'); } catch (e) {} if (!tab) await sleep(200); }
    if (!tab) { ch.kill(); throw new Error('浏览器没起来'); }
    const ws = new WebSocket(tab.webSocketDebuggerUrl); await new Promise((z, f) => { ws.onopen = z; ws.onerror = f; });
    let id = 0; const pend = {};
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
      if (d.method === 'Page.javascriptDialogOpening') { dialogs.push(d.params.message); ws.send(JSON.stringify({ id: ++id, method: 'Page.handleJavaScriptDialog', params: { accept: false } })); }   /* alert/confirm 会卡死页面脚本：自动关掉 */
      if (d.method === 'Runtime.exceptionThrown') errs.push(String(d.params.exceptionDetails.exception ? d.params.exceptionDetails.exception.description : d.params.exceptionDetails.text).slice(0, 300)); };
    const send = (method, params = {}) => new Promise(z => { const i = ++id; pend[i] = z; try { ws.send(JSON.stringify({ id: i, method, params })); } catch (e) { z({ error: String(e) }); } });
    cur = { ch, ws, send, prof };
    await send('Runtime.enable'); await send('Page.enable');
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
    await send('Page.bringToFront');
    await send('Page.navigate', { url });
    // 等 Vue 挂载完成（#app 有内容），最多约 90 秒
    const t0 = Date.now();
    while (Date.now() - t0 < 90000) { let ok = false; try { ok = await ev(() => { const a = document.getElementById('app'); return !!(a && (a.__vue_app__ || a._vnode) && a.innerText.trim().length > 0); }, null, 5000); } catch (e) {} if (ok) break; await sleep(50); }
  };
  const kill = async () => { if (!cur) return; const c = cur; cur = null; try { c.ws.close(); } catch (_) {} try { c.ch.kill(); } catch (_) {} await sleep(300); try { fs.rmSync(c.prof, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch (_) {} };
  const send = (m, p) => cur.send(m, p);
  async function ev(fn, arg, timeoutMs = 60000) {
    const expr = '(' + fn + ')(' + JSON.stringify(arg === undefined ? null : arg) + ')';
    const r = await Promise.race([cur.send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true }), sleep(timeoutMs).then(() => ({ timeout: true }))]);
    if (r.timeout) throw new Error('页面脚本超时 ' + timeoutMs + 'ms');
    if (r.error) throw new Error('浏览器连接断了：' + r.error);
    if (r.result && r.result.exceptionDetails) throw new Error('页面脚本出错：' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
    return r.result.result.value;
  }
  await launch();
  // 页面脚本卡死（原型自身死循环等）时：整个浏览器关掉重开（比页内刷新可靠），再跑调用方的 afterReload 恢复现场
  const b = { ev, send, errs, dialogs, reloads: 0, afterReload: async () => { await ev(PAGE_HELPERS); } };
  b.reload = async () => { b.reloads++; await kill(); await launch(); await b.afterReload(); };
  b.close = kill;
  process.on('exit', () => { try { cur && cur.ch.kill(); } catch (_) {} });
  return b;
}

// 页面里用的通用函数（字符串注入）：拿 Vue 根 setupState、归一化文字（与 annotation-layer 的 _anNorm/_anVis 完全一致）、收集可见元素与选中页签
const PAGE_HELPERS_BASE = function () {
  window.__W = t => new Promise(z => setTimeout(z, t));
  window.__N = s => String(s || '').replace(/[▾⌄›﹀▼\s]/g, '').replace(/[（(]\d+[)）]$/, '').replace(/([^\d.\-])\d+$/, '$1').trim();
  window.__V = el => { if (!el || !el.offsetParent) return false; const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.right > 0; };
  window.__S = () => { const A = document.getElementById('app'); if (!A) return null; return (A._vnode && A._vnode.component && A._vnode.component.setupState) || (A.__vue_app__ && A.__vue_app__._instance && A.__vue_app__._instance.setupState) || null; };
  const BTN = '.el-button,button,a,.el-link,.el-dropdown-link,.el-tooltip__trigger,[aria-haspopup],.el-tabs__item,.stab';
  const ALL = BTN + ',span,label,th .cell,.el-radio-button__inner,.el-checkbox__label,div';
  // 与 _anchorTick 相同的收集规则：返回 { texts:Map(text→el), active:Set }
  window.__collect = () => {
    const root = document.getElementById('app') || document.body; const by = new Map(); const active = new Set();
    root.querySelectorAll(ALL).forEach(el => {
      if (el.closest('#anno-app')) return;
      const isBtn = el.matches(BTN); if (!isBtn && el.children.length) return;
      const t = __N(el.innerText); if (!t || t.length > 30) return;
      if (/(^|\s)(is-active|on|active)(\s|$)/.test(el.className || '') && __V(el)) active.add(t);
      if (!by.has(t) && __V(el)) by.set(t, el);
    });
    root.querySelectorAll('.is-active,.on,.active').forEach(el => { if (__V(el)) { const t = __N(el.innerText); if (t && t.length <= 30) active.add(t); } });
    return { by, active };
  };
  window.__isBtn = el => el.matches(BTN);
  window.__BTN = BTN;
};

// 就绪等待（替代固定等待）：用共用检查器 cdp-run.js 的 PAGE_SETTLE——Vue nextTick 落定 + 两帧 + 无进行中的过渡动画 + DOM 连续 60ms 不变 + 无加载遮罩；
// 单拷本 skill（没有 _shared）时退回原来的固定等待 450ms。
let SETTLE_SRC = null; try { SETTLE_SRC = String(require('../_shared/qa/cdp-run.js').PAGE_SETTLE); } catch (_) {}
const PAGE_HELPERS = new Function('(' + PAGE_HELPERS_BASE + ')();\n' + (SETTLE_SRC
  ? 'const __SET = ' + SETTLE_SRC + ';\nwindow.__settle = o => __SET(Object.assign({ timeout: 8000, quiet: 60, needApp: false }, o || {}));'
  : 'window.__settle = () => __W(450);'));

// 页面内：进某个菜单
const PG_GO = async function (a) {
  const S = __S(); if (!S) return { err: 'no-vue' };
  if (a.flagsOn && S.FLAGS) for (const k of Object.keys(S.FLAGS)) if (S.FLAGS[k] === false) S.FLAGS[k] = true;
  try { if (document.querySelector('.el-overlay,.el-dialog__wrapper')) document.querySelectorAll('.el-dialog__headerbtn').forEach(b => b.offsetParent && b.click()); } catch (e) {}
  if (a.sys != null && S.setSys && S.currentSystem !== a.sys) { S.setSys(a.sys); await __settle(); }
  if (S.go) S.go(a.id);
  await __settle();
  return { ok: 1 };
};
// 页面内：当前状态快照
const PG_SNAP = function () {
  const FILT = '.qf-item,.el-check-tag';
  const S = __S() || {};
  const TAB = '.el-tabs__item,.stab,.sp-item,.el-radio-button__inner,[role=tab],.el-segmented__item';
  const A = document.querySelector('#anno-app'); const AS = A && A._vnode && A._vnode.component && A._vnode.component.setupState;
  const page = (AS && typeof AS.page === 'string' && AS.page) || (window.__VIEW__ && window.__VIEW__.page) || '';
  const open = Array.isArray(S.openTabs) ? S.openTabs : [];
  const isBar = el => el.matches('.el-tabs__item') && el.id && el.id.indexOf('tab-') === 0 && open.includes(el.id.slice(4));
  const tabs = []; const seenT = new Set();
  (document.getElementById('app') || document.body).querySelectorAll(TAB).forEach(el => {
    if (!__V(el) || el.closest('#anno-app') || isBar(el) || el.closest('.el-dialog,.el-drawer,.el-popper')) return;
    const t = N(el.innerText); if (!t || t.length > 20 || seenT.has(t)) return; seenT.add(t); tabs.push(t);
  });
  function N(s) { return __N(s); }
  const { by, active } = __collect();
  const texts = [];
  for (const [t, el] of by) {
    if (/^[\d\s.,:;\/\-~%R$#·()（）]+$/.test(t)) continue;
    texts.push([t, __isBtn(el) ? 1 : 0, el.closest('tbody') ? 1 : 0, el.matches(TAB) || isBar(el) ? 1 : 0]);
  }
  const dd = []; const seenD = new Set();
  (document.getElementById('app') || document.body).querySelectorAll('[aria-controls]').forEach(el => {
    if (!__V(el) || el.closest('#anno-app')) return;
    const m = document.getElementById(el.getAttribute('aria-controls')); if (!m) return;
    const items = [...m.querySelectorAll('.el-dropdown-menu__item,li,[role=menuitem]')].filter(x => !x.querySelector('li')).map(x => N(x.innerText)).filter(Boolean);
    if (!items.length) return;
    const trig = N(el.innerText); if (!trig || trig.length > 20) return;
    const key = trig + '|' + items.join(','); if (seenD.has(key)) return; seenD.add(key);
    dd.push([trig, el.closest('tbody') ? 1 : 0, [...new Set(items)]]);
  });
  // 快捷筛选小块（骨架 .qf-item / Element 的 el-check-tag）：不算页签（标注层不认 is-on），但点了会换出别的行和按钮
  const filters = []; let filterOn = '';
  (document.getElementById('app') || document.body).querySelectorAll(FILT).forEach(el => { if (!__V(el) || el.closest('#anno-app,.el-dialog,.el-drawer,.el-popper')) return; const t = N(el.innerText); if (!t || t.length > 20 || filters.includes(t)) return; filters.push(t); if (/(^|s)(is-on|is-checked|on|active|is-active)(s|$)/.test(el.className || '')) filterOn = t; });
  return { page, tabs, active: [...active], texts, dd, filters, filterOn };
};
const PG_CLICKF = async function (t) {
  const el = [...(document.getElementById('app') || document.body).querySelectorAll('.qf-item,.el-check-tag')].find(e => __V(e) && !e.closest('#anno-app') && __N(e.innerText) === t);
  if (!el) return 0; el.click(); await __settle(); return 1;
};
const PG_CLICK = async function (t) {
  const TAB = '.el-tabs__item,.stab,.sp-item,.el-radio-button__inner,[role=tab],.el-segmented__item';
  const el = [...(document.getElementById('app') || document.body).querySelectorAll(TAB)].find(e => __V(e) && !e.closest('#anno-app') && __N(e.innerText) === t);
  if (!el) return 0;
  el.click(); await __settle(); return 1;
};
// 页面内：列出所有菜单（骨架通用：systems / nav / posNavItems 之类 {page,label} 数组；没有骨架 API 就只爬当前页）
const PG_MENUS = async function () {
  const S = __S(); if (!S || !S.go) return { menus: [{ sys: null, id: null, labels: [document.title || ''] }], generic: true };
  const z = l => l == null ? '' : typeof l === 'string' ? l : (l.zh || l.en || Object.values(l)[0] || '');
  const out = []; const seen = new Set();
  const pageArrs = Object.keys(S).filter(k => /nav|menu|items/i.test(k)).filter(k => { const v = S[k]; return Array.isArray(v) && v.length && v[0] && typeof v[0] === 'object' && typeof v[0].page === 'string' && v[0].label; });
  const syss = Array.isArray(S.systems) && S.systems.length && S.setSys ? S.systems.map(s => ({ key: s.key, label: z(s.label) })) : [{ key: null, label: '' }];
  for (const s of syss) {
    if (s.key != null) { S.setSys(s.key); await __settle(); }
    const add = (id, labels) => { if (!id || seen.has(id)) return; seen.add(id); out.push({ sys: s.key, id, labels: [s.label, ...labels].filter(Boolean) }); };
    const walk = (arr, pre) => { for (const it of arr || []) { if (Array.isArray(it)) add(it[0], [...pre, z(it[1])]); else if (it && it.items) walk(it.items, [...pre, z(it.group)]); else if (it && it.id) add(it.id, [...pre, z(it.label)]); } };
    walk(S.nav, []);
    // {page,label} 数组（如收银台的侧栏）挂到菜单里含其中某个页面的那个系统下
    for (const k of pageArrs) { const v = S[k]; if (Array.isArray(v) && v.some(x => x && seen.has(x.page) && out.some(m => m.sys === s.key && m.id === x.page))) v.forEach(x => x && typeof x.page === 'string' && add(x.page, [z(x.label)])); }
    if (!out.some(m => m.sys === s.key) && S.currentPage) add(S.currentPage, []);
  }
  for (const k of pageArrs) { const v = S[k]; if (Array.isArray(v)) v.forEach(x => { if (x && typeof x.page === 'string' && !seen.has(x.page)) { seen.add(x.page); out.push({ sys: syss[0].key, id: x.page, labels: [z(x.label)] }); } }); }
  return { menus: out };
};


// 逐个菜单进页面，逐层点页签（最多 3 层），每到一个新状态回调 onState(state)。
//   menus     PG_MENUS 的结果（可先过滤只留要的页面）
//   flagsPasses  [false,true]：第二遍把骨架 FLAGS 里的布尔开关全打开（只记新出现的状态）；默认按原型自动判断
//   onState   async (state) => {}：此刻页面正停在该状态，可在页面里做检查（如触发标注锚点刷新）
//   pageOf    可选 (menu)=>预期页面 id，用于跳过不需要的菜单
async function walkStates(b, opt) {
  const { menus, onState, log = s => process.stdout.write(s + '\n'), t0 = Date.now() } = opt;
  const states = [];
  let passes = opt.flagsPasses;
  if (!passes) { const hasFlags = await b.ev(() => { const S = __S(); return !!(S && S.FLAGS && Object.values(S.FLAGS).some(v => v === false)); }); passes = hasFlags ? [false, true] : [false]; }
  const NN = s => String(s || '').replace(/[▾⌄›﹀▼\s]/g, '').replace(/[（(]\d+[)）]$/, '').replace(/([^\d.\-])\d+$/, '$1').trim();
  const sigSeen = new Set(); const firstTabs = new Map();
  for (const flagsOn of passes) {
    if (flagsOn) log('开关全开再爬一遍（只记新出现的状态）…');
    let k = 0;
    for (const m of menus) {
      k++;
      const go = async () => { await b.ev(PG_GO, { sys: m.sys, id: m.id, flagsOn }, 30000); };
      const bad = new Map();   // 点了会卡死的页签：卡 2 次才放弃
      const click = async t => { try { return await b.ev(PG_CLICK, t, 20000); } catch (e) { if (!/超时/.test(e.message)) throw e; const n = (bad.get(t) || 0) + 1; bad.set(t, n); log(`    点【${t}】后页面卡死，重开浏览器${n >= 2 ? "，跳过它" : "后再试一次"}`); await b.reload(); await go(); return -1; } };
      for (let attempt = 0; attempt < 2; attempt++) try {   // 页面卡死：重开浏览器后整页重试一次
        await go();
        const s0 = await b.ev(PG_SNAP, null, 30000);
        const basePath = String(m.id || '').includes('@') ? [NN(m.labels[m.labels.length - 1])].filter(t => s0.active.includes(t)) : [];
        const page = s0.page || String(m.id || '').split('@')[0];
        const rec = async (snap, clicks, filter) => {
          let tabPath = [];
          const sig = page + '|' + snap.active.slice().sort().join(',') + '|' + snap.texts.length + '|' + (filter || '');
          if (sigSeen.has(sig)) return false; sigSeen.add(sig);
          const act = snap.tabs.filter(t => snap.active.includes(t) && !tabPath.includes(t));
          tabPath = [...basePath, ...act];   // 页签路径 = 菜单带的状态 + 当前选中的页签（含默认选中的子页签）
          const st = { menu: m.id, sys: m.sys, page, labels: m.labels, tabPath, flagsOn, active: snap.active, texts: snap.texts, dd: snap.dd };
          if (filter) st.filter = filter; else if (snap.filters.length > 1) { st.filters = snap.filters; st.filterOn = snap.filterOn; }
          Object.defineProperty(st, 'clicks', { value: clicks, enumerable: false });
          states.push(st); if (onState) await onState(st);
          return true;
        };
        if (flagsOn) { const t1 = firstTabs.get(m.id); if (t1 !== undefined && t1 === s0.tabs.join('|')) { break; } }   // 开关没改变页签的页面不重爬
        else firstTabs.set(m.id, s0.tabs.join('|'));
        await rec(s0, []);
        // 只点本层新出现的页签（上一层已有的是兄弟，不当子级）
        const explore = async (clicks, snap, parentTabs, depth) => {
          const mine = snap.tabs.filter(t => !parentTabs.has(t));
          let dirty = false;
          for (const t of mine) {
            if ((bad.get(t) || 0) >= 2) continue;
            if (dirty) { await go(); for (const c of clicks) await click(c); dirty = false; }
            let ck = await click(t); if (ck === -1) { for (const c of clicks) await click(c); if ((bad.get(t) || 0) >= 2) continue; ck = await click(t); if (ck === -1) { for (const c of clicks) await click(c); continue; } } if (!ck) continue;
            const s1 = await b.ev(PG_SNAP, null, 30000);
            if (s1.page && s1.page !== page) { dirty = true; continue; }   // 点了跳去别的页面 = 导航，不是页签
            if (!s1.active.includes(t)) { dirty = true; continue; }         // 点了没变成选中 = 不是页签
            const fresh = await rec(s1, [...clicks, t]);
            if (fresh && depth < 3) {
              await explore([...clicks, t], s1, new Set([...snap.tabs, ...parentTabs]), depth + 1);
              dirty = true;
            }
          }
        };
        await explore([], s0, new Set(), 1);
        // 每个状态再逐个点快捷筛选（如 待开票 下的“开票失败”），记成同页签下的筛选状态
        for (const st of states.filter(x => x.menu === m.id && x.flagsOn === flagsOn && x.filters)) {
          await go(); let ok = true; for (const c of st.clicks) if ((await click(c)) !== 1) { ok = false; break; } if (!ok) continue;
          for (const f of st.filters) { if (f === st.filterOn) continue;
            let r; try { r = await b.ev(PG_CLICKF, f, 20000); } catch (e) { log(`    点筛选【${f}】后页面卡死，重开浏览器跳过它`); await b.reload(); break; }
            if (!r) continue; const s2 = await b.ev(PG_SNAP, null, 30000); if (s2.page && s2.page !== page) break;
            const before = st.clicks; await rec(s2, before, f); }
        }
        log(`  [${flagsOn ? '开关全开 ' : ''}${k}/${menus.length}] ${m.labels.join('›')} (${page}) 累计状态 ${states.length}，${Math.round((Date.now() - t0) / 1000)}s`);
        break;
      } catch (e) { const again = attempt === 0 && /超时/.test(e.message); log(`  [${k}/${menus.length}] ${m.labels.join('›')} ${again ? '页面卡死，重开浏览器重试' : '跳过'}：${String(e.message || e).slice(0, 120)}`); if (/超时/.test(e.message)) await b.reload(); if (!again) break; }
    }
  }
  return states;
}

module.exports = { openPage, PAGE_HELPERS, sleep, findChrome, PG_GO, PG_SNAP, PG_CLICK, PG_CLICKF, PG_MENUS, walkStates };

