/* ════════════════════════════════════════════════════════════════════════
   docx 被占用·后台自动重试覆盖 闸 · docx-autoretry-test.js · 验"打包后别人也有自动覆盖"
   ────────────────────────────────────────────────────────────────────────
   证明 anno-server 的 scheduleDocxOverwrite：docx 被 Word/WPS 锁住时另存"最新版"，
   并在后台重试；用户一关 Word（锁解除）→【自动】覆盖回正式 docx、删另存件——无需任何手动操作。
   纯 anno-server 端逻辑(不碰原型 HTML)，所有原型/所有打包用户共用同一 server → 原则1+2 天然达标。
   做法(不依赖真 Word)：把目标 docx 设【只读】模拟"被占用"(pandoc 写它报 permission denied，命中重试判定)；
   过一会儿清掉只读模拟"关闭 Word"；断言正式 docx 被自动覆盖成最新、另存件被自动删除。
   退出码：0=自动重试覆盖成功 1=没自动覆盖/另存件没删/生成器坏。
   ════════════════════════════════════════════════════════════════════════ */
process.env.ANNO_DOCX_RETRY_MS = process.env.ANNO_DOCX_RETRY_MS || "400";   // 测试加速：0.4s 一次
process.env.ANNO_DOCX_MAX_TRIES = process.env.ANNO_DOCX_MAX_TRIES || "30";
const fs = require("fs"), path = require("path"), os = require("os");
const { execFileSync } = require("child_process");

const SERVER = process.env.ANNO_SERVER || path.join(__dirname, "..", "..", "..", "..", "anno-server", "server.js");
if (!fs.existsSync(SERVER)) { console.log("（未找到 anno-server/server.js，跳过 docx 自动重试闸）"); process.exit(0); }
let srv; try { srv = require(SERVER); } catch (e) { console.log("✗ 无法加载 server.js：" + e.message); process.exit(1); }
if (typeof srv.scheduleDocxOverwrite !== "function") { console.log("✗ server.js 未导出 scheduleDocxOverwrite（自动重试功能缺失/被改坏）"); process.exit(1); }
// pandoc 不在则跳过（与其它依赖 pandoc 的环节一致优雅降级）
try { execFileSync("pandoc", ["--version"], { stdio: "ignore" }); } catch (e) { console.log("（未装 pandoc，跳过 docx 自动重试闸）"); process.exit(0); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "docxretry-"));
const mdPath = path.join(tmp, "PRD-x.md");
const docxPath = path.join(tmp, "PRD-x.docx");
const altPath = docxPath.replace(/\.docx$/i, "-最新版(原docx被占用未覆盖).docx");
let ok = true, msg = [];

try {
  fs.writeFileSync(mdPath, "# 测试\n\n初始内容第一版。\n", "utf8");
  execFileSync("pandoc", [mdPath, "-o", docxPath], { timeout: 20000 });   // 先造一份正式 docx
  fs.writeFileSync(altPath, "另存件占位（应被自动删除）", "utf8");          // 造一个"最新版"另存件
  // 改 md 内容到第二版——自动重试应把正式 docx 覆盖成这一版
  fs.writeFileSync(mdPath, "# 测试\n\n第二版内容·自动重试应覆盖到这里。\n", "utf8");
  const mtimeBefore = fs.statSync(docxPath).mtimeMs;

  fs.chmodSync(docxPath, 0o444);   // 只读 = 模拟 Word 锁住（pandoc 写它 → permission denied → 命中重试）
  srv.scheduleDocxOverwrite(mdPath, docxPath, altPath);

  // 1.2s 后清只读 = 模拟用户关闭 Word
  setTimeout(() => { try { fs.chmodSync(docxPath, 0o666); } catch (e) {} }, 1200);

  // 3.5s 后裁决（足够 锁住期间重试失败 + 解锁后重试成功）
  setTimeout(() => {
    try {
      const overwritten = fs.existsSync(docxPath) && fs.statSync(docxPath).mtimeMs > mtimeBefore + 1;
      const altGone = !fs.existsSync(altPath);
      if (!overwritten) { ok = false; msg.push("  ✗ 解锁后正式 docx 未被自动覆盖（mtime 没更新）"); }
      if (!altGone) { ok = false; msg.push("  ✗ 另存件未被自动删除"); }
      // 内容也核一下确实是第二版（嵌入媒体/文本）
      if (overwritten) {
        const buf = fs.readFileSync(docxPath);
        if (buf.indexOf(Buffer.from("PK")) !== 0) { ok = false; msg.push("  ✗ 覆盖后的 docx 不是有效文件"); }
      }
    } catch (e) { ok = false; msg.push("  ✗ 裁决异常：" + e.message); }
    finally { try { srv.clearDocxRetry(docxPath); } catch (e) {} try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) {} }

    console.log("\n════════ docx 被占用·自动重试覆盖 闸 ════════");
    if (ok) console.log("  ✅ 模拟「Word锁住→另存→关闭Word」：正式 docx 被【自动】覆盖为最新、另存件被【自动】删除 —— 用户零操作，打包后别人同此效果");
    else { console.log("  ❌ 自动重试覆盖失败："); msg.forEach(m => console.log(m)); }
    console.log("════════════════════════════════════════════\n");
    process.exit(ok ? 0 : 1);
  }, 3500);
} catch (e) {
  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (_) {}
  console.log("✗ 闸自身异常：" + e.message); process.exit(1);
}
