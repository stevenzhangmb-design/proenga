#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   type.js · 硬件级「点一下 + 逐字敲进去 + 再点一下」
   ────────────────────────────────────────────────────────────────────────
   2026-10-28 建。起因：登录 某 OMS 时，用脚本给输入框赋值（el.value = x 再派发
   input/change 事件）**表面上填进去了，提交却完全没反应、连错误都不报** —— 说明这类
   表单并不认合成事件，它要的是真实键盘输入（很多登录框还会监听 keydown/keyup 做校验）。
   act.js 的 fill 走的就是赋值那条路，所以在这种站上必然失败。

   本工具全程走 CDP 的 Input.* —— 和真人敲键盘、真人点鼠标在浏览器看来是一回事：
     · 点输入框：mousePressed / mouseReleased（真实坐标）
     · 清空：Ctrl+A 再 Delete
     · 输入：逐字符 keyDown + char + keyUp，每字之间 40~110ms 随机停顿（像人打字）
     · 点按钮：同样走真实鼠标事件

   用法：
     node type.js <port> click <x> <y>              真实点击某坐标
     node type.js <port> type <x> <y> <文本>         点进该坐标的输入框并逐字敲入
     node type.js <port> seq <port说明见下>           组合：见下方示例

   例（OMS 登录：填验证码再点登录）：
     node type.js 9612 type 1036 454 0073
     node type.js 9612 click 1093 607
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const { connect } = require('./_cdp');
const sleep = ms => new Promise(z => setTimeout(z, ms));
const rnd = (a, b) => a + Math.random() * (b - a);

async function realClick(c, x, y) {
  /* 先把鼠标移过去（有些控件要 hover 才激活），再按下松开 */
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await sleep(rnd(40, 90));
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await sleep(rnd(30, 70));
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
}

async function realType(c, text) {
  for (const ch of String(text)) {
    /* ⚠️ 2026-10-28 两条实测教训：
       ① keyDown 只要带了 text，字符就已落进输入框；再补发 char 会变成【每字两次】
          （验证码 0073 被敲成 00007733）。
       ② 但只给 text/key **不够**：有些框架（Element Plus 的输入框就是）会看 code 和
          windowsVirtualKeyCode 判断这是不是一次真实按键，缺了它们事件照收、字却不落。
          所以这里把键码补全。 */
    const isDigit = ch >= '0' && ch <= '9';
    const isAlpha = /[a-zA-Z]/.test(ch);
    const code = isDigit ? 'Digit' + ch : (isAlpha ? 'Key' + ch.toUpperCase() : undefined);
    const vk = isDigit ? 48 + (+ch) : (isAlpha ? ch.toUpperCase().charCodeAt(0) : undefined);
    const base = { text: ch, unmodifiedText: ch, key: ch };
    if (code) { base.code = code; base.windowsVirtualKeyCode = vk; base.nativeVirtualKeyCode = vk; }
    await c.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown' }, base));
    await c.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyUp' }, base, { text: undefined, unmodifiedText: undefined }));
    await sleep(rnd(40, 110));          // 人打字的节奏，不是瞬间粘贴
  }
}

async function clearField(c) {
  /* Ctrl+A 全选再删除 —— 比直接改 value 干净，而且走的是真实按键 */
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
  await sleep(rnd(30, 60));
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 });
  await sleep(rnd(30, 60));
}

(async () => {
  const a = process.argv.slice(2);
  const port = +(a[0] || 9222);
  const cmd = a[1];
  if (!cmd) { console.error('用法: node type.js <port> click <x> <y> | <port> type <x> <y> <文本>'); process.exit(2); }
  const c = await connect(port);
  try {
    /* ⚠️ 窗口在后台时键盘事件不落字（焦点对、value 却是空）——操作前必须置前 */
    try { await c.send('Page.bringToFront'); } catch (_) {}
    if (cmd === 'click') {
      const x = +a[2], y = +a[3];
      await realClick(c, x, y);
      console.log('✅ 真实点击 (' + x + ',' + y + ')');
    } else if (cmd === 'type') {
      const x = +a[2], y = +a[3], txt = a.slice(4).join(' ');
      await realClick(c, x, y);
      await sleep(rnd(120, 220));
      await clearField(c);
      await realType(c, txt);
      console.log('✅ 已在 (' + x + ',' + y + ') 逐字敲入 ' + txt.length + ' 个字符');
    } else { console.error('未知命令: ' + cmd); process.exit(2); }
    await sleep(300);
  } finally { c.close(); }
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
