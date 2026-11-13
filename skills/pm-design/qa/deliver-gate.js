/* ════════════════════════════════════════════════════════════════════════
   交付总闸 · deliver-gate.js · 一键跑全部闸（根治"靠 AI 自觉逐个跑"）
   ────────────────────────────────────────────────────────────────────────
   把全套机器闸合成【一条命令】：改了【标准件】（骨架/标注层/host-shell/page-renderer/规范/qa 闸）后、
   交付前必须 `node deliver-gate.js` 全绿才准说"完成 / 交付"——红了禁止交付。任一红 → 总闸红(退出码1)。
   ⚠ 它查的是【工具链本身】（fixture 原型 / 样例 PRD / 各端到端回路），不是用户自己的原型内容。
     只改项目内容（project-data → 重建交付件）时，该跑的是交付件逐页自检（rebuild-deliverable.ps1 -Quick
     后台写 <交付件>.gate-report.txt），Stop 钩子 _stop-hook-prototype-check.js 已按"改了什么"自动分流。
   含：①静态地雷 ②标注层回归 ③PRD生成器单测 ④共享生成器防漂移 ⑤契约 ⑥端到端显示 ⑦全链路可见审计
       ⑨标注控件位置(机器强制放置铁律:内联顶部右侧·不浮层·开关不被遮) ⑩标注可携带性
       ⑧PRD内容合规(prd-content-lint,注入前每pin格式) ⑪PRD结构合规(prd-structure-lint,生成后文档结构/编号/表格/禁词)
       ⑫PRD↔原型字段一致(prd-prototype-field-gate,机器硬拦字段臆造:PRD写了原型没有的字段名)
   注：sync-integration-test 会写 prd-data(污染) 故不纳入；它单独手动跑。

   §2026-11-13 提速（闸的清单、每道闸的判定一条没改；只改"怎么排、怎么清"）：
     ① 三条并行跑道：
        S 纯静态池   —— 机械扫源码判定：不开浏览器、不起子进程、不监听端口、不写文件 → 最多 4 个同时跑；
        A 主跑道     —— 起 anno-server 隔离实例 / 起子进程 / 写临时文件的闸，及所有没列进 B 的浏览器闸，串行；
        B 只读渲染道 —— 白名单 LANE_B：只读原型副本、端口各自独立或探空闲、不碰 anno-server 的浏览器闸，串行。
        新加的闸默认进 A（最保守）；要进 B 必须人工核过并写进 LANE_B。DELIVER_SERIAL=1 退回单跑道串行（排查抖动用）。
     ② 僵尸 Chrome 改为【按进程树精确清】：每道闸跑完，只杀【这道闸自己的子孙】里的 chrome/msedge
        （常驻 PowerShell 助手用 Toolhelp 快照取父子关系·一次约 30ms，替代每次起 powershell + CIM 约 3～6 秒），
        杀完轮询确认进程已退出，不再固定睡 1.5 秒。启动时只清【主人已不在】的孤儿（上一轮崩掉留下的），
        别的会话正在用的 headless Chrome、--rpa-keepalive、--dv-verify-gate-owned 一个不碰。
        助手起不来 → 自动退回旧的串行 + 全清老路（宁可慢，不出假红）。
     ③ 闸输出写进临时日志而不是管道：孤儿进程攥着管道时不会把闸"拖着不结束"；红了把该闸日志尾巴打印出来。
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
  /* ㊿ 2026-11-12 加·根治「导出对接料/一键生成代码直接写进固定目录 archive\对接料、用户没法选保存位置」 */
  ["㊿导出保存位置(导出对接料/一键生成代码由用户选文件夹·先弹框后取内容·服务端无目标=400·禁写死固定目录)", "export-target-gate.js"],
  ["㉛真实交付物冒烟(直接开真装配版offline文件·离线挂载/默认关/4按钮/圈选/0报错)", "real-deliverable-smoke-gate.js"],
  ["㉜设计令牌对照(默认原型主色#3363FF/警告#F2AC3A/分页config==规范·防停EP默认蓝·自定义规范豁免)", "design-token-gate.js"],
  ["㉝选择一致性+禁手搓(原型==四问所选__DESIGN_CHOICE__·币种/前端栈/语言声明；缺标记且无豁免=疑似手搓判红)", "choice-conformance-gate.js"],
  ["㉞骨架↔规范同步(规范改了骨架必须跟·筛选区宽/表头分页sticky/页签白底/min-width/page-sizes/语言切换器)", "skeleton-spec-sync-gate.js"],
  ["㊷布局体检(板块不重叠/不挤/无横向溢出·headless渲染逐页测boundingRect·2026-09-10反挤压根治)", "layout-sanity-gate.js"],
  ["㊺vendor随包(Vue/EP等5个资产在vendor/·离线化先读它不联网·2026-09-16治『每次重建下载1.75MB耗188秒·新机器必须联网』)", "vendor-shipped-gate.js"],
  ["㊸computed样式保真(表头/行/按钮/页签等 逐属性==真系统实测基线·DPR=1·2026-09-15治『只对文字漏样式』)", "computed-style-gate.js"],
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
  /* ㊻ 2026-10-05 加·根治「拷了弹窗没自己点开看一眼就说做完」：
     用户点开【看怎么改】发现弹窗 680px 宽、内容只占 580px，每行右边空一大块。
     既有的闸只验「每页能渲染、无 JS 报错」，弹窗里长什么样一个都不看 —— 我说「自检 PASS」时
     这类问题全漏。这道闸把每个弹窗真打开、真截图、真量，机器判三类毛病：
     右侧大面积留白 / 内容溢出出横向滚动条 / 空弹窗（拷过来忘填或 opens 指错）。 */
  ["㊻弹窗眼验(逐个真打开真量·右侧留白/内容溢出/空弹窗·治『拷了弹窗不看就说做完』)", "dialog-eyeball-gate.js"],
  /* ㊼ 2026-10-27 加·根治「检查工具每次留约 390MB 在 C 盘 Temp·攒到 150GB 把 C 盘撑满·交付检查跑不起来」 */
  /* ㊾ 2026-11-04 加·用户铁律「原型文案全部中文书面用语·不用「」·禁口语简写」 */
  ["㊾原型文案书面用语(项目数据里的中文文案无「」·无口语简写破折号旁注·治『原型文案大白话看不懂』)", "proto-copy-writing-gate.js"],
  ["㊼临时文件铁律(凡用临时目录的工具必接沙盒·退出自动删·治『C盘被检查残留撑满150GB』)", "tmp-cleanup-gate.js"],
  /* 51 2026-11-13 加·根治「后台逐页自检端口写死被残留进程占住→每次假红；报告 GBK 乱码没人看得懂」 */
  ["51逐页自检健康(自检闸端口不写死·只清自己的残留·后台报告UTF-8不乱码·真跑编码链路)", "verify-gate-health-gate.js"],
  /* ㊽ 2026-10-30 加·根治「注入浏览器的模板字符串被注释里的反引号截断·同形状踩两次」 */
  ["㊽工具语法自检(skills/rpa+pm-design+qa 逐个 node --check·治『注释里的反引号截断模板字符串致整个工具跑不起来』)", "rpa-tool-syntax-gate.js"],
];

/* ㊵-b 活体杀进程压力闸：会真反复杀 anno-server 5 次（中断服务·测自愈+数据不坏）。
   有干扰 → 默认不跑，仅 DELIVER_STRESS=1 时纳入（如 `DELIVER_STRESS=1 node deliver-gate.js`）。
   平时用 ㊵（结构+存活）兜；要活体证据时开这个开关。 */
if (process.env.DELIVER_STRESS === "1") {
  gates.push(["㊵-b anno-server杀进程压力闸(活体·反复杀→测自愈+prd-data不坏·中断服务5次)", "anno-server-kill-stress-gate.js"]);
}

const { spawn } = require("child_process");
const results = [];

/* ════════ 判定：哪些闸用浏览器 / 哪些是纯静态 ════════
   §2026-10-14：判定「哪些闸用浏览器」**机械扫源码**（连它 require 的本地文件一起扫），不靠人工名单：
   扫不到/读不了一律当【用浏览器】——宁可多清一次，绝不少清导致假红。
   §2026-11-13：同一套扫描再判「纯静态」：不用浏览器 + 不出现 child_process / 监听端口 / 写删文件。
   纯静态的闸互相之间、和别的跑道之间都没有共享资源，才放进并行池；扫不准一律当【不纯】进主跑道串行。 */
function scanSources(file) {
  const out = [];
  const seen = new Set();
  const stack = [path.join(QA, file)];
  while (stack.length) {
    const f = stack.pop();
    if (seen.has(f)) continue;
    seen.add(f);
    if (!fs.existsSync(f)) { out.push(null); continue; }          // 读不到 → 调用方按保守处理
    const src = fs.readFileSync(f, "utf8");
    out.push(src);
    const re = /require\(\s*['"](\.[^'"]+)['"]\s*\)/g;
    let m;
    while ((m = re.exec(src))) {
      /* 不跟进 `_` 开头的公共工具（_gate-env 里有 findChrome，但绝大多数闸只用它的
         findPrototypes/primaryTarget，跟进去会把纯静态 lint 全误判成"用浏览器"）。
         要真开浏览器，闸自己的代码里必然写出 findChrome / --headless / remote-debugging-port。 */
      if (/[\\/]_[^\\/]*$/.test(m[1])) continue;
      let p = path.resolve(path.dirname(f), m[1]);
      if (!/\.js$/i.test(p)) p += ".js";
      stack.push(p);
    }
  }
  return out;
}
const _browCache = new Map();
function usesBrowser(file) {
  if (_browCache.has(file)) return _browCache.get(file);
  let hit = false;
  try {
    for (const src of scanSources(file)) {
      if (src === null || /headless|remote-debugging-port|findChrome|CHROME_PATH|puppeteer|playwright/i.test(src)) { hit = true; break; }
    }
  } catch (_) { hit = true; }                                 // 出任何岔子 → 保守当用浏览器
  _browCache.set(file, hit);
  return hit;
}
const IMPURE = /child_process|\.listen\(|createServer|require\(\s*['"](?:node:)?(?:http|https|net|dgram|worker_threads|cluster)['"]|writeFile|appendFile|unlink|rename|rmSync|rmdir|mkdir|mkdtemp|copyFile|createWriteStream|\.truncate|process\.chdir/;
/* 机械扫描误判成"不纯"、人工核过确实只读的（2026-11-13）：
   rpa-tool-syntax 只起 `node --check`；tmp-cleanup / anno-server-crash-isolation 是扫别的源码的扫描器，
   命中的是它们正则/注释里的字样；prd-name-fidelity 命中的是变量名 renamed。 */
const STATIC_OK = new Set(["rpa-tool-syntax-gate.js", "tmp-cleanup-gate.js", "anno-server-crash-isolation-gate.js", "prd-name-fidelity-gate.js"]);
function isPureStatic(file) {
  if (STATIC_OK.has(path.basename(file))) return true;
  if (usesBrowser(file)) return false;
  try { return scanSources(file).every(src => src !== null && !IMPURE.test(src)); }
  catch (_) { return false; }
}
/* B 只读渲染道白名单（人工核过·2026-11-13）：每道都只读 qa/fixtures 或 project-data 的【临时副本】、
   不读 archive 里的原型、web/调试端口与 A 道不重叠（或运行时探空闲）、不起 anno-server 隔离实例、不写共享文件。
   ⚠ 读 archive 原型的 ⑦⑨㉛㊱ 留在 A 道：archive 里的原型会被真 anno-server 的 /anno-persist 回写
   （非原子写），实测 ㉛/㊱ 与 A 道并行时同一个充值原型"挂载失败/标注层未启用"、单跑全绿——
   所以它们必须和其它会触发回写的闸串行（顺序同旧版）。新闸一律默认进 A，要进 B 先按上面几条核过再加。 */
const LANE_B = new Set([
  "anno-portability-gate.js",            // ⑩ fixtures/reference-prototype.html·8866/9466
  "layout-sanity-gate.js",               // ㊷ fixtures/vt·探空闲端口·屏蔽 3799
  "computed-style-gate.js",              // ㊸ fixtures/vt·9700 起探空闲
  "dialog-eyeball-gate.js",              // ㊻ 9671+pid%90·自己的 dlgeye- 档案
  "render-fidelity-gate.js",             // ⓵ project-data·9222·装配到临时文件
]);
function laneOf(file) {
  if (isPureStatic(file)) return "S";
  if (process.env.DELIVER_SERIAL === "1") return "A";
  return LANE_B.has(path.basename(file)) ? "B" : "A";
}

/* ════════ 进程助手：常驻 PowerShell，Toolhelp 快照取父子关系（Windows） ════════
   为什么不再每次起 powershell 查 CIM：实测 powershell 空转约 0.9 秒、CIM 查进程约 1.1～1.8 秒，
   再加旧代码杀到东西就固定睡 1.5 秒——19 道浏览器闸前各来一次，总闸墙钟比闸本身多出约 120 秒。
   Toolhelp 快照一次约 30ms，常驻进程只编译一次。 */
const HELPER_PS = String.raw`
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false)
Add-Type -TypeDefinition @"
using System; using System.Text; using System.Runtime.InteropServices;
public static class DgPT {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public struct PE32 { public uint dwSize; public uint cntUsage; public uint th32ProcessID; public IntPtr th32DefaultHeapID; public uint th32ModuleID; public uint cntThreads; public uint th32ParentProcessID; public int pcPriClassBase; public uint dwFlags; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)] public string szExeFile; }
  [DllImport("kernel32.dll", SetLastError = true)] static extern IntPtr CreateToolhelp32Snapshot(uint f, uint p);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32FirstW(IntPtr h, ref PE32 e);
  [DllImport("kernel32.dll", CharSet = CharSet.Unicode)] static extern bool Process32NextW(IntPtr h, ref PE32 e);
  [DllImport("kernel32.dll")] static extern bool CloseHandle(IntPtr h);
  [DllImport("kernel32.dll")] static extern IntPtr OpenProcess(uint a, bool i, uint p);
  [DllImport("kernel32.dll")] static extern bool GetProcessTimes(IntPtr h, out long c, out long e, out long k, out long u);
  public static string Snap() {
    var sb = new StringBuilder();
    IntPtr h = CreateToolhelp32Snapshot(2, 0);
    var e = new PE32(); e.dwSize = (uint)Marshal.SizeOf(typeof(PE32));
    if (Process32FirstW(h, ref e)) do {
      long c = 0, x, k, u; IntPtr ph = OpenProcess(0x1000, false, e.th32ProcessID);
      if (ph != IntPtr.Zero) { GetProcessTimes(ph, out c, out x, out k, out u); CloseHandle(ph); }
      long ms = c > 0 ? (c - 116444736000000000L) / 10000 : 0;
      sb.Append(e.th32ProcessID).Append('|').Append(e.th32ParentProcessID).Append('|').Append(ms).Append('|').Append(e.szExeFile).Append('\n');
    } while (Process32NextW(h, ref e));
    CloseHandle(h);
    return sb.ToString();
  }
}
"@
[Console]::Out.WriteLine('__READY__'); [Console]::Out.Flush()
while ($true) {
  $l = [Console]::In.ReadLine()
  if ($l -eq $null -or $l -eq 'quit') { break }
  if ($l -eq 'snap') { [Console]::Out.Write([DgPT]::Snap()) }
  elseif ($l.StartsWith('kill ')) {
    foreach ($id in $l.Substring(5).Split(' ')) { if ($id) { try { [Diagnostics.Process]::GetProcessById([int]$id).Kill() } catch {} } }
  }
  elseif ($l -eq 'gatechrome') {
    Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" | ForEach-Object {
      $c = '' + $_.CommandLine
      if ($c -match '--rpa-keepalive' -or $c -match '--dv-verify-gate-owned') { return }
      if ($c -match '--headless' -or $c -match '--user-data-dir=[^ ]*(Temp|tmp)') { [Console]::Out.WriteLine('' + $_.ProcessId) }
    }
  }
  [Console]::Out.WriteLine('__END__'); [Console]::Out.Flush()
}
`;
const helper = { proc: null, ready: false, buf: "", q: [], chain: Promise.resolve() };
function startHelper() {
  if (process.platform !== "win32") return Promise.resolve(true);      // 非 Windows 用 ps，不需要助手
  return new Promise(resolve => {
    let done = false;
    const finish = ok => { if (!done) { done = true; resolve(ok); } };
    try {
      const ps1 = path.join(os.tmpdir(), "dg-proc-helper-" + process.pid + ".ps1");
      fs.writeFileSync(ps1, "﻿" + HELPER_PS, "utf8");
      const p = spawn("powershell", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", ps1],
                      { stdio: ["pipe", "pipe", "ignore"], windowsHide: true });
      helper.proc = p;
      p.on("error", () => finish(false));
      p.on("exit", () => { helper.ready = false; while (helper.q.length) helper.q.shift()(null); finish(false); });
      p.stdout.setEncoding("utf8");
      p.stdout.on("data", d => {
        helper.buf += d;
        if (!helper.ready) {
          const i = helper.buf.indexOf("__READY__");
          if (i < 0) return;
          helper.buf = helper.buf.slice(helper.buf.indexOf("\n", i) + 1);
          helper.ready = true; finish(true);
        }
        let i;
        while ((i = helper.buf.indexOf("__END__")) >= 0) {
          const body = helper.buf.slice(0, i);
          const nl = helper.buf.indexOf("\n", i);
          helper.buf = nl >= 0 ? helper.buf.slice(nl + 1) : "";
          const cb = helper.q.shift(); if (cb) cb(body);
        }
      });
      setTimeout(() => finish(false), 30000);
    } catch (_) { finish(false); }
  });
}
function helperReq(cmd, timeoutMs) {
  /* 两条跑道可能同时来问：串成队，一问一答 */
  const job = helper.chain.then(() => new Promise(resolve => {
    if (!helper.ready || !helper.proc) return resolve(null);
    let fired = false;
    const cb = body => { if (!fired) { fired = true; clearTimeout(tm); resolve(body); } };
    const tm = setTimeout(() => { fired = true; const k = helper.q.indexOf(cb); if (k >= 0) helper.q.splice(k, 1); resolve(null); }, timeoutMs || 15000);
    helper.q.push(cb);
    try { helper.proc.stdin.write(cmd + "\n"); } catch (_) { cb(null); }
  }));
  helper.chain = job.catch(() => {});
  return job;
}
function stopHelper() { try { helper.proc && helper.proc.stdin.write("quit\n"); } catch (_) {} try { helper.proc && helper.proc.kill(); } catch (_) {} }

async function snapshot() {
  if (process.platform === "win32") {
    const body = await helperReq("snap");
    if (body == null) return null;
    return body.split(/\r?\n/).map(l => l.split("|")).filter(a => a.length >= 4)
      .map(a => ({ pid: +a[0], ppid: +a[1], start: +a[2], name: a.slice(3).join("|").toLowerCase() }));
  }
  try {
    return require("child_process").execFileSync("ps", ["-A", "-o", "pid=,ppid=,comm="], { encoding: "utf8", timeout: 10000 })
      .split("\n").map(l => /^\s*(\d+)\s+(\d+)\s+(.*)$/.exec(l)).filter(Boolean)
      .map(m => ({ pid: +m[1], ppid: +m[2], start: 0, name: m[3].trim().toLowerCase() }));
  } catch (_) { return null; }
}
const isBrowserProc = n => /(^|[\\/])(chrome|msedge|chromium|google chrome|microsoft edge)(\.exe)?$/i.test(n) || /chrome|msedge|chromium/i.test(n);
const sleepMs = ms => new Promise(r => setTimeout(r, ms));
async function killPids(pids) {
  if (!pids.length) return;
  if (process.platform === "win32") await helperReq("kill " + pids.join(" "));
  else for (const p of pids) { try { process.kill(p, "SIGKILL"); } catch (_) {} }
  /* 不再固定睡 1.5 秒：轮询到进程真退出（端口 / profile 锁随进程释放）就走，最多等 5 秒 */
  for (let t = 0; t < 50 && pids.some(pidAlive); t++) await sleepMs(100);
}
/* 只清【这道闸自己的子孙】里的浏览器进程（闸已退出，它的子孙就是它的残留）。
   防 PID 复用：子孙的创建时间不得早于这道闸开跑时间（2 秒容差）。 */
async function reapDescendants(rootPid, startedAt) {
  const rows = await snapshot();
  if (!rows) return { ok: false, n: 0 };
  const kids = new Map();
  for (const r of rows) { if (!kids.has(r.ppid)) kids.set(r.ppid, []); kids.get(r.ppid).push(r); }
  const victims = [];
  const stack = [rootPid], seen = new Set([rootPid]);
  while (stack.length) {
    const cur = stack.pop();
    for (const c of kids.get(cur) || []) {
      if (seen.has(c.pid) || c.pid === process.pid) continue;
      if (c.start && c.start < startedAt - 2000) continue;          // 比这道闸还老 = PID 复用的别人，跳过
      seen.add(c.pid); stack.push(c.pid);
      if (isBrowserProc(c.name)) victims.push(c.pid);
    }
  }
  await killPids(victims);
  return { ok: true, n: victims.length };
}
/* 启动时清一次：只清【主人已不在】的闸用 Chrome（上一轮崩掉 / 被强杀留下的孤儿）。
   旧做法会把机器上所有 headless Chrome 都杀掉——包括别的会话正在跑的闸，等于替别人制造假红。 */
async function reapOrphansAtStart() {
  if (process.platform !== "win32") return 0;
  const body = await helperReq("gatechrome", 30000);
  if (body == null) return 0;
  const cand = new Set(body.split(/\r?\n/).map(s => +s.trim()).filter(Boolean));
  if (!cand.size) return 0;
  const rows = await snapshot();
  if (!rows) return 0;
  const byPid = new Map(rows.map(r => [r.pid, r]));
  const victims = [];
  for (const pid of cand) {
    /* 沿父链往上走过所有浏览器进程，找到浏览器树的根；根的父进程不在（或 PID 已被晚出生的进程复用）= 孤儿 */
    let cur = byPid.get(pid), guard = 0;
    if (!cur) continue;
    while (guard++ < 50) {
      const par = byPid.get(cur.ppid);
      if (par && isBrowserProc(par.name) && !(par.start && cur.start && par.start > cur.start)) { cur = par; continue; }
      const orphan = !par || (par.start && cur.start && par.start > cur.start);
      if (orphan) victims.push(pid);
      break;
    }
  }
  await killPids(victims);
  return victims.length;
}

/* 旧路（助手起不来时的兜底，原样保留）：杀所有【闸起的】headless Chrome。只在单跑道串行时用。 */
function killZombieChromeLegacy() {
  if (process.platform !== "win32") return;
  try {
    require("child_process").execFileSync("powershell", ["-NoProfile", "-Command",
      "$ps = @(Get-CimInstance Win32_Process -Filter \"Name='chrome.exe' OR Name='msedge.exe'\" | " +
      "Where-Object { $_.CommandLine -notmatch '--rpa-keepalive' -and $_.CommandLine -notmatch '--dv-verify-gate-owned' -and " +
      "  ($_.CommandLine -match '--headless' -or $_.CommandLine -match '--user-data-dir=[^ ]*(Temp|tmp)') }); " +
      "foreach ($p in $ps) { & taskkill /PID $p.ProcessId /T /F 2>$null | Out-Null }; " +
      "if ($ps.Count -gt 0) { Start-Sleep -Milliseconds 1500 }"
    ], { stdio: "ignore", timeout: 30000 });
  } catch (_) {}
}

const GATE_TIMEOUT = 300000;
let _legacy = false;          // 助手起不来 → true：单跑道串行 + 旧全清
let _legacyDirty = false;
const LOGDIR = (() => { try { return fs.mkdtempSync(path.join(os.tmpdir(), "dg-logs-")); } catch (_) { return os.tmpdir(); } })();

function tailOf(file, n) {
  try { return fs.readFileSync(file, "utf8").split(/\r?\n/).filter(l => l.trim()).slice(-n); } catch (_) { return []; }
}
async function runGate(job) {
  const { label, file, args, lane } = job;
  const brow = usesBrowser(file);
  if (_legacy && brow && _legacyDirty) killZombieChromeLegacy();
  const log = path.join(LOGDIR, "g" + job.idx + ".log");
  let fd = null;
  try { fd = fs.openSync(log, "w"); } catch (_) {}
  const t0 = Date.now();
  const r = await new Promise(resolve => {
    let timedOut = false, settled = false;
    /* stdout/stderr 直接写文件（不走管道）：闸自己退出就算结束，不会被攥着管道的孤儿进程拖住 */
    const ch = spawn("node", [path.join(QA, file), ...(args || [])],
                     { stdio: ["ignore", fd === null ? "ignore" : fd, fd === null ? "ignore" : fd], windowsHide: true });
    const tm = setTimeout(() => {
      timedOut = true;
      try {
        if (process.platform === "win32") require("child_process").execFileSync("taskkill", ["/PID", String(ch.pid), "/T", "/F"], { stdio: "ignore", timeout: 15000 });
        else ch.kill("SIGKILL");
      } catch (_) {}
    }, GATE_TIMEOUT);
    const done = code => { if (settled) return; settled = true; clearTimeout(tm); resolve({ ok: code === 0 && !timedOut, timedOut, pid: ch.pid }); };
    ch.on("exit", code => done(code));
    ch.on("error", () => done(-1));
  });
  try { if (fd !== null) fs.closeSync(fd); } catch (_) {}
  const ms = Date.now() - t0;
  let reaped = 0;
  if (lane !== "S") {
    if (_legacy) { if (brow) _legacyDirty = true; }
    else { const rr = await reapDescendants(r.pid, t0); reaped = rr.n; }
  }
  /* §2026-10-29 把【超时红】和【真红】分开报：照样算红（不放行），但写清"疑似被争抢，单跑复验"。 */
  console.log("  [" + lane + "] " + (r.ok ? "✅" : (r.timedOut ? "⏱" : "❌")) + " " + (ms / 1000).toFixed(1).padStart(5) + "s  " + label +
              (r.timedOut ? "  ← 超时（疑似被别的实例抢资源，单跑这一道复验）" : "") +
              (reaped ? "  （清残留浏览器进程 " + reaped + " 个）" : ""));
  if (!r.ok) tailOf(log, 25).forEach(l => console.log("        │ " + l.slice(0, 220)));
  results.push({ idx: job.idx, label, ok: r.ok, ms, timedOut: r.timedOut, lane });
}

/* 诊断用：`DELIVER_LIST=1 node deliver-gate.js` 只打印每道闸分到哪条跑道就退出。
   判错会导致假红（并行撞资源）或白等，所以要能一眼核对，不靠猜。 */
if (process.env.DELIVER_LIST === "1") {
  const by = { S: [], A: [], B: [] };
  for (const [label, file] of gates) by[laneOf(file)].push((usesBrowser(file) ? "浏览器 " : "       ") + file + "  ← " + label.slice(0, 30));
  console.log("\nS 纯静态并行池 " + by.S.length + " 道："); by.S.forEach(x => console.log("  " + x));
  console.log("\nA 主跑道(串行) " + by.A.length + " 道："); by.A.forEach(x => console.log("  " + x));
  console.log("\nB 只读渲染道(串行·与 A 并行) " + by.B.length + " 道："); by.B.forEach(x => console.log("  " + x));
  console.log("\n（另有 ⑧/㊿/⓵/⑪/⑮/⑫/⑬/㉑/㉒/㉓ 按项目现场拼参数，同一规则分道）");
  process.exit(0);
}

/* ════════ 互斥锁：同一台机器上【只许一个总闸实例在跑】 ════════
   §2026-10-29 根治假红。事故经过：两个会话同时跑总闸，㊱全量交互回归（要打开真交付件、
   每页每按钮都点，是最重的一道）卡到 300.0 秒整判红，两边各白跑 10 分钟、都拿到假红；
   等另一边停手后单跑同一道只要 7.7 秒。
   清单 #18 那次只修了【端口争用】（跑前探空闲端口），没解决【两个实例互抢浏览器】——
   同一个病从另一个入口复发了。
   为什么非治不可：假红比没有闸更危险，它会训练人把红当"抖动"放行，那整套机器闸就废了。
   做法：抢不到锁就【排队等】，而不是硬跑制造假红；等不到就明确退出并说清原因，
   绝不以"跑过了"的姿态给出一个不可信的结论。 */
const LOCK = path.join(QA, ".deliver-gate.lock");
const LOCK_WAIT_MS = 20 * 60 * 1000;   // 全闸最长约 8 分钟，排一个队给到 20 分钟

function pidAlive(pid) {
  try { process.kill(pid, 0); return true; } catch (e) { return e.code === "EPERM"; }
}
function readLock() {
  /* ⚠️ 必须 strip BOM：带 BOM 的锁文件会让 JSON.parse 抛错 → 被当成"没有锁"直接抢占，
     互斥就静默失效了（2026-10-29 自测时正是这样漏过去的）。锁读不出来宁可当它存在，
     也不能当它不存在 —— 前者最多多等一会儿，后者直接回到双实例互抢的假红。 */
  let raw;
  try { raw = fs.readFileSync(LOCK, "utf8"); } catch (_) { return null; }   // 文件不存在 = 真没锁
  try { return JSON.parse(raw.replace(/^﻿/, "")); }
  catch (_) {
    /* 内容坏了（被别的工具写过、编码不对…）：按【有锁】处理，但用文件时间兜底 ——
       比全闸最长耗时还老的坏锁，视为残留可以抢占，否则会永久卡住所有人。 */
    let age = Infinity;
    try { age = Date.now() - fs.statSync(LOCK).mtimeMs; } catch (_) {}
    return { corrupt: true, ageMs: age, started: "(锁文件内容坏了)" };
  }
}
const STALE_MS = 30 * 60 * 1000;   // 全闸最长约 8 分钟，30 分钟还在就肯定是残留
function acquireLock() {
  const t0 = Date.now();
  let told = false;
  for (;;) {
    const cur = readLock();
    /* 可以抢占的三种情况：① 没有锁 ② 持有者已不在（强杀/断电留下的残锁）
       ③ 锁内容坏了【而且】已经比全闸最长耗时还老（否则按有锁等着） */
    const grabbable = !cur
      || (cur.corrupt ? cur.ageMs > STALE_MS : (!cur.pid || !pidAlive(cur.pid)));
    if (grabbable) {
      if (cur && cur.corrupt) console.log("  （清掉一把坏锁：内容无法解析且已放了 " + Math.round(cur.ageMs / 60000) + " 分钟）");
      else if (cur && cur.pid) console.log("  （清掉一把残锁：pid " + cur.pid + " 已不在）");
      try { fs.writeFileSync(LOCK, JSON.stringify({ pid: process.pid, started: new Date().toISOString() }), "utf8"); }
      catch (e) { console.log("  ⚠ 写不了锁文件（" + e.message + "），继续跑但不互斥"); return false; }
      /* 复读一次确认是自己拿到的（两个实例同一刻写，后写的赢；复读能发现自己被覆盖） */
      const back = readLock();
      if (back && back.pid === process.pid) return true;
      continue;
    }
    if (cur.pid === process.pid) return true;
    const waited = Date.now() - t0;
    if (waited > LOCK_WAIT_MS) {
      console.error("\n❌ 等了 " + Math.round(waited / 60000) + " 分钟，另一个总闸实例（pid " + (cur.pid || "?") +
                    "，起于 " + cur.started + "）还在跑。");
      console.error("   没有硬跑 —— 硬跑会互抢浏览器，两边都得到假红（2026-10-29 实测 ㊱ 7.7s → 300s 超时）。");
      console.error("   等它跑完再来，或确认那个进程已经僵死后删掉 " + LOCK);
      process.exit(2);
    }
    if (!told) {
      console.log("  ⏳ 另一个总闸实例在跑（pid " + (cur.pid || "?") + "，起于 " + cur.started + "），排队等它 ——");
      console.log("     不硬跑的原因：两个实例互抢浏览器会让最重的那几道闸超时，双方都拿到假红。");
      told = true;
    }
    /* 同步睡 5 秒：这里必须同步（整个总闸是同步流程），而 Atomics.wait 零开销，
       不必为了睡一会儿去起一个 node 进程 */
    try { Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 5000); } catch (_) {}
  }
}
function releaseLock() {
  const cur = readLock();
  if (cur && cur.pid === process.pid) { try { fs.unlinkSync(LOCK); } catch (_) {} }
}

console.log("\n════════ 交付总闸 deliver-gate ════════");
/* §2026-10-30：RPA 抓取会长时间占满浏览器，这期间跑闸会被拖慢好几倍
   （实测 260 秒 → 1855 秒），而闸这边完全看不出原因，只会以为闸自己变慢了。
   互斥锁管的是"闸和闸之间"，管不到 RPA 任务——所以这里只做告知，不阻塞：
   RPA 抓取动辄几小时，让闸干等并不现实；但人得知道慢是为什么。 */
let _rpaBusy = null;
try {
  const busyFile = path.join(os.homedir(), ".proenga-rpa-busy");
  const j = JSON.parse(fs.readFileSync(busyFile, "utf8"));
  let alive = false;
  try { process.kill(j.pid, 0); alive = true; } catch (e) { alive = (e.code === "EPERM"); }
  if (alive) {
    _rpaBusy = j;
    console.log("  ⚠ 检测到有 RPA 抓取在跑（pid " + j.pid + " · " + (j.任务 || "") + " · 起于 " + j.开始 + "）");
    console.log("     它占满浏览器会带来两件事：① 本次闸耗时明显变长（实测 260 秒 → 1138 秒）；");
    console.log("     ② **可能把本来全绿的闸判红**（2026-10-30 实测：④共享生成器防漂移在并行时红，");
    console.log("        单跑却 17.7 秒全绿——而且它不是超时红，所以超时识别也兜不住）。");
    console.log("     建议：要么等 RPA 抓完再跑闸，要么红了之后无干扰复验一次再下结论。");
  }
} catch (_) {}
const _held = acquireLock();
if (_held) {
  process.on("exit", releaseLock);
  for (const sig of ["SIGINT", "SIGTERM", "SIGBREAK"]) {
    try { process.once(sig, () => { releaseLock(); process.exit(130); }); } catch (_) {}
  }
}

/* ════════ 拼出全部任务（顺序 = 报告顺序；跑道只决定"怎么排"，不改任何一道闸的判定） ════════ */
const jobs = [];
const addJob = (label, file, args, cleanup) => jobs.push({ idx: jobs.length, label, file, args: args || [], cleanup });
const preFail = [];            // 拼参数阶段就失败的项（照旧记红）
for (const [label, file] of gates) addJob(label, file);

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
    addJob("⑧PRD内容合规(" + pins.length + "个fp)", "../../prd/qa/prd-content-lint.js", [tmp], () => { try { fs.unlinkSync(tmp); } catch (e) {} });
  } else { console.log("  ⑧PRD内容合规 … （prd-data 无 fp，跳过）"); }
} catch (e) { console.log("  ⑧PRD内容合规 … ❌ 读 prd-data 失败: " + e.message); preFail.push("⑧PRD内容合规"); }

/* ㊿ 列表标配闸（2026-11-04 加）：勾选列 / 导出 / 列配置 / 刷新，四件缺一即红。
   （编号用 ㊿ 不用 ㊾ —— ㊾ 已被「原型文案书面用语」占了，两道同号在报告里没法区分）
   为什么要在这里显式喂源：这道闸**只查传进来的 project-data**，自己不去扫历史项目
   —— 一道 2026-11-04 才定的规范，不该让所有存量原型当场集体变红。
   源的来源按优先级：① 命令行 --project-data ② 环境变量 DELIVER_PROJECT_DATA
   ③ ledgers.txt 里**最近改动**的那一个（就是"我现在在做的那个项目"）。
   一个都找不到就跳过并说明，不假装查过。 */
try {
  const argIdx = process.argv.indexOf("--project-data");
  let src = argIdx > 0 ? process.argv[argIdx + 1] : (process.env.DELIVER_PROJECT_DATA || "");
  /* §2026-11-04 实测修：源是**显式传进来的**还是**从 ledgers 猜的**，判红规则不一样。
     显式传入 = "我就是在做这个" → 判红；猜来的 → 只警告。 */
  let explicit = !!src;
  if (!src) {
    const led = path.resolve(__dirname, "../../../.claude/ledgers.txt");
    if (fs.existsSync(led)) {
      const cands = [];
      fs.readFileSync(led, "utf8").split(/\r?\n/).map(s => s.trim()).filter(Boolean).forEach(line => {
        const dir = path.dirname(line);
        if (!fs.existsSync(dir)) return;
        try {
          fs.readdirSync(dir)
            .filter(f => /project-data.*\.json$/i.test(f) && !/\.(audit-base|annotations|bak|backup)\.json$/i.test(f))
            .forEach(f => { const p = path.join(dir, f); cands.push({ p, m: fs.statSync(p).mtimeMs }); });
        } catch (_) {}
      });
      cands.sort((a, b) => b.m - a.m);
      if (cands.length) src = cands[0].p;
    }
  }
  if (src && fs.existsSync(src)) {
    const wo = explicit ? [] : ["--warn-only"];
    const tag = explicit ? "" : "·存量只警告";
    addJob("㊿列表标配(勾选列/导出/列配置/刷新·" + path.basename(src) + tag + ")", "list-standard-gate.js", [src, ...wo]);
    /* ⓵ 渲染保真闸（2026-11-04 加）：㊿ 查「project-data 里写没写」，这一道查「渲染出来对不对」。 */
    addJob("⓵渲染保真(逐页在浏览器里抽真实渲染·对某 OMS/WMS实测基线·治『配置写对了却没渲染出来』" + tag + ")", "render-fidelity-gate.js", [src, ...wo]);
  }
  else console.log("  ㊿列表标配 / ⓵渲染保真 … （没找到当前项目的 project-data，跳过——只查显式传入的源）");
} catch (e) { console.log("  ㊿列表标配 … ❌ " + e.message); preFail.push("㊿列表标配"); }

// ⑪ 对生成的 PRD.md 跑结构+内容综合合规闸（与⑧互补：⑧查注入前每pin格式，⑪查生成后文档结构/编号/表格成型/禁词）
try {
  const prdPath = findPrdData();
  if (!prdPath) throw new Error("未在 archive 找到 prd-data.json");
  const prd = JSON.parse(fs.readFileSync(prdPath, "utf8").replace(/^﻿/, ""));
  const archDir = path.dirname(prdPath);
  // 只校验【当前项目】PRD（按 system_name 配对）；本项目无 PRD 则跳过——绝不回退抓 archive 里其它无关旧 PRD
  const mdByName = prd.system_name ? path.join(archDir, "PRD-" + prd.system_name + ".md") : null;
  const target = (mdByName && fs.existsSync(mdByName)) ? mdByName : null;
  if (target) {
    addJob("⑪PRD结构合规(" + path.basename(target) + ")", "../../prd/qa/prd-structure-lint.js", [target]);
    addJob("⑮原型图/流程图已渲染并嵌入docx", "../../prd/qa/prd-asset-gate.js", [target]);
  }
  else console.log("  ⑪PRD结构合规 … （当前项目无 PRD-<system_name>.md，跳过；不抓其它无关旧 PRD）");
} catch (e) { console.log("  ⑪PRD结构合规 … ❌ " + e.message); preFail.push("⑪PRD结构合规"); }

addJob("⑫PRD↔原型字段一致", "../../prd/qa/prd-prototype-field-gate.js");          // 机器硬拦"字段臆造"
addJob("⑬全新系统smoke", "../../prd/qa/fresh-system-smoke.js");                    // 打包后别人画新系统也达到一样效果
addJob("㉑docx占用自动重试覆盖", "../../prd/qa/docx-autoretry-test.js");
addJob("㉒多项目输出目录灵活解析", "../../prd/qa/archive-multiproject-gate.js");
addJob("㉓分享版只读隐藏(编辑控件必隐藏)", "share-readonly-gate.js");

/* 交付件逐页自检报告（只做告知，不改总闸判定）：总闸不查用户自己的原型内容，查内容的是这份报告 */
function deliverableReportNote() {
  const d = process.argv.slice(2).find(a => /\.html?$/i.test(a));
  if (!d) return;
  let line = "";
  try { line = (fs.readFileSync(d + ".gate-report.txt", "utf8").replace(/^﻿/, "").split(/\r?\n/)[0] || "").trim(); } catch (_) {}
  let fresh = false;
  try { fresh = fs.statSync(d + ".gate-report.txt").mtimeMs >= fs.statSync(d).mtimeMs; } catch (_) {}
  console.log("  ℹ 交付件逐页自检报告（总闸不查交付件内容，这份才查）：" +
              (line ? line.slice(0, 60) + (fresh ? "" : "  ← 比交付件旧，需重跑") : "没有报告（rebuild-deliverable.ps1 -Quick 会在后台生成）"));
}

async function main() {
  const _t0 = Date.now();
  /* 助手和纯静态池同时起步：助手编译约 2～4 秒，纯静态闸不需要它 */
  const helperP = startHelper();
  for (const j of jobs) j.lane = laneOf(j.file);
  const statics = jobs.filter(j => j.lane === "S");
  const poolP = (async () => {
    const q = statics.slice();
    const N = Math.max(1, Math.min(4, (os.cpus() || []).length >> 2 || 1));
    await Promise.all(Array.from({ length: N }, async () => { while (q.length) await runGate(q.shift()); }));
  })();
  const ok = await helperP;
  if (!ok) {
    _legacy = true;
    console.log("  ⚠ 进程助手没起来 → 退回旧路：单跑道串行 + 旧的全清僵尸（更慢，但不会因为并行出假红）");
    for (const j of jobs) if (j.lane === "B") j.lane = "A";
    killZombieChromeLegacy();
  } else {
    const n = await reapOrphansAtStart();             // 启动清一次：只清上一轮崩掉留下的孤儿
    if (n) console.log("  （启动清理：上一轮留下的孤儿浏览器进程 " + n + " 个）");
  }
  const lane = name => (async () => { for (const j of jobs.filter(x => x.lane === name)) await runGate(j); })();
  await Promise.all([poolP, lane("A"), lane("B")]);
  /* §2026-11-13 并行红 → 单跑复验：三道并行时机器负载高（加上别的会话也在跑浏览器），重闸可能因等待超时假红
     （实测 ㉛ 并行 25.5s 红、单跑 14.1s 绿）。所以红项在所有跑道结束后【逐道单跑】一次——这时没有任何别的闸在跑，
     等于旧版的串行条件。单跑仍红 = 真红，照样判红、照样禁交付；单跑绿也会在报告里点名"并行时红过"，不悄悄吞掉。
     成片红（>5 道）不复验：那是真问题或环境坏了，直接按红算。 */
  const firstRed = results.filter(r => !r.ok);
  if (firstRed.length && firstRed.length <= 5) {
    console.log("  ── 并行时红了 " + firstRed.length + " 道 → 逐道【单跑】复验（此刻没有别的闸在跑）；单跑仍红 = 真红 ──");
    for (const r of firstRed) await runGate(Object.assign({}, jobs[r.idx], { lane: "R" }));
  } else if (firstRed.length) console.log("  ── 红了 " + firstRed.length + " 道（>5），不复验，全部按红算 ──");
  for (const j of jobs) if (j.cleanup) j.cleanup();
  stopHelper();
  report(_t0);
}

function report(_t0) {
  /* 同一道闸若复验过，以【单跑】结果为准；并行时红过的打上标记，报告里点名 */
  const byIdx = new Map();
  for (const r of results) {
    const prev = byIdx.get(r.idx);
    byIdx.set(r.idx, prev ? Object.assign({}, r, { redInParallel: !prev.ok, parallelMs: prev.ms, lane: prev.lane + "→单跑" }) : r);
  }
  const rows = [...byIdx.values()].sort((a, b) => a.idx - b.idx);
  preFail.forEach(l => rows.push({ label: l, ok: false, ms: 0, timedOut: false }));
  const allPass = rows.length > 0 && rows.every(r => r.ok) && byIdx.size === jobs.length;
  /* 🔒 绿标记（2026-07-13 加·根治"我没跑全闸就交付"）：
     跑绿 → 写 .deliver-gate-green（含时间戳）；跑红 → 删掉它。
     Stop 钩子据此拦截：标准件比绿标记新 = 改过但没重跑全闸 = 禁止收工。 */
  try {
    const MARK = path.join(__dirname, ".deliver-gate-green");
    if (allPass) fs.writeFileSync(MARK, JSON.stringify({ at: Date.now(), iso: new Date().toISOString() }), "utf8");
    else if (fs.existsSync(MARK)) fs.unlinkSync(MARK);
  } catch (_) {}
  console.log("──────────────────────────────────");
  rows.forEach(r => console.log((r.ok ? "  ✓ " : (r.timedOut ? "  ⏱ " : "  ✗ ")) + r.label + (r.ms ? "  (" + (r.ms / 1000).toFixed(1) + "s)" : "") +
                               (r.redInParallel ? (r.ok ? "  ← 并行时红（" + (r.parallelMs / 1000).toFixed(1) + "s），单跑复验绿" : "  ← 并行红 + 单跑复验仍红 = 真红") : "")));
  /* §2026-10-14 加耗时榜：以前只知道"全闸很慢"，不知道慢在哪一道，就只能凭感觉优化。 */
  const timed = rows.filter(r => r.ms).sort((a, b) => b.ms - a.ms).slice(0, 8);
  if (timed.length) {
    console.log("──────── 最慢 8 道（优化先看这里）────────");
    timed.forEach(r => console.log("  " + (r.ms / 1000).toFixed(1).padStart(6) + "s  [" + r.lane + "] " + r.label.slice(0, 60)));
    const sum = results.reduce((s, r) => s + (r.ms || 0), 0);
    const laneSum = l => results.filter(r => r.lane === l).reduce((s, r) => s + (r.ms || 0), 0) / 1000;
    console.log("  闸本身合计 " + (sum / 1000).toFixed(1) + "s（S " + laneSum("S").toFixed(1) + " / A " + laneSum("A").toFixed(1) + " / B " + laneSum("B").toFixed(1) +
                "）／ 总墙钟 " + ((Date.now() - _t0) / 1000).toFixed(1) + "s（三道并行，墙钟≈最长那条跑道）");
  }
  console.log("──────────────────────────────────");
  const flaky = rows.filter(r => r.redInParallel && r.ok);
  if (flaky.length) console.log("  ⚠ 并行时红、单跑绿的 " + flaky.length + " 道：" + flaky.map(r => r.label.slice(0, 16)).join("、") + " —— 判绿，但说明机器当时负载高（常见于别的会话同时在跑浏览器）。");
  deliverableReportNote();
  const to = rows.filter(r => !r.ok && r.timedOut);
  const realRed = rows.filter(r => !r.ok && !r.timedOut);
  console.log(allPass ? "  交付总闸 全绿 PASS ✅ —— 准予交付" : "  交付总闸 有红 FAIL ❌ —— 禁止交付，先修红的");
  if (!allPass && _rpaBusy) {
    console.log("  ⚠ 本次跑闸期间有 RPA 抓取并行（pid " + _rpaBusy.pid + " · " + (_rpaBusy.任务 || "") + "）。");
    console.log("     **先无干扰复验一次再动手修**——2026-10-30 实测过一次：并行时 ④ 判红，单跑全绿。");
  }
  if (realRed.length) console.log("  红了先单跑那一道复验（node qa/<那道闸>.js）；单跑也红 = 真缺陷。并行嫌疑可 DELIVER_SERIAL=1 全串行再跑一次对照。");
  if (to.length) {
    console.log("  ⏱ 其中 " + to.length + " 道是【超时】而不是查出了缺陷：" + to.map(r => r.label.slice(0, 18)).join("、"));
    console.log("     先单跑那一道复验（node qa/<那道闸>.js <原型>）：单跑能过 = 被别的进程抢了资源，不是真缺陷。");
    if (!realRed.length) console.log("     本次没有任何一道查出真缺陷 —— 全部红项都是超时。");
  }
  console.log("════════════════════════════════════\n");
  process.exit(allPass ? 0 : 1);
}

main().catch(e => { console.error("总闸自身出错：" + (e && e.stack || e)); try { stopHelper(); } catch (_) {} try { fs.unlinkSync(path.join(__dirname, ".deliver-gate-green")); } catch (_) {} process.exit(1); });
