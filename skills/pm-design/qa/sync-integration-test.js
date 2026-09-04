/* ════════════════════════════════════════════════════════════════════════
   保存即同步 集成测试  ·  sync-integration-test.js  ·  维护者 QA 工具（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   验证「浏览器里改功能名/字段规范/用例规则 → 保存 → 自动写本地 PRD 文件」整条链。
   需要 anno-server 在跑（localhost:3799）——这是该功能的前置依赖；没跑则 SKIP（exit 0）。
   做法：无头浏览器圈选充值→面板改功能名→触发保存→等 POST 往返→校验本地 PRD 文件被写且含新名。
        用测试产品名(ZZ集成测试DELETE)避免回写真实原型；验完自动删测试文件、还原 prd-data。
   运行：  node sync-integration-test.js [原型HTML绝对路径]   退出码 0=通过/跳过 1=失败。
   ════════════════════════════════════════════════════════════════════════ */
const http=require("http"),fs=require("fs"),path=require("path"),os=require("os"),{spawn}=require("child_process");
const PROTO = process.argv[2] || '';  // 必传原型路径（去个人机器路径·公开仓安全）
const CHROME = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const ROOT = path.dirname(PROTO), FILE = path.basename(PROTO), ARCHIVE = ROOT;
const PORT = 8930, DPORT = 9462, TESTNAME = "ZZ集成测试DELETE", NEWNAME = "充值申请-集成测试";

(async () => {
  if (!fs.existsSync(PROTO)) { console.log("✗ 原型不存在:", PROTO); process.exit(1); }
  // anno-server 必须在跑，否则跳过（该功能本就依赖它）
  try { await fetch("http://localhost:3799/anno-queue", { signal: AbortSignal.timeout(2500) }); }
  catch (e) { console.log("⊘ SKIP：anno-server 未运行，本集成测试需要它（启动后再跑）"); process.exit(0); }

  const prdData = path.join(ARCHIVE, "prd-data.json");
  const bak = path.join(ARCHIVE, "prd-data.json.synctest-bak");
  const hadPrd = fs.existsSync(prdData);
  if (hadPrd) fs.copyFileSync(prdData, bak);

  const server = http.createServer((req, rq) => { const p = path.join(ROOT, decodeURIComponent(req.url.split("?")[0]));
    fs.readFile(p, (e, d) => { if (e) { rq.writeHead(404); rq.end("nf"); return; } rq.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); rq.end(d); }); });
  await new Promise(r => server.listen(PORT, r));
  const ud = path.join(os.tmpdir(), "syncit_" + process.pid);
  const ch = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--remote-debugging-port=" + DPORT, "--user-data-dir=" + ud, "about:blank"]);
  let exitCode = 1;
  try {
    let page = null;
    for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://localhost:${DPORT}/json/list`); const l = await r.json(); page = l.find(t => t.type === "page"); if (page) break; } catch (e) {} await new Promise(z => setTimeout(z, 200)); }
    const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pending = {}; ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
    const send = (method, params = {}) => new Promise(res => { const mid = ++id; pending[mid] = res; ws.send(JSON.stringify({ id: mid, method, params })); });
    await send("Page.enable"); await send("Runtime.enable"); await send("Network.enable");
    await send("Network.setBlockedURLs", { urls: ["*tailwindcss*"] });  // 不屏蔽 3799，要让浏览器 fetch anno-server
    await send("Page.navigate", { url: `http://localhost:${PORT}/${encodeURIComponent(FILE)}?page=recharge-list&reset=1` });
    for (let i = 0; i < 120; i++) { await new Promise(z => setTimeout(z, 150)); const q = await send("Runtime.evaluate", { expression: "(document.getElementById('app')||{}).childElementCount||0", returnByValue: true }); if ((q.result?.result?.value || 0) > 3) break; }
    await new Promise(z => setTimeout(z, 1000));
    // ★ 2026-06-28 更新：功能名编辑 UI 已从"行内输入框"改为"编辑图标→编辑功能名弹窗"（与 regression-check 一致），测试随之改用新流程触发保存同步
    const expr = `(async()=>{ const wait=ms=>new Promise(z=>setTimeout(z,ms)); const txt=el=>(el?.textContent||'').replace(/\\s+/g,' ').trim();
      if(window.__PRD_DATA__) window.__PRD_DATA__.system_name='${TESTNAME}';
      if(window.__anno){window.__anno.toggleShow&&window.__anno.toggleShow(true);window.__anno.toggleMode(true);} await wait(200);
      const btn=[...document.querySelectorAll('#app .el-button, #app button')].find(e=>/^充值$/.test(txt(e))); if(!btn)return 'no-btn';
      const r=btn.getBoundingClientRect(); btn.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+8,clientY:r.top+8})); await wait(450);
      const ok=[...document.querySelectorAll('.anno-confirm-bubble button')].find(b=>/确定|添加/.test(txt(b))); if(ok)ok.click(); await wait(500);
      window.__anno.openScopedList(); await wait(450);
      const dlg=[...document.querySelectorAll('.el-dialog')].find(d=>/已圈定功能清单/.test(txt(d.querySelector('.el-dialog__title')))); if(!dlg)return 'no-dlg';
      const row=dlg.querySelector('.el-table__body-wrapper tbody tr'); const editBtn=row?row.querySelector('.fn-edit-btn'):null; if(!editBtn)return 'no-editbtn';
      editBtn.click(); await wait(400);
      const rdlg=[...document.querySelectorAll('.el-dialog')].find(d=>/编辑功能名/.test(txt(d.querySelector('.el-dialog__title')))); const inp=rdlg?rdlg.querySelector('.el-input__inner, input'):null; if(!inp)return 'no-input';
      const setNative=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set; setNative.call(inp,'${NEWNAME}'); inp.dispatchEvent(new Event('input',{bubbles:true})); await wait(200);
      const saveBtn=[...rdlg.querySelectorAll('button')].find(b=>/保存/.test(txt(b))); if(!saveBtn)return 'no-savebtn'; saveBtn.click();
      await wait(2800); return 'triggered'; })()`;
    const r = await send("Runtime.evaluate", { expression: expr, awaitPromise: true, returnByValue: true });
    const trig = r.result?.result?.value;
    await new Promise(z => setTimeout(z, 600));
    const prdFile = path.join(ARCHIVE, "PRD-" + TESTNAME + ".md");
    const written = fs.existsSync(prdFile);
    const hasName = written && fs.readFileSync(prdFile, "utf8").includes(NEWNAME);
    console.log("\n════════ 保存即同步 集成测试 ════════");
    console.log((trig === 'triggered' ? "  ✓ " : "  ✗ ") + "浏览器触发改名保存  〔" + trig + "〕");
    console.log((written ? "  ✓ " : "  ✗ ") + "本地 PRD 文件被自动写出");
    console.log((hasName ? "  ✓ " : "  ✗ ") + "PRD 内容含改后的功能名「" + NEWNAME + "」");
    const pass = trig === 'triggered' && written && hasName;
    console.log("──────────────────────────────");
    console.log(pass ? "  通过 PASS ✅" : "  失败 FAIL ❌");
    console.log("════════════════════════════════\n");
    // 清理测试产物
    try { fs.unlinkSync(prdFile); } catch (e) {}
    try { fs.unlinkSync(path.join(ARCHIVE, "PRD-" + TESTNAME + ".docx")); } catch (e) {}
    ws.close();
    exitCode = pass ? 0 : 1;
  } catch (e) { console.log("✗ 集成测试异常:", e.message); }
  finally {
    try { server.close(); } catch (e) {}
    try { ch.kill(); } catch (e) {}
    try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) {}
    if (hadPrd && fs.existsSync(bak)) { fs.copyFileSync(bak, prdData); fs.unlinkSync(bak); }
    else { try { fs.unlinkSync(prdData); } catch (e) {} }  // 测试新建的 prd-data 删掉
    process.exit(exitCode);
  }
})();
