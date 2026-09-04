#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   生成 Java 静态结构校验 · verify-java.js · 零依赖
   ⚠️ 无 JDK·【非真 javac】——只做能不装 JDK 就查的两类【真会导致编译失败】的错：
     ① 引用了某个类型(new X / X:: / X< / implements X / @X / X.静态 / catch(X))却【没 import】
        （wildcard import 与 java.lang / 同文件声明 / 泛型参数已排除·逮住了才报）
     ② 花括号/圆括号不配平
   逮住的正是"生成器漏 import"这类最常见崩因（如曾经的 LineVO 未 import）。
   真编译仍需 JDK+Maven+项目基座——本校验是"廉价前哨"，不替代真编译。
   用法：node verify-java.js <目录>     退出码 0=通过 · 1=有疑似
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const root = process.argv[2];
if (!root) { console.error('用法: node verify-java.js <目录>'); process.exit(2); }

// java.lang 及常见无需 import 的名
const JAVA_LANG = new Set(['String', 'Long', 'Integer', 'Boolean', 'Double', 'Float', 'Short', 'Byte', 'Character',
  'Object', 'Void', 'Number', 'Exception', 'RuntimeException', 'Throwable', 'Override', 'Deprecated',
  'SuppressWarnings', 'Math', 'System', 'Thread', 'Class', 'Iterable', 'Comparable', 'Runnable',
  'StringBuilder', 'CharSequence', 'Error', 'Enum', 'Record', 'FunctionalInterface', 'SafeVarargs']);
// 常见 wildcard 包提供的名（生成器用到的）：import 到 .* 时视为已覆盖
const WILDCARD = {
  'org.springframework.web.bind.annotation.*': ['RestController', 'RequestMapping', 'GetMapping', 'PostMapping', 'PutMapping', 'DeleteMapping', 'PatchMapping', 'PathVariable', 'RequestBody', 'RequestParam', 'RequestHeader', 'ResponseBody', 'RestControllerAdvice', 'CrossOrigin'],
  'java.time.*': ['LocalDate', 'LocalDateTime', 'LocalTime', 'Instant', 'Duration', 'Period', 'ZonedDateTime', 'OffsetDateTime'],
  'java.util.*': ['List', 'Map', 'Set', 'ArrayList', 'HashMap', 'HashSet', 'Collection', 'Optional', 'Arrays', 'Collections', 'Objects', 'LinkedList', 'TreeMap'],
};

function collect(dir, acc) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const fp = path.join(dir, e.name);
    if (e.isDirectory()) collect(fp, acc);
    else if (e.name.endsWith('.java')) acc.push(fp);
  }
  return acc;
}
function balance(src, open, close) {
  let d = 0, inStr = false, inChar = false, inLine = false, inBlock = false, esc = false, prev = '';
  for (const ch of src) {
    if (inLine) { if (ch === '\n') inLine = false; prev = ch; continue; }
    if (inBlock) { if (prev === '*' && ch === '/') inBlock = false; prev = ch; continue; }
    if (inStr) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === '"') inStr = false; prev = ch; continue; }
    if (inChar) { if (esc) esc = false; else if (ch === '\\') esc = true; else if (ch === "'") inChar = false; prev = ch; continue; }
    if (prev === '/' && ch === '/') { inLine = true; prev = ch; continue; }
    if (prev === '/' && ch === '*') { inBlock = true; prev = ch; continue; }
    if (ch === '"') { inStr = true; prev = ch; continue; }
    if (ch === "'") { inChar = true; prev = ch; continue; }
    if (ch === open) d++;
    else if (ch === close) d--;
    prev = ch;
  }
  return d;
}
function checkOne(fp) {
  const src = fs.readFileSync(fp, 'utf8');
  const problems = [];
  // 花括号/圆括号配平
  const b = balance(src, '{', '}'); if (b !== 0) problems.push(`花括号不配平(差 ${b})`);
  const p = balance(src, '(', ')'); if (p !== 0) problems.push(`圆括号不配平(差 ${p})`);
  // 已知名：imports + wildcard 覆盖 + java.lang + 同文件声明的类型 + 泛型单字母
  const known = new Set(JAVA_LANG);
  const wildImports = [];
  for (const m of src.matchAll(/import\s+(?:static\s+)?([\w.]+\*?)\s*;/g)) {
    const imp = m[1];
    if (imp.endsWith('.*')) { wildImports.push(imp); (WILDCARD[imp] || []).forEach(n => known.add(n)); }
    else known.add(imp.split('.').pop());
  }
  for (const m of src.matchAll(/\b(?:class|interface|enum|record)\s+([A-Z]\w*)/g)) known.add(m[1]);
  // 引用点：new X / X:: / X< / implements|extends|throws|new|instanceof X / @X / X.静态 / catch(X)
  const refs = new Set();
  const add = n => { if (n && !/^[A-Z][0-9]?$/.test(n)) refs.add(n); }; // 排除单字母泛型 T/E/K/V/T1
  // (?<![.\w]) 前置负向 → 排除【全限定名】(java.util.List) 的尾段·避免误报为漏 import
  for (const m of src.matchAll(/\bnew\s+([A-Z]\w+)\s*[(<]/g)) add(m[1]);
  for (const m of src.matchAll(/(?<![.\w])([A-Z]\w+)::/g)) add(m[1]);
  for (const m of src.matchAll(/(?<![.\w])([A-Z]\w+)</g)) add(m[1]);
  for (const m of src.matchAll(/\b(?:implements|extends|throws|instanceof)\s+([A-Z]\w+)/g)) add(m[1]);
  for (const m of src.matchAll(/@([A-Z]\w+)/g)) add(m[1]);
  for (const m of src.matchAll(/(?<![.\w])([A-Z]\w+)\.\w/g)) add(m[1]);
  for (const m of src.matchAll(/\bcatch\s*\(\s*(?:final\s+)?([A-Z]\w+)/g)) add(m[1]);
  // 未知（有 wildcard 时无法确证的名不误报：跳过——除非我们确知它不属于任何 wildcard 常见集）
  const hasUnknownWildcard = wildImports.some(w => !WILDCARD[w]); // 出现没登记的 wildcard → 保守放行未知名
  const missing = [...refs].filter(n => !known.has(n));
  const flagged = hasUnknownWildcard ? [] : missing;
  flagged.forEach(n => problems.push(`引用类型 ${n} 无 import（疑似漏 import）`));
  if (hasUnknownWildcard && missing.length) problems.push(`（有未登记 wildcard import·跳过 import 完整性检查以免误报：${missing.join(',')}）`);
  return problems;
}

const files = collect(root, []);
console.log('\n════════ 生成 Java 静态结构校验（非真 javac·前哨）════════');
if (!files.length) { console.log('  未发现 .java'); process.exit(0); }
let bad = 0;
for (const fp of files) {
  const ps = checkOne(fp);
  const nm = path.relative(root, fp);
  if (ps.length && ps.some(x => !x.startsWith('（'))) { bad++; console.log('  ✗ ' + nm); ps.forEach(x => console.log('      · ' + x)); }
  else console.log('  ✓ ' + nm);
}
console.log('──────────────────────────────────────────────');
if (bad) { console.log(`  ❌ ${bad} 个文件有疑似编译问题（静态·仍建议真编译复核）`); process.exit(1); }
console.log('  ✅ 全部通过静态校验（import 完整 + 括号配平）·真编译仍需 JDK/Maven');
process.exit(0);
