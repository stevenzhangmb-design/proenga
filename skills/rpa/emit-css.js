#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   emit-css.js · 基线真值 → 可直接注入的 CSS 覆盖（「还原」那一半）
   ────────────────────────────────────────────────────────────────────────
   2026-10-30 建。此前整条链路只做到「抓准 + 验准」：
     routes → tokens（抽真值）→ specdiff（出基线）→ fidelity-verify（逐值卡）
   但**验出差异之后怎么把复刻件改对**，一直是人一条条手改。
   这个工具补上那一步：把基线里每个组件桶的实测值，译成对应的 CSS 规则。

   做法上有两条纪律：
     ① **只译看得见的属性**（字号/字重/色/背景/边框/圆角/内边距/行高/高），
        宽度类不译 —— 列宽随内容和容器变，写死反而错。
     ② **外层/内层分开译**：表头/表体的文字样式在内层 `.cell` 上，
        背景和边框在外层 `th`/`td` 上。混成一条规则会互相覆盖（这个坑踩过）。

   用法：
     node emit-css.js <基线.json> <输出.css> [--scope <选择器前缀>]
       --scope 把所有规则限定在某个容器内，避免污染页面其它部分
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
try { require('../_shared/qa/_tmp-sandbox'); } catch (_) {}
const fs = require('fs');

/* 桶名（组件｜场景｜变体）→ CSS 选择器。
   场景用来决定作用域：弹窗里的组件要限定在 .el-dialog 内，否则会盖住列表页的同类组件。 */
const SCENE = {
  '弹窗': '.el-dialog ', '弹窗内表': '.el-dialog ', '表单内表': '.el-form ',
  '表单': '.el-form ', '页签内表': '.el-tab-pane ', '页签内容': '.el-tab-pane ',
  '列表主表': '', '页面主区': '', '抽屉': '.el-drawer ', '确认框': '.el-message-box '
};
/* 组件 → 选择器；变体里带「EP表/原生表」的要分开（两套样式并存，见规范 §④表格） */
function selOf(comp, scene, variant) {
  const pre = SCENE[scene] !== undefined ? SCENE[scene] : '';
  const ep = /EP表/.test(variant), native = /原生表/.test(variant);
  const tbl = ep ? '.el-table ' : (native ? '.native-table-wrap ' : '');
  const V = {
    '按钮': () => {
      if (/主钮实心/.test(variant)) return '.el-button--primary';
      if (/危险钮/.test(variant)) return '.el-button--danger';
      if (/成功钮/.test(variant)) return '.el-button--success';
      if (/文字型/.test(variant)) return '.el-button.is-link,.el-button.is-text';
      return '.el-button:not(.el-button--primary):not(.el-button--danger):not(.el-button--success)';
    },
    '表头·外层th': () => tbl + 'thead th',
    '表头·内层div': () => tbl + 'thead th > .cell,' + pre + tbl + 'thead th > div',
    '表头·行tr': () => tbl + 'thead tr',
    '表体·外层td': () => tbl + 'tbody td',
    '表体·内层div': () => tbl + 'tbody td > .cell,' + pre + tbl + 'tbody td > div',
    '表体·行tr': () => tbl + 'tbody tr',
    '输入框·wrapper': () => /分页器内/.test(variant) ? '.el-pagination .el-input__wrapper' : '.el-input__wrapper',
    '输入框·inner': () => /分页器内/.test(variant) ? '.el-pagination .el-input__inner' : '.el-input__inner',
    '下拉框·wrapper': () => /分页器内/.test(variant) ? '.el-pagination .el-select__wrapper' : '.el-select__wrapper',
    '日期控件·外层': () => '.el-date-editor',
    '文本域': () => '.el-textarea__inner',
    '勾选框': () => '.el-checkbox__inner',
    '页签': () => /选中/.test(variant) && !/未选中/.test(variant) ? '.el-tabs__item.is-active' : '.el-tabs__item',
    '表单标签': () => '.el-form-item__label',
    '表单字段行': () => '.el-form-item',
    '分页条': () => '.el-pagination',
    '弹窗容器': () => '.el-dialog', '弹窗头': () => '.el-dialog__header',
    '弹窗标题': () => '.el-dialog__title', '弹窗体': () => '.el-dialog__body',
    '弹窗脚': () => '.el-dialog__footer'
  };
  const f = V[comp];
  if (!f) return null;
  return f().split(',').map(s => (pre + s).trim()).join(',\n');
}

/* 只译【看得见且稳定】的属性。宽度类一律不译：列宽随内容/容器变，写死就错。 */
const PROP = { h: 'height', font: 'font-size', weight: 'font-weight', color: 'color',
               bg: 'background-color', border: 'border', radius: 'border-radius',
               pad: 'padding', line: 'line-height' };
/* 这些组件的高度随内容变，别写死 */
const NO_H = /^(表格区|表格外框|弹窗容器|弹窗体|表单字段行|表体·内层div|表体·外层td|表体·行tr)$/;

const baseFile = process.argv[2], outFile = process.argv[3];
if (!baseFile || !outFile) { console.error('用法: node emit-css.js <基线.json> <输出.css> [--scope 前缀]'); process.exit(2); }
const si = process.argv.indexOf('--scope');
const SCOPE = si > 0 ? process.argv[si + 1].trim() + ' ' : '';
/* --important：给每条声明加 !important。
   §2026-10-30 实测发现必须有这个开关：生成的 `.el-input__wrapper{height:32px}` 写对了值，
   渲染出来却是 38px —— 被 Element Plus 自己更具体的规则（`.el-input--large .el-input__wrapper` 等）
   盖住了。这份 CSS 的用途就是**强制把框架默认值拉回真系统实测值**，
   所以覆盖场景下该用 !important；若只是生成一份参考值表，就别加。 */
const BANG = process.argv.includes('--important') ? ' !important' : '';

const base = JSON.parse(fs.readFileSync(baseFile, 'utf8'));
const rows = base.基线 || {};
let css = '/* 由 skills/rpa/emit-css.js 从实测基线生成 —— 不要手改，改基线后重新生成\n' +
          ' * 基线：' + baseFile + '\n' +
          ' * 样本：' + JSON.stringify(base.样本 || {}) + '\n' +
          ' * 只含【看得见且稳定】的属性；宽度类不写死（列宽随内容变）\n */\n\n';
let n = 0, skipped = 0;
Object.keys(rows).sort().forEach(bk => {
  const [comp, scene, variant] = bk.split('｜');
  const b = rows[bk];
  if (!b.主值) return;
  const sel = selOf(comp, scene, variant || '');
  if (!sel) { skipped++; return; }
  const decls = [];
  Object.keys(PROP).forEach(p => {
    const v = b.主值[p];
    if (v == null || v === '') return;
    if (p === 'h' && NO_H.test(comp)) return;
    if (p === 'border' && v === '无') { decls.push('border: none' + BANG + ';'); return; }
    if (p === 'border' && /\|/.test(v)) return;        // 四边不同的，交给人工处理，别乱译
    decls.push(PROP[p] + ': ' + v + BANG + ';');
  });
  if (!decls.length) return;
  n++;
  const full = sel.split(',\n').map(s => (SCOPE + s).trim()).join(',\n');
  css += '/* ' + bk + '  （纯度 ' + b.纯度 + '% · 样本 ' + b.样本 + '） */\n' +
         full + ' {\n  ' + decls.join('\n  ') + '\n}\n\n';
});
fs.writeFileSync(outFile, css, 'utf8');
console.log('✅ 生成 ' + n + ' 条规则 → ' + outFile + (skipped ? '（' + skipped + ' 个桶没有选择器映射，跳过）' : ''));
