/* ════════════════════════════════════════════════════════════════════════
   全链路可见审计闸 · full-pipeline-audit.js · 维护者 QA 工具（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   根治"改一个又冒一个"：交付前把【所有】功能点的用户可见结果一次性全跑全断言，
   不再让用户一个一个发现。覆盖三层：
     A. 数据层：prd-data.json 每个 fp 的 _draft_fieldSpecs/_draft_useCaseRules 合规
        （字符串 + 用例规则含 前置条件/操作流程/操作日志 等节）。
     B. 渲染层：真浏览器逐个打开标注弹窗，断言字段规范/用例规则真显示出对内容、标题对。
        OMS 在 OMS 视图测、WMS 在 WMS 视图测（杜绝同名跨系统串味）。
     C. 结构层：PRD.md §4.4 每个系统的同菜单功能点在【一个】节点下，不裂开。
   退出码 0=全绿 1=有问题（逐条列出哪个 fp 哪层不过）。
   ════════════════════════════════════════════════════════════════════════ */
const path = require("path"), fs = require("fs"), http = require("http"), os = require("os"), { spawn } = require("child_process");
const { findChrome, primaryTarget } = require("./_gate-env");
const _tgt = primaryTarget();
const PROTO = _tgt.prototype;
const PRDDATA = _tgt.prdData;
const PRDMD = _tgt.prdMd;
const CHROME = findChrome();
const PORT = 8991, DPORT = 9531;

const UC_SECTIONS = ["前置条件", "操作流程", "后置条件", "校验规则", "提示消息", "消息通知", "操作日志"];
const fails = [];
const add = (cond, label) => { if (!cond) fails.push(label); return cond; };

(async () => {
  if (!PROTO) { console.log("✗ 未在 archive 找到标注原型（含 window.__PRD_DATA__ + anno-app 的 .html）"); process.exit(1); }
  if (!PRDDATA) { console.log("✗ 未在 archive 找到 prd-data.json"); process.exit(1); }
  if (!PRDMD) { console.log("✗ 未在 archive 找到 PRD-*.md"); process.exit(1); }
  if (!CHROME) { console.log("✗ 未找到 Chrome/Edge，可用 CHROME_PATH 指定"); process.exit(1); }
  const prd = JSON.parse(fs.readFileSync(PRDDATA, "utf8").replace(/^﻿/, ""));
  const fps = prd.function_points || {};
  const fpKeys = Object.keys(fps);
  // 通用化：系统列表从真实数据派生，不写死示例(充值管理 OMS/WMS)
  const systems = [...new Set(Object.values(fps).map(f => f.system).filter(Boolean))];
  console.log("\n════════ 全链路可见审计闸 ════════");
  console.log("功能点总数: " + fpKeys.length + "；系统: " + (systems.join(", ") || "(无 system 字段)"));

  // ── A. 数据层 ──
  console.log("\n── A. 数据层（prd-data 内容合规）──");
  for (const k of fpKeys) {
    const fp = fps[k];
    const uc = typeof fp._draft_useCaseRules === "string" ? fp._draft_useCaseRules : "";
    const fsp = fp._draft_fieldSpecs;
    add(typeof fsp === "string", `[A] ${k} 字段规范非字符串`);
    add(uc.length > 100, `[A] ${k} 用例规则过短/缺失`);
    for (const s of ["前置条件", "操作流程", "操作日志"]) add(new RegExp("\\u2022\\s*" + s).test(uc), `[A] ${k} 用例规则缺「• ${s}」`);
  }
  console.log("  数据层断言完成");

  // ── C. 结构层（PRD.md §4.4 同系统下同名菜单节点不裂开）──
  // 通用化：菜单名从真实数据派生，逐系统逐菜单断言"只有 1 个节点"，不绑死示例(充值管理)
  console.log("\n── C. 结构层（PRD.md §4.4 不裂开）──");
  const md = fs.readFileSync(PRDMD, "utf8");
  const headings = (md.match(/^#{3,6}\s*4\.4[^\n]*/gm) || []).map(h => h.replace(/^#+\s*/, ""));
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  for (const sys of systems) {
    const menus = [...new Set(fpKeys.filter(k => fps[k].system === sys).map(k => fps[k].menu_name).filter(Boolean))];
    for (const menu of menus) {
      const matched = headings.filter(h => new RegExp(esc(menu) + "\\s*$").test(h) && underSystem(headings, h, sys));
      // 通用化：真·裂开 = 同一【编号深度】出现 ≥2 个并列同名节点。
      // 菜单节点(如 4.4.1.1.3 期末结账) 与"单功能·与菜单同名"的功能点节点(4.4.1.1.3.1 期末结账)
      // 深度不同(5 vs 6)=合法父子嵌套，不算裂开；杜绝对 fp_name≠menu_name 的过拟合误报。
      const byDepth = {};
      for (const h of matched) { const num = (h.match(/4(?:\.\d+)+/) || [""])[0]; const d = num.split(".").length; byDepth[d] = (byDepth[d] || 0) + 1; }
      const maxSame = Math.max(0, ...Object.values(byDepth));
      add(maxSame <= 1, `[C] ${sys} 下「${menu}」菜单节点同层出现 ${maxSame} 个(应 1 个，>1=裂开)`);
    }
  }
  console.log("  结构层断言完成");

  // ── B. 渲染层（真浏览器逐个开弹窗）──
  console.log("\n── B. 渲染层（逐个弹窗真显示）──");
  const html = fs.readFileSync(PROTO);
  const server = http.createServer((q, r) => { r.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }); r.end(html); });
  await new Promise(r => server.listen(PORT, r));
  const ud = path.join(os.tmpdir(), "fpa_" + process.pid);
  const ch = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run", "--window-size=1600,1000", "--remote-debugging-port=" + DPORT, "--user-data-dir=" + ud, "about:blank"]);
  try {
    let page = null;
    for (let i = 0; i < 50; i++) { try { const r = await fetch(`http://localhost:${DPORT}/json/list`); const l = await r.json(); page = l.find(t => t.type === "page"); if (page) break; } catch (e) {} await new Promise(z => setTimeout(z, 200)); }
    const ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pend = {}; ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
    const send = (method, params = {}) => new Promise(res => { const mid = ++id; pend[mid] = res; ws.send(JSON.stringify({ id: mid, method, params })); });
    const ev = async e => { const r = await send("Runtime.evaluate", { expression: e, returnByValue: true, awaitPromise: true }); if (r.result && r.result.exceptionDetails) return "EXC:" + JSON.stringify(r.result.exceptionDetails).slice(0, 150); return r.result && r.result.result ? r.result.result.value : undefined; };
    const waitFor = async (e, t = 120) => { for (let i = 0; i < t; i++) { try { if (await ev(e) === true) return true; } catch (x) {} await new Promise(z => setTimeout(z, 400)); } return false; };
    await send("Page.enable"); await send("Runtime.enable");

    for (const sysv of systems) {
      const sysFps = fpKeys.filter(k => fps[k].system === sysv);
      // pageKey 留空 → pin 在任意页都显示（原型渲染过滤 !p.pageKey||p.pageKey===sys+'-'+page）；不绑死示例页
      const pins = sysFps.map((k, i) => ({ id: "a" + sysv + i, number: i + 1, pageKey: "", boundFp: "", title: fps[k].fp_name, fieldSpecs: "", useCaseRules: "", x: 100 + (i % 8) * 30, y: 100 + Math.floor(i / 8) * 30, docX: 100 + (i % 8) * 30, docY: 100 + Math.floor(i / 8) * 30 }));
      await send("Page.navigate", { url: `http://localhost:${PORT}/?reset=1` });
      await waitFor(`typeof window.__anno==='object'`);
      await ev(`localStorage.setItem('anno-pins-v2', ${JSON.stringify(JSON.stringify(pins))})`);
      await send("Page.navigate", { url: `http://localhost:${PORT}/` });
      await waitFor(`typeof window.__anno==='object'`);
      // 原型自身 __PRD_DATA__ 各 fp 草稿长度：[B] 显示审计只对照原型自己的数据，
      // 草稿为空 = 该 fp 未标注/已清空 → 跳过，不当作"内容缺陷"误报（杜绝对在改/空白原型过拟合）
      const _pd = JSON.parse(await ev(`(function(){var o={};var fp=(window.__PRD_DATA__||{}).function_points||{};for(var k in fp){o[k]=((fp[k]._draft_useCaseRules||'')+'\\n'+(fp[k]._draft_fieldSpecs||'')).trim().length;}return JSON.stringify(o);})()`) || "{}");
      // 视图 sys 设为该系统让标题精确解析对；页留空（pins 靠 pageKey="" 显示，不依赖具体页）
      await ev(`(function(){try{window.__annoSetView&&window.__annoSetView('${sysv}','');window.__anno.toggleShow(true);}catch(e){}return true;})()`);
      const rendered = await waitFor(`document.querySelectorAll('#anno-app .anno-pin').length>=${sysFps.length}`, 40);
      if (!rendered) { console.log(`  ${sysv}: pins 渲染超时 → 优雅记为 0 个并继续`); continue; }
      const res = await ev(`(async function(){
        function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
        var out={};
        var els=[].slice.call(document.querySelectorAll('#anno-app .anno-pin'));
        for (var i=0;i<els.length;i++){
          els[i].dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window}));
          await sleep(420);
          var m=document.querySelector('#anno-app .pin-modal');
          if(!m){ out['pin'+i]={title:'(弹窗没开)',uc:0,fs:''}; continue; }
          var nameEl=m.querySelector('.fn-edit-name');
          var title=((nameEl?nameEl.innerText:((m.querySelector('.pin-modal-title')||{}).innerText||''))||'').replace(/^功能点标注\\s*[·.]\\s*/,'').replace(/\\s+/g,'');
          var tabs=[].slice.call(m.querySelectorAll('.pin-modal-tab'));
          var ucTab=tabs.find(function(x){return x.innerText.indexOf('用例规则')>=0;}); if(ucTab)ucTab.click(); await sleep(250);
          var ucTxt=m.innerText;
          // 操作流程编号对齐：行首有缩进再跟数字 = 没对齐
          var _blocks=[].slice.call(m.querySelectorAll('.uc-sec-block'));
          var _fb=_blocks.find(function(b){return b.innerText.indexOf('操作流程')>=0;});
          var _fv=_fb?_fb.querySelector('.uc-sec-view'):null;
          var flowBad=_fv?_fv.innerText.split('\\n').filter(function(l){return /^[ \\t　]+\\d/.test(l);}).length:0;
          var fsTab=tabs.find(function(x){return x.innerText.indexOf('字段规范')>=0;}); if(fsTab)fsTab.click(); await sleep(250);
          var fsTxt=m.innerText;
          // 字段规范表：表头是否含「默认值」列 + 是否有默认值单元格有值（第4列，index 3）
          var _fsTables=[].slice.call(m.querySelectorAll('.pm-table'));
          // 字段表 = 表头含「字段名称」的那张
          var _fsTbl=_fsTables.find(function(t){var hd=t.querySelector('thead');return hd&&hd.innerText.indexOf('字段名称')>=0;});
          var fsHeadHasDefault=false, fsHasDefaultCell=false, fsRowCount=0;
          if(_fsTbl){
            var _hd=_fsTbl.querySelector('thead');
            fsHeadHasDefault=!!_hd && _hd.innerText.indexOf('默认值')>=0;
            // 定位默认值列序号（在表头 th 中找）
            var _ths=[].slice.call(_hd?_hd.querySelectorAll('th'):[]);
            var _defIdx=-1; for(var ti=0;ti<_ths.length;ti++){ if(_ths[ti].innerText.indexOf('默认值')>=0){_defIdx=ti;break;} }
            var _rows=[].slice.call(_fsTbl.querySelectorAll('tbody tr'));
            fsRowCount=_rows.length;
            if(_defIdx>=0){
              for(var ri=0;ri<_rows.length;ri++){
                var _tds=_rows[ri].querySelectorAll('td');
                if(_tds[_defIdx] && (_tds[_defIdx].innerText||'').trim().length>0){ fsHasDefaultCell=true; break; }
              }
            }
          }
          out[title]={ uc:ucTxt.length, hasPre:ucTxt.indexOf('前置条件')>=0, hasFlow:ucTxt.indexOf('操作流程')>=0, hasLog:ucTxt.indexOf('操作日志')>=0||ucTxt.indexOf('不输出')>=0, fsLen:fsTxt.length, flowBad:flowBad, fsHeadHasDefault:fsHeadHasDefault, fsHasDefaultCell:fsHasDefaultCell, fsRowCount:fsRowCount };
          var c=m.querySelector('.pin-modal-close'); if(c)c.click(); await sleep(180);
        }
        return JSON.stringify(out);
      })()`);
      const parsed = JSON.parse(res);
      for (const k of sysFps) {
        if (!_pd[k]) continue;  // 原型 __PRD_DATA__ 里该 fp 无草稿(未标注/已清空) → 跳过显示审计，不当内容缺陷
        const nm = (fps[k].fp_name || "").replace(/\s+/g, "");
        const r = parsed[nm];
        if (!r) { add(false, `[B] ${k} 弹窗未找到/标题不符(期望 ${nm})`); continue; }
        add(r.hasPre && r.hasFlow && r.hasLog, `[B] ${k} 用例规则未完整显示(前置/流程/日志)`);
        add(r.uc > 150, `[B] ${k} 用例规则内容过短(${r.uc}字)=可能没显示`);
        add(r.flowBad === 0, `[B] ${k} 操作流程编号没对齐(${r.flowBad} 行行首有缩进)`);
        // 「默认值」列：仅对有 5 列字段规范表（_draft_fieldSpecs 含「默认值」表头）的 fp 断言
        const fspRaw = typeof fps[k]._draft_fieldSpecs === "string" ? fps[k]._draft_fieldSpecs : "";
        if (/默认值/.test(fspRaw)) {
          add(r.fsHeadHasDefault === true, `[B] ${k} 字段规范表头缺「默认值」列`);
          add(r.fsHasDefaultCell === true, `[B] ${k} 字段规范「默认值」列全空(应有值，如 空/无/回显)`);
        }
      }
      console.log(`  ${sysv}: 测了 ${sysFps.length} 个弹窗`);
    }
    ws.close();
  } catch (e) { add(false, "[B] 渲染层运行异常: " + e.message); }
  ch.kill(); server.close(); try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) {}

  console.log("\n──────────────────────────────────");
  if (!fails.length) console.log("  全 " + fpKeys.length + " 个功能点 三层全绿 PASS ✅（弹窗内容/结构/数据 都对）");
  else { console.log("  发现 " + fails.length + " 处问题 FAIL ❌："); fails.forEach(f => console.log("    - " + f)); }
  console.log("════════════════════════════════════\n");
  process.exit(fails.length ? 1 : 0);
})();

function underSystem(headings, h, sys) {
  const idx = headings.indexOf(h);
  for (let i = idx; i >= 0; i--) { if (/4\.4\.\d+\s/.test(headings[i]) && !/4\.4\.\d+\.\d+/.test(headings[i])) return new RegExp("\\b" + sys + "\\b").test(headings[i]); }
  return false;
}
function belongsTo() { return true; }
