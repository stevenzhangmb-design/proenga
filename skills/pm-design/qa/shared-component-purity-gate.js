#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   ㊲ 共享件纯净闸 · shared-component-purity-gate.js   （纪律 C 的机器版）
   ────────────────────────────────────────────────────────────────────────
   纪律 C（2026-07-11 定）：【停止把单个原型的定制塞进共享骨架】
     · 共享标准件（骨架 / 标注层 / host-shell）只放【真正通用】的机制；
     · 某个原型特有的东西（业务词、状态名、字段名、规则值）一律走【数据配置】，不改骨架。
   为什么要机器闸：纪律靠自觉必然失守（已反复验证）。这道闸把 C 变成"结构上做不到"。

   判法（极轻·毫秒级·不开浏览器）：
     ① 剥掉所有注释（/* *\/、//、<!-- -->）——注释里写"此通用组件源自真系统某某页"是【允许】的（出处文档）；
     ② 剩下的【代码】里若出现【项目专有业务词】→ 判红（说明业务被硬编码进共享件了）。
   放行：通用 UI 词（查询/重置/新增/已选…）、通用货币/语言代码（在通用格式化逻辑里）。

   用法：node shared-component-purity-gate.js
   退出码：0 全绿；1 有红。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');

const COMP = path.join(__dirname, '..', 'components');
const SHARED = ['prototype-skeleton.html', 'annotation-layer.html', 'host-shell.html']
  .map(f => path.join(COMP, f)).filter(f => fs.existsSync(f));

/* 项目专有业务词：出现在【代码】里就是把某个项目的业务焊进了共享件 */
const BIZ_TERMS = [
  // 巴西发票项目
  'Manifesta', 'SEFAZ', 'CNPJ', 'CPF', 'NF-e', 'NFe', 'ICMS', 'COFINS', 'Rejei', 'Não Realizada', 'Autoriza',
  // 充值 / 收发存 / 租户 / 海外仓
  '充值', '扣费', '收发存', '库存核算', '海外仓', '租户', '开票', '发票',
  // 英文技术代号（ASCII 词按【词边界】匹配，避免 _inferFieldType 里的 "nfe" 之类误报）
  'recharge', 'invoice', 'tenant',
];
/* ASCII 词必须是独立单词（前后不是字母/数字），中文词直接子串匹配 */
const isAscii = t => /^[\x00-\x7F]+$/.test(t);
function hasTerm(line, t) {
  if (!isAscii(t)) return line.includes(t);
  const re = new RegExp('(^|[^A-Za-z0-9])' + t.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&') + '($|[^A-Za-z0-9])', 'i');
  return re.test(line);
}
/* 允许出现在代码里的通用词（哪怕字面撞上也不算违规） */
const ALLOW_RE = [
  /currency|locale|BRL|CNY|USD|EUR/i,   // 通用货币/语言代码（格式化逻辑里合法）
];

/* 剥注释：/* *\/ 、行内 // 、HTML <!-- --> */
function stripComments(src) {
  let s = src;
  s = s.replace(/<!--[\s\S]*?-->/g, '\n');          // HTML 注释
  s = s.replace(/\/\*[\s\S]*?\*\//g, '\n');          // 块注释
  s = s.replace(/(^|[^:'"\\])\/\/[^\n]*/g, '$1');    // 行注释（避开 http://）
  return s;
}

console.log('\n════════ ㊲ 共享件纯净闸（纪律C：项目定制不许进共享骨架）════════');
let bad = 0;
for (const f of SHARED) {
  const name = path.basename(f);
  const raw = fs.readFileSync(f, 'utf8');
  const code = stripComments(raw);
  const lines = code.split('\n');
  const hits = [];
  lines.forEach((ln, i) => {
    if (!ln.trim()) return;
    if (ALLOW_RE.some(re => re.test(ln))) return;
    for (const t of BIZ_TERMS) {
      if (hasTerm(ln, t)) {
        hits.push({ term: t, line: i + 1, txt: ln.trim().slice(0, 90) });
        break;
      }
    }
  });
  if (hits.length) {
    bad += hits.length;
    console.log(`\n  ✗ ${name} —— 代码里硬编码了 ${hits.length} 处项目专有业务词：`);
    hits.slice(0, 10).forEach(h => console.log(`      「${h.term}」  ${h.txt}`));
    console.log('      → 修法：把业务值搬进【数据配置】(project-data)，骨架只留通用机制（如 blockIf:{when,msg}）。');
  } else {
    console.log(`  ✓ ${name} —— 代码干净（项目专有词只出现在注释里=允许，注释是出处文档）`);
  }
}
console.log('\n──────────────────────────────');
console.log(bad === 0 ? '  ㊲ 共享件纯净闸 全绿 PASS ✅（共享件只含通用机制，没被单个项目带偏）'
                      : `  ㊲ 共享件纯净闸 有红 FAIL ❌（${bad} 处项目定制混进了共享件）`);
console.log('════════════════════════════════\n');
process.exit(bad === 0 ? 0 : 1);
