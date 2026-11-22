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
   用法：node prd-prototype-field-gate.js [原型.html] [PRD.md 或 prd-data.json] [--project-data <project-data.json>]
        不给 PRD 时自动配对（见 _find-paired-prd.js：project-data 的 _prd → 同目录 → 按项目名在上级目录模糊匹配）；
        什么都不给则按 system_name 配对 archive（交付总闸用）。
   退出码：0=一致 1=有不一致 3=没找到配对的 PRD，未检查（不算通过）。
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs"), path = require("path");

// ── 定位 archive ──
function findArchive() {
  if (process.env.ANNO_ARCHIVE && fs.existsSync(process.env.ANNO_ARCHIVE)) return process.env.ANNO_ARCHIVE;
  for (const c of [path.join(__dirname, "../../../../archive"), path.join(process.cwd(), "archive")]) if (fs.existsSync(c)) return c;
  return null;
}
const arch = findArchive();
const ARGS = process.argv.slice(2);
const pdI = ARGS.indexOf("--project-data"); const projectData = pdI >= 0 ? ARGS.splice(pdI, 2)[1] : null;
let protoPath = ARGS[0], prdPath = ARGS[1];
const protoSys = f => { try { const m = fs.readFileSync(f, "utf8").match(/"system_name"\s*:\s*"((?:[^"\\]|\\.)*)"/); return m ? m[1] : ""; } catch (_) { return ""; } };
// §2026-11-20 给了原型、没给 PRD：按 _find-paired-prd.js 的顺序找配对的 PRD，不再拿 archive 里别的系统的 prd-data 来比；找不到明确说“未检查”（退出码 3）
if (protoPath && !prdPath) {
  const r = require("./_find-paired-prd").findPairedPrd({ proto: protoPath, projectData });
  if (r && r.error) { console.log("✗ " + r.error); process.exit(1); }
  if (!r || !r.file) { console.log("⚠ 未检查（不算通过）：没找到原型 " + path.basename(protoPath) + " 配对的 PRD。可以在 project-data 顶层写 \"_prd\": \"<PRD 的 .md 路径，相对 project-data 所在目录或绝对路径>\"；或把 PRD 放在原型同目录、上级目录的 PRD 文件夹里，文件名带项目名。"); process.exit(3); }
  prdPath = r.file; console.log("配对的 PRD：" + prdPath + "（" + r.how + "）");
}
if (!prdPath) { if (arch && fs.existsSync(path.join(arch, "prd-data.json"))) prdPath = path.join(arch, "prd-data.json"); }
if (!prdPath || !fs.existsSync(prdPath)) { console.log("✗ 未找到 PRD（prd-data.json 或 PRD 的 .md）"); process.exit(1); }
// §2026-11-20 也能直接读 PRD 的 md：按功能点标题切块，每块里的“字段规范”表和“用例规则 › 提示消息”表照 prd-data 的写法装进 _draft_fieldSpecs / _draft_useCaseRules
const MD_MODE = /\.md$/i.test(prdPath);
function prdFromMd(text) {
  const fps = {}; let cur = null, sub = "";
  for (const line of text.split(/\r?\n/)) {
    const h = /^(#{2,6})\s+(.+?)\s*$/.exec(line);
    if (h) {
      const t = h[2].replace(/`/g, "");
      if (/字段规范/.test(t)) { sub = "fs"; continue; }
      if (/用例规则/.test(t)) { sub = "uc"; continue; }
      // 功能点下面的其它小节（不是新的功能点）：只结束上一小节，不换功能点
      if (/^[\d.]*\s*(位置|原型|原型图|流程图|关键业务约束|业务场景说明|页面说明|界面说明|功能点详细介绍|说明)$/.test(t)) { sub = ""; continue; }
      cur = t; sub = ""; fps[cur] = fps[cur] || { _draft_fieldSpecs: "", _draft_useCaseRules: "" }; continue;
    }
    if (!cur || !sub) continue;
    if (sub === "fs") fps[cur]._draft_fieldSpecs += line + "\n"; else fps[cur]._draft_useCaseRules += line + "\n";
  }
  for (const k of Object.keys(fps)) if (!fps[k]._draft_fieldSpecs.trim() && !fps[k]._draft_useCaseRules.trim()) delete fps[k];
  return { system_name: "", function_points: fps };
}
const prd = MD_MODE ? prdFromMd(fs.readFileSync(prdPath, "utf8").replace(/^﻿/, "")) : JSON.parse(fs.readFileSync(prdPath, "utf8").replace(/^﻿/, ""));
const sysName = prd.system_name || "";
if (protoPath && !MD_MODE && sysName && protoSys(protoPath) && protoSys(protoPath) !== sysName) {
  console.log("⚠ 未检查（不算通过）：PRD 的 system_name「" + sysName + "」和原型「" + protoSys(protoPath) + "」不是同一个系统。请给这个原型配对的 PRD。"); process.exit(3);
}

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
const norm = s => String(s).replace(/\*\*/g, "").split("›").pop().trim()   // §2026-11-20 去粗体；“退货人信息 › CEP”取最后一段
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
// 9) §2026-11-20 装配出来的原型，字段名写在原型数据（SYSTEMS / NAV / PAGECFG 三个 JSON 字面量）里，不在模板标签上；
//    把里面所有中文文字（三语对象取 zh）都收进词表，否则 PRD 里的字段一个都对不上（曾报 506 个“原型查不到”）
for (const decl of ["const SYSTEMS=", "const NAV=", "const PAGECFG="]) {
  const raw = grabLiteral(html, decl); if (!raw) continue;
  let data; try { data = JSON.parse(raw); } catch (_) { continue; }
  const walkV = n => {
    if (typeof n === "string") { if (/[一-龥]/.test(n) || /^[A-Za-z][A-Za-z0-9 /().-]{1,23}$/.test(n)) add(n.replace(/<[^>]+>/g, "")); return; }
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(walkV); return; }
    if (typeof n.zh === "string") { walkV(n.zh); return; }
    for (const k of Object.keys(n)) walkV(n[k]);
  };
  walkV(data);
}

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
  if (!MD_MODE && present.size && !present.has(mod + "|" + fp)) { skipped++; continue; }
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

// ── §2026-11-20 第二层：同名字段的属性也要和 PRD 一致（必填、占位、没填提示）──
// 【铁律】原型必须遵守 PRD 的字段规范、用例规则模版（skills/prd/references/templates/prd-template-clean.md）。
// 从原型数据（SYSTEMS / NAV / PAGECFG 三个字面量）里取出所有输入项：有 label，且有 type / ph / required / requiredWhen / reqMsg / requiredMsg 之一。
// 同名字段可能有多个（不同页面、不同弹窗），任一个和 PRD 一致就算一致，避免误报。只查本原型承载的功能点里、原型数据里找得到的同名字段。
// 原型占位：写了 ph 用 ph；没写时按骨架默认“请输入/请选择 + 字段名”。原型没填提示：写了 reqMsg / requiredMsg 用它；没写时按骨架默认“请输入/请选择/请上传 + 字段名”。
const zhOf = v => (v && typeof v === "object") ? (v.zh != null ? String(v.zh) : "") : (v == null ? "" : String(v));
const SEL_TYPE = /^(select|date|datetime|daterange|cascader|radio|radios|checkbox|checkboxGroup|multiSelect|switch|pick|checkGrid)$/;
function grabLiteral(src, decl) {
  const i = src.indexOf(decl); if (i < 0) return null;
  let p = i + decl.length; while (p < src.length && /\s/.test(src[p])) p++;
  const open = src[p]; if (open !== "{" && open !== "[") return null;
  const close = open === "{" ? "}" : "]"; let depth = 0, inStr = false, esc = false;
  for (let j = p; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (esc) esc = false; else if (c === "\\") esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === open) depth++; else if (c === close) { depth--; if (depth === 0) return src.slice(p, j + 1); }
  }
  return null;
}
const protoFields = new Map();   // 归一后的中文字段名 → [{ph, req, cond, msg}]
{
  const walk = (node, inFilter) => {   // inFilter：筛选区里的同名字段（查询条件），只在没有别的同名输入项时才拿来比
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(x => walk(x, inFilter)); return; }
    const lab = zhOf(node.label).trim();
    if (lab && ["type", "ph", "required", "requiredWhen", "reqMsg", "requiredMsg"].some(k => node[k] !== undefined)) {
      const t = String(node.type || ""), sel = SEL_TYPE.test(t), up = /upload|file/i.test(t);
      const verb = up ? "请上传" : (sel ? "请选择" : "请输入");
      const ph = node.ph !== undefined && !Array.isArray(node.ph) ? zhOf(node.ph).trim() : null;
      const ent = { ph, defPh: (sel ? "请选择" : "请输入") + lab, req: !!node.required, cond: !!node.requiredWhen, filter: !!inFilter,
        msg: zhOf(node.reqMsg || node.requiredMsg).trim() || (verb + lab) };
      const key = norm(lab); if (!protoFields.has(key)) protoFields.set(key, []); protoFields.get(key).push(ent);
    }
    for (const k of Object.keys(node)) if (node[k] && typeof node[k] === "object") walk(node[k], inFilter || /^(filters|moreFilters|filter)$/i.test(k));
  };
  for (const decl of ["const SYSTEMS=", "const NAV=", "const PAGECFG="]) {
    const raw = grabLiteral(html, decl); if (!raw) continue;
    try { walk(JSON.parse(raw), false); } catch (_) { /* 解析失败交给其它闸 */ }
  }
}
const attrFlags = [];
const pickCand = key => { const all = protoFields.get(key); if (!all || !all.length) return null; const nf = all.filter(x => !x.filter); return nf.length ? nf : all; };
const cells = l => l.split("|").slice(1, -1).map(s => s.trim().replace(/^`|`$/g, ""));
const isVerbPh = s => /^(请输入|请选择)/.test(s);
for (const k of Object.keys(fps)) {
  const dot = k.lastIndexOf("."), fp = k.slice(dot + 1), mod = k.slice(0, dot).replace(/-[^-]+$/, "");
  if (!MD_MODE && present.size && !present.has(mod + "|" + fp)) continue;
  const fsTxt = String(fps[k]._draft_fieldSpecs || "");
  // 字段规范五列：字段名称 | 类型 | 是否必填/必选 | 默认值 | 约束规则
  for (const l of fsTxt.split("\n")) {
    if (!/^\|/.test(l) || /字段名称|^\|\s*-+/.test(l)) continue;
    const c = cells(l); if (c.length < 4) continue;
    const name = c[0], reqTxt = c[2], defTxt = c[3];
    const cand = pickCand(norm(name)); if (!cand) continue;
    if (/^是/.test(reqTxt) && !cand.some(x => x.req || x.cond)) attrFlags.push({ k, name, why: "PRD 写必填，原型这个字段没有星号（没写 required 或 requiredWhen）" });
    if (/^否/.test(reqTxt) && cand.every(x => x.req)) attrFlags.push({ k, name, why: "PRD 写非必填，原型这个字段标了必填星号" });
    if (isVerbPh(defTxt) && cand.some(x => x.ph != null) && !cand.some(x => (x.ph != null ? x.ph : x.defPh) === defTxt))
      attrFlags.push({ k, name, why: "占位文字不一致：PRD 默认值写“" + defTxt + "”，原型写“" + cand.map(x => x.ph != null ? x.ph : x.defPh).join("”或“") + "”" });
  }
  // 用例规则 › 提示消息三列：字段名称 | 未填写/未选择提示 | 输入错误提示
  const ucTxt = String(fps[k]._draft_useCaseRules || "");
  for (const l of ucTxt.split("\n")) {
    if (!/^\s*\|/.test(l) || /字段名称|^\s*\|\s*-+/.test(l)) continue;
    const c = cells(l.trim()); if (c.length !== 3) continue;
    const name = c[0], miss = c[1];
    if (!miss || miss === "-" || !/^请(输入|选择|上传)/.test(miss)) continue;
    const cand = pickCand(norm(name)); if (!cand) continue;
    if (!cand.some(x => x.msg === miss.replace(/[。.]$/, "").replace(/[（(].*$/, "").trim()))
      attrFlags.push({ k, name, why: "没填提示不一致：PRD 写“" + miss + "”，原型会提示“" + [...new Set(cand.map(x => x.msg))].join("”或“") + "”" });
  }
}

console.log("\n════════ PRD ↔ 原型 字段一致性闸 ════════");
console.log("原型：" + path.basename(protoPath) + " | 原型字段词表 " + vocab.size + " 项 | 原型输入项 " + protoFields.size + " 个 | 本原型 fp " + present.size + " | 受检功能点 " + checked + "（跳过非本原型 " + skipped + "）| 受检字段 " + fields);
if (!flags.length) console.log("  ✅ 全部字段均可在原型中查到 —— 无疑似臆造字段");
else {
  console.log("  ❌ 发现 " + flags.length + " 个 PRD 字段在原型中查不到（疑似臆造，须对原型逐一核实）FAIL：");
  flags.forEach(f => console.log(`    - ${f.k}：「${f.name}」原型无此字段名`));
}
if (!attrFlags.length) console.log("  ✅ 同名字段的必填、占位、没填提示和 PRD 一致");
else {
  console.log("  ❌ 发现 " + attrFlags.length + " 处原型和 PRD 字段规范、用例规则不一致 FAIL（以 PRD 模版为准改原型数据，或先问用户哪边对）：");
  attrFlags.forEach(f => console.log(`    - ${f.k}：【${f.name}】${f.why}`));
}
console.log("══════════════════════════════════════════\n");
process.exit(flags.length || attrFlags.length ? 1 : 0);
