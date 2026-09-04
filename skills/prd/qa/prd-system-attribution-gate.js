/* ════════════════════════════════════════════════════════════════════════
   ⑱ 系统归属闸 · prd-system-attribution-gate.js · 维护者 QA（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   焊死「禁把功能提炼成"通用"」——每个功能点必须归到它在原型真实所属的系统(OMS/WMS/…)，
   绝不允许落到 anno-server 解析失败时的兜底名「通用」。
   根因：注入 pin 漏传 pageKey → mergePinIntoPrd 解析不出系统 → 兜底 system='通用'(server.js)。
   本闸读 prd-data.json，任一 function_point 的 system 为「通用」/空 即红、禁交付。
   （AI 注入 zone 类功能点时必须传 pageKey="OMS-xxx"/"WMS-xxx" 让系统可解析。）
   退出码：0=全部有真实系统归属 1=有"通用"兜底
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs"), path = require("path");
function findArchive() {
  if (process.env.ARCHIVE_DIR && fs.existsSync(process.env.ARCHIVE_DIR)) return process.env.ARCHIVE_DIR;
  for (const c of [path.join(__dirname, "../../../../archive"), path.join(process.cwd(), "archive")]) if (fs.existsSync(c)) return c;
  return null;
}
const _arch = findArchive();
const pdPath = process.env.TARGET_PRDDATA && fs.existsSync(process.env.TARGET_PRDDATA) ? process.env.TARGET_PRDDATA : (_arch ? path.join(_arch, "prd-data.json") : null);
if (!pdPath || !fs.existsSync(pdPath)) { console.log("\n════════ 系统归属闸 ⑱ ════════\n  无 prd-data.json（跳过）\n════════════════════════════"); process.exit(0); }
let pd;
try { pd = JSON.parse(fs.readFileSync(pdPath, "utf8").replace(/^﻿/, "")); } catch (e) { console.log("✗ prd-data.json 解析失败：" + e.message); process.exit(1); }
const fps = pd.function_points || {};
const keys = Object.keys(fps);
console.log("\n════════ 系统归属闸 ⑱（禁「通用」兜底）════════");
if (!keys.length) { console.log("  prd-data 无功能点（跳过）\n════════════════════════════"); process.exit(0); }

const bad = [];
for (const k of keys) {
  const sys = (fps[k].system || "").trim();
  if (!sys || sys === "通用" || sys === "未知" || sys === "默认") bad.push({ k, sys: sys || "(空)" });
}
for (const k of keys) {
  const sys = (fps[k].system || "").trim();
  if (!bad.find(b => b.k === k)) console.log("  ✓ " + sys + "  " + (fps[k].fp_name || k));
}
bad.forEach(b => console.log("  ✗ 系统归属=「" + b.sys + "」兜底：" + b.k + "  → 注入时漏传 pageKey，须归到原型真实系统(OMS/WMS)"));
console.log("──────────────────────────");
console.log(bad.length ? "  有「通用」兜底 FAIL ❌ —— 每个功能必须归真实系统，禁提炼通用" : "  全部真实系统归属 PASS ✅");
console.log("════════════════════════════");
process.exit(bad.length ? 1 : 0);
