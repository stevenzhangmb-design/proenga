/* ════════════════════════════════════════════════════════════════════════
   in-DOM 模板地雷静态扫描闸 · indom-footgun-lint.js · 维护者 QA 工具（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   根治"改一个又冒一个"——原型是浏览器内 in-DOM Vue 模板，有一组固定地雷，
   每次改动都可能踩中没踩过的那颗。本闸【运行前静态】把整类一次性拦死、覆盖所有文件：
     ① 自定义元素自闭合 `<el-xxx .../>` / `<edit-pen/>`（浏览器忽略 /> → 后续元素嵌套进去 → 表格列崩/组件吞）
     ② 组件名 PascalCase `<EditPen/>`（浏览器小写成 <editpen> → Vue 解析不到注册名 → 渲染成空 → 图标/组件不可见）
     ③ HTML 注释跨 `<script>` 边界（<!-- 吞掉脚本块 → 整页乱码 Vue 挂不上）
     ④ `<script>` 开/闭标签不平衡（注入新脚本块前漏关上一段 </script> → <script>套<script>
        → "Unexpected token '<'" 整页 JS 崩；打开/改造已有原型注入标注层时最易踩）
   只扫【模板区】(剥掉 <script>/<style>)；③④ 在原文上查。任一命中 → 退出码 1。
   用法：node indom-footgun-lint.js [文件1 文件2 ...]（默认扫 3 个标注原型/标准件）
   ════════════════════════════════════════════════════════════════════════ */
const fs = require('fs'), path = require('path');
const { findPrototypes, ANNOTATION_LAYER } = require('./_gate-env');

// 自动探测 archive 内所有标注原型 + 标准件（annotation-layer）；去重，标准件必含
const DEFAULT_FILES = [...new Set([...findPrototypes(), ANNOTATION_LAYER])];
const FILES = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_FILES;

// 原生 void 元素：唯一允许自闭合的；其余自闭合的【带连字符】标签 = in-DOM 自定义元素地雷
const VOID = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);

// 把 <script>...</script> / <style>...</style> 换成等行数空白（保留行号，只留模板区）
function stripScriptStyle(s) {
  return s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, m => m.replace(/[^\n]/g, ' '));
}
const lineOf = (text, idx) => text.slice(0, idx).split('\n').length;

function lintFile(file) {
  const errs = [], warns = [];   // errs=硬拦(整页崩/组件不可见)，warns=潜伏风险(当前没崩,建议显式闭合)
  let raw; try { raw = fs.readFileSync(file, 'utf8'); } catch (e) { return { errs: [{ line: 0, msg: '读取失败: ' + e.message }], warns: [] }; }
  const tpl = stripScriptStyle(raw);

  // ① 自定义元素(带连字符)自闭合：el-table-column 自闭合=catastrophic(列崩)硬拦；其余=潜伏风险(当前多无害)降级警告
  let m, re1 = /<([a-z][a-z0-9]*-[a-z0-9-]*)\b[^>]*?\/>/gi;
  while ((m = re1.exec(tpl))) {
    const item = { line: lineOf(tpl, m.index), msg: `自定义元素自闭合 <${m[1]} .../> → 建议显式闭合 </${m[1]}>`, snip: m[0].slice(0, 70) };
    if (/^el-table-column$/i.test(m[1])) { item.msg = `el-table-column 自闭合 → 表格列崩，必须显式闭合 </el-table-column>`; errs.push(item); }
    else warns.push(item);
  }

  // ② PascalCase 组件标签（首字母大写）—— in-DOM 会被小写解析不出
  let re2 = /<([A-Z][A-Za-z0-9]*)(?=[\s/>])/g;
  while ((m = re2.exec(tpl))) {
    if (m[1] === 'DOCTYPE') continue;
    errs.push({ line: lineOf(tpl, m.index), msg: `PascalCase 组件标签 <${m[1]}> → in-DOM 模板必须 kebab-case <${m[1].replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()}>`, snip: m[0].slice(0, 70) });
  }

  // ③ HTML 注释跨 <script> 边界
  let re3 = /<!--[\s\S]*?-->/g;
  while ((m = re3.exec(raw))) {
    if (/<\/?script\b/i.test(m[0])) errs.push({ line: lineOf(raw, m.index), msg: 'HTML 注释跨 <script> 边界 → 会吞脚本块致整页乱码', snip: m[0].slice(0, 50).replace(/\n/g, '⏎') });
  }

  // ④ <script> 开/闭标签不平衡 → 必有脚本块未正确闭合（如注入标注层时漏关业务 </script>）→ 整页 JS 崩
  const sOpen = (raw.match(/<script\b[^>]*>/gi) || []).length;
  const sClose = (raw.match(/<\/script>/gi) || []).length;
  if (sOpen !== sClose) errs.push({ line: 0, msg: `<script> 开(${sOpen})/闭(${sClose}) 标签不平衡 → 必有脚本块未闭合(常见：注入新<script>前漏关上一段</script>)，会致 "Unexpected token '<'" 整页崩` });

  return { errs, warns };
}

let totalErr = 0, totalWarn = 0;
console.log('\n════════ in-DOM 模板地雷静态扫描闸 ════════');
for (const f of FILES) {
  const { errs, warns } = lintFile(f);
  const name = path.basename(f);
  totalErr += errs.length; totalWarn += warns.length;
  if (!errs.length && !warns.length) { console.log(`  ✓ ${name}  无地雷`); continue; }
  if (errs.length) {
    console.log(`  ✗ ${name}  硬拦 ${errs.length} 处：`);
    errs.slice(0, 30).forEach(e => console.log(`      L${e.line}  ${e.msg}${e.snip ? '   〔' + e.snip + '〕' : ''}`));
  }
  if (warns.length) {
    console.log(`  ⚠ ${name}  警告 ${warns.length} 处（当前无害·潜伏风险·建议显式闭合）：`);
    warns.slice(0, 5).forEach(e => console.log(`      L${e.line}  ${e.msg}`));
    if (warns.length > 5) console.log(`      …还有 ${warns.length - 5} 处（同类）`);
  }
}
console.log('──────────────────────────────────');
console.log(totalErr ? `  硬拦 ${totalErr} 处 FAIL ❌（运行前必须清零）` : `  无硬拦地雷 PASS ✅${totalWarn ? '（另有 ' + totalWarn + ' 处自闭合警告·建议日后批量收口）' : ''}`);
console.log('════════════════════════════════════\n');
process.exit(totalErr ? 1 : 0);
