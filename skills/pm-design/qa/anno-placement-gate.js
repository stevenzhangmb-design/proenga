/* ════════════════════════════════════════════════════════════════════════
   标注控件位置闸 · anno-placement-gate.js · 维护者 QA 工具（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   机器强制【标注控件放置铁律】(见 SKILL.md)：开「标注」开关后——
     ① 标注控件【内联在顶部右侧】(复制已圈功能等在 top<130 的头部)；
     ② 【绝不浮层】(.ai-pin-bar 不渲染/不可见)；
     ③ 「标注」开关【够得着·没被遮挡】(elementFromPoint 命中开关本身)；
     ④ 0 真实报错。
   把"靠 AI 截图自检"升级成"机器强制"——别人 AI 忘了自检，这道闸也拦住浮层/遮挡。
   自动探测 archive 所有标注原型。退出码 0=全绿 1=有违规。
   ════════════════════════════════════════════════════════════════════════ */
const path = require("path"), fs = require("fs"), http = require("http"), os = require("os"), { spawn } = require("child_process");
const { findChrome, findPrototypes } = require("./_gate-env");
const CHROME = findChrome();
const FILES = findPrototypes();
const fails = [];

(async () => {
  if (!CHROME) { console.log("✗ 未找到 Chrome/Edge"); process.exit(1); }
  console.log("\n════════ 标注控件位置闸 ════════");
  if (!FILES.length) { console.log("  (archive 无标注原型，跳过)"); process.exit(0); }
  let port = 8870, dport = 9470;
  for (const f of FILES) {
    await checkOne(f, port++, dport++);
  }
  console.log("──────────────────────────────────");
  if (!fails.length) console.log("  全部原型 标注控件位置合规 PASS ✅（内联顶部右侧·不浮层·开关够得着）");
  else { console.log("  发现 " + fails.length + " 处违规 FAIL ❌："); fails.forEach(x => console.log("    - " + x)); }
  console.log("════════════════════════════════════\n");
  process.exit(fails.length ? 1 : 0);
})();

async function checkOne(file, PORT, DPORT) {
  const name = path.basename(file);
  const html = fs.readFileSync(file);
  const server = http.createServer((q, r) => { r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); r.end(html); });
  await new Promise(r => server.listen(PORT, r));
  const ud = path.join(os.tmpdir(), "place_" + PORT);
  const ch = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--window-size=1600,950", "--remote-debugging-port=" + DPORT, "--user-data-dir=" + ud, "about:blank"]);
  let R = {}, err = "", cerr = [];
  try {
    let page = null;
    for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://localhost:${DPORT}/json/list`); page = (await r.json()).find(t => t.type === "page"); if (page) break; } catch (e) {} await new Promise(z => setTimeout(z, 200)); }
    const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pend = {};
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } if (d.method === "Runtime.exceptionThrown") cerr.push((d.params.exceptionDetails.exception || {}).description || ""); };
    const send = (mt, p = {}) => new Promise(res => { const mid = ++id; pend[mid] = res; ws.send(JSON.stringify({ id: mid, method: mt, params: p })); });
    const ev = async e => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
    const waitFor = async (e, t = 100) => { for (let i = 0; i < t; i++) { try { if (await ev(e) === true) return true; } catch (x) {} await new Promise(z => setTimeout(z, 300)); } return false; };
    await send("Page.enable"); await require('./_anno-isolate').isolateAnnoServer(send); /* 隔离真 anno-server(3799)：防标注层 /anno-persist 改写用户真实原型 */ await send("Runtime.enable");
    await send("Page.navigate", { url: `http://localhost:${PORT}/` });
    await waitFor(`typeof window.__anno==='object'`);
    // 点「标注」开关（按 title 含"标注"找，回退第一个 el-switch）
    await ev(`(function(){
      var sws=[].slice.call(document.querySelectorAll('.el-switch'));
      var s=sws.find(function(x){var p=x.closest('span,div'); return p&&(p.title||'').indexOf('标注')>=0;}) || sws[0];
      if(s)s.click(); return true;
    })()`);
    await new Promise(z => setTimeout(z, 900));
    // ① 复制已圈功能 在顶部头部(top<130)
    R.copyTop = await ev(`(function(){var b=[].slice.call(document.querySelectorAll('button,.el-button')).find(x=>x.offsetParent!==null && x.innerText.indexOf('复制已圈功能')>=0); return b?Math.round(b.getBoundingClientRect().top):-1;})()`);
    // ② .ai-pin-bar 不渲染/不可见(无浮层)
    R.floatBar = await ev(`(function(){var b=document.querySelector('.ai-pin-bar'); return !!b && b.offsetParent!==null;})()`);
    // ③ 标注开关够得着：elementFromPoint 命中开关本身
    /* §2026-11-14（标注层 1.11.9 起）：开启标注后的提示条必须出现在顶部导航栏下方，
       不许盖住【标注】开关或工具条（.anno-sw）里任何按钮——被提示条盖住也判红（曾只警告，已改回）。 */
    const reachSrc = `(function(){
      var sws=[].slice.call(document.querySelectorAll('.el-switch'));
      var s=sws.find(function(x){var p=x.closest('span,div'); return p&&(p.title||'').indexOf('标注')>=0;}) || sws[0];
      if(!s)return 'nosw'; var r=s.getBoundingClientRect(); var el=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
      if(!!el && (s.contains(el)||el===s)) return 'ok';
      return (el && el.closest && el.closest('.el-message,.el-notification')) ? 'toast' : 'blocked';
    })()`;
    let reach = await ev(reachSrc);
    if (reach === 'toast') R.toastCover = true;
    R.toastHits = await ev(`(function(){
      var ms=[].slice.call(document.querySelectorAll('.el-message,.el-notification')).filter(function(m){var r=m.getBoundingClientRect();return r.width>0&&r.height>0;});
      var bs=[].slice.call(document.querySelectorAll('.anno-sw > .el-switch, .anno-sw > .el-button, .anno-sw button')).filter(function(b){return b.offsetParent!==null;});
      var hit=[]; ms.forEach(function(m){var a=m.getBoundingClientRect(); bs.forEach(function(b){var c=b.getBoundingClientRect();
        if(a.left<c.right&&a.right>c.left&&a.top<c.bottom&&a.bottom>c.top){var t=(b.innerText||'').trim().slice(0,12)||'标注开关'; if(hit.indexOf(t)<0)hit.push(t);}});});
      return hit;
    })()`) || [];
    R.switchReach = reach === 'ok';
    await new Promise(z => setTimeout(z, 300));
    ws.close();
  } catch (e) { err = e.message; }
  ch.kill(); server.close(); try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) {}
  const realErr = cerr.filter(e => !/3799|favicon|EventSource|ERR_CONNECTION|net::|Failed to load resource/i.test(e));
  const C = b => b ? "  ✓ " : "  ✗ ";
  console.log("  · " + name);
  const okTop = R.copyTop >= 0 && R.copyTop < 130;
  console.log(C(okTop) + "    复制已圈功能 内联顶部(top=" + R.copyTop + "，应 0~130)");
  console.log(C(!R.floatBar) + "    无浮层 ai-pin-bar (" + (R.floatBar ? "仍在渲染!" : "已弃用") + ")");
  console.log(C(R.switchReach) + "    「标注」开关够得着·没被遮挡");
  console.log(C(!R.toastCover && !R.toastHits.length) + "    开启标注后的提示条不盖开关/工具条按钮" + (R.toastHits.length ? "（盖住：" + R.toastHits.join("、") + "）" : ""));
  console.log(C(realErr.length === 0) + "    0 真实报错");
  if (err) fails.push(name + " 运行异常: " + err);
  if (!okTop) fails.push(name + " 复制已圈功能 不在顶部头部(top=" + R.copyTop + ") —— 标注控件没内联到顶部右侧");
  if (R.floatBar) fails.push(name + " 仍有浮层 ai-pin-bar 渲染 —— 违反【不浮层】");
  if (!R.switchReach) fails.push(name + " 「标注」开关被遮挡/够不着" + (R.toastCover ? "（被开启标注后的提示条盖住）" : "") + " —— 反人类");
  if (R.toastHits && R.toastHits.length) fails.push(name + " 开启标注后的提示条盖住了工具条：" + R.toastHits.join("、") + " —— 提示条须在顶部导航栏下方");
  if (realErr.length) fails.push(name + " " + realErr.length + " 个真实报错");
}
