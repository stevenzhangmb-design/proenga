#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   awaitcode.js · 等用户在浏览器里填完短信/邮箱验证码 → 自动点下一步
   ────────────────────────────────────────────────────────────────────────
   2026-11-19 建。短信码、邮箱码只有用户本人收得到，AI 填不了；但用户填完以后
   还要回来说一声"填好了"再让 AI 点按钮，多一次来回。这个工具把这一步省掉：
     ⓪ 码还没发就自己发：点【发送/获取验证码】；弹滑块自动调 slider.js 过；
        直到页面出现倒计时或“发送成功”才算发出（已在倒计时的不重复点）
     ① 每 0.5 秒看一次页面上可见的验证码输入框（单框，或 4～8 个一格一位的格子）
     ② 填满（位数够、且连续 1.5 秒没再变）就判定填完
     ③ 自己判断该点哪个按钮：不按固定按钮名（各系统叫法不同），按这一步的功能认——
        验证码所在区域里，排除发送/重发/倒计时/返回/取消等，取最像主操作的那个
        （彩色实底、在输入框下方、面积大），报出它的真实名字；按钮禁用就再等
     ④ 用硬件级点击（Input.dispatchMouseEvent）点它，再看页面是否离开了验证页
   页面自己填满就自动提交、跳走了，也算成功。

   用法：
     node awaitcode.js <port> [超时秒=600]
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const path = require('path');
const { spawnSync } = require('child_process');
const { connect } = require('./_cdp');
const sleep = ms => new Promise(z => setTimeout(z, ms));
const port = process.argv[2] || '9222';
const timeoutS = +(process.argv[3] || 600);

/* 读验证码输入状态：返回 {cells, filled, value, url} */
const READ = `(function(){
  var vis=function(e){var r=e.getBoundingClientRect();var s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none';};
  var ins=[].slice.call(document.querySelectorAll('input')).filter(function(e){return vis(e)&&!/hidden|checkbox|radio|password|submit|button/.test(e.type);});
  var single=ins.filter(function(e){return /验证码|校验码|code|código|otp/i.test((e.placeholder||'')+' '+(e.name||'')+' '+(e.id||'')+' '+(e.className||''));});
  var cells=ins.filter(function(e){var m=+e.maxLength;var r=e.getBoundingClientRect();return m===1||(r.width<70&&r.height<70);});
  if(cells.length>=4&&cells.length<=8){var v=cells.map(function(e){return e.value||'';}).join('');return JSON.stringify({mode:'cells',need:cells.length,value:v,url:location.href});}
  if(single.length){var e=single[0];var need=(+e.maxLength>0&&+e.maxLength<=8)?+e.maxLength:4;return JSON.stringify({mode:'single',need:need,value:e.value||'',url:location.href});}
  return JSON.stringify({mode:'none',need:0,value:'',url:location.href});
})()`;

/* 找该点的按钮 —— 按页面实际场景判断，不按固定按钮名。
   不同系统这一步叫法各不相同（确定 / 验证 / 登录 / 提交 / 绑定 / 立即进入 / Entrar …），
   列一张按钮名单永远列不全。所以按“这一步的功能是什么”来认：
     ① 先找到验证码输入框所在的那一块（往上找最近一个同时含输入框和可点元素的容器）
     ② 这一块里的可点元素，排除掉明显【不是提交验证码】的：
        发送/重发/获取验证码、倒计时（59s）、返回、取消、关闭、换一张、帮助、忘记密码
     ③ 剩下的按“像不像这一步的主操作”打分：
        主色底（彩色实底，不是白底灰底）> 在输入框下方或右侧 > 面积大
   取分最高的那个，报出它在页面上的真实名字。按钮还是禁用状态就继续等。 */
const FIND_BTN = `(function(){
  var vis=function(e){var r=e.getBoundingClientRect();var s=getComputedStyle(e);return r.width>16&&r.height>14&&s.visibility!=='hidden'&&s.display!=='none'&&s.pointerEvents!=='none';};
  var dis=function(e){return e.disabled||e.getAttribute('aria-disabled')==='true'||/(^|\\s|-)disabled/.test(typeof e.className==='string'?e.className:'')||+getComputedStyle(e).opacity<0.6;};
  var txt=function(e){return ((e.innerText||e.value||e.getAttribute('aria-label')||'')+'').replace(/\\s+/g,'').trim();};
  var NOT=/发送|重发|重新|获取|返回|取消|关闭|换一|帮助|忘记|注册|^\\d+\\s*[sS秒]|resend|send|back|cancel|close|help|forgot|reenviar|voltar|cancelar|fechar/i;
  var ins=[].slice.call(document.querySelectorAll('input')).filter(function(e){return vis(e)&&!/hidden|checkbox|radio/.test(e.type);});
  if(!ins.length)return null;
  var inp=ins[ins.length-1];var ir=inp.getBoundingClientRect();
  var clickable=function(e){if(e===inp||e.tagName==='INPUT'&&e.type!=='submit'&&e.type!=='button')return false;
    if(/^(BUTTON|A)$/.test(e.tagName)||e.getAttribute('role')==='button'||e.type==='submit')return true;
    return getComputedStyle(e).cursor==='pointer'&&txt(e).length>0&&txt(e).length<=12&&e.children.length<=2;};
  /* ① 输入框所在的那一块 */
  var box=inp.parentElement,cand=[];
  while(box&&box!==document.body){
    cand=[].slice.call(box.querySelectorAll('*')).filter(function(e){return vis(e)&&clickable(e)&&!NOT.test(txt(e));});
    if(cand.length)break; box=box.parentElement;}
  if(!cand.length)return null;
  /* 去掉嵌套：父子都可点时只留最外层 */
  cand=cand.filter(function(e){return !cand.some(function(o){return o!==e&&o.contains(e);});});
  /* ③ 打分 */
  var sat=function(e){var m=(getComputedStyle(e).backgroundColor||'').match(/\\d+(\\.\\d+)?/g);if(!m)return 0;
    var r=+m[0],g=+m[1],b=+m[2],a=m[3]===undefined?1:+m[3];if(a<0.3)return 0;
    var mx=Math.max(r,g,b),mn=Math.min(r,g,b);return mx?(mx-mn)/mx:0;};
  var best=null,bs=-1e9;
  cand.forEach(function(e){var r=e.getBoundingClientRect();var s=0;
    if(sat(e)>0.25)s+=100;
    if(r.top>=ir.top-4||r.left>=ir.right-4)s+=50;
    s+=Math.min(40,r.width*r.height/1000);
    s-=Math.abs(r.top-ir.bottom)/50;
    if(s>bs){bs=s;best=e;}});
  var r=best.getBoundingClientRect();
  return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),text:txt(best),disabled:dis(best)});
})()`;

/* 码还没发就自己发：找【发送/获取验证码】按钮点掉；弹滑块就调 slider.js 过；
   直到页面出现倒计时（59s / 60秒）或“发送成功”提示，才算发出去了。
   已经在倒计时的（码已发过）不重复点。各系统叫法不同，按“发送 / 获取 + 验证码”这类意思认。 */
const SEND_STATE = `(function(){
  var vis=function(e){var r=e.getBoundingClientRect();var s=getComputedStyle(e);return r.width>16&&r.height>14&&s.visibility!=='hidden'&&s.display!=='none';};
  var body=(document.body.innerText||'').replace(/\\s+/g,' ');
  /* 只认倒计时和“发送成功”提示。别认“已发送 / 将发送至”——那常是页面上的固定说明文字 */
  var sent=/发送成功|sent successfully|enviado com sucesso/i.test(body)||[].slice.call(document.querySelectorAll('*')).some(function(e){
    return vis(e)&&e.children.length===0&&/^\\s*\\(?\\d{1,3}\\s*(s|秒|sec|segundos)\\)?\\s*(后.*)?$/i.test(e.textContent||'');});
  var slider=/拼图|滑块|安全验证|slide to|puzzle|arraste/i.test(body);
  /* 认【发送/获取验证码】：文字短、以发送/获取开头；取最里层那个（外层容器的中心常常是空白，点了没用） */
  var hits=[].slice.call(document.querySelectorAll('button,[role=button],a,span,div')).filter(function(e){
    if(!vis(e)) return false; var t=(e.innerText||'').replace(/\\s+/g,'').trim();
    if(!t||t.length>10||!/^(发送|获取|重新发送|重新获取|send|get|enviar|reenviar)/i.test(t)) return false;
    return !(e.disabled||/disabled/.test(typeof e.className==='string'?e.className:''));});
  hits=hits.filter(function(e){return !hits.some(function(o){return o!==e&&e.contains(o);});});
  var btn=null;
  if(hits.length){var e=hits[0],r=e.getBoundingClientRect();
    btn={x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),text:(e.innerText||'').replace(/\\s+/g,'').trim()};}
  return JSON.stringify({sent:sent,slider:slider,btn:btn});
})()`;

async function sendCode(cdp) {
  for (let i = 0; i < 3; i++) {
    let st = JSON.parse(await cdp.evalv(SEND_STATE));
    if (st.sent) { console.log('验证码已发出（页面在倒计时或提示发送成功）'); return true; }
    if (st.slider) {
      console.log('有滑块 → 自动过滑块');
      spawnSync(process.execPath, [path.join(__dirname, 'slider.js'), String(port)], { stdio: 'inherit' });
      await sleep(1500);
      st = JSON.parse(await cdp.evalv(SEND_STATE));
      if (st.sent) { console.log('验证码已发出'); return true; }
    }
    if (!st.btn) return false;
    console.log('点【' + st.btn.text + '】发送验证码');
    const M = (type, buttons) => cdp.send('Input.dispatchMouseEvent', { type, x: st.btn.x, y: st.btn.y, button: 'left', buttons, clickCount: 1 });
    await M('mouseMoved', 0); await sleep(60); await M('mousePressed', 1); await sleep(70); await M('mouseReleased', 0);
    await sleep(2000);
  }
  return false;
}

(async () => {
  const cdp = await connect(port);
  try { await cdp.send('Page.bringToFront'); } catch (_) {}
  const startUrl = await cdp.evalv('location.href');
  await sendCode(cdp);
  const first = JSON.parse(await cdp.evalv(READ));
  if (first.mode === 'none') { console.log('当前页没有验证码输入框，不用等 · ' + startUrl); cdp.close(); process.exit(0); }
  console.log('开始等待验证码（' + first.need + ' 位） · ' + startUrl);
  const t0 = Date.now();
  let last = '', stableSince = 0;
  while (Date.now() - t0 < timeoutS * 1000) {
    let st;
    try { st = JSON.parse(await cdp.evalv(READ)); } catch (_) { await sleep(500); continue; }
    if (st.url !== startUrl) { console.log('✅ 页面已离开验证页（页面自己提交了）→ ' + st.url); cdp.close(); process.exit(0); }
    if (st.value !== last) { last = st.value; stableSince = Date.now(); }
    const full = st.need > 0 && st.value.replace(/\s/g, '').length >= st.need;
    if (full && Date.now() - stableSince >= 1500) {
      const raw = await cdp.evalv(FIND_BTN);
      if (!raw) { await sleep(500); continue; }
      const b = JSON.parse(raw);
      if (b.disabled) { await sleep(500); continue; }
      const M = (type, buttons) => cdp.send('Input.dispatchMouseEvent', { type, x: b.x, y: b.y, button: 'left', buttons, clickCount: 1 });
      await M('mouseMoved', 0); await sleep(60); await M('mousePressed', 1); await sleep(70); await M('mouseReleased', 0);
      console.log('已填满 ' + st.need + ' 位 → 点【' + b.text + '】@' + b.x + ',' + b.y);
      await sleep(3000);
      const now = await cdp.evalv('location.href');
      if (now !== startUrl) { console.log('✅ 已进入 → ' + now); cdp.close(); process.exit(0); }
      console.log('⚠️ 点完还在验证页（可能验证码错误），继续等用户改码');
      stableSince = Date.now() + 5000; // 给用户改码留时间，避免连点
    }
    await sleep(500);
  }
  console.log('✗ 超时：' + timeoutS + ' 秒内没等到验证码');
  cdp.close(); process.exit(2);
})().catch(e => { console.error('✗ ' + (e && e.message || e)); process.exit(1); });
