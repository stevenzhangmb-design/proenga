/* ════════════════════════════════════════════════════════════════════════
   标注可携带性闸 · anno-portability-gate.js · 维护者 QA 工具（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   机器强制【标注随文件走 + 可编辑 + 清空生效】(见 SKILL.md 嵌入式标注铁律)：
   拿夹具临时副本，模拟 anno-server 把标注烤进 window.__USER_ANNOTATIONS__（含 </script> 危险字符·已转义），
   开 headless Chrome 用三种 localStorage 状态验证 _loadPins 优先级：
     ① 空 localStorage（=换浏览器/拷给别人）   → 加载到烤入的标注（pinCount≥1）
     ② localStorage="[]"（=用户主动清空）        → 不加载（pinCount=0，清空生效·烤入标注不复活）
     ③ localStorage=[别的pin]（=本地已编辑）      → 加载本地的（localStorage 优先于烤入）
   并验：含 </script> 的烤入文件仍正常挂载、0 报错（anno-server 转义不破坏文件）。
   退出码 0=全绿 1=有违规。
   ════════════════════════════════════════════════════════════════════════ */
const path = require("path"), fs = require("fs"), http = require("http"), os = require("os"), { spawn } = require("child_process");
const { findChrome } = require("./_gate-env");
const CHROME = findChrome();
const FIXTURE = path.join(__dirname, "fixtures", "reference-prototype.html");
const fails = [];

/* 把 pins 烤进 HTML 的 __USER_ANNOTATIONS__（复刻 anno-server persistAnnotationsToFile：__PRD_DATA__ 后注入 + 转义 </script>）*/
function bake(html, pins) {
  const mIdx = html.indexOf("window.__PRD_DATA__");
  const jIdx = html.indexOf("{", html.indexOf("=", mIdx));
  let depth = 0, jEnd = -1;
  for (let i = jIdx; i < html.length; i++) { if (html[i] === "{") depth++; else if (html[i] === "}") { if (--depth === 0) { jEnd = i; break; } } }
  let tail = jEnd + 1;
  while (tail < html.length && (html[tail] === ";" || html[tail] === " ")) tail++;
  const rest = html.slice(tail).replace(/\s*window\.__USER_ANNOTATIONS__\s*=\s*\[[\s\S]*?\];/g, "");
  const pinsJson = JSON.stringify(pins || []).replace(/<\/script/gi, "<\\/script");
  return html.slice(0, tail) + `\nwindow.__USER_ANNOTATIONS__ = ${pinsJson};` + rest;
}

const BAKED = [{ id: 1, number: 1, title: "功能点：可携带性测试", pageKey: "OMS-x", type: "button", fieldSpecs: "", useCaseRules: "含危险字符 </script><b>x</b> 测试", xPct: 0.5, yPct: 0.3 }];
const OTHER = [{ id: 9, number: 1, title: "功能点：本地另一个", pageKey: "OMS-y", type: "button", fieldSpecs: "", useCaseRules: "本地编辑", xPct: 0.4, yPct: 0.4 }];

(async () => {
  if (!CHROME) { console.log("✗ 未找到 Chrome/Edge"); process.exit(1); }
  if (!fs.existsSync(FIXTURE)) { console.log("✗ 缺夹具 reference-prototype.html"); process.exit(1); }
  console.log("\n════════ 标注可携带性闸 ════════");
  const baked = bake(fs.readFileSync(FIXTURE, "utf8"), BAKED);
  // 找出夹具的 localStorage key（_STORAGE_KEY）
  const keyM = baked.match(/_STORAGE_KEY\s*=\s*'([^']+)'/);
  const KEY = keyM ? keyM[1] : "anno-pins-v2";

  const PORT = 8866, DPORT = 9466;
  const server = http.createServer((q, r) => { r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); r.end(baked); });
  await new Promise(r => server.listen(PORT, r));
  const ud = path.join(os.tmpdir(), "portab_" + process.pid);
  const ch = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=" + DPORT, "--user-data-dir=" + ud, "about:blank"]);
  let ws, send, ev, cerr = [];
  try {
    let page = null;
    for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://localhost:${DPORT}/json/list`); page = (await r.json()).find(t => t.type === "page"); if (page) break; } catch (e) {} await new Promise(z => setTimeout(z, 200)); }
    ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pend = {};
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } if (d.method === "Runtime.exceptionThrown") cerr.push((d.params.exceptionDetails.exception || {}).description || ""); };
    send = (mt, p = {}) => new Promise(res => { const mid = ++id; pend[mid] = res; ws.send(JSON.stringify({ id: mid, method: mt, params: p })); });
    ev = async e => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); return r.result && r.result.result ? r.result.result.value : undefined; };
    await send("Page.enable"); await send("Runtime.enable");

    const load = async () => { await send("Page.navigate", { url: `http://localhost:${PORT}/` }); for (let i = 0; i < 40; i++) { if (await ev(`typeof window.__anno==='object'`) === true) break; await new Promise(z => setTimeout(z, 250)); } await new Promise(z => setTimeout(z, 800)); };
    const pinCount = async () => await ev(`(window.__anno && typeof window.__anno.pinCount!=='undefined') ? window.__anno.pinCount : -1`);
    const mounted = async () => await ev(`!((document.querySelector('#anno-app')||{}).innerHTML||'').includes('{{') && !((document.querySelector('#app')||{}).innerHTML||'').includes('{{')`);

    // ① 空 localStorage（换浏览器/拷给别人）
    await load();
    cerr = [];
    await ev(`localStorage.removeItem('${KEY}'); 'ok'`);
    await load();
    const c1 = await pinCount(), m1 = await mounted();
    console.log((c1 >= 1 ? "  ✓ " : "  ✗ ") + `① 空localStorage(换浏览器) → 加载烤入标注 pinCount=${c1} (应≥1)`);
    console.log((m1 ? "  ✓ " : "  ✗ ") + `   含 </script> 的烤入文件正常挂载 = ${m1}`);
    if (c1 < 1) fails.push(`① 换浏览器没加载到烤入的标注(pinCount=${c1}) —— 可携带性失效`);
    if (!m1) fails.push("① 含 </script> 的烤入文件挂载失败 —— anno-server 转义没生效");

    // ② localStorage="[]"（主动清空）
    await ev(`localStorage.setItem('${KEY}','[]'); 'ok'`);
    await load();
    const c2 = await pinCount();
    console.log((c2 === 0 ? "  ✓ " : "  ✗ ") + `② localStorage="[]"(清空) → 不加载 pinCount=${c2} (应=0，清空生效·烤入不复活)`);
    if (c2 !== 0) fails.push(`② 清空后烤入的标注复活了(pinCount=${c2}) —— _loadPins 优先级没修对`);

    // ③ localStorage=[别的pin]（本地已编辑）
    await ev(`localStorage.setItem('${KEY}', '${JSON.stringify(OTHER).replace(/'/g, "\\'")}'); 'ok'`);
    await load();
    const c3 = await pinCount();
    const t3 = await ev(`(function(){var p=(JSON.parse(localStorage.getItem('${KEY}')||'[]')[0]||{});return p.title||'';})()`);
    console.log((c3 === 1 && /本地/.test(t3 || "") ? "  ✓ " : "  ✗ ") + `③ localStorage=[本地pin] → 加载本地的 pinCount=${c3} title="${t3}" (localStorage 优先于烤入)`);
    if (c3 !== 1) fails.push(`③ 本地编辑没优先(pinCount=${c3}) —— localStorage 应盖过烤入标注`);

    const realErr = cerr.filter(e => e && !/3799|favicon|EventSource|ERR_CONNECTION|net::|Failed to load resource/i.test(e));
    console.log((realErr.length === 0 ? "  ✓ " : "  ✗ ") + `   0 真实报错 (实际 ${realErr.length})`);
    if (realErr.length) fails.push(`${realErr.length} 个真实报错`);
    ws.close();
  } catch (e) { fails.push("运行异常: " + e.message); }
  ch.kill(); server.close(); try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) {}

  console.log("──────────────────────────────────");
  if (!fails.length) console.log("  标注可携带性 PASS ✅（换浏览器看得到·清空生效·本地编辑优先·</script>不破坏）");
  else { console.log("  发现 " + fails.length + " 处违规 FAIL ❌："); fails.forEach(x => console.log("    - " + x)); }
  console.log("════════════════════════════════════\n");
  process.exit(fails.length ? 1 : 0);
})();
