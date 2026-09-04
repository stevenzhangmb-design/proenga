/* ════════════════════════════════════════════════════════════════════════
   Stop 钩子助手 · _stop-hook-check.js · 【工具强制·不归 AI 管】
   ────────────────────────────────────────────────────────────────────────
   用户("现在有规则你也不遵守""怎么约束你")要的彻底约束：靠 AI 自觉无效，
   靠【工具在每次回答后自动跑闸、红了输出 decision:block 拦住"完成"】——AI 跳不过。
   每次 AI 结束(Stop)时本脚本被调用，跑【一组快闸】(file 级·秒级)：
     ⑪ PRD结构  ⑫ PRD↔原型字段一致(防臆造)  ⑱ 系统归属(禁"通用")  ⑰ 原型↔标准件漂移
   任一红 → 输出 {decision:block,reason:红字} 拦住 AI 说"完成/全绿/好了"；全绿则静默放行。
   只查【当前 prd-data.json 对应的那一个 PRD】(按 system_name 配对)，不误拦旧的/无关项目。
   注：UI/浮层类(⑨)、注入回路(⑯)等需无头浏览器的慢闸不在每轮 Stop 跑(太慢)，由 AI 改 UI 时
       按死规矩自跑+截图([[feedback_verify_before_present_hard_gate]])；本钩子兜底结构/臆造/归属/漂移。
   被 settings.local.json 的 Stop 钩子调用：node _stop-hook-check.js
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs"), path = require("path"), cp = require("child_process");
const ARCH = process.env.ANNO_ARCHIVE || path.join(__dirname, "..", "..", "..", "..", "archive");
const PD = path.join(ARCH, "prd-data.json");
const QA = __dirname;                                              // prd/qa
const PMQA = path.join(__dirname, "..", "..", "pm-design", "qa");  // pm-design/qa

const fails = [];
function run(label, file, args) {
  if (!fs.existsSync(file)) return;
  try { cp.execFileSync("node", [file, ...(args || [])], { stdio: "pipe", timeout: 90000 }); }
  catch (e) { const out = e.stdout ? e.stdout.toString() : (e.message || ""); fails.push("【" + label + "】红：\n" + out.slice(-900)); }
}

// 当前项目 PRD（按 system_name 精确配对，避免误拦旧的/无关项目）
let sys = null;
if (fs.existsSync(PD)) { try { sys = JSON.parse(fs.readFileSync(PD, "utf8").replace(/^﻿/, "")).system_name; } catch (e) {} }
const md = sys ? path.join(ARCH, "PRD-" + sys + ".md") : null;

// ⑪ PRD 结构（仅当当前 PRD 存在；刚删/未生成则不查）
if (md && fs.existsSync(md)) run("⑪ PRD结构合规", path.join(QA, "prd-structure-lint.js"), [md]);
// ⑫ PRD↔原型字段一致（防臆造字段）
if (fs.existsSync(PD)) run("⑫ 字段一致(防臆造)", path.join(QA, "prd-prototype-field-gate.js"));
// ⑱ 系统归属（禁"通用"兜底）
if (fs.existsSync(PD)) run("⑱ 系统归属(禁通用)", path.join(QA, "prd-system-attribution-gate.js"));
// ⑲ 功能名忠实（禁改名·一字照圈选 zoneLabel）
if (fs.existsSync(PD)) run("⑲ 功能名忠实(禁改名)", path.join(QA, "prd-name-fidelity-gate.js"));
// ⑰ 原型↔标准件漂移（改了标准件没同步原型即拦）
run("⑰ 原型↔标准件漂移", path.join(PMQA, "prototype-standard-sync-gate.js"));
// ⑳ 原型 pm-design 合规（机器闸·硬锁不可关）——只查"最近 15 分钟内改动的最新原型 HTML"，避免误拦旧文件
try {
  const recent = [];
  (function walk(dir, depth) {
    if (depth > 3) return;
    let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
    for (const e of ents) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (!/node_modules|\.git/.test(e.name)) walk(p, depth + 1); }
      else if (/\.html?$/i.test(e.name)) {
        // 说明文档网页(带 __NOT_A_PROTOTYPE__ 标记)不是 pm-design 原型，跳过——否则文档一改就被当"裸HTML废原型"误拦
        try { if (fs.readFileSync(p, "utf8").includes("__NOT_A_PROTOTYPE__")) continue; } catch (e2) {}
        try { recent.push({ p, m: fs.statSync(p).mtimeMs }); } catch (e2) {}
      }
    }
  })(ARCH, 0);
  const fresh = recent.filter(x => Date.now() - x.m < 15 * 60 * 1000).sort((a, b) => b.m - a.m);
  if (fresh.length) run("⑳ 原型pm-design合规", path.join(PMQA, "prototype-pmdesign-gate.js"), [fresh[0].p]);
  // ㉜ 设计令牌对照（默认原型主色#3363FF/警告#F2AC3A/分页config==规范；自定义规范原型带 __DESIGN_SPEC_CUSTOM__ 自动豁免）
  if (fresh.length) run("㉜ 设计令牌对照", path.join(PMQA, "design-token-gate.js"), [fresh[0].p]);
  // ㉝ 选择一致性（原型 == 三问所选 __DESIGN_CHOICE__：币种/前端栈/语言；无标记的旧原型自动跳过）
  if (fresh.length) run("㉝ 选择一致性", path.join(PMQA, "choice-conformance-gate.js"), [fresh[0].p]);
} catch (e) {}

if (fails.length) {
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: "❌ 机器闸红了 " + fails.length + " 道——你【必须】先逐条修到全绿，禁止现在说\"完成/全绿/好了\"。修完重跑确认再回复用户：\n\n" + fails.join("\n\n")
  }));
}
process.exit(0);
