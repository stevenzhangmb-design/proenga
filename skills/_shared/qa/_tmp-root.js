/* 临时目录根 · _tmp-root.js（取根·不删东西）
   根目录：环境变量 PROENGA_TMP > 仓库根 .proenga-tmp 文件第一行（本机配置·不进版本库）> 首次自动选盘。
   首次自动选盘（2026-10-27·别人装上也不落 C 盘）：Windows 上挑【非系统盘·本地固定硬盘·剩余空间最大】的盘，
   试写成功就用 <盘>:\proenga-temp，并把结果写进 .proenga-tmp —— 只检测一次，之后想换盘改这个文件即可。
   没有别的盘 / 写不进 / 非 Windows → 系统临时目录\proenga（同样用完自动删）。
   要「用完自动删」的工具引 _tmp-sandbox.js；要长期保留的（RPA 登录态浏览器档案）只引本文件取根。 */
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');
const CONF = path.join(__dirname, '..', '..', '..', '.proenga-tmp');

function writable(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); const t = path.join(dir, '.w' + process.pid); fs.writeFileSync(t, ''); fs.unlinkSync(t); return true; } catch (_) { return false; }
}

function pickDrive() {
  if (process.platform !== 'win32') return null;
  const sys = (process.env.SystemDrive || 'C:').toUpperCase();
  let disks = [];
  try {
    /* DriveType=3 = 本地固定硬盘（排除 U 盘 / 光驱 / 网络盘） */
    const out = execFileSync('powershell', ['-NoProfile', '-Command',
      "Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object { $_.DeviceID + ' ' + $_.FreeSpace }"],
      { stdio: ['ignore', 'pipe', 'ignore'], timeout: 15000 }).toString();
    disks = out.split(/\r?\n/).map(l => l.trim().split(/\s+/)).filter(a => /^[A-Z]:$/i.test(a[0]))
      .map(a => ({ id: a[0].toUpperCase(), free: +a[1] || 0 }));
  } catch (_) { return null; }
  disks = disks.filter(d => d.id !== sys && d.free > 5 * 1024 ** 3).sort((a, b) => b.free - a.free);   // 至少剩 5GB
  for (const d of disks) { const dir = d.id + '\\proenga-temp'; if (writable(dir)) return dir; }
  return null;
}

function tmpRoot() {
  let r = process.env.PROENGA_TMP;
  if (!r) { try { r = fs.readFileSync(CONF, 'utf8').replace(/^﻿/, '').split(/\r?\n/)[0].trim(); } catch (_) {} }
  if (!r) {
    r = pickDrive() || path.join(os.tmpdir(), 'proenga');
    try { fs.writeFileSync(CONF, r + '\n', 'utf8'); } catch (_) {}   // 记住，下次不再检测
  }
  fs.mkdirSync(r, { recursive: true });
  return r;
}

module.exports = { tmpRoot, pickDrive };
