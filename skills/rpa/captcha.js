/* RPA·captcha.js —— 把页面图形验证码抽成【小而清晰】的 PNG，供 AI 读图识别。
   根治「读整页大截图撞图像请求上限 + 经视口渲染糊」两个坑（2026-09-16）：
     ① 优先直接抽验证码 <img> 的 data:URI（像素级·不经视口·最清晰）；
     ② 抽不到 data 则 CDP 只截验证码元素的紧贴区域并放大 3×（clip.scale）。
   产物是一张几十×百来像素的小图 → 既躲开 API 限制、识别率又高。
   用法：node captcha.js [out=captcha.png] [port=9222] [selectorHint]
   零依赖（Node18+ fetch/WebSocket + 本机 Chrome CDP）。识别后用一次性脚本填入(见 SKILL.md 凭据纪律)。 */
'use strict';
const fs = require('fs');
const { connect } = require('./_cdp');
const OUT = process.argv[2] || 'captcha.png';
const PORT = process.argv[3] || 9222;
const HINT = process.argv[4] || '';

const FINDER = `(() => {
  const hint = ${JSON.stringify(HINT)};
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 8 && r.height > 6; };
  // 常见验证码容器/图选择器（各家框架都覆盖）+ 用户传的 hint
  const sels = [hint, '.code-img img', '.imgcode-box img', '.captcha img', '.verify-img img', '[class*=captcha] img', '[class*=code] img', '[class*=verify] img', 'img.el-image__inner'].filter(Boolean);
  let el = null;
  for (const s of sels) { const c = [...document.querySelectorAll(s)].filter(vis); if (c.length) { el = c[0]; break; } }
  // 兜底：找「验证码」输入框附近、尺寸像验证码(宽40~200·高18~80)的小图
  if (!el) {
    const capIn = [...document.querySelectorAll('input')].find(i => /验证码|captcha|code/i.test(i.placeholder || ''));
    const cy = capIn ? capIn.getBoundingClientRect().top : null;
    const imgs = [...document.querySelectorAll('img,canvas')].filter(vis).filter(e => { const r = e.getBoundingClientRect(); return r.width >= 40 && r.width <= 220 && r.height >= 16 && r.height <= 90; });
    el = (cy != null ? imgs.sort((a, b) => Math.abs(a.getBoundingClientRect().top - cy) - Math.abs(b.getBoundingClientRect().top - cy))[0] : imgs[0]) || null;
  }
  if (!el) return { ok: false };
  const r = el.getBoundingClientRect();
  const src = el.tagName === 'IMG' ? (el.currentSrc || el.src || '') : '';
  let dataUri = '';
  if (/^data:image\\//.test(src)) dataUri = src;
  else if (el.tagName === 'CANVAS') { try { dataUri = el.toDataURL('image/png'); } catch (_) {} }
  return { ok: true, tag: el.tagName, cls: (el.className || '').toString().slice(0, 40), dataUri,
           x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height) };
})()`;

(async () => {
  const s = await connect(Number(PORT));
  const info = await s.evalv(FINDER);
  if (!info || !info.ok) { console.log('❌ 没找到验证码图（传选择器提示：node captcha.js out.png 9222 "选择器"）'); s.close(); process.exit(1); }
  if (info.dataUri) {
    const m = info.dataUri.match(/^data:([^;]+);base64,(.*)$/);
    if (m) { fs.writeFileSync(OUT, Buffer.from(m[2], 'base64')); console.log('✅ 抽到 data:URI（像素级）→', OUT, '·类型', m[1], '·', info.w + 'x' + info.h, '·选择器', info.cls); s.close(); process.exit(0); }
  }
  // 退路：CDP 紧裁该元素 + 放大 3×
  const pad = 2;
  const { result } = await s.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.max(0, info.x - pad), y: Math.max(0, info.y - pad), width: info.w + pad * 2, height: info.h + pad * 2, scale: 3 } });
  fs.writeFileSync(OUT, Buffer.from(result.data, 'base64'));
  console.log('✅ CDP 紧裁 3× →', OUT, '·', info.w + 'x' + info.h, '@3x ·选择器', info.cls, '（无 data:URI·走截图放大）');
  s.close(); process.exit(0);
})().catch(e => { console.log('ERR', e.message); process.exit(1); });
