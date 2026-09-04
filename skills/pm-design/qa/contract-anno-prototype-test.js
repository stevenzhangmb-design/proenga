/* ════════════════════════════════════════════════════════════════════════
   契约闸  ·  contract-anno-prototype-test.js  ·  维护者 QA 工具（不打包给客户）
   ────────────────────────────────────────────────────────────────────────
   守"anno-server 写的内容键 ≡ 原型弹窗渲染读的键"——杜绝今天这类【契约漂移】：
     server 把字段规范/用例规则写进 function_points[fp]._draft_fieldSpecs / _draft_useCaseRules，
     但原型弹窗却去读旧的 field_specs.groups / use_cases.* → 键对不上 → 弹窗显示空。
   单一契约源 = CONTENT_KEYS；server 输出 与 每个原型弹窗渲染 都必须用这俩键，任一侧漂移即红。
   （这是静态早警；动态证明见 modal-display-e2e-test.js 真点开弹窗看显示。）
   anno-server 路径默认 = ai-rules 同级；可用 ANNO_SERVER 覆盖。退出码 0=一致 1=漂移。
   ════════════════════════════════════════════════════════════════════════ */
const path = require('path'), fs = require('fs');
const { findPrototypes, ANNOTATION_LAYER } = require('./_gate-env');
const ANNO = process.env.ANNO_SERVER || path.join(__dirname, '../../../../anno-server');
const srv = require(path.join(ANNO, 'server.js'));

// 单一契约：字段规范 / 用例规则 内容落在这两个键上
const CONTENT_KEYS = ['_draft_fieldSpecs', '_draft_useCaseRules'];
// 原型弹窗渲染须读 fpData.<key>（修复后主路径就是 fpData._draft_fieldSpecs/_draft_useCaseRules）
// 自动探测 archive 内所有标注原型 + 标准件（annotation-layer）；去重，标准件必含
const FILES = [...new Set([...findPrototypes(), ANNOTATION_LAYER])];

let pass = true;
const log = (ok, m) => { if (!ok) pass = false; console.log((ok ? '  ✓ ' : '  ✗ ') + m); };
console.log('\n════════ 契约闸：anno-server 写键 ≡ 原型弹窗读键 ════════');

// ── 1. 服务器侧：mergePinIntoPrd 把内容写进哪两个键 ──
const prdData = { system_name: '契约测试', function_points: {}, page_menus: {} };
const fpKey = srv.mergePinIntoPrd(prdData, {
  boundFp: '契约-OMS.充值', title: '充值',
  fieldSpecs: 'FS_MARK', useCaseRules: 'UC_MARK', _fullEdit: true,
});
const fp = (fpKey && prdData.function_points[fpKey]) || {};
log(fp._draft_fieldSpecs === 'FS_MARK', 'server 把字段规范写进 _draft_fieldSpecs');
log(fp._draft_useCaseRules === 'UC_MARK', 'server 把用例规则写进 _draft_useCaseRules');

// ── 2. 原型侧：每个弹窗渲染必须读 fpData.<内容键> ──
for (const f of FILES) {
  const name = path.basename(f);
  let txt = '';
  try { txt = fs.readFileSync(f, 'utf-8'); } catch (e) { log(false, name + ' 读取失败: ' + e.message); continue; }
  for (const k of CONTENT_KEYS) log(txt.includes('fpData.' + k), name + ' 弹窗渲染读 fpData.' + k);
}

console.log('──────────────────────────────────');
console.log(pass ? '  契约一致 PASS ✅' : '  契约漂移 FAIL ❌（server 写的键 原型弹窗没读 → 弹窗会空）');
console.log('════════════════════════════════════\n');
process.exit(pass ? 0 : 1);
