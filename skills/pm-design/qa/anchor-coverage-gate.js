/* ════════════════════════════════════════════════════════════════════════
   场景2 锚点覆盖闸 · anchor-coverage-gate.js · 维护者验收（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   目的：机器量出"场景2（完全不圈选·纯对话框生成 PRD→自动同步到原型对应功能点）"能不能成立。
   判据：prd-data 里【每个功能点 fpKey】，在原型【运行时 DOM】里都能找到一个
        data-annotation="<fpKey>" 的锚点 → 纯对话框注入才能精准贴上去建 pin（无需先圈选）。
   —— 全绿 = 场景2 从空白原型也成立；缺锚点 = 那些功能点只能靠先圈选（场景1）才放得上。
   做法（复用本机 Chrome dump-dom·零 npm）：headless 渲染原型 → 抓所有 data-annotation 值 →
        与 prd-data fpKeys 逐个比对。多视图原型：默认视图 + 各视图 tab 若为 v-show 则一并在 DOM。
   ★ 达标途径（不是手工补锚点=老路，而是结构生成）：原型【生成器/装配器/渲染器】在画原型时，
     给每个功能点元素天生埋 data-annotation=其 fpKey。本闸是该能力的验收线。
   用法：node anchor-coverage-gate.js [原型.html] [prd-data.json]（不给则按当前工程自动配对）
   退出码：0=100% 覆盖(场景2成立) 1=有功能点缺锚点。默认【不并入 deliver-gate】(客户交付不因场景2未完而红)；
          装配器达标后再并入。
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs"), path = require("path"), os = require("os");
const { execFileSync } = require("child_process");
const { findChrome, primaryTarget, findPrdData, findArchive } = require("./_gate-env");

const t = primaryTarget();
const protoPath = (process.argv[2] && fs.existsSync(process.argv[2])) ? process.argv[2] : t.prototype;
const prdPath = (process.argv[3] && fs.existsSync(process.argv[3])) ? process.argv[3] : (t.prdData || findPrdData());

if (!prdPath || !fs.existsSync(prdPath)) { console.log("\n════ 场景2锚点覆盖闸 ════\n  无 prd-data.json（跳过）\n════════════════════"); process.exit(0); }
if (!protoPath || !fs.existsSync(protoPath)) { console.log("\n════ 场景2锚点覆盖闸 ════\n  无匹配原型（跳过）\n════════════════════"); process.exit(0); }

const prd = JSON.parse(fs.readFileSync(prdPath, "utf8").replace(/^﻿/, ""));
const fps = Object.keys(prd.function_points || {});
if (!fps.length) { console.log("\n════ 场景2锚点覆盖闸 ════\n  prd-data 无功能点（跳过）\n════════════════════"); process.exit(0); }

const CHROME = findChrome();
if (!CHROME) { console.log("\n════ 场景2锚点覆盖闸 ════\n  未找到 Chrome（跳过·装 Chrome 后可验）\n════════════════════"); process.exit(0); }

// headless dump-dom 抓运行时 data-annotation 值
const ud = path.join(os.tmpdir(), "anchorcov_prof_" + process.pid);
const uri = "file:///" + protoPath.split("\\").join("/");
let dom = "";
try {
  dom = execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run",
    `--user-data-dir=${ud}`, "--hide-scrollbars", "--virtual-time-budget=6000", "--dump-dom", uri],
    { timeout: 45000, maxBuffer: 128 * 1024 * 1024 }).toString();
} catch (e) { console.log("  ✗ 渲染原型失败：" + e.message); process.exit(1); }
finally { try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) {} }

const anchors = new Set();
for (const m of dom.matchAll(/data-annotation="([^"]+)"/g)) anchors.add(m[1]);

const missing = fps.filter(k => !anchors.has(k));
const covered = fps.length - missing.length;

console.log("\n════════ 场景2 锚点覆盖闸（纯对话框·空白原型建功能）════════");
console.log(`  原型：${path.basename(protoPath)}`);
console.log(`  运行时锚点数：${anchors.size}　功能点数：${fps.length}`);
console.log(`  覆盖：${covered}/${fps.length} 个功能点有匹配 fpKey 锚点`);
if (missing.length) {
  console.log("  ✗ 缺锚点（场景2 从空白放不上·只能先圈选）：");
  missing.forEach(k => console.log("      - " + k));
  console.log("  ──────────────────────────");
  console.log(`  场景2 未全覆盖 ❌ —— 达标途径=【生成器/装配器给每个功能元素天生埋 data-annotation=fpKey】(勿手工补=老路)`);
  console.log("════════════════════════════════════════════");
  process.exit(1);
}
console.log("  ✅ 每个功能点都有匹配锚点 → 场景2 从空白原型也成立（纯对话框可精准建 pin）");
console.log("════════════════════════════════════════════");
process.exit(0);
