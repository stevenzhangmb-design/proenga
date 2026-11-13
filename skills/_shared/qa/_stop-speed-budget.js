#!/usr/bin/env node
/* ② 交付预算闸（Stop 钩子·随包·跨机器通用·2026-09-28 用户明令 / 2026-10-13 改为自动重建）
   ────────────────────────────────────────────────────────────────
   铁律：画原型 / 改原型必须非常快。慢的典型表现是「一直在查、一直不交」。
   要守的事实：**用户打开的是单独的离线交付件，它不会跟着源自动更新**；
   源比交付件新 = 用户打开的还是旧文件 = 白改。

   【2026-10-13 改法·根因来自会话记录实测】
   原来：发现交付件旧 → **拦住收工**，让 AI 再跑一次重建。
   实测后果（10-13 那场会话）：**重建了 21 次**，因为用户每轮都在提要求、我每轮都改源，
   于是这个闸把铁律里的「一批改完只重建一次」变成了「每轮必须重建一次」——
   机器时间不是问题（-Quick 约 1 秒），**但每次都多一个「重建→汇报→等回话」的往返**，
   而往返才是真正的耗时（同场 704 次工具调用）。

   现在：发现交付件旧 → **这个钩子自己把它重建掉（-Quick，约 1 秒）**，然后放行并告知。
   好处：① 零额外往返；② 比"提醒 AI 去做"更可靠——根本不可能忘。
   重建失败才拦住收工（那种情况必须让人看见）。

   怎么知道改过什么：读 .claude/ledgers.txt 里登记的清单所在目录，
   找同目录的 project-data*.json 与其 _deliverable，比时间戳。不写死任何盘符。 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  let p = {};
  try { p = JSON.parse(String(input || '{}').replace(/^﻿/, '').trim() || '{}'); } catch (_) { return; }
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const reg = path.join(root, '.claude', 'ledgers.txt');
  if (!fs.existsSync(reg)) return;

  const dirs = [...new Set(fs.readFileSync(reg, 'utf8').split(/\r?\n/)
    .map(s => s.trim()).filter(s => s && !s.startsWith('#'))
    .map(f => path.dirname(f)).filter(d => fs.existsSync(d)))];

  const stale = [];
  for (const d of dirs) {
    let files = [];
    try { files = fs.readdirSync(d); } catch (_) { continue; }
    const srcs = files.filter(f => /project-data.*\.json$/i.test(f) && !/\.bak[-.]/i.test(f));
    for (const s of srcs) {
      const sp = path.join(d, s);
      let data = null;
      try { data = JSON.parse(fs.readFileSync(sp, 'utf8')); } catch (_) { continue; }
      const deliv = data && data._deliverable;
      if (!deliv || !fs.existsSync(deliv)) continue;
      const st = fs.statSync(sp).mtimeMs, dt = fs.statSync(deliv).mtimeMs;
      if (st > dt + 2000) stale.push({ src: sp, out: deliv, lag: Math.round((st - dt) / 1000) });
    }
  }
  if (!stale.length) return;                       // 交付件都是新的 → 放行

  const ps = path.join(__dirname, '..', '..', 'pm-design', 'rebuild-deliverable.ps1');
  const done = [], failed = [];

  if (process.platform === 'win32' && fs.existsSync(ps)) {
    for (const o of stale) {
      try {
        execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ps,
          '-ProjectData', o.src, '-Quick'], { timeout: 120000, stdio: 'ignore' });
        // 复核：重建后交付件必须真的变新了，否则算失败（防止脚本静默跳过）
        const dt = fs.statSync(o.out).mtimeMs, st = fs.statSync(o.src).mtimeMs;
        if (dt + 2000 >= st) done.push(o); else failed.push({ ...o, why: '脚本跑完但交付件时间没更新' });
      } catch (e) {
        failed.push({ ...o, why: (e && e.message || String(e)).slice(0, 120) });
      }
    }
  } else {
    stale.forEach(o => failed.push({ ...o, why: '非 Windows 或找不到 rebuild-deliverable.ps1' }));
  }

  // 全部重建成功 → 放行，只告知（零额外往返）
  if (!failed.length) {
    process.stdout.write(JSON.stringify({
      systemMessage: '🔄 交付件已自动重建（-Quick）：\n' +
        done.map(o => '· ' + path.basename(o.out)).join('\n') +
        '\n（全量体检在后台跑，结果写 <交付件>.gate-report.txt；说"做完了"前要读到 PASS）'
    }));
    return;
  }

  // 有失败的 → 必须让人看见
  const list = failed.map(o => '· ' + path.basename(o.out) + '（比源旧 ' + o.lag + ' 秒）—— ' + o.why +
    '\n    手动重建：skills/pm-design/rebuild-deliverable.ps1 -ProjectData "' + o.src + '" -Quick').join('\n');
  if (p.stop_hook_active) {
    process.stdout.write(JSON.stringify({ systemMessage: '⚠ 交付件自动重建失败，用户打开的还是旧文件：\n' + list }));
    return;
  }
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: '【交付预算闸】交付件比源旧，自动重建没成功 —— 用户打开的还是旧文件，等于白改。先手动重建再收工：\n' + list
  }));
});
