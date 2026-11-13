/* ════════════════════════════════════════════════════════════════════════
   52 浏览器闸必须隔离真 anno-server(3799) · anno-isolation-gate.js · 2026-11-13
   ────────────────────────────────────────────────────────────────────────
   事故：②regression-check、㊱full-interaction-regression 用无头浏览器打开原型时没拦 3799，
   标注层加载后 1.5 秒去抖 POST /anno-persist → 本机真 anno-server 把闸的测试标注烤回
   archive\原型-海外仓财务-充值管理-装配版-…-offline.html（非原子写）——每跑一次总闸就改写用户真实原型，
   同时在读它的 ⑦⑨㉛㊱ 读到半截文件。
   本闸：纯静态扫 pm-design/qa、prd/qa 下所有会让浏览器导航（Page.navigate / Target.createTarget）的脚本，
   必须满足其一，否则红：
     ① 调了 isolateAnnoServer(…)（_anno-isolate.js：3799 改到死端口或闸自己的临时实例）；
     ② 自带 addScriptToEvaluateOnNewDocument 注入，把 window.fetch 里的 localhost:3799 拦掉/重定向。
   并且隔离调用必须出现在文件里第一次【真正调用】Page.navigate 之前（注入要在页面加载前生效）。
   豁免：sync-integration-test.js（故意连真实例，未挂总闸，只手动跑，文件头已写明会污染）。
   只读源码、不开浏览器、不写文件 → 进总闸 S 纯静态池。
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs"), path = require("path");
const QA = __dirname;
const DIRS = [QA, path.join(QA, "..", "..", "prd", "qa")];
const EXEMPT = new Set(["sync-integration-test.js", "_anno-isolate.js", "anno-isolation-gate.js"]);
const NAV = /\.?send\(\s*['"](?:Page\.navigate|Target\.createTarget)['"]/;
const HELPER = /isolateAnnoServer\s*\(/;
const INLINE = /addScriptToEvaluateOnNewDocument[\s\S]{0,800}?window\.fetch\s*=[\s\S]{0,600}?localhost:3799/;

const bad = [], ok = [];
for (const d of DIRS) {
  let files = [];
  try { files = fs.readdirSync(d).filter(f => f.endsWith(".js")); } catch (_) { continue; }
  for (const f of files) {
    if (EXEMPT.has(f)) continue;
    const src = fs.readFileSync(path.join(d, f), "utf8");
    const m = NAV.exec(src);
    if (!m) continue;
    const rel = path.relative(path.join(QA, "..", ".."), path.join(d, f)).replace(/\\/g, "/");
    const h = HELPER.exec(src), i = INLINE.exec(src);
    if (!h && !i) { bad.push(rel + "：打开浏览器却没隔离 3799（接 require('./_anno-isolate').isolateAnnoServer(send)）"); continue; }
    /* 顺序：取第一次【调用】导航的位置；跳过 `const navigate = async u => { await send('Page.navigate'…` 这种辅助函数定义体（定义不等于调用）。 */
    const isoAt = Math.min(h ? h.index : Infinity, i ? i.index : Infinity);
    const navCalls = [...src.matchAll(/await\s+[\w.]*send\(\s*['"]Page\.navigate['"]|await\s+[\w.]*navigate\(/g)].map(x => x.index)
      .filter(at => !/=>\s*\{\s*$/.test(src.slice(Math.max(0, at - 60), at)));
    const firstCall = navCalls.length ? navCalls[0] : m.index;
    if (isoAt > firstCall) { bad.push(rel + "：隔离写在第一次 Page.navigate 之后（要在页面加载前注入）"); continue; }
    ok.push(rel);
  }
}
console.log("════════ 52 浏览器闸隔离真 anno-server(3799) ════════");
ok.forEach(x => console.log("  ✓ " + x));
bad.forEach(x => console.log("  ✗ " + x));
console.log(bad.length ? "  FAIL ❌ " + bad.length + " 个脚本会让真 anno-server 改写用户原型" : "  PASS ✅ " + ok.length + " 个开浏览器的脚本全部隔离 3799");
process.exit(bad.length ? 1 : 0);
