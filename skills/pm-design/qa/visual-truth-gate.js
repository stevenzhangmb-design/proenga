#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   真机事实快照闸 · visual-truth-gate.js · 随包·不碰真数据
   ────────────────────────────────────────────────────────────────────────
   【为什么有这道闸】
   2026-07-10 一天之内"闸绿但东西是坏的"发生了 3 次，病根同一个：
     **闸断言的是「代码里写了没」，不是「用户看到的对不对」。**
       · 分页 page-sizes 配置写了 ✓ → 但 layout 含 sizes 却没绑 v-model，
         EP 静默返回 null，**整条分页条根本没渲染**。㉜令牌闸判绿。
       · 币种检查扫的那段 HTML **根本不含业务数据**（数据注入在标注层之后）。㉝判绿。
       · ㉚导出闸自己注入假 picker，测的不是真东西。判绿。
   本闸换一个层级发问：**「浏览器里现在到底长什么样？」**
     装配 fixture → 真机 headless 打开 → 抽一份【结构化可见事实快照】→
     与 golden/*.json 逐字段比对，**任何 diff 判红**。

   期望值不再散在各闸的正则里，而是一份**人能读的快照文件**。
   规范/骨架一改 → 快照必然变 → 必须人工 review 后 `--update` 重建 golden。
   改不掉的 diff = 真漏了。

   用法：
     node visual-truth-gate.js            比对 golden，diff 即红
     node visual-truth-gate.js --update   重建 golden（**改完规范/骨架、人工确认后才跑**）
   退出码：0 全绿/跳过 · 1 有 diff 或 golden 缺失 · 2 环境错

   零依赖：node + 本机 Chrome + _gate-vendor 缓存（不联网、不碰 archive、不碰 anno-server）。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn, execFileSync } = require('child_process');
const { findChrome } = require('./_gate-env');
const { ensureVendor, localize, copyVendorInto } = require('./_gate-vendor');

const CHROME = process.env.CHROME_PATH || findChrome();
const FIX = path.join(__dirname, 'fixtures', 'vt');
const GOLD = path.join(__dirname, 'golden');
const UPDATE = process.argv.includes('--update');
const sleep = ms => new Promise(z => setTimeout(z, ms));

/* ── 页面内取快照：只取【用户能看见的事实】，不取实现细节 ──
   所有数值取整；不含时间戳/随机数 → 同输入必同快照。 */
const SNAPSHOT_FN = `(() => {
  const px = v => Math.round(parseFloat(v) || 0);
  const q  = s => document.querySelector(s);
  const qa = s => [...document.querySelectorAll(s)];
  const txt = e => (e ? e.innerText : '').replace(/\\s+/g, ' ').trim();
  const cs = (e, p) => e ? getComputedStyle(e).getPropertyValue(p).trim() : '';
  const root = getComputedStyle(document.documentElement);

  const table = q('.el-table');
  const pager = q('.el-pagination');
  const filterCard = q('.search-box');
  const headWrap = q('.gl-table .el-table__header-wrapper');
  const pagerBox = q('.pagination-container');
  const primaryBtn = qa('.search-box .el-button--primary')[0];

  return {
    // ── A. 组件到底渲染出来没有（存在性 ≠ 生效，这一栏专治"配置写了但没渲染"）
    渲染: {
      app挂载: !!q('#app .el-table'),
      侧栏: qa('.sidebar .el-menu-item').length,
      页签: qa('.pagetabs .el-tabs__item').length,
      筛选卡: !!filterCard,
      表格: !!table,
      分页条: qa('.el-pagination').length,
      分页每页下拉: qa('.el-pagination .el-select').length,
      语言切换器: qa('.langsw').length,
      标注开关: qa('.anno-sw .el-switch').length,
    },
    // ── B. 设计令牌真生效了没有（不是"文件里写了"，是 computed 出来的）
    令牌: {
      主色: root.getPropertyValue('--el-color-primary').trim(),
      警告色: root.getPropertyValue('--el-color-warning').trim(),
      主按钮背景: cs(primaryBtn, 'background-color'),
      页面最小宽: px(cs(q('#app'), 'min-width')),
      筛选卡背景: cs(filterCard, 'background-color'),
      表头吸顶: cs(headWrap, 'position'),
      分页吸底: cs(pagerBox, 'position'),
    },
    // ── C. 用户读到的文字（语言真切了没有）
    文案: {
      htmlLang: document.documentElement.lang,
      侧栏: qa('.sidebar .el-menu-item').map(txt),
      表头: qa('.el-table th .cell').map(txt),
      筛选label: qa('.search-box .el-form-item__label').map(txt),
      筛选按钮: qa('.search-box .el-button').map(txt),
      分页: txt(pagerBox),
      标注开关: txt(q('.anno-sw span')),
      首行数据: qa('.el-table tbody tr:first-child td .cell').map(txt),
    },
    // ── D. 排版没崩（label 换行 = 高度翻倍）
    排版: {
      筛选label: qa('.search-box .el-form-item__label').map(e => ({
        文本: txt(e), 宽: px(cs(e, 'width')), 高: px(cs(e, 'height')),
      })),
      输入框宽: qa('.search-box .el-input').map(e => px(cs(e, 'width'))),
    },
  };
})()`;

function deepDiff(a, b, p = '', out = []) {
  const A = a === undefined, B = b === undefined;
  if (A || B || typeof a !== typeof b || a === null || b === null || typeof a !== 'object') {
    if (JSON.stringify(a) !== JSON.stringify(b)) out.push({ path: p || '(root)', golden: a, actual: b });
    return out;
  }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) deepDiff(a[k], b[k], p ? p + '.' + k : k, out);
  return out;
}

async function capture(htmlPath, dir, port, locales) {
  const dport = port + 1000;
  const server = http.createServer((rq, rs) => {
    const f = path.join(dir, decodeURIComponent(rq.url.split('?')[0]));
    fs.readFile(f, (e, d) => {
      if (e) { rs.writeHead(404); rs.end(); return; }
      rs.writeHead(200, { 'Content-Type': /\.html$/.test(f) ? 'text/html;charset=utf-8' : /\.css$/.test(f) ? 'text/css' : 'application/javascript' });
      rs.end(d);
    });
  }).listen(port);
  const ud = path.join(dir, 'ud');
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars',
    '--window-size=1680,1050', '--remote-debugging-port=' + dport, '--user-data-dir=' + ud, 'about:blank']);

  const shots = {}; const errs = [];
  try {
    let page = null;
    for (let i = 0; i < 60; i++) { try { page = (await (await fetch(`http://localhost:${dport}/json/list`)).json()).find(t => t.type === 'page'); if (page) break; } catch (_) {} await sleep(200); }
    if (!page) throw new Error('Chrome 未就绪');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = {};
    const NOISE = /favicon|localhost:3799|net::ERR|Failed to fetch/;
    ws.onmessage = m => {
      const d = JSON.parse(m.data);
      if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
      if (d.method === 'Runtime.exceptionThrown') {
        const t = d.params.exceptionDetails?.exception?.description || d.params.exceptionDetails?.text || '';
        if (!NOISE.test(t)) errs.push(t.slice(0, 120));
      }
    };
    const send = (m, p = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    const evalv = async (e, aw = false) => (await send('Runtime.evaluate', { expression: e, awaitPromise: aw, returnByValue: true })).result?.result?.value;

    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false });
    // 屏蔽 anno-server：本闸绝不触碰真 prd-data
    // GATE-FAKE-OK: 只拦截对真 anno-server(3799) 的网络写入，不替换任何被测组件行为；被测对象仍是真骨架真 EP。
    await send('Page.addScriptToEvaluateOnNewDocument', { source: `(function(){var of=window.fetch;window.fetch=function(u,o){try{var s=typeof u==='string'?u:(u&&u.url)||'';if(s.indexOf('localhost:3799')>=0)return Promise.reject(new Error('blocked'));}catch(e){}return of.call(this,u,o);};})();` });

    for (const lc of locales) {
      // 语言由 localStorage 决定 → 每个语言独立 reload，取一份快照
      await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.setItem('__proto_lang__',${JSON.stringify(lc)});}catch(e){}` });
      await send('Page.navigate', { url: `http://localhost:${port}/p.html` });
      for (let i = 0; i < 120; i++) { await sleep(150); if (await evalv(`!!document.querySelector('#app .el-table')`) === true) break; }
      await sleep(700);
      shots[lc] = await evalv(SNAPSHOT_FN);
    }
    ws.close();
  } finally {
    try { server.close(); } catch (_) {}
    try { ch.kill(); } catch (_) {}
  }
  return { shots, errs };
}

async function runOne(fixFile, port) {
  const name = path.basename(fixFile, '.json');
  const data = JSON.parse(fs.readFileSync(fixFile, 'utf8').replace(/^﻿/, ''));
  const locales = data.locales || ['zh'];

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vt-'));
  const out = path.join(dir, 'p.html');
  execFileSync('node', [path.join(__dirname, 'assemble-prototype.js'), fixFile, out], { stdio: 'pipe' });
  fs.writeFileSync(out, localize(fs.readFileSync(out, 'utf8')), 'utf8');
  copyVendorInto(dir);

  const { shots, errs } = await capture(out, dir, port, locales);
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}

  const actual = { locales, shots, jsErrors: errs };
  const goldFile = path.join(GOLD, `vt-${name}.json`);

  if (UPDATE) {
    fs.mkdirSync(GOLD, { recursive: true });
    fs.writeFileSync(goldFile, JSON.stringify(actual, null, 2) + '\n', 'utf8');
    console.log(`  ⟳ ${name} — golden 已重建（${Object.keys(shots).join('/')}）`);
    return true;
  }

  if (!fs.existsSync(goldFile)) {
    console.log(`  ✘ ${name} — 缺 golden 基线：${path.relative(process.cwd(), goldFile)}`);
    console.log(`      人工确认当前渲染正确后，跑 node visual-truth-gate.js --update 建基线（禁自动静默建）`);
    return false;
  }
  const golden = JSON.parse(fs.readFileSync(goldFile, 'utf8'));
  const diffs = deepDiff(golden, actual);
  if (!diffs.length) { console.log(`  ✓ ${name} — 真机事实与基线逐字段一致（${locales.join('/')}）`); return true; }

  console.log(`  ✘ ${name} — ${diffs.length} 处与基线不符：`);
  diffs.slice(0, 20).forEach(d => console.log(`      · ${d.path}\n          基线: ${JSON.stringify(d.golden)}\n          实际: ${JSON.stringify(d.actual)}`));
  if (diffs.length > 20) console.log(`      … 另有 ${diffs.length - 20} 处`);
  return false;
}

(async () => {
  console.log('\n════════ 真机事实快照闸 visual-truth-gate ════════');
  console.log('  断言的是「浏览器里长什么样」，不是「代码里写了没」');
  if (!CHROME) { console.log('⊘ SKIP：未找到 Chrome/Edge'); process.exit(0); }
  const v = await ensureVendor();
  if (!v.ok) { console.log(`⊘ SKIP：vendor 缓存不全（缺 ${v.missing}，需联网首次下载）`); process.exit(0); }

  let fixtures = [];
  try { fixtures = fs.readdirSync(FIX).filter(f => f.endsWith('.json')).map(f => path.join(FIX, f)); } catch (_) {}
  if (!fixtures.length) { console.log('⊘ SKIP：fixtures/vt 下没有 fixture'); process.exit(0); }
  console.log('───────────────────────────────────────');

  let ok = true;
  for (let i = 0; i < fixtures.length; i++) ok = (await runOne(fixtures[i], 8960 + i * 3)) && ok;

  console.log('───────────────────────────────────────');
  if (UPDATE) { console.log('  golden 已重建 —— 请 git diff 逐行 review 后再提交'); process.exit(0); }
  console.log(ok ? '  真机事实快照：全绿 ✓' : '  真机事实快照：有 diff ✘ —— 用户看到的东西变了，禁交付');
  console.log('════════════════════════════════════════\n');
  process.exit(ok ? 0 : 1);
})();
