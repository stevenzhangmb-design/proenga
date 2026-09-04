/* ════════════════════════════════════════════════════════════════════════
   PRD §4.4 生成器单测  ·  prd-generator-test.js  ·  维护者 QA 工具（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   用途：验证 anno-server 的 §4.4 装配器仍严格符合 prd-directory-numbering.mdc——
        变长菜单树 / 功能点4子节(位置·原型图·字段规范·用例规则) / 无字段规范用例规则落.3
        / 多系统 / 深度随产品形态自适应(B端/APP/小程序/网站)。
   零依赖：require anno-server 的 generatePrdMd（已 module.exports）。
   anno-server 路径：默认 = ai-rules 同级的 anno-server（CLAUDE.md 约定）；可用 ANNO_SERVER 覆盖。
   运行：  node prd-generator-test.js     退出码 0=全绿 1=有失败。
   ════════════════════════════════════════════════════════════════════════ */
const path = require("path"), fs = require("fs");
const SERVER = process.env.ANNO_SERVER || path.join(__dirname, "../../../../anno-server/server.js");
if (!fs.existsSync(SERVER)) { console.log("✗ 找不到 anno-server:", SERVER, "（用 ANNO_SERVER 环境变量指定）"); process.exit(1); }
const { generatePrdMd, mergePinIntoPrd } = require(SERVER);

let pass = 0, total = 0;
function expect(md, m) { total++; const has = md.includes(m); console.log((has ? "  ✓ " : "  ✗ ") + m); if (has) pass++; }
function expectNot(md, m, label) { total++; const has = md.includes(m); console.log((!has ? "  ✓ " : "  ✗ ") + label); if (!has) pass++; }

// ── 测试 1：§4.4 结构（充值管理，多系统，变长菜单 + 4 子节 + 无字段规范写「无」固定.4）──
console.log("\n── §4.4 结构（多系统/变长菜单/4子节）──");
const md1 = generatePrdMd({
  system_name: "充值管理结构测试",
  function_points: {
    "充值管理-OMS.充值": { fp_name: "充值", system: "OMS", menu_path: ["财务", "财务管理", "充值管理"], img: "IMG-01",
      _draft_fieldSpecs: "| 字段名称 | 类型 | 是否必填/必选 | 默认值 | 约束规则 |\n|---|---|---|---|---|\n| 充值金额 | 金额输入框 | 是 | 无 | >0 |",
      _draft_useCaseRules: "• 前置条件：…" },
    "充值管理-OMS.查询": { fp_name: "查询", system: "OMS", menu_path: ["财务", "财务管理", "充值管理"], img: "无",
      _draft_useCaseRules: "• 前置条件：…" },  // 无字段规范 → 该节写「无」，用例规则固定 .4
    "账户余额-WMS.查看": { fp_name: "查看", system: "WMS", menu_path: ["财务", "财务管理", "账户余额"], img: "无",
      _draft_useCaseRules: "• 前置条件：…" },
  },
  system_order: ["OMS", "WMS"],
});
[ "### 4.4 功能点明细", "#### 4.4.1 OMS", "##### 4.4.1.1 财务", "##### 4.4.1.1.1 财务管理",
  "##### 4.4.1.1.1.1 充值管理", "###### 4.4.1.1.1.1.1 充值", "**4.4.1.1.1.1.1.1 位置**",
  "OMS-财务-财务管理-充值管理-充值", "**4.4.1.1.1.1.1.2 原型图**", "**4.4.1.1.1.1.1.3 字段规范**",
  "**4.4.1.1.1.1.1.4 用例规则**", "###### 4.4.1.1.1.1.2 查询", "**4.4.1.1.1.1.2.3 字段规范**", "**4.4.1.1.1.1.2.4 用例规则**",
  "#### 4.4.2 WMS", "##### 4.4.2.1.1.1 账户余额", "###### 4.4.2.1.1.1.1 查看" ].forEach(m => expect(md1, m));
expect(md1, "**4.4.1.1.1.1.2.3 字段规范**\n\n无");  // 无字段规范→该节写「无」、用例规则固定 .4（不再省略落.3）

// ── 测试 2：多产品形态深度自适应（B端/APP/小程序/网站）──
console.log("\n── 多产品形态深度自适应 ──");
const md2 = generatePrdMd({
  system_name: "多形态测试",
  function_points: {
    "充值管理-OMS.充值": { fp_name: "充值", system: "OMS", menu_path: ["财务", "财务管理", "充值管理"], img: "无", _draft_useCaseRules: "•" },
    "钱包-APP.充值": { fp_name: "充值", system: "APP客户端", menu_path: ["我的", "钱包"], img: "无", _draft_useCaseRules: "•" },
    "钱包-小程序.充值": { fp_name: "充值", system: "小程序", menu_path: ["钱包页"], img: "无", _draft_useCaseRules: "•" },
    "个人中心-PC.充值": { fp_name: "充值", system: "PC官网", menu_path: ["个人中心", "账户充值"], img: "无", _draft_useCaseRules: "•" },
  },
  system_order: ["OMS", "APP客户端", "小程序", "PC官网"],
});
[ "#### 4.4.1 OMS", "##### 4.4.1.1.1.1 充值管理", "###### 4.4.1.1.1.1.1 充值",
  "#### 4.4.2 APP客户端", "##### 4.4.2.1 我的", "##### 4.4.2.1.1 钱包", "###### 4.4.2.1.1.1 充值",
  "#### 4.4.3 小程序", "##### 4.4.3.1 钱包页", "###### 4.4.3.1.1 充值",
  "#### 4.4.4 PC官网", "##### 4.4.4.1 个人中心", "##### 4.4.4.1.1 账户充值", "###### 4.4.4.1.1.1 充值" ].forEach(m => expect(md2, m));

// ── 测试 3：系统归属（zone 功能点传 pageKey → 真实系统、不落"通用"）—— 证明"禁通用"机制随 anno-server 通用发，对任何系统生效 ──
console.log("\n── 系统归属（pageKey→真实系统·禁通用兜底）──");
function expectEq(actual, want, label) { total++; const ok = actual === want; console.log((ok ? "  ✓ " : "  ✗ ") + label + "（实际=" + actual + "）"); if (ok) pass++; }
{
  const pd = { function_points: {}, page_menus: {} };
  mergePinIntoPrd(pd, { zoneContext: { fpKey: "zone-OMS-home-账户余额" }, pageKey: "OMS-home", title: "账户余额", fieldSpecs: "无", useCaseRules: "•" });
  expectEq((pd.function_points["zone-OMS-home-账户余额"] || {}).system, "OMS", "zone功能点传 pageKey=OMS-home → 系统=OMS（非通用）");
  mergePinIntoPrd(pd, { zoneContext: { fpKey: "zone-WMS-recharge-list-状态" }, pageKey: "WMS-recharge-list", title: "状态", fieldSpecs: "无", useCaseRules: "•" });
  expectEq((pd.function_points["zone-WMS-recharge-list-状态"] || {}).system, "WMS", "zone功能点传 pageKey=WMS-recharge-list → 系统=WMS（非通用）");
  mergePinIntoPrd(pd, { zoneContext: { fpKey: "充值管理-OMS.充值" }, title: "充值", fieldSpecs: "无", useCaseRules: "•" });
  expectEq((pd.function_points["充值管理-OMS.充值"] || {}).system, "OMS", "可解析 fpKey 充值管理-OMS.充值 → 系统=OMS");
}

console.log("\n────────────────────────────────────");
console.log(`PRD 生成器单测：${pass}/${total}` + (pass === total ? "  全绿 PASS ✅" : "  有失败 FAIL ❌"));
console.log("════════════════════════════════════");
process.exit(pass === total ? 0 : 1);
