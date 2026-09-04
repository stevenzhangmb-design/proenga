#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   打包后·干净安装冒烟闸 · fresh-install-smoke.js · 随包发（谁都能跑）
   ────────────────────────────────────────────────────────────────────────
   把铁律②③从【静态"无写死路径"】证成【行为"真在别处跑一遍"】：
   模拟"别人把包装到另一台机器/另一位置"——把整个 skills/pm-design【复制到临时干净目录】，
   【只从那份副本】跑：① 模式1 装配器 assemble-prototype ② 模式2 换层工具 inject-latest-anno-layer
   ③ ⑰ 漂移闸 判两个产物，断言：产物标注层=最新版本、⑰ 绿、且产物不含对【原始安装位置】的引用。
   绿 = 这个包搬到任何位置都能产出"本地当前效果"的原型，不依赖原始机器/路径。

   用法：node fresh-install-smoke.js
   退出码：0=干净安装下模式1+模式2都产当前效果；1=有不达标（下面逐条指出）
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), { execFileSync } = require('child_process');

const SKILL = path.join(__dirname, '..');            // skills/pm-design
const ORIG_MARK = SKILL.replace(/\\/g, '/');          // 原始安装位置（产物不该引用它）
const fails = [];
const ok = m => console.log('  ✅ ' + m);
const bad = m => { console.log('  ✗ ' + m); fails.push(m); };

// 递归复制目录（只 node 内置·零依赖）
function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const e of fs.readdirSync(src, { withFileTypes: true })) {
    if (/node_modules|\.playwright-mcp/.test(e.name)) continue;
    const s = path.join(src, e.name), d = path.join(dst, e.name);
    if (e.isDirectory()) copyDir(s, d); else fs.copyFileSync(s, d);
  }
}

console.log('\n════════ 打包后·干净安装冒烟闸 ════════');
const tmpRoot = path.join(os.tmpdir(), 'fresh-install-' + process.pid);
const tmpSkill = path.join(tmpRoot, 'pm-design');
let copied = false;
try { copyDir(SKILL, tmpSkill); copied = fs.existsSync(path.join(tmpSkill, 'qa', 'assemble-prototype.js')); }
catch (e) { bad('复制 skill 到临时干净目录失败: ' + e.message); }

const LATEST = (() => { try { return (fs.readFileSync(path.join(tmpSkill, 'components', 'annotation-layer.html'), 'utf8').match(/__ANNO_LAYER_VERSION__\s*=\s*['"]([^'"]+)/) || [])[1]; } catch (e) { return '?'; } })();

if (copied) {
  ok('整个 skills/pm-design 已复制到临时【干净目录】（模拟别人换机/换位置安装）');
  const QA = path.join(tmpSkill, 'qa');
  const runNode = (args, cwd) => execFileSync('node', args, { cwd, stdio: 'pipe', timeout: 120000 });
  const verOf = p => { try { return (fs.readFileSync(p, 'utf8').match(/__ANNO_LAYER_VERSION__\s*=\s*['"]([^'"]+)/) || [])[1] || '?'; } catch (e) { return '?'; } };
  const refsOrig = p => { try { return fs.readFileSync(p, 'utf8').includes(ORIG_MARK); } catch (e) { return false; } };

  // ── 模式1：干净副本里跑装配器 ──
  const out1 = path.join(tmpRoot, 'mode1.html');
  try {
    runNode([path.join(QA, 'assemble-prototype.js'), path.join(tmpSkill, 'examples', 'project-data.sample.json'), out1], QA);
    if (fs.existsSync(out1) && verOf(out1) === LATEST) ok('模式1(装配器)：干净副本产出原型·标注层=最新 ' + LATEST);
    else bad('模式1产物版本=' + verOf(out1) + '（应=最新 ' + LATEST + '）');
    if (!refsOrig(out1)) ok('模式1产物不含对原始安装位置的引用（真可移植）'); else bad('模式1产物引用了原始安装路径');
  } catch (e) { bad('模式1装配器在干净副本执行失败: ' + String(e.message || e).split('\n')[0]); }

  // ── 模式2：干净副本里跑换层工具（定制外壳夹具）──
  const out2 = path.join(tmpRoot, 'mode2.html');
  try {
    runNode([path.join(QA, 'inject-latest-anno-layer.js'), path.join(QA, 'fixtures', 'custom-shell-old-layer.html'), out2], QA);
    if (fs.existsSync(out2) && verOf(out2) === LATEST) ok('模式2(换层工具)：干净副本把旧层升到最新 ' + LATEST);
    else bad('模式2产物版本=' + verOf(out2) + '（应=最新 ' + LATEST + '）');
  } catch (e) { bad('模式2换层工具在干净副本执行失败: ' + String(e.message || e).split('\n')[0]); }

  // ── ⑰ 漂移闸（干净副本里）判两个产物 ──
  for (const [label, out] of [['模式1产物', out1], ['模式2产物', out2]]) {
    if (!fs.existsSync(out)) continue;
    try { runNode([path.join(QA, 'prototype-standard-sync-gate.js'), out], QA); ok('⑰ 判' + label + '(干净副本内)：标注层最新·合规'); }
    catch (e) { bad('⑰ 判' + label + '红（干净副本产物未达最新）'); }
  }
}

try { fs.rmSync(tmpRoot, { recursive: true, force: true }); } catch (e) {}
console.log('──────────────────────────────');
const pass = fails.length === 0 && copied;
console.log(pass
  ? '  干净安装冒烟 全绿 PASS ✅ —— 包搬到任何位置(别人/别的机器)·模式1+模式2 都产当前效果'
  : '  干净安装冒烟 有红 FAIL ❌ —— ' + fails.length + ' 项不达标');
console.log('════════════════════════════════\n');
process.exit(pass ? 0 : 1);
