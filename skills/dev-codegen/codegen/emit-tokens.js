#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   阶段2 A · 设计令牌导出器 · emit-tokens.js · 零依赖
   ────────────────────────────────────────────────────────────────────────
   出【设计令牌】——tokens.json（结构化）+ tokens.css（:root 变量），供【导出对接料·喂AI】
   让下游 AI 照这份"长什么样"生成符合默认设计规范(TF OMS·system-design-spec.md §8.0.2 实测)的 UI。
   令牌栈无关——任何前端框架都能吃这份色/字/间距/圆角/组件尺寸。
   用法：node emit-tokens.js <outDir> [primaryColor]     默认主色 #3363FF
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const outDir = process.argv[2];
const primary = process.argv[3] || '#3363FF';
if (!outDir) { console.error('用法: node emit-tokens.js <outDir> [primaryColor]'); process.exit(2); }

// 默认令牌（TF OMS 实测基线·system-design-spec.md §8.0.2）
const tokens = {
  _source: 'TF OMS 默认设计规范·实测基线(system-design-spec.md §8.0.2)·栈无关',
  color: {
    primary, warning: '#F2AC3A', success: '#16af78', danger: '#e15b5b',
    'text-primary': '#333333', 'text-body': '#444444', 'text-secondary': '#909399', 'text-header-gray': '#999999',
    border: '#dcdfe6', 'border-table': '#E4E7ED',
    'bg-page': '#f2f3f5', 'bg-card': '#ffffff', 'bg-table-header': '#f7f8fa', 'bg-hover': '#F5F7FA',
    'nav-bg': '#122041', 'nav-text': '#cdd8ee'
  },
  typography: {
    'font-family': "'Noto Sans SC', system-ui, 'Microsoft YaHei', sans-serif",
    'font-size-table': '14px', 'font-size-menu': '14px', 'font-size-form-label': '14px',
    'font-size-section-title': '16px', 'font-size-secondary': '13px', 'line-height-table': '23px'
  },
  spacing: { 'filter-padding': '16px 16px 0', 'form-item-gap': '16px', 'card-padding': '16px 20px' },
  radius: { base: '4px', card: '6px', 'nav-seg': '8px' },
  size: {
    'nav-height': '50px', 'control-height': '32px', 'input-inner-height': '30px',
    'button-min-width': '80px', 'button-padding': '8px 15px',
    'filter-input-width': '285px', 'filter-date-width': '427px',
    'dialog-confirm-width': '480px', 'dialog-form-width': '580px',
    'page-min-width': '1350px'
  },
  component: {
    button: { height: '32px', 'min-width': '80px', radius: '4px', 'primary-bg': primary, 'default-border': '1px solid #dcdfe6' },
    table: { 'header-color': '#999999', 'header-bg': '#f7f8fa', 'header-weight': 600, 'body-color': '#444444', 'font-size': '14px' },
    dialog: { confirm: '480px', form: '580px', radius: '4px' },
    pagination: { layout: 'total, sizes, prev, pager, next, jumper', 'page-sizes': [10, 25, 50, 100] },
    detail: { 'label-color': '#909399', 'label-font-size': '14px', 'label-margin-bottom': '8px', 'value-color': '#333333', 'back-btn': '32px×80px·居中' }
  }
};

function flatten(obj, prefix, out) {
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) continue;
    const key = prefix ? prefix + '-' + k : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = Array.isArray(v) ? v.join(', ') : v;
  }
  return out;
}
const flat = flatten(tokens, '', {});
const css = ':root {\n' + Object.entries(flat).map(([k, v]) => `  --${k}: ${v};`).join('\n') + '\n}\n';

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, 'tokens.json'), JSON.stringify(tokens, null, 2));
fs.writeFileSync(path.join(outDir, 'tokens.css'), css);
console.log('════════ 设计令牌导出（阶段2A）════════');
console.log('  主色 ' + primary + ' · 令牌 ' + Object.keys(flat).length + ' 项 → tokens.json + tokens.css');
console.log('  → ' + outDir);
process.exit(0);
