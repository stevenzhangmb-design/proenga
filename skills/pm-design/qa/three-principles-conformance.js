#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   三原则符合性总验 · three-principles-conformance.js · 随包发（谁都能跑）
   ────────────────────────────────────────────────────────────────────────
   一条命令验最高铁律的三条「达到本地当前效果」，绿=三条都达标，红=当场指出哪条不达标。
   核心机制：画新原型 = 程序从 skill 单一真理源(components/)逐字组装，不是 AI 手搓，
   故「谁在哪个窗口、哪台机器画」出来都一样。本脚本把这句话变成可复现的机器证据。

     #1 我任意窗口画新原型 → 本地当前效果
        证：组装器从 components/ 产的全新原型，逐项自带今天固化的全部效果 + ⑳合规闸判绿。
     #2 打包后别人装 → 本地当前效果
        证：组装器/组件全用相对路径、无写死本机盘符 → 换台机器照跑，效果跟着包走。
     #3 别人任意窗口画新原型 → 本地当前效果
        = #1机制(相对路径组装器) 跑在 #2可移植包 上 → #1+#2 达标即结构上成立。

   用法：node three-principles-conformance.js
   退出码：0=三原则全达标；1=有不达标项（上面已逐条指出）
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const QA = __dirname;
const COMP = path.join(QA, '..', 'components');
const ASM = path.join(QA, 'assemble-prototype.js');
const SAMPLE = path.join(QA, '..', 'examples', 'project-data.sample.json');
const PMGATE = path.join(QA, 'prototype-pmdesign-gate.js');

const fails = [];
const ok = (m) => console.log('  ✅ ' + m);
const bad = (m) => { console.log('  ✗ ' + m); fails.push(m); };

// 写死本机路径判据：盘符 + 常见本机目录（Users/AI/TF/中文目录名）
const ABS = /[A-Za-z]:\\(?:Users|AI|TF|[一-龥])/;

// 今天固化、必须逐项随新原型带上的「当前效果」清单
const EFFECTS = [
  ['手动保存(点保存才同步)', 'commitEdit'],
  ['导出选保存位置', '_saveWithPicker'],
  ['存储键按项目区分(防串数据)', 'anno-pins-v2::'],
  ['顶栏工具条(host外壳)', '工具条'],
  ['注入命门(按fpKey填充)', '_annoInjectPins'],
  ['圈选采集', '_ZONE_SEL'],
  ['标注层版本戳', '__ANNO_LAYER_VERSION__'],
];

console.log('\n════════ 三原则符合性总验 ════════');

// ── #1 任意窗口画新原型 → 本地当前效果 ──────────────────────────────
console.log('\n【#1】任意窗口画新原型 → 达到本地当前效果');
const tmpOut = path.join(os.tmpdir(), 'three-principles-fresh-' + process.pid + '.html');
let assembled = false;
if (!fs.existsSync(ASM)) bad('组装器缺失: assemble-prototype.js');
else if (!fs.existsSync(SAMPLE)) bad('示例项目数据缺失: examples/project-data.sample.json');
else {
  try { execFileSync('node', [ASM, SAMPLE, tmpOut], { stdio: 'pipe', timeout: 120000 }); assembled = fs.existsSync(tmpOut); }
  catch (e) { bad('组装器执行失败: ' + String(e.message || e).split('\n')[0]); }
}
if (assembled) {
  ok('组装器从 components/ 逐字产出全新原型（AI 未手写）');
  const html = fs.readFileSync(tmpOut, 'utf8');
  let miss = 0;
  for (const [label, needle] of EFFECTS) if (!html.includes(needle)) { bad('新原型缺当前效果: ' + label); miss++; }
  if (!miss) ok('今天固化的 ' + EFFECTS.length + ' 项效果，新原型逐项自带');
  if (fs.existsSync(PMGATE)) {
    try { execFileSync('node', [PMGATE, tmpOut], { stdio: 'pipe', timeout: 120000 }); ok('⑳ pm-design 合规闸判新原型：绿'); }
    catch (e) { bad('⑳ pm-design 合规闸判新原型：红'); }
  }
}
try { fs.unlinkSync(tmpOut); } catch (e) {}

// ── #1b 模式2（定制外观/用户参考）装配能力：自定义外壳原型注入最新标注层（Route B）· 行为级证 ──
console.log('\n【#1b】模式2(定制外观) 也走装配 → 定制外壳注入最新标注层（真跑工具·非只查静态）');
const MODE2 = path.join(QA, 'inject-latest-anno-layer.js');
const M2FIX = path.join(QA, 'fixtures', 'custom-shell-old-layer.html');
const LAYERC = path.join(COMP, 'annotation-layer.html');
if (!fs.existsSync(MODE2)) bad('模式2工具缺失: inject-latest-anno-layer.js（装配器只支持模式1·违反"两种模式对装配版都成立"）');
else if (!fs.existsSync(M2FIX)) bad('模式2测试夹具缺失: qa/fixtures/custom-shell-old-layer.html');
else {
  const m2 = fs.readFileSync(MODE2, 'utf8');
  if (/__dirname/.test(m2) && !ABS.test(m2)) ok('模式2工具用相对路径(__dirname)·无写死本机盘符 → 换机可用');
  else bad('模式2工具疑似写死本机绝对路径');
  // 行为证：真跑换层工具，断言【旧层 1.0.0 → 升到 components 最新版本】+ ⑰ 判产物标注层最新
  const latestVer = (fs.readFileSync(LAYERC, 'utf8').match(/__ANNO_LAYER_VERSION__\s*=\s*['"]([^'"]+)/) || [])[1] || '?';
  const m2out = path.join(os.tmpdir(), 'three-principles-mode2-' + process.pid + '.html');
  try {
    execFileSync('node', [MODE2, M2FIX, m2out], { stdio: 'pipe', timeout: 120000 });
    const outHtml = fs.readFileSync(m2out, 'utf8');
    const outVer = (outHtml.match(/__ANNO_LAYER_VERSION__\s*=\s*['"]([^'"]+)/) || [])[1] || '?';
    if (outVer === latestVer && outVer !== '1.0.0') ok('模式2真跑：旧层 1.0.0 → 升到最新 ' + outVer + '（定制外壳业务 #app 保留）');
    else bad('模式2真跑后版本=' + outVer + '（应=最新 ' + latestVer + '·换层未生效）');
    // ⑰ 判产物：自定义外壳→豁免渲染器契约，但标注层锚点须全最新
    try { execFileSync('node', [path.join(QA, 'prototype-standard-sync-gate.js'), m2out], { stdio: 'pipe', timeout: 120000 }); ok('⑰ 判模式2产物：标注层锚点全最新（渲染器契约按定制豁免）'); }
    catch (e) { bad('⑰ 判模式2产物：标注层未达最新（换层不彻底）'); }
  } catch (e) { bad('模式2工具执行失败: ' + String(e.message || e).split('\n')[0]); }
  try { fs.unlinkSync(m2out); } catch (e) {}
}

// ── #2 打包后别人装 → 本地当前效果（可移植·无本机依赖）──────────────
console.log('\n【#2】打包后别人装 → 达到本地当前效果（可移植）');
if (fs.existsSync(ASM)) {
  const asmSrc = fs.readFileSync(ASM, 'utf8');
  if (/__dirname/.test(asmSrc) && !ABS.test(asmSrc)) ok('组装器用相对路径(__dirname)读 components/，无写死本机盘符');
  else bad('组装器疑似写死本机绝对路径');
}
const compBad = [];
if (fs.existsSync(COMP)) {
  for (const f of fs.readdirSync(COMP)) {
    if (!/\.html$/.test(f)) continue;
    const m = fs.readFileSync(path.join(COMP, f), 'utf8').match(ABS);
    if (m) compBad.push(f + ' → ' + m[0]);
  }
}
if (!compBad.length) ok('components/ 所有部件：无写死本机绝对路径 → 换台机器可用');
else compBad.forEach(x => bad('组件含本机路径: ' + x));
// #2 行为证（非只静态）：真把整包复制到临时干净目录、只从副本跑模式1+模式2、断言产当前效果
const FRESH = path.join(QA, 'fresh-install-smoke.js');
if (fs.existsSync(FRESH)) {
  try { execFileSync('node', [FRESH], { stdio: 'pipe', timeout: 180000 }); ok('干净安装冒烟：整包复制到别处·只从副本跑·模式1+模式2 都产最新效果（行为证·非推断）'); }
  catch (e) { bad('干净安装冒烟红：包搬到别处后模式1/模式2 未产当前效果（见 fresh-install-smoke.js 输出）'); }
} else bad('缺 fresh-install-smoke.js（#2 只有静态证·无行为证）');

// ── #3 别人任意窗口画新原型 → 本地当前效果（= #1机制 × #2可移植）──────
console.log('\n【#3】别人任意窗口画新原型 → 达到本地当前效果');
if (fails.length === 0) ok('#1(装配器+换层工具产当前效果·行为证) + #2(干净安装真跑·行为证) 均达标 → #3 成立');
else console.log('  … 取决于 #1/#2：上面有红则 #3 不成立，先修红的');

console.log('──────────────────────────────');
const pass = fails.length === 0;
console.log(pass
  ? '  三原则符合性 全绿 PASS ✅ —— 本地 / 打包 / 任意窗口画新原型 都达当前效果'
  : '  三原则符合性 有红 FAIL ❌ —— ' + fails.length + ' 项不达标（上面逐条已指出）');
console.log('════════════════════════════════\n');
process.exit(pass ? 0 : 1);
