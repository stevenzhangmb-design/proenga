#!/usr/bin/env node
/* 需求清单收工闸（Stop 钩子·随包·跨机器通用）
   铁律：用户在对话里提的每一条要求，都要当场记进该原型目录下的「原型改动清单.md」。
   清单里只要还有状态为「本轮·待做」的行，就不准收工 —— 本脚本在 Claude 想结束这一轮时拦下，并列出没做完的条目。

   清单从哪里找（不写死任何盘符，装在谁的机器上都能用）：
     ${CLAUDE_PROJECT_DIR}/.claude/ledgers.txt —— 每行一个清单文件的绝对路径（开始改某个原型时由 AI 登记，本机专用·已 gitignore）
   清单格式：Markdown 表格，某一列写状态，取值 本轮·待做 / 已做 / 等你定 / 暂缓。

   防死循环：同一次收工第二次被触发（stop_hook_active=true）时不再拦，但把未完成条目作为提示显示给用户，
   让"没做完"对用户可见，而不是悄悄放过。 */
const fs = require('fs');
const path = require('path');

let input = '';
process.stdin.on('data', c => { input += c; });
process.stdin.on('end', () => {
  let payload = {};
  /* Windows PowerShell 往管道里写会带 BOM，先去掉再解析，否则 stop_hook_active 读不到 → 死循环拦截 */
  try { payload = JSON.parse(String(input || '{}').replace(/^﻿/, '').trim() || '{}'); } catch (_) {}
  const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
  const reg = path.join(root, '.claude', 'ledgers.txt');
  if (!fs.existsSync(reg)) return;                      // 没登记任何清单 = 不适用，放行
  const files = fs.readFileSync(reg, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(s => s && !s.startsWith('#'));
  const open = [];
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach(line => {
      if (!/^\s*\|/.test(line) || line.indexOf('本轮·待做') < 0) return;
      const cells = line.split('|').map(s => s.trim()).filter(Boolean);
      open.push('· [' + path.basename(f) + '] ' + cells.slice(0, 3).join(' ｜ '));
    });
  }
  /* §2026-10-29 新增项待批准（用户铁律「没让做的一个都不许加」）：清单同目录下的 *.added-pending.txt 有内容
     = 改动里有用户没批准过的新增（新页签/新字段/新按钮/新示例单…，由 pm-design/qa/added-structure-audit.js 对比得出）。
     必须先列给用户、用户点头后跑 --accept 清掉，才能收工。 */
  for (const f of files) {
    if (!fs.existsSync(f)) continue;
    let names = []; try { names = fs.readdirSync(path.dirname(f)).filter(n => /\.added-pending\.txt$/.test(n)); } catch (_) {}
    for (const n of names) { const p = path.join(path.dirname(f), n); const t = String(fs.readFileSync(p, 'utf8') || '').trim();
      if (t) open.push('· [新增项待批准·' + n + '] ' + t.split(/\r?\n/).slice(0, 8).join('；') + '　→ 先列给用户问清，用户批准后跑 node skills/pm-design/qa/added-structure-audit.js <project-data.json> --accept'); }
  }
  /* §2026-11-09 用户明令「改成机器强制，不靠自觉」——两道新检查：
     ① 有截图的条目：本轮才改成「已做」、需求里写了「（有截图）」的，证据里必须有「截图对比」（在交付件里截同一位置和用户截图比过）。
        事故：用户发真系统截图要“门店预订单做成收银订单下的页签”，AI 只改了单独那页的左栏，自测只验了自己理解的样子就报做完。
     ② 先确认再动手：本轮回复里写了「我的理解」，同一轮又改了文件 → 拦下。写了“我的理解”就说明有歧义，必须等用户回复。 */
  const snapPath = path.join(root, '.claude', 'ledger-turn.json');
  let snap = null; try { snap = JSON.parse(fs.readFileSync(snapPath, 'utf8')); } catch (_) {}
  if (snap && snap.open) {
    for (const f of files) {
      if (!fs.existsSync(f)) continue;
      fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach(line => {
        if (!/^\s*\|/.test(line)) return;
        const cells = line.split('|').map(s => s.trim());
        const id = cells[1]; if (!id || !cells.includes('已做')) return;
        const was = (snap.base || {})[path.basename(f) + '#' + id];
        if (was === '已做') return;                         // 不是本轮改的
        if (line.indexOf('（有截图）') > -1 && line.indexOf('截图对比') < 0)
          open.push('· [' + path.basename(f) + '] 第 ' + id + ' 条带截图，却没有「截图对比」证据：在交付件里截同一位置和用户截图对比后写进证据栏，再改已做');
      });
    }
  }
  try {
    const tp = payload.transcript_path;
    if (tp && fs.existsSync(tp)) {
      const lines = fs.readFileSync(tp, 'utf8').split(/\r?\n/).filter(Boolean);
      let start = 0;                                        // 本轮 = 最后一条用户真消息之后
      for (let i = lines.length - 1; i >= 0; i--) { let j; try { j = JSON.parse(lines[i]); } catch (_) { continue; }
        if (j.type === 'user' && j.message && (typeof j.message.content === 'string' || (Array.isArray(j.message.content) && j.message.content.some(c => c.type === 'text')))) { start = i; break; } }
      let said = '', edited = '';
      for (let i = start + 1; i < lines.length; i++) { let j; try { j = JSON.parse(lines[i]); } catch (_) { continue; }
        if (j.type !== 'assistant' || !j.message || !Array.isArray(j.message.content)) continue;
        for (const c of j.message.content) {
          if (c.type === 'text' && /我的理解[是：:，,]|我理解的是|我理解为|我理解的“/.test(c.text || '')) said = said || (c.text.match(/.{0,20}(我的理解[是：:，,]|我理解的是|我理解为|我理解的“).{0,40}/) || [''])[0];
          if (said && c.type === 'tool_use') {
            const inp = c.input || {}; const fp = String(inp.file_path || '');
            const isLedger = /改动清单|ledger/i.test(fp);
            if ((c.name === 'Edit' || c.name === 'Write') && fp && !isLedger) edited = edited || fp;
            const cmd = String(inp.command || '');
            if ((c.name === 'PowerShell' || c.name === 'Bash') && /writeFileSync|Set-Content|Out-File|Copy-Item|rebuild-deliverable|make-doc/.test(cmd) && !/改动清单/.test(cmd)) edited = edited || 'PowerShell 写文件';
          }
        }
      }
      if (said && edited) open.push('· 本轮写了「' + said.trim() + '」之后又改了文件（' + path.basename(edited) + '）：有歧义就要先停下等用户确认，不许边说“我的理解”边动手。'
        + '把相关条目改成「等你定」，在回复里复述理解等用户回复');
    }
  } catch (_) {}
  if (!open.length) {                                   // 全部做完，放行；本轮基线收口
    if (snap && snap.open) { snap.open = false; try { fs.writeFileSync(snapPath, JSON.stringify(snap), 'utf8'); } catch (_) {} }
    return;
  }
  const list = open.slice(0, 20).join('\n') + (open.length > 20 ? '\n…共 ' + open.length + ' 条' : '');
  if (payload.stop_hook_active) {
    process.stdout.write(JSON.stringify({ systemMessage: '⚠ 收工检查还有 ' + open.length + ' 项没过（没做完 / 缺截图对比 / 没确认就动手）：\n' + list }));
    return;
  }
  process.stdout.write(JSON.stringify({
    decision: 'block',
    reason: '收工检查没过，还有 ' + open.length + ' 项：「本轮·待做」要逐条做完并改成「已做」(附证据)；带截图的要补截图对比；'
      + '写了“我的理解”又动了文件的，要改成「等你定」等用户确认。确实要用户拍板的写明建议。\n' + list,
  }));
});
