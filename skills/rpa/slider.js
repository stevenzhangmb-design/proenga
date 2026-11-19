#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   slider.js · 滑块验证码自动过关（拼图缺口 + 纯滑动条通吃）
   ────────────────────────────────────────────────────────────────────────
   2026-10-28 建；2026-11-19 重写找缺口的方法（登 BigSeller 时旧版失败）。

   能过的两种：
     ① 拼图缺口滑块 —— 背景图上挖掉一块，要把滑块拖到缺口位置
     ② 纯滑动条     —— 拖到最右即可（找不到拼图时自动退化成这种）
   过不了的：扭曲字符图（走 captcha.js，AI 自己读图）、邮箱/短信码（走 awaitcode.js 等用户填）

   【一】找缺口：直接对屏幕截图做像素分析，不读页面里的图片
     旧版只认 data: 开头的 <img>，在页面里画进 canvas 读像素。BigSeller 的拼图图片
     不是这种 —— 结果连背景图都没找到（"背景图 0px"），退化成拖到最右，必然失败。
     验证码的图有的是 <img>、有的是 <canvas>、有的是 CSS 背景图，跨域图片还读不了像素；
     但**屏幕截图**永远拿得到。所以现在：
       ① 页面里只量位置：背景图区域、拼图块位置和宽高、拖动手柄（任何元素类型都认）
       ② 用 CDP 截下背景图那块区域（CSS 像素），载回页面画进 canvas（data: 图不跨域）
       ③ 在拼图块所在的那条横带里，逐列算「带内亮度 − 带外亮度」：
          缺口是一块被压暗（或描白边）的区域，带内外亮度差会明显偏离其它列；
          用拼图块宽度做滑窗，偏离最大的窗口就是缺口（跳过拼图块自己所在的位置）
     2026-11-19 BigSeller 实测：缺口左沿 841、拼图左沿 670 → 拖 171px 过关。

   【二】拖动轨迹像人手：先快后慢 + 末端过冲回拉 + 纵向 1~2px 抖动 + 随机间隔，
     走 CDP 的 Input.dispatchMouseEvent（硬件级）。

   【三】过没过，看验证框还在不在（背景图元素是否仍可见），不靠匹配某句文案 ——
     旧版只认「拖动滑块」四个字，BigSeller 写的是「拖动下方滑块完成拼图」，没过也报“已消失”。
     没过就点刷新换一张重来，最多 4 次。

   用法：
     node slider.js [port=9222] [--dry]     --dry 只算不拖
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const { connect } = require('./_cdp');

const sleep = ms => new Promise(z => setTimeout(z, ms));
const rnd = (a, b) => a + Math.random() * (b - a);

/* 量位置：背景图 / 拼图块 / 手柄 / 刷新按钮。只量，不读像素。 */
const PROBE = `(function(){
  var vis=function(e){var r=e.getBoundingClientRect();var s=getComputedStyle(e);
    return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&+s.opacity>0.05;};
  var hasBg=function(e){var b=getComputedStyle(e).backgroundImage;return b&&b!=='none'&&/url\\(/.test(b);};
  var all=[].slice.call(document.querySelectorAll('img,canvas,div,span,i'));
  var pics=all.filter(function(e){return vis(e)&&(e.tagName==='IMG'||e.tagName==='CANVAS'||hasBg(e));});
  /* 背景图：宽 150~700、高 60~500 里面积最大的 */
  var bg=null,ba=0;
  pics.forEach(function(e){var r=e.getBoundingClientRect();
    if(r.width>=150&&r.width<=700&&r.height>=60&&r.height<=500&&r.width*r.height>ba){ba=r.width*r.height;bg=e;}});
  if(!bg) return JSON.stringify({ok:false,why:'没找到验证码背景图'});
  var b=bg.getBoundingClientRect();
  /* 拼图块：在背景图范围内、比背景小得多的图（取最靠左的那个） */
  var pz=null;
  /* 拼图块的画布常常和背景一样高（只有中间一小块不透明），所以高度不设上限 */
  pics.forEach(function(e){ if(e===bg) return; var r=e.getBoundingClientRect();
    if(r.width<15||r.width>b.width*0.4||r.height<15||r.height>b.height+6) return;
    if(r.left<b.left-5||r.right>b.right+5||r.top<b.top-6||r.bottom>b.bottom+6) return;
    if(!pz||r.left<pz.getBoundingClientRect().left) pz=e; });
  [].slice.call(document.querySelectorAll('[data-rpa-piece]')).forEach(function(e){e.removeAttribute('data-rpa-piece');});
  if(pz) pz.setAttribute('data-rpa-piece','1');
  var p=pz?pz.getBoundingClientRect():null;
  /* 拼图块的真实轮廓：能读像素就按不透明像素收紧上下边（读不了跨域图就用整块） */
  if(p){ p={left:p.left,top:p.top,width:p.width,height:p.height};
    try{ var cv=document.createElement('canvas'),nw=pz.naturalWidth||pz.width,nh=pz.naturalHeight||pz.height;
      if(nw&&nh&&pz.tagName!=='DIV'){cv.width=nw;cv.height=nh;var cx=cv.getContext('2d');cx.drawImage(pz,0,0);
        var pd=cx.getImageData(0,0,nw,nh).data,t=-1,bt=-1,l=nw,rr=-1;
        for(var yy=0;yy<nh;yy++){for(var xx=0;xx<nw;xx++){if(pd[(yy*nw+xx)*4+3]>40){if(t<0)t=yy;bt=yy;if(xx<l)l=xx;if(xx>rr)rr=xx;}}}
        var ky=p.height/nh,kx=p.width/nw;
        if(t>=0&&bt-t<nh*0.9){p.top+=t*ky;p.height=(bt-t+1)*ky;}
        if(rr>=l&&rr-l<nw*0.95){p.left+=l*kx;p.width=(rr-l+1)*kx;} } }catch(_){} }
  /* 手柄：在滑轨里、靠左的那个可拖块。滑轨 = 背景图下方、比手柄宽得多、高度相近的横条 */
  var handle=null;
  [].slice.call(document.querySelectorAll('*')).forEach(function(e){ if(!vis(e)) return;
    var r=e.getBoundingClientRect();
    if(r.width<20||r.width>120||r.height<18||r.height>90) return;
    if(r.top<b.bottom-2||r.top>b.bottom+120) return;
    if(r.left<b.left-10||r.left>b.left+b.width*0.35) return;
    var cn=(typeof e.className==='string'?e.className:'')+' '+(e.id||'');
    if(/refresh|reload|close|刷新/i.test(cn)) return;
    var track=null,a=e.parentElement;
    while(a&&a!==document.body){var ar=a.getBoundingClientRect();
      if(ar.width>r.width*2.5&&ar.height<r.height*2.2){track=ar;break;} a=a.parentElement;}
    var s=(track?0:1000)+(/handle|slider|drag|btn|move|block|thumb/i.test(cn)?0:200)-r.width*r.height/100;
    if(!handle||s<handle.s) handle={e:e,s:s,r:r,track:track}; });
  var trackRight=handle&&handle.track?handle.track.right:b.right;
  /* 刷新按钮：验证框里带 refresh/reload 类名或刷新文字的 */
  var refresh=null;
  [].slice.call(document.querySelectorAll('*')).forEach(function(e){ if(refresh||!vis(e)) return;
    var cn=(typeof e.className==='string'?e.className:'')+' '+(e.getAttribute('title')||'')+' '+(e.getAttribute('aria-label')||'');
    var r=e.getBoundingClientRect();
    if(/refresh|reload|刷新|换一张/i.test(cn)&&r.width<60&&r.top>b.top-80&&r.top<b.bottom+200) refresh={x:r.left+r.width/2,y:r.top+r.height/2}; });
  return JSON.stringify({ok:true,
    bg:{x:b.left,y:b.top,w:b.width,h:b.height},
    pz:p?{x:p.left,y:p.top,w:Math.min(p.width,p.height+8),h:p.height}:null,
    handle:handle?{x:handle.r.left,y:handle.r.top,w:handle.r.width,h:handle.r.height}:null,
    trackRight:trackRight, refresh:refresh});
})()`;

/* 在截图上找缺口。
   参数：带拼图块的截图、隐藏拼图块后的截图、拼图块元素在背景里的位置（CSS 像素）。
   两张一比，变了的像素就是拼图块的真实轮廓（不用读它的像素，跨域图也行）；
   缺口在“隐藏拼图块后”那张上找，拼图块自己不会干扰。返回拼图左沿和缺口左沿（相对背景） */
const ANALYZE = (uriWith, uriWithout, pz0) => `new Promise(function(done){
  var load=function(s){return new Promise(function(ok,no){var i=new Image();i.onload=function(){ok(i)};i.onerror=no;i.src=s;});};
  Promise.all([load(${JSON.stringify(uriWith)}),load(${JSON.stringify(uriWithout)})]).then(function(two){
    var W=two[1].width,H=two[1].height;
    var px=function(im){var c=document.createElement('canvas');c.width=W;c.height=H;var x=c.getContext('2d');x.drawImage(im,0,0);return x.getImageData(0,0,W,H).data;};
    var a=px(two[0]),d=px(two[1]);
    var pz=${JSON.stringify(pz0)};
    /* 拼图块真实轮廓：两张图差异大的像素的外框 */
    var l=W,r=-1,t=H,bt=-1;
    var x0=Math.max(0,Math.floor(pz.x)-2),x1=Math.min(W,Math.ceil(pz.x+pz.w)+2),ya=Math.max(0,Math.floor(pz.y)-2),yb=Math.min(H,Math.ceil(pz.y+pz.h)+2);
    for(var yy=ya;yy<yb;yy++)for(var xx=x0;xx<x1;xx++){var q=(yy*W+xx)*4;
      if(Math.abs(a[q]-d[q])+Math.abs(a[q+1]-d[q+1])+Math.abs(a[q+2]-d[q+2])>45){if(xx<l)l=xx;if(xx>r)r=xx;if(yy<t)t=yy;if(yy>bt)bt=yy;}}
    if(r>l+8&&bt>t+8) pz={x:l,y:t,w:r-l+1,h:bt-t+1};
    var y0=Math.max(0,Math.round(pz.y+pz.h*0.15)),y1=Math.min(H,Math.round(pz.y+pz.h*0.85));
    var pw=Math.max(10,Math.round(pz.w));
    var lum=function(i){return (d[i]*299+d[i+1]*587+d[i+2]*114)/1000;};
    var con=[];
    for(var col=0;col<W;col++){var a=0,na=0,o=0,no=0;
      for(var row=0;row<H;row++){var v=lum((row*W+col)*4);
        if(row>=y0&&row<y1){a+=v;na++;} else if(row<y0-4||row>=y1+4){o+=v;no++;}}
      con.push((na?a/na:0)-(no?o/no:a/(na||1)));}
    var sorted=con.slice().sort(function(a,b){return a-b;});var med=sorted[Math.floor(sorted.length/2)];
    var best=-1,bestDev=-1,from=Math.round(pz.x+pw*0.8);
    for(var s=from;s+pw<=W;s++){var m=0;for(var k=s;k<s+pw;k++)m+=con[k];m/=pw;
      var dev=Math.abs(m-med);if(dev>bestDev){bestDev=dev;best=s;}}
    done(JSON.stringify({gap:best,pzX:pz.x,dev:Math.round(bestDev*10)/10,W:W,H:H}));
  }).catch(function(){done(JSON.stringify({gap:-1,why:'截图载入失败'}));});
})`;

/* 人手轨迹：先快后慢 + 过冲回拉 + 纵向抖动 */
function humanPath(dist) {
  const over = Math.max(3, Math.min(8, dist * 0.04));
  const steps = Math.round(rnd(26, 40));
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.72 ? (t / 0.72) ** 0.62 * 0.88 : 0.88 + ((t - 0.72) / 0.28) * 0.12;
    pts.push({ dx: (dist + over) * ease, dy: rnd(-1.6, 1.6), wait: rnd(8, 20) });
  }
  const back = Math.round(rnd(3, 5));
  for (let i = 1; i <= back; i++) pts.push({ dx: dist + over * (1 - i / back), dy: rnd(-1, 1), wait: rnd(18, 36) });
  pts.push({ dx: dist, dy: 0, wait: rnd(40, 90) });
  return pts;
}

async function shotRegion(c, r) {
  const m = JSON.parse(await c.evalv('JSON.stringify({d:devicePixelRatio||1})'));
  const { result } = await c.send('Page.captureScreenshot', { format: 'png',
    clip: { x: r.x, y: r.y, width: r.w, height: r.h, scale: 1 / m.d } });
  return 'data:image/png;base64,' + result.data;
}

async function attempt(c, dry) {
  const info = JSON.parse(await c.evalv(PROBE) || '{}');
  if (!info.ok) return { done: false, fatal: '探测失败：' + info.why };
  if (!info.handle) return { done: false, fatal: '没找到可拖动的手柄（页面上可能不是滑块验证）' };
  const hx = info.handle.x + info.handle.w / 2, hy = info.handle.y + info.handle.h / 2;
  let dist, how;
  if (info.pz) {
    const pzRel = { x: info.pz.x - info.bg.x, y: info.pz.y - info.bg.y, w: info.pz.w, h: info.pz.h };
    const withPz = await shotRegion(c, info.bg);
    await c.evalv(`(function(){var e=document.querySelector('[data-rpa-piece]');if(e){e.dataset.rpaVis=e.style.visibility;e.style.visibility='hidden';}})()`);
    await sleep(120);
    const noPz = await shotRegion(c, info.bg);
    await c.evalv(`(function(){var e=document.querySelector('[data-rpa-piece]');if(e){e.style.visibility=e.dataset.rpaVis||'';}})()`);
    const a = JSON.parse(await c.evalv(ANALYZE(withPz, noPz, pzRel), true) || '{}');
    if (a.gap > 0) { dist = a.gap - a.pzX; how = '拼图：拼图左沿 ' + Math.round(a.pzX) + ' → 缺口左沿 ' + a.gap + '（偏离度 ' + a.dev + '）'; }
  }
  if (!(dist > 4)) { dist = info.trackRight - (info.handle.x + info.handle.w) - 2; how = '没找到拼图块 → 当纯滑动条拖到最右'; }
  console.log('   ' + how + ' · 手柄 (' + Math.round(hx) + ',' + Math.round(hy) + ') · 拖 ' + Math.round(dist) + 'px');
  if (dry) return { done: true, dry: true };

  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hx, y: hy, buttons: 0 });
  await sleep(rnd(60, 120));
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hx, y: hy, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(rnd(80, 160));
  for (const p of humanPath(dist)) {
    await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hx + p.dx, y: hy + p.dy, button: 'left', buttons: 1 });
    await sleep(p.wait);
  }
  await sleep(rnd(150, 300));
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hx + dist, y: hy, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(2200);
  /* 过没过：同一位置的验证背景图还在不在 */
  const still = JSON.parse(await c.evalv(PROBE) || '{}');
  const gone = !still.ok || Math.abs(still.bg.x - info.bg.x) > 3 || Math.abs(still.bg.y - info.bg.y) > 3;
  return { done: gone, refresh: info.refresh };
}

(async () => {
  const port = +(process.argv.find(a => /^\d+$/.test(a)) || 9222);
  const dry = process.argv.includes('--dry');
  const c = await connect(port);
  try { await c.send('Page.bringToFront'); } catch (_) {}
  try {
    for (let i = 1; i <= 4; i++) {
      const r = await attempt(c, dry);
      if (r.fatal) { console.error('✗ ' + r.fatal); process.exit(1); }
      if (r.dry) { console.log('(--dry 只算不拖)'); return; }
      if (r.done) { console.log('✅ 第 ' + i + ' 次过关 · 当前 ' + await c.evalv('location.href')); return; }
      console.log('   第 ' + i + ' 次没过，换一张重来');
      if (r.refresh) {
        for (const t of ['mousePressed', 'mouseReleased'])
          await c.send('Input.dispatchMouseEvent', { type: t, x: r.refresh.x, y: r.refresh.y, button: 'left', buttons: t === 'mousePressed' ? 1 : 0, clickCount: 1 });
      }
      await sleep(1800);
    }
    console.error('✗ 4 次都没过');
    process.exit(3);
  } finally { c.close(); }
})().catch(e => { console.error('滑块处理失败:', e.message); process.exit(1); });
