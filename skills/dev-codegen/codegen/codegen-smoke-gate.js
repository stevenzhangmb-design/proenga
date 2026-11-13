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
require('../../_shared/qa/_tmp-sandbox'); // 临时文件进沙盒·退出自动删（铁律·见 _tmp-sandbox.js）
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
// ── 无 PRD 解耦护栏：只凭原型 PAGECFG → derive-from-prototype → emit-all 也要出可编译码 ──
console.log('  ── 无 PRD 兜底档（原型结构直出·2026-09-09 解耦）──');
{
  const proto = path.join(HERE, 'sample-prototype-noprd.html');
  const dm = path.join(os.tmpdir(), 'cgs-noprd-dm.json');
  const out = path.join(os.tmpdir(), 'cgs-noprd-out');
  try { fs.rmSync(out, { recursive: true, force: true }); } catch (e) {}
  try { fs.rmSync(dm, { force: true }); } catch (e) {}
  let ok = false, nEnt = 0, nFiles = 0;
  try {
    execFileSync('node', [path.join(HERE, 'derive-from-prototype.js'), proto, dm], { encoding: 'utf8', timeout: 60000 });
    const doc = JSON.parse(fs.readFileSync(dm, 'utf8'));
    nEnt = Object.keys((doc.data_model && doc.data_model.entities) || {}).length;
    const emit = execFileSync('node', [path.join(HERE, 'emit-all.js'), dm, out, 'com.tf.gen', 'vue', 'java'], { encoding: 'utf8', timeout: 120000 });
    const feOk = /全部通过结构校验/.test(emit), beOk = /全部通过静态校验/.test(emit);
    nFiles = (function count(d) { let n = 0; try { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) n += count(p); else if (/\.(java|vue|tsx?|py|sql)$/.test(e.name)) n++; } } catch (e) {} return n; })(out);
    ok = nEnt > 0 && feOk && beOk && nFiles > 0;
  } catch (e) { ok = false; }
  if (!ok) bad++;
  console.log('  ' + (ok ? '✓' : '✗') + ' noprd-proto → derive-from-prototype → vue+java  ·  实体 ' + nEnt + ' · ' + nFiles + ' 文件');
  try { fs.rmSync(out, { recursive: true, force: true }); fs.rmSync(dm, { force: true }); } catch (e) {}
}
// ── 多语原型护栏（2026-11-13）：标签是 {zh,en,pt} 对象时，对接料 + 代码里不得有 [object Object] / hex 乱码标识符 / 占位提示语当列 ──
console.log('  ── 多语原型（{zh,en,pt} 标签·对接料+出码）──');
{
  const proto = path.join(HERE, 'sample-prototype-multilang.html');
  const kit = path.join(os.tmpdir(), 'cgs-ml-kit');
  const out = path.join(os.tmpdir(), 'cgs-ml-out');
  const dm = path.join(kit, 'data_model.json');
  for (const d of [kit, out]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }
  fs.mkdirSync(kit, { recursive: true });
  const probs = [];
  let nFiles = 0;
  try {
    execFileSync('node', [path.join(HERE, 'derive-from-prototype.js'), proto, dm], { encoding: 'utf8', timeout: 60000 });
    execFileSync('node', [path.join(HERE, 'emit-contract.js'), dm, kit], { encoding: 'utf8', timeout: 60000 });
    execFileSync('node', [path.join(HERE, 'emit-prompts.js'), dm, kit], { encoding: 'utf8', timeout: 30000 });
    const emit = execFileSync('node', [path.join(HERE, 'emit-all.js'), dm, out, 'com.tf.gen', 'vue', 'java'], { encoding: 'utf8', timeout: 120000 });
    if (!/全部通过静态校验/.test(emit) || !/全部通过结构校验/.test(emit)) probs.push('静态/结构校验未绿');
    const HEX = /\b[A-Za-z_]*(?:field_?|Field)[0-9a-f]{8,}\w*/;           // 旧的中文 hex 占位（field_e58f91e7…）
    (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { walk(p); continue; }
      nFiles++; const t = fs.readFileSync(p, 'utf8'), rel = path.relative(os.tmpdir(), p);
      if (t.includes('[object Object]')) probs.push(rel + ' 含 [object Object]');
      const m = t.match(HEX); if (m) probs.push(rel + ' 含 hex 标识符 ' + m[0].slice(0, 30));
      if (/批量搜索请用逗号|"field": "(全部|请输入)/.test(t)) probs.push(rel + ' 把筛选占位文字当成了字段'); } })(kit), (function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) { walk(p); continue; }
      nFiles++; const t = fs.readFileSync(p, 'utf8'), rel = path.relative(os.tmpdir(), p);
      if (t.includes('[object Object]')) probs.push(rel + ' 含 [object Object]');
      const m = t.match(HEX); if (m) probs.push(rel + ' 含 hex 标识符 ' + m[0].slice(0, 30)); } })(out);
    const ent = JSON.parse(fs.readFileSync(dm, 'utf8')).data_model.entities.issuing;
    const byField = Object.fromEntries((ent ? ent.columns : []).map(c => [c.field, c.col]));
    if (!ent || ent.label !== '开票中') probs.push('实体中文名应为「开票中」，实为 ' + JSON.stringify(ent && ent.label));
    for (const [f, c] of [['序列号', 'serial'], ['CPF/CNPJ', 'cpf_cnpj'], ['单据信息', 'document_info'], ['发票号', 'invoice_no'], ['发票账号', 'accounts']])
      if (byField[f] !== c) probs.push('字段「' + f + '」标识符应为 ' + c + '，实为 ' + byField[f]);
    if (!/^field_\d+$/.test(byField['商品信息'] || '')) probs.push('无英文名的「商品信息」应落 field_<序号>，实为 ' + byField['商品信息']);
  } catch (e) { probs.push('生成阻断：' + (e.message || e).toString().split('\n')[0]); }
  if (probs.length) bad++;
  console.log('  ' + (probs.length ? '✗' : '✓') + ' multilang-proto → 对接料 + vue+java  ·  ' + nFiles + ' 文件' + (probs.length ? '\n      ' + probs.slice(0, 10).join('\n      ') : ''));
  for (const d of [kit, out]) { try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {} }
}
console.log('──────────────────────────────────');
if (bad) { console.log('  ❌ ' + bad + ' 个组合失败 —— 生成器/解耦有回归'); process.exit(1); }
console.log('  ✅ 全部 ' + cases.length + ' 个栈组合 + 无PRD兜底档 + 多语原型 出码且校验绿 —— 护栏 PASS');
process.exit(0);
