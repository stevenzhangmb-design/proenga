#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   fidelity-verify.js · 复刻件 vs 真系统基线，逐值自核（1:1 的验收机器）
   ────────────────────────────────────────────────────────────────────────
   2026-10-29 建。这是「100% 还原」缺的最后一环。

   之前的状态：抓真值这一段有了（tokens.js / specdiff.js），但"照着真值做出来的
   复刻件到底像不像"只能靠肉眼看。肉眼看就是"对个大概"，而且细节永远要用户
   一个个指出来 —— 那不叫 1:1。

   这里做三件事，缺一不可（只查第一件就是「闸绿≠1:1」的老教训）：
     ① 逐值等不等：基线每个桶的每个属性，复刻件必须相等；不等 = 红
     ② 缺没缺：基线有这个组件、复刻件没有 = 红（漏做）
     ③ 多没多：复刻件有、真系统没有 = 红（画蛇添足 —— 真系统没有的一个都不许加）

   纯度不满 100% 的桶（真系统自己就有两种取值）按"容许其他值"放行。

   用法：
     node fidelity-verify.js <复刻件.html> <基线.json> [--md 报告.md] [--port N]
     node fidelity-verify.js <已抽好的.ctx.json> <基线.json>        # 跳过抽取
   退出码：0 = 全绿；1 = 有红。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
try { require('../_shared/qa/_tmp-sandbox'); } catch (_) {}
/* ↑ 沙盒必须是【第一行】：它在加载时就把 TEMP/TMP/TMPDIR 指向本进程专属目录，
   并在退出时整目录删掉。先取临时目录再 require，拿到的是系统临时目录（C 盘），
   落在那儿的东西不会被自动清 —— 就是 2026-10-27 把 C 盘撑满 150GB 的那类问题。
   ⚠️ ㊼ 闸是纯文本扫描：连【注释里】提到取临时目录的那个函数名，也算"用过了"，
   所以这行注释只能放在 require 之后，不能放前面（2026-10-29 实测踩到）。 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');
const tmpRoot = os.tmpdir();

const PN = { h: '高', font: '字号', weight: '字重', color: '文字色', bg: '背景', border: '边框', radius: '圆角', pad: '内边距', line: '行高' };

const target = process.argv[2], baseFile = process.argv[3];
if (!target || !baseFile) {
  console.error('用法: node fidelity-verify.js <复刻件.html|已抽好的.ctx.json> <基线.json> [--md 报告.md] [--port N]');
  process.exit(2);
}
const ai = f => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };

/* ── 1. 拿到复刻件的真值 ── */
let got;
if (/\.ctx\.json$/i.test(target)) {
  got = JSON.parse(fs.readFileSync(target, 'utf8'));
} else {
  const out = fs.mkdtempSync(path.join(tmpRoot, 'fid-'));
  const r = spawnSync(process.execPath, [path.join(__dirname, 'tokens.js'), target, '--out', out,
    '--port', String(+(ai('--port') || 9840))], { encoding: 'utf8' });
  process.stdout.write(r.stdout || '');
  const f = fs.readdirSync(out).filter(x => x.endsWith('.ctx.json'))[0];
  if (!f) { console.error('✗ 抽不出复刻件的真值：' + (r.stderr || '').slice(0, 300)); process.exit(1); }
  got = JSON.parse(fs.readFileSync(path.join(out, f), 'utf8'));
  try { fs.rmSync(out, { recursive: true, force: true }); } catch (_) {}
}

const base = JSON.parse(fs.readFileSync(baseFile, 'utf8')).基线 || {};

/* 复刻件每桶的主值（出现最多的那个样式） */
const mainOf = m => {
  const es = Object.values(m).sort((a, b) => b.n - a.n);
  if (!es.length) return null;
  const topH = Object.entries(es[0].高 || {}).sort((a, b) => b[1] - a[1])[0];
  return Object.assign({ h: topH ? topH[0] + 'px' : null }, es[0].值, { _n: es[0].n, _例: es[0].例 });
};

/* ⚠️ 外层属性被内层覆盖时，外层的差异【用户看不见】—— 必须和可见差异分开报。
   2026-10-29 实测：真系统 el-table 表头外层 th 是 13px、内层 .cell 覆盖回 14px；
   表体外层 td 是 12px、内层 .cell 覆盖回 14px。文字在内层渲染，所以看得见的是内层。
   不分开报的后果：报告里混进一批看不见的红，人照着去改，改完外层对了、
   内层反而被改坏；更糟的是会据此去改一份本来正确的设计规范（真发生过两次）。 */
function innerBucketOf(bk) {
  const m = /^(.+?)·外层[^｜]*(｜.*)$/.exec(bk);
  if (!m) return null;
  return Object.keys(base).find(k => k.indexOf(m[1] + '·内层') === 0 && k.endsWith(m[2].slice(1)));
}
function coveredByInner(bk, p) {
  const ib = innerBucketOf(bk);
  if (!ib || !base[ib] || !base[ib].主值) return false;
  const outer = base[bk].主值[p], inner = base[ib].主值[p];
  /* 内层给了这个属性、且和外层不同 → 外层那个值在视觉上被盖掉了 */
  return inner != null && outer != null && inner !== outer;
}

/* 真系统同一个组件常有【两套实现】（这里是 el-table 和原生手写表），各带一套值。
   复刻件用了另一套的值时，单纯判红会让人以为"这个值是凭空错的"，然后去改成
   另一套 —— 可是两个值都是真系统的，差别只在"你走哪套"。
   2026-10-29 我自己就据此误判了三次（表头字号、表体字号、表体文字色）。
   所以：认出这种情况，报成「用了另一套的值」并说清各自归属，由人决定走哪套。 */
const KINDS = ['EP表', '原生表'];
function otherKindValue(bk, p, val) {
  for (const k of KINDS) {
    if (bk.indexOf('｜' + k) < 0) continue;
    for (const k2 of KINDS) {
      if (k2 === k) continue;
      const alt = bk.replace('｜' + k, '｜' + k2);
      const b2 = base[alt];
      if (b2 && b2.容许 && b2.容许[p] && b2.容许[p].some(v => v === val)) return { 桶: alt, 套: k2, 本套: k };
    }
  }
  return null;
}

const red = [], green = [], 缺 = [], 多 = [], 不可见 = [], 另一套 = [], 基线脏 = [];
Object.keys(base).forEach(bk => {
  const b = base[bk];
  if (!got[bk]) { 缺.push({ 桶: bk, 组件: b.组件, 场景: b.场景, 变体: b.变体 }); return; }
  const g = mainOf(got[bk]);
  if (!g) { 缺.push({ 桶: bk, 组件: b.组件, 场景: b.场景, 变体: b.变体 }); return; }
  /* 真系统这个桶自己就有多种取值 → 复刻件落在任一个上都算过 */
  Object.keys(PN).forEach(p => {
    const want = b.主值 ? b.主值[p] : null;
    const 容许 = (b.容许 && b.容许[p]) || (want != null ? [want] : []);
    if (want == null) return;
    /* 高度允许 ±1px：边框算不算进去、子像素舍入，都会差 1px（实测 40px vs 41px）。
       1px 不是设计差异，拿它判红会把真问题淹掉；2px 以上就是真的不一样了。 */
    const eq = (a, b) => {
      if (a === b) return true;
      if (p !== 'h' || a == null || b == null) return false;
      const x = parseFloat(a), y = parseFloat(b);
      return !isNaN(x) && !isNaN(y) && Math.abs(x - y) <= 1;
    };
    if (容许.some(v => eq(v, g[p]))) { green.push(bk + '·' + PN[p]); return; }
    const item = { 桶: bk, 组件: b.组件, 场景: b.场景, 变体: b.变体, 属性: PN[p],
                   真系统: want, 复刻件: g[p] == null ? '(没有)' : g[p],
                   容许: 容许.filter(v => v !== want), 例: g._例 };
    /* 外层这个属性被内层覆盖了 → 差异不可见，单独归一类，不混进要改的红里 */
    /* 基线这个属性是 UA 默认值（冻结件丢了 CSS）→ 它不是真系统的设计值，不能拿来判红 */
    if ((b.可疑_UA默认值 || []).indexOf(PN[p]) >= 0) { 基线脏.push(item); return; }
    if (coveredByInner(bk, p)) { const ib = innerBucketOf(bk); item.内层值 = base[ib].主值[p]; 不可见.push(item); return; }
    const alt = otherKindValue(bk, p, g[p]);
    if (alt) { item.另一套 = alt; 另一套.push(item); return; }
    red.push(item);
  });
});
Object.keys(got).forEach(bk => { if (!base[bk]) 多.push({ 桶: bk, n: Object.values(got[bk]).reduce((s, x) => s + x.n, 0) }); });

/* 「缺」默认只是提示：验单页时，基线（55 页合成）里的组件它本来就不会全有。
   验整套复刻件时传 --require-all，缺才判红。 */
const REQ = process.argv.includes('--require-all');
const bad = red.length + 多.length + (REQ ? 缺.length : 0);
console.log('【保真自核】' + path.basename(target));
console.log('  基线 ' + Object.keys(base).length + ' 桶 · 复刻件 ' + Object.keys(got).length + ' 桶');
console.log('  ✅ 逐值相等 ' + green.length + ' 项');
console.log('  ' + (red.length ? '🔴' : '✅') + ' 值不等 ' + red.length + ' 项（看得见的）');
if (不可见.length) console.log('  · 另有 ' + 不可见.length + ' 项外层不等但【被内层覆盖·用户看不见】，不算红（详见报告）');
if (另一套.length) console.log('  · 另有 ' + 另一套.length + ' 项用了【真系统另一套表的值】（两个值都是真的，差别只在走哪套），不算红');
if (基线脏.length) console.log('  ⚠ 另有 ' + 基线脏.length + ' 项【基线本身是脏的】（UA 默认值·冻结件丢了 CSS），不判红 —— 要修 freeze.js 重抓才能比');
console.log('  ' + (缺.length ? (REQ ? '🔴' : '·') : '✅') + ' 基线有、复刻件没有 ' + 缺.length +
            ' 个桶' + (缺.length && !REQ ? '（验单页正常；验整套要加 --require-all）' : ''));
console.log('  ' + (多.length ? '🔴' : '✅') + ' 复刻件多出真系统没有的 ' + 多.length + ' 个桶');

const show = (t, l, f) => { if (!l.length) return; console.log('\n' + t); l.slice(0, 12).forEach(x => console.log('  ' + f(x))); if (l.length > 12) console.log('  …另 ' + (l.length - 12) + ' 项，见报告'); };
show('🔴 值不等：', red, x => x.组件 + '·' + x.场景 + (x.变体 ? '·' + x.变体 : '') + ' 的' + x.属性 +
  '：真系统 ' + x.真系统 + ' / 复刻件 ' + x.复刻件 + (x.容许.length ? '（真系统也容许 ' + x.容许.join('、') + '）' : ''));
show('🔴 缺的组件：', 缺, x => x.组件 + '·' + x.场景 + (x.变体 ? '·' + x.变体 : ''));
show('🔴 多出来的（真系统没有）：', 多, x => x.桶 + ' ×' + x.n);

const mo = ai('--md');
if (mo) {
  let md = '# 保真自核报告\n\n> 复刻件：' + target + '\n> 基线：' + baseFile + '\n> 结论：' +
    (bad ? '🔴 ' + bad + ' 项不符，离 1:1 还有差距' : '✅ 全绿，逐值等于真系统') + '\n\n' +
    '| 维度 | 结果 |\n|---|---|\n| 逐值相等 | ' + green.length + ' 项 |\n| 值不等 | ' + red.length +
    ' 项 |\n| 缺的组件 | ' + 缺.length + ' 个桶 |\n| 多出来的 | ' + 多.length + ' 个桶 |\n\n';
  if (red.length) {
    md += '## 🔴 值不等（' + red.length + ' 项）\n\n| 组件 | 场景 | 变体 | 属性 | 真系统 | 复刻件 | 真系统也容许 |\n|---|---|---|---|---|---|---|\n';
    red.forEach(x => { md += '| ' + x.组件 + ' | ' + x.场景 + ' | ' + (x.变体 || '-') + ' | ' + x.属性 +
      ' | `' + x.真系统 + '` | `' + x.复刻件 + '` | ' + (x.容许.join('、') || '-') + ' |\n'; });
    md += '\n';
  }
  if (基线脏.length) {
    md += '## ⚠️ 基线本身是脏的 —— 这些比不了（' + 基线脏.length + ' 项）\n\n' +
      '基线这些属性抽到的是**浏览器 UA 默认值**（`2px outset` 这类），不是真系统的设计值。\n' +
      '**实测**：同一个「查询」按钮，活页面上是 `1px solid`，冻结件里渲染成 `2px outset`（浏览器 UA 默认）。\n' +
      '**真因尚未查清**：已排除「CSS 丢失」（冻结件 38980 条规则、`--el-border` 等变量全部正常解析、\n' +
      'Element Plus 的 `.el-button` 基础规则也在）和「跨域样式表被跳过」（该系统跨域表 = 0）。\n' +
      '在查清并重抓之前，这些属性一律不判红 —— 拿脏基线判红只会让人去改本来正确的复刻件。\n\n' +
      '| 组件 | 场景 | 变体 | 属性 | 基线(脏) | 复刻件 |\n|---|---|---|---|---|---|\n';
    基线脏.forEach(x => { md += '| ' + x.组件 + ' | ' + x.场景 + ' | ' + (x.变体 || '-') + ' | ' + x.属性 +
      ' | `' + x.真系统 + '` | `' + x.复刻件 + '` |\n'; });
    md += '\n';
  }
  if (另一套.length) {
    md += '## · 用了真系统【另一套表】的值 —— 不是错值，要你定走哪套（' + 另一套.length + ' 项）\n\n' +
      '真系统同一个组件有两套实现（Element Plus `el-table` 和原生手写表），**各带一套值，两套都是真的**。\n' +
      '复刻件这些属性取的是另一套的值 —— 所以不算"错"，只是混搭了。要么统一走一套，要么确认这是有意的。\n\n' +
      '| 组件 | 场景 | 变体 | 属性 | 本套(基线) | 复刻件用的 | 那个值来自 |\n|---|---|---|---|---|---|---|\n';
    另一套.forEach(x => { md += '| ' + x.组件 + ' | ' + x.场景 + ' | ' + (x.变体 || '-') + ' | ' + x.属性 +
      ' | `' + x.真系统 + '` | `' + x.复刻件 + '` | ' + x.另一套.套 + ' |\n'; });
    md += '\n';
  }
  if (不可见.length) {
    md += '## · 外层不等，但被内层覆盖 —— 用户看不见，不用改（' + 不可见.length + ' 项）\n\n' +
      '文字在内层（`.cell`）渲染，内层给了值就把外层盖住了。**这些差异没有视觉效果。**\n' +
      '单独列出来是因为：混进上面的红里，人会照着改一堆看不见的东西，甚至据此去改一份本来正确的设计规范（2026-10-29 已发生两次）。\n\n' +
      '| 组件 | 场景 | 变体 | 属性 | 真系统外层 | 复刻件外层 | 内层（← 实际显示）|\n|---|---|---|---|---|---|---|\n';
    不可见.forEach(x => { md += '| ' + x.组件 + ' | ' + x.场景 + ' | ' + (x.变体 || '-') + ' | ' + x.属性 +
      ' | `' + x.真系统 + '` | `' + x.复刻件 + '` | **`' + x.内层值 + '`** |\n'; });
    md += '\n';
  }
  if (缺.length) {
    md += '## 🔴 复刻件缺这些组件（' + 缺.length + ' 个桶）\n\n| 组件 | 场景 | 变体 |\n|---|---|---|\n';
    缺.forEach(x => { md += '| ' + x.组件 + ' | ' + x.场景 + ' | ' + (x.变体 || '-') + ' |\n'; });
    md += '\n';
  }
  if (多.length) {
    md += '## 🔴 复刻件多出真系统没有的（' + 多.length + ' 个桶）\n\n**真系统没有 = 一个都不许加。**\n\n';
    多.forEach(x => { md += '- `' + x.桶 + '` ×' + x.n + '\n'; });
  }
  fs.writeFileSync(mo, md, 'utf8');
  console.log('\n→ 报告 ' + mo);
}
process.exit(bad ? 1 : 0);
