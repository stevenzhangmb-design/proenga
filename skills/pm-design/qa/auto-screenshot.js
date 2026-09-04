/* ════════════════════════════════════════════════════════════════════════
   原型图全自动截图 · auto-screenshot.js · 生成 PRD 时自动填充「.2 原型图」
   ────────────────────────────────────────────────────────────────────────
   定位：AI 在对话框按 prd skill 生成本地 PRD 时【自动】跑本脚本——无头 Chrome 按原型深链
        逐状态全页截图 → 写进 prd-data 每个功能点的 img → 重生 PRD。零 npm 依赖（只用本机
        Chrome/Edge）、零人工点击。符合「客户依赖最小化」（不给 anno-server 加浏览器自动化包）。

   前提：原型支持深链 URL 参数（prototype-template「URL 参数直达状态」约定），如
        ?sys=OMS|WMS & page=<页键> & open=form|detail|audit|biz & pins=0（pins=0 隐藏标注 PIN）。
        用【离线版】原型 html，无需联网。

   状态映射（states）：每个 PRD 视图一条 { id:"IMG-NN", query:"sys=..&page=..&open=..&pins=0", fps:[功能点key...] }。
        多个功能点可共享同一视图截图（如同一列表页的 导出/删除/查询）。
        ★【零配置·首选】原型内自带 `window.__ANNO_SHOT_MANIFEST__ = [ {id,query,fps}, ... ]`（pm-design 生成原型时
          自动烤入——它本就知道有哪些页/弹窗/功能点），本脚本直接读出，AI 无需手搓 states.json。
        【回退】外部/手做原型无 manifest 时，用 -States <json> 手给。

   用法：node auto-screenshot.js -Html <离线原型.html> [-States <states.json>] [-PrdData <prd-data.json>] [-Server <anno-server/server.js>]
        （不给 -States 时，自动读原型内 window.__ANNO_SHOT_MANIFEST__）

   关键坑（实测 2026-06-27）：
     1. ❌ 不要加 --virtual-time-budget：原型有 SSE 持续重连→虚拟时间永不结算→Chrome 挂起无图。去掉即正常。
     2. URL 必须作为【单个】参数传（execFileSync 数组元素），否则含空格/& 会被当「multiple targets」报错。
     3. 子目录与图片路径用【无空格 ASCII/中文无空格】slug：markdown 图片路径含空格会截断、嵌不进 docx。
     4. 截图后【必须】人眼 Read 抽验几张，确认渲染正确、弹窗已打开（不可侥幸）。
   ════════════════════════════════════════════════════════════════════════ */
const { execFileSync } = require("child_process");
const fs = require("fs"), path = require("path");

function arg(name, def) { const i = process.argv.indexOf(name); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : def; }
const HTML = arg("-Html");
const STATES = arg("-States");
const PRDDATA = arg("-PrdData", HTML ? path.join(path.dirname(HTML), "prd-data.json") : "");
const SERVER = arg("-Server", path.join(__dirname, "..", "..", "..", "..", "anno-server", "server.js"));
if (!HTML || !fs.existsSync(HTML)) { console.log("✗ -Html 原型文件不存在"); process.exit(1); }

const CHROME = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Microsoft/Edge/Application/msedge.exe"].find(p => fs.existsSync(p));
if (!CHROME) { console.log("✗ 未找到 Chrome/Edge（截图需本机 Chromium 内核浏览器）"); process.exit(1); }

const ARCHIVE = path.dirname(HTML);
const data = JSON.parse(fs.readFileSync(PRDDATA, "utf8"));
// 截图状态来源：优先 -States 文件；否则读原型自描述清单 window.__ANNO_SHOT_MANIFEST__（零配置——pm-design 生成原型时自动烤入，AI 无需手搓 states.json）
let states = null;
if (STATES && fs.existsSync(STATES)) {
  states = JSON.parse(fs.readFileSync(STATES, "utf8"));
} else {
  const _html = fs.readFileSync(HTML, "utf8");
  const _ki = _html.indexOf("__ANNO_SHOT_MANIFEST__");
  if (_ki >= 0) {
    const _bi = _html.indexOf("[", _ki);
    let _dep = 0, _end = -1;
    for (let i = _bi; i < _html.length; i++) { const c = _html[i]; if (c === "[") _dep++; else if (c === "]") { if (--_dep === 0) { _end = i; break; } } }
    if (_end > _bi) { try { states = new Function("return " + _html.slice(_bi, _end + 1))(); } catch (e) { console.log("✗ 解析原型内 __ANNO_SHOT_MANIFEST__ 失败：" + e.message); process.exit(1); } }
  }
}
if (!states || !states.length) { console.log("✗ 无截图状态：请给 -States <json>，或在原型内烤入 window.__ANNO_SHOT_MANIFEST__（pm-design 生成原型时自动烤）"); process.exit(1); }
const slug = (data.system_name || "prd").replace(/[/\\:*?"<>|\s·]+/g, "-").replace(/-{2,}/g, "-").replace(/^-|-$/g, "") || "prd";
const shotDir = path.join(ARCHIVE, "screenshots", slug);
fs.mkdirSync(shotDir, { recursive: true });

// 拷到 ASCII 临时路径（file:// 含非 ASCII 可能加载失败）
const tmp = path.join(ARCHIVE, "_shotsrc_tmp.html");
fs.copyFileSync(HTML, tmp);
const uri = "file:///" + tmp.split("\\").join("/");
const ud = path.join(ARCHIVE, "_chrome_shot_prof");
let ok = 0;
for (const st of states) {
  const out = path.join(shotDir, st.id + ".png");
  try { fs.rmSync(out, { force: true }); } catch (e) {}
  try {
    execFileSync(CHROME, ["--headless=new", "--disable-gpu", "--no-sandbox", "--no-first-run", `--user-data-dir=${ud}`,
      "--hide-scrollbars", "--window-size=1680,1180", "--force-device-scale-factor=2",   // ⚠️ 不加 --virtual-time-budget（会挂起）
      `--screenshot=${out}`, `${uri}?${st.query}`], { timeout: 40000 });
  } catch (e) {}
  if (fs.existsSync(out)) { ok++; console.log("  OK  ", st.id, "(" + st.query + ")", Math.round(fs.statSync(out).size / 1024) + "KB"); }
  else console.log("  FAIL", st.id, "(" + st.query + ")");
}
try { fs.rmSync(tmp, { force: true }); } catch (e) {}
try { fs.rmSync(ud, { recursive: true, force: true }); } catch (e) {}

let nset = 0;
for (const st of states) {
  if (!fs.existsSync(path.join(shotDir, st.id + ".png"))) continue;
  for (const fk of (st.fps || [])) if (data.function_points[fk]) { data.function_points[fk].img = `![${st.id} 原型截图](screenshots/${slug}/${st.id}.png)`; nset++; }
}
fs.writeFileSync(PRDDATA, JSON.stringify(data, null, 2), "utf8");
try {
  const srv = require(SERVER);
  const safe = (data.system_name || "PRD").replace(/[/\\:*?"<>|]/g, "-");
  fs.writeFileSync(path.join(ARCHIVE, `PRD-${safe}.md`), srv.generatePrdMd(data), "utf8");
  console.log(`\n截图 ${ok}/${states.length}；写入 ${nset} 个功能点原型图；PRD 已重生。`);
} catch (e) { console.log(`\n截图 ${ok}/${states.length}，写入 ${nset} 个 fp.img；但重生 PRD 失败（anno-server 路径？）：` + e.message); }
console.log("⚠️ 必须人眼 Read 抽验几张截图，确认渲染正确、弹窗已打开后才算完成（prd 铁律：不侥幸）。");
process.exit(ok ? 0 : 1);
