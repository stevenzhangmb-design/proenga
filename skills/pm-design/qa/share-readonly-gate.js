#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   分享版只读隐藏闸 · share-readonly-gate.js · 随包发（维护者/QA 用）
   ────────────────────────────────────────────────────────────────────────
   焊死：导出的【只读分享版】必须真正隐藏"复制已圈/导出分享版/清空/恢复标注"等编辑控件。
   根治一次真实事故：标注层 CSS 里有个【悬空选择器】——
       body.anno-preview-mode            （此处本想放注释）      ← 没花括号
       body.anno-preview-mode .anno-author-only  设 display:none
   两行被 CSS 解析器粘成 `body.anno-preview-mode body.anno-preview-mode .anno-author-only`
   （body 套 body 永不匹配）→ 只读隐藏【从来没生效】，分享版一直露出编辑按钮。
   本闸静态断言两件事，任一不满足即红：
     A. 标准件含隐藏规则 `body.anno-preview-mode .anno-author-only { display:none }`
        且【不含】上述悬空双选择器 bug。
     B. anno-server 的 writeShareVersion 会给 <body> 打 anno-preview-mode 类
        （CSS 从加载即生效，不依赖 JS 时机）——anno-server 找得到才查，找不到跳过。
   用法：node share-readonly-gate.js
   退出码：0=通过；1=有问题（上面指出）
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const STD = path.join(__dirname, '..', 'components', 'annotation-layer.html');
const fails = [];
const ok = (m) => console.log('  ✅ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); fails.push(m); };

console.log('\n════════ 分享版只读隐藏闸 ════════');

// ── A. 标准件 CSS ──
if (!fs.existsSync(STD)) bad('标准件缺失: components/annotation-layer.html');
else {
  const css = fs.readFileSync(STD, 'utf8');
  const hasRule = /body\.anno-preview-mode\s+\.anno-author-only\s*\{\s*display:\s*none/.test(css);
  hasRule ? ok('标准件含只读隐藏规则 (.anno-author-only → display:none)')
          : bad('标准件缺只读隐藏规则 body.anno-preview-mode .anno-author-only{display:none}');
  // 悬空双选择器 bug：一个 body.anno-preview-mode（可带注释）紧跟另一个 body.anno-preview-mode .anno-author-only
  const bug = /body\.anno-preview-mode\s*\/\*[\s\S]*?\*\/\s*body\.anno-preview-mode\s+\.anno-author-only/.test(css);
  bug ? bad('标准件有悬空选择器 bug → 隐藏规则被粘成 body 套 body,永不匹配,分享版会露编辑按钮')
      : ok('无悬空选择器 bug (隐藏规则独立成立)');

  // ── C. 导出分享版规则（用户 2026-07-05 定的 4 条·静态守住）──
  //  ①② 没标注也能导出(导出=原型只读副本·标注可选)：exportShareVersion 不得含"没有标注可导出"拦截
  const hasExportGuard = /没有标注可导出/.test(css);
  hasExportGuard ? bad('导出分享版仍含「没有标注可导出」拦截 → 违反规则①②(没进行标注也应能导出只读副本)')
                 : ok('导出分享版不拦无标注 (①②没标注也能导·原型只读副本)');
  //  ③ 标注默认关闭（2026-11-17 用户定）：普通原型和只读分享版打开时都不显示标注号，打开顶栏「标注」开关才显示 → showPins=ref(false)。
  //    旧规则（分享版默认开 ref(__ANNO_READONLY__===true)）已作废，禁回归；ref(true) 一刀切同样禁。
  //    ★ 只认【真代码声明】：先剥 JS 块注释(版本注释里会写这段文字·别误匹配到注释成假绿) + 只认带 const 的真声明。
  const codeOnly = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const showPinsOff = /const\s+showPins\s*=\s*ref\(\s*false\s*\)/.test(codeOnly);
  showPinsOff ? ok('标注默认关闭 (showPins=ref(false)·普通原型和只读分享版打开都不显示标注号)')
              : bad('标注没有默认关闭 (showPins 应为 ref(false)·普通原型和只读分享版打开时都不显示标注，开开关才显示)');
}

// ── B. anno-server writeShareVersion 打 body 类（best-effort：找不到 anno-server 就跳过）──
const srvCands = [
  path.join(__dirname, '..', '..', '..', '..', 'anno-server', 'server.js'),
  path.join(__dirname, '..', '..', '..', 'anno-server', 'server.js'),
  require('path').resolve(__dirname, '../../../anno-server/server.js'),
];
const srv = srvCands.find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });
if (!srv) console.log('  … anno-server 不在预期位置,跳过导出函数检查(不影响标准件层判定)');
else {
  const s = fs.readFileSync(srv, 'utf8');
  // writeShareVersion 段内应出现给 body 注入 anno-preview-mode 的逻辑
  const wsv = s.slice(s.indexOf('function writeShareVersion'), s.indexOf('function writeShareVersion') + 4000);
  /anno-preview-mode/.test(wsv)
    ? ok('anno-server writeShareVersion 给 <body> 打只读类 (导出即只读,不依赖 JS)')
    : bad('anno-server writeShareVersion 没给 <body> 打 anno-preview-mode 类 → 导出分享版可能不只读');
}

console.log('──────────────────────────────');
const pass = fails.length === 0;
console.log(pass ? '  分享版只读隐藏闸 全绿 PASS ✅' : '  分享版只读隐藏闸 有红 FAIL ❌ —— ' + fails.length + ' 项');
console.log('════════════════════════════════\n');
process.exit(pass ? 0 : 1);
