/* 临时目录沙盒 · _tmp-sandbox.js（2026-10-27 根治：检查工具残留把 C 盘 Temp 撑满约 150GB·1467 个目录）
   用法：工具文件顶部 require 一行即可，原有的 os.tmpdir() / mkdtempSync 写法一个字不用改。
     ① 本进程专属目录 <根>/run-<pid>-<随机>，并把 TEMP/TMP/TMPDIR 指过去
        → os.tmpdir()、它开的后台浏览器（Chrome 自己的 scoped_dir 等）全落进这里；
     ② 进程退出（含 Ctrl+C）整目录删掉；
     ③ 启动时顺手清掉【进程已不在】的旧 run-* 目录（被超时强杀、文件被浏览器锁住没删成的，下次兜底）。
   根目录见 _tmp-root.js（本机 = 仓库根 .proenga-tmp 里写的 D 盘路径）。
   铁律见 skills/_shared/fix-and-upstream-protocol.md「临时文件铁律」。 */
const fs = require('fs'), path = require('path');
const { tmpRoot } = require('./_tmp-root');

function alive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; }
}

function sweep(root) {
  let names = [];
  try { names = fs.readdirSync(root); } catch (_) { return; }
  for (const n of names) {
    const m = /^run-(\d+)-/.exec(n);
    if (!m || alive(+m[1])) continue;
    try { fs.rmSync(path.join(root, n), { recursive: true, force: true }); } catch (_) {}
  }
}

let dir = null;
function enter() {
  if (dir) return dir;
  const root = tmpRoot();
  process.env.PROENGA_TMP = root;                 // 子进程沿用同一个根
  sweep(root);
  dir = fs.mkdtempSync(path.join(root, 'run-' + process.pid + '-'));
  process.env.TEMP = process.env.TMP = process.env.TMPDIR = dir;
  const clean = () => { try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3, retryDelay: 200 }); } catch (_) {} };
  process.on('exit', clean);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
    try { process.once(sig, () => { clean(); process.exit(130); }); } catch (_) {}
  }
  return dir;
}

enter();
module.exports = { tmpRoot, sandboxDir: () => dir, sweep };
