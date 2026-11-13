#!/usr/bin/env node
/* 需求清单·收消息提醒（UserPromptSubmit 钩子·随包）
   用户每发一条消息，提醒 AI：先把这条消息里的每个要求记进已登记的「原型改动清单.md」，再动手。
   与 _stop-ledger-check.js（收工时对账）配成一对：进门先记，出门对账。
   没登记任何清单 → 什么都不输出（不适用的项目零打扰）。

   §2026-11-09 用户明令「彻底解决对话里说了却漏做」，加两件机器做的事：
   ① 关联旧条目：在清单里找状态为「暂缓 / 等你定」、且和这条消息说的是同一个对象（页面名、按钮名、【】里的名字）的旧条目，
      列给 AI，要求在新条目里写「关联第 X 条」并在回复里说明。（事故：用户早先说过“门店预订单恢复成收银订单下的页签”，
      当时暂缓；后来又发真系统截图要同一件事，AI 没翻旧条目，只改了门店预订单单独那一页就报“做完了”。）
   ② 有截图：消息里带图片时，要求新条目写「（有截图）」和「验收：对照截图……」，收工闸据此要求证据里有截图对比。
   ③ 记下本轮开始时各条目的状态（.claude/ledger-turn.json），收工闸据此判断哪些是「本轮才改成已做」的。 */
const fs = require('fs');
const path = require('path');
let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  let payload = {};
  try { payload = JSON.parse(String(input || '{}').replace(/^﻿/, '').trim() || '{}'); } catch (_) {}
  const prompt = String(payload.prompt || '');
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const reg = path.join(root, '.claude', 'ledgers.txt');
  if (!fs.existsSync(reg)) return;
  const files = fs.readFileSync(reg, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#') && fs.existsSync(s));
  if (!files.length) return;

  /* 读所有清单行：{file, id, status, text} */
  const rows = [];
  for (const f of files) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach(line => {
      if (!/^\s*\|/.test(line)) return;
      const cells = line.split('|').map(s => s.trim());
      const st = cells.find(c => /^(本轮·待做|已做|等你定|暂缓)$/.test(c));
      if (!st || !cells[1] || /^-+$/.test(cells[1])) return;
      rows.push({ file: f, id: cells[1], status: st, text: cells.slice(2).join(' ') });
    });
  }

  /* ① 关联旧条目：取消息里 3～8 个汉字的词和【】里的名字，在「暂缓/等你定」条目里找 */
  const terms = new Set();
  (prompt.match(/【[^】]{1,20}】/g) || []).forEach(t => terms.add(t.slice(1, -1)));
  (prompt.match(/[一-龥]{3,8}/g) || []).forEach(run => {
    for (let n = Math.min(6, run.length); n >= 3; n--) for (let i = 0; i + n <= run.length; i++) terms.add(run.slice(i, i + n));
  });
  const STOP = /^(你帮我|帮我把|是不是|为什么|怎么|这个|那个|一下|可以|需要|现在|我们|没有|还是|已经|如果|就是|什么)/;
  const useful = [...terms].filter(t => t.length >= 3 && !STOP.test(t));
  const related = [];
  for (const r of rows) {
    if (r.status !== '暂缓' && r.status !== '等你定') continue;
    const hit = useful.filter(t => r.text.indexOf(t) > -1);
    const longest = hit.sort((a, b) => b.length - a.length)[0];
    if (longest && longest.length >= 4) related.push({ r, hit: longest, n: hit.length });
  }
  related.sort((a, b) => b.n - a.n || b.hit.length - a.hit.length);

  /* ③ 本轮基线：本轮还没收工（open）就保留最早的基线，中途插话不覆盖 */
  const snapPath = path.join(root, '.claude', 'ledger-turn.json');
  let snap = null; try { snap = JSON.parse(fs.readFileSync(snapPath, 'utf8')); } catch (_) {}
  const hasImage = /\[Image|\.png|\.jpg|截图|截屏|图片/i.test(prompt);
  if (!snap || !snap.open) snap = { open: true, ts: Date.now(), base: {}, images: 0 };
  rows.forEach(r => { const k = path.basename(r.file) + '#' + r.id; if (!(k in snap.base)) snap.base[k] = r.status; });
  if (hasImage) snap.images = (snap.images || 0) + 1;
  try { fs.writeFileSync(snapPath, JSON.stringify(snap), 'utf8'); } catch (_) {}

  let ctx = '【需求清单铁律】动手前先把用户这条消息里的每个要求（有几件拆几行）记进清单，状态写「本轮·待做」，需求一栏照抄用户原话；'
    + '做完改「已做」并写在交付件里怎么验过的；要用户拍板的写「等你定」+建议。已登记清单：' + files.join('；')
    + '。规则见 skills/_shared/requirement-ledger.md';
  if (related.length) {
    ctx += '\n【关联旧条目·必须先看】这条消息和下面这些“暂缓/等你定”的旧条目说的可能是同一件事。先逐条判断；是同一件事的，新条目里写「关联第 X 条」，'
      + '把旧条目的要求一起做，并在回复第一句告诉用户：\n'
      + related.slice(0, 6).map(x => '· [' + path.basename(x.r.file) + '] 第 ' + x.r.id + ' 条（' + x.r.status + '，命中“' + x.hit + '”）：' + x.r.text.slice(0, 120)).join('\n');
  }
  if (hasImage) {
    ctx += '\n【有截图】这条消息带了截图：新条目需求一栏写「（有截图）」+「验收：对照截图的哪一处」。'
      + '做完后在交付件里截同一位置的图和用户截图对比，证据一栏必须写「截图对比：……一致」，否则收工闸不放行。'
      + '看不懂截图想表达什么，先在回复里复述理解、状态写「等你定」，不许先动手。';
  }
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: ctx } }));
});
