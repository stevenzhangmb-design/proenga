#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   slider.js · 滑块验证码自动过关（拼图缺口 + 纯滑动条通吃）
   ────────────────────────────────────────────────────────────────────────
   2026-10-28 建。起因：抓 某 WMS 真系统时，登录点下去弹出「请完成安全验证」拼图滑块，
   而 act.js 只有 click/hover/tap，**没有拖动能力**，整条抓取链就卡死在登录这一步。

   能过的两种：
     ① 拼图缺口滑块 —— 背景图上挖掉一块，要把滑块拖到缺口位置
     ② 纯滑动条     —— 拖到最右即可（找不到缺口时自动退化成这种）

   过不了的：扭曲字符图（走 captcha.js，AI 自己读图）、邮箱/短信码（只有用户收得到）

   两个关键点，缺一个都过不了：
     【一】缺口位置靠**像素比对**算，不靠猜：
           把背景图画进 canvas 逐列算相邻列的颜色差，缺口的左右边缘会出现两根尖峰，
           且这两根的间距 ≈ 滑块宽度。按"间距最接近滑块宽"来挑，比只取最大值稳得多
           （最大值常常落在图案本身的高对比边缘上）。
     【二】拖动轨迹必须**像人手**，一路匀速直推必被判机器：
           先快后慢（缓动）+ 末端过冲再回拉 + 纵向 1~2px 抖动 + 每步间隔随机 8~20ms，
           总时长 400~900ms。而且走的是 CDP 的 Input.dispatchMouseEvent（硬件级），
           不是 DOM 派发的合成事件——后者很多验证码根本不认。

   用法：
     node slider.js [port=9222] [--dry]
       --dry 只算不拖（打印缺口位置和计划拖动距离，用来调试）

   ⚠️ 坐标全部用 CSS 像素。_cdp.js 的截图已统一输出 CSS 像素，所以截图上量到的坐标可直接用。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const { connect } = require('./_cdp');

const sleep = ms => new Promise(z => setTimeout(z, ms));
const rnd = (a, b) => a + Math.random() * (b - a);

/* 在页面里算缺口：返回 {ok, bgX, bgW, scale, pzX, pzW, gapCss, handle:{x,y,w,h}, trackRight} */
const PROBE = `(function(){
  var imgs=[].slice.call(document.querySelectorAll('img')).filter(function(e){return e.src.indexOf('data:')===0&&e.naturalWidth>0});
  var bg=null,pz=null;
  imgs.forEach(function(e){ if(!bg||e.naturalWidth>bg.naturalWidth) bg=e; });
  imgs.forEach(function(e){ if(e!==bg&&(!pz||e.naturalWidth<pz.naturalWidth)) pz=e; });
  if(!bg) return JSON.stringify({ok:false,why:'没找到内嵌背景图'});
  var b=bg.getBoundingClientRect();
  var scale=bg.naturalWidth/b.width;
  var pzW=pz?pz.naturalWidth:0, pzRect=pz?pz.getBoundingClientRect():null;

  /* 逐列颜色差 */
  var c=document.createElement('canvas'); c.width=bg.naturalWidth; c.height=bg.naturalHeight;
  var x=c.getContext('2d'); x.drawImage(bg,0,0);
  var d; try{ d=x.getImageData(0,0,c.width,c.height).data; }catch(e){ return JSON.stringify({ok:false,why:'canvas读不了像素:'+e.message}); }
  var W=c.width,H=c.height,cols=[];
  for(var col=3;col<W-3;col++){
    var diff=0;
    for(var row=0;row<H;row++){
      var i=(row*W+col)*4,j=(row*W+col-1)*4;
      diff+=Math.abs(d[i]-d[j])+Math.abs(d[i+1]-d[j+1])+Math.abs(d[i+2]-d[j+2]);
    }
    cols.push([col,diff]);
  }
  /* ⚠️ 2026-10-28 实测改法：只按「相邻列色差」找边缘**不可靠** ——
     背景图本身就是一堆大色块，色块边界的色差比缺口还强，于是把缺口算到了 x=80
     （真实缺口在 x≈205），拖过去自然过不了。
     更稳的判据：**缺口有一圈明显的白色描边**。所以直接统计每列「接近白色的像素个数」，
     白边最密的那一列就是缺口左沿。再用滑块宽度做一次合理性校验。 */
  /* 【模板匹配】最可靠：滑块图自己就是缺口的形状，拿它去背景里找最吻合的位置。
     只用滑块的**不透明像素**（拼图轮廓）参与比对，背景里缺口处被挖暗/加白边，
     所以「轮廓内平均亮度最低 + 轮廓边缘白边最多」的那一列就是答案。
     2026-10-28 之所以要换成这招：前两版（相邻列色差、白边密度）都被背景色块骗了
     —— 真实缺口在 x≈205，却分别算成 80 和 106。 */
  var gap=null;
  if(pz&&pzW>0){
    var pc=document.createElement('canvas'); pc.width=pz.naturalWidth; pc.height=pz.naturalHeight;
    var px=pc.getContext('2d'); px.drawImage(pz,0,0);
    var pd=null; try{ pd=px.getImageData(0,0,pc.width,pc.height).data; }catch(e){}
    if(pd){
      /* 取滑块轮廓：不透明且非纯黑的像素，按行记录它的横向范围 */
      var mask=[];
      for(var r2=0;r2<pc.height;r2++){
        for(var c2=0;c2<pc.width;c2++){
          var k=(r2*pc.width+c2)*4;
          if(pd[k+3]>40) mask.push([c2,r2]);
        }
      }
      if(mask.length>50){
        var best=-1,bestScore=1e18;
        var step=1;
        for(var off=0; off+pc.width<=W; off+=step){
          var sum=0,n=0,white=0;
          for(var m=0;m<mask.length;m+=3){            /* 抽样提速 */
            var mx=mask[m][0]+off, my=mask[m][1];
            if(my>=H) continue;
            var q=(my*W+mx)*4;
            var lum=(d[q]*299+d[q+1]*587+d[q+2]*114)/1000;
            sum+=lum; n++;
            if(d[q]>200&&d[q+1]>200&&d[q+2]>200) white++;
          }
          if(!n) continue;
          /* 缺口处：轮廓内更暗、且白边更多 → 分数越小越像 */
          var sc=(sum/n) - white*1.6;
          if(sc<bestScore){ bestScore=sc; best=off; }
        }
        if(best>=0) gap=best;
      }
    }
  }
  var sorted=cols.slice().sort(function(a,b){return b[1]-a[1]});
  var top=sorted.slice(0,14);
  if(gap===null){                      /* 没有白边时才退回色差配对 */
    var bestScore=1e9;
    if(pzW>0){
      for(var i2=0;i2<top.length;i2++) for(var j2=0;j2<top.length;j2++){
        var L=top[i2][0],R=top[j2][0]; if(R-L<pzW*0.55) continue;
        var score=Math.abs((R-L)-pzW);
        if(score<bestScore&&score<pzW*0.45){ bestScore=score; gap=L; }
      }
    }
    if(gap===null) gap=top.length?top[0][0]:0;
  }

  /* 手柄：宽度小、在背景图下方、类名像 handle/slider/drag 的那个 */
  var handle=null;
  [].slice.call(document.querySelectorAll('*')).forEach(function(e){
    var cn=typeof e.className==='string'?e.className:''; if(!/handle|slider|drag|btn/i.test(cn)) return;
    var r=e.getBoundingClientRect();
    if(r.width>10&&r.width<90&&r.height>18&&r.height<80&&r.top>b.top){
      if(!handle||r.top<handle.getBoundingClientRect().top) handle=e;
    }
  });
  var h=handle?handle.getBoundingClientRect():null;
  var trackRight=h?(b.left+b.width-h.width):0;
  return JSON.stringify({ok:true,bgX:b.left,bgW:b.width,scale:scale,pzW:pzW,
    pzX:pzRect?pzRect.left:b.left, gapNative:gap, gapCss:gap/scale,
    handle:h?{x:h.left,y:h.top,w:h.width,h:h.height}:null, trackRight:trackRight,
    topCols:top.slice(0,6).map(function(p){return p[0]})});
})()`;

/* 人手轨迹：先快后慢 + 过冲回拉 + 纵向抖动 */
function humanPath(dist) {
  const over = Math.max(3, Math.min(8, dist * 0.04));        // 过冲量
  const steps = Math.round(rnd(26, 40));
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const ease = t < 0.72 ? (t / 0.72) ** 0.62 * 0.88        // 前段快
                          : 0.88 + ((t - 0.72) / 0.28) * 0.12; // 后段慢
    pts.push({ dx: (dist + over) * ease, dy: rnd(-1.6, 1.6), wait: rnd(8, 20) });
  }
  /* 过冲后回拉到真实目标 */
  const back = Math.round(rnd(3, 5));
  for (let i = 1; i <= back; i++) {
    pts.push({ dx: dist + over * (1 - i / back), dy: rnd(-1, 1), wait: rnd(18, 36) });
  }
  pts.push({ dx: dist, dy: 0, wait: rnd(40, 90) });
  return pts;
}

(async () => {
  const port = +(process.argv.find(a => /^\d+$/.test(a)) || 9222);
  const dry = process.argv.includes('--dry');
  const c = await connect(port);
  try {
    const raw = await c.evalv(PROBE);
    const info = JSON.parse(raw || '{}');
    if (!info.ok) { console.error('✗ 探测失败：' + (info.why || '未知')); process.exit(1); }
    if (!info.handle) { console.error('✗ 没找到可拖动的手柄（页面上可能不是滑块验证）'); process.exit(1); }

    const hx = info.handle.x + info.handle.w / 2;
    const hy = info.handle.y + info.handle.h / 2;
    /* 缺口在背景图里的 CSS 偏移；滑块起点与背景图左沿的偏移要减掉 */
    const pzOffset = info.pzX - info.bgX;
    let dist = info.gapCss - pzOffset;
    if (!(dist > 4)) { dist = info.trackRight - hx; console.log('   (没算出有效缺口 → 退化成纯滑动条，拖到最右)'); }

    console.log('背景图 ' + Math.round(info.bgW) + 'px(缩放' + info.scale + ') · 滑块原始宽 ' + info.pzW
      + ' · 缺口原始列 ' + Math.round(info.gapNative) + ' → CSS ' + Math.round(info.gapCss));
    console.log('手柄中心 (' + Math.round(hx) + ',' + Math.round(hy) + ') · 计划拖动 ' + Math.round(dist) + 'px');
    if (dry) { console.log('(--dry 只算不拖)'); return; }

    const path = humanPath(dist);
    await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: hx, y: hy, button: 'left', clickCount: 1 });
    await sleep(rnd(60, 140));
    for (const p of path) {
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: hx + p.dx, y: hy + p.dy, button: 'left' });
      await sleep(p.wait);
    }
    await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: hx + dist, y: hy, button: 'left', clickCount: 1 });
    console.log('✅ 已按人手轨迹拖完（' + path.length + ' 步）');
    await sleep(1800);
    const after = await c.evalv(`(function(){var t=(document.body.innerText||'').replace(/\\s+/g,' ');
      return JSON.stringify({url:location.href, still:/完成安全验证|拖动滑块/.test(t)});})()`);
    const a = JSON.parse(after || '{}');
    console.log(a.still ? '   验证框还在 —— 可能没过，可重跑一次（验证码允许重试）' : '   验证框已消失 · 当前 ' + a.url);
  } finally { c.close(); }
})().catch(e => { console.error('滑块处理失败:', e.message); process.exit(1); });
