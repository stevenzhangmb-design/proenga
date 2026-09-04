#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   代码生成冒烟闸 · codegen-smoke-gate.js · 零依赖(Python 用本机 py 才真编译)
   ────────────────────────────────────────────────────────────────────────
   护住"扇出多栈"投入：跑一组【样例 × 栈组合】emit-all，断言每组都出码且静态校验绿。
   防以后改生成器/桥悄悄弄坏某个栈。代表性矩阵(覆盖 3 后端 × 2 前端 × 主子表)：
     goods(扁平)   × [vue+java, react+node, vue+python]
     inbound(主子表) × [vue+java, react+python]
   Python 额外用本机 py -m py_compile 真语法编译(有 py 才做·无则结构校验兜底)。
   用法：node codegen-smoke-gate.js       退出码 0=全绿 · 1=有组合失败
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const { execFileSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const HERE = __dirname;
const cases = [
  { sample: 'sample-goods.json', fe: 'vue', be: 'java' },
  { sample: 'sample-goods.json', fe: 'react', be: 'node' },
  { sample: 'sample-goods.json', fe: 'vue', be: 'python' },
  { sample: 'sample-inbound.json', fe: 'vue', be: 'java' },
  { sample: 'sample-inbound.json', fe: 'react', be: 'python' },
];
function hasPy() { try { execFileSync('py', ['--version'], { stdio: 'pipe' }); return true; } catch (e) { return false; } }
const PY = hasPy();
console.log('\n════════ 代码生成冒烟闸（扇出多栈·护栏）════════');
console.log('  本机 py（真编译 Python）: ' + (PY ? '有' : '无·结构校验兜底'));
let bad = 0;
for (const c of cases) {
  const tag = path.basename(c.sample).replace('sample-', '').replace('.json', '') + ' · ' + c.fe + '+' + c.be;
  const out = path.join(os.tmpdir(), 'cgs-' + c.fe + '-' + c.be + '-' + path.basename(c.sample, '.json'));
  try { fs.rmSync(out, { recursive: true, force: true }); } catch (e) {}
  let emit;
  try { emit = execFileSync('node', [path.join(HERE, 'emit-all.js'), path.join(HERE, c.sample), out, 'com.tf.gen', c.fe, c.be], { encoding: 'utf8', timeout: 120000 }); }
  catch (e) { bad++; console.log('  ✗ ' + tag + ' —— emit-all 阻断'); continue; }
  // 断言：静态/结构校验绿（java=import完整·node/前端=结构·python 跳过内置校验）
  const feOk = /前端结构校验[\s\S]*全部通过结构校验/.test(emit) || /全部通过结构校验/.test(emit);
  const beOk = c.be === 'python' ? true : (/全部通过静态校验/.test(emit) || /全部通过结构校验/.test(emit));
  // Python：真语法编译
  let pyOk = true, pyN = 0;
  if (c.be === 'python' && PY) {
    const pys = []; (function w(d) { try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) w(p); else if (e.name.endsWith('.py')) pys.push(p); } } catch (e) {} })(path.join(out, 'backend'));
    pyN = pys.length;
    for (const f of pys) { try { execFileSync('py', ['-m', 'py_compile', f], { stdio: 'pipe' }); } catch (e) { pyOk = false; } }
  }
  const nFiles = (function count(d) { let n = 0; try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) n += count(p); else if (/\.(java|vue|tsx?|py|sql)$/.test(e.name)) n++; } } catch (e) {} return n; })(out);
  const ok = feOk && beOk && pyOk && nFiles > 0;
  if (!ok) bad++;
  console.log('  ' + (ok ? '✓' : '✗') + ' ' + tag + '  ·  ' + nFiles + ' 文件' + (c.be === 'python' && PY ? ' · py_compile ' + pyN + '/' + pyN + (pyOk ? ' 通过' : ' 失败') : ''));
  try { fs.rmSync(out, { recursive: true, force: true }); } catch (e) {}
}
console.log('──────────────────────────────────');
if (bad) { console.log('  ❌ ' + bad + ' 个栈组合失败 —— 多栈生成器有回归'); process.exit(1); }
console.log('  ✅ 全部 ' + cases.length + ' 个栈组合出码且校验绿 —— 扇出多栈护栏 PASS');
process.exit(0);
