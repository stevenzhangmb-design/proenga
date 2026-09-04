#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   自定义外壳原型 · 注入最新标注层 · inject-latest-anno-layer.js · 随包发
   ────────────────────────────────────────────────────────────────────────
   【模式2 装配 · Route B 的落地工具】画原型两种模式：
     模式1 默认规范 → 装配器 assemble-prototype.js 出标准骨架(左侧栏)；
     模式2 用户给参考/定制外观(竞品/截图/现有手搓版) → 定制外壳无法用标准骨架还原，
           就把【定制外壳原型本身当项目骨架】，本工具只把它内嵌的【旧标注层】整段换成
           components/annotation-layer.html【最新标准件】——外观 100% 保留，标注层永远最新不漂移。

   【认地标·非认标记】不同手搓版内嵌标注层的注释标记五花八门(`:: (1) CSS` / `标注层标准组件 ①②③⑤`…)、
   且层可能拆成多段散布、中间夹业务代码。故本工具按【内容地标】识别，格式无关：
     · 旧层 HTML 根：<div id="anno-app"> … </div>（div 深度匹配定位闭合）——移除
     · 旧层脚本：任何 <script> 内含 __ANNO_LAYER_VERSION__ / mountAnnotationLayer / initSSEAutoRefresh ——移除
     · 业务代码(#app 及其脚本)一律原样保留；旧层 CSS 留着无害(新层 CSS 注入在后·层叠取胜)。
   然后把最新 annotation-layer.html 整块注入 </body> 前(自带 CSS+HTML+脚本·自包含)。
   定制外壳→⑰ 豁免渲染器契约需 __ANNO_LEGACY_GRANDFATHER__ 标记：缺则自动补(带原因)。

   安全断言（任一不满足即中止·绝不写坏文件·退出码2）：
     找到 ≥1 个旧 #anno-app 且能定位闭合、找到 ≥1 段旧层脚本、结果业务 <div id="app"> 仍在、
     结果 #anno-app 恰好 1 个(新层)、__ANNO_LAYER_VERSION__ 赋值恰好 1 次且=最新、</body> 存在。

   用法：node inject-latest-anno-layer.js <源定制外壳原型.html> <输出.html>
   验证建议：node prototype-standard-sync-gate.js <输出>（⑰：豁免渲染器·强制标注层最新）
            + node inject-roundtrip-test.js <输出>（圈选↔注入 ①②③ 真机回路）+ 浏览器截图比对外观
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const SRC = process.argv[2], OUT = process.argv[3];
if (!SRC || !OUT) { console.error('用法: node inject-latest-anno-layer.js <源定制外壳原型.html> <输出.html>'); process.exit(2); }
const LAYERF = path.join(__dirname, '..', 'components', 'annotation-layer.html');

let h, LAYER;
try { h = fs.readFileSync(SRC, 'utf8').replace(/^﻿/, ''); } catch (e) { console.error('读取源原型失败: ' + e.message); process.exit(2); }
try { LAYER = fs.readFileSync(LAYERF, 'utf8').replace(/^﻿/, ''); } catch (e) { console.error('读取标准件 annotation-layer.html 失败: ' + e.message); process.exit(2); }

const abort = (msg) => { console.error('✗ 中止(防写坏文件)：' + msg); process.exit(2); };

// 某位置是否落在 HTML 注释 <!-- --> 内（跳过注释里对 #anno-app 的文字提及）
function inComment(s, idx) { return s.lastIndexOf('<!--', idx) > s.lastIndexOf('-->', idx); }

// ── 定位一个 <div id="anno-app"...> 的闭合 </div>（div 深度匹配·跳过注释提及）──
function annoAppSpan(s, from) {
  let open = s.indexOf('id="anno-app"', from);
  while (open >= 0 && inComment(s, open)) open = s.indexOf('id="anno-app"', open + 1);
  if (open < 0) return null;
  const tagStart = s.lastIndexOf('<div', open);
  if (tagStart < 0) return null;
  let i = s.indexOf('>', open) + 1, depth = 1;
  const re = /<\/?div\b/gi; re.lastIndex = i;
  let m;
  while ((m = re.exec(s))) {
    if (m[0].toLowerCase() === '</div') { if (--depth === 0) return [tagStart, s.indexOf('>', m.index) + 1]; }
    else depth++;
  }
  return null;
}

// 收集所有待删除区间：旧 #anno-app div(可能多个) + 旧层脚本
const removals = [];
let scanFrom = 0, guard = 0;
while (guard++ < 20) {
  const sp = annoAppSpan(h, scanFrom);
  if (!sp) break;
  removals.push(sp); scanFrom = sp[1];
}
if (!removals.length) abort('未找到旧层 <div id="anno-app">，不是可识别的内嵌标注层原型');

// 旧层脚本：<script>…</script> 内含层标识
const scriptRe = /<script\b[^>]*>[\s\S]*?<\/script>/gi;
let sm, scriptHits = 0;
while ((sm = scriptRe.exec(h))) {
  if (/__ANNO_LAYER_VERSION__|mountAnnotationLayer|initSSEAutoRefresh/.test(sm[0])) { removals.push([sm.index, sm.index + sm[0].length]); scriptHits++; }
}
if (!scriptHits) abort('未找到旧层脚本(含 __ANNO_LAYER_VERSION__/mountAnnotationLayer/initSSEAutoRefresh)');

// 按起点降序删除（保持索引有效）
removals.sort((a, b) => b[0] - a[0]);
// 校验区间不重叠交错（防深度匹配异常）
for (let k = 0; k < removals.length - 1; k++) if (removals[k][0] < removals[k + 1][1]) abort('待删区间重叠，深度匹配疑异常，安全中止');
let out = h;
for (const [a, b] of removals) out = out.slice(0, a) + out.slice(b);

// 注入最新层到 </body> 前
const bodyClose = out.lastIndexOf('</body>');
if (bodyClose < 0) abort('源原型无 </body>');
let grandfather = /__ANNO_LEGACY_GRANDFATHER__/.test(out);
const gfComment = grandfather ? '' :
  '<!-- __ANNO_LEGACY_GRANDFATHER__: 自定义外壳手搓原型·渲染器/host-shell 契约按设计与标准骨架不同故⑰豁免;标注层已由 inject-latest-anno-layer 注入最新标准件(模式2/Route B);⑰仍强制校验标注层最新;移除本标记即对渲染器契约恢复严查。 -->\n';
out = out.slice(0, bodyClose) + gfComment + LAYER + '\n' + out.slice(bodyClose);

// ── 结果安全断言 ──
const verNew = (LAYER.match(/__ANNO_LAYER_VERSION__\s*=\s*['"]([^'"]+)/) || [])[1] || '?';
const verCount = (out.match(/__ANNO_LAYER_VERSION__\s*=/g) || []).length;
// 只数【实体】#anno-app 根 div（剥掉注释里的文字提及·标准件文档注释含 2 处示例提及）
const stripComments = (x) => x.replace(/<!--[\s\S]*?-->/g, '');
const annoAppDivs = (stripComments(out).match(/<div\s+id="anno-app"/g) || []).length;
if (verCount !== 1) abort('结果 __ANNO_LAYER_VERSION__ 赋值 ' + verCount + ' 次(应=1·旧层脚本未删净)');
if (annoAppDivs !== 1) abort('结果实体 #anno-app 根 div ' + annoAppDivs + ' 个(应=1·旧层 HTML 未删净或新层异常)');
if (!/<div id="app"/.test(out)) abort('结果丢失业务 <div id="app">(误删业务)');
if (!/__ANNO_LEGACY_GRANDFATHER__/.test(out)) abort('grandfather 标记缺失');

fs.writeFileSync(OUT, '﻿' + out, 'utf8');
console.log('✅ 已注入最新标注层 → ' + OUT + '（' + Math.round(out.length / 1024) + ' KB chars）');
console.log('   标注层版本: ' + verNew + '（__ANNO_LAYER_VERSION__ 赋值 1 次·旧层已换净）· #anno-app 唯一 · 业务 #app 保留');
console.log('   删除旧层区间: ' + removals.length + ' 段（' + (removals.length - scriptHits) + ' 个 #anno-app + ' + scriptHits + ' 段脚本）· 旧层 CSS 保留(无害·新层层叠取胜)');
console.log('   grandfather: ' + (grandfather ? '原有' : '自动补入') + '（⑰ 豁免渲染器契约·标注层仍强制最新）');
console.log('   下一步验证：node prototype-standard-sync-gate.js "' + OUT + '"  +  node inject-roundtrip-test.js "' + OUT + '"  + 浏览器截图比对外观');
process.exit(0);
