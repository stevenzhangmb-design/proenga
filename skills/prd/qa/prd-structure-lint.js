/* ════════════════════════════════════════════════════════════════════════
   PRD 合规机器闸 · prd-structure-lint.js · prd skill 铁律的可执行版（权威裁判）
   ────────────────────────────────────────────────────────────────────────
   定位：prd skill 全部"能机器判"的铁律的单一可执行编码。对【生成的 PRD .md 文档】整体
        校验。它绿 = 机械/结构/格式/表格/禁词层 100% 合规；它红 = 不许交付。
        判断类铁律（操作明细对象标识、消息接收人角色、默认值推导是否合理等机器无法验真的）
        不在本闸，由"生成后深检铁律"(_rules/prd-post-generation-deepcheck.mdc) 要求 AI 逐功能点
        对照规则原文人工核。两者合起来才是天花板。
   真理源：_rules/prd-template-structure.mdc + _rules/prd-directory-numbering.mdc + references/quality-checklist.md
   用法：node prd-structure-lint.js <PRD-*.md 路径>（不给则自动探测 archive 最新 PRD-*.md）
   退出码：0=全合规 1=有违规。
   ──────────────────────────────────────────────────────────────────────── */
const fs = require("fs"), path = require("path");

// ── 定位 PRD.md ──
// 无显式路径时：只校验【当前项目】PRD（按 prd-data.json 的 system_name 配对 PRD-<system_name>.md），
// 当前项目无 PRD 则【跳过(exit 0)】——绝不回退抓 archive 里其它无关旧 PRD（否则删了本项目 PRD 会误抓别的项目误报）。
let file = process.argv[2];
if (!file) {
  let arch = process.env.ANNO_ARCHIVE;
  if (!arch) { for (const c of [path.join(__dirname, "../../../../archive"), path.join(process.cwd(), "archive")]) if (fs.existsSync(c)) { arch = c; break; } }
  try {
    const pdp = arch && path.join(arch, "prd-data.json");
    if (pdp && fs.existsSync(pdp)) {
      const sn = (JSON.parse(fs.readFileSync(pdp, "utf8").replace(/^﻿/, "")).system_name) || "";
      if (sn) { const cand = path.join(arch, "PRD-" + sn + ".md"); if (fs.existsSync(cand)) file = cand; }
    }
  } catch (e) {}
  if (!file) { console.log("（无当前项目 PRD-<system_name>.md，跳过结构闸；不抓其它无关旧 PRD）"); process.exit(0); }
}
if (!fs.existsSync(file)) { console.log("✗ 未找到指定 PRD: " + file); process.exit(1); }
const md = fs.readFileSync(file, "utf8").replace(/^﻿/, "");
const lines = md.split(/\r?\n/);
const errs = [];
const E = (code, m) => errs.push(`[${code}] ${m}`);

// ── 收集所有带编号标题（## 章节 / **加粗子节）──
const H = [];  // {num, lv(# 数, 0=加粗), title, line}
lines.forEach((l, i) => {
  let m = l.match(/^(#{2,6})\s+([\d]+(?:\.\d+)*)\s+(.+?)\s*$/);
  if (m) { H.push({ num: m[2], lv: m[1].length, title: m[3].trim(), line: i }); return; }
  m = l.match(/^\*\*([\d]+(?:\.\d+)*)\s+(.+?)\*\*\s*$/);
  if (m) H.push({ num: m[1], lv: 0, title: m[2].trim(), line: i });
});
const between = (fromLine, toLine) => lines.slice(fromLine + 1, toLine === undefined ? lines.length : toLine).join("\n");
const nextHeadLine = (afterLine) => { const h = H.find(x => x.line > afterLine); return h ? h.line : lines.length; };
const sectionBody = (titleRe) => { const h = H.find(x => titleRe.test(`${x.num} ${x.title}`)); return h ? between(h.line, nextHeadLine(h.line)) : null; };

/* ══════ 第一部分：全文结构（§1 章节顺序 + 编号铁律） ══════ */
// S1 章节仅 §1-§4（R-B）
const chap = H.filter(h => /^\d+$/.test(h.num)).map(h => h.num);
["1", "2", "3", "4"].forEach(c => { if (!chap.includes(c)) E("S1", `缺章节 §${c}（PRD 固定 4 章：开发目的/版本变更/术语/功能需求）`); });
chap.forEach(c => { if (+c > 4) E("S1", `禁止出现 §${c}（R-B：PRD 固定 §1-§4，严禁第 5 章/平行章）`); });
// S2 §4 仅 4.1-4.4
["4.1", "4.2", "4.3", "4.4"].forEach(n => { if (!H.some(h => h.num === n)) E("S2", `缺 §${n}（§4 固定含 产品定义/产品框架/业务流程图/功能点明细）`); });
H.filter(h => /^4\.\d+$/.test(h.num)).forEach(h => { if (+h.num.split(".")[1] > 4) E("S2", `§${h.num} 越界（§4 仅 4.1-4.4，容器树全写在 4.4 下）`); });
// S3 编号全局唯一
const cnt = {}; H.forEach(h => cnt[h.num] = (cnt[h.num] || 0) + 1);
Object.keys(cnt).forEach(n => { if (cnt[n] > 1) E("S3", `编号重复：${n} 出现 ${cnt[n]} 次（编号必须全局唯一）`); });
// S4 同级编号连续
const kids = {};
H.forEach(h => { const p = h.num.split("."); if (p.length < 2) return; const par = p.slice(0, -1).join("."); (kids[par] = kids[par] || []).push(+p[p.length - 1]); });
Object.keys(kids).forEach(par => { const ns = [...new Set(kids[par])].sort((a, b) => a - b); ns.forEach((n, idx) => { if (n !== idx + 1) E("S4", `§${par} 子项编号不连续：第 ${idx + 1} 项为 ${n}（应 ${idx + 1}）`); }); });
// S5 标题层级随菜单深度递增（拦菜单层级塌陷）
const menuH = H.filter(h => h.lv > 0 && h.num.startsWith("4.4."));
const lvByNum = {}; menuH.forEach(h => lvByNum[h.num] = h.lv);
menuH.forEach(h => {
  const p = h.num.split("."); if (p.length <= 4) return;
  const par = p.slice(0, -1).join(".");
  if (lvByNum[par] !== undefined && h.lv <= lvByNum[par] && h.lv < 6)
    E("S5", `菜单层级塌陷：${h.num}「${h.title}」(${"#".repeat(h.lv)}) 未比父菜单 ${par}(${"#".repeat(lvByNum[par])}) 加深，Word 目录将不嵌套`);
});

/* ══════ 第二部分：§2 版本变更 / §3 术语 / §4.3 业务流程图 ══════ */
// V1 版本变更 4 列固定（§1.4）
const verBody = sectionBody(/^2\s/);
if (verBody === null) E("V1", "缺 §2 版本变更");
else if (!/\|\s*版本\s*\|\s*日期\s*\|\s*变更人\s*\|\s*变更内容\s*\|/.test(verBody)) E("V1", "§2 版本变更表头须固定 4 列 | 版本 | 日期 | 变更人 | 变更内容 |（§1.4）");
// T1 术语章节存在且为表（§1.5）
const termBody = sectionBody(/^3\s/);
if (termBody === null) E("T1", "缺 §3 术语 / 图例定义");
else if (!/\|\s*术语\s*\|\s*定义\s*\|/.test(termBody) && !/\|/.test(termBody)) E("T1", "§3 术语章节须为 | 术语 | 定义 | 表（§1.5）");
// M1 §4.3 业务流程图须有流程图：mermaid 源码 或 已渲染的流程图图片（anno-server 把 mermaid 渲成 PNG 嵌 docx，§2.1）
const flowBody = sectionBody(/^4\.3\s/);
if (flowBody !== null) {
  // 取 4.3 整段到 4.4（任意子节含流程图也算）
  const i43 = H.find(h => h.num === "4.3"), i44 = H.find(h => h.num === "4.4");
  const seg = (i43 && i44) ? lines.slice(i43.line, i44.line).join("\n") : flowBody;
  const hasMermaid = /```mermaid/.test(seg);
  const hasFlowImg = /!\[[^\]]*\]\([^)]+\.(?:png|jpe?g|svg)\)/i.test(seg);  // 渲染好的流程图 PNG
  if (!hasMermaid && !hasFlowImg) E("M1", "§4.3 业务流程图须含 mermaid 流程图或渲染好的流程图图片（§2.1 禁纯文字描述无图）");
}

/* ══════ 第三部分：R-A 图片识别 5 段绝不进 PRD ══════ */
[["图片绑定表"], ["图片归档清单"], ["图片识别结果"], ["待确认项"], ["合理化建议"], ["截图识别摘要"], ["本批截图识别摘要"]].forEach(([k]) => {
  if (new RegExp(`(\\*\\*|#+\\s*).*${k}`).test(md)) E("RA", `PRD 文件出现「${k}」段（R-A：图片识别 5 段绝不进 PRD 文件，仅对话辅助）`);
});

/* ══════ 第四部分：全局禁词（推托语 / N/A 占位 / UI 不确定括注） ══════ */
const BANS = [
  ["以实现为准"], ["按业务定"], ["按业务配置"], ["按截图实际值"], ["以图为准"], ["按产品设计"], ["按业务约定"], ["按业务实际"],
  ["或等价入口"], ["或等价提交入口"], ["或等价状态"], ["（若页面提供）"], ["（若存在中间弹层）"], ["（若提供）"], ["（若存在）"], ["（按需）"], ["N/A"],
];
BANS.forEach(([w]) => { if (md.includes(w)) E("BAN", `全文出现禁用措辞「${w}」（推托语/N-A 占位/UI 不确定括注，须改为具体值或先问用户）`); });
// IMG-XX 以 XX 为准 / 见 IMG-XX 这类推托
if (/以\s*IMG-?\d+\s*为准/.test(md)) E("BAN", "出现「以 IMG-XX 为准」推托语（图片仅在 .2 原型图 段引用）");
// 章节占位/待生成（§1开发目的/§3术语/§4.1产品定义/§4.2产品框架/§4.3业务流程图 未由 AI 据真值生成 = 红）：生成器不写死通用模板、AI 没注 _prd_meta 就会留占位，必须 AI 据本系统真值补全才能交
["待 AI 据原型", "请 PM 补充", "需 AI 据本系统真实业务流程绘制", "待生成"].forEach(w => { if (md.includes(w)) E("CHAP", `章节含占位/待生成「${w}」——§1/§3/§4.1-4.3 须由 AI 据本系统真值生成（禁通用臆造/占位），禁交`); });

/* ══════ D1 日期格式跨字段一致（§3.1.5：PRD 用一种部署地区展示格式，禁混用） ══════ */
const dfmts = [...new Set((md.match(/\b(?:YYYY|DD|MM)[-\/](?:YYYY|DD|MM)[-\/](?:YYYY|DD|MM)\b/g) || []))];
if (dfmts.length > 1) E("D1", `日期格式不一致：全文混用 ${dfmts.length} 种 [${dfmts.join(" / ")}]——§3.1.5 须按部署地区统一一种（CN=YYYY-MM-DD / BR=DD/MM/YYYY / US=MM/DD/YYYY），且与原型真实展示一致`);

/* ══════ 第五部分：功能点逐一（4 子节 + 每节内容） ══════ */
const bold = {}; H.filter(h => h.lv === 0).forEach(h => bold[h.num] = h);
const fps = [];
Object.keys(bold).forEach(num => { const m = num.match(/^(.+)\.1$/); if (m && /位置/.test(bold[num].title)) fps.push(m[1]); });
const SECTIONS = ["前置条件", "操作流程", "后置条件", "校验规则", "提示消息", "消息通知", "操作日志"];
let proImgNoneCount = 0, proImgNoneList = [];
fps.forEach(N => {
  const tag = `功能点 ${N}「${(bold[N + ".1"] || {}).title || ""}」`;
  // F1 四子节齐
  [["1", "位置"], ["2", "原型图"], ["3", "字段规范"], ["4", "用例规则"]].forEach(([n, nm]) => {
    if (!bold[N + "." + n] || !bold[N + "." + n].title.includes(nm)) E("F1", `${tag} 缺子节 .${n} ${nm}（四子节固定 .1位置/.2原型图/.3字段规范/.4用例规则）`);
  });
  // F2 原型图统计（不得全为「无」）
  if (bold[N + ".2"]) { const t = between(bold[N + ".2"].line, bold[N + ".3"] ? bold[N + ".3"].line : nextHeadLine(bold[N + ".2"].line)).trim(); if (/^无[。.]?$/.test(t) || !t) { proImgNoneCount++; proImgNoneList.push((bold[N + ".1"] || {}).title || N); } }
  // F3 字段规范
  if (bold[N + ".3"]) {
    const fsTxt = between(bold[N + ".3"].line, bold[N + ".4"] ? bold[N + ".4"].line : nextHeadLine(bold[N + ".3"].line)).trim();
    if (!/^无[。.]?$/.test(fsTxt) && fsTxt) {
      if (!/\|\s*字段名称\s*\|\s*类型\s*\|\s*是否必填\/?必?选?\s*\|\s*默认值\s*\|\s*约束规则\s*\|/.test(fsTxt))
        E("F3", `${tag} 字段规范须五列固定表头 | 字段名称 | 类型 | 是否必填/必选 | 默认值 | 约束规则 | 或写「无」（§3.1）`);
      // 必填列取值仅 是/否/条件必填（取数据行第 3 列）
      fsTxt.split("\n").filter(l => /^\|/.test(l) && !/字段名称|^\|\s*-+/.test(l)).forEach(row => {
        const cols = row.split("|").map(c => c.trim()); if (cols.length >= 6) { const req = cols[3]; if (req && !/^(是|否|条件必填)$/.test(req)) E("F3", `${tag} 字段「${cols[1]}」必填列取值「${req}」非法（仅 是/否/条件必填，§3.1.1）`); }
      });
      // 字段规范禁收按钮（R-C）
      fsTxt.split("\n").filter(l => /^\|/.test(l)).forEach(row => { const _c = row.split("|"); const name = (_c[1] || "").trim(); const _type = (_c[2] || "").trim();
        if (/只读|展示/.test(_type)) return;  // 只读/展示类字段(看板/widget/详情)名为"启用/停用/状态"等=状态标签·非操作按钮·跳过按钮检查（修闸不改原型label）
        if (/^(保存|取消|确定|确认|重置|关闭|删除|新增|编辑|导出|导入|打印|启用|停用|复制|查询|查看|提交|返回)$/.test(name)) E("F3", `${tag} 字段规范收录了操作按钮「${name}」（R-C：仅收数据字段，按钮进操作流程）`); });
    }
  }
  // F4-F9 用例规则
  if (bold[N + ".4"]) {
    const uc = between(bold[N + ".4"].line, nextHeadLine(bold[N + ".4"].line));
    // F4 七节齐 + 顺序
    let lastIdx = -1, orderOk = true;
    SECTIONS.forEach(s => {
      const re = new RegExp("(^|\\n)\\s*\\u2022\\s*" + s);
      const mm = uc.match(re);
      if (!mm) E("F4", `${tag} 用例规则缺「• ${s}」节（七节齐全且 • 顶格 U+2022，§4.1）`);
      else { const idx = uc.indexOf(mm[0]); if (idx < lastIdx) orderOk = false; lastIdx = idx; }
    });
    if (!orderOk) E("F4", `${tag} 用例规则七节顺序错乱（须 前置→流程→后置→校验→提示消息→消息通知→操作日志）`);
    // 取每节正文
    const secBody = (name) => { const parts = uc.split(new RegExp("\\u2022\\s*" + name + "[：:]")); if (parts.length < 2) return ""; const after = parts[1]; const stop = after.search(new RegExp("\\n\\s*\\u2022\\s*(" + SECTIONS.join("|") + ")")); return stop >= 0 ? after.slice(0, stop) : after; };
    // F5 ≥2 条须全角顿号分条（精确判，零误报）：
    //   校验规则——每条以「当…时」起，≥2 个「当」且无「1、」=多条未分条（标准无校验句 0 个「当」不误报）
    //   前置条件——单条用「，」连登录+权限，多条业务前置才用「；」；有「；」且无「1、」=未分条
    //   后置条件——标准句式单条内部即用「结果；位置」分号，机械判必误报 → 交人工深检，不在机器闸
    { const cb = secBody("校验规则"); const dang = (cb.match(/当[^。\n]*?时/g) || []).length; if (dang >= 2 && !/1、/.test(cb)) E("F5", `${tag} 校验规则含 ${dang} 条「当…时」但未用全角「1、2、3、」分条（§4.4.2 ≥2 条必分条）`); }
    { const qb = secBody("前置条件"); if (/；/.test(qb) && !/1、/.test(qb)) E("F5", `${tag} 前置条件含「；」并列但未用全角「1、2、3、」分条（§4.2.1 ≥2 条必分条）`); }
    // 后置条件【不】机器判：§4.2.2 标准句式(line 1146-1160)单条即用「结果状态；可见位置」分号，机械判必误报合规单条 → 交人工深检（fresh-install 自验 2026-06-27 实证此前 L149 误杀标准句式）
    // F6 操作日志（§4.7）
    const logB = secBody("操作日志");
    if (/不输出/.test(logB)) { /* 查询/查看类，OK */ }
    else if (logB.trim()) {
      if (!/操作日志模块记录/.test(logB)) E("F6", `${tag} 操作日志缺固定说明语（§4.7 一字不易）`);
      if (!/\|\s*字段\s*\|\s*字段说明\s*\|\s*规则\/示例\s*\|/.test(logB)) E("F6", `${tag} 操作日志缺 3 列固定表头 | 字段 | 字段说明 | 规则/示例 |（§4.7 任何偏离违规）`);
      if (!/\|\s*-+\s*\|\s*-+\s*\|\s*-+\s*\|/.test(logB)) E("F6", `${tag} 操作日志缺分隔行 |---|---|---|（缺则 Markdown 不渲染成表）`);
      ["操作时间", "操作账号", "操作模块", "操作功能", "操作明细", "IP地址"].forEach(r => { if (!new RegExp("\\|\\s*" + r + "\\s*\\|").test(logB)) E("F6", `${tag} 操作日志缺锁定行「${r}」（固定 6 行锁序）`); });
    } else E("F6", `${tag} 操作日志为空（须 §4.7 3 列表 或 写「查询/查看不输出操作日志」）`);
    // F7 提示消息：无。 或 3 列表
    const pmB = secBody("提示消息");
    if (!/无[。.]/.test(pmB) && /\|/.test(pmB) && !/\|\s*字段名称\s*\|\s*未填写\/?未?选择?提示\s*\|\s*输入错误提示\s*\|/.test(pmB)) E("F7", `${tag} 提示消息表头须 | 字段名称 | 未填写/未选择提示 | 输入错误提示 |（§4.5）`);
    if (!/无[。.]/.test(pmB) && !/\|/.test(pmB) && pmB.trim()) E("F7", `${tag} 提示消息须为字段表或写「无。」（§4.5.5）`);
    // F8 消息通知：无。 或 表（须分隔行）
    const nfB = secBody("消息通知");
    if (!/无[。.]/.test(nfB) && /\|/.test(nfB) && !/\|\s*-+\s*\|/.test(nfB)) E("F8", `${tag} 消息通知有内容但缺表格分隔行（§4.6 单/双消息表）`);
    // F9 禁内嵌 IMG-XX（§4.3）
    if (/IMG-?\d+/.test(uc)) E("F9", `${tag} 用例规则内嵌 IMG-XX（§4.3：图片仅在 .2 原型图 段引用）`);
    // F10 占位
    if (/（待填写）|（待生成）|按实际业务补充|（待补充）|展示\/跳转\/提交|权限\/输入\/状态校验/.test(uc)) E("F10", `${tag} 用例规则含占位/泛化文字（禁占位）`);
  }
  if (bold[N + ".3"]) { const fsTxt = between(bold[N + ".3"].line, bold[N + ".4"] ? bold[N + ".4"].line : nextHeadLine(bold[N + ".3"].line)); if (/IMG-?\d+/.test(fsTxt)) E("F9", `${tag} 字段规范内嵌 IMG-XX（§4.3）`); }
});
// F2 全局：每个功能点都必须有原型图截图，不准「无」（用户铁律 2026-06-28：只要有 .2 原型图 节就必须截图，禁问用户、禁留无）
if (proImgNoneCount > 0) E("F2", `${proImgNoneCount}/${fps.length} 个功能点「原型图」为「无」——每个功能点都必须有 IMG-xx 截图（用 auto-screenshot.js 截，禁留「无」、禁问用户要不要截）：${proImgNoneList.slice(0, 12).join("、")}`);

/* F-WRAP 用例规则七项 markdown 换行（§0 排版铁律：列表项末尾两空格，否则 pandoc 把七项合并成一大段）*/
lines.forEach((l, i) => {
  if (!/^•\s/.test(l) && !/^\s+\d+、/.test(l)) return;       // 只查 • 七项标签行 与 N、子项行
  if ((lines[i + 1] || "").trim() !== "" && !/  $/.test(l))   // 下一行非空 且 本行尾无两空格 → 会被合并
    E("F-WRAP", `第 ${i + 1} 行「${l.trim().slice(0, 18)}…」缺 markdown 换行（行尾两空格），pandoc 会把用例规则七项挤成一大段（§0 排版铁律）`);
});

/* ══════ 输出 ══════ */
console.log("\n════════ PRD 合规机器闸（prd 铁律可执行版） ════════");
console.log("PRD：" + path.basename(file) + " | 标题 " + H.length + " | 功能点 " + fps.length + " | 原型图为无 " + proImgNoneCount + "/" + fps.length);
if (!errs.length) console.log("  ✅ 机械/结构/格式/表格/禁词层 全合规 PASS（判断类仍须按 deepcheck 铁律人工逐条核）");
else { console.log("  ❌ 发现 " + errs.length + " 处违规 FAIL："); errs.forEach(e => console.log("    - " + e)); }
console.log("══════════════════════════════════════════════════\n");
process.exit(errs.length ? 1 : 0);
