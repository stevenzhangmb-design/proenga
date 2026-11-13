#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   RPA·launch.js —— 自启动系统 Chrome（调试模式常开·会话持久·独立进程）
   复刻真系统第 1 步：把浏览器拉起来，开到目标登录/首页。
   用法：node launch.js <url> [port=9222] [profileDir]
   之后用 shot.js / act.js / extract.js / formextract.js 连上来驱动（都不关这个 Chrome）。
   跨平台找 Chrome；找不到可设环境变量 CHROME_PATH。零依赖。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const { spawn, execSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const url = process.argv[2] || 'about:blank';
const port = process.argv[3] || '9222';
/* 浏览器档案（含登录态）要长期保留，不进用完即删的沙盒，只放到配置的临时根（本机 = D 盘）；单拷 rpa 时退回系统临时目录 */
const tmpBase = (() => { try { return require('../_shared/qa/_tmp-root').tmpRoot(); } catch (_) { return os.tmpdir(); } })();
/* §2026-10-28 登录档案放【临时根的同级 rpa-profiles】，不放临时沙盒本身：
   沙盒路径含 temp，会被 deliver-gate 的僵尸浏览器清理按 (Temp|tmp) 匹配误杀——
   2026-10-28 抓 WMS 时就是这样被反复杀掉、登录态永远保不住。登录档案是要持久的资产。 */
const profileBase = path.join(path.dirname(tmpBase), 'rpa-profiles');
const profile = process.argv[4] || path.join(profileBase, 'rpa-chrome-' + port);

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const cands = process.platform === 'win32'
    ? [process.env['ProgramFiles'] + '\\Google\\Chrome\\Application\\chrome.exe',
       process.env['ProgramFiles(x86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
       process.env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe',
       process.env['ProgramFiles(x86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe']
    : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']
    : ['/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge'];
  return cands.find(c => c && fs.existsSync(c)) || null;
}

/* 「到底能不能用」的判断（2026-10-13 根治）
   旧写法只看 `fetch(/json/version)` 有没有抛错 —— 它在两种情况下会误判成"有 Chrome"：
     ① 返回了非 200（代理/其它程序占着这个端口）；② Chrome 刚起来、还没有任何页面目标。
   两种都会让它直接 exit(0) 不启动，后面 act.js / extract.js 全部报「连不上调试 Chrome」。
   实测事故（2026-10-13）：为此反复折返 5 次、零产出。
   现在要同时满足：version 返回 200 **且** /json/list 里真有一个 type==='page' 的目标。
   另外统一用 127.0.0.1（避开 localhost 解析到 IPv6 而 Chrome 只听 IPv4 的坑）。 */
const BASE = 'http://127.0.0.1:' + port;
async function usable() {
  try {
    const v = await fetch(BASE + '/json/version');
    if (!v.ok) return false;
    const l = await fetch(BASE + '/json/list');
    if (!l.ok) return false;
    const arr = await l.json();
    return Array.isArray(arr) && arr.some(t => t && t.type === 'page');
  } catch (_) { return false; }
}

(async () => {
  if (await usable()) { console.log('端口 ' + port + ' 已有可用的调试 Chrome·复用（如需换页用 act.js goto <url>）'); process.exit(0); }
  const chrome = findChrome();
  if (!chrome) { console.error('找不到 Chrome/Edge，请设 CHROME_PATH 环境变量'); process.exit(2); }
  const ch = spawn(chrome, ['--remote-debugging-port=' + port, '--user-data-dir=' + profile,
    '--no-first-run', '--no-default-browser-check', url], { detached: true, stdio: 'ignore' });
  ch.unref();
  /* 等到「真能用」为止。冷启动 + 全新 profile 实测可超过 6 秒，旧的 12 秒预算偏紧 → 放到 30 秒。
     注意：要等的是"有页面目标"，不是"端口有响应"——后者早几秒就通了，但那时连不上。 */
  for (let i = 0; i < 60; i++) {
    await new Promise(z => setTimeout(z, 500));
    if (await usable()) { console.log('✅ Chrome 已启动·调试端口 ' + port + '·已开到 ' + url); process.exit(0); }
  }
  let hint = '端口没有响应';
  try { const v = await fetch(BASE + '/json/version'); hint = v.ok ? '端口通了但一直没有页面目标（profile 可能损坏，换一个：node launch.js <url> ' + port + ' <新profile目录>）' : '端口返回 ' + v.status + '（可能被别的程序占着）'; } catch (_) {}
  console.error('启动了 Chrome 但 ' + port + ' 不可用 —— ' + hint); process.exit(1);
})();
