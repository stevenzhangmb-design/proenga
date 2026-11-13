#!/usr/bin/env node
/* ============================================================================
   pd-patch.js —— 给 project-data.json 打补丁的标准入口（2026-11-13·提速减重·不降质量）
   ----------------------------------------------------------------------------
   为什么有它（实测）：
     ① 源文件一直用 JSON.stringify(pd,null,1) 缩进保存：52.8MB；紧凑写法 35.8MB（-32%），
        读写都更快，装配出来的原型逐字节相同（装配器本来就 JSON.parse 后重新序列化）。
     ② 每轮补丁都另存一份完整备份：55 份 = 2.65GB 堆在临时目录。
   本工具：一次读入 → 按顺序跑补丁 → 校验 → 紧凑写回（原子替换）→ 每轮只留【一份】备份。

   用法：
     node pd-patch.js <project-data.json> <补丁1.js> [补丁2.js …] [--dry] [--force]
     node pd-patch.js <project-data.json> --commit     检查都通过后删掉本轮备份
     node pd-patch.js <project-data.json> --restore    用备份还原（补丁有问题时）
     node pd-patch.js <project-data.json>              不带补丁 = 只把文件转成紧凑格式（内容不变）

   补丁写法（每个文件一个函数，直接改 pd，返回一句话报告）：
     module.exports = function (pd, ctx) { pd.pagecfg.goods.title = '商品'; return '改了商品标题'; };
     · 可以是 async；抛错 = 整轮作废，源文件一个字节都不动。
     · ctx = { file, dry }。

   每轮做的事：
     1. 读入一次（去 BOM）→ 依次执行补丁（同一个内存对象，补丁之间不重复读写）。
     2. 校验：值必须都是合法 JSON（NaN/Infinity/函数/数组里的 undefined 等 = 红）；
        序列化后再解析一遍、再序列化，必须完全一致；
        用装配器 qa/assemble-prototype.js --fast 在临时沙盒里真装配一次，装配器拒收 = 红。
     3. 备份：<名>.bak.json 放在源文件旁边（deliver-gate / Stop 钩子按 .bak.json 自动忽略）。
        已有未提交的备份（上一轮没 --commit）→ 沿用它，不再新建：它就是最后一次确认过的版本。
     4. 紧凑写到同目录 <名>.json.pd-patch-tmp → rename 覆盖源文件（中途崩了源文件不会半截）。
     5. 打印摘要（大小、耗时、每个补丁的报告）。
   崩溃保护：备份比源文件新、或源文件读不出 / 解析不了 = 上一轮中途崩了 → 拒绝运行，
            先 --restore 还原或确认无误后 --force。
   退出码：0 成功；1 补丁/校验失败（源文件未改）；2 用法错误；3 发现上一轮崩溃残留。
   ============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const argv = process.argv.slice(2);
const flags = new Set(argv.filter(a => a.startsWith('--')));
const pos = argv.filter(a => !a.startsWith('--'));
const PD = pos[0] ? path.resolve(pos[0]) : '';
const PATCHES = pos.slice(1).map(p => path.resolve(p));
const DRY = flags.has('--dry'), FORCE = flags.has('--force');
const known = new Set(['--dry', '--force', '--commit', '--restore']);
const bad = [...flags].filter(f => !known.has(f));
if (!PD || bad.length) {
  console.log(fs.readFileSync(__filename, 'utf8').split('====\n')[1] || '用法见文件头');
  if (bad.length) console.error('未知参数: ' + bad.join(' '));
  process.exit(2);
}
if (!fs.existsSync(PD)) { console.error('✗ 找不到 ' + PD); process.exit(2); }

const BAK = PD.replace(/\.json$/i, '') + '.bak.json';
const TMP = PD + '.pd-patch-tmp';   // 不以 .json 结尾 → 不会被任何按 project-data*.json 找源文件的工具误认
const LOCK = PD + '.pd-patch-lock';
const ASM = path.join(__dirname, 'qa', 'assemble-prototype.js');
const mb = n => (n / 1048576).toFixed(1) + 'MB';
const t0 = Date.now(); const lap = () => ((Date.now() - t0) / 1000).toFixed(2) + 's';

/* ---------- --commit / --restore ---------- */
if (flags.has('--commit')) {
  if (!fs.existsSync(BAK)) { console.log('⊘ 没有待提交的备份（' + path.basename(BAK) + '）'); process.exit(0); }
  fs.unlinkSync(BAK); console.log('✓ 已提交：删除备份 ' + path.basename(BAK)); process.exit(0);
}
if (flags.has('--restore')) {
  if (!fs.existsSync(BAK)) { console.error('✗ 没有备份可还原'); process.exit(2); }
  fs.copyFileSync(BAK, TMP); fs.renameSync(TMP, PD); fs.unlinkSync(BAK);
  console.log('✓ 已用备份还原 ' + path.basename(PD) + '，备份已删除'); process.exit(0);
}

/* ---------- 并发锁 + 崩溃残留检查 ---------- */
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
if (fs.existsSync(LOCK)) {
  const pid = +fs.readFileSync(LOCK, 'utf8') || 0;
  if (pid && alive(pid)) { console.error('✗ 另一个 pd-patch（pid ' + pid + '）正在改这个文件'); process.exit(3); }
}
const leftoverTmp = fs.existsSync(TMP);
fs.writeFileSync(LOCK, String(process.pid));
process.on('exit', () => { try { fs.unlinkSync(LOCK); } catch (_) {} try { fs.unlinkSync(TMP); } catch (_) {} });

let srcText;
try { srcText = fs.readFileSync(PD, 'utf8').replace(/^﻿/, ''); } catch (e) { srcText = null; }
let pd = null, parseErr = null;
const tRead = Date.now();
if (srcText != null) { try { pd = JSON.parse(srcText); } catch (e) { parseErr = e.message; } }
const readMs = Date.now() - tRead;
const bakNewer = fs.existsSync(BAK) && fs.statSync(BAK).mtimeMs > fs.statSync(PD).mtimeMs;
if ((pd == null || bakNewer || leftoverTmp) && !FORCE) {
  console.error('✗ 疑似上一轮中途崩溃：' + (pd == null ? '源文件读不出/解析失败（' + parseErr + '）' : bakNewer ? '备份比源文件新' : '有上一轮没写完的临时文件 ' + path.basename(TMP)));
  if (fs.existsSync(BAK)) console.error('  先确认：node pd-patch.js "' + PD + '" --restore  （还原）；确认源文件没问题则加 --force 继续');
  else console.error('  没有备份；写入是先写临时文件再整体替换，源文件' + (pd == null ? '已损坏，请从别处找回' : '应完好') + '。确认后加 --force 继续');
  process.exit(3);
}
if (pd == null) { console.error('✗ 源文件解析失败，--force 也救不了：' + parseErr); process.exit(1); }

/* ---------- 跑补丁 ---------- */
(async () => {
  const reports = [];
  for (const p of PATCHES) {
    let fn;
    try { delete require.cache[p]; fn = require(p); } catch (e) { console.error('✗ 加载补丁失败 ' + p + '：' + e.message); process.exit(1); }
    if (typeof fn !== 'function') { console.error('✗ 补丁没有导出函数：' + p); process.exit(1); }
    try {
      const r = await fn(pd, { file: PD, dry: DRY });
      const s = r == null ? '(无报告)' : typeof r === 'string' ? r : JSON.stringify(r);
      reports.push(path.basename(p) + ' → ' + (s.length > 400 ? s.slice(0, 400) + '…' : s));
    } catch (e) { console.error('✗ 补丁出错，整轮作废（源文件未动）：' + path.basename(p) + '：' + (e && e.stack || e)); process.exit(1); }
  }

  /* ---------- 校验 1：值都是合法 JSON ---------- */
  const errs = []; let droppedUndef = 0;
  (function walk(v, at) {
    if (errs.length > 20) return;
    const t = typeof v;
    if (v === null || t === 'string' || t === 'boolean') return;
    if (t === 'number') { if (!Number.isFinite(v)) errs.push(at + ' = ' + v + '（会被存成 null）'); return; }
    if (t === 'function' || t === 'symbol' || t === 'bigint') { errs.push(at + ' 是 ' + t + '（JSON 存不了）'); return; }
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) { if (v[i] === undefined) errs.push(at + '[' + i + '] 是 undefined（会被存成 null）'); else walk(v[i], at + '[' + i + ']'); } return; }
    const proto = Object.getPrototypeOf(v);
    if (proto !== Object.prototype && proto !== null) { errs.push(at + ' 不是普通对象（' + (v.constructor && v.constructor.name) + '）'); return; }
    for (const k in v) { if (v[k] === undefined) { droppedUndef++; continue; } walk(v[k], at + '.' + k); }
  })(pd, 'pd');
  if (errs.length) { console.error('✗ 补丁写进了 JSON 存不了的值，整轮作废：\n  - ' + errs.join('\n  - ')); process.exit(1); }

  /* ---------- 校验 2：序列化往返一致 ---------- */
  const tSer = Date.now();
  const out = JSON.stringify(pd);
  const serMs = Date.now() - tSer;
  if (JSON.stringify(JSON.parse(out)) !== out) { console.error('✗ 序列化往返不一致，整轮作废'); process.exit(1); }
  const unchanged = out === srcText;

  /* ---------- 校验 3：装配器接受（--fast，临时沙盒，跑完自动删） ---------- */
  require('../_shared/qa/_tmp-sandbox');
  const box = fs.mkdtempSync(path.join(require('os').tmpdir(), 'pd-patch-'));
  const chk = path.join(box, 'check.json');   // 同目录无 .annotations.json → 装配器只校验数据本身
  fs.writeFileSync(chk, out, 'utf8');
  const tAsm = Date.now();
  try {
    execFileSync(process.execPath, [ASM, chk, path.join(box, 'check.html'), '--fast'], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 180000 });
  } catch (e) {
    console.error('✗ 装配器拒收，整轮作废（源文件未动）：\n' + String(e.stderr || e.stdout || e.message).trim().split('\n').slice(0, 30).join('\n'));
    process.exit(1);
  }
  const asmMs = Date.now() - tAsm;
  const asmKB = Math.round(fs.statSync(path.join(box, 'check.html')).size / 1024);
  try { fs.rmSync(box, { recursive: true, force: true }); } catch (_) {}

  const head = [
    (DRY ? '【试跑·未写入】' : '') + path.basename(PD),
    '  补丁 ' + PATCHES.length + ' 个：' + (reports.length ? '\n    ' + reports.join('\n    ') : '（无·只转紧凑格式）'),
    '  大小 ' + mb(Buffer.byteLength(srcText)) + ' → ' + mb(Buffer.byteLength(out)) + (droppedUndef ? '　（' + droppedUndef + ' 个 undefined 属性按删除处理）' : ''),
    '  校验：JSON 合法 ✓ 往返一致 ✓ 装配器接受 ✓（' + asmKB + 'KB·' + asmMs + 'ms）',
    '  耗时：读 ' + readMs + 'ms · 序列化 ' + serMs + 'ms · 合计 ' + lap()
  ];
  if (DRY) { console.log(head.join('\n')); process.exit(0); }
  if (unchanged) { console.log(head.join('\n') + '\n  内容与源文件逐字节相同 → 未写入、未备份'); process.exit(0); }

  /* ---------- 备份（每轮最多一份）+ 原子写 ---------- */
  let bakNote;
  if (fs.existsSync(BAK)) bakNote = '沿用上轮未提交的备份 ' + path.basename(BAK) + '（最后确认过的版本）';
  else { fs.copyFileSync(PD, BAK); bakNote = '备份 → ' + path.basename(BAK); }
  fs.writeFileSync(TMP, out, 'utf8');
  fs.renameSync(TMP, PD);
  console.log(head.join('\n') + '\n  ' + bakNote + '\n  ✓ 已写入。检查都通过后：node pd-patch.js "' + PD + '" --commit');
  process.exit(0);
})().catch(e => { console.error('✗ ' + (e && e.stack || e)); process.exit(1); });
