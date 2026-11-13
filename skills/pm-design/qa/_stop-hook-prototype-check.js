#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   Stop 钩子 · 原型交付守门人（2026-07-13 加）

   【为什么有它】
   死规矩「present 给用户前最后一步必跑 deliver-gate 全绿」原本只写在 skill 里，
   靠 AI 自觉执行 —— 而自觉是会失效的：
   2026-07-13 我把总闸报的红判成"环境抖动"，**只补跑了红的那一道**就交付了。
   "只补跑红的那道" ≠ "跑全绿"。用户震怒："严禁你这样的做事方式"。

   【机制】不跑重活（钩子超时 60s），只比时间戳 + 读报告首行。按"改了什么"自动分流：

     ① 标准件（公共件：骨架/标注层/host-shell/page-renderer/规范/qa 下所有 .js）
        —— 改了影响【所有】原型 → 必须跑完整 deliver-gate（它查的是工具链本身：fixture 原型/样例 PRD）。
        判定：任一标准件 mtime 比 .deliver-gate-green 新 → 拦住，逼跑完整 deliver-gate。

     ② 交付件（project-data 里 "_deliverable" 声明的、用户实际打开的离线 .html）
        §2026-11-13 改：只改项目内容（project-data → 重建交付件）时，完整 deliver-gate 根本不查
        这份内容（它查的是 fixture），逼它跑 8～9 分钟是白等；真正查这份内容的是
        【逐页自检 deliverable-verify-gate + 布局体检】，rebuild-deliverable.ps1 -Quick 已在后台跑、
        结果写到 <交付件>.gate-report.txt。所以这里改成要【那份报告】：
          · 交付件比 .deliver-gate-green 新（= 上次全闸之后又动过）时，必须满足：
              报告存在 + 第一行以 PASS 开头 + 报告比交付件新；
          · 报告 RUNNING 且后台进程还活着 → 最多等 40 秒，等不到就拦（说"等它跑完"）；
          · 报告 RUNNING 但进程已不在 / FAIL / 比交付件旧 / 不存在 → 拦；
          · project-data 比交付件新（改了源没重建）→ 拦（交付件重建纪律）。
        红绝不放行：FAIL 一律拦；报告读不出来一律当"没验过"拦。

     ③ archive 下没在任何 project-data 里声明的 *-offline.html（老流程原型，没有逐页自检的源）
        —— 沿用旧判定：不比 max(.deliver-gate-green, .assemble-check-green) 新就放行。

   手动补报告（不想重建、只想验当前交付件时）：
     node qa/_stop-hook-prototype-check.js --self-check <project-data.json>
     = 全量装配体检(布局+保真) + 逐页自检，按 rebuild-deliverable 后台同一格式写 <交付件>.gate-report.txt。

   退出码：0=放行（静默）；2 + stderr = 拦截并把理由喂回给 AI。
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const QA = __dirname;
const PM = path.join(QA, '..');                 // skills/pm-design
const MARK = path.join(QA, '.deliver-gate-green');       // 完整总闸全绿标记
const AMARK = path.join(QA, '.assemble-check-green');    // 装配器快闸(layout+fidelity)全绿标记
const LEDGERS = process.env.STOPHOOK_LEDGERS || path.resolve(QA, '..', '..', '..', '.claude', 'ledgers.txt');   // 环境变量仅供自测指向临时清单

const mtime = f => { try { return fs.statSync(f).mtimeMs; } catch (_) { return 0; } };
const markAt = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8').replace(/^﻿/, '')).at || 0; } catch (_) { return 0; } };
const sleepSync = ms => { try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms); } catch (_) {} };
const pidAlive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

/* ① 标准件：改了它们影响所有原型 → 必须重跑完整 deliver-gate。
   含 qa 下所有 .js（各道闸本身也是公共件；改了闸=改了验收口径，须全量回归）。 */
function standardComponents() {
  const list = [
    path.join(PM, 'components', 'prototype-skeleton.html'),
    path.join(PM, 'components', 'annotation-layer.html'),
    path.join(PM, 'components', 'host-shell.html'),
    path.join(PM, 'components', 'page-renderer.html'),
    path.join(PM, 'system-design-spec.md'),
    path.join(PM, 'system-design-spec-mobile.md'),
  ];
  try {
    for (const f of fs.readdirSync(QA)) if (f.endsWith('.js')) list.push(path.join(QA, f));
  } catch (_) {}
  return list;
}

/* 读 project-data 的 _deliverable：文件可能有几十 MB 且字段在末尾 → 先读头尾 256KB，找不到再全读 */
function readDeliverableField(pd) {
  const re = /"_deliverable"\s*:\s*"((?:[^"\\]|\\.)*)"/;
  let fd;
  try {
    const size = fs.statSync(pd).size, N = 256 * 1024;
    fd = fs.openSync(pd, 'r');
    const chunks = size <= 2 * N ? [[0, size]] : [[0, N], [size - N, N]];
    for (const [pos, len] of chunks) {
      const b = Buffer.alloc(len); fs.readSync(fd, b, 0, len, pos);
      const m = re.exec(b.toString('utf8'));
      if (m) return JSON.parse('"' + m[1] + '"');
    }
    if (size > 2 * N) { const m = re.exec(fs.readFileSync(pd, 'utf8')); if (m) return JSON.parse('"' + m[1] + '"'); }
  } catch (_) {} finally { try { if (fd !== undefined) fs.closeSync(fd); } catch (_) {} }
  return '';
}

/* 已声明的交付件：ledgers.txt 登记的各原型目录里的 project-data*.json → _deliverable */
function declaredDeliverables() {
  const out = [];
  let lines = [];
  try { lines = fs.readFileSync(LEDGERS, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#')); } catch (_) {}
  const dirs = [...new Set(lines.map(l => path.dirname(l)))];
  for (const dir of dirs) {
    let ents; try { ents = fs.readdirSync(dir); } catch (_) { continue; }
    for (const f of ents) {
      if (!/project-data.*\.json$/i.test(f) || /\.(audit-base|annotations|anno-map|bak|backup)\.json$/i.test(f)) continue;
      const pd = path.join(dir, f);
      const d = readDeliverableField(pd);
      if (d) out.push({ pd, deliv: d });
    }
  }
  return out;
}

/* 交付原型：archive 下的 *-offline.html（排除分享版/备份） */
function archiveDeliverables() {
  const dirs = require('./_archive-dir').archiveDirs();
  const ok = f => /offline/i.test(f) && f.endsWith('.html') && !/分享版|备份|\.bak/i.test(f);
  const out = [];
  for (const d of dirs) {
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { continue; }
    for (const e of ents) {
      if (e.isFile() && ok(e.name)) out.push(path.join(d, e.name));
      else if (e.isDirectory() && !/^_|^\.|node_modules|screenshots|images/i.test(e.name)) {
        try { for (const f of fs.readdirSync(path.join(d, e.name))) if (ok(f)) out.push(path.join(d, e.name, f)); } catch (_) {}
      }
    }
    if (out.length) break;
  }
  return out;
}

/* 读报告首行：{ state: PASS|FAIL|RUNNING|NONE|BAD, line, pid, at } */
function readReport(deliv) {
  const rp = deliv + '.gate-report.txt';
  let raw;
  try { raw = fs.readFileSync(rp, 'utf8').replace(/^﻿/, ''); } catch (_) { return { state: 'NONE', rp }; }
  const line = (raw.split(/\r?\n/)[0] || '').trim();
  const m = /^(PASS|FAIL|RUNNING)\b/.exec(line);
  const pm = /pid=(\d+)/.exec(line);
  return { state: m ? m[1] : 'BAD', line, rp, pid: pm ? +pm[1] : 0, at: mtime(rp) };
}

/* ── --self-check <project-data>：手动补一份报告（与 rebuild-deliverable -Quick 后台同口径） ── */
if (process.argv[2] === '--self-check') {
  require('../../_shared/qa/_tmp-sandbox');      // 临时文件铁律：本分支用到临时目录，退出整目录自动删
  const { spawnSync } = require('child_process');
  const os = require('os');
  const pd = process.argv[3];
  const deliv = pd && readDeliverableField(pd);
  if (!deliv || !fs.existsSync(deliv)) { console.error('用法：--self-check <project-data.json>（须声明 _deliverable 且文件存在）'); process.exit(1); }
  const rp = deliv + '.gate-report.txt';
  fs.writeFileSync(rp, 'RUNNING ' + new Date().toTimeString().slice(0, 8) + ' pid=' + process.pid + ' 手动检查进行中', 'utf8');
  const tmp = path.join(os.tmpdir(), '_selfchk_' + process.pid + '.html');
  const a = spawnSync(process.execPath, [path.join(QA, 'assemble-prototype.js'), pd, tmp], { encoding: 'utf8', maxBuffer: 64 << 20 });
  try { fs.unlinkSync(tmp); } catch (_) {}
  const v = spawnSync(process.execPath, [path.join(QA, 'deliverable-verify-gate.js'), deliv, pd], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const why = [];
  if (a.status !== 0) why.push('全量装配体检未过（退出码 ' + a.status + '）');
  if (v.status !== 0) why.push('逐页自检未过（退出码 ' + v.status + '）');
  const st = why.length ? 'FAIL' : 'PASS';
  const msg = why.length ? '未通过：' + why.join('；') + '，详见下方日志' : '通过：全量体检和逐页自检全绿';
  const log = [a.stdout, a.stderr, v.stdout, v.stderr].filter(Boolean).join('\n');
  fs.writeFileSync(rp, st + ' ' + new Date().toTimeString().slice(0, 8) + ' ' + msg + '\n' + log, 'utf8');
  console.log(st + ' ' + msg + '\n报告：' + rp);
  process.exit(why.length ? 1 : 0);
}

const greenAt = markAt(MARK);       // 完整总闸全绿时间；0 = 从没跑绿过
const assembleAt = markAt(AMARK);   // 装配器快闸全绿时间；0 = 从没装配体检过

/* ── ① 标准件：任一比 .deliver-gate-green 新 → 影响所有原型 → 逼跑完整 deliver-gate ── */
const stdComps = standardComponents().filter(f => mtime(f) > 0);
const staleStd = stdComps.filter(f => mtime(f) > greenAt);

if (staleStd.length) {
  const list = staleStd.slice(0, 8).map(f => '     · ' + path.basename(f)).join('\n');
  const more = staleStd.length > 8 ? `\n     …另有 ${staleStd.length - 8} 个` : '';
  console.error(
`🚫 【禁止收工】原型交付守门人拦截（标准件改动 → 必须全量回归）

  ${greenAt
    ? '以下【标准件/公共件】在 deliver-gate 上次跑绿【之后】被改过，改完没重跑全闸：'
    : 'deliver-gate 从未跑绿（没有绿标记），但以下【标准件/公共件】已被改动：'}
${list}${more}

  标准件（骨架/标注层/host-shell/page-renderer/规范/qa 闸）影响【所有】原型，
  死规矩：**present 给用户前，最后一步必须跑 deliver-gate 全绿**（涉 UI 还要截图眼验）。
  ⚠️ "只补跑报红的那一道" 不算数 —— 必须整条总闸全绿。

  请执行（约 5 分钟，放后台跑、看输出文件，别前台干等）：
    cd skills/pm-design && node qa/deliver-gate.js "<你要交付的 offline 原型路径>"

  全绿后会自动刷新绿标记，本拦截自动解除。红的先修，别交付。`);
  process.exit(2);
}

/* ── ② 已声明的交付件：只改内容 → 要逐页自检报告 PASS（不要完整总闸） ── */
const declared = declaredDeliverables();
const declaredSet = new Set(declared.map(x => path.normalize(x.deliv).toLowerCase()));
const problems = [];
for (const { pd, deliv } of declared) {
  const dm = mtime(deliv);
  if (!dm) continue;                                    // 交付件还没生成过 → 不归本钩子管
  const pm = mtime(pd);
  const name = path.basename(deliv);
  /* 改了源没重建：源比交付件新 2 秒以上，且是上次全闸之后改的（远古的不追溯） */
  if (pm > dm + 2000 && pm > greenAt) {
    problems.push(`· ${name}\n      project-data 比交付件新（改了源还没重建交付件）→ 跑 rebuild-deliverable.ps1 -ProjectData "${pd}" -Quick`);
    continue;
  }
  if (dm <= greenAt) continue;                          // 上次完整总闸之后没动过
  let r = readReport(deliv);
  /* 后台检查还在跑：在钩子超时内等一会儿（最多 40 秒） */
  for (let waited = 0; r.state === 'RUNNING' && r.pid && pidAlive(r.pid) && waited < 40000; waited += 2000) {
    sleepSync(2000); r = readReport(deliv);
  }
  const fresh = r.at && r.at >= dm;
  if (r.state === 'PASS' && fresh) continue;            // ✅ 逐页自检全绿且晚于交付件
  let why;
  if (r.state === 'NONE') why = '没有逐页自检报告';
  else if (r.state === 'FAIL') why = '逐页自检报告是 FAIL（真红，先修）：' + r.line.slice(0, 120);
  else if (r.state === 'RUNNING') why = (r.pid && pidAlive(r.pid)) ? '后台逐页自检还在跑（等了 40 秒没跑完，等它出 PASS 再收工）' : '报告停在 RUNNING 但后台进程已不在（检查被中断，必须重跑）';
  else if (r.state === 'PASS') why = '报告是 PASS，但比交付件旧（交付件之后又被改过，没再验）';
  else why = '报告首行读不出状态：' + r.line.slice(0, 80);
  problems.push(`· ${name}\n      ${why}`);
}

if (problems.length) {
  console.error(
`🚫 【禁止收工】原型交付守门人拦截（交付件内容改了，逐页自检没 PASS）

  标准件没改 → 不需要完整 deliver-gate；但下面的交付件在上次全闸之后被改过，
  必须有一份比它新、第一行为 PASS 的逐页自检报告（<交付件>.gate-report.txt）：
${problems.slice(0, 8).join('\n')}

  怎么补（任选其一）：
    · 重建并后台自检（约 1 秒更新 + 约 40 秒后台）：
        skills/pm-design/rebuild-deliverable.ps1 -ProjectData <project-data.json> -Quick
    · 不重建、只验当前交付件：
        node skills/pm-design/qa/_stop-hook-prototype-check.js --self-check <project-data.json>
  报告第一行 PASS 后本拦截自动解除。FAIL 是真红，先修再收工。`);
  process.exit(2);
}

/* ── ③ 没声明 _deliverable 的老 archive 原型：沿用装配器快闸覆盖判定 ── */
const coveredBy = Math.max(greenAt, assembleAt);
const bypassed = archiveDeliverables()
  .filter(f => !declaredSet.has(path.normalize(f).toLowerCase()))
  .filter(f => mtime(f) > 0 && mtime(f) > coveredBy);

if (bypassed.length) {
  const list = bypassed.slice(0, 8).map(f => '     · ' + path.basename(f)).join('\n');
  const more = bypassed.length > 8 ? `\n     …另有 ${bypassed.length - 8} 个` : '';
  console.error(
`🚫 【禁止收工】原型交付守门人拦截（交付原型未经任何快闸）

  以下交付原型比装配器快闸标记(.assemble-check-green)【和】总闸绿标记都新，
  说明它是被手改 / 绕过装配器产生的，没跑过 layout+fidelity 快闸、也不在上次全绿里：
${list}${more}

  请二选一让它经过校验后再收工：
    · 首选（秒级）：改源头 project-data 后重新装配 →
        cd skills/pm-design && node qa/assemble-prototype.js <project-data.json> <输出原型.html>
      装配器会当场跑 layout+fidelity 并刷新 .assemble-check-green，本拦截自动解除；
    · 或跑完整总闸：
        cd skills/pm-design && node qa/deliver-gate.js "<该 offline 原型路径>"`);
  process.exit(2);
}

/* 标准件没改、交付件都有新鲜 PASS 报告（或纯聊天回合）→ 放行（静默） */
process.exit(0);
