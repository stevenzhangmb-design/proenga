/* ════════════════════════════════════════════════════════════════════════
   ⑰ 原型↔标准件 漂移闸 · prototype-standard-sync-gate.js · 维护者 QA（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   焊死大原则①「我画新原型时，达到本地现在的效果」——把"原型必内嵌当前最新标准件逻辑"
   从【靠纪律(整段原样注入)】变【机器硬保证】。
   做法（零维护·自适应）：从【标准件 components/annotation-layer.html】实时抽取一组关键逻辑行，
   断言当前项目的每个原型(按 system_name 匹配)都逐字包含同样的行；标准件改了逻辑 → 闸自动要求
   新逻辑 → 没重新注入的旧原型缺失即红。比对前剥掉块注释与行注释(版本戳两边注释不同)再归一化空白。
   覆盖关键逻辑：版本戳值 / 注入绑定命门(_annoInjectPins 按 fpKey 匹配) / 状态检测(_hasDraft+generated) /
                localStorage 键 / 圈选采集(_ZONE_SEL) / RULE_HEADER 对话框根本界定。
   用法：node prototype-standard-sync-gate.js [原型.html]   不给则按 system_name 自动找当前项目所有原型
   退出码：0=全部同步(或无当前项目原型·跳过) 1=有原型漂移(缺失/逻辑不一致)
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs"), path = require("path");
const { ANNOTATION_LAYER, findArchive, findPrototypes, findPrdData } = require("./_gate-env");

// 关键逻辑锚点（每个是标准件里某条关键行的【唯一片段】；标准件改这些行 → 自动要求原型同步）
const ANCHORS = [
  { key: "版本戳", a: "window.__ANNO_LAYER_VERSION__ =" },
  { key: "注入绑定命门(按fpKey匹配)", a: "pin.boundFp === fpKey" },
  { key: "状态检测_hasDraft", a: "const _hasDraft = fp &&" },
  { key: "状态检测generated", a: "const generated = !!(_hasDraft" },
  { key: "localStorage键(必按项目区分·防串数据)", a: "const _STORAGE_KEY = 'anno-pins-v2::' +" },
  { key: "圈选采集_ZONE_SEL", a: "const _ZONE_SEL =" },
  { key: "RULE_HEADER根本界定", a: "请按 prd skill 铁律，为以下在原型上圈定的功能生成/优化 PRD" },
  { key: "单一真理源回填", a: "单一真理源回填:PIN空内容从__PRD_DATA__拉_draft_" },
  { key: "误清空·清空前备份", a: "localStorage.setItem(_STORAGE_KEY + '-undo'" },
  { key: "恢复标注·从已生成PRD重建", a: "const restoreFromPRD = () =>" },
  { key: "对话框删功能·实时移除原型PIN", a: "window._annoRemovePins = (fpKeys) =>" },
  { key: "注入填充优先·锚不到不堆叠(收集提示先圈选)", a: "if (!anchorEl) { unanchored.push(p.title || fpKey); continue; }" },
  { key: "弹窗字段规范认N、xxx分块(查询条件+列表字段)", a: "gs.push({ name: segs[i].trim(), fields: t[0].fields });" },
  { key: "标注编辑·手动保存(输入只改草稿·不自动同步)", a: "const savePinFields  = () => {" },
  { key: "标注编辑·点保存才提交commitEdit", a: "const commitEdit = () => {" },
  { key: "三方同步命门·框选跨多卡兜底取真实fpKey(绝不落zoneId)", a: "(_annoKeys && _annoKeys.size ? [..._annoKeys][0] : '')" },
  { key: "导出分享版·先弹保存框拿handle(_pickSaveHandle·必须在用户手势有效期内)", a: "const _pickSaveHandle = async" },
  { key: "导出分享版·后写入(_writeOut·picker或退回下载)", a: "const _writeOut = async" },
];
const norm = (line) => line.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/, "").replace(/\s+/g, " ").trim();
const lineWith = (text, anchor) => { for (const ln of text.split("\n")) if (ln.includes(anchor)) return ln; return null; };

if (!fs.existsSync(ANNOTATION_LAYER)) { console.log("✗ 找不到标准件 annotation-layer.html"); process.exit(1); }
const std = fs.readFileSync(ANNOTATION_LAYER, "utf8");

// 先校验锚点都在标准件里（防闸自身过时）
const stdLines = {};
let selfErr = false;
for (const an of ANCHORS) {
  const l = lineWith(std, an.a);
  if (!l) { console.log(`✗ 闸需更新：标准件已无锚点「${an.key}」(${an.a})`); selfErr = true; }
  else stdLines[an.key] = norm(l);
}
if (selfErr) process.exit(1);

/* ── 渲染器 + 顶栏外壳 契约检查（单源：page-renderer.html / host-shell.html）──
   渲染器/外壳交织进业务 app、非整段注入，故用【去空白 CONTAINS 契约片段】而非逐字节比对
   （page-renderer.html 明示"效果一致即可，无需逐字节相同"）。契约片段=标注层识别命门(卡片类
   token stat-label/value/hint) + 每区块锚点 ak('查看'/'查询'/'列表') + 全 PAGECFG 特性模板
   + row/tg 助手 + host 工具条接桥。任一缺失 = 渲染器/外壳漂移、新原型达不到本地效果 → 红。 */
const compDir = path.dirname(ANNOTATION_LAYER);
const RENDERER = path.join(compDir, "page-renderer.html");
const HOSTSHELL = path.join(compDir, "host-shell.html");
const nw = (s) => String(s || "").replace(/\s+/g, "");   // 去全部空白
const CONTRACT = [
  // —— 渲染器 page-renderer.html（卡片类 token 用 bare token：兼容 class="lab stat-label" 遗留前缀）——
  { key: "卡片类·标签token(标注识别命门)", sig: "stat-label", src: "renderer" },
  { key: "卡片类·值token", sig: "stat-value", src: "renderer" },
  { key: "卡片类·副文token", sig: "stat-hint", src: "renderer" },
  { key: "区块锚点·查看", sig: "ak('查看')", src: "renderer" },
  { key: "区块锚点·查询", sig: "ak('查询')", src: "renderer" },
  { key: "区块锚点·列表", sig: "ak('列表')", src: "renderer" },
  { key: "banner重组/新增", sig: "cfg.bannerType==='merge'?'重组合并':'新增模块'", src: "renderer" },
  { key: "stats卡片渲染", sig: "v-for=\"(s,i)incfg.stats\"", src: "renderer" },
  { key: "chart柱状渲染", sig: "cfg.chart.values", src: "renderer" },
  { key: "donut环形渲染", sig: "cfg.donut.grad", src: "renderer" },
  { key: "filters筛选渲染", sig: "v-for=\"(f,i)incfg.filters\"", src: "renderer" },
  { key: "table列渲染", sig: "v-for=\"(c,i)incfg.columns\"", src: "renderer" },
  { key: "actions行操作渲染", sig: "v-for=\"aincfg.actions\"", src: "renderer" },
  { key: "分页栏(标准布局)", sig: "layout=\"total,sizes,prev,pager,next,jumper\"", src: "renderer" },
  { key: "custom自定义页", sig: "v-html=\"cfg.custom\"", src: "renderer" },
  { key: "note页脚", sig: "v-if=\"cfg.note\"", src: "renderer" },
  { key: "building占位页", sig: "v-if=\"cfg.building\"", src: "renderer" },
  { key: "单元格渲染助手·cell(纯JSON·标签{t,c}·替代旧row/tg函数)", sig: "function cell(v){", src: "renderer" },
  { key: "标签单元{t,c}渲染(纯JSON·禁函数调用)", sig: "'t'in v", src: "renderer" },
  { key: "table单元格用cell渲染", sig: "v-html=\"cell(row[i])\"", src: "renderer" },
  // —— 顶栏外壳 host-shell.html 工具条接桥（★ host 契约对【所有原型·含自定义外壳/豁免件】强制·不豁免）——
  // 工具条=标准部件，四按钮必须齐全。window.__anno.<method> 带点调用【只出现在 host 工具条】(标注层内=0)，
  // 故可作"某按钮在不在"的可靠判据：缺 restoreCleared 调用 = 缺【恢复标注】按钮 → 红。
  //（2026-07-04 存货核算装配版漏"恢复标注"按钮·⑰当时豁免整个host没抓到→立法：host契约不豁免·并补全四按钮）
  { key: "标注开关接桥·toggleShow", sig: "window.__anno.toggleShow", src: "host" },
  { key: "标注开关接桥·toggleMode", sig: "window.__anno.toggleMode", src: "host" },
  { key: "工具条创作控件类(只读隐藏)", sig: "anno-author-only", src: "host" },
  { key: "工具条·复制已圈功能接桥(openScopedList)", sig: "window.__anno.openScopedList", src: "host" },
  { key: "工具条·导出分享版接桥(exportShare)", sig: "window.__anno.exportShare", src: "host" },
  { key: "工具条·清空接桥(clearPins)", sig: "window.__anno.clearPins", src: "host" },
  { key: "工具条·恢复标注接桥(restoreCleared)·缺=漏恢复标注按钮", sig: "window.__anno.restoreCleared", src: "host" },
];
let contractSelfErr = false;
if (fs.existsSync(RENDERER) && fs.existsSync(HOSTSHELL)) {
  const rn = nw(fs.readFileSync(RENDERER, "utf8")), hn = nw(fs.readFileSync(HOSTSHELL, "utf8"));
  for (const c of CONTRACT) {
    const srcN = c.src === "renderer" ? rn : hn;
    if (!srcN.includes(nw(c.sig))) { console.log(`✗ 闸需更新：标准件(${c.src})已无契约片段「${c.key}」(${c.sig})`); contractSelfErr = true; }
  }
  if (contractSelfErr) process.exit(1);
} else {
  console.log("⚠ 找不到 page-renderer.html / host-shell.html，跳过渲染器/外壳契约检查");
}

// 目标原型：命令行指定，或按 system_name 找当前项目所有原型
const archive = findArchive();
let targets = [];
if (process.argv[2] && fs.existsSync(process.argv[2])) targets = [process.argv[2]];
else {
  let sysName = "";
  const pdPath = findPrdData(archive);
  if (pdPath) { try { sysName = JSON.parse(fs.readFileSync(pdPath, "utf8").replace(/^﻿/, "")).system_name || ""; } catch (e) {} }
  const matched = findPrototypes(archive).filter(f => { if (!sysName) return false; try { return fs.readFileSync(f, "utf8").includes(sysName); } catch (e) { return false; } });
  // 交付铁律=离线版；有 offline 则只盯 offline(交付/用户实际用的)，online 开发中间产物单独人工核
  const offline = matched.filter(f => /offline/i.test(f));
  targets = offline.length ? offline : matched;
  if (!targets.length) { console.log("\n════════ 原型↔标准件 漂移闸 ⑰ ════════\n  当前项目无匹配原型（跳过·不抓无关旧原型）\n════════════════════════════════"); process.exit(0); }
}

console.log("\n════════ 原型↔标准件 漂移闸 ⑰ ════════");
let allOk = true;
for (const f of targets) {
  const proto = fs.readFileSync(f, "utf8");
  // 登记豁免 __ANNO_LEGACY_GRANDFATHER__：用于【自定义外壳原型】（如手搓 ERP 顶菜单/双视图版·或"手搓版当骨架+注入最新层"的 Route B 装配版）——
  // 【只豁免 renderer 契约】(页面渲染器按定制外观本就不同)；【标注层 ANCHORS + host 工具条契约】仍【强制校验】：
  //   · 标注层锚点：版本戳/注入命门/存储键/RULE_HEADER 等——豁免件标注层过时也要红(杜绝退回旧漂移)；
  //   · host 工具条：四按钮接桥(复制已圈/导出分享/清空/恢复标注)——工具条是标准部件，定制外壳也必须齐全(2026-07-04 漏恢复标注教训)。
  // 每次响亮 ⚠ 标明"仅渲染器契约豁免·标注层+工具条仍严查"。
  const _legacy = proto.match(/__ANNO_LEGACY_GRANDFATHER__[^\r\n]*/);
  const protoN = nw(proto);
  const drifts = [];
  // 标注层锚点：所有原型(含豁免)一律严查
  for (const an of ANCHORS) {
    const pl = lineWith(proto, an.a);
    if (!pl) drifts.push(`缺失标注层「${an.key}」`);
    else if (norm(pl) !== stdLines[an.key]) drifts.push(`标注层「${an.key}」逻辑不一致`);
  }
  // 契约：host 工具条契约【所有原型强制】；renderer 契约仅【非豁免】查(自定义外壳豁免渲染器)
  let hostChecked = 0;
  for (const c of CONTRACT) {
    if (c.src === "renderer" && _legacy) continue;           // 自定义外壳：豁免渲染器契约
    if (c.src === "host") hostChecked++;
    if (!protoN.includes(nw(c.sig))) drifts.push((c.src === "host" ? "顶栏工具条(host)漂移·缺" : "渲染器漂移·缺") + `契约「${c.key}」`);
  }
  const totalChecks = ANCHORS.length + (_legacy ? hostChecked : CONTRACT.length);
  if (drifts.length) { allOk = false; console.log(`  ✗ ${path.basename(f)}：` + drifts.join("、") + (_legacy ? "  → 豁免件的标注层+工具条也必须最新齐全，请补注入/补按钮" : "  → 该原型未内嵌最新标准件(标注层/渲染器/外壳)，需重新注入/重生"));
  } else if (_legacy) console.log(`  ⚠✓ ${path.basename(f)}：自定义外壳(仅渲染器契约豁免) · 标注层${ANCHORS.length}锚点 + host工具条${hostChecked}契约 全最新 ✓  ${_legacy[0].slice(0, 70)}`);
  else console.log(`  ✓ ${path.basename(f)}  内嵌最新标准件(标注层${ANCHORS.length}锚点 + 渲染器/外壳${CONTRACT.length}契约 = ${totalChecks}项全一致)`);
}
console.log("────────────────────────────────");
console.log(allOk ? "  全部同步 PASS ✅" : "  有原型漂移 FAIL ❌ —— 把最新标准件重新注入该原型");
console.log("════════════════════════════════");
process.exit(allOk ? 0 : 1);
