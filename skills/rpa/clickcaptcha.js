#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   clickcaptcha.js · 点选式验证码（按顺序点文字 / 点出某类图片 / 点图形）
   ────────────────────────────────────────────────────────────────────────
   2026-11-19 建。用户要求：除了滑块，还有一类图形验证是“请依次点击：春 夏 秋”、
   “请点击所有包含红绿灯的图片”、“点击图中的三角形”——要 AI 自己过。

   分工：工具负责“看清楚、点准”，AI 负责“看懂该点哪里”（和 captcha.js 读字符图一样）。
     第 1 步 probe：找到验证框，读出题目文字，把验证图那块截成图（CSS 像素、带坐标刻度），
                   打印图在页面上的位置。AI 读这张图，按题目找出要点的位置。
     第 2 步 click：AI 把要点的位置（**相对验证图左上角**，直接照刻度图量）按顺序传进来，
                   工具重新定位验证图（防止页面挪动），按人手节奏依次点；
                   有【确定/提交/验证】就点掉；再判断过没过（验证图还在不在）。
     没过：多数系统会自动换一张，重跑 probe 再来；最多试 4 次再告诉用户。

   用法：
     node clickcaptcha.js <port> probe [图路径=<工作目录>/_temp/clickcap.png]
     node clickcaptcha.js <port> click "x1,y1;x2,y2;x3,y3"
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const { connect } = require('./_cdp');
const sleep = ms => new Promise(z => setTimeout(z, ms));
const rnd = (a, b) => a + Math.random() * (b - a);
const port = process.argv[2] || '9222';
const mode = process.argv[3] || 'probe';
const arg = process.argv[4];

/* 找验证框：题目文字 + 离它最近的那张大图（img / canvas / CSS 背景图都认） */
const PROBE = `(function(){
  var vis=function(e){var r=e.getBoundingClientRect();var s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.05;};
  var Q=/请?(依次|按顺序|按照顺序)?点击|请?(选出|选择|点选)|点出|click|select all|tap|clique|selecione/i;
  var leafs=[].slice.call(document.querySelectorAll('body *')).filter(function(e){
    return vis(e)&&Q.test(e.innerText||'')&&(e.innerText||'').length<80;});
  /* 题目取最里层那个 */
  leafs=leafs.filter(function(e){return !leafs.some(function(o){return o!==e&&e.contains(o);});});
  var hasBg=function(e){var b=getComputedStyle(e).backgroundImage;return b&&b!=='none'&&/url\\(/.test(b);};
  var pics=[].slice.call(document.querySelectorAll('img,canvas,div')).filter(function(e){
    if(!vis(e))return false;var r=e.getBoundingClientRect();
    return (e.tagName!=='DIV'||hasBg(e))&&r.width>=120&&r.height>=60&&r.width<=800;});
  if(!pics.length)return JSON.stringify({ok:false,why:'没找到验证图'});
  var q=leafs[0]||null,qr=q?q.getBoundingClientRect():null;
  var pic=null,best=1e9;
  pics.forEach(function(e){var r=e.getBoundingClientRect();
    var d=qr?Math.abs(r.top-qr.bottom)+Math.abs(r.left-qr.left)/3:-(r.width*r.height);
    if(d<best){best=d;pic=e;}});
  var r=pic.getBoundingClientRect();
  /* 题目里的小图标（比如“请依次点击：[图][图][图]”）也一起截进来，方便 AI 对照 */
  var qbox=qr?{x:qr.left,y:qr.top,w:qr.width,h:qr.height}:null;
  return JSON.stringify({ok:true,question:q?(q.innerText||'').replace(/\\s+/g,' ').trim():'',
    pic:{x:r.left,y:r.top,w:r.width,h:r.height},qbox:qbox});
})()`;

/* 给截图画刻度：每 20px 一条细线、每 50px 标数字，AI 量坐标不用心算 */
const GRID = (uri, w, h) => `new Promise(function(done){var w=${w},h=${h};var im=new Image();im.onerror=function(){done('ERR:载入失败');};im.onload=function(){try{
  var c=document.createElement('canvas');c.width=w+30;c.height=h+20;var x=c.getContext('2d');
  x.fillStyle='#fff';x.fillRect(0,0,c.width,c.height);x.drawImage(im,30,20,w,h);
  x.font='10px sans-serif';x.fillStyle='#d00';x.strokeStyle='rgba(255,0,0,.35)';x.lineWidth=1;
  for(var i=0;i<=w;i+=20){x.beginPath();x.moveTo(30+i+.5,i%100?14:8);x.lineTo(30+i+.5,i%100?20:h+20);x.stroke();if(i%50===0)x.fillText(i,30+i-5,8);}
  for(var j=0;j<=h;j+=20){x.beginPath();x.moveTo(j%100?24:18,20+j+.5);x.lineTo(j%100?30:w+30,20+j+.5);x.stroke();if(j%50===0)x.fillText(j,2,20+j+4);}
  done(c.toDataURL('image/png'));}catch(err){done('ERR:'+err.message);}};im.src=${JSON.stringify(uri)};})`;

async function shot(c, r) {
  const m = JSON.parse(await c.evalv('JSON.stringify({d:devicePixelRatio||1})'));
  const { result } = await c.send('Page.captureScreenshot', { format: 'png',
    clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 / m.d } });
  return 'data:image/png;base64,' + result.data;
}

async function tap(c, x, y) {
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: x + rnd(-6, 6), y: y + rnd(-6, 6), buttons: 0 });
  await sleep(rnd(90, 200));
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
  await sleep(rnd(40, 90));
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(rnd(60, 130));
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
}

/* 点完后找【确定/提交/验证】：验证图附近、彩色实底、不是刷新/关闭 */
const CONFIRM = (pic) => `(function(){var p=${JSON.stringify(pic)};
  var vis=function(e){var r=e.getBoundingClientRect();var s=getComputedStyle(e);return r.width>20&&r.height>14&&s.visibility!=='hidden'&&s.display!=='none';};
  var NOT=/刷新|换一|关闭|取消|帮助|refresh|close|cancel|help/i;
  var c=[].slice.call(document.querySelectorAll('button,[role=button],a,div,span')).filter(function(e){
    if(!vis(e))return false;var t=(e.innerText||'').replace(/\\s+/g,'');if(!t||t.length>6||NOT.test(t))return false;
    if(!/确定|确认|提交|验证|完成|ok|confirm|submit|verify|done|confirmar|enviar/i.test(t))return false;
    var r=e.getBoundingClientRect();return r.top>=p.y-10&&r.top<=p.y+p.h+150&&r.left>=p.x-60&&r.right<=p.x+p.w+60;});
  c=c.filter(function(e){return !c.some(function(o){return o!==e&&e.contains(o);});});
  if(!c.length)return null;var r=c[0].getBoundingClientRect();
  return JSON.stringify({x:r.left+r.width/2,y:r.top+r.height/2,text:(c[0].innerText||'').trim()});})()`;

(async () => {
  const c = await connect(port);
  try { await c.send('Page.bringToFront'); } catch (_) {}
  try {
    if (process.env.RPA_DEBUG) console.log('· 定位验证框');
    const info = JSON.parse(await c.evalv(PROBE) || '{}');
    if (process.env.RPA_DEBUG) console.log('· 定位完成', JSON.stringify(info));
    if (!info.ok) { console.error('✗ ' + info.why); process.exit(1); }
    if (mode === 'probe') {
      const out = arg || '<工作目录>/_temp/clickcap.png';
      const raw = await shot(c, info.pic);
      if (process.env.RPA_DEBUG) console.log('· 截图完成', raw.length);
      const g = await c.evalv(GRID(raw, Math.round(info.pic.w), Math.round(info.pic.h)), true);
      if (String(g).startsWith('ERR:')) { console.error('✗ 画刻度失败：' + g); process.exit(1); }
      fs.writeFileSync(out, Buffer.from(g.split(',')[1], 'base64'));
      let qout = '';
      if (info.qbox) { qout = out.replace(/\.png$/i, '-题目.png'); fs.writeFileSync(qout, Buffer.from((await shot(c, info.qbox)).split(',')[1], 'base64')); }
      console.log('题目：' + (info.question || '（没读到文字题目，看题目截图）'));
      console.log('验证图：' + out + '（红色刻度 = 相对验证图左上角的坐标，单位 CSS 像素）');
      if (qout) console.log('题目截图：' + qout + '（题目是小图标时对照它找）');
      console.log('下一步：node clickcaptcha.js ' + port + ' click "x1,y1;x2,y2;..."  —— 按题目要求的顺序，坐标照刻度量');
      return;
    }
    if (mode === 'click') {
      const pts = String(arg || '').split(';').map(s => s.split(',').map(Number)).filter(p => p.length === 2 && p.every(isFinite));
      if (!pts.length) { console.error('✗ 没给坐标'); process.exit(1); }
      for (const [x, y] of pts) { await tap(c, info.pic.x + x, info.pic.y + y); await sleep(rnd(350, 700)); }
      console.log('已按顺序点 ' + pts.length + ' 处');
      await sleep(600);
      const b = await c.evalv(CONFIRM(info.pic));
      if (b) { const bb = JSON.parse(b); await tap(c, bb.x, bb.y); console.log('点【' + bb.text + '】'); }
      await sleep(2000);
      const after = JSON.parse(await c.evalv(PROBE) || '{}');
      const gone = !after.ok || Math.abs(after.pic.x - info.pic.x) > 3 || Math.abs(after.pic.y - info.pic.y) > 3 || after.question !== info.question;
      const body = await c.evalv("(document.body.innerText||'').replace(/\\s+/g,' ').slice(0,4000)");
      const failMsg = /验证失败|请重试|再试一次|failed|try again/i.test(body);
      if (gone && !failMsg) console.log('✅ 验证框已消失 · 当前 ' + await c.evalv('location.href'));
      else { console.log('✗ 没过（验证框还在' + (failMsg ? '，页面提示失败' : '') + '）→ 重跑 probe 看新图再点'); process.exit(3); }
      return;
    }
    console.error('用法：probe | click "x,y;x,y"'); process.exit(1);
  } finally { c.close(); }
})().catch(e => { console.error('✗ ' + (e && e.message || e)); process.exit(1); });
