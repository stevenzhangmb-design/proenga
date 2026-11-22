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
  const fps = {}; let cur = null, sub = "", intro = false;
  for (const line of text.split(/\r?\n/)) {
    const h = /^(#{2,6})\s+(.+?)\s*$/.exec(line);
    if (h) {
      const t = h[2].replace(/`/g, "");
      intro = false;
      if (/字段规范/.test(t)) { sub = "fs"; continue; }
      if (/用例规则/.test(t)) { sub = "uc"; continue; }
      // 功能点下面的其它小节（不是新的功能点）：只结束上一小节，不换功能点
      if (/^[\d.]*\s*(位置|原型|原型图|流程图|关键业务约束|业务场景说明|页面说明|界面说明|功能点详细介绍|说明)$/.test(t)) { sub = ""; continue; }
      cur = t; sub = ""; intro = true; fps[cur] = fps[cur] || { _draft_fieldSpecs: "", _draft_useCaseRules: "", _intro: "" }; continue;
    }
    // §2026-11-22 功能点标题下、第一个小节之前的开头说明（一般写“适用：……打开【某页面】”），用来认这个功能点对应原型的哪个页面/弹窗
    //    只取第一段（后面几段常顺带提到别的页面，如“提交失败后可以【重新提交】”，不能拿来认页面）
    if (cur && intro) {
      if (/^:::/.test(line)) continue;
      if (line.trim()) fps[cur]._intro += line + "\n"; else if (fps[cur]._intro) intro = false;
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
// §2026-11-22 ① 说明文字、弹窗段落常写成 HTML（<b>小标题：</b>正文、<div>① 小标题</div>），整串太长进不了词表；
//    按标签切开，每段去掉行首序号、行尾冒号后单独收词（只按标签切，不按标点拆正文，免得正文里的普通词把臆造字段放过去）。
//    ② 含重音的拉丁字母（ã ç é 等）也算字母（原来只收纯 ASCII，带重音的外文字段名进不了词表）。
const LATIN_WORD = /^[A-Za-zÀ-ÖØ-öø-ÿ][A-Za-zÀ-ÖØ-öø-ÿ0-9 /().-]{1,23}$/;
const addText = t => {
  t = String(t).replace(/&nbsp;/g, " ").replace(/^[\s①-⑳❶-❿·•-]+/, "").replace(/^\d{1,2}[、.．)）]\s*/, "").replace(/[：:]\s*$/, "").trim();
  if (/[一-龥]/.test(t) || LATIN_WORD.test(t)) add(t);
};
const PROTO_DATA = [];
for (const decl of ["const SYSTEMS=", "const NAV=", "const PAGECFG="]) {
  const raw = grabLiteral(html, decl); if (!raw) continue;
  let data; try { data = JSON.parse(raw); } catch (_) { continue; }
  PROTO_DATA.push(data);
  const walkV = n => {
    if (typeof n === "string") {
      if (/[一-龥]/.test(n) || LATIN_WORD.test(n)) add(n.replace(/<[^>]+>/g, ""));
      addText(n.replace(/<[^>]+>/g, ""));
      if (/<[^>]+>/.test(n)) for (const seg of n.split(/<[^>]+>/)) addText(seg);
      return;
    }
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
// §2026-11-22 界面元素类别名：PRD 用类别称呼没有文字标签的界面元素（提示条、标题旁的 ? 帮助、组合筛选里的搜索方式下拉），
//    原型里自然没有同名文字。只有原型里【确实有】这类元素才放行，没有照样报。
const dataKeys = new Set(); let comboWithMatch = false;
{
  const walkK = n => {
    if (!n || typeof n !== "object") return;
    if (Array.isArray(n)) { n.forEach(walkK); return; }
    if (n.type === "combo" && Array.isArray(n.match) && n.match.length) comboWithMatch = true;
    for (const k of Object.keys(n)) { const v = n[k]; if (v != null && v !== "" && v !== false) dataKeys.add(k); walkK(v); }
  };
  PROTO_DATA.forEach(walkK);
}
const hasKey = re => [...dataKeys].some(k => re.test(k));
const ELEMENT_KINDS = [
  // 提示条：弹窗 / 页面顶部的提示区块
  { re: /^(提示条|提示框|提示栏|顶部提示条?|警示条)$/, has: () => hasKey(/^(alert|alertTitle|notice|banner)$/) || /<el-alert\b/.test(html) },
  // 帮助：标题旁的 ? 图标（PRD 写了“标题旁”就只认标题旁的帮助）
  { re: /^[?？]?(帮助|帮助图标|问号|问号图标)$/, has: raw => /标题/.test(raw) ? hasKey(/^(titleHelp|listHelp)$/) : (hasKey(/^(titleHelp|listHelp|help)$/) || /QuestionFilled|el-icon-question/.test(html)) },
  // 搜索方式：组合筛选里选“精确 / 模糊”等匹配方式的下拉
  { re: /^(搜索方式|匹配方式)$/, has: () => comboWithMatch },
];
const isElementKind = (raw, n) => ELEMENT_KINDS.some(e => e.re.test(n) && e.has(String(raw)));
const matched = name => {
  const n = norm(name); if (!n) return true;
  if (vocab.has(n)) return true;                                  // 精确（申请充值金额=th、充值金额=表单 label）
  if (isElementKind(name, n)) return true;                        // 界面元素类别名，且原型里确有这类元素
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
const protoFields = new Map();   // 归一后的中文字段名 → [{ph, req, cond, msg, pages}]
// §2026-11-22 同名字段在不同页面属性可能不同（这个页面可编辑带星号，那个页面只读），比对时按功能点对应的页面取，不跨页面串。
//    页面/弹窗 = fullPages、dialogs 下的每一项，以及 detailViews 的每一项 / detailView，取它的 title。
const pageLabels = new Map();   // 归一后的页面标题 → 该页面上出现的字段名（归一后，含只读列和只读项）
const normTitle = s => String(s).replace(/\s+/g, "");
{
  const walk = (node, inFilter, pages, pk) => {   // inFilter：筛选区里的同名字段（查询条件），只在没有别的同名输入项时才拿来比；pk：本节点在父节点里的键
    if (!node || typeof node !== "object") return;
    if (Array.isArray(node)) { node.forEach(x => walk(x, inFilter, pages, pk === "detailViews" ? "detailViews[]" : pk)); return; }
    if (pk === "page" || pk === "detailViews[]" || pk === "detailView") {
      const t = normTitle(zhOf(node.title).trim());
      if (t) { pages = pages.concat(t); if (!pageLabels.has(t)) pageLabels.set(t, new Set()); }
    }
    const lab = zhOf(node.label).trim();
    if (lab) for (const p of pages) pageLabels.get(p).add(norm(lab));
    if (lab && ["type", "ph", "required", "requiredWhen", "reqMsg", "requiredMsg"].some(k => node[k] !== undefined)) {
      const t = String(node.type || ""), sel = SEL_TYPE.test(t), up = /upload|file/i.test(t);
      const verb = up ? "请上传" : (sel ? "请选择" : "请输入");
      const ph = node.ph !== undefined && !Array.isArray(node.ph) ? zhOf(node.ph).trim() : null;
      const ent = { ph, defPh: (sel ? "请选择" : "请输入") + lab, req: !!node.required, cond: !!node.requiredWhen, filter: !!inFilter, pages,
        msg: zhOf(node.reqMsg || node.requiredMsg).trim() || (verb + lab) };
      const key = norm(lab); if (!protoFields.has(key)) protoFields.set(key, []); protoFields.get(key).push(ent);
    }
    // §2026-11-22 骨架内置表单项的必填声明：骨架自带的输入框不写成 {label, required} 字段，而是在所属配置对象上写
    //    “<前缀>Required: true” 或 “<前缀>Req: true”（同一对象里可选 <前缀>Label / <前缀>Text / <前缀>Name 作字段名、
    //    <前缀>ReqMsg 作没填提示、<前缀>Ph 作占位）。字段名依次取 Label / Text / Name；都没写时取没填提示去掉“请输入/请选择/请上传”。
    for (const fk of Object.keys(node)) {
      const fm = /^([a-z][A-Za-z0-9]*?)(Required|Req)$/.exec(fk); if (!fm || node[fk] !== true) continue;
      const pre = fm[1], rmsg = zhOf(node[pre + "ReqMsg"] || node[pre + "RequiredMsg"]).trim();
      const fname = (zhOf(node[pre + "Label"]) || zhOf(node[pre + "Text"]) || zhOf(node[pre + "Name"]) || rmsg.replace(/^请(输入|选择|上传)/, "")).trim();
      if (!fname) continue;
      const verb = /^请(选择|上传)/.test(rmsg) ? rmsg.slice(0, 3) : "请输入";
      const ph = node[pre + "Ph"] !== undefined ? zhOf(node[pre + "Ph"]).trim() : null;
      const key = norm(fname); if (!protoFields.has(key)) protoFields.set(key, []);
      protoFields.get(key).push({ ph, defPh: verb + fname, req: true, cond: false, filter: !!inFilter, pages, msg: rmsg || (verb + fname) });
      for (const p of pages) pageLabels.get(p).add(key);
    }
    // fullPages / dialogs 是“名字 → 页面”的表：它下面每一项按页面处理
    const isPageTable = pk === "fullPages" || pk === "dialogs";
    for (const k of Object.keys(node)) if (node[k] && typeof node[k] === "object") walk(node[k], inFilter || /^(filters|moreFilters|filter)$/i.test(k), pages, isPageTable ? "page" : k);
  };
  PROTO_DATA.forEach(d => walk(d, false, [], ""));
}
const attrFlags = [];
const pickAll = all => { if (!all || !all.length) return null; const nf = all.filter(x => !x.filter); return nf.length ? nf : all; };
// 功能点对应的页面：功能点开头说明（第一个小节之前，一般是“适用：点【按钮】打开【某页面】”）里写的【页面/弹窗名】，
// 原型里有这个标题、且页面上有这个字段的第一个。开头说明里同时写了【提交】和【提交 · 某单据】这类名字时，短的那个是按钮名，去掉。
// 开头说明里认不出页面（或 PRD 是 prd-data.json，没有开头说明）时，按全原型的同名字段比（原来的做法）。
const fpPagesOf = txt => {
  const out = []; const re = /【([^】]{2,40})】/g; let mm;
  while ((mm = re.exec(txt))) { const t = normTitle(mm[1]); if (pageLabels.has(t) && !out.includes(t)) out.push(t); }
  return out.filter(t => !out.some(o => o !== t && o.includes(t)));
};
// 返回 { page: 功能点对应的页面或 null, onPage: 该页面上的同名输入项, all: 全原型同名输入项（已按筛选区优先规则取舍） }
const pickCand = (key, fpPages) => {
  const all = protoFields.get(key) || [];
  const page = (fpPages || []).find(p => pageLabels.get(p).has(key)) || null;
  const onPage = page ? all.filter(x => x.pages.includes(page)) : [];
  return { page, onPage: pickAll(onPage), all: pickAll(all) };
};
// 提示语比对：全角 / 半角括号等价，去掉句末句号和空白，括号里的内容保留整句比；
// PRD 习惯在提示后面用括号补写出现条件（如“请输入编号（只填了名称时）”），整句对不上时再去掉括号及以后的条件部分比一次
const canonMsg = s => String(s || "").replace(/[。.]\s*$/, "").replace(/（/g, "(").replace(/）/g, ")").replace(/\s+/g, "").trim();
const msgSame = (proto, prdMsg) => canonMsg(proto) === canonMsg(prdMsg) || canonMsg(proto) === canonMsg(String(prdMsg).replace(/[（(].*$/, ""));
const cells = l => l.split("|").slice(1, -1).map(s => s.trim().replace(/^`|`$/g, ""));
const isVerbPh = s => /^(请输入|请选择)/.test(s);
for (const k of Object.keys(fps)) {
  const dot = k.lastIndexOf("."), fp = k.slice(dot + 1), mod = k.slice(0, dot).replace(/-[^-]+$/, "");
  if (!MD_MODE && present.size && !present.has(mod + "|" + fp)) continue;
  const fsTxt = String(fps[k]._draft_fieldSpecs || "");
  const fpPages = fpPagesOf(String(fps[k]._intro || ""));
  // 字段规范五列：字段名称 | 类型 | 是否必填/必选 | 默认值 | 约束规则
  for (const l of fsTxt.split("\n")) {
    if (!/^\|/.test(l) || /字段名称|^\|\s*-+/.test(l)) continue;
    const c = cells(l); if (c.length < 4) continue;
    const name = c[0], reqTxt = c[2], defTxt = c[3];
    const pc = pickCand(norm(name), fpPages);
    // 功能点对应页面上有这个输入项，就只拿这个页面的比；页面上没有这个输入项时，比必填用全原型（原来的做法，不漏报）
    const cand = pc.onPage || pc.all; if (!cand) continue;
    const at = pc.onPage ? "（原型【" + pc.page + "】）" : "";
    if (/^是/.test(reqTxt) && !cand.some(x => x.req || x.cond)) attrFlags.push({ k, name, why: "PRD 写必填，原型这个字段没有星号（没写 required 或 requiredWhen）" + at });
    // 非必填：功能点对应页面上这个字段只是显示（不是输入项），和 PRD 一致，不拿别的页面的同名输入项来比
    // “否（为空时必填）”这类写法是有条件必填，原型标星号不算不一致
    if (/^否/.test(reqTxt) && !/^否.*必填/.test(reqTxt) && !(pc.page && !pc.onPage) && cand.every(x => x.req)) attrFlags.push({ k, name, why: "PRD 写非必填，原型这个字段标了必填星号" + at });
    if (isVerbPh(defTxt) && cand.some(x => x.ph != null) && !cand.some(x => (x.ph != null ? x.ph : x.defPh) === defTxt))
      attrFlags.push({ k, name, why: "占位文字不一致：PRD 默认值写“" + defTxt + "”，原型写“" + [...new Set(cand.map(x => x.ph != null ? x.ph : x.defPh))].join("”或“") + "”" + at });
  }
  // 用例规则 › 提示消息三列：字段名称 | 未填写/未选择提示 | 输入错误提示
  const ucTxt = String(fps[k]._draft_useCaseRules || "");
  for (const l of ucTxt.split("\n")) {
    if (!/^\s*\|/.test(l) || /字段名称|^\s*\|\s*-+/.test(l)) continue;
    const c = cells(l.trim()); if (c.length !== 3) continue;
    const name = c[0], miss = c[1];
    if (!miss || miss === "-" || !/^请(输入|选择|上传)/.test(miss)) continue;
    const pc = pickCand(norm(name), fpPages); const cand = pc.onPage || pc.all; if (!cand) continue;
    // §2026-11-22 原来只拿“PRD 提示删掉括号及以后部分”去比，原型提示带括号时两边一字不差也报；改用 msgSame
    if (!cand.some(x => msgSame(x.msg, miss)))
      attrFlags.push({ k, name, why: "没填提示不一致：PRD 写“" + miss + "”，原型会提示“" + [...new Set(cand.map(x => x.msg))].join("”或“") + "”" + (pc.onPage ? "（原型【" + pc.page + "】）" : "") });
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
