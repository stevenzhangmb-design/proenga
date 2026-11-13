'use strict';
/* i18n-compact 自测（零依赖）。
   用法：node i18n-compact.test.js            → 单元测试(自包含·必过)
        node i18n-compact.test.js <样本.json> → 额外跑【安全扫描 + 往返一致】(拿真样本验，可省) */
const fs = require('fs');
const { expandI18n, parseCompact, toCompact, scanLeadingPipe } = require('../i18n-compact');

let fail = 0;
const eq = (a, b, msg) => { const A = JSON.stringify(a), B = JSON.stringify(b); if (A !== B) { fail++; console.log('  ✗ ' + msg + '\n     期望 ' + B + '\n     实得 ' + A); } else console.log('  ✓ ' + msg); };

console.log('=== 单元测试 ===');
eq(parseCompact('|发票账号|Issuer|Emissor'), { zh: '发票账号', en: 'Issuer', pt: 'Emissor' }, '三段 → {zh,en,pt}');
eq(parseCompact('|a|b|c|d'), { zh: 'a', en: 'b', pt: 'c', spa: 'd' }, '四段 → +spa');
eq(parseCompact('|仅中英|OnlyEn'), { zh: '仅中英', en: 'OnlyEn', pt: '仅中英' }, '两段 → pt 兜底成 zh');
eq(parseCompact('普通串'), null, '普通串不展开');
eq(parseCompact('|单段'), null, '"|单段" 只一段 → 不展开(不误伤)');
eq(parseCompact(''), null, '空串');
eq(expandI18n({ listTitle: '|汇总|Summary|Resumo', columns: ['|NCM|NCM|NCM', 'plain', { label: '|税种|Tax|Imposto', width: 130 }] }),
   { listTitle: { zh: '汇总', en: 'Summary', pt: 'Resumo' }, columns: [{ zh: 'NCM', en: 'NCM', pt: 'NCM' }, 'plain', { label: { zh: '税种', en: 'Tax', pt: 'Imposto' }, width: 130 }] },
   '深 walk：标题/列数组/嵌套 label 都展开·plain 串与 width 不动');
eq(expandI18n({ a: 1, b: null, c: true, d: [1, 'x'] }), { a: 1, b: null, c: true, d: [1, 'x'] }, '非串值/无紧凑 → 原样(no-op)');
eq(toCompact({ zh: '发票账号', en: 'Issuer', pt: 'Emissor' }), '|发票账号|Issuer|Emissor', 'toCompact 往返');
eq(toCompact({ zh: 'NCM', en: 'NCM', pt: 'NCM' }), 'NCM', '三语相同 → 纯串');
eq(toCompact({ zh: 'a|b', en: 'x', pt: 'y' }), null, '含 | → 不能紧凑(返回 null)');
// expand(compact(x)) === x 的不变量（对可紧凑的三元组）
for (const o of [{ zh: '发票账号/CNPJ', en: 'Issuer/CNPJ', pt: 'Emissor/CNPJ' }, { zh: '按公司', en: 'By company', pt: 'Por empresa' }]) {
  const c = toCompact(o); eq(expandI18n(c), o, 'expand(compact) 还原: ' + JSON.stringify(o).slice(0, 30));
}

// ── 可选：拿真样本做安全扫描 + 往返一致 ──
const sample = process.argv[2];
if (sample && fs.existsSync(sample)) {
  console.log('\n=== 样本安全检查: ' + sample.split(/[\\/]/).pop() + ' ===');
  const pd = JSON.parse(fs.readFileSync(sample, 'utf8').replace(/^﻿/, ''));
  const hits = scanLeadingPipe(pd);
  console.log('  首字符是 | 的现存字符串: ' + hits.length + ' 处 ' + (hits.length ? '⚠(展开会误伤·需排查)' : '✓(展开对现有数据=no-op·安全)'));
  hits.slice(0, 5).forEach(h => console.log('    ' + h.path + ' = ' + h.val));
  // 往返：把所有可紧凑三元组 compact 再 expand，验证整棵树与原树一致（证明 expand 是 compact 的逆）
  let n = 0;
  function compactTree(node) {
    if (Array.isArray(node)) return node.map(compactTree);
    if (node && typeof node === 'object') {
      const c = toCompact(node); if (typeof c === 'string') { n++; return c; }
      const out = {}; for (const k in node) out[k] = compactTree(node[k]); return out;
    }
    return node;
  }
  const compacted = compactTree(pd);
  const back = expandI18n(compacted);
  // 注意：三语相同的三元组被 toCompact 压成纯串，expand 不会还原成对象 → 那类不参与严格比对
  const strip = o => JSON.parse(JSON.stringify(o, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) && ['zh', 'en', 'pt', 'spa'].some(x => x in v) && ['zh', 'en', 'pt', 'spa'].every(x => !(x in v) || v[x] === v.zh)) ? v.zh : v));
  const same = JSON.stringify(strip(back)) === JSON.stringify(strip(pd));
  console.log('  可紧凑三元组: ' + n + ' 个 · 往返(compact→expand)与原树一致(三语同的按纯串归一后): ' + (same ? '✓' : '✗'));
  if (!same) fail++;
}

console.log('\n' + (fail ? '✗ ' + fail + ' 项失败' : '✓ 全部通过'));
process.exit(fail ? 1 : 0);
