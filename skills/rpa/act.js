#!/usr/bin/env node
/* RPA·act.js —— 页面操作后截图（不关 Chrome）。
   用法：
     node act.js goto  "<url>"   [out.png] [port]
     node act.js click "<文字>"  [out.png] [port]   点包含该文字的可点元素
     node act.js hover "<文字>"  [out.png] [port]   悬停（展开顶栏下拉）
     node act.js fill  "<占位符>::<值>" [out.png] [port]  按 placeholder 填输入（值别落文件·用于账号；密码建议走 env 由脚本填）
     node act.js sel   "<css选择器>" [out.png] [port]   按 CSS 选择器点（click 按文字找不到的都走它）
     node act.js check "<附近文字>"  [out.png] [port]   勾上复选框（登录页「我已阅读并同意」这类）
     node act.js viewport "1600x900" [out.png] [port]  ★抓真系统第一步★ 锁 dpr=1，截图像素=CSS像素=tap坐标
     node act.js tap   "<css|x,y>"  [out.png] [port]   硬件级鼠标点击（JS 点不动的走它）
     node act.js eval  "<js>"       [out.png] [port]   只读页面状态
     node act.js menu                                  菜单一览（文字+路由）

   §2026-10-08 加 sel/check 的原因：click 只认文字，而**复选框本身没有文字**——
   某零售系统 登录页点「我已阅读并同意」这几个字，勾不上旁边那个 checkbox，登录就卡住。
   几乎每个带协议勾选的登录页都会踩，所以补进工具链而不是每次现写。
*/
'use strict';
const { connect } = require('./_cdp');
const fs = require('fs');
let [action, arg] = process.argv.slice(2);
/* §2026-10-29 参数支持 `@<文件>`：从文件读内容当参数。
   为什么：PowerShell 往 node 传一段 JS 会把引号吃掉，表现是 `失败: Uncaught` —— 这个坑
   今天踩了三次（act.js eval / tokens.js --ask）。写进文件再传路径，彻底绕开 shell 转义。 */
if (arg && arg[0] === '@') arg = fs.readFileSync(arg.slice(1), 'utf8').replace(/^﻿/, '').trim();
const out = process.argv[4] || 'act.png';
const port = process.argv[5] || 9222;
const J = s => JSON.stringify(s);
(async () => {
  const cdp = await connect(port);
  if (action === 'goto') { await cdp.navigate(arg); }
  else if (action === 'console') {
    /* §2026-10-10 打开一个页面并把它的 JS 报错原样打出来。
       为什么要有：原型白屏时 render 闸只说"#app 没有内容"，不说为什么；
       以前只能注释代码二分查找。有了它一条命令就看到真正的异常行。
       用法：node act.js console "<url 或 file:///…>" [out.png] [port] */
    await cdp.navigate(arg);
    await new Promise(z => setTimeout(z, 2500));
    const L = cdp.logs();
    console.log(L.length ? L.join('\n') : '（没有 console 报错）');
  }
  else if (action === 'click') {
    await cdp.evalv(`(function(){var t=${J(arg)};var els=[...document.querySelectorAll('button,a,.el-menu-item,.el-button,[role=button],span,div,li')];var el=els.find(e=>e.offsetParent!==null&&(e.textContent||'').replace(/\\s+/g,' ').trim().includes(t));if(el){el.scrollIntoView({block:'center'});el.click();return true;}throw new Error('没找到可点元素: '+t);})()`);
    await new Promise(z => setTimeout(z, 1200));
  } else if (action === 'hover') {
    await cdp.evalv(`(function(){var t=${J(arg)};var el=[...document.querySelectorAll('*')].find(e=>e.offsetParent!==null&&(e.textContent||'').trim()===t);if(el){el.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));el.dispatchEvent(new MouseEvent('mouseenter',{bubbles:true}));return true;}throw new Error('没找到: '+t);})()`);
    await new Promise(z => setTimeout(z, 800));
  } else if (action === 'fill') {
    const [ph, val] = String(arg).split('::');
    await cdp.evalv(`(function(){var i=[...document.querySelectorAll('input,textarea')].find(x=>x.offsetParent!==null&&(x.getAttribute('placeholder')||'').includes(${J(ph)}));if(!i)throw new Error('没找到输入: '+${J(ph)});var set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;set.call(i,${J(val || '')});i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));return true;})()`);
  } else if (action === 'tap') {
    /* §2026-10-08 CDP 硬件级点击（Input.dispatchMouseEvent）——不是 JS 合成事件。
       为什么要有：某零售系统 收银台左上角的模块切换抽屉，用 el.click() 和
       手工 dispatch 的 pointerdown/mousedown/click 序列都打不开（框架按真实指针事件判定）。
       凡是"JS 点了没反应、人手点就有反应"的控件，一律走 tap。
       参数是 CSS 选择器；也可以写 "x,y" 直接点坐标。 */
    let x, y;
    if (/^\d+\s*,\s*\d+$/.test(String(arg))) { const p = String(arg).split(','); x = +p[0]; y = +p[1]; }
    else {
      const box = await cdp.evalv(`(function(){var e=document.querySelector(${J(arg)});if(!e)return null;
        e.scrollIntoView({block:'center'});var r=e.getBoundingClientRect();
        return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)});})()`);
      if (!box) throw new Error('选择器没匹配到: ' + arg);
      ({ x, y } = JSON.parse(box));
    }
    const base = { x, y, button: 'left', clickCount: 1, buttons: 1 };
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, buttons: 0 });
    await new Promise(z => setTimeout(z, 60));
    await cdp.send('Input.dispatchMouseEvent', Object.assign({ type: 'mousePressed' }, base));
    await new Promise(z => setTimeout(z, 60));
    await cdp.send('Input.dispatchMouseEvent', Object.assign({ type: 'mouseReleased' }, base, { buttons: 0 }));
    console.log('tap @ ' + x + ',' + y);
    await new Promise(z => setTimeout(z, 1500));
  } else if (action === 'touch') {
    /* §2026-10-08 触摸点击（Input.dispatchTouchEvent）。POS / 平板端界面常只认 touch 事件，
       CDP 的鼠标事件打不进去（某零售系统 收银台的数字键盘、模块切换抽屉都是这种）。
       先 Emulation.setTouchEmulationEnabled 让页面认为自己在触屏设备上，再发 touchStart/touchEnd。 */
    let x, y;
    if (/^\d+\s*,\s*\d+$/.test(String(arg))) { const p = String(arg).split(','); x = +p[0]; y = +p[1]; }
    else {
      const box = await cdp.evalv(`(function(){var e=document.querySelector(${J(arg)});if(!e)return null;
        e.scrollIntoView({block:'center'});var r=e.getBoundingClientRect();
        return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)});})()`);
      if (!box) throw new Error('选择器没匹配到: ' + arg);
      ({ x, y } = JSON.parse(box));
    }
    await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
    const pt = [{ x, y, radiusX: 3, radiusY: 3, force: 1, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt });
    await new Promise(z => setTimeout(z, 70));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    console.log('touch @ ' + x + ',' + y);
    await new Promise(z => setTimeout(z, 1500));
  } else if (action === 'win') {
    /* §2026-10-10 放大**真实浏览器窗口**（Browser.setWindowBounds）。
       和 viewport 的区别：Emulation 的覆盖随 CDP 连接断开就没了（act.js 每次跑完都断），
       窗口尺寸是持久的，所以抓真系统要空间就用它。用法：node act.js win 1680x1000 */
    const m = /^(\d+)\s*[x,]\s*(\d+)$/.exec(String(arg || '1680x1000'));
    const { windowId } = await cdp.send('Browser.getWindowForTarget', {});
    await cdp.send('Browser.setWindowBounds',
      { windowId, bounds: { windowState: 'normal', left: 0, top: 0, width: +m[1], height: +m[2] } });
    await new Promise(z => setTimeout(z, 900));
    console.log('窗口: ' + m[1] + 'x' + m[2] + ' · CSS 视口 ' +
      await cdp.evalv('innerWidth+"x"+innerHeight+" @dpr"+devicePixelRatio'));
  } else if (action === 'viewport') {
    /* §2026-10-10 根治「tap 点了没反应」——真因不是框架挑事件，是 **DPR 坐标错位**。
       某零售系统 在这台机器上 devicePixelRatio=2：截图 2074px 宽，CSS 视口只有 1037px。
       我照着截图量坐标喂给 Input.dispatchMouseEvent（它要的是 CSS 像素），每次都点在 2 倍远的地方，
       于是"POS 数字键盘 / 模块抽屉点不开"，白白卡掉一整轮（见 原型改动清单 #343）。
       这个动作把视口锁成 deviceScaleFactor=1 并指定宽高，**截图像素 == CSS 像素 == tap 坐标**，
       从此照着截图量的坐标直接能用。抓任何真系统前先跑一次。
       用法：node act.js viewport 1600x900 [out.png] [port] （写 0x0 或 off 还原） */
    const m = /^(\d+)\s*[x,]\s*(\d+)$/.exec(String(arg || ''));
    if (!m || (+m[1] === 0 && +m[2] === 0)) {
      await cdp.send('Emulation.clearDeviceMetricsOverride', {});
      console.log('viewport: 已还原真实窗口');
    } else {
      await cdp.send('Emulation.setDeviceMetricsOverride',
        { width: +m[1], height: +m[2], deviceScaleFactor: 1, mobile: false });
      console.log('viewport: ' + m[1] + 'x' + m[2] + ' @dpr1（截图像素=CSS像素，tap 坐标可直接照截图量）');
    }
    await new Promise(z => setTimeout(z, 800));
  } else if (action === 'eval') {
    /* §2026-10-08 读页面任意状态（菜单路由 / 某元素的 computed 值 / 弹窗里有什么）。
       抓真系统时常常要先"看清楚有什么"再决定点哪，没有它就只能瞎点。只读，不改页面。 */
    /* awaitPromise=true：表达式可以是 async 函数。
       §2026-10-30 加——查"hover 之后才出现的东西"（如行操作图标的 tooltip 真名）
       必须 hover → 等一会儿 → 再读，那是异步的；不等 Promise 的话只会打印出 `{}`。 */
    const v = await cdp.evalv(arg, true);
    console.log(typeof v === 'string' ? v : JSON.stringify(v, null, 1));
  } else if (action === 'menu') {
    /* 左侧/顶部菜单一览：文字 + 路由 + 层级，抓新系统第一步 */
    const v = await cdp.evalv(`(function(){
      var out=[];
      document.querySelectorAll('.el-menu-item,.el-sub-menu__title,li[role=menuitem],aside a,nav a').forEach(function(e){
        if(e.offsetParent===null) return;
        var t=(e.innerText||'').replace(/\\s+/g,' ').trim(); if(!t) return;
        var a=e.tagName==='A'?e:e.querySelector('a'); var href=a?a.getAttribute('href'):'';
        out.push({文字:t, 路由:href||'', 类:e.className});
      });
      return JSON.stringify(out);})()`);
    console.log(v);
  } else if (action === 'sel') {
    await cdp.evalv(`(function(){var el=document.querySelector(${J(arg)});if(!el)throw new Error('选择器没匹配到: '+${J(arg)});el.scrollIntoView({block:'center'});el.click();return true;})()`);
    await new Promise(z => setTimeout(z, 1200));
  } else if (action === 'check') {
    /* 先按"离这段文字最近的 checkbox"找；找不到再退到页面上第一个没勾的 checkbox。
       点 <input type=checkbox> 本身最可靠；Element Plus 的 .el-checkbox 点外层 label 也行。 */
    await cdp.evalv(`(function(){var t=${J(arg)};
      var boxes=[...document.querySelectorAll('input[type=checkbox]')].filter(x=>x.offsetParent!==null||x.closest('.el-checkbox,.ant-checkbox,label'));
      if(!boxes.length) throw new Error('页面上没有 checkbox');
      var pick=null;
      if(t){ var host=[...document.querySelectorAll('label,.el-checkbox,div,span,p')]
               .find(e=>(e.textContent||'').replace(/\\s+/g,' ').trim().includes(t));
             if(host) pick=host.querySelector('input[type=checkbox]')||
                            boxes.find(b=>host.contains(b)||b.closest('label,.el-checkbox,div')===host||
                                          (b.parentElement&&host.contains(b.parentElement))); }
      if(!pick) pick=boxes.find(b=>!b.checked)||boxes[0];
      if(pick.checked) return 'already';
      var lab=pick.closest('.el-checkbox,.ant-checkbox-wrapper,label');
      (lab||pick).click();
      if(!pick.checked){ pick.click(); }
      if(!pick.checked){ pick.checked=true; pick.dispatchEvent(new Event('input',{bubbles:true})); pick.dispatchEvent(new Event('change',{bubbles:true})); }
      return pick.checked?'checked':'还是没勾上';})()`);
    await new Promise(z => setTimeout(z, 600));
  } else { console.error('未知动作:', action); process.exit(2); }
  console.log('URL:', await cdp.url());
  await cdp.screenshot(out);
  console.log('截图:', out);
  cdp.close(); process.exit(0);
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
