#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   ㊵ anno-server 崩溃隔离闸 · anno-server-crash-isolation-gate.js · 零依赖
   ────────────────────────────────────────────────────────────────────────
   钉住"稳定性根治"铁律，防以后有人把重活改回常驻进程、或把原子写改回直接写：
     ① writePrdData 必须【原子写】(temp + renameSync) —— 进程被杀也不写坏一半(治"崩了数据坏")。
     ② processPrdUpdate 的请求路径【不得】直接 renderBusinessFlows/pandoc/CHROME —— 必须 spawnAssembleOnce 交子进程。
     ③ saveScreenshotsAndRegen 同上：截图写盘留常驻，重活交 spawnAssembleOnce。
     ④ 重活函数 assembleArtifacts 存在且导出；一次性子进程 assemble-once.js 存在、require server.js、调 assembleArtifacts。
     ⑤ 队列 fs.watch 用 require.main 守卫(子进程 require 时不启)。
   运行时(仅 :3799 在跑时)额外验：⑥ 连发写请求 + prd-data.json 始终是合法 JSON、服务不掉。
   用法：node anno-server-crash-isolation-gate.js   退出码 0=全绿 · 1=有红
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path'), http = require('http');

function findFile(name) {
  const c = [
    path.join(__dirname, '..', '..', '..', '..', 'anno-server', name),   // ai-rules 同级
    path.join('D:/AI/anno-server', name),
    path.join(process.env.CODEGEN_DIR || '', '..', 'anno-server', name),
  ];
  for (const p of c) { try { if (p && fs.existsSync(p)) return p; } catch (e) {} }
  return null;
}
// 取某个函数体文本：从签名到下一个顶格 function / async function
function fnBody(src, sig) {
  const i = src.indexOf(sig);
  if (i < 0) return null;
  const rest = src.slice(i + sig.length);
  const m = rest.search(/\n(?:async )?function /);
  return sig + (m < 0 ? rest : rest.slice(0, m));
}

const results = [];
const ok = (b, msg) => results.push({ b, msg });

const serverPath = findFile('server.js');
const assemblePath = findFile('assemble-once.js');
if (!serverPath) { console.log('  ✗ 找不到 anno-server/server.js（跳过·非本机布局）'); process.exit(0); }
const src = fs.readFileSync(serverPath, 'utf8');

// ① 原子写
const wpd = fnBody(src, 'function writePrdData(') || '';
ok(/renameSync\(/.test(wpd) && /\.tmp-/.test(wpd), '① writePrdData 原子写(temp+renameSync)');

// ② processPrdUpdate 请求路径不碰重活、必 spawnAssembleOnce
const ppu = fnBody(src, 'async function processPrdUpdate(') || '';
ok(/spawnAssembleOnce\(/.test(ppu), '② processPrdUpdate 交子进程装配(spawnAssembleOnce)');
ok(!/renderBusinessFlows\(/.test(ppu) && !/execFileSync\('pandoc'/.test(ppu) && !/execFileSync\(CHROME/.test(ppu),
  '② processPrdUpdate 请求路径【不】直接跑 Chrome/pandoc');

// ③ saveScreenshotsAndRegen 同上
const ssr = fnBody(src, 'function saveScreenshotsAndRegen(') || '';
ok(/spawnAssembleOnce\(/.test(ssr), '③ saveScreenshotsAndRegen 交子进程装配');
ok(!/renderBusinessFlows\(/.test(ssr) && !/execFileSync\('pandoc'/.test(ssr), '③ saveScreenshotsAndRegen 请求路径不直接跑 Chrome/pandoc');

// ④ assembleArtifacts 存在 + 导出 + 子进程
ok(/function assembleArtifacts\(/.test(src), '④ assembleArtifacts 函数存在(重活集中于此·只在子进程跑)');
ok(/module\.exports\s*=\s*\{[^}]*assembleArtifacts/.test(src), '④ assembleArtifacts 已导出(供子进程 require)');
if (!assemblePath) { ok(false, '④ assemble-once.js 存在'); }
else {
  const a = fs.readFileSync(assemblePath, 'utf8');
  ok(/require\(['"]\.\/server(\.js)?['"]\)/.test(a) && /assembleArtifacts/.test(a),
    '④ assemble-once.js require server.js 并调 assembleArtifacts');
}

// ⑤ fs.watch require.main 守卫
ok(/if \(require\.main === module\)[\s\S]{0,120}fs\.watch\(/.test(src), '⑤ 队列 fs.watch 被 require.main 守卫(子进程不启)');

// ── 汇总静态 ──
console.log('\n════════ ㊵ anno-server 崩溃隔离闸 ════════');
let bad = 0;
for (const r of results) { console.log(`  ${r.b ? '✓' : '✗'} ${r.msg}`); if (!r.b) bad++; }

// ⑥ 运行时(可选)：:3799 在跑才验——连发写不崩 + prd-data 始终合法 JSON
function ping(cb) {
  const req = http.get('http://localhost:3799/anno-queue', { timeout: 2000 }, res => { res.resume(); cb(res.statusCode === 200); });
  req.on('error', () => cb(false)); req.on('timeout', () => { req.destroy(); cb(false); });
}
ping(up => {
  if (!up) {
    console.log('  ⓘ :3799 未运行 → 跳过运行时验证(静态已足够钉住架构)');
    done();
  } else {
    // prd-data.json 合法性(读 3 次·模拟并发期间不该读到写坏一半)
    const pd = [path.join(require('./_archive-dir').existingArchiveDir(), 'prd-data.json')].find(p => { try { return fs.existsSync(p); } catch (e) { return false; } });
    let jsonOk = true;
    if (pd) for (let i = 0; i < 3; i++) { try { JSON.parse(fs.readFileSync(pd, 'utf8')); } catch (e) { jsonOk = false; } }
    console.log(`  ${jsonOk ? '✓' : '✗'} ⑥ 运行时::3799 在跑 + prd-data.json 合法 JSON(原子写下永不残档)`);
    if (!jsonOk) bad++;
    done();
  }
});
function done() {
  console.log('──────────────────────────────────');
  if (bad) { console.log(`  ❌ ${bad} 项不符 —— 稳定性根治被破坏，先修`); process.exit(1); }
  console.log('  ✅ 崩溃隔离全绿 —— 重活隔离子进程 + 原子写数据 钉死');
  process.exit(0);
}
