#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   ㊽ RPA 工具语法自检 —— 治「注入浏览器的模板字符串被注释里的反引号截断」
   ────────────────────────────────────────────────────────────────────────
   2026-10-30 建。这个坑**同一个形状踩了两次**：

     skills/rpa/ 下的工具都有一段注入到浏览器里执行的大函数，写法是
     `const FN = \`(() => { ... })()\`` —— 一个很长的模板字符串。
     在它**内部**的注释里写一个带反引号的词（比如解释"按钮不在 __footer 类里"
     时顺手给类名加了反引号），那个反引号就**提前终止了模板字符串**，
     后面全部代码被当成普通表达式解析，整个文件语法错。
     · 第一次：deepcrawl.js 的 FIND 里注释写了 length>6 带反引号 → 整文件崩
     · 第二次：layout.js 的 formArea 注释写了 __footer 带反引号 → 整文件崩

   为什么值得一道闸而不是"下次小心"：
     报错信息指向的行号是**反引号之后某处**，跟真正的病灶隔着几十行，
     每次都要先猜半天。而 `node --check` 能 100% 捕获它、0.1 秒出结论。
     这正是「能静态断言就别靠自觉」——语法错是最该被机器拦住的一类。

   做法：对 skills/rpa/*.js 逐个 node --check。任何一个不过 = 红。
   顺带也兜住了别的手误（漏括号、重复声明等），成本几乎为零。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
try { require('../../_shared/qa/_tmp-sandbox'); } catch (_) {}
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const dirs = [
  path.resolve(__dirname, '../../rpa'),
  path.resolve(__dirname, '..'),            // pm-design 自己的工具
  path.resolve(__dirname, '.')              // qa 闸本身
];
let checked = 0;
const bad = [];
dirs.forEach(d => {
  if (!fs.existsSync(d)) return;
  fs.readdirSync(d).filter(f => /\.js$/.test(f)).forEach(f => {
    const p = path.join(d, f);
    try { fs.statSync(p).isFile(); } catch (_) { return; }
    checked++;
    try {
      execFileSync(process.execPath, ['--check', p], { stdio: ['ignore', 'ignore', 'pipe'] });
    } catch (e) {
      const msg = String(e.stderr || e.message).split('\n')
        .filter(l => /SyntaxError|^\s*\^|:\d+$/.test(l)).slice(0, 3).join(' / ');
      bad.push({ 文件: path.relative(path.resolve(__dirname, '../../..'), p), 错: msg || '语法错' });
    }
  });
});

console.log('【㊽ 工具语法自检】检查 ' + checked + ' 个 .js');
if (!bad.length) {
  console.log('✅ 全部通过 —— 没有被反引号截断的模板字符串，也没有其它语法错');
  process.exit(0);
}
console.log('🔴 ' + bad.length + ' 个文件语法错 —— 这些工具现在根本跑不起来：');
bad.forEach(b => console.log('   ' + b.文件 + '\n      ' + b.错));
console.log('\n最常见的原因（踩过两次）：注入浏览器的模板字符串里，注释写了带反引号的词，');
console.log('反引号提前终止了模板字符串。报错行号会指到病灶之后几十行，别照着那行找。');
process.exit(1);
