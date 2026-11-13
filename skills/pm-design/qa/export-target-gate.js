#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   ㊿ 导出保存位置闸 · export-target-gate.js · 随包·零依赖·不碰真数据
   ────────────────────────────────────────────────────────────────────────
   根治（2026-11-12 用户原话「导出没法选择要保存的目录，这个目录需要用户可以自定义，不是你默认的」）：
   【导出对接料】【一键生成代码】原来由 anno-server 直接写进固定目录 <archive>/对接料|生成代码/<系统>，用户选不了。
   修法：标注层 _exportToFolder 先弹 showDirectoryPicker → 服务端 returnContent 返回文件 → 页面写进所选文件夹；
         浏览器没有该 API / 框弹不出 → 用户填绝对路径(targetDir)，服务端校验并创建；服务端两者都没收到 = 400。
   本闸防回退，两段：
   A. 静态断言（标注层 + server.js）
      A1 exportDevkitVersion / generateCodeVersion 必须走 _exportToFolder，函数体里不许再直接 fetch 出料/出码端点
      A2 _exportToFolder 里 _pickDirHandle( 必须在 fetch( 之前（用户手势有效期内弹框·同 2026-07-09 分享版真 bug）
      A3 _pickDirHandle 用 showDirectoryPicker，且 AbortError 用耗时判据(_PICKER_MIN_MS)区分真取消/弹不出
      A4 server.js 的 generateDevKit / generateDevCode 不许出现 path.join(arch…) / ARCHIVE_DIR / useArchiveFor，必须调 resolveExportTarget
      A5 resolveExportTarget 无目标必须抛错（禁静默退回固定目录）；validateExportDir 必须校验绝对路径 + mkdir recursive
   B. 运行时（临时端口 anno-server + 临时 archive，不碰真实例）
      B1 不给保存位置 → 400；B2 相对路径 → 400；B3 returnContent → 返回文件内容且临时 archive 里没写任何东西；
      B4 targetDir=不存在的绝对路径 → 自动创建并写入、返回的 outDir 就是那里。
   退出码：0=通过（运行时段缺 server/codegen 时 SKIP 该段）1=失败。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
require('./_gate-env');   // 接临时文件沙盒（退出自动删）
const fs = require('fs'), path = require('path'), os = require('os'), http = require('http'), { spawn } = require('child_process');
const QA = __dirname;
const LAYER = process.env.EXPORT_GATE_LAYER || path.join(QA, '..', 'components', 'annotation-layer.html');   // env 覆盖仅供负向自测
const SERVER = process.env.EXPORT_GATE_SERVER || [
  path.join(QA, '..', '..', '..', '..', 'anno-server', 'server.js'),
  path.join(QA, '..', '..', '..', 'anno-server', 'server.js'),
].find(p => { try { return fs.existsSync(p); } catch (_) { return false; } });

let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ✓ ' : '  ✗ ') + msg); if (!c) fails++; };
/* 取 `const name = ...` 起到下一个同级 `    const ` 声明之间的函数体（够用的结构切片，不依赖行号） */
const fnBody = (src, name) => {
  const i = src.indexOf('const ' + name + ' =');
  if (i < 0) return '';
  const rest = src.slice(i + 10);
  const m = rest.search(/\n {4}(const|let|function) [A-Za-z_$]/);
  return src.slice(i, i + 10 + (m < 0 ? 4000 : m));
};
const srvFn = (src, name) => {
  const i = src.indexOf('function ' + name + '(');
  if (i < 0) return '';
  const rest = src.slice(i + 9);
  const m = rest.search(/\n(function |\/\* ══)/);
  return src.slice(i, i + 9 + (m < 0 ? 6000 : m));
};

console.log('\n════════ ㊿ 导出保存位置闸（用户自选文件夹·禁写死固定目录）════════');
const L = fs.readFileSync(LAYER, 'utf8');
for (const fn of ['exportDevkitVersion', 'generateCodeVersion']) {
  const b = fnBody(L, fn);
  ok(b && /_exportToFolder\(/.test(b) && !/fetch\(/.test(b), 'A1 ' + fn + ' 走 _exportToFolder、函数体内不直接 fetch 端点');
}
const ex = fnBody(L, '_exportToFolder');
const iPick = ex.indexOf('_pickDirHandle('), iFetch = ex.indexOf('fetch(');
ok(iPick > 0 && iFetch > 0 && iPick < iFetch, 'A2 _exportToFolder：先弹选文件夹框(_pickDirHandle) → 再 fetch（手势有效期内）');
ok(/returnContent:\s*true/.test(ex) && /targetDir/.test(ex), 'A2b 选到文件夹 → returnContent；没选成 → targetDir（用户填的路径）');
const pk = fnBody(L, '_pickDirHandle');
ok(/showDirectoryPicker/.test(pk) && /AbortError[\s\S]{0,80}_dt\s*>=\s*_PICKER_MIN_MS/.test(pk), 'A3 _pickDirHandle 用 showDirectoryPicker + 耗时判据区分真取消/弹不出');
ok(/indexedDB\.open/.test(L) && /startIn/.test(pk), 'A3b 上次选的文件夹存 IndexedDB 并作为默认位置(startIn)');

if (SERVER) {
  const S = fs.readFileSync(SERVER, 'utf8');
  for (const fn of ['generateDevKit', 'generateDevCode']) {
    const b = srvFn(S, fn);
    ok(b && /resolveExportTarget\(/.test(b) && !/path\.join\(\s*arch|ARCHIVE_DIR|useArchiveFor/.test(b), 'A4 server ' + fn + ' 保存位置走 resolveExportTarget，无固定 archive 目录');
  }
  const rt = srvFn(S, 'resolveExportTarget'), vd = srvFn(S, 'validateExportDir');
  ok(/throw _exportErr\(/.test(rt.slice(rt.lastIndexOf('if (opts.targetDir)'))), 'A5 resolveExportTarget 没给保存位置就报错（不静默退回固定目录）');
  ok(/isAbsolute|\[a-zA-Z\]:/.test(vd) && /mkdirSync\([^)]*recursive:\s*true/.test(vd), 'A5b validateExportDir 校验绝对路径 + 不存在自动创建');
} else console.log('  ⊘ 未找到 anno-server/server.js，跳过 A4/A5 与运行时段');

(async () => {
  const cg = path.join(QA, '..', '..', 'dev-codegen', 'codegen');
  if (!SERVER || !fs.existsSync(path.join(cg, 'emit-contract.js'))) return finish();
  const PORT = 3821, tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'exptgt-'));
  const arch = path.join(tmp, 'archive'); fs.mkdirSync(arch);
  const log = fs.openSync(path.join(tmp, 'srv.log'), 'a');
  const srv = spawn(process.execPath, [SERVER], { cwd: path.dirname(SERVER), stdio: ['ignore', log, log], windowsHide: true,
    env: { ...process.env, ANNO_PORT: String(PORT), ANNO_ARCHIVE_DIR: arch, CODEGEN_DIR: cg } });
  const post = (url, body) => new Promise(res => {
    const d = Buffer.from(JSON.stringify(body));
    const r = http.request({ host: '127.0.0.1', port: PORT, path: url, method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': d.length } }, x => {
      let s = ''; x.on('data', c => s += c); x.on('end', () => { let j = null; try { j = JSON.parse(s); } catch (_) {} res({ status: x.statusCode, j }); });
    });
    r.on('error', () => res({ status: 0, j: null })); r.setTimeout(90000, () => r.destroy()); r.end(d);
  });
  const ping = () => new Promise(res => { const r = http.get(`http://127.0.0.1:${PORT}/anno-queue`, x => { x.resume(); res(x.statusCode === 200); }); r.on('error', () => res(false)); });
  let up = false; for (let i = 0; i < 60 && !up; i++) { up = await ping(); if (!up) await new Promise(z => setTimeout(z, 300)); }
  try {
    if (!up) { console.log('  ⊘ 临时 anno-server 没起来，跳过运行时段'); return; }
    const pagecfg = { orders: { title: '订单', cols: [{ prop: 'no', label: '单号' }, { prop: 'amt', label: '金额' }], filters: [{ prop: 'no', label: '单号' }] } };
    const base = { systemName: '闸测系统', prdData: {}, pagecfg };
    const r1 = await post('/anno-devkit', base);
    ok(r1.status === 400 && r1.j && !r1.j.ok, 'B1 不给保存位置 → 400 拒绝（不写固定目录）〔' + r1.status + ' ' + (r1.j && r1.j.error) + '〕');
    const r2 = await post('/anno-devkit', { ...base, targetDir: 'relative/dir' });
    ok(r2.status === 400 && /完整路径/.test((r2.j && r2.j.error) || ''), 'B2 相对路径 → 400 + 白话提示〔' + (r2.j && r2.j.error) + '〕');
    const r3 = await post('/anno-devkit', { ...base, returnContent: true });
    const archLeft = fs.readdirSync(arch).filter(f => !/^(prd-data|PRD-)/.test(f));
    ok(r3.status === 200 && r3.j && r3.j.ok && Array.isArray(r3.j.contents) && r3.j.contents.length > 0 && r3.j.subName === '闸测系统-对接料' && !r3.j.outDir,
      'B3 returnContent → 返回 ' + ((r3.j && r3.j.contents && r3.j.contents.length) || 0) + ' 个文件内容、子文件夹名「' + (r3.j && r3.j.subName) + '」');
    ok(!archLeft.some(f => /对接料|生成代码/.test(f)), 'B3b returnContent 模式下 archive 里没写出任何对接料/生成代码目录〔' + archLeft.join(',') + '〕');
    const tgt = path.join(tmp, '用户选的', '新建文件夹');
    const r4 = await post('/anno-devkit', { ...base, targetDir: tgt });
    const out4 = r4.j && r4.j.outDir;
    ok(r4.status === 200 && out4 === path.join(tgt, '闸测系统-对接料') && fs.existsSync(out4) && fs.readdirSync(out4).length > 0,
      'B4 填不存在的绝对路径 → 自动创建并写入，返回实际目录〔' + out4 + '〕');
  } finally {
    try { srv.kill(); } catch (_) {}
    try { fs.closeSync(log); } catch (_) {}
    await new Promise(z => setTimeout(z, 400));
    try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
    finish();
  }
})();
function finish() {
  console.log('──────────────────────────────');
  console.log(fails ? '  ㊿ 导出保存位置闸 FAIL ❌（' + fails + ' 项）' : '  ㊿ 导出保存位置闸 全绿 PASS ✅');
  console.log('════════════════════════════════\n');
  process.exit(fails ? 1 : 0);
}
