#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   画原型·四问提醒钩子 · _userprompt-ask-ui-hook.js · UserPromptSubmit 钩子
   ────────────────────────────────────────────────────────────────────────
   治"画原型开画前问 UI/端/地区/语言"这条【交互规则】——机器闸盖不了"AI 有没有问"，
   但 harness 钩子能在【检测到画原型意图】时【强制注入提醒】，让 AI 开画前先问齐。
   ·跨工具那层靠 SKILL.md 四问弹窗规则（所有 AI 读 skill 都遵循）；本钩子是 Claude Code 环境的额外强制。
   ·仅在 prompt 像"画原型/生成原型"时注入，别的 prompt 不打扰。
   注册：.claude/settings.json → hooks.UserPromptSubmit。输入 stdin JSON {prompt}，
        输出 hookSpecificOutput.additionalContext（注入给 AI 的上下文）。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
let raw = '';
process.stdin.on('data', d => raw += d);
process.stdin.on('end', () => {
  let prompt = '';
  try { prompt = (JSON.parse(raw || '{}').prompt) || ''; } catch (_) { prompt = raw || ''; }
  // 画原型意图（画/绘制 + 原型；或 生成/做 + 原型；或竞品反推画原型）——尽量宽松，宁多提醒不漏
  const wantsPrototype = /(画|绘制|做一?个|生成|新建|搞一?个|来一?个|help.*prototype|draw.*prototype|生成).{0,8}原型|原型.{0,6}(画|做|绘制|生成)|prototype/i.test(prompt)
    && !/^\s*(继续|接着|修|改|删|优化|重跑|验证|打包|固化)/.test(prompt);   // 明显是继续/修改类的不提醒
  if (!wantsPrototype) { process.exit(0); }
  const reminder =
    '【画原型铁律·开画前必先问用户·别直接开画】按 skills/pm-design/SKILL.md「四问弹窗」，动手前先问齐这四项：\n' +
    '① UI 规范：采用现有默认设计规范（system-design-spec.md）吗？还是你给参考(竞品网址/截图/自己的规范)？→ 决定走模式1(默认装配器) 还是模式2(自带骨架+inject-latest-anno-layer)。\n' +
    '② 端 / 形态：B端后台 / 移动版 / 小程序 / 网站…？\n' +
    '③ 部署地区 / 币种 / 时区：CN 还是 BR？币种(CNY/BRL)？日期时区格式？\n' +
    '④ 支持哪些语言：单语中文 ["zh"] / 中英葡 ["zh","en","pt"] / 中英葡西 ["zh","en","pt","spa"]？默认显示哪种？\n' +
    '   → 选多语则每条文案(含 custom 页整块 HTML)必须写成 {"zh":…,"en":…,"pt":…}；mock 业务数据不翻译；region=BR 的多语原型必须含 pt。\n' +
    '问齐再开画；缺项先问、禁臆测。四答作为 choice 传给 assemble-prototype.js（烙成 __DESIGN_CHOICE__）。\n' +
    '画完/生成PRD后按 SKILL.md 跑 qa/deliver-gate.js 全绿再交付。';
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: reminder } }));
  process.exit(0);
});
