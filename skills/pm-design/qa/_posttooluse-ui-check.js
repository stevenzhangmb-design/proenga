/* ════════════════════════════════════════════════════════════════════════
   PostToolUse 钩子助手 · _posttooluse-ui-check.js · 【工具强制·不归 AI 管】
   ────────────────────────────────────────────────────────────────────────
   专治 AI 改原型/标注层后【没自己跑浏览器就 present】导致的：页面崩 / JS 报错 /
   重复按钮 / 标注开关被遮挡（今天真犯过 exportPins 重复、2 个恢复标注）。
   机制：每次 Edit/Write 后工具自动调本脚本（不归 AI），脚本看改的是不是原型/标准件：
     · 改了 archive 里 原型*.html → 立刻跑 regression-check.js 浏览器回归(抓崩/报错/重复)，
       红了输出 {decision:block} 把错误甩回 AI，逼它当场修，禁继续。
     · 改了 annotation-layer.html(标准件) → 提醒必须同步所有原型 + bump 版本（Stop 时 ⑰ 验漂移）。
     · 改别的文件 → 静默放行（秒级，不拖慢）。
   通用：按文件名判定，对任意系统/任意原型/打包用户都生效，非充值专用。
   被 settings.json 的 PostToolUse(Edit|Write|MultiEdit) 钩子调用：node _posttooluse-ui-check.js
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs"), path = require("path"), cp = require("child_process");

let input = "";
try { input = fs.readFileSync(0, "utf8"); } catch (e) {}
let payload = {}; try { payload = JSON.parse(input); } catch (e) {}
const ti = payload.tool_input || payload.toolInput || {};
const fp = ti.file_path || ti.filePath || ti.path || "";
if (!fp) process.exit(0);

const isProto = /原型.*\.html$/i.test(fp) && !/分享版|share|\.bak|backup|备份/i.test(fp);
const isStd = /annotation-layer\.html$/i.test(fp);
const HEREQA = __dirname;  // pm-design/qa

if (isStd) {
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: "⚠️ 你改了标注层标准件 annotation-layer.html——按 2 点原则必须：①把这处改动同步进所有原型(offline+online)②bump `__ANNO_LAYER_VERSION__`③跑 deliver-gate。结束时 ⑰ 漂移闸会逐字校验原型是否内嵌最新标准件，别漏同步。确认做完再继续。"
  }));
  process.exit(0);
}
if (!isProto) process.exit(0);
if (!fs.existsSync(fp)) process.exit(0);

// 原型被改 → 浏览器回归（抓页面崩/JS报错/重复元素/标注开关被遮挡）
try {
  cp.execFileSync("node", [path.join(HEREQA, "regression-check.js"), fp], { stdio: "pipe", timeout: 150000 });
} catch (e) {
  const out = e.stdout ? e.stdout.toString() : (e.message || "");
  process.stdout.write(JSON.stringify({
    decision: "block",
    reason: "❌ 你刚改的原型 " + path.basename(fp) + " 跑浏览器回归闸红了（可能：页面崩/Vue 挂不上/JS 报错/重复元素/标注开关被遮挡）——【必须】先修到全绿再继续，禁说\"完成/好了\"：\n" + out.slice(-1200)
  }));
}
process.exit(0);
