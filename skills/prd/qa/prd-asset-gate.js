/* ════════════════════════════════════════════════════════════════════════
   ⑮ 原型图 / 流程图资产闸 · prd-asset-gate.js
   ────────────────────────────────────────────────────────────────────────
   根治"§4.2 原型图 / §4.3 业务流程图 只剩占位文字、没真图"这一类缺陷——
   两条机器硬检查：
     1. PRD.md 里引用的每张图（screenshots/.../*.png）必须在磁盘真实存在；
        缺 → 原型图/流程图没成功渲染、或路径写错 → 红。
     2. 若 md 有图引用，则同名 .docx 必须存在且【真嵌入了媒体】（zip 内含 word/media）；
        docx 没媒体 = 图没嵌进去（常见：生成时 docx 被 Word/WPS 锁定，或 pandoc 漏设 cwd）→ 红。
   用法：node prd-asset-gate.js <PRD.md 路径>
   退出码：0=全部资产就绪 1=有缺图/未嵌入。
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs"), path = require("path");
const md = process.argv[2];
if (!md || !fs.existsSync(md)) { console.log("✗ 用法：node prd-asset-gate.js <PRD.md路径>"); process.exit(1); }
const archDir = path.dirname(md);
const text = fs.readFileSync(md, "utf8").replace(/^﻿/, "");
const errs = [];
// 读 PNG 真实像素宽高（IHDR：字节16-24），零依赖；失败返回 null
const pngSize = (file) => {
  try { const b = fs.readFileSync(file); if (b.length < 24 || b.toString("ascii", 1, 4) !== "PNG") return null; return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }; } catch (e) { return null; }
};
const MAX_FLOW_RATIO = 2.5;  // §4.3 业务流程图竖向铁律：横向超宽(>2.5:1)进竖版文档会被压成小图 → 必须竖向 TB
const refs = [...text.matchAll(/!\[[^\]]*\]\(([^)]+\.(?:png|jpe?g|svg))\)/gi)].map(m => m[1]);
for (const r of refs) {
  if (/^https?:\/\//i.test(r)) continue;            // 外链不检查本地存在
  const abs = path.resolve(archDir, r.split("/").join(path.sep));
  if (!fs.existsSync(abs)) { errs.push(`图片引用不存在：${r}（PRD 写了图但磁盘没有 → 原型图/流程图未成功渲染或路径错）`); continue; }
  // 流程图(FLOW-N.png)宽高比闸：超宽=横向 LR 画法 → 文档里字被压成 2pt → 必须改竖向 TB
  if (/FLOW-\d+\.png$/i.test(r) && /\.png$/i.test(abs)) {
    const sz = pngSize(abs);
    if (sz && sz.h > 0 && sz.w / sz.h > MAX_FLOW_RATIO)
      errs.push(`流程图过宽：${r} 宽高比 ${(sz.w / sz.h).toFixed(2)}:1（>${MAX_FLOW_RATIO}）——横向 LR 布局进竖版 PRD/Word 会被压成小图字看不清。改用竖向 flowchart TB（泳道 subgraph 纵向堆叠）后重生。`);
  }
}
if (refs.length) {
  const docx = md.replace(/\.md$/i, ".docx");
  if (!fs.existsSync(docx)) {
    errs.push(`docx 不存在：${path.basename(docx)}（md 有图但没生成 docx）`);
  } else {
    const buf = fs.readFileSync(docx);
    if (buf.indexOf(Buffer.from("word/media/")) < 0)
      errs.push(`docx 未嵌入任何图片（${path.basename(docx)} 内无 word/media）——常见原因：生成时 docx 被 Word/WPS 打开锁定、或 pandoc 未设 cwd=archive。关闭 Word 后重新生成。`);
    // docx 新鲜度：docx 不得比 md 旧（md 更新了 docx 没更新 = docx 被 Word/WPS 锁住、pandoc 覆盖失败 → 看到的是过期 docx）
    const mdM = fs.statSync(md).mtimeMs, dxM = fs.statSync(docx).mtimeMs;
    if (dxM < mdM - 3000)
      errs.push(`docx 比 md 旧（docx 落后 ${Math.round((mdM - dxM) / 1000)} 秒）——md 已更新但 docx 没同步，多半是 docx 被 Word/WPS 打开锁住、pandoc 覆盖失败，你看到的是【过期 docx】。关闭 Word/WPS 后重新生成。`);
  }
}
console.log("\n════════ 原型图/流程图资产闸 ⑮ ════════");
if (!refs.length) { console.log("  PRD 无图片引用（跳过）\n════════════════════════════════"); process.exit(0); }
if (errs.length) { errs.forEach(e => console.log("  ✗ " + e)); console.log("  有违规 FAIL ❌\n════════════════════════════════"); process.exit(1); }
console.log(`  ✓ ${refs.length} 张图全部存在且已嵌入 docx PASS ✅\n════════════════════════════════`);
process.exit(0);
