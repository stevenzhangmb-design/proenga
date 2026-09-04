/* ════════════════════════════════════════════════════════════════════════
   共享生成器同步闸  ·  shared-generator-sync-test.js  ·  维护者 QA 工具（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   守"单一来源不漂移"：比对三方 §4.4 输出必须【完全一致】——
     A = server.js 原生 buildFpSections
     B = prd-generator.js 派生（供浏览器/AI 用）
     C = prd-generator.js 在【浏览器】里跑（证 isomorphic）
   若 server.js 改了生成器却没重跑 build-shared-generator.js → A≠B → 本闸红。
   anno-server 路径默认 = ai-rules 同级；可用 ANNO_SERVER 覆盖。退出码 0=一致 1=漂移。
   ════════════════════════════════════════════════════════════════════════ */
const path=require("path"),fs=require("fs"),http=require("http"),os=require("os"),{spawn}=require("child_process");
const { findChrome }=require("./_gate-env");
const ANNO=process.env.ANNO_SERVER || path.join(__dirname,"../../../../anno-server");
const SERVER=path.join(ANNO,"server.js"), GEN=path.join(ANNO,"prd-generator.js");
const CHROME=process.env.CHROME_PATH || findChrome();
const PORT=8932, DPORT=9472;
const testData={ system_name:"同步闸测试", function_points:{
  "充值管理-OMS.充值":{fp_name:"充值",system:"OMS",menu_path:["财务","财务管理","充值管理"],img:"IMG-01",_draft_fieldSpecs:"| 字段 |\n|---|\n| 金额 |",_draft_useCaseRules:"• 前置：已登录"},
  "充值管理-OMS.查询":{fp_name:"查询",system:"OMS",menu_path:["财务","财务管理","充值管理"],img:"无",_draft_useCaseRules:"• 前置：已登录"},
  "账户余额-WMS.查看":{fp_name:"查看",system:"WMS",menu_path:["财务","财务管理","账户余额"],img:"无",_draft_useCaseRules:"• 前置：已登录"},
  "钱包-APP.充值":{fp_name:"充值",system:"APP客户端",menu_path:["我的","钱包"],img:"无",_draft_useCaseRules:"•"},
  "钱包-小程序.充值":{fp_name:"充值",system:"小程序",menu_path:["钱包页"],img:"无",_draft_useCaseRules:"•"},
}, system_order:["OMS","WMS","APP客户端","小程序"] };
(async()=>{
  if(!fs.existsSync(GEN)){ console.log("✗ 缺 prd-generator.js，先跑 anno-server/build-shared-generator.js"); process.exit(1); }
  const A = require(SERVER).buildFpSections(testData);
  const B = require(GEN).buildFpSections(testData);
  // 浏览器跑派生模块
  const ROOT=path.dirname(GEN);
  const server=http.createServer((req,rq)=>{ if(req.url.indexOf("prd-generator.js")>=0){ rq.writeHead(200,{"Content-Type":"text/javascript; charset=utf-8"}); rq.end(fs.readFileSync(GEN)); return; }
    rq.writeHead(200,{"Content-Type":"text/html; charset=utf-8"}); rq.end('<!DOCTYPE html><meta charset=utf-8><script src="/prd-generator.js"></script>'); });
  await new Promise(r=>server.listen(PORT,r));
  const ud=path.join(os.tmpdir(),"syncgate_"+process.pid);
  const ch=spawn(CHROME,["--headless=new","--disable-gpu","--no-first-run","--remote-debugging-port="+DPORT,"--user-data-dir="+ud,"about:blank"]);
  let C="EVAL-ERR";
  try{
    let page=null; for(let i=0;i<50;i++){ try{const r=await fetch(`http://localhost:${DPORT}/json/list`);const l=await r.json();page=l.find(t=>t.type==="page");if(page)break;}catch(e){} await new Promise(z=>setTimeout(z,200)); }
    const ws=new WebSocket(page.webSocketDebuggerUrl); await new Promise((res,rej)=>{ws.onopen=res;ws.onerror=rej;});
    let id=0;const pending={}; ws.onmessage=(m)=>{const d=JSON.parse(m.data); if(d.id&&pending[d.id]){pending[d.id](d);delete pending[d.id];}};
    const send=(method,params={})=>new Promise(res=>{const mid=++id;pending[mid]=res;ws.send(JSON.stringify({id:mid,method,params}));});
    await send("Page.enable"); await send("Runtime.enable"); await send("Page.navigate",{url:`http://localhost:${PORT}/`});
    await new Promise(z=>setTimeout(z,1200));
    const r=await send("Runtime.evaluate",{expression:`(function(){var d=${JSON.stringify(testData)}; return (window.prdGenerator&&window.prdGenerator.buildFpSections)?window.prdGenerator.buildFpSections(d):'NO-GEN';})()`,returnByValue:true});
    C=r.result&&r.result.result?r.result.result.value:"EVAL-ERR"; ws.close();
  }catch(e){ C="ERR:"+e.message; }
  ch.kill(); server.close(); try{fs.rmSync(ud,{recursive:true,force:true});}catch(e){}
  const ab=(A===B), ac=(A===C);
  console.log("\n════════ 共享生成器 同步闸 ════════");
  console.log("  A(server.js原生) "+A.length+" | B(派生) "+B.length+" | C(浏览器) "+(typeof C==='string'?C.length:'?'));
  console.log((ab?"  ✓ ":"  ✗ ")+"A===B  派生忠实于 server.js（没漂移）");
  console.log((ac?"  ✓ ":"  ✗ ")+"A===C  派生在浏览器输出一致（isomorphic）");
  console.log(ab&&ac?"  全绿 PASS ✅":"  漂移 FAIL ❌ —— 改了 server.js 生成器？重跑 build-shared-generator.js");
  console.log("════════════════════════════════\n");
  process.exit(ab&&ac?0:1);
})();
