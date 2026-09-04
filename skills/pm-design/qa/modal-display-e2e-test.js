/* ════════════════════════════════════════════════════════════════════════
   标注弹窗显示端到端闸 · modal-display-e2e-test.js · 维护者 QA 工具（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   守"功能点标注弹窗必须显示出 __PRD_DATA__ 里的真实字段规范 / 用例规则"。
   过去 bug：anno-server 写的是 _draft_fieldSpecs / _draft_useCaseRules（文本），
   而弹窗只读旧结构化 field_specs.groups / use_cases.* → fieldGroups/ucSections 全空 → 弹窗空白。

   本闸真测"用户可见显示"，不是只测函数：
     1. node http 静态 serve 整份 offline 原型（用 http 跑，规避 file:// localStorage 隔离）。
     2. headless Chrome (CDP) 打开 → 等双 Vue 实例挂载。
     3. CDP 往 localStorage(anno-pins-v2) 注入一个绑定 充值管理-OMS.充值 的 pin
        （pin 自身 fieldSpecs/useCaseRules 留空，模拟"待生成"）→ reload。
     4. 把标注视图切到 OMS-recharge-form + 开标注 → 真实点击 pin 徽标打开弹窗。
     5. 断言弹窗 DOM 文本包含来自 __PRD_DATA__ 的真实内容：
        字段规范：付款方式 / 充值金额    用例规则：前置条件 / 待审核 / 操作日志。
        任一缺失 = 闸红（退出码 1）。

   用法：node modal-display-e2e-test.js
   CHROME_PATH 可覆盖 Chrome 路径；TARGET_HTML 可覆盖被测原型路径。退出码 0=绿 1=红。
   ════════════════════════════════════════════════════════════════════════ */
const path = require("path"), fs = require("fs"), http = require("http"), os = require("os"), { spawn } = require("child_process");
const { findChrome, REFERENCE_PROTOTYPE } = require("./_gate-env");

const TARGET = process.env.TARGET_HTML || REFERENCE_PROTOTYPE;
const CHROME = process.env.CHROME_PATH || findChrome();
const PORT = 8941, DPORT = 9481;

const BOUND_FP = "充值管理-OMS.充值";
// 这些字符串必须来自 __PRD_DATA__.function_points[BOUND_FP]._draft_*，pin 自身不含它们
const MUST_FIELD = ["付款方式", "充值金额"];          // 字段规范 tab
const MUST_UC    = ["前置条件", "待审核", "操作日志"]; // 用例规则 tab

// ★ 自带 fixture：闸自己往 __PRD_DATA__ 注入这个 fp 内容，不依赖线上 prd-data（线上可被合法清空）。
//   字段规范 = 5 列 md 表格（含付款方式/充值金额）；用例规则 = • 7 节文本（含前置条件/待审核/操作日志）。
const FIXTURE_FS = "| 字段名称 | 类型 | 是否必填/必选 | 默认值 | 约束规则 |\n|---|---|---|---|---|\n| 付款方式 | 下拉选择 | 是 | 空 | 仅可选转账 |\n| 充值金额 | 金额 | 是 | 无 | 大于0，最多两位小数 |";
const FIXTURE_UC = "• 前置条件：用户已登录并有权限\n• 操作流程：\n  1、点击充值\n  2、提交\n• 后置条件：生成一条待审核充值单\n• 校验规则：金额大于0\n• 提示消息：无。\n• 消息通知：无。\n• 操作日志：记录操作时间、操作账号、操作模块、操作功能、操作明细、IP地址。";

(async () => {
  if (!TARGET) { console.log("✗ 未在 archive 找到标注原型（含 window.__PRD_DATA__ + anno-app 的 .html）"); process.exit(1); }
  if (!CHROME) { console.log("✗ 未找到 Chrome/Edge，可用 CHROME_PATH 指定"); process.exit(1); }
  if (!fs.existsSync(TARGET)) { console.log("✗ 找不到被测原型：" + TARGET); process.exit(1); }
  const html = fs.readFileSync(TARGET);

  // ── 1. 静态 serve 整份原型 ──
  const server = http.createServer((req, rq) => {
    rq.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    rq.end(html);
  });
  await new Promise(r => server.listen(PORT, r));

  const ud = path.join(os.tmpdir(), "modalgate_" + process.pid);
  const ch = spawn(CHROME, ["--headless=new", "--disable-gpu", "--no-first-run",
    "--remote-debugging-port=" + DPORT, "--user-data-dir=" + ud, "about:blank"]);

  let fieldText = "", ucText = "", err = "", titleIconSvg = false, renameTopOk = false, renameTopDetail = "";
  try {
    // ── 2. 连 CDP ──
    let page = null;
    for (let i = 0; i < 50; i++) {
      try { const r = await fetch(`http://localhost:${DPORT}/json/list`); const l = await r.json(); page = l.find(t => t.type === "page"); if (page) break; } catch (e) {}
      await new Promise(z => setTimeout(z, 200));
    }
    if (!page) throw new Error("CDP 无 page");
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pending = {};
    ws.onmessage = (m) => { const d = JSON.parse(m.data); if (d.id && pending[d.id]) { pending[d.id](d); delete pending[d.id]; } };
    const send = (method, params = {}) => new Promise(res => { const mid = ++id; pending[mid] = res; ws.send(JSON.stringify({ id: mid, method, params })); });
    const evalJs = async (expr) => {
      const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
      const det = (r.result && r.result.exceptionDetails) || r.exceptionDetails;
      if (det) throw new Error("EVAL: " + ((det.exception && det.exception.description) || JSON.stringify(det)));
      return r.result && r.result.result ? r.result.result.value : undefined;
    };
    // 轮询某 JS 表达式为 true（offline 单文件巨大，headless 首屏需 ~12s）
    const waitFor = async (expr, tries = 120, gap = 400) => {
      for (let i = 0; i < tries; i++) { try { if (await evalJs(expr) === true) return true; } catch (e) {} await new Promise(z => setTimeout(z, gap)); }
      return false;
    };

    await send("Page.enable"); await send("Runtime.enable");

    // ── 首次导航：等标注层就绪（window.__anno 为 object 时双 Vue 实例已挂载、_loadPins 已跑）──
    await send("Page.navigate", { url: `http://localhost:${PORT}/` });
    if (!await waitFor(`typeof window.__anno==='object'`)) throw new Error("首次加载：标注层(window.__anno)未就绪");

    // ── 3. 注入一个"待生成"pin（自身 fieldSpecs/useCaseRules 留空）→ reload ──
    const injectPin = {
      id: "gate-pin-1", number: 99, pageKey: "OMS-recharge-form",
      boundFp: BOUND_FP, title: "功能点：充值",
      fieldSpecs: "", useCaseRules: "",
      x: 200, y: 200, docX: 200, docY: 200, vx: 0.2, vy: 0.2,
    };
    await evalJs(`localStorage.setItem('anno-pins-v2', ${JSON.stringify(JSON.stringify([injectPin]))})`);
    await send("Page.navigate", { url: `http://localhost:${PORT}/` });
    if (!await waitFor(`typeof window.__anno==='object'`)) throw new Error("reload 后：标注层(window.__anno)未就绪");

    // ── 3.5 自注入 fp fixture：mutate window.__PRD_DATA__.function_points（PRD 是其活引用，弹窗会读到）──
    const injected = await evalJs(`(function(){
      var p = window.__PRD_DATA__; if(!p) return false;
      p.function_points = p.function_points || {};
      p.function_points[${JSON.stringify(BOUND_FP)}] = {
        fp_name:'充值', menu_name:'充值管理', system:'OMS',
        menu_path:['财务','财务管理','充值管理'], page_key:'OMS-recharge-form', img:'无',
        _draft_fieldSpecs:${JSON.stringify(FIXTURE_FS)}, _draft_useCaseRules:${JSON.stringify(FIXTURE_UC)}
      };
      return !!p.function_points[${JSON.stringify(BOUND_FP)}]._draft_fieldSpecs;
    })()`);
    if (!injected) throw new Error("fixture 注入失败（window.__PRD_DATA__ 不可用）");

    // ── 4. 切到 pin 视图 + 开标注 → 等 pin 徽标渲染 → 真实点击打开弹窗（纯 DOM，走 openPinPop）──
    await evalJs(`(function(){ try{ window.__annoSetView && window.__annoSetView('OMS','recharge-form'); }catch(e){} try{ window.__anno.toggleShow(true); }catch(e){} return true; })()`);
    if (!await waitFor(`!!document.querySelector('#anno-app .anno-pin')`, 40, 300))
      throw new Error("pin 徽标未渲染（视图过滤或 _loadPins 未生效）");

    const clicked = await evalJs(`(function(){
      var el = document.querySelector('#anno-app .anno-pin');
      if(!el) return 'NO-PIN';
      el.dispatchEvent(new MouseEvent('click', {bubbles:true, cancelable:true, view:window}));
      return 'CLICKED';
    })()`);
    if (clicked !== "CLICKED") throw new Error("点击 pin 失败：" + clicked);
    if (!await waitFor(`!!document.querySelector('#anno-app .pin-modal')`, 30, 200))
      throw new Error("弹窗未打开（.pin-modal 不存在）");

    // 弹窗标题"功能点标注·XX"后的编辑图标必须真渲染出 svg（in-DOM PascalCase 组件不会渲染→无 svg）
    titleIconSvg = await evalJs(`!!document.querySelector('#anno-app .pin-modal .fn-edit-btn svg')`);

    // ── 5. 真实点击 tab + 读弹窗 DOM 文本（用户可见显示）──
    const clickTab = (label) => evalJs(`(function(){
      var tabs = [].slice.call(document.querySelectorAll('#anno-app .pin-modal-tab'));
      var t = tabs.find(function(x){ return x.innerText.indexOf(${JSON.stringify(label)})>=0; });
      if(t){ t.click(); return true; } return false;
    })()`);
    const modalText = () => evalJs(`(function(){ var m=document.querySelector('#anno-app .pin-modal'); return m?m.innerText:'NO-MODAL'; })()`);

    await clickTab("字段规范"); await new Promise(z => setTimeout(z, 400));
    fieldText = await modalText();
    await clickTab("用例规则"); await new Promise(z => setTimeout(z, 400));
    ucText = await modalText();
    // 验"编辑功能名"弹窗压在 pin 弹窗之上且真可点（z-index>pin-modal；elementFromPoint 验不被遮）
    const rt = await evalJs(`(function(){
      var btn=document.querySelector('#anno-app .pin-modal .fn-edit-btn'); if(!btn) return 'NO-BTN'; btn.click();
      return new Promise(function(res){ setTimeout(function(){
        var ov=document.querySelector('.anno-rename-top'); if(!ov) return res('NO-DLG');
        var inp=ov.querySelector('input'); if(!inp) return res('NO-INPUT');
        var r=inp.getBoundingClientRect(), cx=r.left+r.width/2, cy=r.top+r.height/2;
        var top=document.elementFromPoint(cx,cy), inside=!!(top&&ov.contains(top));
        var pm=document.querySelector('.pin-modal');
        var ovz=parseInt(getComputedStyle(ov).zIndex)||0, pmz=pm?(parseInt(getComputedStyle(pm).zIndex)||0):0;
        res(JSON.stringify({inside:inside, ovz:ovz, pmz:pmz, ok:(inside&&ovz>pmz)}));
      },500); });
    })()`);
    try { const o = JSON.parse(rt); renameTopOk = o.ok; renameTopDetail = 'z' + o.ovz + '>pin' + o.pmz + ' 可点=' + o.inside; } catch (e) { renameTopDetail = String(rt); }
    ws.close();
  } catch (e) { err = e.message; }

  ch.kill(); server.close(); try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) {}

  // ── 断言 ──
  console.log("\n════════ 标注弹窗显示 端到端闸 ════════");
  if (err) { console.log("  ✗ 运行异常：" + err); console.log("════════════════════════════════\n"); process.exit(1); }

  const fieldMiss = MUST_FIELD.filter(k => !(fieldText || "").includes(k));
  const ucMiss    = MUST_UC.filter(k => !(ucText || "").includes(k));

  console.log("  字段规范 tab 文本长度 " + (fieldText || "").length + "；用例规则 tab 文本长度 " + (ucText || "").length);
  MUST_FIELD.forEach(k => console.log((fieldText.includes(k) ? "  ✓ " : "  ✗ ") + "字段规范含「" + k + "」"));
  MUST_UC.forEach(k => console.log((ucText.includes(k) ? "  ✓ " : "  ✗ ") + "用例规则含「" + k + "」"));
  console.log((titleIconSvg ? "  ✓ " : "  ✗ ") + "弹窗标题编辑图标可见(有svg)");
  console.log((renameTopOk ? "  ✓ " : "  ✗ ") + "改名弹窗压在pin弹窗之上且可点  〔" + renameTopDetail + "〕");

  const pass = !fieldMiss.length && !ucMiss.length && titleIconSvg && renameTopOk;
  if (!pass) {
    console.log("\n  ✗ 弹窗未显示出 __PRD_DATA__ 真实内容 —— 缺失：" + [...fieldMiss, ...ucMiss].join("、"));
    console.log("  —— 字段规范 tab 前 200 字：" + JSON.stringify((fieldText || "").slice(0, 200)));
    console.log("  —— 用例规则 tab 前 200 字：" + JSON.stringify((ucText || "").slice(0, 200)));
  }
  console.log(pass ? "  全绿 PASS ✅ 弹窗真显示出真实标注内容" : "  闸红 FAIL ❌");
  console.log("════════════════════════════════\n");
  process.exit(pass ? 0 : 1);
})();
