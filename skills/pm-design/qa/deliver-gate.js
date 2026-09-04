/* ════════════════════════════════════════════════════════════════════════
   交付总闸 · deliver-gate.js · 一键跑全部闸（根治"靠 AI 自觉逐个跑"）
   ────────────────────────────────────────────────────────────────────────
   把全套机器闸合成【一条命令】：交付任何 PRD 标注 / 原型改动给用户前，
   必须 `node deliver-gate.js` 全绿才准说"完成 / 交付"——红了禁止交付。
   顺序跑（各闸自带 headless Chrome，串行避免端口冲突）；任一红 → 总闸红(退出码1)。
   含：①静态地雷 ②标注层回归 ③PRD生成器单测 ④共享生成器防漂移 ⑤契约 ⑥端到端显示 ⑦全链路可见审计
       ⑨标注控件位置(机器强制放置铁律:内联顶部右侧·不浮层·开关不被遮) ⑩标注可携带性
       ⑧PRD内容合规(prd-content-lint,注入前每pin格式) ⑪PRD结构合规(prd-structure-lint,生成后文档结构/编号/表格/禁词)
       ⑫PRD↔原型字段一致(prd-prototype-field-gate,机器硬拦字段臆造:PRD写了原型没有的字段名)
   注：sync-integration-test 会写 prd-data(污染) 故不纳入；它单独手动跑。
   ════════════════════════════════════════════════════════════════════════ */
const { execFileSync } = require("child_process");
const path = require("path"), fs = require("fs"), os = require("os");
const { findPrdData } = require("./_gate-env");
const QA = __dirname;

const gates = [
  ["①静态地雷扫描", "indom-footgun-lint.js"],
  ["②标注层回归", "regression-check.js"],
  ["③PRD生成器单测", "prd-generator-test.js"],
  ["④共享生成器防漂移", "shared-generator-sync-test.js"],
  ["⑤契约一致", "contract-anno-prototype-test.js"],
  ["⑥端到端显示", "modal-display-e2e-test.js"],
  ["⑦全链路可见审计", "full-pipeline-audit.js"],
  ["⑨标注控件位置", "anno-placement-gate.js"],
  ["⑩标注可携带性", "anno-portability-gate.js"],
  ["⑭圈选采集防退化", "anno-fix-guard.js"],
  ["⑯注入回路①②③(圈选↔注入绑定/填充/新增)", "inject-roundtrip-test.js"],
  ["㉔标注功能真机(默认关/4按钮/圈选/面板/清空/恢复·现装原型)", "anno-functions-e2e-gate.js"],
  ["㉕保存即同步隔离闸(标注改名→本地PRD·临时实例不碰真数据)", "sync-isolated-gate.js"],
  ["㉖删除同步+场景①注入隔离闸(注入→本地PRD/删除→本地PRD·数组格式加固·不碰真数据)", "delete-sync-isolated-gate.js"],
  ["㉗对话框→原型标注实时同步(真机SSE·注入/编辑/删除→原型PIN·不碰真数据)", "dialog-sync-prototype-gate.js"],
  ["㉘原型内编辑/删除→本地PRD(真机·编辑用例规则+🗑删除→本地PRD·不碰真数据)", "pin-edit-delete-sync-gate.js"],
  ["㉙自动截图端到端(真机html2canvas截图→写进PRD原型图·不碰真数据)", "screenshot-capture-gate.js"],
  ["㉚导出分享版行为(真机点导出·没标注也导/有标注也导/只读+嵌入/另存·不碰真数据)", "share-export-behavior-gate.js"],
  ["㉛真实交付物冒烟(直接开真装配版offline文件·离线挂载/默认关/4按钮/圈选/0报错)", "real-deliverable-smoke-gate.js"],
  ["㉜设计令牌对照(默认原型主色#3363FF/警告#F2AC3A/分页config==规范·防停EP默认蓝·自定义规范豁免)", "design-token-gate.js"],
  ["㉝选择一致性+禁手搓(原型==四问所选__DESIGN_CHOICE__·币种/前端栈/语言声明；缺标记且无豁免=疑似手搓判红)", "choice-conformance-gate.js"],
  ["㉞骨架↔规范同步(规范改了骨架必须跟·筛选区宽/表头分页sticky/页签白底/min-width/page-sizes/语言切换器)", "skeleton-spec-sync-gate.js"],
  ["㉟三语完整性(多语原型每条文案真有en/pt·防AI只出中文·单语/legacy跳过)", "i18n-completeness-gate.js"],
  ["㊲共享件纯净(纪律C·项目业务词不许硬编码进共享骨架/标注层·只准出现在注释)", "shared-component-purity-gate.js"],
  ["㊳数据卫生(生成代码地基·禁手写内联样式HTML+禁按钮禁用词[新建/创建/搜索/清空/清除/拒绝]·手搓豁免则警告)", "no-inline-style-data-gate.js"],
  ["㊱全量交互回归(A+B·直接开真交付offline文件·每页每按钮都点·每元素右键必取到真功能名·不得为空/叫功能区)", "full-interaction-regression-gate.js"],
  ["⑰原型↔标准件漂移(新原型内嵌最新标准件)", "prototype-standard-sync-gate.js"],
  ["⑳原型pm-design合规(标注层/PRD源/EP/Vue/锚点≥6/工具条接桥/视图同步/卡片类名C1-C9)", "prototype-pmdesign-gate.js"],
  ["⑱系统归属(禁通用兜底·功能归真实OMS/WMS)", "../../prd/qa/prd-system-attribution-gate.js"],
  ["⑲功能名忠实(禁改名·一字照圈选zoneLabel)", "../../prd/qa/prd-name-fidelity-gate.js"],
  ["㊴工程命名硬卡(禁纯编号/功能区/营销句当fp_name·扫prd-data+原型__PRD_DATA__·与anno-server落名同判定)", "function-name-gate.js"],
  ["㊵anno-server崩溃隔离(重活挪一次性子进程·常驻不碰Chrome/pandoc·writePrdData原子写·fs.watch守卫)", "anno-server-crash-isolation-gate.js"],
];

/* ㊵-b 活体杀进程压力闸：会真反复杀 anno-server 5 次（中断服务·测自愈+数据不坏）。
   有干扰 → 默认不跑，仅 DELIVER_STRESS=1 时纳入（如 `DELIVER_STRESS=1 node deliver-gate.js`）。
   平时用 ㊵（结构+存活）兜；要活体证据时开这个开关。 */
if (process.env.DELIVER_STRESS === "1") {
  gates.push(["㊵-b anno-server杀进程压力闸(活体·反复杀→测自愈+prd-data不坏·中断服务5次)", "anno-server-kill-stress-gate.js"]);
}

const results = [];
/* 🧹 清理僵尸 chrome —— 根治「单跑绿·连跑红」的假红（2026-07-13）
   各浏览器闸自己起 chrome、收尾也 ch.kill() 了，但 **Windows 上 kill() 杀不掉 chrome 的子进程树**：
   残留进程一道道堆积 → 后面的闸起不来浏览器 → 全项判 false → **假红**（⑯注入回路被冤枉过好几次）。
   假红比没有闸更危险：它会训练人把红当"抖动"放行——今天就这么翻过车。
   ⚠️ 只杀 `--user-data-dir` 指向【系统临时目录】的 chrome（那必定是闸自己起的）；
      用户自己的 Chrome 用的是正常 profile，绝不误杀。 */
function killZombieChrome() {
  if (process.platform !== "win32") return;
  try {
    /* 【2026-07-20 硬化·根治假红】旧版用 Stop-Process 只杀【父进程】，Windows 上 chrome 的
       子进程树(gpu / renderer / utility / crashpad)不会跟着死 → 孤儿一道道堆积 → 后面的闸起不来
       浏览器 → 假红(㉛/⑬/⑯ 都被冤过·每轮换一道)。改两点：
         ① 用 `taskkill /PID <pid> /T /F` —— /T 杀【整棵进程树】(根+所有子孙)，不再留孤儿；
         ② 匹配从"只认 --user-data-dir 根进程"扩到"【也认 --headless】"：闸起的 chrome 必是 headless，
            用户自己浏览用的 Chrome 绝不 headless → 既安全(永不误杀用户真 Chrome)、又能捞到
            已丢失 --user-data-dir 的孤儿子进程。兼顾 msedge(部分闸回退 Edge)。
       杀完停 1.5s 等调试端口/profile 文件锁真正释放，下一道闸才不会撞上。 */
    execFileSync("powershell", ["-NoProfile", "-Command",
      "$ps = Get-CimInstance Win32_Process -Filter \"Name='chrome.exe' OR Name='msedge.exe'\" | " +
      "Where-Object { $_.CommandLine -match '--headless' -or $_.CommandLine -match '--user-data-dir=[^ ]*(Temp|tmp)' }; " +
      "foreach ($p in $ps) { & taskkill /PID $p.ProcessId /T /F 2>$null | Out-Null }; " +
      "Start-Sleep -Milliseconds 1500"
    ], { stdio: "ignore", timeout: 30000 });
  } catch (_) {}
}

function run(label, file, args) {
  killZombieChrome();                       // 上一道闸的残留先清干净，再跑这一道
  process.stdout.write("  跑 " + label + " … ");
  try { execFileSync("node", [path.join(QA, file), ...(args || [])], { stdio: "pipe", timeout: 300000 }); console.log("✅"); results.push([label, true]); }
  catch (e) { console.log("❌"); results.push([label, false]); }
}

console.log("\n════════ 交付总闸 deliver-gate ════════");
for (const [label, file] of gates) run(label, file);

// ⑧ 对当前 prd-data 的所有 fp 跑 PRD 内容合规校验器
try {
  const prdPath = findPrdData();
  if (!prdPath) throw new Error("未在 archive 找到 prd-data.json");
  const prd = JSON.parse(fs.readFileSync(prdPath, "utf8").replace(/^﻿/, ""));
  const fps = prd.function_points || {};
  const pins = Object.keys(fps).map(k => ({ fpKey: k, title: fps[k].fp_name, fieldSpecs: fps[k]._draft_fieldSpecs, useCaseRules: fps[k]._draft_useCaseRules }));
  if (pins.length) {
    const tmp = path.join(os.tmpdir(), "delivergate_pins_" + process.pid + ".json");
    fs.writeFileSync(tmp, JSON.stringify({ pins }), "utf8");
    run("⑧PRD内容合规(" + pins.length + "个fp)", "../../prd/qa/prd-content-lint.js", [tmp]);
    try { fs.unlinkSync(tmp); } catch (e) {}
  } else { console.log("  ⑧PRD内容合规 … （prd-data 无 fp，跳过）"); }
} catch (e) { console.log("  ⑧PRD内容合规 … ❌ 读 prd-data 失败: " + e.message); results.push(["⑧PRD内容合规", false]); }

// ⑪ 对生成的 PRD.md 跑结构+内容综合合规闸（prd 全部"能机器判"铁律可执行版；与⑧互补：⑧查注入前每pin格式，⑪查生成后文档结构/编号/表格成型/禁词）
try {
  const prdPath = findPrdData();
  if (!prdPath) throw new Error("未在 archive 找到 prd-data.json");
  const prd = JSON.parse(fs.readFileSync(prdPath, "utf8").replace(/^﻿/, ""));
  const archDir = path.dirname(prdPath);
  // 只校验【当前项目】PRD（按 system_name 配对）；本项目无 PRD 则跳过——绝不回退抓 archive 里其它无关旧 PRD（否则误报别的项目）
  const mdByName = prd.system_name ? path.join(archDir, "PRD-" + prd.system_name + ".md") : null;
  const target = (mdByName && fs.existsSync(mdByName)) ? mdByName : null;
  if (target) {
    run("⑪PRD结构合规(" + path.basename(target) + ")", "../../prd/qa/prd-structure-lint.js", [target]);
    run("⑮原型图/流程图已渲染并嵌入docx", "../../prd/qa/prd-asset-gate.js", [target]);
  }
  else console.log("  ⑪PRD结构合规 … （当前项目无 PRD-<system_name>.md，跳过；不抓其它无关旧 PRD）");
} catch (e) { console.log("  ⑪PRD结构合规 … ❌ " + e.message); results.push(["⑪PRD结构合规", false]); }

// ⑫ PRD↔原型 字段一致性（机器硬拦"字段臆造"：PRD 字段规范里原型根本不存在的字段名=红；PRD-only 无原型则自动跳过）
run("⑫PRD↔原型字段一致", "../../prd/qa/prd-prototype-field-gate.js");

// ⑬ 全新系统 smoke（验"打包后别人画新系统也达到一样效果"：凭空生成全新系统 PRD，断言机械层对任意新系统通用、不误杀标准合规内容）
run("⑬全新系统smoke", "../../prd/qa/fresh-system-smoke.js");

// ⑳ docx 被 Word/WPS 占用·后台自动重试覆盖（验"用户关 Word 后正式 docx 自动覆盖、另存件自动删"，纯 anno-server·随包·原则1+2）
run("㉑docx占用自动重试覆盖", "../../prd/qa/docx-autoretry-test.js");

// ㉒ 多项目输出目录灵活解析（验"充值(D盘)+发票(E盘)同时用不串目录"：按 system_name 各自落各自 archive，不靠切配置）
run("㉒多项目输出目录灵活解析", "../../prd/qa/archive-multiproject-gate.js");

// ㉓ 分享版只读隐藏（验"导出的只读分享版真隐藏编辑控件"：标准件隐藏规则无悬空选择器 bug + 导出函数打 body 只读类）
run("㉓分享版只读隐藏(编辑控件必隐藏)", "share-readonly-gate.js");

const allPass = results.every(r => r[1]);
/* 🔒 绿标记（2026-07-13 加·根治"我没跑全闸就交付"）：
   跑绿 → 写 .deliver-gate-green（含时间戳）；跑红 → 删掉它。
   Stop 钩子据此拦截：骨架/规范/原型比绿标记新 = 改过但没重跑全闸 = 禁止收工。
   这样"present 前必跑 deliver-gate 全绿"就不再靠 AI 自觉，而是机器强制。 */
try {
  const MARK = require('path').join(__dirname, '.deliver-gate-green');
  if (allPass) require('fs').writeFileSync(MARK, JSON.stringify({ at: Date.now(), iso: new Date().toISOString() }), 'utf8');
  else if (require('fs').existsSync(MARK)) require('fs').unlinkSync(MARK);
} catch (_) {}
console.log("──────────────────────────────────");
results.forEach(r => console.log((r[1] ? "  ✓ " : "  ✗ ") + r[0]));
console.log("──────────────────────────────────");
console.log(allPass ? "  交付总闸 全绿 PASS ✅ —— 准予交付" : "  交付总闸 有红 FAIL ❌ —— 禁止交付，先修红的");
console.log("════════════════════════════════════\n");
process.exit(allPass ? 0 : 1);
