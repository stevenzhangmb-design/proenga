/* ════════════════════════════════════════════════════════════════════════
   场景①②③ 注入回路闸 · inject-roundtrip-test.js · 维护者 QA（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   验"对话框生成/改 PRD → 内容同步进【已圈选的】原型功能标注"这条命脉（真机 headless）：
     ① 圈选充值 → 用圈选 PIN 的【身份 id】注入(模拟 AI 认 id 不臆造) → 内容填进【那个已圈选 PIN】、不新建多余 PIN
     ② 对话框改：同 id 再注入新内容 → 同 PIN 覆盖更新、不新建（双向同步的对话框→原型方向）
     ③ 已生成后·再圈选一个【新功能】→ 注入其 id → 内容填进新圈选 PIN、首个 PIN 不受影响（与用户场景③一致）
        —— 架构(1.8.8 起·防孤儿堆叠)：注入只填【已圈选 PIN 或能精确锚定的元素】，锚不到→跳过不新建；
           故场景③=先圈选新功能再注入(而非旧的"注入未圈 id 就凭空建 PIN")。
   命门：_annoInjectPins 按 zoneContext.fpKey / boundFp 匹配（无 fpKey 的区块 pin 按同名+同页匹配回填）——
        AI 用对身份 id 才填进已圈选标注，臆造 id 锚不到即跳过。本闸锁死"认 id/同名同页 即命中填充"。
   目标原型：默认【从当前标准组件装配一个回路测试原型】(fixtures/roundtrip-data.json + assemble-prototype.js)，
        测的是【当前】标注层(而非过时 fixture)；也可传 argv[2] 指定任意原型(如某项目装配版)。
   SSE 传输层(对话框 /anno-inject → es 'inject-pins' → _annoInjectPins) 是 3 行薄包装(源码 line 2922-2933)，
   只调本闸所测的 _annoInjectPins；故本闸测绑定逻辑(确定性·零污染)，不打真 /anno-inject 避免写线上 prd-data。
   零依赖：node 内置(http/child_process/fetch/WebSocket) + 本机 Chrome。  退出码 0=全绿 1=失败。
   ════════════════════════════════════════════════════════════════════════ */
const http = require("http"), fs = require("fs"), path = require("path"),
      os = require("os"), { spawn, execFileSync } = require("child_process");
const { findChrome } = require("./_gate-env");

// 默认目标：从【当前标准组件】装配一个回路测试原型（测当前标注层，而非过时 fixture）。
// 也可传 argv[2] 指定任意原型。装配的临时件在 finally 里清理。
let PROTO = process.argv[2] || "";
let _tmpAssembled = null;
if (!PROTO) {
  const ASM = path.join(__dirname, "assemble-prototype.js");
  const DATA = path.join(__dirname, "fixtures", "roundtrip-data.json");
  _tmpAssembled = path.join(os.tmpdir(), "roundtrip_asm_" + process.pid + ".html");
  try { execFileSync("node", [ASM, DATA, _tmpAssembled], { stdio: "pipe", timeout: 120000 }); PROTO = _tmpAssembled; }
  catch (e) { console.log("✗ 装配回路测试原型失败:", String(e.message || e).split("\n")[0]); process.exit(1); }
}
const CHROME = process.env.CHROME_PATH || findChrome();
const ROOT = PROTO ? path.dirname(PROTO) : "";
const FILE = PROTO ? path.basename(PROTO) : "";
const PORT = 8912, DPORT = 9445;
const NOISE = /localhost:3799|favicon\.ico|cdn\.tailwindcss\.com/;

function startServer() {
  return new Promise(res => {
    const s = http.createServer((req, rq) => {
      let f = decodeURIComponent(req.url.split("?")[0]);
      let p = path.join(ROOT, f);
      fs.readFile(p, (e, d) => {
        if (e) { rq.writeHead(404); rq.end("nf"); return; }
        const ext = path.extname(p).toLowerCase();
        let body = d;
        if (ext === ".html") {  // 清空 __PRD_DATA__.function_points，让圈选=待生成不受线上数据影响
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
  const ud = path.join(os.tmpdir(), "anno_rt_" + process.pid);
  // --window-size 必须 ≥ 规范的页面最小宽(system-design-spec §5.1 min-width:1350px)，
  // 否则内容宽于视口 → 右键坐标落在视口外 → elementFromPoint 取不到目标 → 气泡不弹 → ③假失败。
  const ch = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run",
    "--hide-scrollbars", "--window-size=1680,1180",
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
  let id = 0; const pending = {}; const errors = [];
  ws.onmessage = (m) => {
    const d = JSON.parse(m.data);
    if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; return; }
    if (d.method === "Runtime.exceptionThrown") {
      const t = d.params.exceptionDetails?.exception?.description || d.params.exceptionDetails?.text || "";
      if (!NOISE.test(t)) errors.push("EXCEPTION: " + t.slice(0, 160));
    }
  };
  const send = (method, params = {}) => new Promise(res => { const mid = ++id; pending[mid] = res; ws.send(JSON.stringify({ id: mid, method, params })); });
  return { ch, ud, ws, send, errors };
}

const ASSERT = `(async () => {
  const wait = ms => new Promise(z=>setTimeout(z,ms));
  const txt = el => (el?.textContent||'').replace(/\\s+/g,' ').trim();
  const checks = []; const add = (n,p,d='') => checks.push({name:n, pass:!!p, detail:String(d).slice(0,140)});
  // 存储键：标准层已按项目区分(anno-pins-v2::<system_name>)；旧 fixture 用裸键(anno-pins-v2)。两者都读，取有数据的那个。
  const _sys = (window.__PRD_DATA__ && window.__PRD_DATA__.system_name) || 'default';
  const KEYS = ['anno-pins-v2::'+_sys, 'anno-pins-v2'];
  const readPins = () => { for (const k of KEYS){ try { const v=JSON.parse(localStorage.getItem(k)||'null'); if (Array.isArray(v)) return v; } catch(e){} } return []; };
  const idOf = p => (p && ((p.zoneContext&&p.zoneContext.fpKey)||p.boundFp))||'';

  add('注入桥 window._annoInjectPins 存在', typeof window._annoInjectPins==='function');

  // ── 场景①：圈选充值 → 用圈选PIN的身份id注入 → 填进【已圈选PIN】不新建 ──
  if (window.__anno){ window.__anno.toggleShow&&window.__anno.toggleShow(true); window.__anno.toggleMode(true); } await wait(200);
  const btn = [...document.querySelectorAll('#app .el-button, #app button')].find(e=>/^充值$/.test(txt(e)));
  add('找到充值按钮(圈选目标)', !!btn);
  let fpId='';
  if (btn) {
    const r = btn.getBoundingClientRect();
    btn.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+8,clientY:r.top+8}));
    await wait(450);
    const ok = [...document.querySelectorAll('.anno-confirm-bubble button')].find(b=>/确定|添加/.test(txt(b)));
    if (ok) ok.click(); await wait(500);
  }
  let pins = readPins();
  const circled = pins[pins.length-1];
  fpId = idOf(circled);
  add('圈选生成PIN且有身份id', !!fpId, 'id='+fpId+' 圈选内容空(待生成)='+(circled?!(circled.fieldSpecs):'?'));
  const countAfterCircle = pins.length;

  window._annoInjectPins([{ fpKey: fpId, title:'充值', fieldSpecs:'FS_ROUNDTRIP_1', useCaseRules:'UC_ROUNDTRIP_1' }]);
  await wait(350);
  pins = readPins();
  const matched = pins.find(p => idOf(p)===fpId);
  add('①注入内容填进【已圈选PIN】(认id命中)', !!(matched && matched.fieldSpecs==='FS_ROUNDTRIP_1' && matched.useCaseRules==='UC_ROUNDTRIP_1'), matched?('fs='+matched.fieldSpecs):'未找到匹配PIN');
  add('①不新建多余PIN', pins.length===countAfterCircle, '前'+countAfterCircle+' 后'+pins.length);

  // ── 场景②(对话框改方向)：同id再注入新内容 → 同PIN覆盖更新、不新建 ──
  window._annoInjectPins([{ fpKey: fpId, title:'充值', fieldSpecs:'FS_ROUNDTRIP_2', useCaseRules:'UC_ROUNDTRIP_2' }]);
  await wait(350);
  pins = readPins();
  const updated = pins.find(p => idOf(p)===fpId);
  add('②对话框改→同PIN内容覆盖更新', !!(updated && updated.fieldSpecs==='FS_ROUNDTRIP_2' && updated.useCaseRules==='UC_ROUNDTRIP_2'), updated?('fs='+updated.fieldSpecs):'未找到');
  add('②覆盖不新建', pins.length===countAfterCircle, '后'+pins.length);

  // ── 场景③（已生成后·再圈选新功能→注入→在圈选标注里显示）──
  // 架构(1.8.8 起·防孤儿堆叠)：注入只填【已圈选PIN 或 能精确锚定的元素】，锚不到→跳过不新建。
  // 故正确流程=先圈选新功能，再注入其 id → 新建那个PIN并填充；与用户场景③"再圈选新功能"一致。
  const before3 = pins.length;
  // 候选【带标签的功能控件】(按钮/链接)，逐个尝试右键圈选，取第一个【真产生新PIN】的——
  // 布局不同(旧手搓 fixture vs 装配版)时，某个元素可能圈到已有 zone(不新增)，故循环兜底。
  // 跳过顶部菜单/页签条里的按钮。原来只用硬编码像素 y>140，太脆：筛选区样式一改(§5.3 固定宽字段)
  // 「查询」按钮上移到 y=138 就被误排除 → ③ 假失败(2026-07-09 实测逮到)。
  // 改为【结构排除 topbar/pagetabs】+ 放宽像素兜底(自定义手搓外壳没有这些类名时仍能靠 y>120 兜住)。
  const inTopChrome = e => !!(e.closest && (e.closest('.topbar') || e.closest('.pagetabs')));
  const cands2 = [...document.querySelectorAll('#app .el-button, #app button, #app .el-link, #app a')]
    .filter(e => { const t=txt(e); const r=e.getBoundingClientRect(); return t && t.length<=8 && !/^充值$/.test(t) && !/^重置$/.test(t) && !inTopChrome(e) && r.top>120 && r.width>0; });
  let newPin=null, fpId2='', afterCircle2=before3;
  for (const cand of cands2){
    // 先滚进视口再取坐标：页面按规范有 min-width:1350px，宽字段会把按钮推出视口，
    // 坐标右键就落到视口外 → 标注层 elementFromPoint 取不到 → 气泡不弹（假失败）。
    cand.scrollIntoView({ block:'center', inline:'center' });
    await wait(80);
    const rc = cand.getBoundingClientRect();
    cand.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:rc.left+8,clientY:rc.top+8}));
    await wait(420);
    const okb = [...document.querySelectorAll('.anno-confirm-bubble button')].find(b=>/确定|添加/.test(txt(b)));
    if (okb) okb.click();
    await wait(450);
    const pnow = readPins();
    if (pnow.length > before3){ newPin=pnow[pnow.length-1]; fpId2=idOf(newPin); afterCircle2=pnow.length; break; }
  }
  const t2 = (newPin && (newPin.title||'').replace(/^功能[点区]：/,'')) || '新功能';
  add('③再圈选新功能→新增一个PIN', afterCircle2===before3+1 && !!newPin && newPin!==circled, 'id='+(fpId2||'(区块pin·按同名+同页匹配)')+' 圈后'+afterCircle2);
  // 真实注入：有fpKey按fpKey命中；无fpKey(区块pin)按【同名+同页】命中回填(架构 line 732-737)——两条路都算命中
  window._annoInjectPins([{ fpKey: fpId2 || t2, title: t2, fieldSpecs:'FS_ROUNDTRIP_3', useCaseRules:'UC_ROUNDTRIP_3' }]);
  await wait(350);
  pins = readPins();
  const created = pins.find(p => p.fieldSpecs==='FS_ROUNDTRIP_3');
  add('③注入→内容填进新圈选PIN(认id或同名同页)', !!(created && created.useCaseRules==='UC_ROUNDTRIP_3'), created?('填入 '+(idOf(created)||t2)):'未填');
  const firstIntact = pins.find(p => idOf(p)===fpId);
  add('③注入不再增PIN·首个PIN不受影响', pins.length===afterCircle2 && !!(firstIntact && firstIntact.fieldSpecs==='FS_ROUNDTRIP_2'), '注入后'+pins.length+' 首个fs='+(firstIntact&&firstIntact.fieldSpecs));

  // ── 渲染层：注入后标注号PIN在DOM可见(showPins被打开) ──
  await wait(150);
  const visPins = [...document.querySelectorAll('#anno-app .anno-pin')].filter(e=>e.offsetParent!==null).length;
  add('注入后标注PIN在原型可见', visPins>=1, 'vis='+visPins);

  return { checks, version: window.__ANNO_LAYER_VERSION__ || '?' };
})()`;

(async () => {
  if (!PROTO || !fs.existsSync(PROTO)) { console.log("✗ 未找到标注原型:", PROTO); process.exit(1); }
  if (!CHROME) { console.log("✗ 未找到 Chrome/Edge"); process.exit(1); }
  const server = await startServer();
  let c, exitCode = 1;
  try {
    c = await cdp();
    await c.send("Page.enable"); await c.send("Runtime.enable");
    // 视口必须 ≥ 规范页面最小宽(§5.1 min-width:1350px)；否则内容溢出视口 → 右键坐标落到视口外
    // → elementFromPoint 取不到目标 → 气泡不弹 → ③圈选假失败。(--window-size 在 headless=new 下不可靠，用 CDP 明确设。)
    try { await c.send("Emulation.setDeviceMetricsOverride", { width: 1680, height: 1180, deviceScaleFactor: 1, mobile: false }); } catch (_) {}
    await c.send("Page.navigate", { url: `http://localhost:${PORT}/${encodeURIComponent(FILE)}?page=${encodeURIComponent(process.env.RT_PAGE || 'recharge-list')}&reset=1` });
    let mounted = false;
    for (let i = 0; i < 120 && !mounted; i++) {
      await new Promise(z => setTimeout(z, 150));
      // 业务 #app 已挂 且 标注层桥接(_annoInjectPins)已就绪——大文件(2MB+)层脚本在 body 末尾，须等它执行完再断言，杜绝时序 race
      const q = await c.send("Runtime.evaluate", { expression: "((((document.getElementById('app')||{}).childElementCount||0)>3) && typeof window._annoInjectPins==='function')?1:0", returnByValue: true });
      if ((q.result?.result?.value || 0) === 1) mounted = true;
    }
    await new Promise(z => setTimeout(z, 1000));
    const r = await c.send("Runtime.evaluate", { expression: ASSERT, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error("断言脚本异常: " + JSON.stringify(r.result.exceptionDetails).slice(0, 300));
    const out = r.result.result.value;
    out.checks.push({ name: "全程 0 真实 JS 报错", pass: c.errors.length === 0, detail: c.errors.slice(0, 3).join(" | ") });
    const allPass = out.checks.every(x => x.pass);
    console.log("\\n════════ 注入回路闸 场景①②③（真机）════════");
    console.log("原型:", FILE, " 版本:", out.version);
    for (const ck of out.checks) console.log((ck.pass ? "  ✓ " : "  ✗ ") + ck.name + (ck.detail ? "  〔" + ck.detail + "〕" : ""));
    console.log("────────────────────────────────────");
    console.log(allPass ? "  全绿 PASS ✅ —— 圈选↔注入绑定/填充/新增 全通" : "  有失败 FAIL ❌");
    console.log("════════════════════════════════════\\n");
    exitCode = allPass ? 0 : 1;
  } catch (e) {
    console.log("✗ 回路闸运行异常:", e.message);
  } finally {
    try { server.close(); } catch (e) {}
    try { c && c.ws.close(); } catch (e) {}
    try { c && c.ch.kill(); } catch (e) {}
    try { c && fs.rmSync(c.ud, { recursive: true, force: true }); } catch (e) {}
    try { if (_tmpAssembled) fs.unlinkSync(_tmpAssembled); } catch (e) {}
    process.exit(exitCode);
  }
})();
