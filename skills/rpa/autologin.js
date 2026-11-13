#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   autologin.js · 一条命令登进真系统（账号密码 → 验证码 → 滑块 → 进系统）
   ────────────────────────────────────────────────────────────────────────
   2026-10-29 建。为什么必须有它：
     在此之前「登录」是靠我一条条敲命令拼出来的 —— 读验证码、敲进去、点按钮、
     弹滑块再算缺口再拖……换个系统要重来，掉线一次也要重来。那是手动操作，不是能力。
     抓 WMS/OMS 的大半时间都耗在反复登录上。

   这条命令做完整个流程：
     ① 确保浏览器活着且页面【可见】（后台页会让框架不响应交互——这是最隐蔽的坑）
     ② 认出登录表单（按占位符认，中文/葡语/英文都行）
     ③ 填账号密码（真实键盘，不是给 value 赋值——有些站只认真实按键）
     ④ 勾同意条款
     ⑤ 有图形验证码 → 存图让 AI 读 → 回填（--code 传入）
     ⑥ 点登录；弹滑块 → 自动调 slider.js 过
     ⑦ 验证是否进系统（看菜单数），并把结论打出来

   用法：
     node autologin.js <port> probe                    探一遍：有没有验证码/滑块，存验证码图
     node autologin.js <port> go [--code 1234]         执行登录（有验证码就带 --code）
   账号密码走环境变量，绝不落文件：
     $env:RPA_USER='x'; $env:RPA_PASS='y'; node autologin.js 9612 go --code 7148

   ⚠️ 邮箱/短信验证码做不到 —— 那种码只有用户本人收得到。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { connect } = require('./_cdp');
const sleep = ms => new Promise(z => setTimeout(z, ms));
const rnd = (a, b) => a + Math.random() * (b - a);

/* 认表单：按占位符认，不写死语言 */
const FORM = `(function(){
  var ins=[].slice.call(document.querySelectorAll('input'));
  var vis=function(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0;};
  var by=function(re,type){return ins.filter(function(e){return vis(e)&&(!type||e.type===type)&&re.test(e.placeholder||e.name||'');})[0];};
  var acct=by(/账号|帐号|用户名|邮箱|conta|email|account|user/i,'text')||ins.filter(function(e){return vis(e)&&e.type==='text';})[0];
  var pass=ins.filter(function(e){return vis(e)&&e.type==='password';})[0];
  var code=by(/验证码|verifica|captcha|c.digo/i,'text');
  var cb=ins.filter(function(e){return e.type==='checkbox';})[0];
  var btn=[].slice.call(document.querySelectorAll('button,.el-button')).filter(function(e){
    return vis(e)&&/登录|登陆|login|entrar|sign ?in|fazer login/i.test((e.textContent||'').trim());})[0];
  var mid=function(e){if(!e)return null;var r=e.getBoundingClientRect();return [Math.round(r.left+r.width/2),Math.round(r.top+r.height/2)];};
  /* 验证码图：内嵌小图，且靠近验证码输入框（光按尺寸挑会挑到页面 LOGO —— 踩过） */
  var capImg=null;
  if(code){
    var cr=code.getBoundingClientRect();
    var cand=[].slice.call(document.querySelectorAll('img')).filter(function(e){
      if(e.src.indexOf('data:image')!==0||!e.naturalWidth)return false;
      var r=e.getBoundingClientRect();
      return r.width>=40&&r.width<=220&&r.height>=18&&r.height<=120&&Math.abs(r.top-cr.top)<80;});
    if(cand.length)capImg=cand[0].src;
  }
  return JSON.stringify({acct:mid(acct),pass:mid(pass),code:mid(code),btn:mid(btn),
    hasCb:!!cb,cbChecked:!!(cb&&cb.checked),hasCode:!!code,capImg:capImg||'',
    acctVal:acct?acct.value:'',passLen:pass?(pass.value||'').length:0});
})()`;

const SLIDER = `(function(){
  var im=[].slice.call(document.querySelectorAll('img')).filter(function(e){
    return e.src.indexOf('data:')===0&&e.naturalWidth>200;});
  return im.length?'yes':'no';})()`;

const MENUS = `document.querySelectorAll('.el-menu-item,.ant-menu-item,nav a').length`;

async function realClick(c, p) {
  await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: p[0], y: p[1] });
  await sleep(rnd(40, 90));
  await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p[0], y: p[1], button: 'left', clickCount: 1 });
  await sleep(rnd(30, 70));
  await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p[0], y: p[1], button: 'left', clickCount: 1 });
}
async function realType(c, text) {
  for (const ch of String(text)) {
    const isD = ch >= '0' && ch <= '9', isA = /[a-zA-Z]/.test(ch);
    const base = { text: ch, unmodifiedText: ch, key: ch };
    if (isD) { base.code = 'Digit' + ch; base.windowsVirtualKeyCode = 48 + (+ch); }
    else if (isA) { base.code = 'Key' + ch.toUpperCase(); base.windowsVirtualKeyCode = ch.toUpperCase().charCodeAt(0); }
    await c.send('Input.dispatchKeyEvent', Object.assign({ type: 'keyDown' }, base));
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
  const cmd = a[1] || 'probe';
  const ci = a.indexOf('--code');
  const code = ci > 0 ? a[ci + 1] : '';
  const shotPath = a.includes('--shot') ? a[a.indexOf('--shot') + 1] : path.join(process.env.TEMP || '.', 'autologin-captcha.png');

  const c = await connect(port);
  try {
    /* ⚠️ 页面必须【可见】：后台页 visibilityState=hidden 时，前端框架不跑过渡、
       不处理部分交互 —— 键盘敲不进字、弹窗关不掉、按钮点了没反应，全是这个引起的。 */
    try { await c.send('Page.bringToFront'); } catch (_) {}
    try { await c.send('Emulation.setFocusEmulationEnabled', { enabled: true }); } catch (_) {}
    const vis = await c.evalv('document.visibilityState');

    const f = JSON.parse(await c.evalv(FORM) || '{}');
    const menus0 = await c.evalv(MENUS);
    if (menus0 > 3 && !f.btn) { console.log('✅ 已经是登录状态（菜单 ' + menus0 + ' 项），无需登录'); return; }

    if (cmd === 'probe') {
      console.log('页面可见性: ' + vis);
      console.log('登录表单: 账号' + (f.acct ? '有' : '无') + ' 密码' + (f.pass ? '有' : '无') +
        ' 验证码' + (f.hasCode ? '有' : '无') + ' 同意框' + (f.hasCb ? (f.cbChecked ? '已勾' : '未勾') : '无') +
        ' 登录钮' + (f.btn ? ('(' + f.btn + ')') : '无'));
      if (f.capImg) {
        fs.writeFileSync(shotPath, Buffer.from(f.capImg.split(',')[1], 'base64'));
        console.log('验证码图 → ' + shotPath + '  （读完立刻 go --code <码>，别拖，码会换）');
      }
      return;
    }

    if (cmd === 'go') {
      const user = process.env.RPA_USER, pass = process.env.RPA_PASS;
      if (!f.btn) { console.error('✗ 没找到登录按钮，当前可能不在登录页'); process.exit(1); }
      if (f.hasCode && !code) { console.error('✗ 这个站要验证码：先跑 probe 取图，读出来再 go --code <码>'); process.exit(2); }

      if (user && f.acct && !f.acctVal) { await realClick(c, f.acct); await clearField(c); await realType(c, user); }
      if (pass && f.pass && !f.passLen) { await realClick(c, f.pass); await clearField(c); await realType(c, pass); }
      if (f.hasCb && !f.cbChecked) {
        await c.evalv(`(function(){var cb=document.querySelector('input[type=checkbox]');
          var l=cb&&(cb.closest('label')||cb.closest('.el-checkbox'));if(l){l.click()}else if(cb){cb.click()}return 1})()`);
        await sleep(300);
      }
      if (f.code && code) { await realClick(c, f.code); await clearField(c); await realType(c, code); }
      await sleep(rnd(200, 400));

      /* 点之前重新量一次按钮位置：填完字后布局可能变（错误提示会把按钮顶下去） */
      const f2 = JSON.parse(await c.evalv(FORM) || '{}');
      await realClick(c, f2.btn || f.btn);
      await sleep(3000);

      /* 滑块：交给 slider.js，它用模板匹配算缺口 + 人手轨迹拖 */
      if (await c.evalv(SLIDER) === 'yes') {
        console.log('→ 弹出滑块，自动处理');
        c.close();
        const r = spawnSync('node', [path.join(__dirname, 'slider.js'), String(port)], { encoding: 'utf8' });
        process.stdout.write(r.stdout || '');
        const c2 = await connect(port);
        await sleep(3000);
        let m2 = 0, u2 = '', ok2 = false;
        for (let i = 0; i < 20; i++) {
          await sleep(1000);
          u2 = await c2.evalv('location.pathname') || '';
          m2 = await c2.evalv(MENUS) || 0;
          const hasPw2 = await c2.evalv("!!document.querySelector('input[type=password]')");
          if (!/login/i.test(u2) && !hasPw2) { ok2 = true; if (m2 > 3) break; }
        }
        console.log(ok2 ? ('✅ 登录成功 · ' + u2 + ' · 菜单 ' + m2 + ' 项') : ('✗ 还没进去 · ' + u2));
        c2.close();
        return;
      }

      /* ⚠️ 判定要【轮询等】，不能点完睡 3 秒就下结论。
         2026-10-29/30 连续三次误报「✗ 还没进去」，而几秒后页面其实已经到 /home 了 ——
         登录后要跳转 + 拉菜单接口，比固定等待慢。
         判定条件也放宽：**离开 /login 且没有密码框** 就算进去了（有些系统首页菜单是懒加载的，
         光看菜单数会漏判）。 */
      let m = 0, u = '', ok = false;
      for (let i = 0; i < 20; i++) {
        await sleep(1000);
        u = await c.evalv('location.pathname') || '';
        m = await c.evalv(MENUS) || 0;
        const hasPw = await c.evalv("!!document.querySelector('input[type=password]')");
        if (!/login/i.test(u) && !hasPw) { ok = true; if (m > 3) break; }
      }
      const tip = await c.evalv(`(function(){return [].slice.call(document.querySelectorAll('.el-message__content,.el-message'))
        .map(function(e){return (e.textContent||'').trim()}).filter(Boolean).slice(0,2).join(' / ');})()`);
      console.log(ok ? ('✅ 登录成功 · ' + u + ' · 菜单 ' + m + ' 项')
                     : ('✗ 还没进去 · ' + u + (tip ? ' · 提示：' + tip : '')));
      return;
    }

    console.error('用法: node autologin.js <port> probe | <port> go [--code 1234]');
    process.exit(2);
  } finally { try { c.close(); } catch (_) {} }
})().catch(e => { console.error('登录失败:', e.message); process.exit(1); });
