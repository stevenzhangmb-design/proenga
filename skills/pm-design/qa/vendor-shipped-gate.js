#!/usr/bin/env node
'use strict';
/* ════════════════════════════════════════════════════════════════════════
   ㊺ vendor 随包闸 · vendor-shipped-gate.js
   ────────────────────────────────────────────────────────────────────────
   根治（2026-09-16 实测事故）：离线化每次都从 unpkg 重新下载 Vue/ElementPlus 等 5 个文件（1.75MB），
   慢链路上 **188 秒**，占整个交付件重建的 95% —— 跟改了什么、改了多少毫无关系，空跑一次也是 188 秒；
   而且新机器装完第一次必须能联网，否则根本用不了。

   本闸卡死三件事，防止被改回去：
     ① vendor/ 里 5 个资产齐全、非空，且每个都带 <file>.url 版本标记
     ② make-offline.ps1 / _gate-vendor.js 确实【先读 vendor】，不是无条件下载
     ③ vendor 的 .url 标记与脚本里声明的 URL 一致（升级版本忘了更新缓存 = 版本错配）

   用法：node qa/vendor-shipped-gate.js
   退出码：0 全绿 / 1 有红项
   ════════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const VENDOR = path.join(ROOT, 'vendor');
const MUST = ['vue.js', 'ep.css', 'ep.js', 'icons.js', 'eploc.js'];

let bad = 0;
const ok = (c, t) => { console.log((c ? '  ✓ ' : '  ★ ') + t); if (!c) bad++; };

console.log('═══ ㊺ vendor 随包闸 ═══');

/* ① 资产齐全 */
if (!fs.existsSync(VENDOR)) {
  ok(false, 'vendor/ 目录不存在 —— 离线化会退回每次联网下载（实测慢 188 秒，且断网不可用）');
} else {
  for (const f of MUST) {
    const p = path.join(VENDOR, f);
    const exists = fs.existsSync(p) && fs.statSync(p).size > 1000;
    ok(exists, 'vendor/' + f + (exists ? '（' + Math.round(fs.statSync(p).size / 1024) + ' KB）' : ' 缺失或过小'));
    if (exists) {
      const marker = p + '.url';
      ok(fs.existsSync(marker) && fs.readFileSync(marker, 'utf8').trim().length > 10,
         '  └ 版本标记 ' + f + '.url' + (fs.existsSync(marker) ? '' : ' 缺失 —— 升级版本时无法判断缓存是否过期'));
    }
  }
}

/* ② 两个使用方确实先读 vendor */
const checks = [
  { file: path.join(ROOT, 'make-offline.ps1'), needs: [/vendor/, /cache first|CACHE /i], name: 'make-offline.ps1' },
  { file: path.join(__dirname, '_gate-vendor.js'), needs: [/['"]\.\.['"],\s*['"]vendor['"]|\.\.\/vendor/], name: '_gate-vendor.js' },
];
for (const c of checks) {
  if (!fs.existsSync(c.file)) { ok(false, c.name + ' 不存在'); continue; }
  const src = fs.readFileSync(c.file, 'utf8');
  const hit = c.needs.every(re => re.test(src));
  ok(hit, c.name + (hit ? ' 先读随包 vendor' : ' 没有走 vendor —— 会退回每次联网下载'));
}

/* ③ 标记与脚本里声明的 URL 一致（防止升了版本、缓存还是旧的） */
const gv = path.join(__dirname, '_gate-vendor.js');
if (fs.existsSync(gv)) {
  const src = fs.readFileSync(gv, 'utf8');
  const declared = {};
  const re = /file:\s*'([^']+)'\s*,\s*url:\s*'([^']+)'/g;
  let m; while ((m = re.exec(src))) declared[m[1]] = m[2];
  let mismatch = 0;
  for (const f of MUST) {
    const marker = path.join(VENDOR, f + '.url');
    if (!declared[f] || !fs.existsSync(marker)) continue;
    const cached = fs.readFileSync(marker, 'utf8').trim();
    if (cached !== declared[f]) { mismatch++; console.log('  ★ ' + f + ' 版本错配：缓存=' + cached + ' 声明=' + declared[f]); }
  }
  ok(mismatch === 0, mismatch === 0 ? '缓存版本与声明一致（升级版本会自动重下）' : '有 ' + mismatch + ' 个版本错配');
}

console.log(bad ? '\n㊺ vendor 随包闸：★ 有 ' + bad + ' 处不对' : '\n㊺ vendor 随包闸：全绿 ✓（离线化不联网、新机器开箱即用）');
process.exit(bad ? 1 : 0);
