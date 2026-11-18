#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   ㊱ 全量交互回归闸 · full-interaction-regression-gate.js
   ────────────────────────────────────────────────────────────────────────
   根治两件事（2026-07-11 用户+另一窗口共同定的 A + B）：
     A【在你真正要交付的那个文件上跑】——直接开 archive / 项目目录里的【真 offline 原型】，
       不用 fixture、不用临时装配件 → 堵死「闸绿但你手上的原型是坏的」。
     B【全量，不是点状】——机器把每一页的【每个按钮 / 每个页签 / 每个行内操作】都点一遍，
       并把页面上每个可标注元素都右键一遍，断言：
         · 点击不炸（0 JS 报错）
         · 右键取名必须是【真功能名】——不得为空、不得叫「功能区」
       → 把"人肉抽验几个元素"变成"机器每次全量跑"，撞坏当场抓，而不是等用户发现。

   用法：node full-interaction-regression-gate.js [原型路径…]   (不传则自动扫真实交付物)
   退出码：0 全绿；1 有红。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os'), { spawn } = require('child_process');
const { findChrome } = require('./_gate-env');
const CHROME = process.env.CHROME_PATH || findChrome();
const sleep = ms => new Promise(z => setTimeout(z, ms));

/* ── A：真实交付物发现（不用 qa/fixtures 里的旧 fixture；archive 一份用户原型都没有时，改测由当前骨架现装的随包样例，见 _sample-deliverable.js） ── */
const SCAN_DIRS = require('./_archive-dir').protoScanDirs();
const SKIP_RE = /_serverless验证|_草稿|_superseded|fixtures|node_modules|分享版|-分享/i;
function findDeliverables() {
  const out = [];
  for (const d of SCAN_DIRS) {
    if (!fs.existsSync(d)) continue;
    const walk = dir => {
      let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      for (const e of ents) {
        const fp = path.join(dir, e.name);
        if (SKIP_RE.test(fp)) continue;
        if (e.isDirectory()) walk(fp);
        else if (e.isFile() && /\.html$/i.test(e.name)) {
          let st; try { st = fs.statSync(fp); } catch (_) { continue; }
          if (st.size < 100 * 1024) continue;
          /* ★ 必须读【整个文件】：标注层是追加在文件末尾的，只读开头会漏掉大离线文件 */
          let body = ''; try { body = fs.readFileSync(fp, 'utf8'); } catch (_) { continue; }
          if (body.includes('__ANNO_LAYER_VERSION__')) out.push(fp);
        }
      }
    };
    walk(d);
  }
  return out;
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : require('./_sample-deliverable').orSample(findDeliverables());
if (!targets.length) { console.log('  （未发现真实交付原型，跳过）'); process.exit(0); }

let PORT = 8700, DPORT = 9700;
const results = [];

(async () => {
  console.log('\n════════ ㊱ 全量交互回归闸（真交付文件·每页每按钮每元素都跑）════════');
  for (const file of targets) {
    const name = path.basename(file);
    const r = { name, pages: 0, clicks: 0, rclicks: 0, badNames: [], jsErrs: [], dead: [], boxReachable: null, boxName: null, boxContent: null };
    /* ★ 端口用【系统自动分配的空闲端口】(listen 0 / 0 调试端口)，杜绝 EADDRINUSE 撞车（闸自己崩过一次） */
    const dp = 9300 + Math.floor(Math.random() * 4000);
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'fir-'));
    let ch, server, ws, wp;
    try {
      fs.copyFileSync(file, path.join(tmp, 'p.html'));
      ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--window-size=1600,1000',
        '--remote-debugging-port=' + dp, '--user-data-dir=' + path.join(tmp, 'ud'), 'about:blank']);
      server = http.createServer((rq, rs) => {
        const p = path.join(tmp, decodeURIComponent(rq.url.split('?')[0]));
        fs.readFile(p, (e, d) => { if (e) { rs.writeHead(404); rs.end(); return; } rs.writeHead(200, { 'Content-Type': 'text/html;charset=utf-8' }); rs.end(d); });
      });
      server.on('error', () => {});                       // 端口异常不再让整个闸崩
      await new Promise(res => server.listen(0, res));    // 0 = 系统分配空闲端口
      wp = server.address().port;
      let page = null;
      for (let i = 0; i < 60; i++) { try { page = (await (await fetch(`http://localhost:${dp}/json/list`)).json()).find(t => t.type === 'page'); if (page) break; } catch (e) {} await sleep(200); }
      if (!page) throw new Error('Chrome 未就绪');
      ws = new WebSocket(page.webSocketDebuggerUrl);
      await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
      let id = 0; const pend = {};
      ws.onmessage = m => {
        const d = JSON.parse(m.data);
        if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; }
        if (d.method === 'Runtime.exceptionThrown') {
          const t = d.params.exceptionDetails.exception?.description || d.params.exceptionDetails.text || '';
          if (t && !/ResizeObserver|favicon/i.test(t)) r.jsErrs.push(String(t).split('\n')[0].slice(0, 120));
        }
      };
      const send = (m, p = {}) => new Promise(res => { const i = ++id; pend[i] = res; ws.send(JSON.stringify({ id: i, method: m, params: p })); });
      /* awaitP=true：表达式是 async IIFE 时必须等它 resolve，否则拿回 undefined（B-0 死控件探测要用） */
      const ev = async (e, awaitP) => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: !!awaitP })).result?.result?.value;
      await send('Page.enable'); await require('./_anno-isolate').isolateAnnoServer(send); /* 隔离真 anno-server(3799)：防标注层 /anno-persist 改写用户真实原型 */ await send('Runtime.enable');
      await send('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });
      await send('Page.navigate', { url: `http://localhost:${wp}/p.html?reset=1` });
      for (let i = 0; i < 240; i++) { await sleep(120); if (await ev("(document.querySelector('#app')&&document.querySelector('#app').innerText.length>150)?1:0") === 1) break; }
      await sleep(1500);
      /* ★ 确认标注【真的开启了】再往下测（2026-07-15 加固：大文件加载慢时 toggle 可能没生效 →
         之前造成整场右键全"(空)"的【假红】——闸的假红同样毁信任。探测：右键一个按钮看有无反应，无则重试；
         重试仍不行 = 报"标注层未启用(环境)"一条明确诊断，而不是几十条误导性的取名失败。 */
      let _annoOn = false;
      for (let t = 0; t < 5 && !_annoOn; t++) {
        await ev("(()=>{try{window.__anno.toggleShow(true);window.__anno.toggleMode(true);document.body.classList.remove('annotations-hidden');}catch(e){}})()");
        await sleep(500 + t * 400);
        _annoOn = await ev(`(()=>{const b=[...document.querySelectorAll('#app button,#app .el-button,#app a,#app td')].find(e=>e.offsetParent&&e.textContent.trim());if(!b)return false;const r=b.getBoundingClientRect();b.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:Math.round(r.left+r.width/2),clientY:Math.round(r.top+r.height/2)}));const on=!!document.querySelector('.acb-name')||document.body.classList.contains('anno-drawing');document.querySelector('.acb-cancel')?.click();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));document.body.classList.remove('anno-drawing');return on;})()`);
      }
      if (!_annoOn) throw new Error('标注层未能启用(加载/环境问题·重试5次无效·非产品取名判定)');

      /* ★★ 铁律三.1「圈选」断言（2026-07-11 补·此前盲区致画框被弄坏没抓到）：
         右键一片【大容器的空白处】必须能【进画框模式】(anno-drawing)。
         这是"点选/圈选两个模式都得在"的机器守卫——防"改取名把圈选吃掉"这类回归。 */
      r.boxReachable = await ev(`(()=>{
        document.body.classList.remove('anno-drawing');
        const cands=[...document.querySelectorAll('#app main,#app section,#app [class*="content"],#app [class*="wrap"],#app [class*="body"],#app div')]
          .filter(e=>{const r=e.getBoundingClientRect();return e.offsetParent && r.width>500 && r.height>300;})
          .sort((a,b)=>{const ra=a.getBoundingClientRect(),rb=b.getBoundingClientRect();return (rb.width*rb.height)-(ra.width*ra.height);});
        for(const big of cands.slice(0,5)){
          const r=big.getBoundingClientRect();
          for(const [dx,dy] of [[6,6],[r.width-6,6],[6,r.height-6],[r.width/2,4]]){
            const x=Math.round(r.left+dx), y=Math.round(r.top+dy);
            const hit=document.elementFromPoint(x,y);
            if(!hit) continue;
            document.body.classList.remove('anno-drawing');
            document.querySelector('.acb-cancel')?.click();
            hit.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:x,clientY:y}));
            const drew=document.body.classList.contains('anno-drawing');
            document.querySelector('.acb-cancel')?.click(); document.body.classList.remove('anno-drawing');
            if(drew) return true;   // 只要有一处空白能进画框，就算圈选可达
          }
        }
        return false;
      })()`);

      /* ★★ 框选端到端（CDP 真实鼠标·2026-07-11 补齐此前测不了的盲区）：
         右键空白进画框 → 左键拖框住主内容 → 断言 ①气泡弹出 ②名字非空且≠「功能区」 ③建成 pin 带真实内容(复制给AI才有料)。 */
      if (r.boxReachable) {
        try {
          const _mouse = (type, x, y, button) => send('Input.dispatchMouseEvent', { type, x: Math.round(x), y: Math.round(y), button: button || 'none', buttons: button === 'left' ? 1 : (button === 'right' ? 2 : 0), clickCount: (type === 'mousePressed' || type === 'mouseReleased') ? 1 : 0 });
          const _rc = JSON.parse(await ev(`(()=>{const c=document.querySelector('#app .gl-table')||document.querySelector('#app .el-table')?.closest('.el-card')||document.querySelector('#app .el-table')||document.querySelector('#app [class*="card"]')||document.querySelector('#app main,#app section');if(!c)return '{}';const r=c.getBoundingClientRect();return JSON.stringify({l:r.left,t:r.top,r:Math.min(r.right,1550),b:Math.min(r.bottom,950)});})()`) || '{}');
          if (_rc.l != null && (_rc.r - _rc.l) > 120 && (_rc.b - _rc.t) > 80) {
            await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));document.querySelector('.acb-cancel')?.click();");
            await _mouse('mousePressed', _rc.l + 8, _rc.t + 8, 'right'); await _mouse('mouseReleased', _rc.l + 8, _rc.t + 8, 'right'); await sleep(350);
            const _inDraw = await ev("document.body.classList.contains('anno-drawing')");
            if (_inDraw) {
              const x1 = _rc.l + 25, y1 = _rc.t + 25, x2 = _rc.r - 25, y2 = _rc.b - 25;
              await _mouse('mousePressed', x1, y1, 'left');
              for (let s = 1; s <= 6; s++) { await _mouse('mouseMoved', x1 + (x2 - x1) * s / 6, y1 + (y2 - y1) * s / 6, 'left'); await sleep(35); }
              await _mouse('mouseReleased', x2, y2, 'left'); await sleep(600);
              r.boxName = await ev("document.querySelector('.acb-name')?.textContent.replace('📋','').trim()||''");
              await ev("document.querySelector('.acb-ok')?.click()"); await sleep(500);
              /* ★ 内容数【展开 zoneGroups 里的字段】数(2026-07-11)：旧写法把"1组9字段"只算1、抓不到"框列表只得1个随机值"的坏况(算成2·蒙混过关)。
                 现算 zoneTexts + 所有 group.fields 展平；并记框内有没有表格 → 框到表格却内容<3 = 真坏(下方判红)。 */
              const _pc = JSON.parse(await ev(`(()=>{for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k.indexOf('anno-pins-v2')===0&&k.indexOf('-undo')<0){try{const a=JSON.parse(localStorage.getItem(k));const p=a[a.length-1];const zc=p.zoneContext||{};const gf=(zc.zoneGroups||[]).reduce((n,g)=>n+((g.fields||[]).length),0);return JSON.stringify({n:(zc.zoneTexts||[]).length+gf});}catch(e){}}}return '{}';})()`) || '{}');
              r.boxContent = _pc.n || 0;
              r.boxHasTable = await ev("!!document.querySelector('#app .el-table__body td,#app table tbody td')");
            }
            await ev("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));document.body.classList.remove('anno-drawing');");
          }
        } catch (e) { /* 框选e2e探测异常不吞掉主流程 */ }
      }

      /* ★ 先【展开所有折叠的子菜单】，否则菜单项不可见 → 一个页面都枚举不到 → 闸只跑"单页"却报全绿（假安全感·2026-07-11 逮到） */
      for (let k = 0; k < 3; k++) {
        await ev(`(()=>{[...document.querySelectorAll('#app .el-sub-menu:not(.is-opened) > .el-sub-menu__title, #app [class*="submenu"]:not([class*="open"]) > [class*="title"]')].forEach(t=>{try{t.click()}catch(e){}})})()`);
        await sleep(350);
      }
      /* 枚举页面（左侧菜单 / 顶部页签 / 自定义外壳菜单） */
      const pageEls = await ev(`(()=>{const els=[...document.querySelectorAll('#app aside .el-menu-item, #app .el-menu-item, #app .p-side .mi, #app nav a, #app [class*="menu"] [class*="item"], #app [class*="side"] [class*="item"]')].filter(e=>e.offsetParent);return [...new Set(els.map(e=>e.textContent.trim()).filter(t=>t&&t.length<20))].slice(0,40)})()`) || [];
      /* ★ 2026-11-18 补盲区：【顶部导航版】原型的菜单项是点开才渲染、而且 teleport 到 body 的下拉，
         上面那串选择器一个都枚举不到 → 闸只跑首页却报全绿（和 2026-07-11 那次"只跑单页"是同一类假安全感）。
         改用骨架自己的路由：从 __PRD_DATA__ 拿页面清单，从 Vue 实例拿 go()，直接按 id 跳。
         拿不到就退回原来的菜单点击法，不影响侧边菜单版原型。 */
      const viaGo = await ev(`(()=>{try{
        const app=document.querySelector('#app'); const inst=app&&app.__vue_app__&&app.__vue_app__._instance;
        const go=inst&&inst.setupState&&inst.setupState.go;
        const d=window.__PRD_DATA__||{}; const pcs=d.pages||{};
        if(typeof go!=='function'||!Object.keys(pcs).length) return null;
        window.__GATE_GO__=go;
        return Object.keys(pcs).filter(k=>!(pcs[k]&&pcs[k].hidden));
      }catch(e){return null}})()`);
      const pages = (viaGo && viaGo.length > pageEls.length) ? viaGo : (pageEls.length ? pageEls : ['(单页)']);
      r.pages = pages.length;

      for (const pg of pages) {
        if (pg !== '(单页)') {
          const jumped = await ev(`(()=>{ if(window.__GATE_GO__){ try{ window.__GATE_GO__(${JSON.stringify(pg)}); return 1; }catch(e){} } return 0; })()`);
          if (!jumped) {
            await ev(`(()=>{const e=[...document.querySelectorAll('#app .el-menu-item,#app .p-side .mi,#app nav a')].find(x=>x.offsetParent&&x.textContent.trim()===${JSON.stringify(pg)});if(e)e.click()})()`);
          }
          await sleep(500);
        }
        /* ╔══ B-0（2026-11-18 用户第二次立规后加）：断言「点了有反应」，不只是「点了不炸」══
           为什么要加：老闸只抓 JS 报错，**死按钮一个都抓不到**——行操作写成光秃秃的标签
           （"actions":"查看,收款"），骨架渲染出蓝链但没有去向，点了纹丝不动，闸照样全绿。
           用户 2026-11-04 立过「每个可见控件都要能点」，2026-11-18 又逮到一次，说明光写规范没用。
           判法：逐个点，比对点前点后的页面指纹（弹窗/抽屉可见数、表头、行数、toast、当前页签），
           四者全无变化 = 死控件，点名判红。一次只点一个，点完复位，避免互相干扰。 */
        const SIG = `(()=>({
          dlg:[...document.querySelectorAll('.el-overlay,.el-drawer__wrapper')].filter(o=>o.offsetParent).length,
          msg:document.querySelectorAll('.el-message,.el-notification').length,
          th:[...document.querySelectorAll('#app .el-table__header th')].map(e=>e.innerText.trim()).join('|'),
          rows:document.querySelectorAll('#app .el-table__row').length,
          tab:[...document.querySelectorAll('#app .el-tabs__item.is-active,#app .stab.is-on,#app .tabbar .tab.active')].map(e=>e.innerText.trim()).join('|')
        }))()`;
        /* ⚠️ B-0 期间必须【临时关掉标注模式】：标注开着时左键被标注层接管，点什么都"有反应"，
           死控件一个也抓不到（2026-11-18 第一版就栽在这里，闸绿但原型的【查看】是死的）。测完立刻开回去，B-2 还要用。 */
        await ev("(()=>{try{window.__anno.toggleMode(false);}catch(e){}})()"); await sleep(250);
        const deadHere = await ev(`(async()=>{
          const nap=ms=>new Promise(z=>setTimeout(z,ms));
          const sig=()=>(${SIG});
          const pick=()=>[...document.querySelectorAll('#app .el-table__body tr:first-child td:last-child a, #app .el-table__body tr:first-child td:last-child .el-button, #app .el-table__body tr:first-child td:last-child .el-link')]
            .filter(e=>e.offsetParent && e.innerText.trim());
          const names=pick().map(e=>e.innerText.trim());
          const out=[];
          for(let i=0;i<names.length && i<8;i++){
            const before=JSON.stringify(sig());
            const es=pick(); if(!es[i]) continue;
            try{ es[i].click(); }catch(e){}
            await nap(650);
            const after=JSON.stringify(sig());
            if(before===after) out.push(names[i]);
            /* 复位：关掉可能开的弹窗/抽屉 */
            document.querySelectorAll('.el-dialog__headerbtn,.el-drawer__close-btn').forEach(b=>{try{b.click()}catch(e){}});
            await nap(250);
          }
          return out;
        })()`, true);
        await ev("(()=>{try{window.__anno.toggleMode(true);}catch(e){}})()"); await sleep(250);
        if (Array.isArray(deadHere) && deadHere.length) {
          deadHere.forEach(n => r.dead.push(pg + ' › 行操作【' + n + '】'));
        }

        /* B-1：把这一页每个按钮/页签/行内操作都点一遍，断言不炸 */
        const clicked = await ev(`(()=>{
          const btns=[...document.querySelectorAll('#app button,#app .el-button,#app .el-tabs__item,#app .stab,#app .el-table__body .el-link,#app .op-icon')]
            .filter(e=>e.offsetParent && !e.closest('.anno-pin,.pin-modal,.u-anno-bar,.anno-confirm'));
          let n=0; for(const b of btns.slice(0,40)){ try{ b.click(); n++; }catch(e){} }
          return n;
        })()`);
        r.clicks += (clicked || 0);
        await sleep(350);
        /* 关掉可能被点开的弹窗，免得挡住后续 */
        await ev(`(()=>{document.querySelectorAll('.el-dialog__headerbtn,.el-drawer__close-btn').forEach(b=>{try{b.click()}catch(e){}});})()`);
        await sleep(250);

        /* B-2：把这一页每个可标注元素都右键一遍，断言取到【真功能名】(非空、非"功能区") */
        const bad = await ev(`(()=>{
          const out=[];
          const els=[...document.querySelectorAll('#app button,#app .el-button,#app a,#app td,#app th,#app .el-menu-item,#app .el-tabs__item,#app .stab,#app h1,#app h2,#app h3,#app [class*="card"],#app [class*="stat"],#app [class*="chart"]')]
            .filter(e=>e.offsetParent && !e.closest('.anno-pin,.pin-modal,.u-anno-bar') && e.textContent.trim().length>0);
          const seen=new Set(); let cnt=0;
          for(const el of els){
            const key=el.tagName+'|'+el.textContent.trim().slice(0,18);
            if(seen.has(key))continue; seen.add(key);
            if(cnt++>=28)break;
            const rc=el.getBoundingClientRect();
            /* ★ 每次右键前，用 Esc 真正退出画框模式（只删 CSS 类不够·_drawMode 是闭包变量·不重置会导致后续元素全撞"已在画框→退出返回"→全变空·闸假失败） */
            document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));
            document.querySelector('.acb-cancel')?.click();
            document.body.classList.remove('anno-drawing');
            try{ el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:Math.round(rc.left+rc.width/2),clientY:Math.round(rc.top+rc.height/2)})); }catch(e){continue}
            const b=document.querySelector('.acb-name');
            const nm=b?b.textContent.replace('📋','').trim():'';
            const drew=document.body.classList.contains('anno-drawing');
            try{document.querySelector('.acb-cancel')?.click();}catch(e){}
            document.body.classList.remove('anno-drawing');
            /* 解耦模型下两种结果都对：小控件→取到真名(点选)；大容器→进画框(圈选)。
               只有【既没取到真名、又没进画框】或【点选却叫"功能区"】才判红。 */
            const bigC = rc.width>480 || rc.height>160;
            if(!drew && (!nm || nm==='功能区')){
              /* 大容器没进画框也没名 = 圈选被吃；小控件没名 = 取名漏 —— 都判红 */
              out.push({el:el.tagName.toLowerCase(), txt:el.textContent.trim().replace(/\\s+/g,' ').slice(0,20), got:nm||'(空)', big:bigC});
            }
          }
          return JSON.stringify({checked:cnt, bad:out});
        })()`);
        try { const o = JSON.parse(bad || '{}'); r.rclicks += (o.checked || 0); (o.bad || []).forEach(b => { if (b && b.el) r.badNames.push(`${pg}·<${b.el}>「${b.txt}」→${b.got}`); }); } catch (e) {}
      }
    } catch (e) {
      r.jsErrs.push('闸自身异常: ' + e.message);
    } finally {
      try { ws && ws.close(); } catch (_) {}
      try { server && server.close(); } catch (_) {}
      try { ch && ch.kill(); } catch (_) {}
      try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
    }
    results.push(r);
    /* 框选e2e判红：跑过(boxName非null)但 名字空/「功能区」 或 内容为0 或 【框到表格却内容<3】(该抓全部列头·薄=复制给AI没料·铁律五断) → 红 */
    const _boxBad = (r.boxName !== null && (!r.boxName || r.boxName === '功能区'))
      || (r.boxContent !== null && r.boxContent === 0)
      || (r.boxName !== null && r.boxHasTable === true && (r.boxContent || 0) < 3);
    const ok = !r.badNames.length && !r.jsErrs.length && r.boxReachable !== false && !_boxBad && !r.dead.length;
    console.log(`\n  ${ok ? '✓' : '✗'} ${r.name}`);
    console.log(`      页${r.pages} · 点了${r.clicks}个控件 · 右键验了${r.rclicks}个元素 · 圈选(画框)可达:${r.boxReachable===true?'✓':(r.boxReachable===false?'✗ 进不去':'?')}`
      + ` · 框选e2e:${r.boxName===null?'(未跑到)':`名「${r.boxName||'空'}」内容${r.boxContent==null?'?':r.boxContent}项${_boxBad?' ✗':' ✓'}`}`);
    if (r.boxReachable === false) console.log(`      ✗ 铁律三.1「圈选」坏了：右键大空白容器进不了画框模式（点选把圈选吃了）`);
    if (_boxBad) console.log(`      ✗ 框选e2e不合格：名字空/「功能区」或复制内容为0（名字错时 AI 无料生成PRD）`);
    if (r.badNames.length) { console.log(`      ✗ 取不到真功能名(${r.badNames.length}处)：`); r.badNames.slice(0, 8).forEach(b => console.log('          - ' + b)); }
    if (r.jsErrs.length) { console.log(`      ✗ JS报错(${r.jsErrs.length})：`); [...new Set(r.jsErrs)].slice(0, 5).forEach(e => console.log('          - ' + e)); }
    if (r.dead.length) {
      console.log(`      ✗ 点了没反应的控件(${r.dead.length}处) —— 违反「每个可见控件都要能点」铁律：`);
      [...new Set(r.dead)].slice(0, 12).forEach(d => console.log('          - ' + d));
      console.log(`          修法：行操作不许只写 label，必须带去向 —— {label:'查看', go:'<详情页id>'} / {label:'收款', opens:'<弹窗名>'} / {label:'下发', act:'<提示文案>'}`);
    }
  }
  const allOk = results.every(r => !r.badNames.length && !r.jsErrs.length && r.boxReachable !== false
    && !r.dead.length
    && !((r.boxName !== null && (!r.boxName || r.boxName === '功能区')) || (r.boxContent !== null && r.boxContent === 0)));
  console.log('\n──────────────────────────────');
  console.log(allOk ? '  ㊱ 全量交互回归闸 全绿 PASS ✅（每页每按钮都点过且点了有反应·每元素右键都取到真功能名）'
                    : '  ㊱ 全量交互回归闸 有红 FAIL ❌');
  console.log('════════════════════════════════\n');
  process.exit(allOk ? 0 : 1);
})();
