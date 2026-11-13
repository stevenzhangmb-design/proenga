/* ════════════════════════════════════════════════════════════════════════
   ㊼ 临时文件铁律闸 · tmp-cleanup-gate.js（2026-10-27 · 根治检查工具残留把 C 盘撑满约 150GB）
   静态扫 skills/ 下所有 .js：凡用到 os.tmpdir() / mkdtemp 的工具，必须在【第一次用临时目录之前】
   接上沙盒（直接 require _tmp-sandbox，或 require 已接沙盒的 _gate-env）——退出整目录自动删、
   崩了下次启动兜底清。否则 = 红。
   豁免：只引 _tmp-root 取根的长期档案（RPA 登录态浏览器）。规则见 fix-and-upstream-protocol.md A8。
   ════════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const SKILLS = path.join(__dirname, '..', '..');
const SKIP_DIR = new Set(['node_modules', 'vendor', 'fixtures', 'examples']);
const bad = [];
let n = 0;
(function walk(d) {
  for (const name of fs.readdirSync(d)) {
    const p = path.join(d, name);
    if (fs.statSync(p).isDirectory()) { if (!SKIP_DIR.has(name)) walk(p); continue; }
    if (!/\.js$/.test(name) || /^_tmp-(sandbox|root)\.js$/.test(name) || p === __filename) continue;
    const s = fs.readFileSync(p, 'utf8');
    const use = s.search(/os\.tmpdir\(\)|mkdtempSync?\(/);
    if (use < 0) continue;
    n++;
    const rel = path.relative(SKILLS, p).replace(/\\/g, '/');
    const hook = [s.indexOf('_tmp-sandbox'), s.search(/require\(\s*['"]\.\/_gate-env['"]\s*\)/), s.indexOf('_tmp-root')].filter(i => i >= 0);
    if (!hook.length) bad.push(rel + '：用了临时目录，但没接沙盒（顶部加 require("…/_shared/qa/_tmp-sandbox")）');
    else if (Math.min(...hook) > use) bad.push(rel + '：接沙盒的那行在第一次用临时目录之后（要挪到文件顶部）');
  }
})(SKILLS);
console.log('㊼ 临时文件铁律：扫到 ' + n + ' 个用临时目录的工具');
if (bad.length) { bad.forEach(b => console.log('  ✗ ' + b)); console.log('❌ ' + bad.length + ' 个工具会把临时文件留在硬盘上'); process.exit(1); }
console.log('✅ 全部接了沙盒：临时文件进配置的临时根（本机 D 盘），退出自动删');
