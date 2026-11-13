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
                            pageForm?:{title?,sections:[{cols?,fields:[{label,required?,type?,ph?,options?,span?}]}|{title,table}],footer?},  // 整页表单页(真系统 新增/创建单·非弹窗)
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
/* 无损瘦身件展开（2026-11-13）：pd-slim.js 产出的文件顶层带 "_pdslim"（共享子树 {"$pd":"r<n>"} / 样式字典 {{pdS:n}}），
   此处还原成和原件逐键逐序相同的对象，后面一切照旧 → 原型 HTML 逐字节一致。没有 "_pdslim" 的旧数据完全不经过这里。 */
if (data && typeof data === 'object' && Object.prototype.hasOwnProperty.call(data, '_pdslim')) {
  try { data = require('../pd-slim').expand(data); } catch (e) { console.error('瘦身件展开失败: ' + e.message); process.exit(2); }
}
/* 多语标签紧凑写法展开（提速·2026-10-07）：authoring 可把标签写成 "|zh|en|pt" 一行，此处展开成 {zh,en,pt}。
   只影响【首字符是 |】的串 → 现有数据无此前缀，对现有原型是结构级 no-op（已用样本字节级验证装配前后一致）。 */
try { data = require('../i18n-compact').expandI18n(data); } catch (e) { console.error('i18n 紧凑展开失败: ' + e.message); process.exit(2); }
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
  /* 多语对象混了配置键 → 骨架 isI18n 要求"键全是语言键"，混一个 wrap/width 进去 L() 就取不到文案，
     整个 JSON 被原样打印到页面上（2026-10-06 用户在采购退货单「退货商品明细」表头逮到：
     列写成 {zh,en,pt,wrap:true}，表头显示成 { "zh": "产品", … } 一串乱码）。
     正确写法：{label:{zh,en,pt}, wrap:true} —— 语言键单独收进 label，配置键留外层。 */
  {
    const LOC = ['zh','en','pt','spa'];
    (function walk(o, path){
      if (!o || typeof o !== 'object') return;
      if (Array.isArray(o)) { o.forEach((x,i)=>walk(x, path+'['+i+']')); return; }
      const ks = Object.keys(o);
      const loc = ks.filter(k=>LOC.includes(k)), oth = ks.filter(k=>!LOC.includes(k));
      if (loc.length && oth.length) problems.push(
        `${path} 把语言键(${loc.join('/')})和配置键(${oth.join('/')})混在一个对象里 —— 页面会把整个 JSON 当文字显示。改成 {label:{${loc.join(',')}}, ${oth.join(', ')}}`);
      ks.forEach(k=>walk(o[k], path+'.'+k));
    })(d.pagecfg, 'pagecfg');
  }
  // home 每个落点必须是真实页
  for (const [sys, pid] of Object.entries(d.home || {})) {
    if (!pageIds.has(pid)) problems.push(`home["${sys}"] 指向不存在的页 "${pid}"（会点开空白）`);
  }
  // defaultSystem 必须是真实系统
  if (d.defaultSystem && !sysKeys.has(d.defaultSystem)) problems.push(`defaultSystem "${d.defaultSystem}" 不是任何 systems.key`);
  // nav 里每个页 id 必须是真实页（支持三级：组内项可再是 {group,items} 子组，递归校验叶子 [id,label]）
  // 菜单 id 允许写 "页id@状态key"（骨架 v3.37 起：点了先切页、再选中该状态）——
  // 校验时只看 @ 前面那半截是不是真实页，@ 后面的状态由页面自己的 byStatus 决定。
  const pageOf = id => String(id).split('@')[0];
  const chkNavItem = (sys, it) => {
    if (it && it.group && Array.isArray(it.items)) { for (const sub of it.items) chkNavItem(sys, sub); }
    else if (Array.isArray(it)) { if (!pageIds.has(pageOf(it[0]))) problems.push(`nav["${sys}"] 菜单项 "${it[0]}" 无对应 pagecfg（点开空白）`); }
    else if (it && it.id && !pageIds.has(pageOf(it.id))) problems.push(`nav["${sys}"] 菜单项 "${it.id}" 无对应 pagecfg（点开空白）`);
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
  // 视图（同一份原型里并存的【互相独立的登录端】，如"卖家端 / 服务商端"）：
  // data.views=[{key,label,systems:[系统key…],topbar?:{user,notif},default?:true}]。不写=今天的行为不变（只有一个视图）。
  'const VIEWS=' + JSON.stringify(data.views || []) + ';',
  // 全局流程标志位（跨页/跨视图共享的状态，如某个绑定流程走到第几步）：data.flags={名:初值}
  'const FLAG_INIT=' + JSON.stringify(data.flags || {}) + ';',
  // §v6.0 收银台模块切换抽屉（某零售系统 收银台实测：没有菜单栏，点左上角图标拉抽屉换模块）。
  // 是【整套收银台共用】的一份配置，不属于任何单页，所以走全局常量而不是 pagecfg.<页>。
  // data.posNav={title,contact,items:[{page,label,icon,tip}],backTo,backText,logoutText}
  'const POSNAV=' + JSON.stringify(data.posNav || {}) + ';',
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
// §2026-10-29 随包标注：源数据同目录的 <名>.annotations.json（按 PRD 生成的整套标注）→ 烤成 window.__USER_ANNOTATIONS__。
// 为什么：交付件每次都从源数据整份重新装配，以前烤进文件的标注一重建就没了（用户 10-29 要「不圈选也能看到每个功能点的标注」）。
// 标注层只在本浏览器从没存过标注时读它（见 annotation-layer _loadPins），不会盖掉用户自己改过的。
{ const annoPath = dataPath.replace(/\.json$/i, '.annotations.json');
  if (fs.existsSync(annoPath)) { const pins = JSON.parse(fs.readFileSync(annoPath, 'utf8'));
    const js = JSON.stringify(Array.isArray(pins) ? pins : []).replace(/<\/script/gi, '<\\/script');
    out = out.replace('window.__PRD_DATA__=', () => 'window.__USER_ANNOTATIONS__=' + js + ';window.__PRD_DATA__='); } }
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
// ㊲ 证件号校验默认表：各地区证件的【位数+提示】集中放这里（装配器=构建工具·非㊲扫描的 3 个共享 HTML），
// 骨架 brTaxIdErr 读 window.__ID_KINDS__[fd.cpfCnpj]，使共享骨架不含任何地区业务词；项目可用 data.idKinds 覆盖/扩展。
const ID_KINDS = Object.assign({
  cnpj: { len: [14], msg: '请输入 14 位 CNPJ（如 18.802.430/0001-92）' },
  cpf: { len: [11], msg: '请输入 11 位 CPF（如 398.712.455-09）' },
  both: { len: [11, 14], msg: '请输入 11 位 CPF 或 14 位 CNPJ（如 398.712.455-09 / 18.802.430/0001-92）' }
}, data.idKinds || {});
out = R(out, '@@ID_KINDS@@', JSON.stringify(ID_KINDS));
out = R(out, '@@ANNOTATION_LAYER@@', layer);

const leftover = (out.match(/@@[A-Z_]+@@/g) || []);
if (leftover.length) { console.error('骨架仍有未填孔位: ' + [...new Set(leftover)].join(', ')); process.exit(2); }

fs.writeFileSync(outPath, out, 'utf8');
console.log('✅ 已装配 → ' + outPath + '（' + Math.round(out.length / 1024) + ' KB chars）');
console.log('   标准部件来自 prototype-skeleton.html + annotation-layer.html（程序逐字复制，AI 未手写）');

/* ══ 装配即体检（2026-09-10·根治"依赖用户动作/Stop钩子才触发"的死穴）══
   把布局体检 + 复刻保真焊进装配这一步——它是产出原型的【唯一必经关卡】，纯 node、任何 AI 工具都走，
   零用户动作、零对话指令即自动跑。默认开；迭代期传 --fast 跳过浏览器闸只求秒级预览。
   两道闸本身在缺 Chrome/vendor 时会优雅 SKIP(exit 0)，不会卡死没浏览器的机器。 */
const FAST = process.argv.includes('--fast');
// ★ 防递归：布局/保真闸内部会调用本装配器渲染 fixture；那些内层调用带 __ASM_NOCHECK__=1 → 本段跳过，杜绝 assemble↔gate 互相 fork 的死循环。
if (FAST) { console.log('   ⏩ --fast：跳过体检（迭代预览）·交付前请去掉 --fast 让装配自动体检'); process.exit(0); }
if (process.env.__ASM_NOCHECK__) { process.exit(0); }
const { execFileSync } = require('child_process');
const gates = [
  { name: '布局体检(不挤不重叠不横滚)', file: 'layout-sanity-gate.js', args: [dataPath] },
  { name: '复刻保真(禁画蛇添足)', file: 'fidelity-gate.js', args: [dataPath] },  // 无 _fidelityBaseline 时自动 SKIP
];
let red = 0;
for (const g of gates) {
  const gp = path.join(__dirname, g.file);
  if (!fs.existsSync(gp)) { console.warn('   ⚠ 跳过 ' + g.name + '（缺 ' + g.file + '）'); continue; }
  try { execFileSync('node', [gp, ...g.args], { stdio: 'inherit', timeout: 180000, env: { ...process.env, __ASM_NOCHECK__: '1' } }); console.log('   ✅ ' + g.name + ' 通过/跳过'); }
  catch (e) { red++; console.error('   ❌ ' + g.name + ' 未通过（见上）'); }
}
if (red) { console.error('\n装配产物未过体检 —— 禁交付。先修上面红项；迭代快速预览可加 --fast 跳过体检。'); process.exit(3); }
console.log('   ✅ 装配即体检全绿（布局 + 保真）');
/* ══ 轻量绿标记 .assemble-check-green（2026-09-10·提速分流·配合 Stop 钩子）══
   装配器当场跑过的 layout + fidelity 两道快闸【全绿】才刷新它（含时间戳）。
   Stop 钩子据此分流：只改内容(交付原型变新但标准件没变)时——只要该原型不比本标记新，
   即认「这次改动已被装配器快闸覆盖过」→ 放行，不再逼跑几十道 headless 的完整 deliver-gate。
   ★ 仅在此【快闸全绿】路径写；--fast 跳过体检、__ASM_NOCHECK__ 内层递归、体检红 都不写。 */
try {
  const AMARK = path.join(__dirname, '.assemble-check-green');
  fs.writeFileSync(AMARK, JSON.stringify({ at: Date.now(), iso: new Date().toISOString(), out: outPath }), 'utf8');
} catch (_) {}
process.exit(0);
