#!/usr/bin/env node
/* RPA·shot.js —— CDP 截当前页（绕开 playwright "等字体" 卡死）。
   用法：node shot.js <out.png> [port=9222] */
'use strict';
const { connect } = require('./_cdp');
const out = process.argv[2] || 'shot.png';
const port = process.argv[3] || 9222;
(async () => {
  const cdp = await connect(port);
  console.log('URL:', await cdp.url());
  await cdp.screenshot(out);
  console.log('截图:', out, '（AI 可直接读这张图，含图形验证码——自己识别，不用问用户）');
  cdp.close(); process.exit(0);
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
