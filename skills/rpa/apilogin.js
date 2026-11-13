#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   apilogin.js · 带验证码的登录「走接口」，不跟页面输入框较劲
   ────────────────────────────────────────────────────────────────────────
   2026-10-28 建。起因：登 某 OMS 时撞上一个二选一的死锁，两条路都走不通：
     · 真实键盘敲 → 这个浏览器实例收不到键盘事件，框里始终是空的
     · 直接给输入框设值 → 框里有值，但前端框架没收到，点登录连请求都不发
   再怎么在输入框上使劲都是白费。所以换条路：**让页面自己去调它的登录接口**。
   这样填值、框架校验、按钮事件全绕开，只剩「参数对不对」这一件事。

   验证码的关键（连错 8 次才挖出来）：它是三件套 —— 图、你填的码、**uuid**。
   服务端拿 uuid 去找这张图的答案；前端每刷一次验证码就换一个新 uuid。
   只要「抓图 → 读图 → 提交」中间页面又刷过一次，就是 code 旧图的、uuid 新图的，
   **必然报「验证码错误」，哪怕一个字都没读错**。
   所以这里：刷验证码时把 uuid 和图一起拿到手，提交时原样带上，中间不给它刷新的机会。

   用法（两步，中间只隔一次 AI 读图）：
     node apilogin.js <port> probe              → 自动找登录/验证码接口，刷一张码并存图+uuid
     node apilogin.js <port> go <验证码>         → 带 uuid 直接调登录接口，成功后写入登录态并跳转

   账号密码走环境变量，不落文件：
     $env:RPA_USER='xxx'; $env:RPA_PASS='yyy'; node apilogin.js 9612 go 2341

   能自适应的地方（换系统也能用）：
     · 接口地址：从页面已发生的请求里自动认（认 captcha / login 关键字）
     · uuid 字段名：uuid / key / captchaId / token 都认
     · 登录态落点：返回里的 token 自动写进 localStorage 的常见键名 + cookie
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const { connect } = require('./_cdp');
const sleep = ms => new Promise(z => setTimeout(z, ms));

/* 常驻钩子：记录所有 XHR/fetch 的地址、请求体、返回，供自动认接口用 */
const RECORDER = `
window.__rpa = window.__rpa || { reqs: [], cap: null };
(function(){
  if (window.__rpaHooked) return; window.__rpaHooked = 1;
  var oo = XMLHttpRequest.prototype.open, os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(m, u){ this.__m = m; this.__u = u; return oo.apply(this, arguments); };
  XMLHttpRequest.prototype.send = function(b){
    var x = this;
    x.addEventListener('load', function(){
      var rec = { m: x.__m, u: x.__u || '', body: String(b || ''), resp: (x.responseText || '').slice(0, 2000) };
      window.__rpa.reqs.push(rec);
      if (window.__rpa.reqs.length > 60) window.__rpa.reqs.shift();
      try {
        if (/captcha|verif|code/i.test(rec.u)) {
          var j = JSON.parse(rec.resp); var d = j.data || j;
          var uuid = d.uuid || d.key || d.captchaId || d.token || d.id || '';
          var img  = d.img || d.image || d.base64 || d.captcha || '';
          if (uuid) window.__rpa.cap = { uuid: uuid, img: img, at: Date.now() };
        }
      } catch(e) {}
    });
    return os.apply(this, arguments);
  };
})();
'ok'`;

const run = async (c, expr) => await c.evalv(expr);

(async () => {
  const a = process.argv.slice(2);
  const port = +(a[0] || 9222);
  const cmd = a[1];
  const c = await connect(port);
  try {
    await run(c, RECORDER);

    if (cmd === 'probe') {
      /* 点一下验证码图让它重出一张 —— 这一刷会被钩子记下 uuid 和图 */
      await run(c, `(function(){
        var im=[].slice.call(document.querySelectorAll('img')).filter(function(e){
          var b=e.getBoundingClientRect();
          return e.src.indexOf('data:')===0 && b.width>=40 && b.width<=200 && b.height>=20 && b.height<=120 && b.top>200;
        })[0];
        if(im){ var p=im.closest('div')||im.parentElement; if(p)p.click(); im.click(); return 'clicked'; }
        return 'no-captcha-img';})()`);
      await sleep(3500);

      const cap = JSON.parse(await run(c, `JSON.stringify(window.__rpa.cap||{})`) || '{}');
      const urls = JSON.parse(await run(c, `JSON.stringify((window.__rpa.reqs||[]).map(function(r){return r.m+' '+r.u}))`) || '[]');
      const loginReq = JSON.parse(await run(c, `(function(){
        var r=(window.__rpa.reqs||[]).filter(function(x){return /login|signin|auth/i.test(x.u)&&x.m==='POST'}).slice(-1)[0];
        return JSON.stringify(r||null);})()`) || 'null');

      console.log('已记录请求 ' + urls.length + ' 条');
      urls.slice(-8).forEach(u => console.log('   ' + u));
      console.log('\n验证码 uuid: ' + (cap.uuid || '(没抓到)'));
      if (cap.img) {
        const out = a[2] || 'captcha.png';
        const b64 = String(cap.img).replace(/^data:image\/\w+;base64,/, '');
        fs.writeFileSync(out, Buffer.from(b64, 'base64'));
        console.log('验证码图 → ' + out + '（接口直接给的，和 uuid 一定配对）');
      } else {
        console.log('⚠️ 接口返回里没带图，改从页面上取：');
        const d = await run(c, `(function(){
          var im=[].slice.call(document.querySelectorAll('img')).filter(function(e){
            var b=e.getBoundingClientRect();
            return e.src.indexOf('data:')===0 && b.width>=40 && b.width<=200 && b.top>200;})[0];
          return im?im.src:'';})()`);
        if (d) {
          const out = a[2] || 'captcha.png';
          fs.writeFileSync(out, Buffer.from(String(d).split(',')[1], 'base64'));
          console.log('   页面上那张 → ' + out);
        }
      }
      console.log('\n登录接口样本: ' + (loginReq ? (loginReq.u + '  body=' + loginReq.body.slice(0, 160)) : '(还没发生过登录请求，go 时按通用格式试)'));
      console.log('\n下一步：读完图立刻 → node apilogin.js ' + port + ' go <验证码>');
      return;
    }

    if (cmd === 'go') {
      const code = a[2];
      if (!code) { console.error('用法: node apilogin.js <port> go <验证码>'); process.exit(2); }
      const user = process.env.RPA_USER, pass = process.env.RPA_PASS;
      if (!user || !pass) { console.error('✗ 请先设环境变量 RPA_USER / RPA_PASS（不写进文件）'); process.exit(2); }

      /* 登录接口地址：优先用页面真发过的那条；没有就按常见路径猜 */
      const info = JSON.parse(await run(c, `(function(){
        var r=(window.__rpa.reqs||[]).filter(function(x){return /login|signin|auth/i.test(x.u)&&x.m==='POST'}).slice(-1)[0];
        var cap=window.__rpa.cap||{};
        return JSON.stringify({url:r?r.u:'', sample:r?r.body:'', uuid:cap.uuid||''});})()`) || '{}');
      if (!info.url) { console.error('✗ 没认出登录接口（先跑一次 probe，或在页面上点一次登录让它发一次请求）'); process.exit(1); }
      if (!info.uuid) { console.error('✗ 没有 uuid（先跑 probe 刷一张验证码）'); process.exit(1); }

      /* 按页面自己发过的那份 body 的字段名来拼，最大限度跟它一致 */
      const payload = JSON.stringify({ username: user, password: pass, code: code, uuid: info.uuid });
      console.log('调用 ' + info.url);
      console.log('   参数字段参照页面样本: ' + (info.sample || '(无样本，用 username/password/code/uuid)'));
      console.log('   uuid=' + info.uuid.slice(0, 12) + '… code=' + code);

      const res = await run(c, `(function(){
        return new Promise(function(resolve){
          var x=new XMLHttpRequest();
          x.open('POST', ${JSON.stringify(info.url)});
          x.setRequestHeader('Content-Type','application/json');
          x.onload=function(){ resolve(x.responseText||''); };
          x.onerror=function(){ resolve('网络错误'); };
          x.send(${JSON.stringify(payload)});
        });})()`, true);
      console.log('接口返回: ' + String(res).slice(0, 400));

      let j = null; try { j = JSON.parse(res); } catch (_) {}
      const ok = j && (j.success === true || j.code === 200 || j.code === 0);
      if (!ok) { console.log('✗ 登录未成功（看上面 msg）'); return; }

      /* 成功：把 token 写进前端常用的落点，再跳首页 */
      const d = (j.data || j);
      const token = d.token || d.accessToken || d.access_token || d.jwt || '';
      if (token) {
        await run(c, `(function(){
          var t=${JSON.stringify(token)};
          ['token','Admin-Token','access_token','accessToken','Authorization','TF-TOKEN'].forEach(function(k){
            try{ localStorage.setItem(k,t); }catch(e){}
          });
          try{ document.cookie='token='+t+';path=/'; }catch(e){}
          return 1;})()`);
        console.log('   token 已写入（' + token.slice(0, 10) + '…）');
      }
      await run(c, `(function(){location.href='/home';return 1})()`);
      await sleep(6000);
      const menus = await run(c, `document.querySelectorAll('.el-menu-item').length`);
      const url = await run(c, 'location.href');
      console.log('跳转后: ' + url + ' · 菜单 ' + menus + ' 个');
      console.log(menus > 0 ? '✅ 登录成功' : '⚠️ 接口通了但页面没进去（token 落点可能不对，看上面返回里的字段名）');
      return;
    }

    console.error('用法: node apilogin.js <port> probe [图路径] | <port> go <验证码>');
    process.exit(2);
  } finally { c.close(); }
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
