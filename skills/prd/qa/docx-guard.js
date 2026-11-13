#!/usr/bin/env node
/*
 * docx-guard.js — 用户改过的 Word 以 Word 为准，不许被 md 重新生成覆盖（2026-11-06 用户明令）
 *
 * 原理：每次由 md 生成 Word 后，记下这份 Word 的指纹（SHA-256），存在同目录的隐藏文件
 *       .<Word 文件名>.gen 里。下次生成前先比对：Word 的指纹和记录不同 = 生成之后有人改过 Word
 *       = 判为“用户改过 Word”，拒绝覆盖，并列出 Word 和 md 的文字差异，供先把 Word 的改动同步回 md。
 *       没有指纹记录的旧 Word：退回按文字比对，Word 里有、md 里没有的句子 > 0 也拒绝覆盖。
 *
 * 用法：
 *   node docx-guard.js check <docx> <md>   # 0=可以覆盖；3=用户改过 Word，禁止覆盖（打印差异）
 *   node docx-guard.js stamp <docx>        # 生成成功后记录指纹
 *   node docx-guard.js diff  <docx> <md>   # 只打印 Word 与 md 的文字差异（同步回 md 时用）
 *
 * Word 的改动全部同步进 md 后（diff 里“Word 里有、md 里没有”只剩已同步的内容），
 * 用 make-doc.ps1 -WordSynced 重新生成；该参数表示“Word 的改动已同步进 md”，跳过本检查。
 */
require("../../_shared/qa/_tmp-sandbox"); // 临时文件进沙盒·退出自动删（铁律·见 _tmp-sandbox.js）
const fs = require("fs"), path = require("path"), crypto = require("crypto"), { execFileSync } = require("child_process");

const stampOf = docx => path.join(path.dirname(docx), "." + path.basename(docx) + ".gen");
const sha = f => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
function pandoc() {
  for (const p of [process.env.PANDOC, path.join(process.env.LOCALAPPDATA || "", "Pandoc", "pandoc.exe"), "pandoc"]) { if (!p) continue; try { execFileSync(p, ["--version"], { stdio: "ignore" }); return p; } catch (_) {} }
  return "pandoc";
}
function diff(docx, md) {
  const pd = pandoc();
  const a = execFileSync(pd, [docx, "-t", "plain", "--wrap=none"], { maxBuffer: 1 << 29 }).toString();
  const b = execFileSync(pd, [md, "-f", "markdown", "-t", "plain", "--wrap=none"], { maxBuffer: 1 << 29 }).toString();
  const norm = s => s.replace(/[\s\-—|:]+/g, "");
  const sp = s => { const m = new Map(); s.split(/[。；！？\n]/).forEach(x => { const k = norm(x); if (k.length >= 2 && !m.has(k)) m.set(k, x.trim()); }); return m; };
  const A = sp(a), B = sp(b);
  return { wordOnly: [...A].filter(([k]) => !B.has(k)).map(([, v]) => v), mdOnly: [...B].filter(([k]) => !A.has(k)).map(([, v]) => v) };
}
/* 逐段比对（含分段、换行、红字等格式）：md 先临时转成 Word，再把两份 Word 都转成段落列表比较。
   只比文字会漏掉“在句号处分段”这类格式改动（11-06 用户在 Word 里把批量流程拆成 3 段，文字比对看不出）。 */
function paraDiff(docx, md) {
  const pd = pandoc(), os = require("os");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "docxguard-"));
  try {
    const gen = path.join(tmp, "gen.docx");
    // 与 make-doc.ps1 用同一套参数（模板、去斜体、不着色），否则代码块等会出现假差异
    const extra = []; const ref = path.join(__dirname, "..", "prd-reference.docx"), lua = path.join(__dirname, "..", "prd-no-italic.lua");
    if (fs.existsSync(ref)) extra.push("--reference-doc=" + ref);
    if (fs.existsSync(lua)) { extra.push("--lua-filter=" + lua); let hl = "--no-highlight"; try { if (/syntax-highlighting/.test(execFileSync(pd, ["--help"]).toString())) hl = "--syntax-highlighting=none"; } catch (_) {} extra.push(hl); }
    execFileSync(pd, [md, "-o", gen, "--resource-path=" + path.dirname(md), ...extra], { maxBuffer: 1 << 29, stdio: ["ignore", "ignore", "ignore"] });
    const fmt = "markdown-simple_tables-multiline_tables-grid_tables";
    const rd = f => execFileSync(pd, ["-f", "docx+styles", f, "-t", fmt, "--wrap=none"], { maxBuffer: 1 << 29 }).toString().split(/\r?\n/)
      .map(s => s.replace(/\s*\{#[^}]*\}/g, "").replace(/\s+/g, " ").replace(/\|\s*:?-{3,}:?\s*/g, "|").trim())
      .filter(s => s && !/^:::/.test(s) && !/^!\[/.test(s) && !/^<img/.test(s) && !/^[\-|: ]+$/.test(s));
    const a = rd(gen), b = rd(docx); const A = new Map(); a.forEach(x => A.set(x, (A.get(x) || 0) + 1));
    const wordOnly = []; b.forEach(x => { if (A.get(x)) A.set(x, A.get(x) - 1); else wordOnly.push(x); });
    const mdOnly = []; A.forEach((c, x) => { for (let i = 0; i < c; i++) mdOnly.push(x); });
    return { wordOnly, mdOnly };
  } finally { try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {} }
}
function printDiff(d) {
  console.log(`Word 里有、md 里没有（${d.wordOnly.length} 句）：`); d.wordOnly.forEach(x => console.log("  + " + x));
  console.log(`md 里有、Word 里没有（${d.mdOnly.length} 句）：`); d.mdOnly.forEach(x => console.log("  - " + x));
  if (!d.wordOnly.length && !d.mdOnly.length && docx && fs.existsSync(stampOf(docx)) && readStamp(docx).w !== sha(docx))
    console.log("⚠ 文字和分段两边一致，但 Word 在上次生成后被改过：改动只在版式上（缩进、字号、颜色等），md 记录不了。不要重新生成覆盖它；先问用户这个版式是否定为模板规则（写进 prd-reference.docx）。");
}

const [cmd, docx, md] = process.argv.slice(2);
if (!cmd || !docx) { console.log("用法：node docx-guard.js check|stamp|diff <docx> [md]"); process.exit(1); }
// 指纹文件第 1 行 = Word 的 SHA-256，第 2 行 = 当时 md 的 SHA-256（用来判断用户之后是否手动改过 md）
const readStamp = docx => { const s = stampOf(docx); if (!fs.existsSync(s)) return null; const [w, m] = fs.readFileSync(s, "utf8").split(/\r?\n/); return { w: (w || "").trim(), m: (m || "").trim() }; };
if (cmd === "stamp") { if (fs.existsSync(docx)) { const s = stampOf(docx); try { if (fs.existsSync(s)) fs.unlinkSync(s); } catch (_) {} fs.writeFileSync(s, sha(docx) + "\n" + (md && fs.existsSync(md) ? sha(md) : "")); try { execFileSync("attrib", ["+h", s], { stdio: "ignore" }); } catch (_) {} } process.exit(0); }
/* status：动 PRD 前先看两边谁改过（以最新为准，2026-11-06 用户明令）
   退出码 0=都没改过 · 10=只有 md 改过（重新生成 Word）· 3=只有 Word 改过（同步进 md）· 4=两边都改过（合并，同一处不同问用户） */
if (cmd === "status") {
  const st = readStamp(docx); if (!fs.existsSync(docx) || !st) { console.log("没有生成记录：先用 check 判断 Word 是否被改过。"); process.exit(0); }
  const wChanged = st.w !== sha(docx), mChanged = !!st.m && fs.existsSync(md) && st.m !== sha(md);
  const tw = fs.statSync(docx).mtime.toLocaleString(), tm = fs.existsSync(md) ? fs.statSync(md).mtime.toLocaleString() : "-";
  if (wChanged && mChanged) { console.log(`两边都在上次生成后被改过（Word ${tw}，md ${tm}）：把 Word 的改动合并进 md；同一处两边写得不一样时，列出原文问用户以哪边为准。`); process.exit(4); }
  if (wChanged) { console.log(`Word 在上次生成后被改过（${tw}）：以 Word 为准，把 Word 的改动同步进 md，不动 Word。`); process.exit(3); }
  if (mChanged) { console.log(`md 在上次生成后被改过（${tm}）：以 md 为准，重新生成 Word。`); process.exit(10); }
  console.log("Word 和 md 都没有在上次生成后被改过。"); process.exit(0);
}
if (cmd === "diff") { console.log("【逐段比对】（分段、换行、红字等格式改动都会列出）"); printDiff(paraDiff(docx, md)); process.exit(0); }
if (cmd === "check") {
  if (!fs.existsSync(docx)) process.exit(0);                       // 还没有 Word，直接生成
  const s = stampOf(docx);
  let edited, why;
  if (fs.existsSync(s)) { edited = readStamp(docx).w !== sha(docx); why = "Word 在上次生成之后被修改过（文件指纹与生成时不同）"; }
  else { const d = diff(docx, md); edited = d.wordOnly.length > 0; why = "没有生成记录，且 Word 里有 md 没有的句子"; }
  if (!edited) process.exit(0);
  console.log(`❌ 禁止覆盖：${path.basename(docx)} ${why}。`);
  console.log("   用户改过的 Word 以 Word 为准（prd SKILL.md“Word 优先铁律”）：先把下面 Word 的改动逐条同步进 md，");
  console.log("   核对 diff 只剩本次 md 的新改动后，再用 make-doc.ps1 -WordSynced 重新生成。");
  console.log("【逐段比对】（分段、换行、红字等格式改动都会列出）"); printDiff(paraDiff(docx, md));
  process.exit(3);
}
console.log("未知命令：" + cmd); process.exit(1);
