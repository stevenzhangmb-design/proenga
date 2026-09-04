/* ════════════════════════════════════════════════════════════════════════
   多项目·灵活输出目录 闸 · archive-multiproject-gate.js · 维护者验收（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   验 anno-server 的 resolveArchiveDirFor：多个项目放在不同目录时，
   每次操作【按 systemName 自动切到该项目所在目录】——绝不把 A 项目写到 B 项目目录。
   （根治"充值在D盘、发票在E盘共用一个服务却互相写错目录"那类问题。）
   做法：造两个临时目录各放一个不同 system_name 的假原型，断言按系统名精准解析到对应目录，
        不匹配的系统名不会错认成其中任一个。
   退出码：0=解析正确 1=切错目录/功能缺失。
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs"), path = require("path"), os = require("os");
const SERVER = process.env.ANNO_SERVER || path.join(__dirname, "..", "..", "..", "..", "anno-server", "server.js");
if (!fs.existsSync(SERVER)) { console.log("（未找到 anno-server/server.js，跳过多项目目录闸）"); process.exit(0); }
let srv; try { srv = require(SERVER); } catch (e) { console.log("✗ 无法加载 server.js：" + e.message); process.exit(1); }
if (typeof srv.resolveArchiveDirFor !== "function") { console.log("✗ server.js 未导出 resolveArchiveDirFor（多项目灵活目录功能缺失/被改坏）"); process.exit(1); }

const root = fs.mkdtempSync(path.join(os.tmpdir(), "multiproj-"));
const dirA = path.join(root, "projA"), dirB = path.join(root, "projB");
fs.mkdirSync(dirA); fs.mkdirSync(dirB);
const SYS_A = "甲系统 · 演示A", SYS_B = "乙系统 · 演示B";
const proto = (sys) => `<!DOCTYPE html><html><body><div id="app"></div><div id="anno-app"></div>\n<script>window.__PRD_DATA__ = {"system_name":"${sys}","function_points":{}};</script></body></html>`;
fs.writeFileSync(path.join(dirA, "原型-A-offline.html"), proto(SYS_A), "utf8");
fs.writeFileSync(path.join(dirB, "原型-B-offline.html"), proto(SYS_B), "utf8");

let ok = true, msg = [];
const cands = [dirA, dirB];
try {
  const rA = srv.resolveArchiveDirFor(SYS_A, cands);
  const rB = srv.resolveArchiveDirFor(SYS_B, cands);
  const rX = srv.resolveArchiveDirFor("不存在的系统_zzz", cands);
  if (path.resolve(rA) !== path.resolve(dirA)) { ok = false; msg.push(`  ✗ 甲系统应解析到 projA，实际=${rA}`); }
  if (path.resolve(rB) !== path.resolve(dirB)) { ok = false; msg.push(`  ✗ 乙系统应解析到 projB，实际=${rB}`); }
  if (path.resolve(rX) === path.resolve(dirA) || path.resolve(rX) === path.resolve(dirB)) { ok = false; msg.push(`  ✗ 不匹配的系统名不应错认成 projA/projB，实际=${rX}`); }
} catch (e) { ok = false; msg.push("  ✗ 解析异常：" + e.message); }
finally { try { fs.rmSync(root, { recursive: true, force: true }); } catch (e) {} }

console.log("\n════════ 多项目·灵活输出目录 闸 ════════");
if (ok) console.log("  ✅ 多项目按 systemName 精准切目录：甲→projA、乙→projB、不匹配不错认 —— 不同项目同时可用、不互相写错目录（充值D盘/发票E盘各自独立）");
else { console.log("  ❌ 多项目目录解析错误："); msg.forEach(m => console.log(m)); }
console.log("════════════════════════════════════════");
process.exit(ok ? 0 : 1);
