#!/usr/bin/env node
/**
 * skeleton-spec-sync-gate.js — 骨架↔规范同步闸（机器闸 / 随包发）
 *
 * 目的：防"**规范改了、骨架（实现）没跟上**"这类静默漂移。
 *   2026-07-09 真实教训：system-design-spec.md 校正了 5 处（筛选区固定宽 / 表头·分页 sticky /
 *   状态页签选中白底 / min-width 1350px / 分页 page-sizes），但 `prototype-skeleton.html`
 *   只跟上了主色 #3363FF，其余全没跟 → 装配器画出的新原型仍是旧样子，
 *   而令牌闸(㉜)只验主色/警告/分页config，**判绿了**，给了虚假的安全感。
 *
 * 本闸断言：**规范里写死的关键实现值，骨架里必须真的有。**
 *   期望值一律【从 system-design-spec.md 现场解析/引用】——规范是唯一真理源。
 *
 * 用法：node skeleton-spec-sync-gate.js
 * 退出码：0 全绿 / 1 有红（骨架没跟上规范，禁交付）/ 2 读取错。
 *
 * 注意：本闸只看【骨架标准件】，不看已交付原型（存量原型是旧骨架产物，重新装配即可，
 *       不该被本闸误拦）。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const SPEC = path.join(__dirname, '..', 'system-design-spec.md');
const SKELETON = path.join(__dirname, '..', 'components', 'prototype-skeleton.html');

function read(p, label) {
  try { return fs.readFileSync(p, 'utf8'); }
  catch (_) { console.error(`✘ 读不到 ${label}：${p}`); process.exit(2); }
}

const spec = read(SPEC, 'system-design-spec.md');
const sk = read(SKELETON, 'prototype-skeleton.html');

/* ordered(文本, [标记1,标记2,…])：断言这些标记在文本里**按给定顺序**出现。
   比"正则+字符距离窗口"稳：markup 变长（如加 SVG 图标）不会误判红。2026-07-12 改。 */
function ordered(text, marks) {
  let at = -1;
  for (const m of marks) {
    const i = text.indexOf(m, at + 1);
    if (i < 0 || i <= at) return false;
    at = i;
  }
  return true;
}

// ── 从规范里取期望值（规范是真理源；取不到就说明规范本身缺，也该红）──
function fromSpec(re, label) {
  const m = spec.match(re);
  if (!m) { console.log(`  ⚠ 规范里找不到「${label}」——先补规范再谈骨架`); return null; }
  return m[1];
}

const expect = {
  primary:   fromSpec(/--el-color-primary:\s*(#[0-9a-fA-F]{6})/, '主色'),
  warning:   fromSpec(/--el-color-warning:\s*(#[0-9a-fA-F]{6})/, '警告色'),
  pageSizes: fromSpec(/:page-sizes="(\[[^\]]+\])"/, '分页 page-sizes'),
  minWidth:  fromSpec(/min-width:\s*(1350px)/, '页面最小宽'),
  inputW:    fromSpec(/输入框\/下拉\s*\*?\*?`?(285px)`?|`(285px)`/, '筛选区输入宽') || '285px',
  dateW:     fromSpec(/日期范围\s*\*?\*?`?(427px)`?|`(427px)`/, '筛选区日期宽') || '427px',
  labelW:    fromSpec(/label\s*`?(112px)`?|`(112px)`/, '筛选区 label 宽') || '112px',
  searchBg:  fromSpec(/(#f7f8fa)/i, '筛选区背景') || '#f7f8fa',
  tabBorder: fromSpec(/(#E4E7ED)/i, '页签选中边框') || '#E4E7ED',
  tabH:      fromSpec(/(41px)/, '页签高') || '41px',
  navBg:     fromSpec(/(#F0F2F5)/i, '页签 nav 底色') || '#F0F2F5',
};

// ── 断言骨架里真的实现了 ──
const checks = [
  ['主色 EP 主题',            () => expect.primary && new RegExp(expect.primary.replace('#',''), 'i').test(sk)],
  ['警告色 EP 主题',          () => expect.warning && new RegExp(expect.warning.replace('#',''), 'i').test(sk)],
  ['分页 page-sizes == 规范',  () => expect.pageSizes && sk.replace(/\s+/g,'').includes(expect.pageSizes.replace(/\s+/g,''))],
  /* 2026-07-10 实测事故：layout 含 `sizes` 时，page-size 写成静态属性 `:page-size="25"`，
     EP 静默返回 null → **整条分页条不渲染**（生产版 Vue 不报警告）。㉜令牌闸只查"配置写了没"、
     不查"渲染出来没有"，所以长期判绿。此处硬断言必须 v-model 绑定。 */
  ['分页 sizes 必须 v-model:page-size（否则整条分页不渲染）',
    () => { const m = sk.match(/<el-pagination[^>]*>/); if (!m) return false;
            const tag = m[0]; if (!/layout="[^"]*\bsizes\b/.test(tag)) return true;
            return /v-model:page-size=/.test(tag) && !/:page-size="\d/.test(tag); }],
  ['页面 min-width 1350px',   () => /min-width:\s*1350px/.test(sk)],
  /* 🔴 2026-07-12 登录态实测校正（真系统 zgl-search-box）：旧值(210/564/112px + #f7f8fa)来自 WMS basic.scss，
     与 TF OMS 不符。真系统筛选区【无 label】、白底、字段 285px、日期 427px、padding 16px 16px 0。 */
  ['筛选区 输入/下拉 285px',   () => /\.search-box \.el-input\{width:285px/.test(sk) && /\.search-box \.el-select\{width:285px/.test(sk)],
  ['筛选区 日期范围 427px',    () => /\.search-box \.el-date-editor\{width:427px/.test(sk)],
  ['筛选区 无 label(真系统靠占位符)', () => /\.search-box \.el-form-item__label\{display:none/.test(sk)],
  ['筛选区 白底 + padding 16px 16px 0', () => /\.search-box\{background:#fff/.test(sk) && /\.search-box \.el-card__body\{padding:16px 16px 0/.test(sk)],
  ['规范已改成「无 label」范式', () => /真系统筛选区【无 label】|\*\*🔴 没有！\*\*/.test(spec)],
  ['表头 sticky 吸顶',         () => /el-table__header-wrapper\s*\{[^}]*position:\s*sticky/.test(sk)],
  ['分页 sticky 吸底',         () => /pagination-container\s*\{[^}]*position:\s*sticky[^}]*bottom:\s*0/.test(sk)],
  ['页签选中 白底+边框#E4E7ED', () => /is-active\s*\{[^}]*background:\s*#fff[^}]*#E4E7ED/i.test(sk)],
  ['页签高 41px',              () => /41px/.test(sk)],
  ['页签 nav 底 #F0F2F5',      () => /#F0F2F5/i.test(sk)],
  // §5.5 语言切换器（规范新增 → 骨架必须真有实现，否则又是"规范改了骨架没跟"）
  ['规范有 §5.5 语言切换器',    () => /### 5\.5 语言切换器/.test(spec)],
  ['骨架 LOCALE_META 含 zh/en/pt', () => /const LOCALE_META[\s\S]{0,400}?\bzh:[\s\S]{0,200}?\ben:[\s\S]{0,200}?\bpt:/.test(sk)],
  ['骨架 外壳文案字典 UI_DICT',  () => /const UI_DICT\s*=/.test(sk)],
  ['骨架 三语解析器 L()',        () => /function L\(v\)\s*\{[\s\S]{0,200}?isI18n\(v\)/.test(sk)],
  ['骨架 稳定键 K()（:key 不随语言变）', () => /const K\s*=\s*v\s*=>\s*isI18n\(v\)/.test(sk)],
  ['骨架 setLang + localStorage 记忆', () => /function setLang\([\s\S]{0,300}?__proto_lang__/.test(sk)],
  /* 窗口放宽到 3000：顶栏右侧现有 5 个控件（语言/菜单模式/消息/头像/标注），间距天然变长。
     精确顺序由下方「顶栏顺序」断言把关，本条只保证它们都在 .right 里、不是浮层。 */
  ['骨架 切换器在顶栏右侧(不浮层)', () => /<div class="right">[\s\S]{0,400}?class="langsw"[\s\S]{0,3000}?class="anno-sw"/.test(sk)],
  /* §5.3g 双菜单模式（2026-07-12 用户定）：顶部导航 ⇄ 左侧菜单可切换；
     切换器必须在【语言切换器 与 标注开关 之间】，且两种模式骨架都要真有 */
  ['规范有 §5.3g 双菜单模式可切换',   () => /双模式可切换（顶部导航\s*⇄\s*左侧菜单）/.test(spec)],
  ['骨架 菜单模式切换器在语言与标注之间', () => ordered(sk, ['class="langsw"','class="menusw"','class="anno-sw"'])],
  ['骨架 两种菜单模式都在(存在 top-only 菜单元素 + side-only 侧栏)',
    /* 2026-07-26 改成只验【功能不变量】：有元素 v-show/v-if=menuMode==='top'（顶部菜单：曾是 .topnav/.tn-mega，
       现为 .modnav，骨架重构中类名会变）+ 侧栏 <aside> 只在 side 模式出。不再钉死具体类名 → 骨架怎么重构都不误红。 */
    () => /v-(?:show|if)="menuMode==='top'"/.test(sk) && /<aside v-if="menuMode==='side'" class="sidebar"/.test(sk)],
  ['骨架 菜单模式记忆 localStorage', () => /function setMenuMode\([\s\S]{0,300}?__proto_menu__/.test(sk)],
  /* §5.3g 铁律（2026-07-26 事故根治）：多系统双行顶栏时，第二行 .modnav 承载了
     菜单模式切换器(.menusw/.mn-right)。若把整条 .modnav v-show 门控在 menuMode==='top'，
     切到左侧栏模式后切换器一起消失、再也切不回顶部。断言：
       ① .modnav 的 v-show 不含 menuMode（只按 systems.length 显隐）
       ② .modnav 内含右侧工具组 .mn-right（切换器所在）
       ③ 模块导航循环单独用 <template v-if="menuMode==='top'"> 包（只有模块随模式显隐）*/
  ['规范有「菜单模式切换按钮任何情况都不可消失」铁律',
    () => /菜单模式切换按钮任何情况都不可消失/.test(spec)],
  ['骨架 .modnav 显隐只按 systems（不被 menuMode 门控·否则切换器随第二行消失）',
    () => sk.includes('<div class="modnav" v-show="systems.length>1">') && !/<div class="modnav"[^\n]*menuMode/.test(sk)],
  ['骨架 .modnav 内含右侧工具组 .mn-right（菜单模式切换器所在·始终渲染）',
    () => ordered(sk, ['<div class="modnav"', 'class="mn-right"'])],
  ['骨架 modnav 模块导航单独 template v-if=menuMode top（只有模块随模式显隐）',
    () => ordered(sk, ['<div class="modnav"', `<template v-if="menuMode==='top'"><div v-for="(it,i) in nav"`])],
  /* §5.3f2 顶栏右侧控件固定顺序（2026-07-12 用户定）：
     多语言切换 → 菜单模式 → 消息图标 → 头像 → 标注开关。顺序被改乱即判红。 */
  ['规范有 §5.3f2 顶栏右侧固定顺序', () => /顶栏右侧控件\s*=\s*\*\*固定顺序\*\*/.test(spec)],
  ['骨架 顶栏顺序: 语言→菜单模式→消息→头像→标注',
    () => ordered(sk, ['class="langsw"','class="menusw"','class="tb-bell"','class="tb-user"','class="anno-sw"'])],
  ['骨架 消息图标带红角标 + 头像圆形', () => /class="bell-dot"/.test(sk) && /class="u-avatar"/.test(sk)],
  /* 🏛 圈选/PRD 一律以中文为准（规范 §5.5）：标注层采集当前 DOM 文字，
     葡语下圈选会把 fp_name 写成葡语、同一功能被圈成两个 PIN。骨架必须： */
  ['规范有「圈选/PRD 以中文为准」',   () => /圈选\s*\/\s*PRD 一律以中文为准/.test(spec)],
  ['骨架 开标注自动切回中文',          () => /if\(v\s*&&\s*ZH_OK\s*&&\s*lang\.value!=='zh'\)\{\s*setLang\('zh'\)/.test(sk)],
  ['骨架 标注开启期间锁定语言',        () => /function uiSetLang\([\s\S]{0,160}?annoOn\.value[\s\S]{0,80}?return/.test(sk)],
  ['骨架 切换器暴露的是 uiSetLang(非裸 setLang)', () => /setLang:uiSetLang/.test(sk)],
  ['骨架 custom 复杂页也走 L()',  () => /v-html="L\(cfg\.custom\)"/.test(sk)],
  ['骨架 非中文 label 自适应宽(葡语不换行)', () => /html:not\(\[lang\^="zh"\]\)[\s\S]{0,120}?el-form-item__label\s*\{[^}]*width:\s*auto[^}]*min-width:\s*112px/.test(sk)],
  /* 🔴 2026-08-13：换页必须退出详情页，否则上一页的详情盖住新页面（旧骨架 go() 不重置 detailData 时实测踩到，
     曾在注入层打补丁兜底；根治在骨架 go() 里 detailData.value=null 必须先于 currentPage.value=id）。
     菜单三种导航（侧栏 @select="go" / 顶栏·折叠栏 @click="go(...)"）全走 go()，此断言防回归。 */
  ['骨架 换页 go() 先清详情态再切页（detailData→null 在 currentPage 之前·防详情盖新页）',
    () => /function go\(id\)\{[^}]*detailData\.value=null[^}]*currentPage\.value=id/.test(sk)],
];

console.log('骨架↔规范同步闸 · 断言「规范写死的实现值，骨架里必须真有」');
console.log('───────────────────────────────────────');
let reds = 0;
for (const [label, fn] of checks) {
  let ok = false;
  try { ok = !!fn(); } catch (_) { ok = false; }
  if (ok) console.log(`  ✓ ${label}`);
  else { reds++; console.log(`  ✘ ${label} —— 规范有、骨架没跟上`); }
}
console.log('───────────────────────────────────────');
if (reds) {
  console.log(`骨架↔规范同步闸：有红 ✘（${reds} 项）—— 改完规范必须同步改 prototype-skeleton.html，禁交付`);
  process.exit(1);
}
console.log('骨架↔规范同步闸：全绿 ✓（规范与骨架一致）');
process.exit(0);
