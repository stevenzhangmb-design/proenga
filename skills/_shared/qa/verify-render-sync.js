#!/usr/bin/env node
/* verify-render-sync.js · 推送后核对“浏览器里看到的内容”线上和本地是否一致（verify-pages-sync.js 逐字节核对的补充）。
   起因：只比文件哈希就说“线上一致”，用户在浏览器里看到线上和本地差异很大。逐字节一致只说明传上去的文件对，
   不说明打开后看到的一样（缓存、部署延迟、传错文件、发布脚本生成的东西和本地不同都会这样）。
   铁律：推送后 verify-pages-sync 和本工具两个都通过（退出码 0），才能对用户说“已推送、线上一致”。

   用法：
     原型：node verify-render-sync.js --proto <本地原型.html> <线上网址> [选项]
       用两个无头浏览器分别打开，逐个菜单 × 左侧状态面板 × 页签 × 快捷筛选遍历（与标注工具同一套 walkStates），
       每个状态取可见文字，并把所有悬停浮层（“ⓘ 说明”、列名问号、置灰按钮原因等）逐个悬停取出文字，再取下拉菜单项，逐状态比对。
       不比的内容：标注层（#anno-app、标注开关、标注编号 pin、作者专用按钮）——分享版和交付件只差这些；
                   时间相关的动态值（{{-8m}} 渲染出的时刻、日期、“N 分钟前”“剩余 N 小时”等）统一替换成占位后再比。
     PRD： node verify-render-sync.js --prd <本地 PRD.md 或已生成的 index.html> <线上 PRD 网址> [选项]
       本地给 .md 时，先用 skills/prd/publish-prd-html.js 在临时目录生成一份网页（和发布同一套转换），
       再和线上网页用同一套方法按标题分节取文字、数图片；逐节比对文字和图片数，并逐张比对线上图片和本地图片的 sha256。

   选项：
     --out <目录>          报告和截图放哪（默认 <临时根>/verify-render-sync/<模式>-<时间>，同模式只保留最近一次）
     --load-timeout <秒>   打开页面等加载完的时限（默认 300；线上原型约 40MB，要留够）
     --retries <次>        打开页面、下载图片失败的重试次数（默认 2）
     --timeout <分钟>      整次核对总时限（默认 90），超时判不通过
     --no-flags            原型不做“开关全开再爬一遍”（默认原型有功能开关时会多爬一遍）
     --only <菜单id,…>     原型只核这些菜单（排查时用；正式核对不要加）
     --max-shots <张>      不一致的状态最多各截几张图（默认 20）
     --no-bust             线上网址不加防缓存参数（默认加 ?_v=<时间戳>）
     --width <像素>        浏览器宽度（默认 1600）

   输出：进度、一致的状态数（或章节数）、不一致的状态（页面 › 面板 › 页签 › 差异片段，前后各 40 字）、只在一边出现的状态；
         报告文件 report.txt 和截图（00-本地.jpg / 00-线上.jpg 是首页对照；不一致的状态各一对）放在 --out 目录。
   退出码：全部一致 = 0；有不一致、只在一边出现、打不开或超时 = 1；参数错误 = 2。 */
require('./_tmp-sandbox');
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const https = require('https'), http = require('http'), { fileURLToPath, pathToFileURL } = require('url');
const { execFileSync } = require('child_process');
const { tmpRoot } = require('./_tmp-root');
const AB = require('../../prd/_anno-browser.js');

const sleep = t => new Promise(z => setTimeout(z, t));
const T0 = Date.now();
const secs = () => Math.round((Date.now() - T0) / 1000) + 's';
let REPORT = [];
const log = s => { process.stdout.write(s + '\n'); };
const rep = s => { REPORT.push(s); log(s); };

function parseArgs(argv) {
  const o = { mode: '', local: '', remote: '', out: '', loadTimeout: 300, retries: 2, timeout: 90, flags: true, only: null, maxShots: 20, bust: true, width: 1600 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => { if (i + 1 >= argv.length) throw new Error('缺少参数值：' + a); return argv[++i]; };
    if (a === '--proto' || a === '--prd') { o.mode = a.slice(2); o.local = next(); o.remote = next(); }
    else if (a === '--out') o.out = next();
    else if (a === '--load-timeout') o.loadTimeout = +next();
    else if (a === '--retries') o.retries = +next();
    else if (a === '--timeout') o.timeout = +next();
    else if (a === '--no-flags') o.flags = false;
    else if (a === '--only') o.only = next().split(/[,，\s]+/).filter(Boolean);
    else if (a === '--max-shots') o.maxShots = +next();
    else if (a === '--no-bust') o.bust = false;
    else if (a === '--width') o.width = +next();
    else if (a === '-h' || a === '--help') o.help = true;
    else throw new Error('未知参数：' + a);
  }
  return o;
}
const toTarget = p => /^(https?|file):/i.test(p) ? p : pathToFileURL(path.resolve(p)).href;
const bust = (u, on) => !on || !/^https?:/i.test(u) ? u : u + (u.includes('?') ? '&' : '?') + '_v=' + Date.now();

/* ───── 文字归一化与差异片段 ───── */
// 时间相关的动态值：日期、时刻、“N 分钟前”“剩余 N 小时 N 分钟”“há N minutos”“N min ago”“刚刚”
function normTime(s) {
  return s
    .replace(/\d{4}[-/.]\d{1,2}[-/.]\d{1,2}/g, '⟨日期⟩')
    .replace(/\d{1,2}[-/.]\d{1,2}[-/.]\d{4}/g, '⟨日期⟩')
    .replace(/\d{1,2}:\d{2}(:\d{2})?/g, '⟨时刻⟩')
    .replace(/剩余\s*(\d+\s*(天|小时|时|分钟|分|秒)\s*)+/g, '剩余⟨时长⟩')
    .replace(/(\d+\s*(天|小时|分钟|秒)\s*)+(前|后)/g, '⟨时长⟩$3')
    .replace(/há\s+\d+\s*\w+/gi, 'há ⟨时长⟩')
    .replace(/\d+\s*(s|sec|secs|seconds?|min|mins|minutes?|h|hrs?|hours?|d|days?)\s+(ago|left)/gi, '⟨时长⟩ $2')
    .replace(/刚刚|just now|agora mesmo/gi, '⟨时长⟩');
}
const normText = (s, time) => String(s || '').split(/\r?\n/).map(l => l.replace(/[\s ]+/g, ' ').trim()).filter(Boolean).map(l => time ? normTime(l) : l);
// 按行对齐（LCS），返回差异块；每块给出本地/线上的差异片段，前后各带 40 字上下文
function diffHunks(A, B, ctx = 40, maxHunks = 5) {
  const n = A.length, m = B.length; const hunks = [];
  let i0 = 0; while (i0 < n && i0 < m && A[i0] === B[i0]) i0++;
  let e = 0; while (e < n - i0 && e < m - i0 && A[n - 1 - e] === B[m - 1 - e]) e++;
  const a = A.slice(i0, n - e), b = B.slice(i0, m - e);
  let pairs;   // 中段的对齐
  if (a.length * b.length <= 4e6) {
    const L = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
    for (let i = a.length - 1; i >= 0; i--) for (let j = b.length - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    pairs = []; let i = 0, j = 0;
    while (i < a.length && j < b.length) { if (a[i] === b[j]) { pairs.push([i, j]); i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) i++; else j++; }
  } else pairs = [];
  pairs.push([a.length, b.length]);
  let pi = 0, pj = 0;
  for (const [qi, qj] of pairs) {
    if (qi > pi || qj > pj) hunks.push([i0 + pi, i0 + qi, i0 + pj, i0 + qj]);
    pi = qi + 1; pj = qj + 1;
  }
  const J = '⏎';
  const out = hunks.slice(0, maxHunks).map(([as, ae, bs, be]) => {
    let x = A.slice(as, ae).join(J), y = B.slice(bs, be).join(J);
    let before = A.slice(0, as).join(J), after = A.slice(ae).join(J);
    // 块内再按字收紧
    let p = 0; while (p < x.length && p < y.length && x[p] === y[p]) p++;
    let q = 0; while (q < x.length - p && q < y.length - p && x[x.length - 1 - q] === y[y.length - 1 - q]) q++;
    before = (before ? before + J : '') + x.slice(0, p); after = x.slice(x.length - q) + (after ? J + after : '');
    const cut = s => s.length > 300 ? s.slice(0, 300) + '…（共 ' + s.length + ' 字）' : s;
    const pre = before.slice(-ctx), post = after.slice(0, ctx);
    return { local: pre + '⟦' + cut(x.slice(p, x.length - q)) + '⟧' + post, remote: pre + '⟦' + cut(y.slice(p, y.length - q)) + '⟧' + post };
  });
  return { hunks: out, total: hunks.length };
}

/* ───── 浏览器 ───── */
async function openSide(name, target, o, ready, prep) {
  for (let k = 0; k <= o.retries; k++) {
    const t = Date.now(); let b = null;
    log(`[${name}] 打开 ${target}${k ? `（第 ${k + 1} 次）` : ''}…`);
    try {
      b = await AB.openPage(target, { width: o.width, readyTimeout: o.loadTimeout * 1000, ready });
      const ok = await b.ev(ready || (() => { const a = document.getElementById('app'); return !!(a && (a.__vue_app__ || a._vnode) && a.innerText.trim().length > 0); }), null, 30000);
      if (!ok) throw new Error(`${o.loadTimeout} 秒内页面没加载完`);
      if (prep) { await prep(b); b.afterReload = async () => { await prep(b); }; }
      log(`[${name}] 已打开，用时 ${((Date.now() - t) / 1000).toFixed(1)} 秒`);
      return b;
    } catch (e) {
      log(`[${name}] 打开失败：${e.message}`);
      if (b) try { await b.close(); } catch (_) {}
      if (k === o.retries) throw new Error(`[${name}] 打开失败（已重试 ${o.retries} 次）：${e.message}`);
      await sleep(5000 * (k + 1));
    }
  }
}
async function shot(b, file) {
  try { await b.send('Page.bringToFront'); const r = await b.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); if (r && r.result && r.result.data) { fs.writeFileSync(file, Buffer.from(r.result.data, 'base64')); return file; } } catch (_) {}
  return null;
}

/* ───── 原型 ───── */
const SKIP = '#anno-app,.anno-sw,.anno-pin,.anno-pin-badge,.pin-layer,.ai-pin-bar,.anno-author-only';
// 标注层整体隐藏：分享版和交付件只差标注层，不参与比对
const PG_HIDE_ANNO = function (skip) {
  if (!document.getElementById('__vrs_hide')) { const s = document.createElement('style'); s.id = '__vrs_hide'; s.textContent = skip + '{display:none!important}'; document.head.appendChild(s); }
  return 1;
};
// 当前状态：可见文字 + 逐个悬停浮层文字 + title 提示
const PG_CAPTURE = async function (skip) {
  const root = document.getElementById('app') || document.body;
  const text = root.innerText;
  const vis = e => e.checkVisibility ? e.checkVisibility() : !!e.offsetParent;
  const N = s => String(s || '').replace(/\s+/g, ' ').trim();
  const label = e => { const own = N(e.innerText); if (own && own.length <= 30) return own; const c = e.closest('th,label,.el-form-item__label,.el-form-item,td,.cell'); const ct = c ? N((c.querySelector('.el-form-item__label') || c).innerText).slice(0, 24) : ''; return (ct ? '[' + ct + ']' : '') + (own ? own.slice(0, 20) + '…' : '图标'); };
  const trig = [...root.querySelectorAll('.el-tooltip__trigger')].filter(e => !e.closest(skip) && vis(e) && !e.hasAttribute('aria-haspopup'));
  const hov = []; const CH = 60;
  for (let i = 0; i < trig.length; i += CH) {
    const part = trig.slice(i, i + CH);
    part.forEach(e => e.dispatchEvent(new MouseEvent('mouseenter', { bubbles: false })));
    const t0 = performance.now(); let got = [];
    for (;;) {
      await __W(60);
      got = part.map(e => { const id = e.getAttribute('aria-describedby'); if (!id) return null; const p = document.getElementById(id); return p && vis(p) && N(p.innerText) ? p : 'wait'; });
      const el = performance.now() - t0;
      if ((el > 300 && !got.includes('wait')) || el > 2000) break;
    }
    part.forEach((e, j) => { const p = got[j]; if (p && p !== 'wait') hov.push([label(e), p.innerText]); });
    part.forEach(e => e.dispatchEvent(new MouseEvent('mouseleave', { bubbles: false })));
    const t1 = performance.now();
    while (performance.now() - t1 < 2000 && got.some(p => p && p !== 'wait' && vis(p))) await __W(60);
  }
  // 原生 title 提示（如每行的“复制”）按文字计数，不逐个列
  const tc = {}; root.querySelectorAll('[title]').forEach(e => { const t = N(e.getAttribute('title')); if (t && !e.closest(skip) && vis(e)) tc[t] = (tc[t] || 0) + 1; });
  for (const t of Object.keys(tc)) hov.push(['title 提示：' + t.slice(0, 30), t + '（' + tc[t] + ' 处）']);
  return { text, hov, ntrig: trig.length };
};

function stateKey(st) { return [st.sys, st.menu, st.flagsOn ? '开关全开' : '', (st.clicks || []).join('>'), st.filter || ''].join('|'); }
function stateName(st) {
  const parts = [...(st.labels || [])];
  parts.push(st.tabPath && st.tabPath.length ? st.tabPath.join(' › ') : '（默认）');
  if (st.filter) parts.push('筛选：' + st.filter);
  return parts.join(' › ') + (st.flagsOn ? '（开关全开）' : '');
}

async function walkSide(name, b, o) {
  let { menus } = await b.ev(AB.PG_MENUS, null, 120000);
  if (o.only) menus = menus.filter(m => o.only.includes(m.id));
  log(`[${name}] 菜单 ${menus.length} 个，开始逐个状态遍历…`);
  const out = new Map(); let first = null;
  const states = await AB.walkStates(b, {
    menus, t0: Date.now(), flagsPasses: o.flags ? undefined : [false],
    log: s => log(`[${name}]${s.startsWith(' ') ? '' : ' '}${s}`),
    onState: async st => {
      let cap;
      try { cap = await b.ev(PG_CAPTURE, SKIP, 60000); } catch (e) { cap = { text: '', hov: [], err: e.message }; }
      let k = stateKey(st), n = 1; while (out.has(n > 1 ? k + '#' + n : k)) n++; if (n > 1) k += '#' + n;
      const occ = {}; const hov = cap.hov.map(([l, t]) => { occ[l] = (occ[l] || 0) + 1; return [l + (occ[l] > 1 ? '#' + occ[l] : ''), normText(t, true).join('⏎')]; });
      for (const [trig, , items] of st.dd || []) { const l = '下拉:' + trig; occ[l] = (occ[l] || 0) + 1; hov.push([l + (occ[l] > 1 ? '#' + occ[l] : ''), normTime(items.join('、'))]); }
      out.set(k, { key: k, name: stateName(st), st: { sys: st.sys, menu: st.menu, flagsOn: st.flagsOn, clicks: st.clicks || [], filter: st.filter || '' }, lines: normText(cap.text, true), hov: new Map(hov), err: cap.err });
      if (!first) { first = k; await shot(b, path.join(o.out, `00-${name}.jpg`)); }
    },
  });
  try { fs.writeFileSync(path.join(o.out, `states-${name}.json`), JSON.stringify([...out.values()].map(s => ({ name: s.name, key: s.key, lines: s.lines, hover: Object.fromEntries(s.hov) })), null, 1)); } catch (_) {}
  return { menus, states: out, n: states.length };
}

async function revisit(b, st) {
  await b.ev(AB.PG_GO, { sys: st.sys, id: st.menu, flagsOn: st.flagsOn }, 30000);
  for (const c of st.clicks) await b.ev(AB.PG_CLICK, c, 20000);
  if (st.filter) await b.ev(AB.PG_CLICKF, st.filter, 20000);
}

async function protoMode(o) {
  const prep = async b => { await b.ev(AB.PAGE_HELPERS); await b.ev(PG_HIDE_ANNO, SKIP); };
  const L = toTarget(o.local), R = bust(toTarget(o.remote), o.bust);
  const [bl, br] = await Promise.all([openSide('本地', L, o, null, prep), openSide('线上', R, o, null, prep)]);
  try {
    const [wl, wr] = await Promise.all([walkSide('本地', bl, o), walkSide('线上', br, o)]);
    REPORT = [];
    rep(`════ 原型核对结果 ════`);
    rep(`本地：${o.local}`); rep(`线上：${o.remote}`);
    const ml = new Set(wl.menus.map(m => m.id)), mr = new Set(wr.menus.map(m => m.id));
    const onlyML = [...ml].filter(x => !mr.has(x)), onlyMR = [...mr].filter(x => !ml.has(x));
    rep(`菜单：本地 ${ml.size} 个，线上 ${mr.size} 个${onlyML.length ? `；只在本地：${onlyML.join('、')}` : ''}${onlyMR.length ? `；只在线上：${onlyMR.join('、')}` : ''}`);
    rep(`状态：本地 ${wl.states.size} 个，线上 ${wr.states.size} 个`);
    let same = 0, hovTotal = 0; const bad = [], onlyL = [], onlyR = [];
    for (const [k, a] of wl.states) {
      const c = wr.states.get(k);
      if (!c) { onlyL.push(a); continue; }
      const issues = [];
      if (a.err || c.err) issues.push({ what: '取文字出错', local: a.err || '', remote: c.err || '' });
      if (a.lines.join('\n') !== c.lines.join('\n')) { const d = diffHunks(a.lines, c.lines); d.hunks.forEach((h, i) => issues.push({ what: `页面文字（第 ${i + 1}/${d.total} 处）`, ...h })); }
      const hk = new Set([...a.hov.keys(), ...c.hov.keys()]); hovTotal += hk.size;
      for (const h of hk) {
        const x = a.hov.get(h), y = c.hov.get(h);
        if (x === y) continue;
        if (x == null || y == null) { issues.push({ what: `悬停浮层【${h}】只在${x == null ? '线上' : '本地'}有`, local: x || '（无）', remote: y || '（无）' }); continue; }
        const d = diffHunks(x.split('⏎'), y.split('⏎'), 40, 2); d.hunks.forEach(hh => issues.push({ what: `悬停浮层【${h}】`, ...hh }));
      }
      if (issues.length) bad.push({ a, issues }); else same++;
    }
    for (const [k, c] of wr.states) if (!wl.states.has(k)) onlyR.push(c);
    rep(`一致的状态：${same} 个（含悬停浮层和下拉菜单 ${hovTotal} 处）`);
    rep(`不一致的状态：${bad.length} 个；只在本地出现：${onlyL.length} 个；只在线上出现：${onlyR.length} 个`);
    // 截图：不一致和只在一边的状态，两边各截一张
    const toShot = [...bad.map(x => x.a), ...onlyL, ...onlyR].slice(0, o.maxShots);
    const shots = new Map();
    if (toShot.length) {
      log(`给 ${toShot.length} 个有问题的状态截图…`);
      toShot.sort((x, y) => (x.st.flagsOn ? 1 : 0) - (y.st.flagsOn ? 1 : 0));
      for (const b of [bl, br]) try { await b.reload(); } catch (_) {}   // 开关全开过的页面要重开才能回到默认开关
      let n = 0;
      for (const s of toShot) {
        n++; const pair = [];
        for (const [nm, b, has] of [['本地', bl, wl.states.has(s.key)], ['线上', br, wr.states.has(s.key)]]) {
          if (!has) continue;
          try { await revisit(b, s.st); const f = await shot(b, path.join(o.out, `${String(n).padStart(2, '0')}-${nm}.jpg`)); if (f) pair.push(f); } catch (e) { log(`  截图失败（${nm}）：${e.message}`); }
        }
        shots.set(s.key, pair);
      }
    }
    let i = 0;
    for (const { a, issues } of bad) {
      rep(`\n[不一致 ${++i}] ${a.name}`);
      for (const it of issues) { rep(`  · ${it.what}`); rep(`    本地：${it.local}`); rep(`    线上：${it.remote}`); }
      if (shots.get(a.key)) rep(`  截图：${shots.get(a.key).join('  ')}`);
    }
    for (const [lab, arr] of [['只在本地出现', onlyL], ['只在线上出现', onlyR]]) for (const s of arr) rep(`[${lab}] ${s.name}${shots.get(s.key) ? '  截图：' + shots.get(s.key).join('  ') : ''}`);
    rep(`\n首页对照截图：${path.join(o.out, '00-本地.jpg')}  ${path.join(o.out, '00-线上.jpg')}`);
    const ok = !bad.length && !onlyL.length && !onlyR.length && !onlyML.length && !onlyMR.length && wl.states.size > 0;
    rep(ok ? `全部一致：${same} 个状态，用时 ${secs()}。` : `有差异，不许说“已推送、线上一致”。用时 ${secs()}。`);
    return ok;
  } finally { await bl.close(); await br.close(); }
}

/* ───── PRD ───── */
const PRD_READY = () => document.readyState === 'complete' && !!document.querySelector('main');
const PRD_EXTRACT = async function () {
  const W = t => new Promise(z => setTimeout(z, t));
  /* 等流程图全部画完再取字（11-18：线上 mermaid 脚本是延后注入的，3 秒时页面里还是 code.language-mermaid 原始代码、没有 pre.mermaid，
     旧写法对空集合直接放行，取到的是原始代码，33 节流程图误报不一致；改为：只要还有未渲染的流程图源码就继续等，最多 90 秒） */
  const rawLeft = () => [...document.querySelectorAll('pre.mermaid, .mermaid, code.language-mermaid')].filter(p => !p.querySelector('svg') && !p.getAttribute('data-processed') && /^\s*(flowchart|graph|sequenceDiagram|stateDiagram)/.test(p.textContent)).length;
  for (let i = 0; i < 450; i++) { if (rawLeft() === 0) break; await W(200); }
  const main = document.querySelector('main') || document.body;
  const H = [...main.querySelectorAll('h1,h2,h3,h4,h5,h6,.hx')];
  const txt = frag => {
    frag.querySelectorAll('style,script').forEach(x => x.remove());
    frag.querySelectorAll('td,th').forEach(x => x.append(' | '));
    frag.querySelectorAll('p,div,li,tr,pre,table,br,h1,h2,h3,h4,h5,h6,blockquote,dt,dd').forEach(x => x.append('\n'));
    return frag.textContent;
  };
  const out = [];
  for (let i = -1; i < H.length; i++) {
    const r = document.createRange();
    if (i < 0) r.setStart(main, 0); else r.setStartAfter(H[i]);
    if (i + 1 < H.length) r.setEndBefore(H[i + 1]); else r.setEnd(main, main.childNodes.length);
    const frag = r.cloneContents();
    const imgs = [...frag.querySelectorAll('img')].map(im => new URL(im.getAttribute('src'), document.baseURI).href);
    const mer = frag.querySelectorAll('pre.mermaid').length;
    out.push({ title: i < 0 ? '（第一个标题之前）' : H[i].textContent.replace(/\s+/g, ' ').trim(), text: txt(frag), imgs, mer });
  }
  return out;
};

function fetchBuf(u, timeoutMs, hops = 0) {
  return new Promise((res, rej) => {
    if (hops > 10) return rej(new Error('重定向次数过多'));
    const mod = u.startsWith('https:') ? https : http;
    const req = mod.get(u, { headers: { 'User-Agent': 'verify-render-sync', 'Cache-Control': 'no-cache', 'Accept-Encoding': 'identity' } }, r => {
      if ([301, 302, 303, 307, 308].includes(r.statusCode) && r.headers.location) { r.resume(); return fetchBuf(new URL(r.headers.location, u).href, timeoutMs, hops + 1).then(res, rej); }
      if (r.statusCode !== 200) { r.resume(); return rej(new Error('HTTP ' + r.statusCode)); }
      const h = crypto.createHash('sha256'); let n = 0;
      r.on('data', d => { h.update(d); n += d.length; }); r.on('end', () => res({ hash: h.digest('hex'), size: n })); r.on('error', rej);
    });
    req.setTimeout(timeoutMs, () => req.destroy(new Error('超时')));
    req.on('error', rej);
  });
}
async function hashOf(u, o) {
  if (/^file:/i.test(u)) { const p = fileURLToPath(u.split('?')[0]); if (!fs.existsSync(p)) throw new Error('本地缺失 ' + p); const b = fs.readFileSync(p); return { hash: crypto.createHash('sha256').update(b).digest('hex'), size: b.length }; }
  let last;
  for (let k = 0; k <= o.retries; k++) { try { return await fetchBuf(bust(u.split('?')[0], o.bust), 120000); } catch (e) { last = e; await sleep(2000 * (k + 1)); } }
  throw last;
}

async function prdMode(o) {
  let localHtml = o.local;
  if (/\.md$/i.test(o.local)) {
    const dir = path.join(require('./_tmp-sandbox').sandboxDir(), 'prd-local');
    log(`[本地] 用 publish-prd-html.js 把 md 生成网页（临时目录，用完自动删）…`);
    try { execFileSync(process.execPath, [path.join(__dirname, '../../prd/publish-prd-html.js'), o.local, dir], { stdio: 'inherit' }); }
    catch (e) { if (e.status !== 2) throw new Error('生成本地网页失败：' + e.message); log('[本地] 有找不到的图片（见上），继续核对'); }
    localHtml = path.join(dir, 'index.html');
  }
  const L = toTarget(localHtml), R = bust(toTarget(o.remote), o.bust);
  const [bl, br] = await Promise.all([openSide('本地', L, o, PRD_READY), openSide('线上', R, o, PRD_READY)]);
  let sl, sr;
  try {
    [sl, sr] = await Promise.all([bl.ev(PRD_EXTRACT, null, 120000), br.ev(PRD_EXTRACT, null, 120000)]);
    await shot(bl, path.join(o.out, '00-本地.jpg')); await shot(br, path.join(o.out, '00-线上.jpg'));
  } finally { await bl.close(); await br.close(); }
  REPORT = [];
  rep(`════ PRD 核对结果 ════`);
  rep(`本地：${o.local}${localHtml !== o.local ? `（生成的网页：${localHtml}）` : ''}`); rep(`线上：${o.remote}`);
  const keyed = arr => { const m = new Map(), occ = {}; for (const s of arr) { occ[s.title] = (occ[s.title] || 0) + 1; m.set(s.title + (occ[s.title] > 1 ? '#' + occ[s.title] : ''), s); } return m; };
  const ml = keyed(sl), mr = keyed(sr);
  const nImgL = sl.reduce((a, s) => a + s.imgs.length, 0), nImgR = sr.reduce((a, s) => a + s.imgs.length, 0);
  rep(`章节：本地 ${ml.size} 节、图片 ${nImgL} 张；线上 ${mr.size} 节、图片 ${nImgR} 张`);
  // 图片哈希（去重后下载；线上并发 6 个）
  const urls = new Set(); for (const m of [ml, mr]) for (const s of m.values()) s.imgs.forEach(u => urls.add(u));
  const H = new Map(); const list = [...urls]; let done = 0;
  log(`比对图片内容：${list.length} 个文件…`);
  const worker = async () => { while (list.length) { const u = list.shift(); try { H.set(u, await hashOf(u, o)); } catch (e) { H.set(u, { err: e.message }); } if (++done % 100 === 0 || done === urls.size) log(`  图片 ${done}/${urls.size}，${secs()}`); } };
  await Promise.all(Array.from({ length: 6 }, worker));
  let same = 0; const bad = [], onlyL = [], onlyR = [];
  for (const [k, a] of ml) {
    const c = mr.get(k); if (!c) { onlyL.push(k); continue; }
    const issues = [];
    const A = normText(a.text), B = normText(c.text);
    if (A.join('\n') !== B.join('\n')) { const d = diffHunks(A, B); d.hunks.forEach((h, i) => issues.push({ what: `文字（第 ${i + 1}/${d.total} 处）`, ...h })); }
    if (a.imgs.length !== c.imgs.length) issues.push({ what: '图片数不同', local: a.imgs.length + ' 张', remote: c.imgs.length + ' 张' });
    if (a.mer !== c.mer) issues.push({ what: '流程图数不同', local: a.mer + ' 个', remote: c.mer + ' 个' });
    // 图片按内容（sha256）对齐：中间插了一张时，后面的不会全被误报成“内容不同”
    const ia = a.imgs.map(u => H.get(u) || { err: '没下载' }), ib = c.imgs.map(u => H.get(u) || { err: '没下载' });
    ia.forEach((x, i) => x.err && issues.push({ what: `本地第 ${i + 1} 张图片没核成`, local: x.err + ' ' + a.imgs[i], remote: '' }));
    ib.forEach((y, i) => y.err && issues.push({ what: `线上第 ${i + 1} 张图片没核成`, local: '', remote: y.err + ' ' + c.imgs[i] }));
    if (ia.map(x => x.hash).join() !== ib.map(y => y.hash).join()) {
      const la = [], lb = [];
      // 逐张找内容相同的图片，没找到的列出文件和哈希
      const ha = ia.map(x => x.hash), hb = ib.map(y => y.hash); const used = new Set();
      ha.forEach((h, i) => { const j = hb.findIndex((v, jj) => v === h && !used.has(jj)); if (j >= 0) used.add(j); else la.push(`第 ${i + 1} 张 ${a.imgs[i]}（${ia[i].size} 字节 ${String(h).slice(0, 12)}…）`); });
      hb.forEach((h, j) => { if (!used.has(j)) lb.push(`第 ${j + 1} 张 ${c.imgs[j]}（${ib[j].size} 字节 ${String(h).slice(0, 12)}…）`); });
      if (la.length || lb.length) issues.push({ what: `图片内容对不上（本地 ${la.length} 张在线上找不到，线上 ${lb.length} 张在本地找不到）`, local: la.join('；') || '（无）', remote: lb.join('；') || '（无）' });
      else issues.push({ what: '图片顺序不同', local: a.imgs.join('；'), remote: c.imgs.join('；') });
    }
    if (issues.length) bad.push({ k, issues }); else same++;
  }
  for (const k of mr.keys()) if (!ml.has(k)) onlyR.push(k);
  rep(`一致的章节：${same} 节；不一致：${bad.length} 节；只在本地：${onlyL.length} 节；只在线上：${onlyR.length} 节`);
  let i = 0;
  for (const { k, issues } of bad) { rep(`\n[不一致 ${++i}] ${k}`); for (const it of issues) { rep(`  · ${it.what}`); rep(`    本地：${it.local}`); rep(`    线上：${it.remote}`); } }
  for (const k of onlyL) rep(`[只在本地] ${k}`);
  for (const k of onlyR) rep(`[只在线上] ${k}`);
  rep(`\n截图：${path.join(o.out, '00-本地.jpg')}  ${path.join(o.out, '00-线上.jpg')}`);
  const ok = !bad.length && !onlyL.length && !onlyR.length && ml.size > 0;
  rep(ok ? `全部一致：${same} 节、图片 ${nImgL} 张，用时 ${secs()}。` : `有差异，不许说“已推送、线上一致”。用时 ${secs()}。`);
  return ok;
}

(async () => {
  let o;
  try { o = parseArgs(process.argv.slice(2)); } catch (e) { console.error(e.message); process.exit(2); }
  if (o.help || !o.mode) {
    console.error('用法：node verify-render-sync.js --proto <本地原型.html> <线上网址> [选项]\n      node verify-render-sync.js --prd <本地 PRD.md 或 index.html> <线上 PRD 网址> [选项]\n选项：--out 目录  --load-timeout 秒  --retries 次  --timeout 分钟  --no-flags  --only 菜单id,…  --max-shots 张  --no-bust  --width 像素');
    process.exit(o.help ? 0 : 2);
  }
  if (!/^(https?|file):/i.test(o.local) && !fs.existsSync(o.local)) { console.error('本地文件不存在：' + o.local); process.exit(2); }
  if (!o.out) {
    const base = path.join(tmpRoot(), 'verify-render-sync');
    fs.mkdirSync(base, { recursive: true });
    for (const d of fs.readdirSync(base)) if (d.startsWith(o.mode + '-')) try { fs.rmSync(path.join(base, d), { recursive: true, force: true }); } catch (_) {}   // 同模式只留最近一次
    const ts = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15);
    o.out = path.join(base, o.mode + '-' + ts);
  }
  fs.mkdirSync(o.out, { recursive: true });
  const timer = setTimeout(() => { log(`超过总时限 ${o.timeout} 分钟，判不通过。`); try { fs.writeFileSync(path.join(o.out, 'report.txt'), REPORT.join('\n') + `\n超过总时限 ${o.timeout} 分钟，判不通过。\n`); } catch (_) {} process.exit(1); }, o.timeout * 60000);
  timer.unref();
  let ok = false;
  try { ok = o.mode === 'proto' ? await protoMode(o) : await prdMode(o); }
  catch (e) { rep(`核对没做完：${e.message}`); ok = false; }
  fs.writeFileSync(path.join(o.out, 'report.txt'), REPORT.join('\n') + '\n');
  log(`报告：${path.join(o.out, 'report.txt')}`);
  process.exit(ok ? 0 : 1);
})();
