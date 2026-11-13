// 把 PRD md 里“带章节号的加粗小节”（如 **4.4.1.3.1.1 位置**）改成真标题，Word 左侧目录才能显示。
// 用法：node fix-bold-headings.js <PRD.md> [--dry]    （--dry 只统计不写）
// 级别 = 它所属的上一级标题（编号是它的前缀）的级别 + 1；≤6 级写 #，7～9 级写 ::: {custom-style="Heading N"}（和 prd-generator 一致）。
// 只改这类行，其它内容一个字不动。
const fs = require('fs');
const [, , file, flag] = process.argv;
if (!file) { console.error('用法：node fix-bold-headings.js <PRD.md> [--dry]'); process.exit(1); }
const src = fs.readFileSync(file, 'utf8');
const eol = src.includes('\r\n') ? '\r\n' : '\n';
const lines = src.split(/\r?\n/);
const lvOf = {};   // 已出现标题：编号 → 级别
let n = 0;
const out = [];
for (let i = 0; i < lines.length; i++) {
  const l = lines[i];
  let m = l.match(/^(#{1,6})\s+(\d+(?:\.\d+)*)\s/);
  if (m) { lvOf[m[2]] = m[1].length; out.push(l); continue; }
  m = l.match(/^:::\s*\{custom-style="Heading (\d)"\}\s*$/);
  if (m) { const t = (lines[i + 1] || '').replace(/\[([^\]]*)\]\{[^}]*\}/g, '$1').match(/^(\d+(?:\.\d+)*)\s/); if (t) lvOf[t[1]] = +m[1]; out.push(l); continue; }
  m = l.match(/^\*\*(\d+(?:\.\d+)+)\s+(.+?)\*\*\s*$/);
  if (!m) { out.push(l); continue; }
  n++;
  const parts = m[1].split('.'); let lv = parts.length + 1;
  for (let k = parts.length - 1; k > 0; k--) { const p = parts.slice(0, k).join('.'); if (lvOf[p]) { lv = lvOf[p] + (parts.length - k); break; } }
  lv = Math.min(lv, 9); lvOf[m[1]] = lv;
  out.push(lv <= 6 ? `${'#'.repeat(lv)} ${m[1]} ${m[2]}` : ['', `::: {custom-style="Heading ${lv}"}`, `${m[1]} ${m[2]}`, ':::', ''].join(eol));
}
console.log(`加粗小节 ${n} 处${flag === '--dry' ? '（未写入）' : ' → 已改成标题'}：${file}`);
if (flag !== '--dry' && n) fs.writeFileSync(file, out.join(eol), 'utf8');
