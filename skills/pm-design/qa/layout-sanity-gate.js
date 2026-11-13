#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   ㊷ 布局体检闸 · layout-sanity-gate.js · 随包·不碰真数据
   ────────────────────────────────────────────────────────────────────────
   【为什么有这道闸】2026-09-10 用户震怒：生成/复刻的原型反复出现「首页板块挤在
   一起、查询筛选区/新增/编辑字段重叠、内容撑出横向滚动条」。光写规范约束不住，
   加机器闸卡死——headless 渲染后测每个板块 boundingRect：
     ① 任意两个【正常流】可见板块矩形【相交】(面积>阈值) = 红（重叠/挤压）
     ② body 出现【横向溢出】(scrollWidth 明显 > clientWidth) = 红（内容撑爆=挤的根源）
   低误报设计：只比较正常流(static/relative)的块级容器，排除父子嵌套、
   排除浮层(el-popper/dropdown/overlay/fixed/absolute)、相邻(0 间距)不算重叠。
   用法：node layout-sanity-gate.js
   退出码：0 全绿/跳过 · 1 有重叠/溢出 · 2 环境错
   零依赖：node + 本机 Chrome + _gate-vendor 缓存（不联网、不碰 archive、不碰 anno-server）。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn, execFileSync } = require('child_process');
const { findChrome } = require('./_gate-env');
const { ensureVendor, localize, copyVendorInto } = require('./_gate-vendor');

const CHROME = process.env.CHROME_PATH || findChrome();
const FIX = path.join(__dirname, 'fixtures', 'vt');
const sleep = ms => new Promise(z => setTimeout(z, ms));

/* 页面内体检：返回 { overflow, overlaps:[{a,b,ix,iy}] } —— 数值取整、无随机 */
const CHECK_FN = `(() => {
  const px = v => Math.round(v);
  const vis = el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el);
    return r.width > 2 && r.height > 2 && s.visibility !== 'hidden' && s.display !== 'none' && parseFloat(s.opacity||'1') > 0.05; };
  // 只比较【正常流块级容器】：仪表盘卡片/筛选行/表单字段块/表格/分页/自定义板块
  const SEL = ['.el-card','.stat-card','.dash-card','.metric-card','.panel','.board','.section-card',
    '.search-box .el-form-item','.form-grid .el-form-item','.el-table','.pagination-container','.el-pagination',
    '.custom-block','.chart-card','.info-card'];
  let nodes = [];
  SEL.forEach(s => document.querySelectorAll(s).forEach(e => nodes.push(e)));
  nodes = [...new Set(nodes)].filter(vis).filter(e => {
    const s = getComputedStyle(e);
    if (s.position === 'fixed' || s.position === 'absolute') return false;       // 排浮层/绝对定位
    if (e.closest('.el-popper,.el-overlay,.el-select-dropdown,.el-picker__popper,[role="tooltip"]')) return false;
    return true;
  });
  // 排除父子嵌套（只留互不包含的块）
  const keep = nodes.filter(a => !nodes.some(b => b !== a && b.contains(a) && SEL.some(s=>b.matches(s))));
  const rect = e => { const r = e.getBoundingClientRect(); return { l:r.left, t:r.top, r:r.right, b:r.bottom, w:r.width, h:r.height }; };
  const name = e => (e.className && typeof e.className === 'string' ? '.'+e.className.trim().split(/\\s+/).slice(0,2).join('.') : e.tagName) + '#' + px(e.getBoundingClientRect().top);
  const overlaps = [];
  for (let i = 0; i < keep.length; i++) for (let j = i+1; j < keep.length; j++) {
    const a = keep[i], b = keep[j];
    if (a.contains(b) || b.contains(a)) continue;
    const ra = rect(a), rb = rect(b);
    const ix = Math.min(ra.r, rb.r) - Math.max(ra.l, rb.l);
    const iy = Math.min(ra.b, rb.b) - Math.max(ra.t, rb.t);
    // 相交面积两向都 > 4px 才算重叠（排边框/相邻 0 间距误报）
    if (ix > 4 && iy > 4) overlaps.push({ a: name(a), b: name(b), ix: px(ix), iy: px(iy) });
  }
  const de = document.documentElement;
  const overflow = px(de.scrollWidth) - px(de.clientWidth);
  return { blocks: keep.length, overflow, overlaps: overlaps.slice(0, 30) };
})()`;

/* §2026-10-25 端口让位（治假红）：这道闸和 ㉛真实交付物冒烟闸 **用的是同一段固定端口 8990+**，
   只要有任何并发（上一道闸的 server 还没释放、或 Stop 钩子触发的后台重建任务正在跑），
   listen 就抛 EADDRINUSE → 整道闸 0.3 秒判红。这是**假红**，比没有闸更危险：
   它会训练人把红当"抖动"放行。2026-10-25 实测：全闸里 ㉛ 和 ㊷ 同时 0.2~0.3 秒判红，
   单独重跑两道全绿 —— 内容一个字没问题，纯粹是抢端口。
   改成跑之前先探一组真正空闲的端口（web 口 + 调试口都空才用），探不到才真报错。 */
function _probeFree(p) {
  return new Promise(res => {
    const s = require('net').createServer();
    s.once('error', () => res(false));
    s.listen(p, () => s.close(() => res(true)));
  });
}
async function freePort(start) {
  for (let p = start; p < start + 400; p += 7) if (await _probeFree(p) && await _probeFree(p + 1000)) return p;
  throw new Error('找不到空闲端口（起点 ' + start + '）');
}

async function checkOne(htmlPath, dir, port, pages) {
  port = await freePort(port);
  const dport = port + 1000;
  const server = http.createServer((rq, rs) => {
    const f = path.join(dir, decodeURIComponent(rq.url.split('?')[0]));
    fs.readFile(f, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'Content-Type': /\.html$/.test(f) ? 'text/html;charset=utf-8' : /\.css$/.test(f) ? 'text/css' : 'application/javascript' }); rs.end(d); });
  }).listen(port);
  const ud = path.join(dir, 'ud');
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
    '--window-size=1680,1050', '--remote-debugging-port=' + dport, '--user-data-dir=' + ud, 'about:blank']);
  const results = {};
  try {
    let tab = null;
    for (let i = 0; i < 60; i++) { try { tab = (await (await fetch(`http://localhost:${dport}/json/list`)).json()).find(t => t.type === 'page'); if (tab) break; } catch (_) {} await sleep(200); }
    if (!tab) throw new Error('Chrome 未就绪');
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = {};
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
    const send = (m, p = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    const evalv = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false });
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(function(){var of=window.fetch;window.fetch=function(u,o){try{var s=typeof u==='string'?u:(u&&u.url)||'';if(s.indexOf('localhost:3799')>=0)return Promise.reject(new Error('blocked'));}catch(e){}return of.call(this,u,o);};})();` });
    await send('Page.navigate', { url: `http://localhost:${port}/p.html` });
    for (let i = 0; i < 120; i++) { await sleep(150); if (await evalv(`!!document.querySelector('#app')`) === true) break; }
    await sleep(900);
    // 遍历每个页面(sys/page 深链)：这里只测首页 + 逐页切换需 nav；MVP 先测当前默认落地页 + 遍历 PAGECFG 里前若干页
    const pageIds = await evalv(`(typeof PAGECFG!=='undefined')?Object.keys(PAGECFG):(window.PAGECFG?Object.keys(window.PAGECFG):[])`) || [];
    const toVisit = ['<default>'].concat(pageIds.slice(0, 12));
    for (const pid of toVisit) {
      if (pid !== '<default>') { await evalv(`(function(){try{ if(window.__gotoPage) return window.__gotoPage(${JSON.stringify(pid)}); var el=[...document.querySelectorAll('.el-menu-item')].find(m=>m.getAttribute('data-page')===${JSON.stringify(pid)}); if(el) el.click(); }catch(e){} })()`); await sleep(500); }
      const r = await evalv(CHECK_FN);
      if (r) results[pid] = r;
    }
    ws.close();
  } finally { try { server.close(); } catch (_) {} try { ch.kill(); } catch (_) {} }
  return results;
}

async function runOne(fixFile, port) {
  const name = path.basename(fixFile, '.json');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ls-'));
  const out = path.join(dir, 'p.html');
  execFileSync('node', [path.join(__dirname, 'assemble-prototype.js'), fixFile, out, '--fast'], { stdio: 'pipe' });  // --fast：只装配不再触发体检（否则 gate↔assemble 死循环）
  fs.writeFileSync(out, localize(fs.readFileSync(out, 'utf8')), 'utf8');
  copyVendorInto(dir);
  const results = await checkOne(out, dir, port);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
  let bad = 0;
  for (const [pid, r] of Object.entries(results)) {
    const probs = [];
    if (r.overflow > 8) probs.push(`横向溢出 ${r.overflow}px（内容撑爆视口=挤）`);
    if (r.overlaps && r.overlaps.length) r.overlaps.forEach(o => probs.push(`板块重叠 ${o.a} ✕ ${o.b}（相交 ${o.ix}×${o.iy}px）`));
    if (probs.length) { bad += probs.length; console.log(`  ✘ ${name} · 页[${pid}]（${r.blocks}块）:`); probs.slice(0, 8).forEach(p => console.log('       · ' + p)); }
  }
  if (!bad) console.log(`  ✓ ${name} — 无板块重叠、无横向溢出（体检 ${Object.keys(results).length} 页）`);
  return bad === 0;
}

(async () => {
  console.log('\n════════ ㊷ 布局体检闸 layout-sanity-gate ════════');
  console.log('  测「板块有没有挤/重叠、内容有没有撑出横向滚动条」');
  if (!CHROME) { console.log('⊘ SKIP：未找到 Chrome/Edge'); process.exit(0); }
  const v = await ensureVendor();
  if (!v.ok) { console.log(`⊘ SKIP：vendor 缓存不全（缺 ${v.missing}）`); process.exit(0); }
  // 可选参数：传一个 project-data.json 路径 → 只体检那一份（供随手查任意原型）；不传则跑内置 fixtures
  const argJson = process.argv.slice(2).find(a => a.endsWith('.json') && fs.existsSync(a));
  let fixtures = [];
  if (argJson) { fixtures = [argJson]; console.log('  目标：' + argJson); }
  else { try { fixtures = fs.readdirSync(FIX).filter(f => f.endsWith('.json')).map(f => path.join(FIX, f)); } catch (_) {} }
  if (!fixtures.length) { console.log('⊘ SKIP：无 fixture（也没传 project-data.json）'); process.exit(0); }
  console.log('───────────────────────────────────────');
  let ok = true;
  for (let i = 0; i < fixtures.length; i++) ok = (await runOne(fixtures[i], 8990 + i * 3)) && ok;
  console.log('───────────────────────────────────────');
  console.log(ok ? '  布局体检：全绿 ✓（无挤压/重叠/溢出）' : '  布局体检：有红 ✘ —— 板块挤/重叠/溢出，禁交付');
  console.log('════════════════════════════════════════\n');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.error('闸异常:', e.message); process.exit(2); });
