/* ════════════════════════════════════════════════════════════════════════
   功能名忠实闸 ⑲ · prd-name-fidelity-gate.js
   ────────────────────────────────────────────────────────────────────────
   专治 AI 自作主张【改名/缩写/优化/提炼】功能名（用户铁律：功能名一字照圈选清单）。
   真值来源 = 原型 __USER_ANNOTATIONS__ 里每个 pin 的 zoneContext.zoneLabel——
   这是用户【圈选那一刻从真实 DOM 抓的标签】，注入(_annoInjectPins line731-737)只覆写
   title/fieldSpecs，绝不碰 zoneContext，所以 zoneLabel 是【独立、非循环】的圈选原名。
   逻辑：对每个带 fpKey 且 zoneLabel 有意义的 pin，去前缀得圈选原名 N，
        比对 prd-data.function_points[fpKey].fp_name（F）；N≠F → 红（改名）。
   实例：pin{fpKey:"充值管理-OMS.充值", zoneLabel:"按钮：充值"} → N="充值"；
        若 PRD 里写成"改名验证X"/把"账户余额 (CNY)"写成"账户余额" → 当场判红。
   不误报：zoneLabel 空/泛化(功能区/此区域/功能)、或该 fpKey 在 prd-data 无对应 → 跳过。
   局限(诚实)：纯对话框注入、之前没右键圈选过的 pin，其 zoneLabel=注入标题(循环)，本闸抓不到。
   定位：随包发；deliver-gate + Stop 钩子都跑，画新原型/别人装包自动受保护。
   用法：node prd-name-fidelity-gate.js [原型.html] [prd-data.json]（不给则按 system_name 自动配对 archive）
   退出码：0=无改名/无法核验 1=发现改名
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs"), path = require("path");

function findArchive() {
  if (process.env.ANNO_ARCHIVE && fs.existsSync(process.env.ANNO_ARCHIVE)) return process.env.ANNO_ARCHIVE;
  for (const c of [path.join(__dirname, "../../../../archive"), path.join(process.cwd(), "archive")]) if (fs.existsSync(c)) return c;
  return null;
}
const arch = findArchive();
let protoPath = process.argv[2], prdPath = process.argv[3];
if (!prdPath && arch && fs.existsSync(path.join(arch, "prd-data.json"))) prdPath = path.join(arch, "prd-data.json");
if (!prdPath || !fs.existsSync(prdPath)) { console.log("\n════ 功能名忠实闸 ⑲ ════\n  无 prd-data.json（跳过）\n════════════════════════"); process.exit(0); }
const prd = JSON.parse(fs.readFileSync(prdPath, "utf8").replace(/^﻿/, ""));
const sysName = prd.system_name || "";
const fps = prd.function_points || {};
if (!Object.keys(fps).length) { console.log("\n════ 功能名忠实闸 ⑲ ════\n  prd-data 无功能点（跳过）\n════════════════════════"); process.exit(0); }

// 按 system_name 配对原型（优先 offline，排除分享版/备份）——与 ⑫ 同口径
if (!protoPath && arch) {
  const cands = fs.readdirSync(arch).filter(f => f.endsWith(".html") && !/分享版|备份|\.bak|backup|BACKUP/i.test(f));
  let best = null;
  for (const f of cands) {
    let h; try { h = fs.readFileSync(path.join(arch, f), "utf8"); } catch (e) { continue; }
    const mm = h.match(/"system_name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (mm && mm[1] === sysName) { const off = /offline/i.test(f); if (!best || (off && !best.off)) best = { f, off }; }
  }
  if (best) protoPath = path.join(arch, best.f);
}
if (!protoPath || !fs.existsSync(protoPath)) { console.log(`\n════ 功能名忠实闸 ⑲ ════\n  无与「${sysName}」匹配的原型（PRD-only，跳过）\n════════════════════════`); process.exit(0); }
const html = fs.readFileSync(protoPath, "utf8");

// 提取 __USER_ANNOTATIONS__（带引号感知的括号配平，防 JSON 内含 "];"）
function extractArray(text, marker) {
  const i = text.indexOf(marker); if (i < 0) return null;
  const s = text.indexOf("[", i); if (s < 0) return null;
  let depth = 0, inStr = false, esc = false;
  for (let j = s; j < text.length; j++) {
    const c = text[j];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]") { depth--; if (depth === 0) return text.slice(s, j + 1); }
  }
  return null;
}
const raw = extractArray(html, "window.__USER_ANNOTATIONS__");
let pins = [];
if (raw) { try { pins = JSON.parse(raw); } catch (e) { pins = []; } }
if (!Array.isArray(pins) || !pins.length) {
  console.log("\n════ 功能名忠实闸 ⑲ ════\n  原型无已存标注(__USER_ANNOTATIONS__ 空)——无独立圈选真值可核（跳过）\n════════════════════════");
  process.exit(0);
}

// 去前缀 + 归一（仅去空白，保留括注/斜杠——一字照圈选）
const PREFIX = /^\s*(功能[点区]|按钮|标签页|页签|状态|操作|字段|区域|功能)\s*[：:]\s*/;
const GENERIC = new Set(["功能区", "功能点", "此区域", "功能", "区域", ""]);
const strip = s => String(s || "").replace(PREFIX, "").trim();
const norm = s => String(s || "").replace(/[\s　]+/g, "").trim();

const renamed = [];
let checked = 0;
for (const p of pins) {
  const zc = p.zoneContext || {};
  const fpKey = zc.fpKey || p.boundFp || "";
  if (!fpKey) continue;
  const fp = fps[fpKey];
  if (!fp || !fp.fp_name) continue;            // prd-data 无此功能点 → 跳过
  if (p.isAIDraft === false) continue;          // 用户已接管该名字(改名/编辑过)→用户编辑优先，⑲不约束用户合法改名，只管AI草稿
  const zoneName = strip(zc.zoneLabel);
  if (GENERIC.has(zoneName)) continue;          // 泛化标签无法核验 → 跳过(不误报)
  checked++;
  if (norm(zoneName) !== norm(fp.fp_name)) {
    renamed.push({ fpKey, 圈选原名: zoneName, PRD里写成: fp.fp_name });
  }
}

console.log("\n════════ 功能名忠实闸 ⑲（禁改名·一字照圈选）════════");
console.log(`  原型：${path.basename(protoPath)}　可核验功能点：${checked} 个`);
if (renamed.length) {
  for (const r of renamed) console.log(`  ✗ 改名：${r.fpKey}\n      圈选原名【${r.圈选原名}】 → PRD 里写成【${r.PRD里写成}】（必须一字照圈选原名）`);
  console.log("──────────────────────────");
  console.log(`  发现 ${renamed.length} 处改名 FAIL ❌ —— 功能名禁缩写/优化/提炼，照圈选 zoneLabel 原文`);
  console.log("════════════════════════════");
  process.exit(1);
}
console.log("  ✓ 所有可核验功能名与圈选原名一字一致 PASS ✅");
console.log("════════════════════════════");
process.exit(0);
