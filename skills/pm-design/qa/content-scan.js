/* ════════════════════════════════════════════════════════════════════════
   pm-design 内容合规批量扫描  ·  content-scan.js  ·  维护者 QA 工具（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   用途：一次性扫描原型 __PRD_DATA__ 里【全部功能点】的内容合规问题——
        把"一处一处等人发现"改成"机器一把全扫出来"。纯静态解析，不开浏览器，秒级。
   运行：node content-scan.js [原型HTML路径]   （默认充值管理在线版）
   退出码：0=全合规，1=有问题（可接 CI / 改完必跑）。
   断言（每条都是历史踩过的坑）：
     · 执行者必须是「用户」（出现「客户」当执行者 → 红；业务名词客户名称/客户创建/客户端/目标客户账户不算）
     · 用例规则 7 节齐全；前置条件 ≥ 三要素
     · 操作类(新增/编辑/删除/审核/导入)操作流程含取消/异常(双路径)
     · 审核类操作流程必须含 通过 + 驳回 双结论
     · 字段规范每个字段有 constraint（不为空）
   ════════════════════════════════════════════════════════════════════════ */
const fs = require("fs");
const FILE = process.argv[2] || '';  // 必传原型路径（去个人机器路径·公开仓安全）
if (!fs.existsSync(FILE)) { console.log("✗ 文件不存在:", FILE); process.exit(1); }
const html = fs.readFileSync(FILE, "utf8");
const m = html.match(/window\.__PRD_DATA__\s*=\s*(\{[\s\S]*?\n\});/);
if (!m) { console.log("✗ 未找到 window.__PRD_DATA__"); process.exit(1); }
let prd; try { prd = JSON.parse(m[1]); } catch (e) { console.log("✗ __PRD_DATA__ JSON 解析失败:", e.message); process.exit(1); }
const fps = prd.function_points || {};
const issues = [];
// 执行者「客户」短语（业务名词不在内）
const ACTOR_BAD = /客户(已登录|进入|处于|在充值|在列表|在查询|选择|修改|浏览|点击|下载|提交)|本客户|登录客户自己|权限的客户不展示|客户 ?\{申请人\}/;
for (const [key, fp] of Object.entries(fps)) {
  const uc = fp.use_cases || {};
  const tag = (fp.fp_type || "") + (fp.fp_name || "");
  const push = (msg) => issues.push(`  [${key}] ${msg}`);
  if (ACTOR_BAD.test(JSON.stringify(uc))) push("执行者出现「客户」(应为「用户」)");
  if (!(uc.preconditions || []).length) push("缺 前置条件");
  else if ((uc.preconditions || []).length < 2) push("前置条件不足三要素(登录+权限+数据状态)");
  if (!(uc.operation_flow || []).length) push("缺 操作流程");
  if (!(uc.postconditions || []).length) push("缺 后置条件");
  if (!(uc.validations || []).length) push("缺 校验规则");
  if (uc.message_notifications === undefined) push("缺 消息通知");
  if (uc.operation_log === undefined) push("缺 操作日志");
  const flow = (uc.operation_flow || []).join("");
  if (/新增|编辑|删除|审核|导入|发起充值/.test(tag) && !/取消|关闭/.test(flow)) push("操作流程缺取消/异常路径(双路径)");
  if (/审核/.test(tag) && !(/通过/.test(flow) && /驳回/.test(flow))) push("审核操作流程缺 通过/驳回 双结论");
  let emptyCons = 0;
  ((fp.field_specs && fp.field_specs.groups) || []).forEach(g => (g.fields || []).forEach(f => { if (!f.constraint) emptyCons++; }));
  if (emptyCons) push(`${emptyCons} 个字段无约束(constraint 空)`);
}
console.log("\n========= 内容合规扫描（全 " + Object.keys(fps).length + " 个功能点）=========");
console.log("  原型:", FILE.split(/[\\/]/).pop());
if (!issues.length) console.log("  ✅ 全部合规，无问题");
else console.log("  发现 " + issues.length + " 处问题：\n" + issues.join("\n"));
console.log("====================================================================\n");
process.exit(issues.length ? 1 : 0);
