#!/usr/bin/env node
/* ══════════════════════════════════════════════════════════════════════════
   Stop 钩子 · 原型交付守门人（2026-07-13 加）

   【为什么有它】
   死规矩「present 给用户前最后一步必跑 deliver-gate 全绿」原本只写在 skill 里，
   靠 AI 自觉执行 —— 而自觉是会失效的：
   2026-07-13 我把总闸报的红判成"环境抖动"，**只补跑了红的那一道**就交付了。
   "只补跑红的那道" ≠ "跑全绿"。用户震怒："严禁你这样的做事方式"。

   【机制】不跑重活（全闸要几分钟，钩子超时 120s 跑不动），只比时间戳：
     deliver-gate 跑绿 → 写 qa/.deliver-gate-green
     本检查：只要 骨架 / 标注层 / 规范 / 任何交付原型 的 mtime 比绿标记新
             → 说明"改过之后没重跑全闸" → **拦住，禁止收工**
   绕不过：改了东西就必须重跑 deliver-gate，跑绿才会刷新标记。

   退出码：0=放行（静默）；非0 + stderr 输出 = 拦截并把理由喂回给 AI。
   ══════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const QA = __dirname;
const PM = path.join(QA, '..');                 // skills/pm-design
const MARK = path.join(QA, '.deliver-gate-green');

/* 受管文件：改了它们就必须重跑 deliver-gate */
const WATCH = [
  path.join(PM, 'components', 'prototype-skeleton.html'),
  path.join(PM, 'components', 'annotation-layer.html'),
  path.join(PM, 'system-design-spec.md'),
  path.join(PM, 'system-design-spec-mobile.md'),
  path.join(QA, 'assemble-prototype.js'),
];

/* 交付原型：archive 下的 *-offline.html（排除分享版/备份） */
function deliverables() {
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

const mtime = f => { try { return fs.statSync(f).mtimeMs; } catch (_) { return 0; } };

/* 绿标记时间；没有标记 = 从没跑绿过 */
let greenAt = 0;
try { greenAt = JSON.parse(fs.readFileSync(MARK, 'utf8')).at || 0; } catch (_) { greenAt = 0; }

const watched = [...WATCH, ...deliverables()].filter(f => mtime(f) > 0);
const stale = watched.filter(f => mtime(f) > greenAt);

/* 一个都没动过（比如纯聊天回合）→ 放行 */
if (!watched.length || (greenAt && !stale.length)) process.exit(0);

/* 从没跑绿 且 也没动过受管文件 → 放行（不打扰无关会话） */
if (!greenAt && !stale.length) process.exit(0);

const list = stale.slice(0, 8).map(f => '     · ' + path.basename(f)).join('\n');
const more = stale.length > 8 ? `\n     …另有 ${stale.length - 8} 个` : '';

console.error(
`🚫 【禁止收工】原型交付守门人拦截

  ${greenAt
    ? '以下文件在 deliver-gate 上次跑绿【之后】被改过，改完没重跑全闸：'
    : 'deliver-gate 从未跑绿（没有绿标记），但以下受管文件已被改动：'}
${list}${more}

  死规矩：**present 给用户前，最后一步必须跑 deliver-gate 全绿**（涉 UI 还要截图眼验）。
  ⚠️ "只补跑报红的那一道" 不算数 —— 必须整条总闸全绿。

  请执行：
    cd skills/pm-design && node qa/deliver-gate.js "<你要交付的 offline 原型路径>"

  全绿后会自动刷新绿标记，本拦截自动解除。红的先修，别交付。`);
process.exit(2);
