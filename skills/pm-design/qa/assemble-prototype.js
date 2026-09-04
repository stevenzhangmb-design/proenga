#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   原型装配器 · assemble-prototype.js · 维护者/AI 生成工具（随包发）
   ────────────────────────────────────────────────────────────────────────
   终极根治"AI 手搓标准部件出错"：把"画原型"从【AI 手写 HTML】换成
   【AI 只产纯 JSON 项目数据 + 程序确定性装配】。标准部件（顶栏/工具条/渲染器/
   glue/正确的助手顺序·IIFE·显式闭合）全在 components/prototype-skeleton.html 里固定，
   本程序逐字复制——AI 一个字都不重打 → 标准部件漂移=结构上不可能。

   用法：node assemble-prototype.js <project-data.json> <输出原型.html>
   项目数据(纯 JSON·schema 见 examples/project-data.schema.json)：
     { title, systemName, theme:{primary,sidebarBg},
       systems:[{key,label}], home:{<sysKey>:<pageId>},
       nav:{<sysKey>:[ {id,label} | {group,items:[[id,label],...]} ]},
       pagecfg:{ <pageId>:{ banner?, stats?:[[label,value,hint,cls]],
                            chart?:{title,values:[..]}, donut?:{title,label,grad,items:[[名,值,色]]},
                            filters?, listTitle?, columns?:[...], rows?:[[cell|{t,c}, ...]], actions?,
                            custom?:'<原始HTML>', note?:'页脚说明', building? } } }
     ★ rows 为纯二维数组；标签单元写 {"t":"文本","c":"green"}（禁任何函数调用）。
   退出码：0 成功；2 用法/读取错误。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const dataPath = process.argv[2];
const outPath = process.argv[3];
if (!dataPath || !outPath) {
  console.error('用法: node assemble-prototype.js <project-data.json> <输出原型.html>');
  process.exit(2);
}
const COMP = path.join(__dirname, '..', 'components');
let data, skeleton, layer;
try { data = JSON.parse(fs.readFileSync(dataPath, 'utf8').replace(/^﻿/, '')); }
catch (e) { console.error('读取/解析 project-data 失败: ' + e.message); process.exit(2); }
try { skeleton = fs.readFileSync(path.join(COMP, 'prototype-skeleton.html'), 'utf8'); }
catch (e) { console.error('读取 prototype-skeleton.html 失败: ' + e.message); process.exit(2); }
try { layer = fs.readFileSync(path.join(COMP, 'annotation-layer.html'), 'utf8'); }
catch (e) { console.error('读取 annotation-layer.html 失败: ' + e.message); process.exit(2); }

/* ── 构建时数据校验（彻底根治「数据填错→原型空白/断裂」这一类·一个杠杆管全部·零依赖·2026-07-11）──
   只拦【真会导致断裂】的错：home/nav 指向不存在的页(=点开空白)、defaultSystem 非法、select 无选项。
   命中即在【装配时】报清所有问题并退出(码2)，不等到用户在浏览器里撞见。低误报：合法原型本就满足。 */
function validateData(d){
  const problems = [];
  const pages = d.pagecfg || {};
  const pageIds = new Set(Object.keys(pages));
  const sysKeys = new Set((d.systems || []).map(s => s.key));
  // home 每个落点必须是真实页
  for (const [sys, pid] of Object.entries(d.home || {})) {
    if (!pageIds.has(pid)) problems.push(`home["${sys}"] 指向不存在的页 "${pid}"（会点开空白）`);
  }
  // defaultSystem 必须是真实系统
  if (d.defaultSystem && !sysKeys.has(d.defaultSystem)) problems.push(`defaultSystem "${d.defaultSystem}" 不是任何 systems.key`);
  // nav 里每个页 id 必须是真实页（支持三级：组内项可再是 {group,items} 子组，递归校验叶子 [id,label]）
  const chkNavItem = (sys, it) => {
    if (it && it.group && Array.isArray(it.items)) { for (const sub of it.items) chkNavItem(sys, sub); }
    else if (Array.isArray(it)) { if (!pageIds.has(it[0])) problems.push(`nav["${sys}"] 菜单项 "${it[0]}" 无对应 pagecfg（点开空白）`); }
    else if (it && it.id && !pageIds.has(it.id)) problems.push(`nav["${sys}"] 菜单项 "${it.id}" 无对应 pagecfg（点开空白）`);
  };
  for (const [sys, groups] of Object.entries(d.nav || {})) {
    for (const it of (groups || [])) chkNavItem(sys, it);
  }
  // 表单 select 必须有 options（否则是个填不了的空下拉）
  (function walk(n){ if(!n||typeof n!=='object') return; if(Array.isArray(n)){ n.forEach(walk); return; }
    if(n.type==='select' && (!Array.isArray(n.options)||!n.options.length)) problems.push(`有一个 select 字段「${(n.label&&(n.label.zh||n.label))||'?'}」没有 options（空下拉）`);
    for(const k in n) if(k!=='options') walk(n[k]); })(pages);
  if (problems.length) { console.error('project-data 校验未过（先修数据再装配）：\n  - ' + problems.join('\n  - ')); process.exit(2); }
}
validateData(data);

const theme = data.theme || {};
// 三语文案对象 {"zh":..,"en":..,"pt":..} 取原始键（title/systemName 等"必须是纯字符串"的位置用）
const pick = v => (v && typeof v === 'object' && !Array.isArray(v)) ? (v.zh || Object.values(v)[0] || '') : v;
const projectDataJs = [
  'const SYSTEM_NAME=' + JSON.stringify(pick(data.systemName) || pick(data.title) || '原型') + ';',
  'const SYSTEMS=' + JSON.stringify(data.systems || []) + ';',
  'const HOME=' + JSON.stringify(data.home || {}) + ';',
  'const NAV=' + JSON.stringify(data.nav || {}) + ';',
  // 默认落地系统（多模块顶栏时用：顶栏可"首页在前"但打开直接进指定模块）；缺省=第一个系统
  'const DEFAULT_SYS=' + JSON.stringify(data.defaultSystem || null) + ';',
  // 顶栏用户区（真系统：账号名 + 圆头像 + 🔔红角标）；project-data 写 topbar:{user:"admin",notif:33}
  'const PROJECT_TOPBAR=' + JSON.stringify(data.topbar || {}) + ';',
  'const PAGECFG=' + JSON.stringify(data.pagecfg || {}) + ';'
].join('\n  ');

// 全部用【函数替换器】注入，杜绝值里的 $（如 R$ 金额）被 String.replace 当成 $&/$1 替换花样
const R = (s, marker, value) => s.replace(marker, () => value);
let out = skeleton;
out = out.replace(/@@TITLE@@/g, () => String(pick(data.title) || pick(data.systemName) || '原型'));
// 品牌 logo 字母（顶栏方块标）：data.logo 优先，否则取名称首个词/首字母，纯 CSS 渲染、离线零依赖
out = out.replace(/@@LOGO@@/g, () => {
  const raw = String(data.logo || pick(data.systemName) || pick(data.title) || 'P').trim();
  return raw.length <= 3 ? raw : raw.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase() || raw.slice(0, 1);
});
out = out.replace(/@@PRIMARY@@/g, () => String(theme.primary || '#3363ff'));  // 默认 TF 主色(system-design-spec.md)；自定义规范传 theme.primary 覆盖
out = out.replace(/@@SIDEBAR_BG@@/g, () => String(theme.sidebarBg || '#172133'));
out = R(out, '@@PROJECT_DATA_JS@@', projectDataJs);
// __PRD_DATA__ 注入字面量（含 "system_name":"..." 供 anno-server 静态匹配回写；function_points 由圈选/注入回路填）
out = R(out, '@@PRD_DATA@@', JSON.stringify({ system_name: pick(data.systemName) || pick(data.title) || '原型', page_menus: data.page_menus || {}, function_points: {} }));
// __DESIGN_CHOICE__：把四问答案烙进原型，供 choice-conformance-gate 自检"原型==所选"。
// 由画原型流程传 data.choice（或 data.region/currency）；缺则退默认 CN·b端·单语中文。
const choice = Object.assign(
  { ui: 'default', form: 'b-admin',
    region: data.region || 'CN',
    currency: data.currency || (data.region === 'BR' ? 'BRL' : 'CNY'),
    timezone: data.timezone || (data.region === 'BR' ? 'America/Sao_Paulo' : 'Asia/Shanghai'),
    // §5.5 多语言：locales 缺省单语中文（向后兼容旧 project-data）；多语原型传 ["zh","en","pt"]
    locales: data.locales || ['zh'],
    defaultLocale: data.defaultLocale || (data.locales && data.locales[0]) || 'zh' },
  data.choice || {}
);
if (!Array.isArray(choice.locales) || !choice.locales.length) choice.locales = ['zh'];
if (!choice.locales.includes(choice.defaultLocale)) choice.defaultLocale = choice.locales[0];
out = R(out, '@@DESIGN_CHOICE@@', JSON.stringify(choice));
out = R(out, '@@ANNOTATION_LAYER@@', layer);

const leftover = (out.match(/@@[A-Z_]+@@/g) || []);
if (leftover.length) { console.error('骨架仍有未填孔位: ' + [...new Set(leftover)].join(', ')); process.exit(2); }

fs.writeFileSync(outPath, out, 'utf8');
console.log('✅ 已装配 → ' + outPath + '（' + Math.round(out.length / 1024) + ' KB chars）');
console.log('   标准部件来自 prototype-skeleton.html + annotation-layer.html（程序逐字复制，AI 未手写）');
console.log('   下一步建议：node prototype-pmdesign-gate.js "' + outPath + '"  并浏览器加载验真挂载');
process.exit(0);
