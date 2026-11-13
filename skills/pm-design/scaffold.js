#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   scaffold.js —— 页型脚手架（2026-10-07 提速·治「从零画新原型要 AI 手写几千行 pagecfg」）
   ────────────────────────────────────────────────────────────────────────
   背景：机器装配 0.375s、改一处 --check 1.5s 都已很快；唯一还慢的是【从零生成】——
         AI 要逐行手敲 project-data 的 pagecfg（每个列表页 ~60~120 行嵌套 JSON）。
         慢不只在敲字，更在【手写 JSON 易错】（少逗号/字段名写错/漏字段）→ Vue 挂不上 → 来回 debug。
   做法：AI 用【一行紧凑 spec】描述一页（标题/列/筛选/行操作/字段），机器按默认 UI 规范
         展开成【结构保证正确】的 pagecfg 块，并自动挂进导航；列表页的模拟数据直接调 mockgen 填。
         配 i18n 紧凑串 `"|中文|English|Português"` 一起用，多语标签也一行搞定。

   适用：**仅限「默认 UI 规范 / 新系统」（模式 C）**——默认规范本就是标准件，脚手架照规范出标准页。
         **复刻真系统（模式 A）禁用**：复刻的列/字段/工具条必须 RPA 抓真值 1:1，不能用标准模板套。

   用法：node scaffold.js <project-data.json> <命令> [选项]

     init <源>  --title "标题" --system-name "系统名"
                [--systems "client:客户端,admin:管理端"] [--region BR|CN] [--locales "zh,en,pt"]
         建一个空 project-data 骨架（title/systems/home/nav/pagecfg{}），后面往里加页。

     add-list <页id>  --title "商品管理" --nav "商品管理"
                [--system <key>] [--group "商品中心"]
                --cols "商品名称,价格,库存,状态"            列（逗号分隔·可带 i18n 紧凑串）
                [--filters "商品名称,状态@select:全部|启用|停用,创建时间@date"]
                [--actions "查看,编辑,删除"]                 行操作（省略默认 查看/编辑/删除·会提示）
                [--primary "新增"] [--newpage <表单页id>]     左上主按钮(蓝)·newpage 则点它跳那张表单页
                [--batch "导出,批量删除"]                     批量按钮(选中后可点)
                [--tabs "全部,待审核,已通过,已驳回"]           状态页签（第一个默认选中·骨架自动高亮切换）
                [--rows 8]                                    自动 mockgen 填 N 行模拟数据

     add-view <页id>  --title "商品详情" --nav "商品详情" [--system][--group][--hidden]
                --fields "商品名称=蓝牙耳机,价格=R$99,库存=968,状态=在售"
                   只读详情页（label=值；省 = 则值留「—」）。常作列表「查看」的跳转目标(配 --hidden)。
                [--cols 2]
                [--summary "label=销售单,no=PED0001,status=处理中"]   过程型单据：顶部订单摘要卡
                [--steps "下单:done,审核:done,发货:current,签收:pending"]  过程型单据：横向步骤条(state=done|current|pending)

     add-dialog <宿主页id>  --name <弹窗键> --title "新增商品" [--width 620] [--cols 2]
                --fields "商品名称*,分类@select:服饰|数码,价格@money*,备注@textarea"   (字段写法同 add-form)
                [--trigger "新增商品:primary"]   在宿主页加个按钮打开它（:primary=页主按钮·否则工具条按钮）；不给则需你手动在某按钮写 opens:'<弹窗键>'
                [--viewonly]                     只读明细弹窗（只留×关闭·无取消/确定）
                   弹窗底部默认自动给 取消/确定，无需配置。

     build <plan.json>   （用法：node scaffold.js <输出 project-data.json> build <plan.json> [--assemble] [--verify]）
                一个计划文件 → 一条命令造整套原型（init + 所有页）。--assemble 顺带装配预览；--verify 再逐页 render 验。
                plan 形状：{ "init":{title,"system-name",region,systems,locales}, "pages":[{cmd:"add-list",id,title,nav,cols,…}, …] }
                （pages 每项的键 = 对应 add-* 的 flag 名；cmd=add-list/add-form/add-view/add-home/add-custom）

     merge <main.json> <frag1.json> [frag2.json …]
                把多个【片段文件】的 pagecfg + nav 合并进 main（页 id 去重·同名分组合并·保留 main 的 systems/home）。
                ★ 并行扇出用：主 agent 先 init 出 main 骨架；N 个子 agent 各自 init 一个 frag(同 --systems) + add-* 写自己那几页；
                  最后 merge 合起来。各写各文件→零写冲突→墙钟÷N。

     add-form <页id>  --title "新增商品" --nav "新增商品" [--system][--group]
                --fields "商品名称*,价格@money*,分类@select:A|B,备注@textarea,上架@switch"
                   字段：尾 * = 必填；@type = select|date|datetime|textarea|switch|radio|number|readonly（默认文本）
                   @select:/@radio: 后用 | 列选项
                [--cols 2]  每行列数(默认 2·真系统整页表单常 2~3 列)
                [--hidden]  不挂导航（仅作列表页「新增」跳转目标）

     add-home <页id>  --title "仪表盘" --nav "仪表盘" [--system]
                --stats "今日开票:1234:+5% 今天:up;成功率:99.2%::;待处理:27:需跟进:warn"
                   每块 4 段：标题:数值:副文案:趋势(up|warn|空)；多块用 ; 隔开
                [--chart "开票趋势:40,55,60,75,92"]

     add-custom <页id>  --title --nav [--system][--group] --html "<div class='gcard'>…</div>" [--note "说明"]

   说明/边界（不吹）：
   - 只出【结构骨架】，列名/字段/业务内容还得你定——它省的是 JSON 嵌套+标准件+易错点，不是"秒生成业务"。
   - 分页/查询重置/圈选标注等由骨架按规范自动加，无需在 spec 里写。
   - 多语：标签直接写紧凑串 `"|中文|En|Pt"`，装配时自动展开（见 i18n-compact.js）。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const load = (p = PD) => JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, ''));
const save = (p, d) => fs.writeFileSync(p, JSON.stringify(d), "utf8");   // 2026-11-13 提速⑥：紧凑存盘
const splitList = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
/* 剥出尾部 @type（label 可能是含 | 的 i18n 紧凑串·紧凑串不含 @·故按最后一个 @ 切安全） */
function splitType(s) { const i = s.lastIndexOf('@'); return i > 0 ? { label: s.slice(0, i).trim(), type: s.slice(i + 1).trim() } : { label: s.trim(), type: '' }; }
/* 字段 spec 解析（add-form / add-dialog 共用）："label[*]"（尾*=必填）+ 可选 @type（select:/radio: 后用 | 列选项） */
function parseFields(specStr) {
  return splitList(specStr).map(spec => {
    let s = spec, required = false;
    if (/\*$/.test(s)) { required = true; s = s.replace(/\*$/, '').trim(); }
    const { label, type } = splitType(s);
    const f = { label }; if (required) f.required = true;
    let t = type, options = null;
    const m = t.match(/^(select|radio):(.*)$/);
    if (m) { t = m[1]; options = m[2].split('|').map(x => x.trim()); }
    if (t === 'select') { f.type = 'select'; if (options) f.options = options; }
    else if (t === 'radio') { f.type = 'radio'; if (options) f.options = options; }
    else if (t === 'textarea') f.type = 'textarea';
    else if (t === 'switch') f.type = 'switch';
    else if (t === 'date') f.type = 'date';
    else if (t === 'datetime') f.type = 'datetime';
    else if (t === 'readonly') f.type = 'readonly';
    else if (t === 'number' || t === 'money' || t === 'int') f.type = 'text';   // 表单里金额/数字=文本输入
    return f;    // 其余=默认文本(不写 type)
  });
}

/* ── 参数 ── */
const PD = process.argv[2];
const CMD = process.argv[3];
if (!PD || !CMD) { console.log(fs.readFileSync(__filename, 'utf8').split('════')[1]); process.exit(1); }
const argv = process.argv.slice(4);
const flags = {}; const pos = [];
for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); flags[k] = (argv[i + 1] !== undefined && !String(argv[i + 1]).startsWith('--')) ? argv[++i] : true; } else pos.push(a); }
const pageId = pos[0];

/* ── init：建空骨架 ── */
function cmdInit() {
  if (fs.existsSync(PD)) { console.error('✗ ' + PD + ' 已存在，不覆盖（要重来先删）'); process.exit(1); }
  const sysSpec = flags.systems && flags.systems !== true ? String(flags.systems) : '';
  const systems = sysSpec ? sysSpec.split(',').map(s => { const [key, label] = s.split(':'); return { key: key.trim(), label: (label || key).trim() }; }) : [{ key: 'main', label: flags['system-name'] && flags['system-name'] !== true ? String(flags['system-name']) : '系统' }];
  const d = {
    title: flags.title && flags.title !== true ? String(flags.title) : '新原型',
    systemName: flags['system-name'] && flags['system-name'] !== true ? String(flags['system-name']) : '系统',
    region: flags.region && flags.region !== true ? String(flags.region) : 'BR',
    systems, home: {}, nav: {}, pagecfg: {}
  };
  if (flags.locales && flags.locales !== true) d.locales = splitList(flags.locales);
  systems.forEach(s => { d.nav[s.key] = []; });
  save(PD, d);
  console.log('✓ 已建骨架 ' + path.basename(PD) + '（systems: ' + systems.map(s => s.key).join('/') + '）');
  console.log('  下一步：scaffold.js ' + PD + ' add-list <页id> --title … --cols …');
}

/* ── nav 挂载 ── */
function sysKey(d) {
  if (flags.system && flags.system !== true) return String(flags.system);
  const ks = Object.keys(d.nav || {});
  if (ks.length === 1) return ks[0];
  if (d.systems && d.systems.length === 1) return d.systems[0].key;
  console.error('✗ 多个 system，必须 --system <key>（有：' + (ks.join('/') || '无') + '）'); process.exit(1);
}
function registerNav(d, id, label, { home } = {}) {
  if (flags.hidden) return;                       // 仅作跳转目标的表单页不挂导航
  const sk = sysKey(d);
  d.nav[sk] = d.nav[sk] || [];
  const group = flags.group && flags.group !== true ? String(flags.group) : '';
  if (group) {
    let g = d.nav[sk].find(x => x && x.group === group);
    if (!g) { g = { group, items: [] }; d.nav[sk].push(g); }
    if (!g.items.some(it => (Array.isArray(it) ? it[0] : it.id) === id)) g.items.push([id, label]);
  } else {
    if (!d.nav[sk].some(x => x && (x.id === id || (Array.isArray(x.items) && x.items.some(it => (Array.isArray(it) ? it[0] : it.id) === id))))) d.nav[sk].push({ id, label });
  }
  if (home) { d.home = d.home || {}; if (!d.home[sk]) d.home[sk] = id; }
}
const need = (k) => { if (!flags[k] || flags[k] === true) { console.error('✗ 缺 --' + k); process.exit(1); } return String(flags[k]); };
const titleOf = () => (flags.title && flags.title !== true ? String(flags.title) : (flags.nav && flags.nav !== true ? String(flags.nav) : pageId));
const navOf = () => (flags.nav && flags.nav !== true ? String(flags.nav) : titleOf());

/* ── 列表页 ── */
function buildFilter(spec) {
  const { label, type } = splitType(spec);                   // label 可能还带 :opts(在 @select 情况下 type 自带)
  let t = type, options = null, lab = label;
  const m = t.match(/^(select|multi|radio):(.*)$/);
  if (m) { t = m[1]; options = m[2].split('|').map(x => x.trim()); }
  if (t === 'select' || t === 'multi') { const f = { label: lab, type: 'select' }; if (options) f.options = options; if (t === 'multi') f.type = 'multiSelect'; return f; }
  if (t === 'date') return { label: lab, type: 'date' };      // 骨架 type:'date' = 区间(start~end)
  if (t === 'dateOne') return { label: lab, type: 'dateOne' };
  return { label: lab };                                      // 纯输入框（字段名进占位符）
}
function cmdAddList() {
  const d = load();
  const cfg = {};
  const title = titleOf();
  cfg.banner = title; cfg.listTitle = title;
  if (flags.filters && flags.filters !== true) cfg.filters = splitList(flags.filters).map(buildFilter);
  cfg.columns = splitList(need('cols')).map(c => splitType(c).label);   // 列只取标签(@type 仅给 mockgen 推断用·此处丢弃·mockgen 按标签自推)
  let actions, defaulted = false;
  if (flags.actions && flags.actions !== true) actions = splitList(flags.actions);
  else { actions = ['查看', '编辑', '删除']; defaulted = true; }
  cfg.actions = actions;
  /* 状态页签（第一个默认选中·骨架自动高亮切换）
     🔴 2026-11-04 根治「页签点了不换数据」：以前只生成 {label}，没有 key —— 骨架 goTab(K(st.key)) 拿到
        undefined，点哪个页签都切不动，等于摆设。现在每个页签必带 key（t0/t1/…），
        配 rowsByStatus[key] 就能真切换。规范 §5.3「点状态换数据·任何状态都不能显示空表」要求的就是这个。 */
  if (flags.tabs && flags.tabs !== true) cfg.statusTabs = splitList(flags.tabs).map((t, i) => ({ key: 't' + i, label: t }));
  if (flags.primary && flags.primary !== true) { cfg.primaryBtn = { label: String(flags.primary) }; if (flags.newpage && flags.newpage !== true) cfg.primaryBtn.goto = String(flags.newpage); }
  if (flags.batch && flags.batch !== true) cfg.selectActions = splitList(flags.batch).map(l => ({ label: l, needSel: true }));
  d.pagecfg = d.pagecfg || {};
  d.pagecfg[pageId] = cfg;
  registerNav(d, pageId, navOf());
  save(PD, d);
  console.log('✓ 列表页 [' + pageId + ']「' + title + '」');
  console.log('  列 ' + cfg.columns.length + '：' + cfg.columns.join(' | '));
  if (cfg.filters) console.log('  筛选 ' + cfg.filters.length + '：' + cfg.filters.map(f => f.label + (f.type ? '(' + f.type + ')' : '')).join(' | '));
  console.log('  行操作：' + actions.join(' / ') + (defaulted ? '  ← 默认值(不对就 --actions 指定，或 p.js del 掉)' : ''));
  if (cfg.primaryBtn) console.log('  主按钮：' + cfg.primaryBtn.label + (cfg.primaryBtn.goto ? ' → 跳 ' + cfg.primaryBtn.goto : ''));
  const n = Number(flags.rows || 0);
  if (n > 0) {
    try { execFileSync(process.execPath, [path.join(__dirname, 'mockgen.js'), PD, pageId, String(n), '--apply'], { stdio: 'inherit' }); }
    catch (e) { console.error('  （mockgen 填行失败，可手动跑：node mockgen.js ' + PD + ' ' + pageId + ' ' + n + ' --apply）'); }
  } else console.log('  模拟数据：未填（加 --rows N 自动生成，或 node mockgen.js 源 ' + pageId + ' N --apply）');
}

/* ── 整页表单 ── */
function cmdAddForm() {
  const d = load();
  const fields = parseFields(need('fields'));
  const cols = Number(flags.cols || 2);
  const title = titleOf();
  d.pagecfg = d.pagecfg || {};
  d.pagecfg[pageId] = { banner: title, pageForm: { title, sections: [{ cols, fields }], footer: [{ label: '取消' }, { label: '保存', primary: true }] } };
  registerNav(d, pageId, navOf());
  save(PD, d);
  console.log('✓ 整页表单 [' + pageId + ']「' + title + '」· ' + cols + ' 列 · ' + fields.length + ' 字段' + (flags.hidden ? ' · 不挂导航(作跳转目标)' : ''));
  console.log('  字段：' + fields.map(f => f.label + (f.required ? '*' : '') + (f.type ? '(' + f.type + ')' : '')).join(' | '));
}

/* ── 仪表盘 ── */
function cmdAddHome() {
  const d = load();
  const title = titleOf();
  const stats = String(need('stats')).split(';').map(b => b.split(':').map(x => x.trim())).map(p => [p[0] || '', p[1] || '', p[2] || '', p[3] || '']);
  const cfg = { stats };
  if (flags.chart && flags.chart !== true) { const [ct, cv] = String(flags.chart).split(':'); cfg.chart = { title: ct, values: (cv || '').split(',').map(Number).filter(n => !isNaN(n)) }; }
  d.pagecfg = d.pagecfg || {};
  d.pagecfg[pageId] = cfg;
  registerNav(d, pageId, navOf(), { home: true });
  save(PD, d);
  console.log('✓ 仪表盘 [' + pageId + ']「' + title + '」· ' + stats.length + ' 个指标卡' + (cfg.chart ? ' + 趋势图' : ''));
  stats.forEach(s => console.log('   · ' + s[0] + ' = ' + s[1] + (s[2] ? ' (' + s[2] + ')' : '')));
}

/* ── 只读详情页（复用已证可渲染的 pageForm·字段全 readonly）── */
function cmdAddView() {
  const d = load();
  const fields = splitList(need('fields')).map(spec => {
    let s = spec.replace(/\*$/, '').trim();
    const eq = s.indexOf('=');
    const label = (eq >= 0 ? s.slice(0, eq) : s).trim();
    const value = eq >= 0 ? s.slice(eq + 1).trim() : '—';
    return { label, type: 'readonly', value };
  });
  const cols = Number(flags.cols || 2);
  const title = titleOf();
  const pf = { title, sections: [{ cols, fields }], footer: [{ label: '返回' }] };
  // §过程型单据（可选）：--summary "label=xx,no=xx,status=xx" + --steps "下单:done,审核:done,发货:current,签收:pending" → 顶部摘要卡 + 横向步骤条
  if (flags.summary && flags.summary !== true) {
    const sm = {}; String(flags.summary).split(',').forEach(kv => { const i = kv.indexOf('='); if (i > 0) sm[kv.slice(0, i).trim()] = kv.slice(i + 1).trim(); });
    pf.summary = { label: sm.label || title, no: sm.no || '', status: sm.status || '' };
  }
  if (flags.steps && flags.steps !== true) {
    pf.statusSteps = splitList(flags.steps).map(s => { const i = s.indexOf(':'); const label = (i >= 0 ? s.slice(0, i) : s).trim(); const state = (i >= 0 ? s.slice(i + 1).trim() : 'pending'); return { label, state: /^(done|current|pending)$/.test(state) ? state : 'pending' }; });
  }
  d.pagecfg = d.pagecfg || {};
  d.pagecfg[pageId] = { banner: title, pageForm: pf };
  registerNav(d, pageId, navOf());
  save(PD, d);
  console.log('✓ ' + (pf.statusSteps ? '过程型单据' : '只读详情页') + ' [' + pageId + ']「' + title + '」· ' + cols + ' 列 · ' + fields.length + ' 字段' + (flags.hidden ? ' · 不挂导航(作跳转目标)' : ''));
  console.log('  字段：' + fields.map(f => f.label + '=' + f.value).join(' | '));
  if (pf.statusSteps) console.log('  步骤条：' + pf.statusSteps.map(s => s.label + '(' + s.state + ')').join(' → '));
}

/* ── 弹窗（挂到已存在的页·opens 触发；默认底部自动 取消/确定）── */
function cmdAddDialog() {
  const d = load();
  const host = d.pagecfg && d.pagecfg[pageId];
  if (!host) { console.error('✗ 弹窗要挂到已存在的页，但没有 [' + pageId + ']（先 add-list/add-form 建它）'); process.exit(1); }
  const name = (flags.name && flags.name !== true) ? String(flags.name) : (pageId + '_dlg');
  const title = titleOf();
  const dlg = { title, width: (flags.width && flags.width !== true) ? String(flags.width) : '620px', cols: Number(flags.cols || 2) };
  if (flags.fields && flags.fields !== true) dlg.fields = parseFields(flags.fields);
  if (flags.viewonly) dlg.viewOnly = true;      // 只读明细弹窗(只留×关闭)
  host.dialogs = host.dialogs || {};
  host.dialogs[name] = dlg;
  // 触发按钮：--trigger "文案[:primary]"。primary→页主按钮；否则→工具条按钮(needSel:false 任何时候可点)
  let trig = '';
  if (flags.trigger && flags.trigger !== true) {
    let t = String(flags.trigger), primary = /:primary$/.test(t);
    if (primary) t = t.replace(/:primary$/, '').trim();
    trig = t;
    if (primary) host.primaryBtn = { label: t, opens: name };
    else { host.selectActions = host.selectActions || []; if (!host.selectActions.some(a => (a && a.opens) === name)) host.selectActions.push({ label: t, opens: name, needSel: false }); }
  }
  save(PD, d);
  console.log('✓ 弹窗 [' + name + ']「' + title + '」挂到页 ' + pageId + ' · ' + ((dlg.fields || []).length) + ' 字段'
    + (trig ? ' · 触发按钮「' + trig + '」' : ' · ⚠ 没给 --trigger；需在该页某按钮/行操作写 opens:\'' + name + '\' 才能打开'));
}

/* ── 从计划文件一条命令造整套原型（init + 所有页 + 可选装配/验证）──
   plan.json 形状：{ "init":{title,"system-name",region,systems,locales,defaultLocale}, "pages":[{cmd,id,…各 add-* 的参数(键=flag 名)}] }
   用法：node scaffold.js <输出 project-data.json> build <plan.json> [--assemble] [--verify]
   —— 这是"写页产出"的确定性落地格式：N 条命令压成 1 条。并行扇出时也可让每个子 agent 产一个片段(见 merge)。 */
function cmdBuild() {
  const planPath = pos[0];
  if (!planPath || !fs.existsSync(planPath)) { console.error('✗ build 要给 plan.json（node scaffold.js <输出.json> build <plan.json>）'); process.exit(1); }
  const plan = JSON.parse(fs.readFileSync(planPath, 'utf8').replace(/^﻿/, ''));
  const out = PD;
  if (fs.existsSync(out)) fs.unlinkSync(out);                 // build = 从 plan 一次性全新造
  const flagsOf = (o, skip) => { const a = []; for (const k in o) { if (skip.indexOf(k) >= 0) continue; const v = o[k]; if (v === true) a.push('--' + k); else if (v === false || v == null) continue; else a.push('--' + k, Array.isArray(v) ? v.join(',') : String(v)); } return a; };
  const runSelf = args => execFileSync(process.execPath, [__filename, out, ...args], { stdio: 'inherit' });
  runSelf(['init', ...flagsOf(plan.init || {}, [])]);
  const pages = plan.pages || [];
  for (const pg of pages) {
    if (!pg.cmd || !pg.id) { console.error('✗ plan.pages 每项要有 cmd 和 id'); process.exit(1); }
    runSelf([pg.cmd, pg.id, ...flagsOf(pg, ['cmd', 'id'])]);
  }
  console.log('\n✓ build 完成：' + pages.length + ' 页 → ' + path.basename(out));
  if (flags.assemble || flags.verify) {
    const bld = path.join(path.dirname(out), '_bld.html');
    execFileSync(process.execPath, [path.join(__dirname, 'qa', 'assemble-prototype.js'), out, bld, '--fast'], { stdio: 'inherit' });
    if (flags.verify) {
      const ids = pages.map(p => p.id).join(',');
      try { execFileSync(process.execPath, [path.join(__dirname, 'p.js'), out, 'render', ids], { stdio: 'inherit' }); }
      catch (e) { console.error('⚠ 有页渲染验证不过（见上），逐页修'); process.exitCode = 1; }
    }
  }
}

/* ── 片段合并（并行扇出的地基：各 agent 各写各文件，最后合并，零写冲突）── */
function cmdMerge() {
  const main = load();
  main.pagecfg = main.pagecfg || {}; main.nav = main.nav || {}; main.home = main.home || {};
  const frags = pos;                       // merge 后面的全部位置参数 = 片段文件
  if (!frags.length) { console.error('✗ merge 要给至少一个片段文件'); process.exit(1); }
  let nPages = 0; const added = []; const overwrote = [];
  for (const fp of frags) {
    if (!fs.existsSync(fp)) { console.error('✗ 片段不存在：' + fp); process.exit(1); }
    const frag = JSON.parse(fs.readFileSync(fp, 'utf8').replace(/^﻿/, ''));
    for (const pid in (frag.pagecfg || {})) {
      if (main.pagecfg[pid]) overwrote.push(pid); else added.push(pid);
      main.pagecfg[pid] = frag.pagecfg[pid]; nPages++;
    }
    for (const sk in (frag.nav || {})) {
      main.nav[sk] = main.nav[sk] || [];
      for (const entry of frag.nav[sk]) {
        if (!entry) continue;
        const eid = it => (Array.isArray(it) ? it[0] : (it && it.id));
        if (entry.group) {
          let g = main.nav[sk].find(x => x && x.group === entry.group);
          if (!g) { g = { group: entry.group, items: [] }; main.nav[sk].push(g); }
          for (const it of (entry.items || [])) if (!g.items.some(e => eid(e) === eid(it))) g.items.push(it);
        } else if (entry.id) {
          const exists = main.nav[sk].some(x => x && (x.id === entry.id || (Array.isArray(x.items) && x.items.some(e => eid(e) === entry.id))));
          if (!exists) main.nav[sk].push(entry);
        }
      }
    }
    for (const sk in (frag.home || {})) if (!main.home[sk]) main.home[sk] = frag.home[sk];
  }
  save(PD, main);
  console.log('✓ 合并完成：' + nPages + ' 页 ← ' + frags.length + ' 个片段');
  if (added.length) console.log('  新增：' + added.join(', '));
  if (overwrote.length) console.log('  ⚠ 覆盖(片段里 id 与 main 重名)：' + overwrote.join(', '));
}

/* ── 自定义页 ── */
function cmdAddCustom() {
  const d = load();
  const title = titleOf();
  const cfg = { banner: title, custom: need('html') };
  if (flags.note && flags.note !== true) cfg.note = String(flags.note);
  d.pagecfg = d.pagecfg || {};
  d.pagecfg[pageId] = cfg;
  registerNav(d, pageId, navOf());
  save(PD, d);
  console.log('✓ 自定义页 [' + pageId + ']「' + title + '」');
}

if (CMD === 'init') cmdInit();
else if (CMD === 'build') cmdBuild();
else if (CMD === 'merge') cmdMerge();
else if (CMD === 'add-list') { if (!pageId) { console.error('✗ 要给页 id'); process.exit(1); } cmdAddList(); }
else if (CMD === 'add-form') { if (!pageId) { console.error('✗ 要给页 id'); process.exit(1); } cmdAddForm(); }
else if (CMD === 'add-view') { if (!pageId) { console.error('✗ 要给页 id'); process.exit(1); } cmdAddView(); }
else if (CMD === 'add-dialog') { if (!pageId) { console.error('✗ 要给【宿主页】id（弹窗挂在哪页）'); process.exit(1); } cmdAddDialog(); }
else if (CMD === 'add-home') { if (!pageId) { console.error('✗ 要给页 id'); process.exit(1); } cmdAddHome(); }
else if (CMD === 'add-custom') { if (!pageId) { console.error('✗ 要给页 id'); process.exit(1); } cmdAddCustom(); }
else { console.error('✗ 不认识的命令：' + CMD + '（init / build / merge / add-list / add-form / add-view / add-dialog / add-home / add-custom）'); process.exit(1); }
