#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   keepalive.js · 让抓取用的调试 Chrome【活下去】
   ────────────────────────────────────────────────────────────────────────
   2026-10-28/29 建。抓 WMS/OMS 时反复被同一件事打断：浏览器莫名其妙就没了，
   每隔几分钟就要重登一次真系统，抓取根本做不连贯。查下来有两个原因，都不是偶然：

     ① launch.js 用 detached+unref 起 Chrome —— 在 AI 工具里，命令结束时
        **整棵进程树会被回收**，Chrome 跟着一起没。这条本会话早就查实过。
     ② deliver-gate 清理「僵尸浏览器」时，按 `--headless` 或
        `--user-data-dir=*(Temp|tmp)*` 匹配。我们的档案已挪出临时目录，
        但只要哪天有人把它放回去，就会被自家工具当僵尸杀掉。

   所以这里做三件事：
     · 守护进程常驻：每 5 秒探一次，发现调试端口不通就重新拉起 Chrome
     · 起的 Chrome 带 --rpa-keepalive 标记，清理规则一眼能认出「这是抓取用的，别杀」
     · 档案固定在临时目录之外（跟 _cdp.js / launch.js 同一个位置），登录态才能留住

   用法：
     node keepalive.js <port> [首页URL]        前台守护（Ctrl+C 退出）
     node keepalive.js <port> [URL] --once     只确保活着，不常驻

   配合：清理僵尸浏览器的地方请放行命令行含 --rpa-keepalive 的进程。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const path = require('path');
const os = require('os');
const fs = require('fs');
const { spawn } = require('child_process');

function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const c = process.platform === 'win32'
    ? [process.env['ProgramFiles'] + '\\Google\\Chrome\\Application\\chrome.exe',
       process.env['ProgramFiles(x86)'] + '\\Google\\Chrome\\Application\\chrome.exe',
       process.env['LOCALAPPDATA'] + '\\Google\\Chrome\\Application\\chrome.exe',
       process.env['ProgramFiles(x86)'] + '\\Microsoft\\Edge\\Application\\msedge.exe']
    : process.platform === 'darwin'
    ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']
    : ['/usr/bin/google-chrome', '/usr/bin/chromium'];
  return c.find(x => x && fs.existsSync(x)) || null;
}
/* 档案必须在临时目录【之外】，否则登录态会被清理工具连锅端（2026-10-28 踩过） */
function profileDir(port) {
  let base;
  try { base = path.join(path.dirname(require('../_shared/qa/_tmp-root').tmpRoot()), 'rpa-profiles'); }
  catch (_) { base = path.join(os.homedir(), '.proenga-rpa-profiles'); }
  return path.join(base, 'rpa-chrome-' + port);
}

async function alive(port) {
  try {
    const r = await fetch('http://127.0.0.1:' + port + '/json/list');
    if (!r.ok) return false;
    const a = await r.json();
    return Array.isArray(a) && a.some(t => t && t.type === 'page');
  } catch (_) { return false; }
}

function launch(port, url) {
  const chrome = findChrome();
  if (!chrome) { console.error('找不到 Chrome/Edge，请设 CHROME_PATH'); process.exit(2); }
  const prof = profileDir(port);
  fs.mkdirSync(prof, { recursive: true });
  /* --rpa-keepalive 只是个标记，Chrome 会忽略它；清理规则靠它认出「这是抓取用的」 */
  const ch = spawn(chrome, [
    '--remote-debugging-port=' + port,
    '--user-data-dir=' + prof,
    '--rpa-keepalive',
    '--no-first-run', '--no-default-browser-check',
    '--disable-backgrounding-occluded-windows',   /* 窗口被遮挡也别降频 */
    '--disable-renderer-backgrounding',           /* 后台标签页照常跑 —— 否则 visibilityState=hidden，
                                                     弹窗关不掉、键盘不落字，全是这个引起的 */
    '--disable-background-timer-throttling',
    url || 'about:blank'
  ], { detached: true, stdio: 'ignore' });
  ch.unref();
  return ch.pid;
}

(async () => {
  const port = +(process.argv[2] || 9222);
  const url = process.argv.find((a, i) => i > 2 && /^https?:/i.test(a)) || '';
  const once = process.argv.includes('--once');

  if (!(await alive(port))) {
    const pid = launch(port, url);
    console.log('已拉起调试 Chrome · 端口 ' + port + ' · PID ' + pid);
    for (let i = 0; i < 90; i++) { await new Promise(r => setTimeout(r, 1000)); if (await alive(port)) break; }
  }
  console.log(await alive(port) ? '✅ 端口 ' + port + ' 可用' : '✗ 端口 ' + port + ' 还是不通');
  if (once) return;

  console.log('守护中：每 5 秒探一次，掉了自动拉起（Ctrl+C 退出）');
  let down = 0;
  for (;;) {
    await new Promise(r => setTimeout(r, 5000));
    if (await alive(port)) { down = 0; continue; }
    down++;
    console.log('[' + new Date().toLocaleTimeString() + '] 端口不通（第 ' + down + ' 次）→ 重新拉起');
    launch(port, url);
    for (let i = 0; i < 60; i++) { await new Promise(r => setTimeout(r, 1000)); if (await alive(port)) break; }
  }
})();
