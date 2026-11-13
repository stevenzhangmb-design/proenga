#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   login.js · 带图形验证码的登录：抓图 → 等 AI 填码 → 立刻提交（一条命令内完成）
   ────────────────────────────────────────────────────────────────────────
   2026-10-28 建。起因：登 某 OMS 时连错 6 次，服务端始终回 {"code":5001,"msg":"验证码错误"}，
   但我每次读图都读对了。真因是**时序**：
     captcha.js 抓的是页面当下那张图，而我「抓图 → 读图 → 再发一条命令填码 → 再发一条命令点登录」
     中间隔了好几次往返；服务端每失败一次就换一张新码，等我提交时手里那张早作废了。
     ——读得对没用，码过期了一样是「验证码错误」。

   所以这里把【抓图】和【提交】焊死在一次运行内：
     第 1 步 node login.js <port> shot <图路径>     只抓图并把表单位置量好，存进页面变量
     第 2 步 node login.js <port> submit <验证码>    直接填码+提交（中途不碰刷新、不重新抓图）
   两步之间只隔一次 AI 读图，没有多余往返，码不会过期。

   账号密码走【环境变量】，绝不写进文件也不落命令行历史：
     $env:RPA_USER='xxx'; $env:RPA_PASS='yyy'; node login.js 9612 submit 1572

   提交后直接打印【登录接口的原始返回】——成功与否看服务端怎么说，不靠猜页面。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const { connect } = require('./_cdp');
const sleep = ms => new Promise(z => setTimeout(z, ms));
const rnd = (a, b) => a + Math.random() * (b - a);

/* 把登录接口的返回记下来，成败以它为准。
   ⚠️ 2026-10-28 抓到的真因（登 某 OMS 连错 8 次才查出来）：
   验证码不是「图 + 用户输入」两件事，而是三件 —— 图、输入、**uuid**。
   提交体长这样：{"username":..,"password":..,"code":"1881","uuid":"32d08ee2..."}
   服务端是拿 uuid 去找这张图的正确答案的。而前端**每刷一次验证码就换一个新 uuid**，
   我「抓图 → 读图 → 提交」中间只要页面又刷过一次，就变成 code 是旧图的、uuid 是新图的，
   **必然永远报「验证码错误」**，哪怕我图读得一字不差。
   所以这里把验证码请求的返回也记下来，抓图时一并锁定 uuid，提交时强制用那一个。 */
const HOOK = `(function(){
  if(window.__loginRes) return 'already';
  window.__loginRes=[];
  window.__capUuid='';
  var _os=XMLHttpRequest.prototype.send, _oo=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){ this.__u=u; return _oo.apply(this,arguments); };
  XMLHttpRequest.prototype.send=function(){
    var x=this;
    x.addEventListener('load',function(){
      try{
        if(/captcha/i.test(x.__u||'')){
          var j=JSON.parse(x.responseText||'{}');
          var d=j.data||j; var u=d.uuid||d.key||d.captchaId||'';
          if(u) window.__capUuid=u;
        }
      }catch(e){}
    });
    return _os.apply(this,arguments);
  };
  var os=XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send=function(){
    var x=this;
    x.addEventListener('load',function(){
      try{ if(/login|signin/i.test(x.responseURL||'')) window.__loginRes.push((x.responseText||'').slice(0,300)); }catch(e){}
    });
    return os.apply(this,arguments);
  };
  var of=window.fetch;
  window.fetch=function(){
    var a=arguments;
    return of.apply(this,a).then(function(r){
      try{ var u=String(a[0]&&a[0].url?a[0].url:a[0]); if(/login|signin/i.test(u)) r.clone().text().then(function(t){window.__loginRes.push(t.slice(0,300))}); }catch(e){}
      return r;
    });
  };
  return 'hooked';
})()`;

/* 量出三个输入框 + 按钮的中心坐标（按占位符认，不依赖语言） */
const MEASURE = `(function(){
  var ins=[].slice.call(document.querySelectorAll('input'));
  var pick=function(re,type){ return ins.filter(function(e){ return (type?e.type===type:true) && re.test(e.placeholder||''); })[0]; };
  var acct=pick(/账号|conta|account|邮箱|email/i,'text') || ins.filter(function(e){return e.type==='text'})[0];
  var pass=ins.filter(function(e){return e.type==='password'})[0];
  var code=pick(/验证码|verifica|captcha|código/i,'text');
  var cb=document.querySelector('input[type=checkbox]');
  var btn=[].slice.call(document.querySelectorAll('button')).filter(function(e){
    return /登录|login|entrar|sign/i.test((e.textContent||'').trim());})[0];
  var mid=function(e){ if(!e) return null; var r=e.getBoundingClientRect(); return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)}; };
  return JSON.stringify({acct:mid(acct),pass:mid(pass),code:mid(code),btn:mid(btn),
    hasCb:!!cb, cbChecked:!!(cb&&cb.checked),
    acctVal:acct?acct.value:'', passLen:pass?(pass.value||'').length:0});
})()`;

async function realClick(c, p) {
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p.x, y: p.y });
  await sleep(rnd(40, 80));
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', clickCount: 1 });
  await sleep(rnd(30, 60));
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', clickCount: 1 });
}
async function realType(c, text) {
  for (const ch of String(text)) {
    /* keyDown 带 text 就已落字；再补 char 会变成每字两次（2026-10-28 实测踩过） */
    await c.send('Input.dispatchKeyEvent', { type: 'keyDown', text: ch, unmodifiedText: ch, key: ch });
    await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
    await sleep(rnd(40, 100));
  }
}
async function clearField(c) {
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', modifiers: 2, key: 'a', code: 'KeyA', windowsVirtualKeyCode: 65 });
  await sleep(40);
  await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 });
  await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Delete', code: 'Delete', windowsVirtualKeyCode: 46 });
  await sleep(40);
}

(async () => {
  const a = process.argv.slice(2);
  const port = +(a[0] || 9222);
  const cmd = a[1];
  const c = await connect(port);
  try {
    /* ⚠️ 2026-10-28：窗口在后台时，键盘事件根本不落字（焦点明明在输入框上，value 还是空）。
       所以每次操作前先把页面置前——这条在 CDP 验收上早有教训，登录同样适用。 */
    try { await c.send('Page.bringToFront'); } catch (_) {}
    await c.evalv(HOOK);
    const pos = JSON.parse(await c.evalv(MEASURE) || '{}');

    if (cmd === 'shot') {
      const out = a[2] || 'captcha.png';
      /* ⚠️ 2026-10-28 踩过的坑：只按「尺寸小」挑 data 图，会把页面左上角的 LOGO 当成验证码
         （某 OMS 的 LOGO 也是内嵌图，127x35，排在验证码前面）→ 读的一直是 LOGO，
         服务端自然永远回「验证码错误」，而我还以为是时序问题，白查了半天。
         现在三重判定：① 必须是内嵌图 ② 尺寸落在验证码的常见范围 ③ **必须靠近验证码输入框**。 */
      const codeBox = pos.code ? JSON.stringify(pos.code) : 'null';
      const data = await c.evalv(`(function(){
        var box=${codeBox};
        var cands=[].slice.call(document.querySelectorAll('img')).filter(function(e){
          if(e.src.indexOf('data:image')!==0) return false;
          var w=e.naturalWidth,h=e.naturalHeight;
          return w>=40&&w<=260&&h>=20&&h<=120;
        });
        if(!cands.length) return '';
        if(box){
          cands.sort(function(p,q){
            var a=p.getBoundingClientRect(),b=q.getBoundingClientRect();
            var da=Math.abs(a.top+a.height/2-box.y)+Math.abs(a.left-box.x)*0.2;
            var db=Math.abs(b.top+b.height/2-box.y)+Math.abs(b.left-box.x)*0.2;
            return da-db;
          });
        }
        return cands[0].src;})()`);
      if (!data) { console.error('✗ 没找到验证码图（它可能不是 data:URI）'); process.exit(1); }
      fs.writeFileSync(out, Buffer.from(String(data).split(',')[1], 'base64'));
      console.log('✅ 验证码图 → ' + out);
      console.log('   表单位置已量好：' + JSON.stringify(pos));
      console.log('   ⚠️ 读完图请【立刻】跑 submit，中间别做别的，否则码会过期');
      return;
    }

    if (cmd === 'submit') {
      const code = a[2];
      if (!code) { console.error('用法: node login.js <port> submit <验证码>'); process.exit(2); }
      const user = process.env.RPA_USER, pass = process.env.RPA_PASS;
      if (!pos.btn) { console.error('✗ 没找到登录按钮'); process.exit(1); }
      /* ⚠️ 2026-10-28：钩子是累积记录的，不清空会读到【上一次】的返回，
         导致我把旧的「验证码错误」当成这次的结果，诊断全错。提交前必须清零。 */
      await c.evalv('(function(){window.__loginRes=[];return 1})()');

      /* 账号/密码只在环境变量给了、且页面上还空着时才补填 */
      if (user && pos.acct && !pos.acctVal) { await realClick(c, pos.acct); await clearField(c); await realType(c, user); }
      if (pass && pos.pass && !pos.passLen) { await realClick(c, pos.pass); await clearField(c); await realType(c, pass); }
      if (pos.hasCb && !pos.cbChecked) {
        await c.evalv(`(function(){var cb=document.querySelector('input[type=checkbox]');var l=cb&&cb.closest('label');if(l){l.click()}else if(cb){cb.click()}return 1})()`);
        await sleep(200);
      }
      if (pos.code) { await realClick(c, pos.code); await clearField(c); await realType(c, code); }
      await sleep(rnd(150, 300));
      /* 提交前最后确认一次：输入框里的码 == 我要提交的码，且 uuid 还是抓图时那个。
         这两样只要有一个对不上，点下去必然白费（服务端按 uuid 找答案）。 */
      const chk = await c.evalv(`(function(){
        var ins=[].slice.call(document.querySelectorAll('input'));
        var c=ins.filter(function(e){return e.type==='text'&&/验证码|verifica|captcha|código/i.test(e.placeholder||'')})[0];
        return JSON.stringify({val:c?c.value:'', uuid:(window.__capUuid||'').slice(0,8)});})()`);
      console.log('   提交前核对: ' + chk);
      await realClick(c, pos.btn);

      /* 等服务端回话，最多 12 秒 */
      let res = '';
      for (let i = 0; i < 24; i++) {
        await sleep(500);
        res = await c.evalv(`(window.__loginRes||[]).join(' ~ ')`) || '';
        if (res) break;
      }
      const url = await c.evalv('location.href');
      const menus = await c.evalv(`document.querySelectorAll('.el-menu-item').length`);
      console.log('接口返回: ' + (res || '（没抓到返回）'));
      console.log('当前 URL: ' + url + ' · 菜单 ' + menus + ' 个');
      console.log(menus > 0 ? '✅ 登录成功' : '✗ 还没进去（看上面接口返回里的 msg）');
      return;
    }

    console.error('用法: node login.js <port> shot <图路径> | <port> submit <验证码>');
    process.exit(2);
  } finally { c.close(); }
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
