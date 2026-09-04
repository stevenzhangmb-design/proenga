/* ════════════════════════════════════════════════════════════════════════
   对话框/字段同步 HTTP 集成测试  ·  sync-http-test.js  ·  维护者 QA（不打包客户）
   ────────────────────────────────────────────────────────────────────────
   验证 anno-server 同步管道（场景②③·数据层，不需浏览器）：
     · 场景②-B 对话框注入：POST /anno-inject → prd-data.json 写入 fp + 字段规范 + 用例规则 + 本地 PRD.md 生成
     · 场景②  改字段规范/用例规则：同 fpKey 再注入新内容 → prd-data + PRD 覆盖为新值（旧值清掉）
     · 场景③  删除功能：POST /anno-update {action:delete} → prd-data + PRD 移除该 fp
   隔离：用测试 system_name(ZZ同步验证DELETE) + 备份/还原 prd-data.json + 清理测试 PRD，绝不污染真实数据。
   需 anno-server 在跑(localhost:3799)——这是该功能的前置依赖；没跑则 SKIP(exit 0)。
   运行：node sync-http-test.js     退出码 0=通过/跳过 1=失败。
   注：浏览器↔server↔文件 整条链由 sync-integration-test.js（改名）覆盖；本闸专验 inject/edit/delete 数据同步。
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs"), path = require("path");
const ARCHIVE = process.env.ANNO_ARCHIVE || require('./_archive-dir').existingArchiveDir();
const PRD = path.join(ARCHIVE, "prd-data.json");
const BAK = path.join(ARCHIVE, "prd-data.json.synchttp-bak");
const TEST = "ZZ同步验证DELETE";
const FPK = "同步验证模块-OMS.功能甲";
const MD = path.join(ARCHIVE, "PRD-" + TEST + ".md");
const DOCX = path.join(ARCHIVE, "PRD-" + TEST + ".docx");
const wait = ms => new Promise(z => setTimeout(z, ms));
const readPrd = () => JSON.parse(fs.readFileSync(PRD, "utf8").replace(/^﻿/, ""));
const post = (url, body) => fetch("http://localhost:3799" + url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
const results = [];
const chk = (name, ok, detail = "") => { results.push({ name, ok: !!ok }); console.log((ok ? "  ✓ " : "  ✗ ") + name + (detail ? "  〔" + detail + "〕" : "")); };

(async () => {
  // anno-server 必须在跑，否则 SKIP（该功能本就依赖它）
  try { await fetch("http://localhost:3799/anno-queue", { signal: AbortSignal.timeout(2500) }); }
  catch (e) { console.log("⊘ SKIP：anno-server 未运行，本同步测试需要它（启动后再跑）"); process.exit(0); }
  console.log("\n════════ 对话框/字段同步 HTTP 集成测试（场景②③）════════");

  const had = fs.existsSync(PRD);
  if (had) fs.copyFileSync(PRD, BAK);
  try {
    // ── 场景②-B + 场景③-add：对话框注入（add + 字段规范 + 用例规则）──
    await post("/anno-inject", { systemName: TEST, pins: [{ fpKey: FPK, title: "功能甲", fieldSpecs: "| 字段名称 | 类型 | 必填 | 约束 | 说明 |\n|---|---|---|---|---|\n| 测试字段X | 文本 | 是 | 标记AAA | 说明 |", useCaseRules: "【前置条件】用例标记AAA。" }] });
    await wait(2500);
    let p = readPrd(), fp = (p.function_points || {})[FPK] || {};
    chk("场景②-B 注入→prd-data 有功能甲", !!fp.fp_name, fp.fp_name || "无");
    chk("场景②-B 字段规范写入(标记AAA)", /标记AAA/.test(fp._draft_fieldSpecs || ""));
    chk("场景②-B 用例规则写入(标记AAA)", /用例标记AAA/.test(fp._draft_useCaseRules || ""));
    chk("场景②-B 本地PRD.md生成+含字段内容", fs.existsSync(MD) && /标记AAA/.test(fs.readFileSync(MD, "utf8")));

    // ── 场景② 改字段规范/用例规则 → 同步（同 fpKey 改成 BBB，验覆盖）──
    await post("/anno-inject", { systemName: TEST, pins: [{ fpKey: FPK, title: "功能甲", fieldSpecs: "| 字段名称 | 类型 | 必填 | 约束 | 说明 |\n|---|---|---|---|---|\n| 测试字段Y | 文本 | 否 | 标记BBB | 改后 |", useCaseRules: "【前置条件】用例标记BBB改后。" }] });
    await wait(2500);
    p = readPrd(); fp = (p.function_points || {})[FPK] || {};
    chk("场景② 改字段规范→prd-data 更新为BBB(无旧AAA)", /标记BBB/.test(fp._draft_fieldSpecs || "") && !/标记AAA/.test(fp._draft_fieldSpecs || ""));
    chk("场景② 改用例规则→prd-data 更新为BBB", /用例标记BBB/.test(fp._draft_useCaseRules || ""));
    chk("场景② 本地PRD.md 同步为BBB(无旧AAA)", fs.existsSync(MD) && /标记BBB/.test(fs.readFileSync(MD, "utf8")) && !/标记AAA/.test(fs.readFileSync(MD, "utf8")));

    // ── 场景③ 删除功能 → 同步删除 ──
    await post("/anno-update", { systemName: TEST, changes: [{ action: "delete", pin: { zoneContext: { fpKey: FPK } } }] });
    await wait(2500);
    p = readPrd();
    chk("场景③ 删除→prd-data 移除功能甲", !((p.function_points || {})[FPK]), (p.function_points || {})[FPK] ? "还在" : "已删");
    chk("场景③ 删除→本地PRD.md 不再含该功能", !fs.existsSync(MD) || !/标记BBB/.test(fs.readFileSync(MD, "utf8")));

    const allOk = results.every(r => r.ok);
    console.log("──────────────────────────────");
    console.log(allOk ? "  通过 PASS ✅ 场景②字段/用例同步 + ②-B对话框注入 + ③增删 全绿" : "  有 FAIL ❌");
    console.log("════════════════════════════════\n");
    process.exitCode = allOk ? 0 : 1;
  } catch (e) { console.log("✗ 异常: " + e.message); process.exitCode = 1; }
  finally {
    try { fs.unlinkSync(MD); } catch (e) {}
    try { fs.unlinkSync(DOCX); } catch (e) {}
    if (had && fs.existsSync(BAK)) { fs.copyFileSync(BAK, PRD); fs.unlinkSync(BAK); }
  }
})();
