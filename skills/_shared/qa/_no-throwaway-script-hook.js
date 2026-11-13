#!/usr/bin/env node
/* ① 禁写一次性脚本闸（PreToolUse·随包·跨机器通用·2026-09-28 用户明令）
   ────────────────────────────────────────────────────────────────
   铁律：不管谁让 AI 画原型 / 改原型，都必须非常快，不准做不相关的事。
   实测根因：AI 一遇到「要检查一下」就去写 DOM 探针 / 指纹 diff / 审计工具，
   一个会话写了 130+ 个一次性脚本 —— 0.2 秒的活干成一天。
   规矩管不住（提速铁律写过三轮、三轮都被违反），所以做成机器拦。

   拦什么：往临时/暂存目录写 .js / .ps1 / .mjs / .cjs（= 一次性脚本）。
   放什么：
     · 写进包里的正式文件（skills/ 下、qa/ 下）—— 那是产品本身，不是一次性脚本
     · 用户明确说了「写个脚本」「做个工具」—— 见下方"用户授权"
     · 非脚本文件（.json / .md / .html …）
   怎么放行：用户说「允许写脚本」后，在 .claude/ 下放一个 allow-scripts.flag 文件（本机专用）。
     ⚠ 2026-10-06 加固：这个 flag **2 小时后自动过期**。
       事故：flag 被放下后一直没人删，闸等于长期关着 —— 10-06 这一轮我写了 8 个一次性脚本，
       闸一声没吭。用户以为装了闸，其实早被这个文件关掉了。
       「一个能被永久关掉、而且没人知道它关着的闸，等于没有闸。」
     ⚠ 2026-10-06 再加固：即使没过期，**一轮会话也只放 1 个**；第 2 个照样拦，
       并直接给出 skills/pm-design/p.js 的现成命令（查/改/截图，0.15~7 秒，不用写脚本）。

   AI 该怎么做（拦住时会原样告诉它）：
     检查原型 = 看生成的原型样式（截图），不是代码层级检查。
     改完跑 skills/pm-design/quick.ps1（0.2 秒）→ 截图自己看 → 跟参考截图对 → 不一样就改。 */
'use strict';
const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  let p = {};
  try { p = JSON.parse(String(input || '{}').replace(/^﻿/, '').trim() || '{}'); } catch (_) { return; }
  const tool = p.tool_name || '';
  if (!/^(Write|Edit|MultiEdit|NotebookEdit)$/.test(tool)) return;
  const f = String((p.tool_input && (p.tool_input.file_path || p.tool_input.notebook_path)) || '');
  if (!f) return;

  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

  const low = f.replace(/\\/g, '/').toLowerCase();
  const isScript = /\.(js|mjs|cjs|ps1|py|sh|bat)$/.test(low);
  if (!isScript) return;

  /* 包里的正式文件放行：产品代码本来就该改 */
  const inPackage = low.indexOf('/skills/') > -1 || low.indexOf('/qa/') > -1 || low.indexOf('/.claude/') > -1;
  if (inPackage) return;

  /* 只拦临时/暂存目录（一次性脚本都写在这里） */
  const isTemp = /\/(temp|tmp|scratchpad|appdata\/local\/temp)\//.test(low);
  if (!isTemp) return;

  /* ── 放行标记：2 小时自动过期（见顶部"加固"说明）── */
  const flag = path.join(root, '.claude', 'allow-scripts.flag');
  let flagOn = false, flagAgeH = 0;
  try {
    if (fs.existsSync(flag)) {
      flagAgeH = (Date.now() - fs.statSync(flag).mtimeMs) / 3600000;
      flagOn = flagAgeH < 2;
      if (!flagOn) { try { fs.unlinkSync(flag); } catch (_) { } }   // 过期即自毁，别留着骗人
    }
  } catch (_) { }

  /* ── 本轮配额：即使 flag 有效，一轮也只放 1 个 ── */
  const store = path.join(root, '.claude', '.throwaway-script-count.json');
  let db = {}; try { db = JSON.parse(fs.readFileSync(store, 'utf8')); } catch (_) { }
  const ks = Object.keys(db); if (ks.length > 20) ks.slice(0, ks.length - 20).forEach(k => delete db[k]);
  const sid = String(p.session_id || 'nosession');
  const seen = db[sid] || [];
  if (seen.indexOf(f) > -1) return;                      // 同一个脚本改第二次不算新脚本

  const QUOTA = flagOn ? 3 : 1;
  if (seen.length < QUOTA) {
    seen.push(f); db[sid] = seen;
    try { fs.mkdirSync(path.dirname(store), { recursive: true }); fs.writeFileSync(store, JSON.stringify(db), 'utf8'); } catch (_) { }
    return out({
      hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'allow' },
      systemMessage: '【禁一次性脚本闸】本轮第 ' + seen.length + '/' + QUOTA + ' 个临时脚本' +
        (flagOn ? '（allow-scripts.flag 有效，还剩 ' + (2 - flagAgeH).toFixed(1) + ' 小时）' : '') +
        '。再写会被拦 —— 查/改/截图请用 skills/pm-design/p.js。'
    });
  }

  out({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason:
        '【禁写一次性脚本】本轮已经写了 ' + seen.length + ' 个临时脚本（' +
        seen.slice(-3).map(x => path.basename(x)).join('、') + '…），这是第 ' + (seen.length + 1) + ' 个 —— 拦住。\n' +
        '这是把 0.375 秒的活干成一整天的头号原因（2026-10-06 实测：一轮会话 7653 次工具调用，机器只占几秒）。\n\n' +
        '查 / 改 / 看，全都有现成命令，别写脚本（skills/pm-design/p.js，实测 0.15~7 秒）：\n' +
        '  这句话写在哪？    node skills/pm-design/p.js <源.json> find "文字"\n' +
        '  这一页有什么？    node skills/pm-design/p.js <源.json> show <页id>\n' +
        '  取某个值          node skills/pm-design/p.js <源.json> get "<路径>"\n' +
        '  改一处 + 看结果   node skills/pm-design/p.js <源.json> set "<路径>=<值>" --shot <页id>\n' +
        '  只看某页          node skills/pm-design/p.js <源.json> shot <页id> [--click "文案"] [--tab "页签"]\n' +
        '  一批改完交付      skills/pm-design/rebuild-deliverable.ps1 -ProjectData <源.json>\n\n' +
        '「检查原型 = 看生成的原型样式（截图），不是代码层级检查」—— 用户 2026-09-28 原话。\n' +
        '确实是 p.js 表达不了的结构性改造：先在对话里说清要写什么脚本、为什么，用户同意后\n' +
        '在 .claude/ 放一个空文件 allow-scripts.flag（2 小时后自动失效，配额放宽到 3 个）。'
    },
    systemMessage: '【禁一次性脚本闸】拦下第 ' + (seen.length + 1) + ' 个一次性脚本 —— 改用 skills/pm-design/p.js'
  });
});
function out(o) { process.stdout.write(JSON.stringify(o)); }
