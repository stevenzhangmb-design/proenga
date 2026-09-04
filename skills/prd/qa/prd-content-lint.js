/* ════════════════════════════════════════════════════════════════════════
   PRD 内容合规校验器  ·  prd-content-lint.js  ·  prd skill 的机器版 quality-checklist
   ────────────────────────────────────────────────────────────────────────
   作用：AI 生成的字段规范 / 用例规则，注入前必须先过此校验——机器对照 prd 真理源
        （_rules/prd-template-structure.mdc + prd-template-clean.md + quality-checklist.md）
        检查格式合规。任何一条违规 → 退出码 1 → 禁止注入，必须先改对。
        【从根上杜绝"凭印象乱写格式"——靠机器拦，不靠 AI 自觉。】
   用法：node prd-content-lint.js <inject-json路径>   （inject JSON = {pins:[{fpKey,fieldSpecs,useCaseRules,...}]}）
   退出码：0=全部合规 1=有违规。
   注：默认值列写法（2026-06-28 用户定，§3.1.5）——有默认值写默认值、无默认值·有占位写占位原文、无默认值·无占位写空/无；
       机器闸卡：禁推托语 + 禁旧包装「空（显示"X"）」；"占位是否与原型一致"属判断层（机器判不出，靠 AI 照 §3.1.5 应用）。
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const file = process.argv[2];
if (!file || !fs.existsSync(file)) { console.log("✗ 用法: node prd-content-lint.js <inject-json路径>"); process.exit(1); }
const data = JSON.parse(fs.readFileSync(file, "utf8").replace(/^﻿/, ""));  // 去 BOM 头，防解析崩
const pins = data.pins || [];

// prd 真理源里 7 节用例规则（顺序固定，须用 • 顶格）—— prd-template-clean.md §用例规则
const SECTIONS = ["前置条件", "操作流程", "后置条件", "校验规则", "提示消息", "消息通知", "操作日志"];

function lintPin(pin) {
  const errs = [];
  // 内容键必须是字符串(markdown文本)——非字符串会崩注入(anno-server 写 _draft_ 期望字符串)
  if (pin.fieldSpecs != null && typeof pin.fieldSpecs !== "string") errs.push("fieldSpecs 必须是 markdown 字符串，当前为 " + typeof pin.fieldSpecs);
  if (pin.useCaseRules != null && typeof pin.useCaseRules !== "string") errs.push("useCaseRules 必须是 markdown 字符串，当前为 " + typeof pin.useCaseRules);
  const uc = typeof pin.useCaseRules === "string" ? pin.useCaseRules : "";
  const fsp = typeof pin.fieldSpecs === "string" ? pin.fieldSpecs : "";
  const fpName = (pin.title || "") + " " + (pin.fpKey || "");
  // 查询/查看/展示/看板/筛选/通知/余额/状态类：无数据变更，操作日志写"不输出"即可（按 prd 规则）
  // 展示/看板/widget 类识别不只靠功能名关键词——更靠【字段规范全为「只读」且无必填/条件必填输入】：
  // 纯展示无数据变更，操作日志写"不输出"即合规。覆盖"一件代发/B2B/退货""商品数量/库存"等名字不含关键词的只读看板（2026-06-29 补，根因=isQuery 仅按名字漏判无关键词的展示 widget）。
  const isDisplayOnly = /只读/.test(fsp) && !/\|\s*是\s*\|/.test(fsp) && !/\|\s*条件必填\s*\|/.test(fsp);
  const isQuery = isDisplayOnly || /查询|查看|列表|导出|看板|概览|统计|展示|详情|通知|公告|消息|余额|状态|筛选|首页/.test(fpName);

  // ① 用例规则 7 节，每节须用 Unicode • (U+2022) 顶格起头
  for (const s of SECTIONS) {
    const re = new RegExp("(^|\\n)\\s*\\u2022\\s*" + s);
    if (!re.test(uc)) errs.push(`用例规则缺「• ${s}」节，或没用 • (U+2022) 顶格（禁用 **加粗** 等其它写法）`);
  }
  // ② 操作流程必含第二路径（正向 + 取消/异常；查看类=返回/关闭、查询类=重置 也算）
  if (/•\s*操作流程/.test(uc) && !/取消|关闭|返回|离开|放弃|重置/.test(uc)) errs.push("操作流程缺第二路径（须双路径：正向 + 取消/返回/重置/关闭等）");
  // ⑦ 前置/后置/校验 超过一条(2+)必须用 1、2、3、 分条编号，禁止用 ；/。 拼接成一段 —— prd-template-structure §4.2.1/4.2.2/4.4
  const _secContent = (name) => { const m = uc.match(new RegExp("\\u2022\\s*" + name + "\\s*[：:]([\\s\\S]*?)(?=\\n\\s*\\u2022|$)")); return m ? m[1].trim() : ""; };
  // ②b 操作流程正向路径必含成功反馈+落点（§4.3.2）：含「提交」/「保存」/「确认X」提交动作时，禁干瘪只写"点击提交按钮"——必须写提交后果（成功反馈/数据流转/落点）
  { const flow = _secContent("操作流程");
    if (/「提交」|「保存」|「确认充值」|「确认提现」|「确认新增」|点击「确认」/.test(flow) && !/成功|提示["「]|已推送|已提交|已生成|自动刷新|列表刷新/.test(flow))
      errs.push("操作流程含提交/保存动作却缺正向成功反馈（§4.3.2：正向路径必含①成功反馈文案“…成功”②UI落点 返回/刷新/关闭/数据流转，禁只写“点击「提交」按钮”）"); }
  // 注：后置条件【不】在此机器判——§4.2.2 标准句式(line 1146-1160)单条即用「结果状态；可见位置」分号，
  // 机械按「；」拆条必误报合规的单条标准句式（fresh-install 自验 2026-06-27 实证）；后置分条交人工深检。
  for (const [name, sep] of [["前置条件", "；"], ["校验规则", "。"]]) {
    const c = _secContent(name);
    if (!c) continue;
    if (/(^|\n)\s*1、/.test(c)) continue;  // 已编号
    const clauses = c.split(sep).map(s => s.trim()).filter(Boolean);
    if (clauses.length >= 2) errs.push(`${name} 有 ${clauses.length} 条，超过一条须用 1、2、3、 分条编号（禁止用「${sep}」拼接成一段）`);
  }
  // ③ 字段规范五列固定表头（有字段规范时）
  if (fsp.trim() && !/^无[。.]?$/.test(fsp.trim()) && !/字段名称\s*\|\s*类型\s*\|\s*是否必填\/?必?选?\s*\|\s*默认值\s*\|\s*约束规则/.test(fsp))
    errs.push("字段规范须为五列固定表头 | 字段名称 | 类型 | 是否必填/必选 | 默认值 | 约束规则 |，或纯操作类写「无」");
  // ③b 「查询」功能字段规范固定拆「1、查询条件」+「2、列表字段」两块(§3.3)——禁只写筛选条件漏列表展示字段
  if (/\.查询$/.test(pin.fpKey || "") && fsp.trim() && !/^无[。.]?$/.test(fsp.trim())) {
    const miss = [!/查询条件/.test(fsp) && "查询条件", !/列表字段/.test(fsp) && "列表字段"].filter(Boolean);
    if (miss.length) errs.push(`「查询」功能字段规范须固定拆为「1、查询条件」+「2、列表字段」两块(§3.3)——当前缺【${miss.join("、")}】；查询=填筛选条件+看结果列表，二者都要列，禁只写其一`);
  }
  // ④ 消息通知：有表格必须 4 列固定表头(通知场景/通知标题/通知内容/接收方)，或明确"无。"——标注唯一真理源
  const notifBlock = (uc.split(/•\s*消息通知/)[1] || "").split(/•\s*操作日志/)[0] || "";
  if (/无。?/.test(notifBlock)) { /* 无通知 OK */ }
  else if (!/\|/.test(notifBlock)) errs.push("消息通知须为 4 列表格(通知场景/通知标题/通知内容/接收方) 或 写「无。」");
  else {
    if (!/通知场景\s*\|\s*通知标题\s*\|\s*通知内容\s*\|\s*接收方/.test(notifBlock))
      errs.push("消息通知表格须为 4 列固定表头「通知场景 | 通知标题 | 通知内容 | 接收方」(标注唯一真理源)；禁 3 列「字段/字段说明/规则示例」旧格式");
    if (/<[^>\n]{1,20}>/.test(notifBlock)) errs.push("消息通知动态字段须用 {占位符}，禁用 <占位符>（占位符规则）");
    if (/\|\s*(用户|相关人员)\s*\|/.test(notifBlock) || /接收人\s*=\s*(用户|相关人员)/.test(notifBlock)) errs.push("消息通知接收方须具体角色，禁写「用户/相关人员」泛指（§4.6.2）");
  }
  // ⑤ 操作日志：6 行表 或 查询查看类写"不输出"
  const logBlock = (uc.split(/•\s*操作日志/)[1] || "");
  if (isQuery) {
    if (!/不输出/.test(logBlock) && (logBlock.match(/\n\|/g) || []).length < 6)
      errs.push("查询/查看类操作日志须写「查询/查看不输出操作日志」或给 6 行表");
  } else if (/不输出/.test(logBlock) && /浏览类|埋点/.test(logBlock)) {
    /* §4.7.2：C 端商城前台【浏览类】(加入购物车/搜索/筛选/收藏/浏览)不输出操作日志、由用户行为埋点承载 —— 合规。
       仅当明确声明"浏览类/埋点"才放行；交易类(下单/支付/退款/改账号/改密码/改地址)无此声明，仍须 6 行表。 */
  } else {
    const rows = (logBlock.match(/\n\s*\|/g) || []).length;
    if (rows < 6) errs.push(`操作日志须为 6 行字段表（操作时间/账号/模块/功能/明细/IP），当前约 ${rows} 行`);
    if (!/操作时间|操作账号/.test(logBlock)) errs.push("操作日志缺固定字段（操作时间/操作账号/操作模块/操作功能/操作明细/IP地址）");
    // 操作时间须写【格式公式】(DD/MM/YYYY HH:mm:ss 或 YYYY-MM-DD HH:mm:ss)，禁只写一个具体时间值——表格行（带 |）的操作时间，非说明语
    const _timeRow = (logBlock.match(/\|\s*操作时间\s*\|[^\n]*/) || [""])[0];
    if (_timeRow && !/DD|YYYY|HH|mm|ss/.test(_timeRow)) errs.push("操作日志「操作时间」须写格式公式（如 DD/MM/YYYY HH:mm:ss 或 YYYY-MM-DD HH:mm:ss，可附具体示例），禁只写一个具体时间值");
  }
  // ⑥ 提示消息：3 列表 或 "无。"
  const promptBlock = (uc.split(/•\s*提示消息/)[1] || "").split(/•\s*消息通知/)[0] || "";
  if (!/无。?/.test(promptBlock) && !/\|/.test(promptBlock))
    errs.push("提示消息须为 3 列表(字段名称/未填写提示/输入错误提示) 或 写「无。」");

  // ════ 2026-06-29 规则↔闸审计补：按 fpKey 类型断言结构（与 §3.3 查询拆块同模式）+ 精确黑名单（高价值低误报，不用会 cry-wolf 的启发式）════
  const _fk = pin.fpKey || "";
  const _flow = _secContent("操作流程");
  // E1 纯无输入动作类(删除/查看/导出/导入/打印/复制/启停) 提示消息须「无。」，禁出字段提示表(§4.5.5：仅新增/编辑/改值/设置类有提示消息表)
  if (/\.(删除|查看|导出|导入|打印|复制|启用|停用)$/.test(_fk) && /\|/.test(promptBlock) && !/无。/.test(promptBlock))
    errs.push(`「${_fk.split(".").pop()}」无表单输入，提示消息应写「无。」、禁出字段提示表(§4.5.5：仅新增/编辑/改值/设置类才有提示消息字段表)`);
  // E2 数据变更动作类(充值/新增/编辑/删除/审核/导入/启停/上下架/改价) 必有操作日志，禁写"不输出"(§4.8)
  if (/\.(充值|新增|编辑|删除|审核|导入|启用|停用|发布|上架|下架|改价)$/.test(_fk) && /不输出/.test(logBlock))
    errs.push(`「${_fk.split(".").pop()}」属数据变更动作类，必须输出操作日志(6行表)，禁写「不输出」(§4.8：仅查询/查看/浏览类免操作日志)`);
  // E3 编辑类入口必含「回显」(§4.3.1)
  if (/\.编辑$/.test(_fk) && _flow && !/回显/.test(uc))
    errs.push("「编辑」操作流程须写明进入时「回显」原有数据(§4.3.1)，当前缺「回显」");
  // E4 字段规范「类型」列禁旧术语(§3.1.3)——精确整格匹配，不误杀"文本输入框/只读文本"
  if (fsp.trim()) {
    const badType = [...new Set([...fsp.matchAll(/\|\s*(文本|下拉|单选组|数值|图片上传|多行文本)\s*\|/g)].map(m => m[1]))];
    if (badType.length) errs.push(`字段规范「类型」列用了旧术语【${badType.join("、")}】，须用规范术语(文本→文本输入框 / 下拉→下拉选择 / 数值→数值输入框 / 图片上传→上传（图片）等·§3.1.3)`);
  }
  // E5 取消路径口语化变体黑名单(§4.3.2)——固定句「点击「取消」，系统关闭弹窗/返回X列表，不执行任何操作」
  if (/取消则不变化|关闭弹窗即可|将不进行任何操作|不进行操作并返回/.test(uc))
    errs.push("取消路径须用固定句式（点击「取消」，系统关闭弹窗/返回列表，不执行任何操作），禁口语化变体(§4.3.2)");
  // E6 提示消息列3禁汇总占位/泛化(§4.5.3)
  if (/其他字段|以原型为准|以IMG|若干字段|按字段规范校验/.test(promptBlock))
    errs.push("提示消息禁写「其他字段/以原型为准/若干字段/按字段规范校验」等汇总占位，须逐字段写具体提示(§4.5.3)");
  // E7 通用排版：用例规则「•」前禁空白(空格/Tab/NBSP)，须顶格(§0)
  if (/[ \t ]•/.test(uc))
    errs.push("用例规则节标题「•」前不得有空格/Tab/NBSP，须顶格(§0 通用排版)");

  // ════ 2026-06-28 一次性补全：quality-checklist 64 条里【能机器判】但 ⑧ 还没编码的颗粒度规则（根治"读规则≠逐条套用 + 闸只验结构不验颗粒度"）════
  const ALLTEXT = fsp + "\n" + uc;
  // ⑧A 禁推托/模糊/UI不确定括注/IMG内嵌/通用安全约束（§3.1.4 + §4.3 + 可评审性 line49-52）
  const BAN = [
    ["推托语", /以实现为准|以图为准|按业务定|按业务配置|按截图实际值|按实现\b|按产品设计|按业务约定|按业务实际|以模板支持为准|以状态枚举为准|以枚举配置为准|以产品状态规则为准/],
    ["弱化/可选括注", /（按需）|（可选）|（以[^）]{0,14}为准）/],
    ["UI不确定括注", /（若页面提供）|（若存在中间弹层）|（若提供）|（若需要）|（若存在）|（若有）/],
    ["IMG内嵌引用", /IMG-?\d|（见\s*IMG|详见\s*IMG/i],
    ["或等价弱化", /或等价(入口|提交入口|状态|[^\s，。]{0,6})/],
    ["通用安全约束(应进非功能段)", /防\s*SQL\s*注入|防\s*XSS|防注入/i],
  ];
  for (const [n, re] of BAN) if (re.test(ALLTEXT)) errs.push(`含禁写【${n}】——quality-checklist 须删/照实写/进对应段（§3.1.4/§4.3/可评审性）`);
  // ⑧B 字段规范逐行：必填=否 约束禁含"不能为空/必填"（§3.1）；默认值列禁推托语（§3.1.5）
  for (const row of fsp.split("\n")) {
    const c = row.split("|").map(s => s.trim());
    if (c.length < 6 || /字段名称/.test(c[1]) || /^-+$/.test(c[1]) || !c[1]) continue;
    if (/^否$/.test(c[3]) && /不能为空|不得为空|必填/.test(c[5])) errs.push(`字段规范：必填=否 的「${c[1]}」约束不得含"不能为空/必填"（§3.1）`);
    if (/按业务定|按业务配置|按截图实际值|以\s*IMG|按实现\b/.test(c[4])) errs.push(`字段规范：默认值列禁推托语（「${c[1]}」）（§3.1.5）`);
    if (/空\s*[（(]\s*显示/.test(c[4])) errs.push(`字段规范：默认值列禁旧包装「空（显示"X"）」，无默认值直接写占位原文（「${c[1]}」，§3.1.5）`);
  }
  // ⑧C 前置条件三要素：必含①登录②权限（§4.2.1）
  const _pre = _secContent("前置条件");
  if (_pre && !/已登录/.test(_pre)) errs.push("前置条件缺①登录要素（用户已登录<系统名称>）（§4.2.1）");
  if (_pre && !/权限/.test(_pre)) errs.push("前置条件缺②权限要素（具备「<完整菜单路径-功能点>」权限）（§4.2.1）");
  // ⑧D 提示消息列3禁混入校验逻辑（§4.5 ——列3=纯提示语）
  if (/失焦或提交时|则拦截保存|则拦截并|系统不落库|仅在.{0,8}为必填/.test(promptBlock))
    errs.push("提示消息表禁混入校验逻辑（失焦/则拦截/系统不落库/仅在X为必填）—列3=纯提示语（§4.5）");

  return errs;
}

let allPass = true;
console.log("\n════════ PRD 内容合规校验 ════════");
for (const pin of pins) {
  const errs = lintPin(pin);
  if (errs.length) { allPass = false; console.log("✗ " + (pin.fpKey || pin.title) + "："); errs.forEach(e => console.log("    - " + e)); }
  else console.log("✓ " + (pin.fpKey || pin.title) + "  合规");
}
console.log("──────────────────────────────");
console.log(allPass ? "  全部合规 PASS ✅（可注入）" : "  有违规 FAIL ❌（禁止注入，先改对）");
console.log("════════════════════════════════\n");
process.exit(allPass ? 0 : 1);
