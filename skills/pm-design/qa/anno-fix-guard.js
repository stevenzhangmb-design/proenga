/* ════════════════════════════════════════════════════════════════════════
   圈选采集修复·静态防退化守卫  ·  anno-fix-guard.js  ·  维护者 QA（不打包客户）
   ────────────────────────────────────────────────────────────────────────
   用途：把 2026-06-28「圈选采集根治」四件修复焊死——只要有人把标准件
        annotation-layer.html 里的修复代码改回去（marker 消失），本闸立刻红，
        禁止交付。非 behavioral、零 flake，专抓"悄悄退化/被还原"。
   配套：regression-check.js 的「圈选采集完整」断言验真实 DOM 行为；本闸验源码未被还原。
   运行：node anno-fix-guard.js     退出码 0=四项修复都在，1=有项被还原
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs"), path = require("path");
const FILE = path.join(__dirname, "..", "components", "annotation-layer.html");

const src = fs.existsSync(FILE) ? fs.readFileSync(FILE, "utf8") : "";
const checks = [];
const add = (name, ok, why = "") => checks.push({ name, ok: !!ok, why });

if (!src) { console.log("✗ 未找到标准件 annotation-layer.html: " + FILE); process.exit(1); }

// ① 区完整取名：框碰到逻辑区取该区全部同级标题（_ZONE_SEL + z.contains 补齐），不靠像素罩全
add("①区完整取名(_ZONE_SEL + z.contains 补齐)",
  /_ZONE_SEL\s*=/.test(src) && /for\s*\(\s*const\s+z\s+of\s+_zoneSet\s*\)\s*for\s*\(\s*const\s+el\s+of\s+_allTitleEl\s*\)\s*if\s*\(\s*z\.contains\(\s*el\s*\)\s*\)/.test(src),
  "防退回'只取框内'像素全包含");

// ② 字段(zoneTexts)区完整：_zoneSet 全部叶子文本并入
add("②字段采集区完整(_zoneSet 叶子文本并入 fieldTexts)",
  /for\s*\(\s*const\s+z\s+of\s+_zoneSet\s*\)\s*z\.querySelectorAll\([^)]*\)\.forEach[\s\S]{0,200}fieldTexts\.push/.test(src),
  "防字段因框没罩全而漏");

// ③ 复制带身份id + 原型真实内容（名字解耦）：_copyFnList 输出 身份id + zoneTexts 内容
add("③复制带身份id+内容(名字解耦)",
  /身份id/.test(src) && /原型真实内容/.test(src) && /zc\.zoneId/.test(src),
  "防复制退回'只搬名字'");

// ④ 指令头写死"名字仅显示标签"
add("④RULE_HEADER 写死名字仅标签",
  /名字仅显示标签/.test(src),
  "防 AI 照名字猜");

// ⑤ zoneHTML 不截断到 4000（提到 40000）：无残留 4000 采集截断
add("⑤zoneHTML 采集上限 40000(无4000截断残留)",
  /\(0,\s*40000\)/.test(src) && !/\(0,\s*4000\)/.test(src),
  "防大区域 HTML 被切丢内容");

/* ⑥⑦ B架构防复活（2026-07-09）：客户端【绝不生成 PRD 内容】。
   历史：客户端曾内嵌 650 行启发式模板"猜"7 节用例规则 → 质量差、拆东墙补西墙、根本跑不通
        （用户多天实测判死，2026-06-23 拍板改走"圈选只圈范围 + 对话框 AI 真推理"）。
   那 650 行已于 2026-07-09 删除。本两条断言防它以任何形式长回来。 */

// ⑥ genAnnoDraft 必须直接返回空内容（早返回不可被删；返回体里 fieldSpecs/useCaseRules 必须是空串）
add("⑥genAnnoDraft 直接返回空内容(客户端不生成PRD)",
  /const genAnnoDraft\s*=[\s\S]{0,1200}?return\s*\{[^}]*fieldSpecs:\s*''[^}]*useCaseRules:\s*''[^}]*\}/.test(src),
  "有人把早返回删了/改成生成内容 → 客户端又开始猜 PRD，违反 B 架构（2026-06-23 拍板）");

// ⑦ 标准件里不得出现 7 节用例规则模板文本（那是 AI 按 skill 规则真推理该产出的，不是客户端硬编码的）
add("⑦层内无7节模板文本(禁客户端硬编码用例规则)",
  !/【前置条件】/.test(src) && !/【操作流程】[\s\S]{0,80}正向流程/.test(src),
  "有人把启发式模板塞回客户端 → 会污染 prd-data 真理源、诱导用户跳过对话框真推理");

console.log("\n════════ 圈选采集修复·静态防退化守卫 ════════");
console.log("标准件: " + path.relative(process.cwd(), FILE));
for (const c of checks) console.log((c.ok ? "  ✓ " : "  ✗ ") + c.name + (c.ok ? "" : "  ← 被还原！" + c.why));
const allOk = checks.every(c => c.ok);
console.log("──────────────────────────────────");
console.log(allOk ? "  四件修复都在 PASS ✅" : "  有修复被还原 FAIL ❌ —— 圈选采集会再丢数据，先恢复");
console.log("════════════════════════════════════\n");
process.exit(allOk ? 0 : 1);
