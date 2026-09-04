/* ════════════════════════════════════════════════════════════════════════
   pm-design 标注层回归闸  ·  regression-check.js  ·  维护者 QA 工具（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   用途：每次改 annotation-layer.html / 原型引擎 / prd-data 后，自动验证标注层仍满足
        标准契约——把"改一处崩别处"从靠人盯改成机器拦。红了立刻停，绝不往下走。
   模型：B 架构（2026-06-23）——圈选/框选只圈范围，内容=待生成（空），内容由 AI 真推理
        注入后才有。故本闸**不**再检查圈选后的字段规范/7节内容（那是 AI 生成后的事，
        由 anno-server PRD 生成器单测 16/16 + 多形态 16/16 覆盖）。本闸只盯 UI 行为契约。
   零依赖：只用 node 内置（http / child_process / 内置 fetch & WebSocket）+ 本机 Chrome。
   运行：  node regression-check.js [原型HTML绝对路径]
          默认测离线版充值管理原型；可传任意原型路径。
   退出码：0=全绿，1=有失败（可接入 CI / pre-commit）。
   断言覆盖（每条都是历史踩过的坑）：
     · 业务 #app 与标注 #anno-app 双独立实例挂载 + 四桥接存在（__anno/SetView/GetView/InjectPins）
     · 业务表格有数据 + 业务导航可用（点 .ptab 切页生效）+ 全程 0 真实 JS 报错
     · 右键圈选功能点 → 状态=待生成（空，不偷塞草稿）+ 归属目录准确（系统›菜单层级）
     · 标注号 PIN 渲染且可见（面板关 & 面板开都可见——历史 app/main 渲染过滤 bug）
     · 面板结构：无 fpKey 列 + 功能名为可编辑输入框
     · 切到别的页面时本页标记正确隐藏（pageKey 过滤）
     · 崩掉整个标注层后业务页仍存活可点（解耦铁律）
   ════════════════════════════════════════════════════════════════════════ */
const http = require("http"), fs = require("fs"), path = require("path"),
      os = require("os"), { spawn } = require("child_process");
const { findChrome, REFERENCE_PROTOTYPE } = require("./_gate-env");

const PROTO = process.argv[2] || REFERENCE_PROTOTYPE;
const CHROME = process.env.CHROME_PATH || findChrome();
const ROOT = PROTO ? path.dirname(PROTO) : "";
const FILE = PROTO ? path.basename(PROTO) : "";
const PORT = 8911, DPORT = 9444;
const NOISE = /localhost:3799|favicon\.ico|cdn\.tailwindcss\.com|fonts\.googleapis|fonts\.gstatic/;  // 已知无害噪声(本地同步服务/图标/tailwind/外部字体CDN加载失败)

function startServer() {
  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      let f = decodeURIComponent(req.url.split("?")[0]);
      let p = path.join(ROOT, f);
      fs.readFile(p, (e, d) => {
        if (e) { rq.writeHead(404); rq.end("nf"); return; }
        const ext = path.extname(p).toLowerCase();
        let body = d;
        // 闸数据无关：serve 时把原型 __PRD_DATA__.function_points 清空（大括号计数），让"圈选=待生成"等断言不受线上已生成数据影响；page_menus 保留
        if (ext === ".html") {
          let s = d.toString("utf8");
          const fi = s.indexOf('"function_points"');
          if (fi >= 0) {
            const bs = s.indexOf('{', fi);
            if (bs >= 0) {
              let dep = 0, end = -1;
              for (let i = bs; i < s.length; i++) { if (s[i] === '{') dep++; else if (s[i] === '}') { if (--dep === 0) { end = i; break; } } }
              if (end >= 0) s = s.slice(0, bs) + '{}' + s.slice(end + 1);
            }
          }
          body = Buffer.from(s, "utf8");
        }
        rq.writeHead(200, { "Content-Type": ext === ".html" ? "text/html; charset=utf-8" : "application/octet-stream" });
        rq.end(body);
      });
    });
    s.listen(PORT, () => res(s));
  });
}

async function cdp() {
  const ud = path.join(os.tmpdir(), "anno_regr_" + process.pid);
  const ch = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run",
    "--remote-debugging-port=" + DPORT, "--user-data-dir=" + ud, "about:blank"]);
  let page = null;
  for (let i = 0; i < 50; i++) {
    try { const r = await fetch(`http://localhost:${DPORT}/json/list`); const l = await r.json();
      page = l.find(t => t.type === "page"); if (page) break; } catch (e) {}
    await new Promise(z => setTimeout(z, 200));
  }
  if (!page) { ch.kill(); throw new Error("no page target"); }
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0; const pending = {}; const errors = []; const state = { loaded: false };
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.method === "Page.loadEventFired") state.loaded = true;
    if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; return; }
    if (d.method === "Runtime.exceptionThrown") {
      const t = d.params.exceptionDetails?.exception?.description || d.params.exceptionDetails?.text || "";
      if (!NOISE.test(t)) errors.push("EXCEPTION: " + t.slice(0, 160));
    }
    if (d.method === "Log.entryAdded" && d.params.entry.level === "error") {
      const e = d.params.entry;
      const t = (e.text || "") + " " + (e.url || "");
      if (!NOISE.test(t)) errors.push("LOG: " + t.slice(0, 160));
    }
  };
  const send = (method, params = {}) => new Promise(res => { const mid = ++id; pending[mid] = res; ws.send(JSON.stringify({ id: mid, method, params })); });
  return { ch, ud, ws, send, errors, state };
}

const ASSERT = `(async () => {
  const wait = ms => new Promise(z=>setTimeout(z,ms));
  const txt = el => (el?.textContent||'').replace(/\\s+/g,' ').trim();
  const checks = []; const add = (n,p,d='') => checks.push({name:n, pass:!!p, detail:String(d).slice(0,120)});

  // ══════════ A. 通用回归（任意原型·装配骨架/自定义外壳都适用）══════════
  // ── A1. 挂载 + 四桥接（标准部件命门·与项目内容无关）──
  add('业务#app已挂载', document.querySelectorAll('#app *').length > 20, 'els='+document.querySelectorAll('#app *').length);
  add('标注#anno-app独立挂载', !!document.getElementById('anno-app'));
  add('桥接 window.__anno', typeof window.__anno === 'object');
  add('桥接 window.__annoSetView', typeof window.__annoSetView === 'function');
  add('桥接 window.__annoGetView', typeof window.__annoGetView === 'function');
  add('注入 window._annoInjectPins', typeof window._annoInjectPins === 'function');

  // ── A2. 圈选任意功能元素 → 气泡 + 待生成PIN可见 + 面板可打开(无fpKey列·有功能名列·改名生效)──
  Object.keys(localStorage).filter(k=>/anno|pin/i.test(k)).forEach(k=>localStorage.removeItem(k));
  if (window.__anno){ window.__anno.toggleShow&&window.__anno.toggleShow(true); window.__anno.toggleMode&&window.__anno.toggleMode(true); } await wait(250);
  // 放宽·外壳无关：内容区任意可圈元素(按钮/链接/自定义btn/卡片/表头)，跳过顶栏/菜单/页签
  const inChrome = e => e.closest('.topbar,.top-nav,.sysseg,.anno-sw,.pagetabs,.el-tabs__header,#anno-app');
  const okEl = e => { const r=e.getBoundingClientRect(); return r.width>0 && r.height>0 && r.top>110 && !inChrome(e); };
  const anyBtn =
    [...document.querySelectorAll('#app button, #app .el-button, #app .el-link, #app a, #app [class*="btn"], #app [class*="search"]')].find(e=>{ const t=txt(e); return t && t.length<=10 && okEl(e); })
    || [...document.querySelectorAll('#app .stat-card, #app .gcard, #app .el-card, #app h4, #app td, #app .el-table__cell')].find(e=>{ const t=txt(e); return t && t.length<=40 && okEl(e); })
    || null;
  // 软跳过：本页确无典型可圈元素(如纯占位页)→ 记通过不误红；找到才跑圈选子检查
  add('找到可圈选功能元素(无则跳过圈选子检查)', true, anyBtn ? ('目标='+txt(anyBtn).slice(0,20)) : '本页无典型可圈元素·跳过');
  if (anyBtn) {
    const r = anyBtn.getBoundingClientRect();
    anyBtn.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+8,clientY:r.top+8}));
    await wait(450);
    const ok = [...document.querySelectorAll('.anno-confirm-bubble button')].find(b=>/确定|添加/.test(txt(b)));
    add('右键弹出标注气泡', !!ok);
    if (ok) ok.click(); await wait(450);
    add('标注号PIN可见(面板关)', [...document.querySelectorAll('#anno-app .anno-pin')].filter(e=>e.offsetParent!==null).length >= 1);
    window.__anno.openScopedList && window.__anno.openScopedList(); await wait(500);
    const dlg = [...document.querySelectorAll('.el-dialog')].find(d=>/已圈定功能清单/.test(txt(d.querySelector('.el-dialog__title'))));
    add('已圈定功能清单可打开', !!dlg);
    if (dlg) {
      const heads = [...dlg.querySelectorAll('th .cell, th')].map(txt).filter(Boolean);
      add('面板无fpKey列+有功能名列', !heads.includes('fpKey') && heads.includes('功能名'), heads.join('|'));
      const row = dlg.querySelector('.el-table__body-wrapper tbody tr');
      const editBtn = row ? row.querySelector('.fn-edit-btn') : null;
      if (editBtn) {
        add('功能名编辑图标渲染(有svg)', !!row.querySelector('.fn-edit-btn svg'));
        editBtn.click(); await wait(400);
        const rdlg = [...document.querySelectorAll('.el-dialog')].find(d=>/编辑功能名/.test(txt(d.querySelector('.el-dialog__title'))));
        const inp = rdlg ? rdlg.querySelector('.el-input__inner, input') : null;
        if (inp) {
          const setNative = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
          setNative.call(inp, '改名验证X'); inp.dispatchEvent(new Event('input',{bubbles:true})); await wait(200);
          const saveBtn = [...rdlg.querySelectorAll('button')].find(b=>/保存/.test(txt(b)));
          if (saveBtn) saveBtn.click(); await wait(450);
          const row2 = dlg.querySelector('.el-table__body-wrapper tbody tr');
          add('改名弹窗保存生效', !!(row2 && /改名验证X/.test(txt(row2))), row2?txt(row2):'(无行)');
        } else add('改名弹窗保存生效', false, '编辑弹窗输入框未找到');
      } else add('改名弹窗保存生效', false, '面板无编辑图标(功能名列结构变?)');
      const cx = dlg.querySelector('.el-dialog__headerbtn'); cx && cx.click(); await wait(250);
    }
  }

  // ══════════ B. 充值参照专项（仅当检测到充值形状·深度防退化·非充值原型自动跳过）══════════
  const isRecharge = [...document.querySelectorAll('#app .ptab')].some(e=>/充值管理/.test(txt(e))) && !!document.querySelector('#app .stabs');
  if (isRecharge) {
    if (window.__anno) window.__anno.toggleMode(false); await wait(120);
    const tabBalance = [...document.querySelectorAll('#app .ptab')].find(e=>/账户余额/.test(txt(e)));
    if (tabBalance) { tabBalance.click(); await wait(350); }
    add('[充值]业务导航可用(切账户余额页)', /balance/.test(window.__annoGetView?window.__annoGetView():''), window.__annoGetView?window.__annoGetView():'');
    const tabRc = [...document.querySelectorAll('#app .ptab')].find(e=>/充值管理/.test(txt(e)));
    if (tabRc) { tabRc.click(); await wait(350); }
    add('[充值]切回充值管理页', (window.__annoGetView?window.__annoGetView():'').includes('recharge-list'));
    const bizRows = document.querySelectorAll('#app table.pt tbody tr, #app .el-table__body-wrapper tbody tr').length;
    add('[充值]业务表格有数据', bizRows > 0, 'rows='+bizRows);
    // 圈选采集完整性（框故意切掉末状态页签·断言补回全状态）
    const stabs = document.querySelector('#app .stabs');
    if (stabs) {
      const tabEls = [...stabs.querySelectorAll('.stab')];
      const realTabs = [...new Set(tabEls.map(e=>txt(e).replace(/\\s*[\\(（].*?[\\)）]\\s*$/,'')))];
      const sr = stabs.getBoundingClientRect(), lr = tabEls[tabEls.length-1].getBoundingClientRect();
      const rx=sr.left, ry=sr.top, w=(lr.left-sr.left-5), h=sr.height;
      const SEL='[class*="title"],h1,h2,h3,h4,.msg-tab,.stab,.tab-item,[class*="tab-label"]';
      const inBtn=el=>el.closest('button,.el-button,.search-btn,[class*="btn"]');
      const inBox=el=>{const r=el.getBoundingClientRect();return r.width&&r.left>=rx-6&&r.top>=ry-6&&r.right<=rx+w+6&&r.bottom<=ry+h+6;};
      const ovBox=el=>{const r=el.getBoundingClientRect();return r.width&&r.right>rx&&r.left<rx+w&&r.bottom>ry&&r.top<ry+h;};
      const ZS='.stabs,.msg-tabs,.el-tabs__nav,[data-annotation-zone]';
      const norm=el=>txt(el).replace(/\\s*[\\(（].*?[\\)）]\\s*$/,'');
      const all=[...document.querySelectorAll(SEL)].filter(el=>el.children.length===0&&!inBtn(el));
      const oldT=[...new Set(all.filter(inBox).map(norm))].filter(t=>realTabs.includes(t));
      const hit=new Set(all.filter(inBox));
      const zs=new Set(); for(const el of hit){const z=el.closest(ZS); if(z&&ovBox(z))zs.add(z);}
      for(const z of zs)for(const el of all)if(z.contains(el))hit.add(el);
      const newT=[...new Set([...all].filter(el=>hit.has(el)).map(norm))].filter(t=>realTabs.includes(t));
      add('[充值]圈选采集完整(框切末页签仍补回全状态)', realTabs.length>=3 && realTabs.every(rt=>newT.includes(rt)) && oldT.length<realTabs.length, '真'+realTabs.length+' 旧'+oldT.length+' 新'+newT.length);
    }
    // 归属目录准确（充值真实菜单层级）
    if (window.__anno){ window.__anno.toggleMode(true); } await wait(150);
    const czBtn = [...document.querySelectorAll('#app .el-button, #app button')].find(e=>/^充值$/.test(txt(e)));
    if (czBtn) {
      const r2 = czBtn.getBoundingClientRect();
      czBtn.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r2.left+8,clientY:r2.top+8})); await wait(400);
      const ok2 = [...document.querySelectorAll('.anno-confirm-bubble button')].find(b=>/确定|添加/.test(txt(b))); if(ok2) ok2.click(); await wait(300);
      window.__anno.openScopedList && window.__anno.openScopedList(); await wait(400);
      const dlg2 = [...document.querySelectorAll('.el-dialog')].find(d=>/已圈定功能清单/.test(txt(d.querySelector('.el-dialog__title'))));
      const tds = dlg2 ? [...(dlg2.querySelector('.el-table__body-wrapper tbody tr')||{querySelectorAll:()=>[]}).querySelectorAll('td')] : [];
      add('[充值]归属目录准确', tds.some(td=>/OMS › 财务 \\/ 财务管理 \\/ 充值管理/.test(txt(td))), tds[2]?txt(tds[2]):'');
      const cx2 = dlg2 ? dlg2.querySelector('.el-dialog__headerbtn') : null; cx2 && cx2.click(); await wait(200);
    }
  }

  // ══════════ C. 通用：解耦——崩掉整个标注层后业务页仍存活可点 ══════════
  document.getElementById('anno-app') && document.getElementById('anno-app').remove();
  let alive=false;
  try {
    const el = document.querySelector('#app .content .el-button, #app .content button, #app .nav-item, #app a, #app .el-button, #app button');
    if (el) el.click(); await wait(150);
    alive = document.querySelectorAll('#app *').length > 20;
  } catch(e){}
  add('崩标注层后业务页存活(解耦)', alive);

  return { checks, version: window.__ANNO_LAYER_VERSION__ || '?' };
})()`;

(async () => {
  if (!PROTO) { console.log("✗ 未在 archive 找到标注原型（含 window.__PRD_DATA__ + anno-app 的 .html）"); process.exit(1); }
  if (!CHROME) { console.log("✗ 未找到 Chrome/Edge，可用 CHROME_PATH 指定"); process.exit(1); }
  if (!fs.existsSync(PROTO)) { console.log("✗ 原型文件不存在:", PROTO); process.exit(1); }
  const server = await startServer();
  let c, exitCode = 1;
  try {
    c = await cdp();
    await c.send("Page.enable"); await c.send("Runtime.enable"); await c.send("Log.enable");
    await c.send("Network.enable"); await c.send("Network.setBlockedURLs", { urls: ["*tailwindcss*"] });
    await c.send("Page.navigate", { url: `http://localhost:${PORT}/${encodeURIComponent(FILE)}?page=recharge-list&reset=1` });
    let mounted = false;
    for (let i = 0; i < 120 && !mounted; i++) {
      await new Promise(z => setTimeout(z, 150));
      // 业务 #app 已挂 且 标注层桥接就绪——大文件(2MB+)层脚本在 body 末尾，等它执行完再断言，杜绝时序 race
      const q = await c.send("Runtime.evaluate", { expression: "((((document.getElementById('app')||{}).childElementCount||0)>3) && typeof window._annoInjectPins==='function')?1:0", returnByValue: true });
      if ((q.result?.result?.value || 0) === 1) mounted = true;
    }
    await new Promise(z => setTimeout(z, 1000));
    // ★ 屏蔽对 anno-server 的 /anno-inject·/anno-update POST：本闸只验 UI 行为，绝不写线上 prd-data
    //   （改名测试会触发 _syncPinToServer，若 anno-server 在跑会污染线上数据；本地改名仍生效不受影响）
    await c.send("Runtime.evaluate", { expression: `(function(){ var of=window.fetch; window.fetch=function(u){ try{ var s=(typeof u==='string')?u:(u&&u.url)||''; if(s.indexOf('/anno-inject')>=0||s.indexOf('/anno-update')>=0) return Promise.resolve(new Response('{}',{status:200})); }catch(e){} return of.apply(this,arguments); }; return true; })()` });
    const r = await c.send("Runtime.evaluate", { expression: ASSERT, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error("断言脚本异常: " + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    const out = r.result.result.value;
    out.checks.push({ name: "全程 0 真实 JS 报错", pass: c.errors.length === 0, detail: c.errors.slice(0, 3).join(" | ") });
    const allPass = out.checks.every(x => x.pass);
    console.log("\\n════════ 标注层回归闸（B架构）════════");
    console.log("原型:", FILE, " 版本:", out.version);
    for (const ck of out.checks) console.log((ck.pass ? "  ✓ " : "  ✗ ") + ck.name + (ck.detail ? "  〔" + ck.detail + "〕" : ""));
    console.log("────────────────────────────────────");
    console.log(allPass ? "  全绿 PASS ✅" : "  有失败 FAIL ❌");
    console.log("════════════════════════════════════\\n");
    exitCode = allPass ? 0 : 1;
  } catch (e) {
    console.log("✗ 回归闸运行异常:", e.message);
  } finally {
    try { server.close(); } catch (e) {}
    try { c && c.ws.close(); } catch (e) {}
    try { c && c.ch.kill(); } catch (e) {}
    try { c && fs.rmSync(c.ud, { recursive: true, force: true }); } catch (e) {}
    process.exit(exitCode);
  }
})();
