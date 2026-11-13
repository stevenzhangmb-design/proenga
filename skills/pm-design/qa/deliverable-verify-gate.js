#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   交付件自检闸 · deliverable-verify-gate.js · 2026-09-16
   ────────────────────────────────────────────────────────────────────────
   根治「改了源/骨架，只验 _bld.html 预览、没重建用户实际打开的离线交付件，
   就说做完了」事故。约束标准 = "打开用户实际给的那个文件，逐页看"。
   本闸：① 新旧检查——交付件比 源project-data / 骨架标准件 旧 = 红(=没重建)；
        ② 机器【逐页】打开交付件渲染——每页有 JS 报错 / 没渲染出内容 = 红。
   用法：node deliverable-verify-gate.js <交付件.html> [project-data.json] [--pages a,b,c] [--jobs N]
        传 project-data 才做新旧检查(读它的 _deliverable 校验路径一致)。
        --pages 只验这几页（迭代期提速·2026-09-16：37 页全验要 29 秒，占重建总耗时的 7 成）；
        **不传就是全量**——默认永远安全；增量跑完会明确标注"未全量"，交付前必须再全量跑一次。
        --jobs N 并行进程数（默认自动最多 4·每页仍真实冷加载，语义不变）；--jobs 1 退回串行。
   红了 exit 1 —— 禁说"做完了"。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const { spawn, execFileSync } = require('child_process');
const { findChrome } = require('./_gate-env');
const CHROME = process.env.CHROME_PATH || findChrome();
const sleep = ms => new Promise(z => setTimeout(z, ms));

/* §2026-11-13 端口不再写死（根治后台自检一直假红）：
   以前每片固定 9760+分片×2（Chrome 调试口再 +1000），端口一被残留进程或另一个同时在跑的自检占住，
   listen 抛 EADDRINUSE、分片 0.6 秒就崩，整份报告 FAIL（11-12 的残留进程占住 9760～9766 后，每次都红）。
   现在：本地服务 listen(0) 由系统分配空闲端口（被占重试一次）；Chrome 用 --remote-debugging-port=0，
   从它用户目录里的 DevToolsActivePort 读实际端口（起不来重启一次）。
   verify-gate-health-gate.js 静态卡死，禁改回写死端口。 */
const MARK = '--dv-verify-gate-owned';          // 本工具起的 Chrome 都带这个标记，清残留时只认它
const STALE_MIN = Math.max(1, +process.env.DV_STALE_MIN || 20);   // 超过这么久还没结束的本工具进程 = 残留
function listenFree(server) {
  return new Promise((res, rej) => {
    const attempt = left => {
      const onErr = e => { if (e.code === 'EADDRINUSE' && left > 0) setTimeout(() => attempt(left - 1), 200); else rej(e); };
      server.once('error', onErr);
      server.listen(0, '127.0.0.1', () => { server.removeListener('error', onErr); res(server.address().port); });
    };
    attempt(1);
  });
}
async function launchChrome(ud) {
  for (let t = 0; t < 2; t++) {                 // 起不来重启一次
    const portFile = path.join(ud, 'DevToolsActivePort');
    try { fs.rmSync(portFile, { force: true }); } catch (_) {}
    const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--window-size=1680,1050',
      '--remote-debugging-port=0', '--user-data-dir=' + ud, MARK, 'about:blank']);
    ch.on('error', () => {});
    for (let i = 0; i < 75; i++) {
      await sleep(200);
      let dport = 0;
      try { dport = parseInt(fs.readFileSync(portFile, 'utf8').split(/\r?\n/)[0], 10) || 0; } catch (_) {}
      if (!dport) continue;
      try {
        const tab = (await (await fetch(`http://127.0.0.1:${dport}/json/list`)).json()).find(x => x.type === 'page');
        if (tab) return { ch, tab };
      } catch (_) {}
    }
    await new Promise(r => { const tm = setTimeout(r, 3000); ch.once('exit', () => { clearTimeout(tm); r(); }); try { ch.kill(); } catch (_) { r(); } });
  }
  throw new Error('Chrome 未就绪（已重试一次）');
}
/* 启动时只清【本工具自己】超时的残留：命令行含 deliverable-verify-gate.js 的 node、
   带 MARK 标记（或旧版 dv-xxxxxx 用户目录）的 Chrome，且已活过 STALE_MIN 分钟。别的工具的 Chrome 一个不碰。 */
function reapStale() {
  const me = new Set([process.pid, process.ppid]);
  let rows = [];
  try {
    if (process.platform === 'win32') {
      const ps = "Get-CimInstance Win32_Process -Filter \"Name='node.exe' or Name='chrome.exe'\" | ForEach-Object { '' + $_.ProcessId + '|' + [int]((Get-Date) - $_.CreationDate).TotalSeconds + '|' + $_.CommandLine }";
      rows = execFileSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { encoding: 'utf8', timeout: 20000, windowsHide: true })
        .split(/\r?\n/).map(l => { const m = /^(\d+)\|(-?\d+)\|(.*)$/.exec(l.trim()); return m && { pid: +m[1], age: +m[2], cmd: m[3] }; }).filter(Boolean);
    } else {
      rows = execFileSync('ps', ['-eo', 'pid=,etimes=,args='], { encoding: 'utf8', timeout: 10000 })
        .split('\n').map(l => { const m = /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l); return m && { pid: +m[1], age: +m[2], cmd: m[3] }; }).filter(Boolean);
    }
  } catch (_) { return; }
  const ours = r => (/deliverable-verify-gate\.js/.test(r.cmd) && /node/i.test(r.cmd))
    || r.cmd.includes(MARK) || /[\\/]dv-[A-Za-z0-9]{6}[\\/]ud(\s|"|$)/.test(r.cmd);
  const stale = rows.filter(r => !me.has(r.pid) && r.age > STALE_MIN * 60 && ours(r));
  for (const r of stale) {
    try {
      if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(r.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
      else process.kill(r.pid, 'SIGKILL');
    } catch (_) {}
  }
  if (stale.length) console.log('  🧹 清掉本工具的残留进程 ' + stale.length + ' 个（超过 ' + STALE_MIN + ' 分钟没结束）：pid ' + stale.map(r => r.pid).join(', '));
}

const ARGV = process.argv.slice(2);
const pagesArgI = ARGV.findIndex(a => a === '--pages' || a.startsWith('--pages='));
let ONLY = null;
if (pagesArgI >= 0) {
  const raw = ARGV[pagesArgI].includes('=') ? ARGV[pagesArgI].split('=')[1] : ARGV[pagesArgI + 1];
  ONLY = String(raw || '').split(',').map(s => s.trim()).filter(Boolean);
  ARGV.splice(pagesArgI, ARGV[pagesArgI].includes('=') ? 1 : 2);
}
/* §2026-10-13 并行化：全量 64 页 × 0.72s = 46s。每页成本没变过（09-16 是 0.78s/页），
   总时长是页数从 37 涨到 64 顶上去的。瓶颈就是「每页重新加载整份 14.7MB 交付件」这件事本身。
   不弱化验证语义（每页仍是真实冷加载·仍是独立浏览器），只把页分成 N 片、各自一个进程并行跑。
     --jobs N      并行进程数（默认自动；--jobs 1 = 退回串行）
     --shard i/N   内部用：子进程只验下标 idx%N===i 的那些页 */
function takeFlag(name) {
  const i = ARGV.findIndex(a => a === '--' + name || a.startsWith('--' + name + '='));
  if (i < 0) return null;
  const eq = ARGV[i].includes('=');
  const v = eq ? ARGV[i].split('=')[1] : ARGV[i + 1];
  ARGV.splice(i, eq ? 1 : 2);
  return String(v || '');
}
const JOBS_RAW = takeFlag('jobs');
const SHARD_RAW = takeFlag('shard');
const SHARD = SHARD_RAW && /^\d+\/\d+$/.test(SHARD_RAW)
  ? { i: +SHARD_RAW.split('/')[0], n: +SHARD_RAW.split('/')[1] } : null;
const CPUS = os.cpus().length;
const autoJobs = (ONLY && ONLY.length) ? Math.min(4, Math.max(1, Math.ceil(ONLY.length / 4))) : 4;
const JOBS = SHARD ? 1
  : (JOBS_RAW ? Math.max(1, Math.min(8, parseInt(JOBS_RAW, 10) || 1))
              : Math.max(1, Math.min(autoJobs, CPUS - 1)));
const PARENT = !SHARD && JOBS > 1;      // 父进程只负责分片 + 汇总，自己不开浏览器

const DELIV = ARGV[0];
const PDATA = ARGV[1];
if (!DELIV) { console.log('用法: node deliverable-verify-gate.js <交付件.html> [project-data.json]'); process.exit(2); }
if (!fs.existsSync(DELIV)) { console.log('❌ 交付件不存在: ' + DELIV + ' —— 先跑 rebuild-deliverable.ps1 重建'); process.exit(1); }

if (!SHARD) {
  reapStale();
  console.log('\n════════ 交付件自检闸 deliverable-verify-gate ════════');
  console.log('  标准 = 打开用户实际给的那个文件·逐页看');
  console.log('  交付件: ' + DELIV);
}

let red = 0;
const delivMtime = fs.statSync(DELIV).mtimeMs;

/* ── ① 新旧检查：交付件必须比 源 + 标准件 都新（否则=没重建）── */
if (!SHARD) {                       // 分片子进程跳过（父进程已查过，免得打印 N 遍）
const comp = [];
const skelDir = path.join(__dirname, '..', 'components');
for (const f of ['prototype-skeleton.html', 'annotation-layer.html', 'host-shell.html', 'page-renderer.html']) {
  const p = path.join(skelDir, f); if (fs.existsSync(p)) comp.push(p);
}
if (PDATA && fs.existsSync(PDATA)) {
  comp.push(PDATA);
  try {
    const pd = JSON.parse(fs.readFileSync(PDATA, 'utf8'));
    if (pd._deliverable && path.resolve(pd._deliverable) !== path.resolve(DELIV)) {
      console.log('  ⚠ project-data 的 _deliverable 与传入交付件路径不一致：\n      _deliverable=' + pd._deliverable + '\n      传入=' + DELIV);
    }
    if (!pd._deliverable) { console.log('  ⚠ project-data 未声明 _deliverable（建议加，供 rebuild-deliverable.ps1 用）'); }
  } catch (_) {}
}
console.log('\n── ① 新旧检查（交付件是否比源/骨架新）──');
let stale = 0;
for (const f of comp) {
  const m = fs.statSync(f).mtimeMs;
  if (m > delivMtime + 1500) { stale++; console.log('    ✗ 交付件比【' + path.basename(f) + '】旧 —— 改过却没重建交付件'); }
}
if (stale) { red++; console.log('    ❌ 交付件过期：改了源/骨架但没重建 —— 跑 rebuild-deliverable.ps1'); }
else console.log('    ✓ 交付件比所有源/标准件都新（已重建）');
}

/* ── ①.5 分片并行（父进程）：把页分成 JOBS 片，各起一个子进程各开一个浏览器 ── */
if (PARENT) {
  const t0 = Date.now();
  console.log('\n── ② 逐页渲染（' + JOBS + ' 个进程并行·每页仍真实冷加载）──');
  const base = ARGV.slice();
  const run = i => new Promise(res => {
    const a = [__filename, ...base, '--shard', i + '/' + JOBS];
    if (ONLY && ONLY.length) a.push('--pages', ONLY.join(','));
    const p = spawn(process.execPath, a, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => err += d);
    p.on('close', c => res({ c, out, err }));
  });
  Promise.all(Array.from({ length: JOBS }, (_, i) => run(i))).then(rs => {
    rs.forEach((r, i) => {
      for (const line of r.out.split(/\r?\n/)) {
        const m = /^##RED (\d+)$/.exec(line.trim());
        if (m) { red += +m[1]; continue; }
        if (line.trim()) console.log(line);
      }
      if (r.err.trim()) console.log('    ⚠ 分片' + i + ' stderr: ' + r.err.trim().split(/\r?\n/)[0].slice(0, 160));
      /* §2026-11-10 盲区根治：以前只认退出码 2；分片因端口被残留进程占用（EADDRINUSE）直接崩、退出码 1、
         一页都没验，父进程却照样报 PASS（0.6 秒"验完"68 页）。现在分片只要不是正常结束（退出码非 0、
         或一条 ##RED 回报都没有）一律算红：没验到 ≠ 验过没问题。 */
      /* 分片正常跑完、有红页时退出码是 1 并带 ##RED N（N 条上面已计入），所以只按“没有 ##RED 回报”判崩 */
      if (!/##RED \d+/.test(r.out)) { red++; console.log('    ✗ 分片' + i + ' 没有正常跑完（退出码 ' + r.c + '），这一片的页等于没验 —— 判红'); }
    });
    console.log('──────────────────────────────────');
    console.log('  （并行 ' + JOBS + ' 进程·耗时 ' + ((Date.now() - t0) / 1000).toFixed(1) + 's）');
    if (red) { console.log('  ❌ 交付件自检未过（' + red + ' 项）—— 禁说"做完了"，先重建/修到全绿再在【交付件本身】复验'); process.exit(1); }
    if (ONLY) {
      console.log('  ⚠️ 增量自检通过（只验了 ' + ONLY.join(', ') + '）—— **这不等于"做完了"**：');
      console.log('     交付给用户前必须不带 --pages 再跑一次全量，确认没改坏别的页。');
      process.exit(0);
    }
    console.log('  ✅ 交付件自检 PASS（已重建·逐页渲染有内容·无报错）—— 这才叫"做完了"');
    process.exit(0);
  }).catch(e => { console.error('并行汇总异常:', e.message); process.exit(2); });
}

/* ── ② 逐页渲染检查（串行 / 或分片子进程）── */
if (!PARENT) (async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dv-'));
  const local = path.join(dir, 'deliv.html');
  fs.copyFileSync(DELIV, local);
  const server = http.createServer((rq, rs) => {
    const f = path.join(dir, decodeURIComponent(rq.url.split('?')[0]));
    fs.readFile(f, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); rs.end(d); });
  });
  const ud = path.join(dir, 'ud');
  let ch = null;
  /* 自身看门狗：单个进程最多跑 STALE_MIN 分钟，超时关浏览器自行退出，不再留下卡死进程占端口/占资源 */
  const wd = setTimeout(() => { console.log('    ✗ 自检超时（' + STALE_MIN + ' 分钟）自行退出'); try { ch && ch.kill(); } catch (_) {} process.exit(2); }, STALE_MIN * 60000);
  wd.unref();
  try {
    const port = await listenFree(server);          // 系统分配空闲端口，不写死
    /* §2026-11-13 浏览器中途被杀（例如别的工具清僵尸 Chrome）时，以前 send 永远等不到回包、分片一直卡着不退。
       现在：连接断开立刻让所有等待中的调用失败；单个调用 30 秒没回包也算失败；
       失败后重开浏览器、重验当前这一页（最多重开 2 次），仍不行才报明原因退出。 */
    let ws = null, id = 0, pend = {}, errors = [], wsClosed = true, relaunches = 0;
    const failAll = why => { for (const k of Object.keys(pend)) { const f = pend[k]; delete pend[k]; f({ __err: why }); } };
    const send = (m, p = {}) => new Promise((r, j) => {
      if (wsClosed) return j(new Error('浏览器连接已断开，无法继续验'));
      const i = ++id;
      const tm = setTimeout(() => { if (pend[i]) { delete pend[i]; j(new Error('浏览器 30 秒没响应：' + m)); } }, 30000);
      pend[i] = d => { clearTimeout(tm); if (d && d.__err) j(new Error(d.__err)); else r(d); };
      ws.send(JSON.stringify({ id: i, method: m, params: p }));
    });
    const evalv = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
    const connect = async () => {
      if (ch) { const old = ch; ch = null; await new Promise(r => { const tm = setTimeout(r, 3000); old.once('exit', () => { clearTimeout(tm); r(); }); try { old.kill(); } catch (_) { r(); } }); }
      const L = await launchChrome(ud); ch = L.ch;  // Chrome 调试端口也由系统分配
      const sock = new WebSocket(L.tab.webSocketDebuggerUrl);
      await new Promise((r, j) => { sock.onopen = r; sock.onerror = j; });
      ws = sock; wsClosed = false;
      sock.onmessage = m => {
        const d = JSON.parse(m.data);
        if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
        if (d.method === 'Runtime.exceptionThrown') { errors.push('EXC: ' + (d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text || '').split('\n')[0]); }
        if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') { errors.push('ERR: ' + (d.params.args || []).map(a => a.value || a.description || '').join(' ').slice(0, 120)); }
      };
      sock.onclose = () => { if (ws !== sock) return; wsClosed = true; failAll('浏览器连接断开（Chrome 被关掉或被别的工具清理时误杀）'); };
      await send('Page.enable'); await send('Runtime.enable');
      await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false });
    };
    const LOST = /浏览器连接|没响应/;
    const withRelaunch = async fn => {
      for (;;) {
        try { return await fn(); } catch (e) {
          if (!LOST.test(e.message) || relaunches >= 2) throw e;
          relaunches++;
          console.log('    ⚠ 浏览器中途断开（' + e.message + '），重开浏览器重验这一页（第 ' + relaunches + ' 次）');
          await connect();
        }
      }
    };
    await connect();

    // 先加载一次拿页面清单
    /* §2026-11-13 盲区根治：机器忙时（多个自检同时跑）37MB 交付件 18 秒内没加载完，某个分片拿到空清单，
       一页没验却照样算通过（实测 68 页只验了 51 页还报 PASS）。现在最多等 45 秒、没拿到再重载一次，仍为空 = 红。 */
    let allPages = [];
    for (let t = 0; t < 2 && !allPages.length; t++) {
      allPages = await withRelaunch(async () => {
        await send('Page.navigate', { url: `http://127.0.0.1:${port}/deliv.html` });
        for (let i = 0; i < 300; i++) { await sleep(150); if (await evalv(`!!(window.PAGECFG&&Object.keys(window.PAGECFG).length)`) === true) break; }
        await sleep(600);
        return await evalv(`Object.keys(window.PAGECFG||{})`) || [];
      });
    }
    if (!allPages.length) { red++; console.log('    ✗ ' + (SHARD ? '分片' + SHARD.i + ' ' : '') + '没取到页面清单（PAGECFG 为空，重载一次仍为空），这一片的页等于没验 —— 判红'); }
    let pages = allPages;
    if (ONLY && ONLY.length) {
      /* 支持「页id」和「页id@面板」两种写法；对不上的页名要报出来，免得静默少验 */
      const want = ONLY.map(s => String(s).split('@')[0]);
      pages = allPages.filter(p => want.includes(p));
      const missing = want.filter(w => !allPages.includes(w));
      /* 只让 0 号分片报，否则同一个错会被 N 个分片各报一遍 */
      if (missing.length && (!SHARD || SHARD.i === 0)) { console.log('\n  ★ --pages 指定了不存在的页：' + missing.join(', ')); red++; }
    }
    if (!SHARD) console.log('\n── ② 逐页渲染（' + (ONLY ? '增量 ' + pages.length + ' / 共 ' + allPages.length : '全量 ' + pages.length) + ' 页）──');
    else pages = pages.filter((_, idx) => idx % SHARD.n === SHARD.i);   // 本分片只认自己这一片

    for (const pg of pages) {
      const info = await withRelaunch(async () => {
      errors = [];
      await send('Page.navigate', { url: `http://127.0.0.1:${port}/deliv.html?page=${encodeURIComponent(pg)}` });
      for (let i = 0; i < 100; i++) { await sleep(120); if (await evalv(`(document.querySelector('#app')||{}).childElementCount>0`) === true) break; }
      await sleep(500);
      /* §2026-09-24 加：页面上渲染出 [object Object] / undefined / NaN = 红。
         成因是某处把对象当字符串塞进了文本（如给三语文案对象多加了一个键，就不再被认成文案对象）——
         肉眼很容易漏，机器一抓一个准。 */
      return await evalv(`(()=>{const app=document.querySelector('#app');const pc=document.querySelector('.panel-content,main,.page-form,.list-wrap,.el-table,.page-body');
        const tx=(document.body.innerText||'');
        const junk=[]; if(/\\[object Object\\]/.test(tx)) junk.push('[object Object]');
        if(/\\bundefined\\b/.test(tx)) junk.push('undefined'); if(/\\bNaN\\b/.test(tx)) junk.push('NaN');
        return{mounted:!!(app&&app.childElementCount>0),content:!!(pc&&pc.textContent&&pc.textContent.replace(/\\s/g,'').length>10),len:tx.replace(/\\s/g,'').length,junk:junk};})()`) || {};
      });
      const errs = [...new Set(errors)].slice(0, 3);
      const junk = info.junk || [];
      const bad = !info.mounted || !info.content || errs.length || junk.length;
      if (bad) { red++; console.log('    ✗ ' + pg + (info.mounted ? '' : ' [未挂载]') + (info.content ? '' : ' [无内容]') + (junk.length ? ' [页面上印出了:' + junk.join(' / ') + ']' : '') + (errs.length ? ' [报错:' + errs.join(' | ') + ']' : '')); }
      else console.log('    ✓ ' + pg + ' （渲染 ok·有内容·无报错·文字' + info.len + '字）');
    }
    try { const s = ws; ws = null; s && s.close(); } catch (_) {}
  } finally { try { server.close(); } catch (_) {}
    /* 2026-10-27 修：原来 kill 完立刻删，Windows 上 Chrome 还占着用户目录 → rmSync 静默失败，
       每跑一次在 %TEMP% 留一个 ~390MB 的 dv-*（攒到 388 个、~150GB，把 C 盘写满）。先等 Chrome 真退出再删，删不掉重试。 */
    await new Promise(r => { let done = false; const fin = () => { if (!done) { done = true; r(); } }; if (!ch) return fin(); try { ch.once('exit', fin); ch.kill(); } catch (_) { fin(); } setTimeout(fin, 5000); });
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 }); } catch (e) { console.log('  ⚠ 临时目录没删掉：' + dir + '（' + e.message + '）'); } }

  /* 分片子进程：只把红的条数回给父进程，摘要由父进程统一打 */
  if (SHARD) { console.log('##RED ' + red); process.exit(red ? 1 : 0); }

  console.log('──────────────────────────────────');
  if (red) { console.log('  ❌ 交付件自检未过（' + red + ' 项）—— 禁说"做完了"，先重建/修到全绿再在【交付件本身】复验'); process.exit(1); }
  if (ONLY) {
    console.log('  ⚠️ 增量自检通过（只验了 ' + ONLY.join(', ') + '）—— **这不等于"做完了"**：');
    console.log('     交付给用户前必须不带 --pages 再跑一次全量，确认没改坏别的页。');
    process.exit(0);
  }
  console.log('  ✅ 交付件自检 PASS（已重建·逐页渲染有内容·无报错）—— 这才叫"做完了"');
  process.exit(0);
})().catch(e => { console.error('闸异常:', e.message); process.exit(2); });
