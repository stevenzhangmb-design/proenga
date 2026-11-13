#!/usr/bin/env node
/* 原型截图器（给 shot.ps1 用·随包·零依赖）
   用途：把指定的几页各截一张 png，AI 直接看图跟参考截图对 —— 这是【检查原型的唯一方式】。
   不做：不抽 DOM、不做指纹 diff、不写探针。那些是把 0.2 秒的活干成一天的根源。

   用法：node _shot-pages.js <原型.html> <页id,页id> <出图目录> [视图key] [宽] [高] [端口] */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const [, , FILE, PAGES, OUT, VIEW, W, H, PORT] = process.argv;
if (!FILE || !PAGES || !OUT) { console.error('用法: node _shot-pages.js <原型.html> <页id,…> <出图目录> [视图] [宽] [高] [端口]'); process.exit(2); }
const port = Number(PORT || 9423), w = Number(W || 1440), h = Number(H || 1000);
const view = (VIEW === '-' || !VIEW) ? '' : VIEW;   /* '-' 是 shot.ps1 传的占位符（PowerShell 会丢掉空字符串参数） */
const pages = String(PAGES).split(',').map(s => s.trim()).filter(Boolean);
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true });

/* 复用 RPA skill 的零依赖 CDP 客户端；没有就提示怎么起浏览器 */
const CDP = path.join(__dirname, '..', '..', 'rpa', '_cdp.js');
if (!fs.existsSync(CDP)) { console.error('缺 skills/rpa/_cdp.js'); process.exit(2); }
const { connect } = require(CDP);
const wait = ms => new Promise(s => setTimeout(s, ms));

(async () => {
  let c;
  try { c = await connect(port); }
  catch (e) {
    /* 浏览器没开就自己拉一个（launch.js 随 rpa skill 发） */
    const L = path.join(__dirname, '..', '..', 'rpa', 'launch.js');
    if (!fs.existsSync(L)) { console.error('连不上调试浏览器，且缺 skills/rpa/launch.js'); process.exit(2); }
    execFileSync('node', [L, 'about:blank', String(port)], { stdio: 'inherit' });
    await wait(1500);
    c = await connect(port);
  }
  await c.send('Page.bringToFront');
  await c.send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await c.send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });

  for (const pg of pages) {
    const q = '?' + (view ? 'view=' + view + '&' : '') + 'page=' + pg + '&_=' + Date.now();
    await c.navigate('file:///' + String(FILE).replace(/\\/g, '/') + q);
    /* 等首屏渲染出来（最多 8 秒） */
    for (let i = 0; i < 40; i++) {
      await wait(200);
      const ready = await c.evalv(`!!document.querySelector('.gl-table,.el-card,.fsteps,.es-card,.page-form,.detail-view')`);
      if (ready) break;
    }
    await wait(700);
    const s = await c.send('Page.captureScreenshot', { format: 'png' });
    const f = path.join(OUT, pg + '.png');
    fs.writeFileSync(f, Buffer.from(s.result.data, 'base64'));
    console.log('  ✓ ' + pg + ' → ' + f);
  }
  try { c.close(); } catch (_) {}
  process.exit(0);
})().catch(e => { console.error('截图失败：' + e.message); process.exit(3); });
