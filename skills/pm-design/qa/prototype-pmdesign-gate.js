#!/usr/bin/env node
/**
 * prototype-pmdesign-gate.js — 原型 pm-design 合规闸（机器闸 / 随包发）
 *
 * 目的：根治"AI 画原型不遵循 pm-design（裸 HTML、无标注层），导致圈选→PRD 流程断掉"。
 *       不靠 AI 自觉——任何 AI 工具/任何打包后的用户，原型生成后必跑此闸；红 = 不合规，禁交付。
 *
 * 用法：
 *   node prototype-pmdesign-gate.js <原型.html>          # 检查单个文件
 *   node prototype-pmdesign-gate.js ./archive            # 检查目录下所有 *.html
 *
 * 退出码：0 = 全绿（合规）；1 = 有红（不合规，禁交付）；2 = 用法/读取错误。
 *
 * 检查项（pm-design 硬性条款，缺一不可）：
 *   C1 标注层已注入   —— 含 window.__ANNO_LAYER_VERSION__ 或 #anno-app 或 _annoInjectPins（标注层标志）
 *   C2 PRD 数据源     —— 含 window.__PRD_DATA__（单一真理源，圈选/注入回写依赖它）
 *   C3 Element Plus   —— 含 element-plus / ElementPlus / el- 组件（标准技术栈）
 *   C4 标注锚点       —— 含 data-annotation 或 ak( （标准结构锚点，否则点选/框选无法定位）
 *   C5 Vue 运行时     —— 含 vue（createApp / Vue）
 *   分享只读版（含 __ANNO_READONLY__=true）豁免 C4（只读版本身不标注），但仍须 C1/C2。
 */
'use strict';
const fs = require('fs');
const path = require('path');
let primaryTarget = null;
try { ({ primaryTarget } = require('./_gate-env')); } catch (e) {}

const CHECKS = [
  { key: 'C1 标注层', re: /__ANNO_LAYER_VERSION__|id=["']anno-app["']|_annoInjectPins|annotation-layer/i,
    miss: '未注入标注层（须整段原样注入 components/annotation-layer.html），否则无法圈选/框选生成 PRD' },
  { key: 'C2 PRD数据源', re: /window\.__PRD_DATA__|__PRD_DATA__/,
    miss: '缺 window.__PRD_DATA__（prd-data 单一真理源），圈选/注入回写无处落' },
  { key: 'C3 ElementPlus', re: /element-plus|ElementPlus|<el-[a-z]/i,
    miss: '未用 Element Plus 标准技术栈（pm-design 要求 Vue3+EP）' },
  { key: 'C4 标注锚点', re: /data-annotation/,
    miss: '缺 data-annotation 标注锚点，点选/框选无法定位到功能点' },
  { key: 'C5 Vue运行时', re: /vue(@|\.global|\.runtime|\.min|\/dist)|createApp\(|Vue\.createApp/i,
    miss: '未引入 Vue 运行时' },
  // ↓↓↓ 「验真能用」强化项：仅"注入了标注层文件"不算数，宿主必须把控件接通（否则工具条不显示/点了没反应）↓↓↓
  { key: 'C6 标注控件已接桥', re: /__anno\.(toggleMode|toggleShow)/, re2: /复制已圈功能/,
    miss: '宿主顶栏未把标注工具条接到 window.__anno —— 必须在【宿主头部】内联渲染「✏️标注开关 / 复制已圈功能 / 导出分享版 / 清空」并桥接 window.__anno.toggleShow/toggleMode（见 annotation-layer.html 约第525行铁律 + reference-prototype.html 头部写法）。只整段粘贴标注层而不接控件 = 标注开关失效。' },
  { key: 'C7 视图同步', re: /__annoSetView/,
    miss: '宿主未调用 window.__annoSetView（视图切换时把 系统-页面 同步给标注层做 pageKey 隔离），否则建 PIN 会串页' },
  { key: 'C8 锚点充足', count: /data-annotation/g, min: 6,
    miss: 'data-annotation 锚点过少（应 ≥6，覆盖筛选区/工具栏/表格/表单/弹窗/分页等所有可圈选容器），过少则多数区域右键圈选"点了没反应"' },
  // C9（并自原 renderer-contract-gate，消重）：渲染器 stat-card 标签类名必须被标注组件 _CARD_TITLE_SEL 认出，
  //   否则框选卡片取不到名字 → 退化为通用"功能区"（2026-06-30 根因 bug）。
  { key: 'C9 卡片标签类名', cardLabel: true,
    miss: 'stat-card 卡片标签用了标注组件不认的类名（如 lab/val/note）—— 必须含 label/title（如 stat-label/stat-value/stat-hint），否则框选卡片标注命名退化为"功能区"' },
  // C10：宿主调用的 window.__anno.<method> 必须是标准桥真实暴露的方法（否则开关/按钮静默失效，标注永不启用）。
  //   标准桥仅暴露这些方法（取自 annotation-layer.html bridge）；setEnabled 等不存在 → 调了等于没调。
  { key: 'C10 host桥方法合法', bridge: true,
    miss: '标注桥无此方法 → 开关/按钮静默失效；用 toggleShow/toggleMode 等标准桥方法（见 reference-prototype.html onAnnoToggle）' },
];

/* 标准 window.__anno 桥真实暴露的方法集。
   ★ 从 components/annotation-layer.html 的 bridge 实时解析，不再硬编码——
     2026-08-06 实测事故：标注层升到 v1.10.0 新增 exportDevkit/generateCode（浏览器里确认是 function），
     骨架顶栏也照契约加了对应按钮，但本闸白名单没跟着改 → 合规原型被判红（假红）。
     硬编码白名单每次标注层升级都会过期一次；改成解析单一真理源后，结构上不再发生。
   解析失败（文件缺失/格式大改）才回退到内置兜底集，保证闸本身不会因解析问题崩掉。 */
const BRIDGE_FALLBACK = [
  'toggleShow', 'toggleMode', 'scanMissing', 'openScopedList', 'exportShare',
  'clearPins', 'restoreCleared', 'restoreFromPRD', 'captureScreen',
  'exportDevkit', 'generateCode',
  'showPins', 'pinModeOn', 'pinCount',
];
const ANNO_BRIDGE_METHODS = (() => {
  try {
    const layer = fs.readFileSync(path.join(__dirname, '..', 'components', 'annotation-layer.html'), 'utf8');
    // bridge 形如：window.__anno = { toggleShow: (v)=>{…}, pinCount: …, … }
    const m = layer.match(/window\.__anno\s*=\s*\{([\s\S]*?)\n\s*\};/);
    if (m) {
      const names = [...m[1].matchAll(/(?:^|[,{\s])([A-Za-z_$][\w$]*)\s*:/g)].map(x => x[1]);
      if (names.length >= 8) return new Set(names.concat(BRIDGE_FALLBACK));
    }
  } catch (_) { /* 落到兜底 */ }
  return new Set(BRIDGE_FALLBACK);
})();

function checkFile(file) {
  let html;
  try { html = fs.readFileSync(file, 'utf8'); }
  catch (e) { return { file, ok: false, fatal: '读取失败: ' + e.message, fails: [] }; }
  // 说明文档网页(显式打 __NOT_A_PROTOTYPE__ 标记)不是 pm-design 原型，跳过合规校验。
  // 真原型永不带此标记，故不削弱"裸HTML冒充原型"的抓取能力。
  if (html.includes('__NOT_A_PROTOTYPE__')) return { file, ok: true, skipped: true, fails: [] };
  const fails = [];
  for (const c of CHECKS) {
    if (c.count) {                                   // 计数型：锚点数量必须达标
      const n = (html.match(c.count) || []).length;
      if (n < c.min) fails.push(`${c.key}：${c.miss}（当前仅 ${n} 个）`);
      continue;
    }
    if (c.cardLabel) {                               // 卡片标签类名型：stat-card 的标签子级须被组件认出
      const hits = [...html.matchAll(/class="(stat-card[^"]*)"[^>]*>\s*<div\s+class="([^"]+)"/g)];
      const bad = hits.map(m => m[2]).filter(cls => !/(label|title)/i.test(cls));
      if (bad.length) fails.push(`${c.key}：${c.miss}（违约类名: ${[...new Set(bad)].join(' , ')}）`);
      continue;                                       // 无 stat-card 则跳过（不强制每页都有卡片）
    }
    if (c.bridge) {                                   // 桥方法合法型：宿主调用的 __anno.<method>() 必须是标准桥真实暴露的
      // 全文件扫 __anno.<method>( 调用（标注层 bridge 是 window.__anno={...} 赋值定义、非 .x() 调用，故这些调用都是宿主发的）
      const called = [...html.matchAll(/(?:window\.)?__anno\.([a-zA-Z_]+)\s*\(/g)].map(m => m[1]);
      const bad = [...new Set(called.filter(m => !ANNO_BRIDGE_METHODS.has(m)))];
      if (bad.length) fails.push(`${c.key}：宿主调用了标注桥不存在的方法（${bad.join(' , ')}）—— ${c.miss}`);
      if (!called.includes('toggleMode')) fails.push(`${c.key}：未见 __anno.toggleMode() 调用 → 开标注开关不启用右键圈选（onAnnoToggle 须调 toggleShow+toggleMode）`);
      continue;
    }
    let pass = c.re.test(html);
    if (pass && c.re2) pass = c.re2.test(html);       // 需同时满足两个特征（控件 + 桥接）
    if (!pass) fails.push(`${c.key}：${c.miss}`);
  }
  return { file, ok: fails.length === 0, fails };
}

function collect(target) {
  const st = fs.statSync(target);
  if (st.isFile()) return [target];
  return fs.readdirSync(target)
    .filter(f => /\.html?$/i.test(f))
    .map(f => path.join(target, f));
}

function main() {
  let arg = process.argv[2];
  if (!arg && primaryTarget) { try { arg = primaryTarget().prototype; } catch (e) {} }  // deliver-gate 无参跑时自动探测主交付原型
  if (!arg) { console.error('用法: node prototype-pmdesign-gate.js <原型.html | 目录>'); process.exit(2); }
  let files;
  try { files = collect(arg); } catch (e) { console.error('路径错误: ' + e.message); process.exit(2); }
  if (!files.length) { console.error('未找到 .html 文件: ' + arg); process.exit(2); }

  let red = 0;
  console.log('=== 原型 pm-design 合规闸 ===');
  for (const f of files) {
    const r = checkFile(f);
    const name = path.basename(f);
    if (r.fatal) { console.log(`❌ ${name} — ${r.fatal}`); red++; continue; }
    if (r.skipped) { console.log(`⏭️  ${name} — 说明文档网页(非原型)，跳过`); continue; }
    if (r.ok) {
      console.log(`✅ ${name}${r.readonly ? '（只读分享版）' : ''} — 合规`);
    } else {
      red++;
      console.log(`❌ ${name}${r.readonly ? '（只读分享版）' : ''} — 不合规（禁交付）：`);
      r.fails.forEach(m => console.log(`     · ${m}`));
    }
  }
  console.log('============================');
  if (red) {
    console.log(`结果：${red} 个原型不合规 → 红，禁交付。请按 pm-design 重画（prototype-template.md + 整段注入 annotation-layer.html）。`);
    process.exit(1);
  }
  console.log('结果：全部合规 → 绿。');
  process.exit(0);
}
main();
