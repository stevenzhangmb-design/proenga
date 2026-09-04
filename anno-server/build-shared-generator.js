/* ════════════════════════════════════════════════════════════════════════
   build-shared-generator.js  ·  从 server.js 抽取 PRD 生成器 → prd-generator.js（UMD）
   ────────────────────────────────────────────────────────────────────────
   目的：生成器单一来源 = server.js；prd-generator.js 由本脚本【派生】，供浏览器/node 共用，
        从不手改。server.js 的生成器一改，重跑本脚本即可。是否同步由 qa/shared-generator-sync-test 守。
   运行：node build-shared-generator.js   （改了 server.js 生成器后重跑）
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("path") && require("fs"), path = require("path");
const SERVER = path.join(__dirname, "server.js");
const OUT = path.join(__dirname, "prd-generator.js");
const src = fs.readFileSync(SERVER, "utf8");

// 顶层函数抽取：从 "\nfunction NAME(" 到列0的 "\n}\n"（顶层闭合大括号；内层括号都有缩进）
function extractFn(name) {
  const sig = "\nfunction " + name + "(";
  const start = src.indexOf(sig);
  if (start < 0) throw new Error("未找到函数: " + name);
  const end = src.indexOf("\n}\n", src.indexOf("{", start));
  if (end < 0) throw new Error("未找到闭合: " + name);
  return src.slice(start + 1, end + 2); // 含末行 "}"
}

const NAMES = ["parseFpKey", "mergePinIntoPrd", "prdHeader", "fpMeta", "renderFp", "renderMenuTree", "buildFpSections", "generatePrdMd"];
const bodies = NAMES.map(extractFn).join("\n\n");
const out = `/* ⚠ 自动生成，请勿手改！源 = anno-server/server.js，由 build-shared-generator.js 派生。
   共享 PRD 生成器（isomorphic：node + 浏览器都跑，单一来源）。改生成器请改 server.js 后重跑 build。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.prdGenerator = factory();
})(typeof self !== 'undefined' ? self : this, function () {
${bodies}
  return { parseFpKey, mergePinIntoPrd, prdHeader, generatePrdMd, buildFpSections, fpMeta, renderFp, renderMenuTree };
});
`;
fs.writeFileSync(OUT, out, "utf8");
// 自检：能否 require + generatePrdMd 是否函数
delete require.cache[OUT];
const g = require(OUT);
const okFns = ["generatePrdMd", "mergePinIntoPrd", "buildFpSections"].every(n => typeof g[n] === "function");
console.log("已生成 prd-generator.js（" + out.length + " 字符）；关键函数可用: " + okFns);
process.exit(okFns ? 0 : 1);
