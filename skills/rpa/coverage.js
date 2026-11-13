#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   coverage.js · 抓取覆盖率自检 —— 漏了要报警，而不是静悄悄少抓
   ────────────────────────────────────────────────────────────────────────
   2026-10-29 建。为什么必须有：

     deepcrawl 抓完只在控制台滚一堆行，没有人去数"到底漏了几个"。
     2026-10-29 实测：78 个入口里 19 个标着「点了没反应」—— 我之前凭印象
     跟用户说的是"5 处"，少报了 14 个。**静默漏抓比报错危险**：
     真值少了一截，提炼出来的规范就是残的，而所有人都以为抓全了。

   但"点了没反应"不等于"漏抓"，混在一起报会让这个数字失去意义：
     · 【清空/重置/刷新】这类按钮**本来就不开新界面**，没反应是正常的；
     · 同一个入口被重复点了两次（抓取器去重没做干净），重复的那次不该算漏；
     · 真正要查的是：该开弹窗/详情却什么都没发生的那些。

   所以这里分四类报，并且只拿【疑似漏抓】去判红。

   用法：
     node coverage.js <抓取报告目录> [--max-miss N]   默认 N=0，有疑似漏抓就红
   退出码：0 = 没有疑似漏抓；1 = 有。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
try { require('../_shared/qa/_tmp-sandbox'); } catch (_) {}
const fs = require('fs');
const path = require('path');

/* 这些按钮按设计就不开新界面，点了"没反应"是对的 —— 别算进漏抓 */
const NO_VIEW = /^(清空|重置|刷新|全选|反选|取消|收起|展开|关闭|返回|排序|筛选)$/;
/* 第二类"正常没反应"：**行内复制图标**。
   行操作第一个位置是 `IMG.copy-icon`，**尺寸 0×0、hover 行才显形**，点不到，
   而且复制本来就不开新界面 —— 这类算漏抓会把覆盖率压成假数字。

   ⚠️ 2026-10-29 更正（我上一版在这里写错了）：我曾把聚合格里的
   「SKU编号:xxx」「出库订单号：xxx」也归成"复制类"。**实测推翻了**：
   deepcrawl 点它时节点数 3672 → 4568（多出近 900 个），说明它触发的是
   **行内展开**（把该订单的其余商品展开出来），不是复制。
   所以这类文本【不能】当成"正常没反应"放过 —— 它是真交互，抓取必须覆盖。 */
const COPYISH_ICON = /^图标1$/;   // 行操作第一个位置固定是复制图标（实测 IMG.copy-icon·0×0）

const dir = process.argv[2];
if (!dir) { console.error('用法: node coverage.js <抓取报告目录> [--max-miss N]'); process.exit(2); }
const mi = process.argv.indexOf('--max-miss');
const MAX_MISS = mi > 0 ? +process.argv[mi + 1] : 0;

const files = fs.readdirSync(dir).filter(f => /深层抓取报告\.json$/.test(f));
if (!files.length) { console.error('目录里没有 *深层抓取报告.json'); process.exit(1); }

const got = [], noView = [], dup = [], miss = [], copyish = [];
const seen = new Set();
files.forEach(fn => {
  const page = fn.replace('-深层抓取报告.json', '');
  let arr; try { arr = JSON.parse(fs.readFileSync(path.join(dir, fn), 'utf8')); } catch (_) { return; }
  arr.forEach(it => {
    const key = page + '｜' + it.kind + '｜' + (it.text || '');
    const rec = { 页: page, 入口: it.text, 类型: it.kind, 结果: it.result };
    if (seen.has(key)) { dup.push(rec); return; }   // 重复入口：抓取器去重没做干净，不算漏
    seen.add(key);
    if (it.result === '按设计不开新界面') { noView.push(rec); return; }
    if (it.result !== '点了没反应') { got.push(rec); return; }
    const t = String(it.text || '').trim();
    if (NO_VIEW.test(t)) { noView.push(rec); return; }
    /* 复制类：单号/SKU 文本，或行操作第一个位置的复制图标 */
    if (it.kind === 'rowAction' && COPYISH_ICON.test(t)) { copyish.push(rec); return; }
    miss.push(rec);
  });
});

const total = got.length + noView.length + copyish.length + miss.length;
const rate = (got.length + miss.length) ? Math.round(got.length / (got.length + miss.length) * 100) : 100;

console.log('【抓取覆盖率自检】' + dir);
console.log('  页面 ' + files.length + ' 个 · 去重后入口 ' + total + ' 个' + (dup.length ? '（另有 ' + dup.length + ' 个重复入口，已排除）' : ''));
console.log('  ✅ 抓到了 ' + got.length);
console.log('  · 按设计不开新界面（清空/重置这类）' + noView.length + ' —— 不算漏');
console.log('  · 点击行为是【复制】（行内复制图标·0×0 hover 才显形）' + copyish.length + ' —— 不算漏');
console.log('  ' + (miss.length ? '🔴' : '✅') + ' 疑似漏抓 ' + miss.length);
console.log('  覆盖率 ' + rate + '%（抓到 ÷ (抓到 + 疑似漏抓)，按设计不开界面的不进分母）');

if (dup.length) {
  const byPage = {};
  dup.forEach(d => { byPage[d.页] = (byPage[d.页] || 0) + 1; });
  console.log('\n⚠ 重复入口（抓取器去重没做干净，白点了一遍）：' +
    Object.entries(byPage).map(([p, n]) => p + '×' + n).join('、'));
}
if (miss.length) {
  console.log('\n🔴 疑似漏抓 —— 该开界面却什么都没发生：');
  const byKind = {};
  miss.forEach(m => { (byKind[m.类型] = byKind[m.类型] || []).push(m); });
  Object.keys(byKind).forEach(k => {
    console.log('  [' + k + '] ' + byKind[k].length + ' 个：');
    byKind[k].slice(0, 8).forEach(m => console.log('     ' + m.页 + ' → 「' + m.入口 + '」'));
    if (byKind[k].length > 8) console.log('     …另 ' + (byKind[k].length - 8) + ' 个');
  });
  console.log('\n  常见原因：① 这个图标要 hover 才出现 ② 它是禁用态 ③ 它打开的是同页浮层而抓取器只认新页/弹窗');
  console.log('  ④ 它根本不可点（我把纯文本当成了链接）。逐个确认，别默认"抓全了"。');
}
process.exit(miss.length > MAX_MISS ? 1 : 0);
