#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   distill.js · 把一堆页面的实测真值，提炼成一份「权威设计规范」
   ────────────────────────────────────────────────────────────────────────
   2026-10-29 建。为什么要它：
     deepcrawl 从 79 个真实界面抽了 55 份 computed 样式。但同一类组件（比如主按钮）
     在不同页面的值**不一定完全一样** —— 可能某页有特例、也可能是我抽样抽到了变体。
     凭印象挑一个写进规范，就是"对个大概"，那不叫 1:1。

     所以这里按【每个属性】统计所有样本：
       · 出现最多的那个值 = 权威值（众数）
       · 一致率 100% → 这条可以直接写死进规范
       · 一致率不到 100% → **把分歧值和出处全列出来**，让人去判断是特例还是错值
     复刻时拿这份规范当唯一真理源，再用 verify 逐值比对复刻件，不靠肉眼。

   用法：
     node distill.js <真值目录> <输出.json> [--md <输出.md>]
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const PROPS = ['w', 'h', 'font', 'weight', 'color', 'bg', 'border', 'radius', 'pad', 'line'];
const CN = {
  dialogTitle: '弹窗标题', dialog: '弹窗容器', formLabel: '表单标签', input: '输入框',
  select: '下拉框', btnPrimary: '主按钮', btnDefault: '次按钮',
  th: '表头单元格', td: '表体单元格', tab: '页签'
};
/* 宽高随内容变，不该当成规范的一部分；只有高度对按钮/输入框这类固定高控件有意义 */
const SKIP_W = new Set(['dialogTitle', 'dialog', 'formLabel', 'th', 'td', 'tab', 'btnPrimary', 'btnDefault', 'input', 'select']);
const SKIP_H = new Set(['dialog', 'dialogTitle']);

(async () => {
  const dir = process.argv[2];
  const out = process.argv[3];
  const mdI = process.argv.indexOf('--md');
  const mdOut = mdI > 0 ? process.argv[mdI + 1] : null;
  if (!dir || !out) { console.error('用法: node distill.js <真值目录> <输出.json> [--md <输出.md>]'); process.exit(2); }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.tokens.json'));
  if (!files.length) { console.error('目录里没有 .tokens.json'); process.exit(1); }

  /* 收集：组件 → 属性 → 值 → [出处] */
  const bag = {};
  files.forEach(fn => {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, fn), 'utf8')); } catch (_) { return; }
    const src = fn.replace('.tokens.json', '');
    Object.keys(j).forEach(comp => {
      (j[comp] || []).forEach(item => {
        bag[comp] = bag[comp] || {};
        PROPS.forEach(p => {
          if (p === 'w' && SKIP_W.has(comp)) return;
          if (p === 'h' && SKIP_H.has(comp)) return;
          const v = item[p];
          if (v === undefined || v === null || v === '') return;
          bag[comp][p] = bag[comp][p] || {};
          bag[comp][p][String(v)] = bag[comp][p][String(v)] || [];
          if (bag[comp][p][String(v)].length < 6) bag[comp][p][String(v)].push(src);
        });
      });
    });
  });

  const spec = {}, conflicts = [];
  Object.keys(bag).forEach(comp => {
    spec[comp] = {};
    Object.keys(bag[comp]).forEach(p => {
      const vals = Object.entries(bag[comp][p]).sort((a, b) => b[1].length - a[1].length);
      const total = vals.reduce((s, v) => s + v[1].length, 0);
      const [topVal, topSrc] = vals[0];
      const rate = Math.round(topSrc.length / total * 100);
      spec[comp][p] = { value: topVal, 一致率: rate + '%', 样本数: total };
      if (rate < 100) {
        spec[comp][p].其他值 = vals.slice(1, 4).map(v => ({ 值: v[0], 次数: v[1].length, 出处: v[1].slice(0, 3) }));
        conflicts.push({ 组件: CN[comp] || comp, 属性: p, 权威值: topVal, 一致率: rate, 分歧: vals.slice(1, 4).map(v => v[0] + '×' + v[1].length) });
      }
    });
  });

  fs.writeFileSync(out, JSON.stringify({ 来源目录: dir, 样本文件数: files.length, 规范: spec, 分歧清单: conflicts }, null, 2), 'utf8');
  console.log('✅ 规范 → ' + out + '（' + files.length + ' 份真值提炼）');

  const PN = { w: '宽', h: '高', font: '字号', weight: '字重', color: '文字色', bg: '背景', border: '边框', radius: '圆角', pad: '内边距', line: '行高' };
  let md = '# 实测设计规范（从真系统提炼）\n\n> 来源：' + dir + '\n> 样本：' + files.length + ' 个真实界面的 computed 样式\n> 规则：每个属性取出现最多的值当权威值；**一致率 100% 的可直接采用**，不到 100% 的要人工判断是特例还是错值。\n\n';
  Object.keys(spec).forEach(comp => {
    md += '## ' + (CN[comp] || comp) + '\n\n| 属性 | 权威值 | 一致率 | 样本 |\n|---|---|---|---|\n';
    Object.keys(spec[comp]).forEach(p => {
      const s = spec[comp][p];
      md += '| ' + (PN[p] || p) + ' | `' + s.value + '` | ' + s.一致率 + ' | ' + s.样本数 + ' |\n';
    });
    md += '\n';
  });
  if (conflicts.length) {
    md += '## ⚠️ 需要人工确认的分歧（' + conflicts.length + ' 处）\n\n| 组件 | 属性 | 权威值 | 一致率 | 其他出现的值 |\n|---|---|---|---|---|\n';
    conflicts.sort((a, b) => a.一致率 - b.一致率).slice(0, 40).forEach(c => {
      md += '| ' + c.组件 + ' | ' + (PN[c.属性] || c.属性) + ' | `' + c.权威值 + '` | ' + c.一致率 + '% | ' + c.分歧.join('、') + ' |\n';
    });
  }
  if (mdOut) { fs.writeFileSync(mdOut, md, 'utf8'); console.log('✅ 可读版 → ' + mdOut); }
  console.log('   组件 ' + Object.keys(spec).length + ' 类 · 需人工确认的分歧 ' + conflicts.length + ' 处');
})();
