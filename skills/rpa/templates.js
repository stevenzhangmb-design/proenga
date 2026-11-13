#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   templates.js · 真系统【页型模板】蒸馏器 —— 把 344 页实测结构变成可直接拷的配置
   ────────────────────────────────────────────────────────────────────────
   2026-11-04 建。补的是「画原型还是自由发挥」四个走样入口里的第 ②：

     规范 system-design-spec.md 有 2100 行，是**给人读的文档**。
     画原型时要把它"翻译"成 project-data 的 JSON 配置，**每翻译一次就走样一次**：
     列表页该有几个筛选控件？表单该几列？label 在上还是在左？字段行距多少？
     页脚按钮居中还是右对齐？—— 这些真系统里都有确定答案，
     可它们散在 2100 行文字和 344 份结构 JSON 里，没人（包括我）每次都去翻。

   这个工具把答案**固化成每种页型一份模板**，画新页 = 拷模板改字段名，
   不再从零写、不再凭印象。

   纪律（和 distill.js 一致，不"对个大概"）：
     · 每个属性统计所有样本 → 出现最多的值 = 众数
     · 一致率 100%        → 这条可以直接写进模板
     · 一致率不到 100%    → **把分歧值和出处全列出来**，让人判断是特例还是错值
     不写"大概是 2 列"这种话 —— 要么给确定值，要么把分歧摆出来。

   用法：
     node templates.js <layout.js 的输出目录> <输出目录>
   产出：
     page-templates.json   每种页型的结构统计（众数 + 一致率 + 分歧）
     page-templates.md     可直接拷的 project-data 片段 + 真值依据
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
try { require('../_shared/qa/_tmp-sandbox'); } catch (_) {}
const fs = require('fs');
const path = require('path');

const srcDir = process.argv[2], outDir = process.argv[3];
if (!srcDir || !outDir) {
  console.error('用法: node templates.js <layout输出目录> <输出目录>');
  process.exit(2);
}
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

/* 读所有 *.layout.json（不读 _汇总.json，免得同一页算两遍） */
const pages = [];
fs.readdirSync(srcDir).filter(f => /\.layout\.json$/.test(f)).forEach(f => {
  try {
    const d = JSON.parse(fs.readFileSync(path.join(srcDir, f), 'utf8'));
    d._name = f.replace('.layout.json', '');
    pages.push(d);
  } catch (_) {}
});
if (!pages.length) { console.error('目录里没有 *.layout.json'); process.exit(1); }

/* ── 统计器：收每个属性的所有取值，出众数 + 一致率 + 分歧 ───────────────── */
function stat(samples, label) {
  const vals = samples.filter(s => s.v != null && s.v !== '' && s.v !== '?');
  if (!vals.length) return null;
  const cnt = {};
  vals.forEach(s => { const k = JSON.stringify(s.v); (cnt[k] = cnt[k] || { n: 0, from: [] }); cnt[k].n++; if (cnt[k].from.length < 4) cnt[k].from.push(s.p); });
  const sorted = Object.entries(cnt).sort((a, b) => b[1].n - a[1].n);
  const [topK, top] = sorted[0];
  const rate = Math.round(top.n / vals.length * 100);
  return {
    项: label, 众数: JSON.parse(topK), 样本: vals.length, 一致率: rate,
    直接可用: rate === 100,
    分歧: rate === 100 ? null : sorted.slice(1, 6).map(([k, o]) => ({ 值: JSON.parse(k), 次数: o.n, 出处: o.from }))
  };
}
const pick = (arr, fn) => arr.map(p => ({ v: (() => { try { return fn(p); } catch (_) { return null; } })(), p: p._name }));

/* ── 页型分组 ───────────────────────────────────────────────────────────── */
const byType = {};
pages.forEach(p => { const t = p.页型 || '其它'; (byType[t] = byType[t] || []).push(p); });

const out = { 抽取时间: new Date().toISOString().slice(0, 10), 样本总数: pages.length, 页型分布: {}, 模板: {} };
Object.keys(byType).forEach(t => { out.页型分布[t] = byType[t].length; });

/* ── 列表页 ─────────────────────────────────────────────────────────────── */
const lists = pages.filter(p => p.列表);
if (lists.length) {
  out.模板['列表页'] = {
    样本: lists.length,
    筛选区: [
      stat(pick(lists.filter(p => p.筛选区), p => p.筛选区.行数), '筛选区行数'),
      stat(pick(lists.filter(p => p.筛选区), p => p.筛选区.控件数), '筛选控件个数'),
      stat(pick(lists.filter(p => p.筛选区), p => p.筛选区.查询钮位置), '查询/重置的位置'),
      stat(pick(lists.filter(p => p.筛选区), p => p.筛选区.有折叠), '有没有展开/收起')
    ].filter(Boolean),
    列表: [
      stat(pick(lists, p => p.列表.实现), '表格实现'),
      stat(pick(lists, p => p.列表.勾选列位置), '勾选列位置'),
      stat(pick(lists, p => p.列表.操作列位置), '操作列位置'),
      stat(pick(lists, p => p.列表.行操作形态), '行操作形态'),
      stat(pick(lists, p => p.列表.行高), '行高'),
      stat(pick(lists.filter(p => p.列表.分页), p => p.列表.分页.对齐), '分页对齐')
    ].filter(Boolean),
    列数分布: (() => {
      const c = {}; lists.forEach(p => { const n = p.列表.列数; c[n] = (c[n] || 0) + 1; });
      return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([n, k]) => n + ' 列 ×' + k);
    })(),
    状态页签: [
      stat(pick(lists.filter(p => p.状态页签), p => p.状态页签.形态), '页签形态'),
      stat(pick(lists.filter(p => p.状态页签), p => p.状态页签.位置), '页签位置'),
      stat(pick(lists.filter(p => p.状态页签), p => p.状态页签.页签数), '页签个数')
    ].filter(Boolean),
    有状态页签的页: lists.filter(p => p.状态页签).length + '/' + lists.length,
    工具条按钮词频: (() => {
      const c = {};
      lists.forEach(p => (p.工具条 && p.工具条.按钮 || []).forEach(b => { const t = (b.文案 || '').trim(); if (t) c[t] = (c[t] || 0) + 1; }));
      return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([k, n]) => k + ' ×' + n);
    })(),
    右端图标: (() => {
      const c = {};
      lists.forEach(p => (p.工具条 && p.工具条.右端图标 || []).forEach(i => {
        const k = (i.名 || i.类名 || '?').replace(/el-tooltip__trigger/g, '').trim() + ' ' + i.宽 + 'x' + i.高;
        c[k] = (c[k] || 0) + 1;
      }));
      return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => k + ' ×' + n);
    })()
  };
}

/* ── 表单页（新增 / 编辑）────────────────────────────────────────────────── */
const forms = pages.filter(p => p.表单);
if (forms.length) {
  const whole = forms.filter(p => /整页/.test(p.表单.形态));
  const dlg = forms.filter(p => /弹窗/.test(p.表单.形态));
  const mk = (arr, nm) => arr.length ? {
    样本: arr.length,
    结构: [
      stat(pick(arr, p => p.表单.列数), '几列'),
      stat(pick(arr, p => p.表单.label位置), 'label 位置'),
      stat(pick(arr, p => p.表单.字段行距), '字段行距'),
      stat(pick(arr, p => p.表单.必填星号), '必填星号'),
      stat(pick(arr, p => p.表单.页脚对齐), '页脚按钮对齐'),
      stat(pick(arr, p => p.表单.页脚固定), '页脚是否固定'),
      stat(pick(arr.filter(p => p.表单.label样式), p => p.表单.label样式.fontSize), 'label 字号'),
      stat(pick(arr.filter(p => p.表单.label样式), p => p.表单.label样式.color), 'label 颜色')
    ].filter(Boolean),
    分组: [
      stat(pick(arr, p => p.表单.分组卡片数), '分组卡片数'),
      stat(pick(arr, p => !!p.表单.左侧锚点导航), '有没有左侧锚点侧栏')
    ].filter(Boolean),
    字段数分布: (() => {
      const c = {}; arr.forEach(p => { const n = p.表单.字段数; const b = n <= 5 ? '1-5' : n <= 10 ? '6-10' : n <= 20 ? '11-20' : '20+'; c[b] = (c[b] || 0) + 1; });
      return Object.entries(c).sort((a, b) => b[1] - a[1]).map(([k, n]) => k + ' 个 ×' + n);
    })(),
    页脚按钮词频: (() => {
      const c = {};
      arr.forEach(p => (p.表单.页脚按钮 || []).forEach(b => { const t = (b.文案 || '').trim(); if (t) c[t] = (c[t] || 0) + 1; }));
      return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => k + ' ×' + n);
    })()
  } : null;
  out.模板['整页表单（新增/编辑）'] = mk(whole, '整页');
  out.模板['弹窗表单'] = mk(dlg, '弹窗');
  if (dlg.length) {
    const w = {}; dlg.forEach(p => { const m = /(\d+)px/.exec(p.表单.形态 || ''); if (m) w[m[1]] = (w[m[1]] || 0) + 1; });
    out.模板['弹窗表单'].宽度分布 = Object.entries(w).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, n]) => k + 'px ×' + n);
  }
}

/* ── 详情 / 查看页 ──────────────────────────────────────────────────────── */
const dets = pages.filter(p => p.详情);
if (dets.length) {
  out.模板['详情/查看页'] = {
    样本: dets.length,
    结构: [
      stat(pick(dets, p => p.详情.形态), '实现形态'),
      stat(pick(dets, p => p.详情.栏数), '几栏'),
      stat(pick(dets, p => p.详情.有页签), '页内页签数'),
      stat(pick(dets, p => !!p.详情.内嵌明细表), '有没有内嵌明细表')
    ].filter(Boolean)
  };
}

/* ── 全局：菜单 / 多标签工作区 ──────────────────────────────────────────── */
out.模板['全局框架'] = {
  样本: pages.length,
  导航: [
    stat(pick(pages.filter(p => p.菜单), p => p.菜单.导航形态), '导航形态'),
    stat(pick(pages.filter(p => p.菜单), p => p.菜单.顶栏实现), '顶栏实现'),
    stat(pick(pages.filter(p => p.菜单), p => p.菜单.顶栏一级.length), '顶栏一级菜单数')
  ].filter(Boolean),
  多标签工作区: [
    stat(pick(pages.filter(p => p.多标签页工作区), p => p.多标签页工作区.形态), '标签形态'),
    stat(pick(pages.filter(p => p.多标签页工作区), p => p.多标签页工作区.条高), '标签条高'),
    stat(pick(pages.filter(p => p.多标签页工作区), p => p.多标签页工作区.可关闭), '可关闭比例')
  ].filter(Boolean),
  有多标签工作区的页: pages.filter(p => p.多标签页工作区).length + '/' + pages.length
};

fs.writeFileSync(path.join(outDir, 'page-templates.json'), JSON.stringify(out, null, 2), 'utf8');

/* ── 出 Markdown：可直接拷的 project-data 片段 ──────────────────────────── */
function fmtStats(rows) {
  if (!rows || !rows.length) return '（无样本）\n';
  let s = '| 项 | 真系统实测 | 样本 | 一致率 | 分歧 |\n|---|---|---|---|---|\n';
  rows.forEach(r => {
    const d = r.直接可用 ? '—' : (r.分歧 || []).map(x => JSON.stringify(x.值) + '×' + x.次数).join('；');
    s += '| ' + r.项 + ' | `' + JSON.stringify(r.众数) + '` | ' + r.样本 + ' | ' + r.一致率 + '% | ' + d + ' |\n';
  });
  return s;
}
let md = '# 真系统页型模板（从 ' + pages.length + ' 页实测结构蒸馏）\n\n';
md += '> 抽取日期：' + out.抽取时间 + '　来源：某 OMS / WMS 冻结件 → `skills/rpa/layout.js` → 本文件\n';
md += '> **用法：画新页时拷下面对应页型的片段，改字段名即可，别从零写、别凭印象。**\n';
md += '> 一致率 100% 的行可直接照抄；不到 100% 的把分歧列在最后一列，自己判断是特例还是错值。\n\n';
/* 诚实标注数据缺陷 —— 一份自称"真值"的文档，最怕的是里面混着不可信的数字而不说。 */
md += '## ⚠️ 这份数据里不可信的部分（别拿它当真值）\n\n';
const badRight = (out.模板['列表页'] && (out.模板['列表页'].右端图标 || []).length === 0);
if (badRight) md += '- **「右端图标」是空的** —— 不代表真系统没有刷新图标。原因是这批结构数据抽取时 `layout.js` 还没有「右端图标」这一维；\n' +
                    '  2026-11-04 单独重抽 5 个模块页实测过：刷新图标 class `el-icon refresh-icon`、**20×20**、在工具条行最右。要补齐这一维得整批重抽。\n';
const detTab = (out.模板['详情/查看页'] && (out.模板['详情/查看页'].结构 || []).find(r => r && r.项 === '页内页签数'));
if (detTab && detTab.众数 > 20) md += '- **「页内页签数」数值荒谬（' + detTab.众数 + '）** —— 旧版 `detailArea` 把顶栏导航和多标签工作区的页签也数了进去。\n' +
                    '  这个 bug 已在 2026-11-04 修掉（加 `top>=100` 过滤），但这批数据是修之前抽的。重抽后才准。\n';
md += '- 「字段行距」「行高」「筛选控件个数」一致率偏低是**正常的**：它们本来就随内容变，不是该写死的值。\n\n';
md += '## 页型分布\n\n' + Object.entries(out.页型分布).map(([k, v]) => '- ' + k + '：' + v + ' 页').join('\n') + '\n\n';

Object.keys(out.模板).forEach(t => {
  const m = out.模板[t];
  if (!m) return;
  md += '\n## ' + t + '（样本 ' + m.样本 + ' 页）\n\n';
  Object.keys(m).forEach(sec => {
    if (sec === '样本') return;
    const v = m[sec];
    md += '### ' + sec + '\n\n';
    if (Array.isArray(v) && v.length && v[0] && v[0].项) md += fmtStats(v) + '\n';
    else if (Array.isArray(v)) md += v.map(x => '- ' + x).join('\n') + '\n\n';
    else md += '`' + JSON.stringify(v) + '`\n\n';
  });
});

/* 可直接拷的配置片段 —— 这是这份文档最该被用到的部分 */
md += '\n---\n\n## 可直接拷的 project-data 片段\n\n';
md += '> 骨架 v7.0 起，**勾选列 / 导出∨ / 自定义列⚙ / 刷新⟳ 四件是默认就有的**，不用写。\n';
md += '> 下面片段里只写那些**必须按页填**的东西。\n\n';
md += '### 列表页\n\n```json\n' + JSON.stringify({
  listTitle: '<列表标题>',
  filters: [{ label: '<字段名>', type: 'input', ph: '请输入' }, { label: '<字段名>', type: 'select', options: ['全部'] }],
  statusTabs: [{ key: 't0', label: '全部', count: 0, rows: [], total: 0 }],
  columns: ['<列1>', '<列2>', { label: '操作', width: 160 }],
  rows: [],
  actions: [{ label: '查看', opens: '<详情页或弹窗>' }],
  selectActions: [{ label: '<批量动作>', needSel: true }],
  primaryBtn: { label: '新增', goto: '<新增页>' }
}, null, 2) + '\n```\n\n';
md += '### 整页表单（新增/编辑）\n\n```json\n' + JSON.stringify({
  sections: [{ title: '基本信息', fields: [{ label: '<字段>', type: 'input', required: true, ph: '请输入' }] }],
  okText: '提交'
}, null, 2) + '\n```\n\n';
md += '### 详情/查看页\n\n```json\n' + JSON.stringify({
  readonly: true,
  sections: [{ title: '基本信息', fields: [{ label: '<字段>', type: 'readonly', value: '<值>' }] },
             { title: '明细', tabs: [{ table: { columns: ['<列1>'], rows: [] } }] }]
}, null, 2) + '\n```\n';

fs.writeFileSync(path.join(outDir, 'page-templates.md'), md, 'utf8');
console.log('✅ 页型模板已蒸馏（样本 ' + pages.length + ' 页）→ ' + outDir);
Object.entries(out.页型分布).forEach(([k, v]) => console.log('   ' + k + '：' + v + ' 页'));
