/* ════════════════════════════════════════════════════════════════════════
   PRD ↔ 原型 字段一致性闸 · prd-prototype-field-gate.js
   ────────────────────────────────────────────────────────────────────────
   把"字段真值"从【靠 AI 自觉读原型】变成【机器硬拦】：直接读原型 HTML 的真实字段
   承载元素（el-form-item label / <th> / el-table-column label / el-option label /
   placeholder / data-tip / 模板内中文引号字面量——含动态 :label 三元），构成"原型字段词表"；
   再逐功能点检查 PRD 字段规范里每个字段名——【原型里根本不存在的字段名 = 疑似臆造 → 红】。
   这正是 prd-content-lint / prd-structure-lint 判不了的一层（它们不知道原型真实有哪些字段）。
   —— 专治"凭记忆/截图臆造字段"（如给充值表单臆造「币种」「审核结果」「已到账金额」）。
   定位：随包发；画新原型 / 别人装包跑 deliver-gate 都自动受保护，不再靠 AI 老不老实。
   用法：node prd-prototype-field-gate.js [原型.html] [prd-data.json]（不给则按 system_name 自动配对 archive）
   退出码：0=全部字段在原型可查到 1=有疑似臆造字段。
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs"), path = require("path");

// ── 定位 archive ──
function findArchive() {
  if (process.env.ANNO_ARCHIVE && fs.existsSync(process.env.ANNO_ARCHIVE)) return process.env.ANNO_ARCHIVE;
  for (const c of [path.join(__dirname, "../../../../archive"), path.join(process.cwd(), "archive")]) if (fs.existsSync(c)) return c;
  return null;
}
const arch = findArchive();
let protoPath = process.argv[2], prdPath = process.argv[3];
if (!prdPath) { if (arch && fs.existsSync(path.join(arch, "prd-data.json"))) prdPath = path.join(arch, "prd-data.json"); }
if (!prdPath || !fs.existsSync(prdPath)) { console.log("✗ 未找到 prd-data.json"); process.exit(1); }
const prd = JSON.parse(fs.readFileSync(prdPath, "utf8").replace(/^﻿/, ""));
const sysName = prd.system_name || "";

// ── 按 system_name 自动配对原型（与 anno-server updatePrototypeHtmls 同口径；优先 offline、排除分享版/备份）──
if (!protoPath && arch) {
  const cands = fs.readdirSync(arch).filter(f => f.endsWith(".html") && !/分享版|备份|\.bak|backup|BACKUP/i.test(f));
  let best = null;
  for (const f of cands) {
    let html; try { html = fs.readFileSync(path.join(arch, f), "utf8"); } catch (e) { continue; }
    const m = html.match(/"system_name"\s*:\s*"((?:[^"\\]|\\.)*)"/);
    if (m && m[1] === sysName) { const off = /offline/i.test(f); if (!best || (off && !best.off)) best = { f, off }; }
  }
  if (best) protoPath = path.join(arch, best.f);
}
if (!protoPath || !fs.existsSync(protoPath)) { console.log(`（无与「${sysName}」匹配的原型 HTML —— PRD-only 场景，跳过字段一致性校验）`); process.exit(0); }
const html = fs.readFileSync(protoPath, "utf8");

// ── 提取原型"字段真值词表" ──
const norm = s => String(s).trim()
  .replace(/[（(][^）)]*[）)]\s*$/g, "")   // 去尾部括注：账户余额 (CNY) → 账户余额
  .replace(/^\*\s*/, "").replace(/\s+/g, "").trim();
const vocab = new Set();
const add = s => { const n = norm(s); if (n && n.length >= 2 && n.length <= 24) vocab.add(n); };
let m;
// 1) el-form-item label="X"（静态表单字段）
for (const re of [/<el-form-item[^>]*\blabel="([^"]+)"/g, /<el-form-item[^>]*\s:label="[^"]*?'([^']{2,12})'/g]) while ((m = re.exec(html))) add(m[1]);
// 2) 动态 :label / :title 三元里的中文引号字面量（兜审核「通过原因/驳回原因」等）
for (const re of [/:label="[^"]*?'([^']{2,16})'[^"]*?'([^']{2,16})'/g]) while ((m = re.exec(html))) { add(m[1]); add(m[2]); }
// 3) <th ...>X</th> 列表列
{ const re = /<th\b[^>]*>([^<]{2,24})<\/th>/g; while ((m = re.exec(html))) add(m[1]); }
// 4) el-table-column label="X"
{ const re = /el-table-column[^>]*\blabel="([^"]+)"/g; while ((m = re.exec(html))) add(m[1]); }
// 5) el-option label="X" 枚举值
{ const re = /el-option[^>]*\blabel="([^"]+)"/g; while ((m = re.exec(html))) add(m[1]); }
// 6) placeholder（去"请输入/请选择/全部"前缀后取字段名）/ data-tip 操作名
{ const re = /placeholder="(?:请输入|请选择|全部)?([^"]{2,16})"/g; while ((m = re.exec(html))) add(m[1]); }
{ const re = /data-tip="([^"]{2,12})"/g; while ((m = re.exec(html))) add(m[1]); }
// 7) 模板内成对中文引号字面量（详情只读 label / 卡片标题等动态文本，兜底，宁宽勿误杀）
{ const re = />\s*([一-龥][一-龥（）()\/·\s]{1,14}[一-龥）)])\s*</g; while ((m = re.exec(html))) add(m[1]); }
// 8) 模板内所有中文起头的单引号字面量（兜动态 :label 三元里的「通过原因/驳回原因」等，宁宽勿误杀）
{ const re = /'([一-龥][^']{1,15})'/g; while ((m = re.exec(html))) add(m[1]); }

// ── 圈定"本原型实际承载的 fp"（dynamic ak('模块','功能') 调用 + 静态 data-annotation），只查这些，跳过别的视图/原型的 fp ──
const present = new Set();
{ const re = /ak\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g; while ((m = re.exec(html))) present.add(m[1] + "|" + m[2]); }
{ const re = /data-annotation="([^"]+-[^".]+\.[^"]+)"/g; while ((m = re.exec(html))) { const fk = m[1], dot = fk.lastIndexOf("."); present.add(fk.slice(0, dot).replace(/-[^-]+$/, "") + "|" + fk.slice(dot + 1)); } }

// ── 逐功能点：PRD 字段规范字段名 是否在原型词表可查到 ──
const matched = name => {
  const n = norm(name); if (!n) return true;
  if (vocab.has(n)) return true;                                  // 精确（申请充值金额=th、充值金额=表单 label）
  for (const v of vocab) {
    if (v.length >= 2 && v.includes(n)) return true;             // vocab 长串 ⊇ PRD 短字段（PRD 用简名、原型有全名）
    if (v.length >= 2 && n.endsWith(v)) return true;             // PRD 复合名以真实字段词结尾（创建时间⊃时间、审核时间⊃时间）；防"转账凭证⊃转账"前缀误放行
  }
  return false;
};
const fps = prd.function_points || {};
const flags = [];
let checked = 0, fields = 0, skipped = 0;
for (const k of Object.keys(fps)) {
  const fsTxt = (fps[k]._draft_fieldSpecs || "").trim();
  if (!fsTxt || /^无[。.]?$/.test(fsTxt)) continue;
  // 仅查"本原型实际承载"的 fp（按 module|fp 匹配）；别的视图/原型的 fp 跳过（它们对各自原型另行校验）
  const dot = k.lastIndexOf("."), fp = k.slice(dot + 1), mod = k.slice(0, dot).replace(/-[^-]+$/, "");
  if (present.size && !present.has(mod + "|" + fp)) { skipped++; continue; }
  checked++;
  const rows = fsTxt.split("\n").filter(l => /^\|/.test(l) && !/字段名称|^\|\s*-+/.test(l));
  for (const row of rows) {
    const name = (row.split("|")[1] || "").trim();
    if (!name || name === "-") continue;
    fields++;
    if (!matched(name)) flags.push({ k, name });
  }
}

// 注（2026-06-28 实战回退）：原"反向·漏写枚举"检查在【子集/增量生成】下必误报——
// 枚举是全局扫原型的，但 PRD 常只覆盖部分功能点（如本次只生成 充值+单据状态 2 个），
// 未生成功能点的枚举（创建人/审核人 查询筛选、别 widget 的 status:已完成）会被当成"漏写"。
// 而"漏状态(如圈选掉已驳回)"已在【采集层】根治（区完整 _ZONE_SEL + 回归闸 ⑭ anno-fix-guard），
// ⑫ 此层枚举检查既冗余又误报，故移除；⑫ 保留单向"臆造多写"检测（子集生成不误报、价值高）。

console.log("\n════════ PRD ↔ 原型 字段一致性闸 ════════");
console.log("原型：" + path.basename(protoPath) + " | 原型字段词表 " + vocab.size + " 项 | 本原型 fp " + present.size + " | 受检功能点 " + checked + "（跳过非本原型 " + skipped + "）| 受检字段 " + fields);
if (!flags.length) console.log("  ✅ 全部字段均可在原型中查到 PASS —— 无疑似臆造字段");
else {
  console.log("  ❌ 发现 " + flags.length + " 个 PRD 字段在原型中查不到（疑似臆造，须对原型逐一核实）FAIL：");
  flags.forEach(f => console.log(`    - ${f.k}：「${f.name}」原型无此字段名`));
}
console.log("══════════════════════════════════════════\n");
process.exit(flags.length ? 1 : 0);
