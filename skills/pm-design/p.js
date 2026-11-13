#!/usr/bin/env node
/* ============================================================================
   p.js —— 改原型的【唯一】命令（2026-10-06 用户拍板·治「改一处要来回 6~20 次」）
   ----------------------------------------------------------------------------
   为什么有它：实测装配整个原型只要 0.375 秒，但 AI 改一处要 6~20 次工具调用
   （探结构 → 写一次性脚本 → 跑 → 装配 → 写验证脚本 → 跑 → 看图），时间 99%
   耗在来回，不在机器。这个命令把那 6~20 次压成 1~2 次。

   用法（全部 node p.js <project-data.json> <子命令> …）：

     find  "<文字>"                 这句话写在哪？列出所有路径（替代"写脚本翻 JSON"）
     show  <页id>                   这一页有什么：筛选/列/工具条/行操作/弹窗/详情件/状态
     get   "<路径>"                 取值
     set   "<路径>=<值>" [更多…]     改值，改完自动重装预览
     del   "<路径>" [更多…]          删字段 / 删数组元素（数组走 splice），改完自动重装
     shot  <页id>[,<页id>…]          装配 + 截图（默认带 --fast），打印图片路径
     render <页id>[,<页id>…]         装配 + 【无头渲染】，用【纯文字】报告真实渲染结果：
                                     列/行数/筛选/工具条/页签/表单字段 + ❌JS报错 + ❌横向溢出。
                                     —— 改完用它替代「截图看图」：对了直接确认，不用花 token 读图。
     tree  [<页id>]                  页面清单 / 某页的键树
     deliv <页id,…|all>              ★ 在【交付件】（用户实际打开的那个离线 .html）上一次问清，
                                     不重新装配。渲染报告同 render，另支持 --ask 自定义问法。
                                     2026-10-13 从会话记录查实：以前只能用 act.js「开一页→问一个值」，
                                     一场会话问了 106 次；原因是 p.js 以前只看预览，而铁律要求
                                     必须在交付件里验收。现在这 106 次 ≈ 1 次。
                                       node p.js 源.json deliv all
                                       node p.js 源.json deliv issuing,poret
                                       node p.js 源.json deliv all --ask "<JS表达式>"
                                       node p.js 源.json deliv all --file <别的.html>   （默认读源里的 _deliverable）

   常用组合（一次调用把「改完 + 确认」做完）：
     node p.js 源.json set "pagecfg.goods.columns[2].label=税种" --check goods
       改完顺手【无头渲染这一页】，用文字告诉你列/行/报错/溢出——对了就不用再截图（省一次往返+图片 token）。
     node p.js 源.json set "cashierOrder.dialogs.issueOne.done=已提交开票请求" --shot cashierOrder
       需要【眼看视觉保真】（配色/对齐/遮挡）时才截图；结构对不对用 --check 足够。

   路径写法：
     cashierOrder.dialogs.issueOne.done      首段是页 id → 自动补 pagecfg.
     pagecfg.cashierOrder.columns[2].label   也可以从根写全
     systems[5].label                        支持 [下标]

   值写法：
     =文字                      普通字符串；原值是多语对象时只改 zh，en/pt 保持不动并给出警告
     =中文||English||Português  多语一次写全（按 zh/en/pt 顺序，少写的保持原值）
     =@true / @false / @null / @123          布尔/空/数字
     =@json:{"a":1}             原样 JSON

   截图参数：
     --shot <页id,…>            改完顺便截图
     --click "<文案>"           截图前先点一下这个文字的元素（用来打开弹窗 / 进详情）
     --click2 "<文案>"          再点一下（例：先点「更多」再点「重开发票」）
     --tab "<页签文案>"          点一个页签
     --port 9423                调试 Chrome 端口（默认 9423，没开会自动拉起）
============================================================================ */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync, spawn } = require('child_process');

const HERE = __dirname;
const LOC = ['zh', 'en', 'pt', 'spa'];
const isI18n = v => !!v && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).length > 0 && Object.keys(v).every(k => LOC.includes(k));
let _parseCompact; try { ({ parseCompact: _parseCompact } = require('./i18n-compact')); } catch (_) { _parseCompact = () => null; }
/* 显示用：i18n 对象取 zh；i18n 紧凑串 "|zh|en|pt" 也取 zh（与装配一致·否则 show/tree 显示一串竖线）。只用于显示，不碰写回。 */
const L = v => { if (isI18n(v)) return v.zh || Object.values(v)[0]; if (typeof v === 'string') { const c = _parseCompact(v); if (c) return c.zh; } return v; };
const flat = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();

/* ───────── 参数 ───────── */
const argv = process.argv.slice(2);
if (argv.length < 2) { console.log(fs.readFileSync(__filename, 'utf8').split('====')[1]); process.exit(1); }
const PD = argv[0];
const CMD = argv[1];
const rest = argv.slice(2);
const flags = {};
const pos = [];
for (let i = 0; i < rest.length; i++) {
  const a = rest[i];
  if (a.startsWith('--')) { const k = a.slice(2); flags[k] = (rest[i + 1] && !rest[i + 1].startsWith('--')) ? rest[++i] : true; }
  else pos.push(a);
}
if (!fs.existsSync(PD)) { console.error('✗ 找不到 ' + PD); process.exit(1); }
/* 2026-10-10：这三个一律取**绝对路径**。原来传相对的 project-data（在项目目录里直接写文件名）时，
   OUT 也是相对的，render/shot 拼出来的就是 file:///_bld.html —— Chrome 打不开，
   却报成「❌ #app 没有内容 —— Vue 没挂上 / 页面崩了」，看着像原型崩了，其实是地址错。 */
const DIR = path.resolve(path.dirname(PD));
const OUT = path.resolve(flags.out || path.join(DIR, '_bld.html'));
const SHOTDIR = path.join(DIR, '_shots');

const load = () => JSON.parse(fs.readFileSync(PD, 'utf8'));
const save = d => fs.writeFileSync(PD, JSON.stringify(d), "utf8");   // 2026-11-13 提速⑥：project-data 统一紧凑存盘（比缩进小 32%，装配产物逐字节不变）

/* ───────── 路径解析 ───────── */
function parsePath(d, p) {
  const segs = [];
  String(p).replace(/[^.[\]]+|\[(\d+)\]/g, (m, idx) => { segs.push(idx != null ? Number(idx) : m); });
  /* 首段是页 id → 自动补 pagecfg */
  if (segs.length && d.pagecfg && d.pagecfg[segs[0]] && segs[0] !== 'pagecfg') segs.unshift('pagecfg');
  return segs;
}
function resolve(d, segs, create) {
  let cur = d;
  for (let i = 0; i < segs.length - 1; i++) {
    const s = segs[i];
    if (cur == null) return null;
    if (cur[s] == null) { if (!create) return null; cur[s] = typeof segs[i + 1] === 'number' ? [] : {}; }
    cur = cur[s];
  }
  return cur;
}

/* ───────── 值解析 ───────── */
function parseValue(raw, old) {
  /* §2026-10-07 @file:<路径> —— 从 JSON 文件取值。Windows 的 PowerShell 把参数传给 node 时会吃掉
     内层双引号，`@json:{"a":1}` 到了 node 手里变成 `{a:1}` 直接解析失败。复杂值一律走文件，稳。 */
  if (raw.startsWith('@file:')) return JSON.parse(fs.readFileSync(raw.slice(6), 'utf8'));
  if (raw.startsWith('@json:')) return JSON.parse(raw.slice(6));
  if (raw === '@true') return true;
  if (raw === '@false') return false;
  if (raw === '@null') return null;
  if (/^@-?\d+(\.\d+)?$/.test(raw)) return Number(raw.slice(1));
  if (raw.indexOf('||') > -1) {
    const parts = raw.split('||');
    const o = isI18n(old) ? Object.assign({}, old) : {};
    ['zh', 'en', 'pt'].forEach((k, i) => { if (parts[i] != null && parts[i] !== '') o[k] = parts[i]; });
    return o;
  }
  if (isI18n(old)) { const o = Object.assign({}, old); o.zh = raw; return o; }
  return raw;
}

/* ───────── 子命令 ───────── */
function cmdFind() {
  const q = pos[0]; if (!q) { console.error('✗ find 要给一个文字'); process.exit(1); }
  const d = load(); const hits = [];
  (function walk(o, p) {
    if (o == null) return;
    if (typeof o === 'string') { if (o.indexOf(q) > -1) hits.push([p, flat(o).slice(0, 70)]); return; }
    if (typeof o !== 'object') return;
    if (isI18n(o)) { if (String(o.zh || '').indexOf(q) > -1) hits.push([p, flat(o.zh).slice(0, 70)]); return; }
    if (Array.isArray(o)) { o.forEach((x, i) => walk(x, p + '[' + i + ']')); return; }
    Object.keys(o).forEach(k => walk(o[k], p ? p + '.' + k : k));
  })(d, '');
  console.log('「' + q + '」命中 ' + hits.length + ' 处' + (hits.length > 60 ? '（只列前 60）' : ''));
  hits.slice(0, 60).forEach(h => console.log('  ' + h[0] + '\n      = ' + h[1]));
}

function cmdShow() {
  const d = load(); const id = pos[0];
  if (!id) { console.error('✗ show 要给页 id（node p.js 源 tree 看全部）'); process.exit(1); }
  const p = (d.pagecfg || {})[id];
  if (!p) { console.error('✗ 没有这一页：' + id); process.exit(1); }
  const names = a => (a || []).map(x => flat(L(x && (x.label != null ? x.label : x)))).filter(Boolean);
  const line = (t, a) => { if (a && a.length) console.log('  ' + t.padEnd(10) + a.join(' | ')); };
  console.log('【' + id + '】' + flat(L(p.listTitle || '')));
  line('筛选', (p.filters || []).map(f => flat(L(f.label || f.ph || f.placeholder || '')) + (f.type ? '(' + f.type + ')' : '')));
  line('列', names(p.columns));
  line('工具条', names(p.listTools).concat(p.primaryBtn ? [flat(L(p.primaryBtn.label || p.primaryBtn))] : []));
  line('批量', names(p.selectActions));
  line('行操作', (p.actions || []).map(a => flat(L(a.label)) + (a.menu ? '▾[' + names(a.menu).join(',') + ']' : '') + (a.showIf ? '{只在 ' + a.showIf.join('/') + '}' : '')));
  line('顶部页签', names(p.statusTabs));
  line('左栏', names((p.statusPanel || {}).items));
  line('分状态', Object.keys(p.byStatus || {}));
  line('弹窗', Object.keys(p.dialogs || {}));
  line('详情件', (p.detailViews || []).map(v => (v.name || '(无名)') + (v.when ? '{when=' + flat(L(v.when)) + '}' : '')));
  const rows = (p.rows || []).length;
  if (rows) console.log('  ' + '模拟数据'.padEnd(10) + rows + ' 行');
  Object.keys(p.byStatus || {}).forEach(k => {
    const b = p.byStatus[k];
    const bits = [];
    if (b.rows) bits.push(b.rows.length + ' 行');
    if (b.statusTabs) bits.push('页签 ' + names(b.statusTabs).join('/'));
    if (b.columns) bits.push('列 ' + names(b.columns).length + ' 个');
    if (b.actions) bits.push('行操作 ' + names(b.actions).join('/'));
    if (bits.length) console.log('    └ ' + k.padEnd(10) + bits.join('　'));
  });
}

function cmdTree() {
  const d = load();
  if (!pos[0]) {
    const ids = Object.keys(d.pagecfg || {});
    console.log('共 ' + ids.length + ' 页：');
    ids.forEach(id => console.log('  ' + id.padEnd(22) + flat(L((d.pagecfg[id] || {}).listTitle || ''))));
    return;
  }
  const segs = parsePath(d, pos[0]);
  let cur = d; segs.forEach(s => { cur = cur == null ? null : cur[s]; });
  if (cur == null) { console.error('✗ 路径不存在：' + pos[0]); process.exit(1); }
  const dump = (o, ind) => {
    if (o == null || typeof o !== 'object' || isI18n(o)) { console.log(ind + '= ' + flat(JSON.stringify(L(o))).slice(0, 90)); return; }
    if (Array.isArray(o)) { console.log(ind + '[' + o.length + ' 项]'); o.slice(0, 8).forEach((x, i) => { console.log(ind + ' [' + i + ']'); dump(x, ind + '   '); }); return; }
    Object.keys(o).forEach(k => {
      const v = o[k];
      if (v == null || typeof v !== 'object' || isI18n(v)) console.log(ind + k + ' = ' + flat(JSON.stringify(L(v))).slice(0, 80));
      else if (Array.isArray(v)) console.log(ind + k + ' [' + v.length + ' 项]');
      else console.log(ind + k + ' {' + Object.keys(v).join(',') + '}');
    });
  };
  console.log(pos[0] + ':'); dump(cur, '  ');
}

function cmdGet() {
  const d = load();
  pos.forEach(p => {
    const segs = parsePath(d, p);
    const par = resolve(d, segs, false);
    const v = par == null ? undefined : par[segs[segs.length - 1]];
    console.log(p + ' = ' + (v === undefined ? '(不存在)' : JSON.stringify(v, null, 1).slice(0, 600)));
  });
}

/* §del：删一个字段 / 一个数组元素。数组里的元素走 splice（不留空洞），对象键走 delete。
   2026-10-06 加：删字段是改原型的常见动作（删掉画蛇添足加出来的字段），
   原来只能为此写一次性脚本 —— 正是要消灭的那件事。 */
function cmdDel() {
  const d = load();
  let n = 0;
  pos.forEach(p => {
    const segs = parsePath(d, p);
    const par = resolve(d, segs, false);
    if (par == null) { console.error('✗ 路径到不了：' + p); process.exit(1); }
    const key = segs[segs.length - 1];
    if (par[key] === undefined) { console.log('· ' + p + ' 本来就没有，跳过'); return; }
    const was = flat(JSON.stringify(par[key])).slice(0, 70);
    if (Array.isArray(par) && typeof key === 'number') par.splice(key, 1);
    else delete par[key];
    n++;
    console.log('✓ 删掉 ' + p + '\n    原值 ' + was);
    if (Array.isArray(par)) console.log('    该数组现在 ' + par.length + ' 项');
  });
  if (!n) return;
  save(d);
  console.log('已写回 ' + path.basename(PD));
}

function cmdSet() {
  const d = load();
  let n = 0;
  pos.forEach(expr => {
    const i = expr.indexOf('=');
    if (i < 0) { console.error('✗ 要写成 "路径=值"：' + expr); process.exit(1); }
    const p = expr.slice(0, i), raw = expr.slice(i + 1);
    const segs = parsePath(d, p);
    const par = resolve(d, segs, true);
    if (par == null) { console.error('✗ 路径到不了：' + p); process.exit(1); }
    const key = segs[segs.length - 1];
    if (typeof par !== 'object') { console.error('✗ ' + p + ' 的上一级是「' + JSON.stringify(par) + '」(一个值，不是对象)，没法在它下面设 "' + key + '"。\n   要么直接改整格：' + segs.slice(0, -1).join('.') + '=<值>；要么它本该是对象(先建好结构再设)'); process.exit(1); }
    const old = par[key];
    const val = parseValue(raw, old);
    par[key] = val;
    n++;
    const before = old === undefined ? '(原来没有)' : flat(JSON.stringify(old)).slice(0, 60);
    console.log('✓ ' + p + '\n    改前 ' + before + '\n    改后 ' + flat(JSON.stringify(val)).slice(0, 60));
    if (isI18n(old) && typeof val === 'object' && val.zh === raw && raw.indexOf('||') < 0)
      console.log('    ⚠ 这是多语字段，只改了中文；英/葡还是老的。要一起改写成 "中文||English||Português"');
  });
  if (!n) return;
  save(d);
  console.log('已写回 ' + path.basename(PD));
}

/* ───────── 装配 ───────── */
function assemble() {
  const t = Date.now();
  execFileSync(process.execPath, [path.join(HERE, 'qa', 'assemble-prototype.js'), PD, OUT, '--fast'], { stdio: 'pipe' });
  console.log('✓ 预览已重装 → ' + OUT + '  (' + (Date.now() - t) + 'ms)');
}

/* ───────── 连调试 Chrome（截图/渲染共用）───────── */
async function getClient() {
  const { connect } = require(path.join(HERE, '..', 'rpa', '_cdp.js'));
  const port = Number(flags.port || 9423);
  /* §2026-10-14：`_cdp.connect()` 自己就会「连不上→拉一个 Chrome→最多等 30 秒」（2026-10-13 下沉的）。
     这里原本还有一段「再 spawn launch.js、再死等 6 秒、再 connect」——现在是死代码：
     connect 成功时根本到不了，connect 失败时等于白等 6 秒 + 多开一个浏览器。删掉。 */
  const c = await connect(port);
  const W = Number(flags.w || 1680), H = Number(flags.h || 1050);
  await c.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  return c;
}

/* ───────── 截图 ───────── */
async function shoot(ids) {
  const c = await getClient();
  if (!fs.existsSync(SHOTDIR)) fs.mkdirSync(SHOTDIR, { recursive: true });
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  /* §点文字：先在【真正可点的控件】里找（药丸/页签/左栏/菜单/按钮/链接），找不到才退到任意元素。
     2026-10-06 踩的坑：原来一视同仁按"文字最短"挑，结果点「待开票」药丸时挑中了表格里那个
     3 个字的单元格（药丸是「待开票5」4 个字），筛选根本没生效，我还照着没筛的列表做了验证。 */
  /* §2026-10-07 文字后面可以跟 #N 指定第几个匹配（从 1 数起），如 --click "更多▾#3"。
     场景：列表每一行都有同名的「更多▾」「编辑」「查看」，默认点第一行；而第一行往往恰好是
     不能做这个操作的那条（例：近期发票第 1 行是采购退票，点「重开发票」直接被拦，弹窗根本不开）。 */
  /* §2026-10-08 作用域前缀：tab: / chip: / btn: / link: / menu: / row:
     页签、药丸、按钮常和表格单元格同名（如页签「已完成 (6)」vs 状态格「已完成」），
     纯按文字找会点错。加前缀直接限定在那类控件里找。 */
  const SCOPE = {
    'tab:': '.stab,.ptab,.el-tabs__item', 'chip:': '.qf-item', 'btn:': 'button',
    'link:': 'a', 'menu:': '.el-dropdown-menu__item', 'side:': '.sp-item',
    'anchor:': '.da', 'pane:': '.dv-sec-tab'
  };
  const clickText = async (raw, sel) => {
    let txt = String(raw), nth = 1;
    for (const k of Object.keys(SCOPE)) { if (txt.indexOf(k) === 0) { sel = SCOPE[k]; txt = txt.slice(k.length); break; } }
    const m = txt.match(/^(.*)#(\d+)$/);
    if (m) { txt = m[1]; nth = Number(m[2]); }
    const PRIOR = sel ? [sel] : [
      '.qf-item', '.sp-item', '.el-tabs__item', '.dv-sec-tab', '.dv-pill',
      '.el-dropdown-menu__item', '.el-radio-button', 'button', 'a'
    ];
    /* §2026-10-07 先整轮找【文字完全相同】的，找不到才退到前缀匹配。
       原来按组优先级走，组内才比长度 —— 点弹窗底部的【重开】时，下拉里那条「重开发票」
       因为组优先级更高被抢先点中，弹窗的提交按钮永远点不到。先判完全相同就没这问题。 */
    const js = "(function(){var t=" + JSON.stringify(txt) + ",n=" + nth + ";" +
      /* 指定了作用域就只在那类控件里找，不回退到任意元素（否则又会点中同名的表格单元格） */
      /* §2026-10-08 回退列表补 em/i/b/label —— 收银台顶栏的「● 在线」是 <em>，原来点不到（匹配到了外层容器）。 */
      "var groups=" + JSON.stringify(sel ? PRIOR : PRIOR.concat(['em', 'i', 'b', 'label', 'span', 'div', 'li', 'td'])) + ";" +
      "function scan(exact){" +
      "  for(var g=0;g<groups.length;g++){" +
      "    var all=[].slice.call(document.querySelectorAll(groups[g]));" +
      "    var hits=all.filter(function(x){var s=(x.innerText||'').trim();" +
      "      return (exact ? s===t : (s!==t && s.indexOf(t)===0)) && x.offsetParent!==null;})" +
      "      .sort(function(a,b){return (a.innerText||'').length-(b.innerText||'').length});" +
      "    if(hits.length>=n){hits[n-1].click();return 'ok ['+groups[g]+(exact?'·完全匹配':'·前缀')+(n>1?' 第'+n+'个':'')+']';}" +
      "    if(hits.length) return '只找到 '+hits.length+' 个「'+t+'」，要第 '+n+' 个';}" +
      "  return null;}" +
      /* §2026-10-07 文字都找不到时，按【占位符】找输入框并聚焦 —— 输入框没有 innerText，
         但验「离开输入框即校验」必须先点进去再点别处，不然 blur 根本不触发。 */
      "function byPh(){var ins=[].slice.call(document.querySelectorAll('input,textarea'));" +
      "  var hit=ins.filter(function(x){var p=(x.placeholder||'').trim();return p&&p.indexOf(t)===0&&x.offsetParent!==null;})[0];" +
      "  if(hit){hit.focus();hit.click();return 'ok [占位符聚焦]';} return null;}" +
      "return scan(true) || scan(false) || byPh() || ('没找到：'+t);})()";
    return await c.evalv(js);
  };
  const out = [];
  for (const id of ids) {
    await c.navigate('file:///' + OUT.replace(/\\/g, '/') + '?page=' + id);
    await c.send('Page.bringToFront', {});
    /* 2026-10-11：和 render 一样先等 Vue 真挂上，别固定睡 3.8 秒就拍 ——
       11MB 的大原型挂载要 7~10 秒，拍出来是一屏没替换的 {{ }} 源码，看着像"整页崩了"。 */
    const bigMs = Math.min(30000, 6000 + Math.round((fs.statSync(OUT).size / (1024 * 1024)) * 1800));
    for (let i = 0, n = Math.ceil(bigMs / 150); i < n; i++) {
      await sleep(150);
      let ok = false;
      try { ok = !!(await c.evalv("!!(document.readyState==='complete'&&document.querySelector('#app *'))")); } catch (_) {}
      if (ok) break;
    }
    await sleep(1200);   // 让 EP 组件/过渡落定
    for (const k of ['tab', 'click', 'click2', 'click3', 'click4']) {
      if (flags[k] && flags[k] !== true) { const r = await clickText(flags[k]); console.log('  点「' + flags[k] + '」→ ' + r); await sleep(1500); }
    }
    /* §2026-10-08 --scroll <像素|元素文字>：长表单（创建手工发票 7 个板块）一屏截不完，
       原来只能看到顶部，下半截的字段/板块是不是对的全靠猜 —— 这正是反复判断错的来源。
       给数字就滚那么多像素；给文字就把含该文字的元素滚到视口顶部。可叠加 --scroll2。 */
    for (const k of ['scroll', 'scroll2']) {
      const sv = flags[k]; if (!sv || sv === true) continue;
      const js = /^\d+$/.test(String(sv))
        ? "(function(){var t=document.querySelector('.dv-body,.detail-body,.el-main,main')||document.scrollingElement;" +
          "t.scrollTop=" + Number(sv) + ";document.scrollingElement.scrollTop=" + Number(sv) + ";return 'scroll " + Number(sv) + "px';})()"
        : "(function(){var w=" + JSON.stringify(String(sv)) + ";var all=document.querySelectorAll('h1,h2,h3,h4,.dv-sec-t,.sec-title,label,td,div,span');" +
          "for(var i=0;i<all.length;i++){var e=all[i];if(e.children.length===0&&(e.textContent||'').trim().indexOf(w)>-1){" +
          "e.scrollIntoView({block:'start'});return 'scrollTo 「'+w+'」';}}return '✗ 找不到「'+w+'」';})()";
      console.log('  滚动 → ' + await c.evalv(js));
      await sleep(900);
    }
    const f = path.join(SHOTDIR, 'p-' + id.replace(/[^\w@-]/g, '_') + '.png');
    await c.screenshot(f);
    out.push(f);
    console.log('📷 ' + id + ' → ' + f);
  }
  await c.send('Emulation.clearDeviceMetricsOverride', {});
  await c.close();
  return out;
}

/* ───────── 无头渲染报告（文字替代截图·2026-10-07 提速·治「改完必截图看图」的往返 + 图片 token）─────────
   show 读的是你【写进 JSON 的源】；render 读的是【真·渲染出来的 DOM】——
   能抓到源看不出的问题：Vue 没挂上 / 组件报错 / 字段没渲染 / 撑出横向滚动条。
   结构对不对（列/行/按钮/字段/页签）看这份文字就够，省一次往返 + 一张图的 token；
   只有视觉保真（配色/对齐/遮挡）才需要 shot 看图。返回不正常的页数（可当闸用）。 */
const ERRHOOK = "window.__ERRS__=[];" +
  "addEventListener('error',function(e){try{__ERRS__.push(String(e.message||(e.error&&e.error.message)||e))}catch(_){}} ,true);" +
  "addEventListener('unhandledrejection',function(e){try{__ERRS__.push('reject:'+String((e.reason&&e.reason.message)||e.reason))}catch(_){}} );" +
  "var _e=console.error;console.error=function(){try{__ERRS__.push('err:'+Array.prototype.map.call(arguments,function(a){return (a&&a.message)||String(a)}).join(' ').slice(0,160))}catch(_){} return _e.apply(console,arguments)};" +
  "var _w=console.warn;console.warn=function(){try{var s=Array.prototype.map.call(arguments,function(a){return (a&&a.message)||String(a)}).join(' ');if(/\\[?vue|resolve component|render|is not a function|undefined is not/i.test(s))__ERRS__.push('warn:'+s.slice(0,160))}catch(_){} return _w.apply(console,arguments)};";

const EXTRACT = "(function(){" +
  "var vis=function(e){var r=e.getBoundingClientRect();return r.width>0&&r.height>0;};" +
  "var norm=function(s){return (s||'').replace(/\\s+/g,' ').trim();};" +
  "var inAnno=function(e){return e.closest&&e.closest('#anno-app');};" +
  "var txt=function(e){return norm(e.textContent);};" +
  "var uniq=function(a){return a.filter(function(x,i){return a.indexOf(x)===i;});};" +
  "var app=document.querySelector('#app');var mounted=!!(app&&app.querySelector('*'));" +
  "var btns=uniq([].slice.call(document.querySelectorAll('.el-button, button')).filter(function(e){return vis(e)&&e.getBoundingClientRect().top>95&&!inAnno(e);}).map(txt).filter(function(t){return t&&t.length<10;}));" +
  "var cols=uniq([].slice.call(document.querySelectorAll('.el-table__header th, table thead th')).map(txt).filter(Boolean));" +
  "var rows=document.querySelectorAll('.el-table__body tr').length;" +
  "var filters=[].slice.call(document.querySelectorAll('.qf-item')).map(function(e){return norm(e.innerText).slice(0,18);}).filter(Boolean);" +
  "var nFilterCtl=[].slice.call(document.querySelectorAll('.el-select__wrapper, .el-input__wrapper, .el-date-editor')).filter(vis).length;" +
  "var tabs=[].slice.call(document.querySelectorAll('.status-tabs .stab, .el-tabs:not(.layout-tabs) .el-tabs__item')).map(txt).filter(Boolean);" +
  "var secs=[].slice.call(document.querySelectorAll('.form-sec-title')).map(txt).filter(Boolean);" +
  "var labels=[].slice.call(document.querySelectorAll('.el-form-item__label')).filter(function(e){return !inAnno(e);}).map(txt).filter(Boolean);" +
  "var rowIc=[].slice.call(document.querySelectorAll('.el-table__body tr')).map(function(tr){return tr.querySelectorAll('.row-ic').length;});" +
  "var maxRowIcons=rowIc.length?Math.max.apply(null,rowIc):0;" +
  "var dialogs=[].slice.call(document.querySelectorAll('.el-dialog, .el-message-box')).filter(vis).map(function(d){var h=d.querySelector('.el-dialog__title,.el-message-box__title');return h?norm(h.textContent):'(无题弹窗)';});" +
  "var de=document.documentElement;var overflowX=de.scrollWidth>de.clientWidth+2;" +
  "return {mounted:mounted,btns:btns,cols:cols,rows:rows,filters:filters,nFilterCtl:nFilterCtl,tabs:tabs,secs:secs,labels:labels,maxRowIcons:maxRowIcons,dialogs:dialogs,overflowX:overflowX,scrollW:de.scrollWidth,clientW:de.clientWidth,errs:(window.__ERRS__||[]).slice(0,12)};" +
  "})()";

async function renderReport(ids, opt) {
  /* opt.target：要渲染的文件（默认 = 装配出的预览 _bld.html）。
     传【交付件】就能在"用户实际打开的那个离线文件"上一次问清所有页——
     这是 2026-10-13 查出的头号往返黑洞：那一场会话用 act.js goto+eval 问了 106 次，
     就因为 p.js 以前只能看预览、而铁律要求必须在交付件里验收。
     opt.ask：额外的自定义表达式，每页求一次值（替代"开一页问一个值"的循环）。 */
  const TGT = (opt && opt.target) || OUT;
  const ASK = opt && opt.ask;
  if (!fs.existsSync(TGT)) { console.error('✗ 文件不存在：' + TGT); return 1; }
  const c = await getClient();
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  try { await c.send('Page.addScriptToEvaluateOnNewDocument', { source: ERRHOOK }); } catch (_) {}
  /* ids 传 all → 先打开一次，从 PAGECFG 读全部页 id（省掉"先查有哪些页"那一次往返） */
  if (ids.length === 1 && String(ids[0]).toLowerCase() === 'all') {
    await c.send('Page.navigate', { url: 'file:///' + TGT.replace(/\\/g, '/') });
    let keys = null;
    for (let i = 0; i < 120; i++) {
      await sleep(200);
      try { keys = await c.evalv("(function(){try{return window.PAGECFG?Object.keys(window.PAGECFG).join(','):'';}catch(e){return '';}})()"); } catch (_) {}
      if (keys) break;
    }
    ids = String(keys || '').split(',').filter(Boolean);
    if (!ids.length) { console.error('✗ 没读到 PAGECFG 页面清单（文件没渲染出来？）'); await c.close(); return 1; }
    console.log('共 ' + ids.length + ' 页：' + ids.join(' '));
  }
  if (!ids.length) { console.error('✗ 要给页 id（或 all）'); await c.close(); return 1; }
  let bad = 0;
  for (const id of ids) {
    const t0 = Date.now();
    const url = 'file:///' + TGT.replace(/\\/g, '/') + '?page=' + id;
    await c.send('Page.navigate', { url: 'about:blank' }); await sleep(120);   // 先清掉上一页，杜绝轮询误读旧 DOM
    await c.send('Page.navigate', { url }); await c.send('Page.bringToFront', {});
    /* 两段式等待（2026-10-10 修误报）：
       原来只有一个 ~6s 的总预算，轮询条件还是"出现**丰富**内容"才算完。11MB 的大原型
       （发票系统 3.6MB project-data → 11MB HTML）在这台机器上要 ~10s 才挂得上 Vue，于是
       每一页都被判「❌ #app 没有内容 —— Vue 没挂上」——**而真浏览器里好好的**。
       假红比不报更糟：它会训练我忽略这道闸。
       现在拆成：① 先只等"挂上了没"（#app 有子节点），预算按产物大小放宽，最多 30s；
       ② 挂上之后再等"内容渲染丰富"，仍是原来的 6s 预算。快页速度不变。 */
    const bigMs = Math.min(30000, 6000 + Math.round((fs.statSync(TGT).size / (1024 * 1024)) * 1800));
    let mounted = false;
    for (let i = 0, n = Math.ceil(bigMs / 150); i < n; i++) {
      await sleep(150);
      try { mounted = !!(await c.evalv("!!(document.readyState==='complete'&&document.querySelector('#app *'))")); } catch (_) {}
      if (mounted) break;
    }
    let ready = false;
    for (let i = 0; i < 50 && mounted; i++) {
      await sleep(120);
      let sig = 0;
      try { sig = await c.evalv("(function(){try{if(document.readyState!=='complete')return 0;if(!document.querySelector('#app *'))return 0;return document.querySelectorAll('.el-table__body tr,.el-table__header th,.el-form-item,.page-form,.stat-card,.dv-sec,.search-box .el-input__wrapper,.search-box .el-select__wrapper').length||'shell';}catch(e){return 0;}})()"); } catch (_) {}
      if (sig && sig !== 'shell') { ready = true; break; }
    }
    await sleep(ready ? 300 : 600);   // 让 EP 组件/过渡落定；没探到真实内容就多等一会再尽力抽
    let r;
    try { r = await c.evalv(EXTRACT); } catch (e) { console.log('【' + id + '】抽取失败：' + e.message); bad++; continue; }
    if (!r) { console.log('【' + id + '】没抽到（页面空白？）'); bad++; continue; }
    const list = (t, a) => { if (a && a.length) console.log('  ' + t.padEnd(8) + a.join(' | ')); };
    console.log('\n【' + id + '】真实渲染结果：');
    let pageBad = 0;
    if (!r.mounted) {
      /* 2026-10-10：光说"没挂上"没法查。把等了多久、当时 readyState / #app 子节点数、
         以及 URL 一起打出来 —— 区分"真崩了"和"闸等得不够久"。 */
      let dbg = ''; try { dbg = await c.evalv("JSON.stringify({rs:document.readyState,kids:(document.querySelector('#app')||{children:[]}).children.length,url:location.href.slice(-60)})"); } catch (_) {}
      console.log('  ❌ #app 没有内容 —— Vue 没挂上 / 页面崩了（等了 ' + Math.round(bigMs / 1000) + 's；' + dbg + '）'); pageBad++;
    }
    if (r.cols.length) console.log('  列(' + r.cols.length + ')  ' + r.cols.join(' | '));
    if (r.rows) console.log('  行      ' + r.rows + ' 行' + (r.maxRowIcons ? '（每行最多 ' + r.maxRowIcons + ' 个操作图标）' : ''));
    list('筛选', r.filters);
    if (r.nFilterCtl) console.log('  筛选控件 ' + r.nFilterCtl + ' 个');
    list('工具条', r.btns);
    list('页签', r.tabs);
    list('分区', r.secs);
    if (r.labels.length) console.log('  表单字段(' + r.labels.length + ') ' + r.labels.join(' | '));
    list('弹窗', r.dialogs);
    if (r.overflowX) { console.log('  ❌ 横向溢出：scrollWidth ' + r.scrollW + ' > 视口 ' + r.clientW + '（撑出横向滚动条，查板块宽度）'); pageBad++; }
    if (r.errs && r.errs.length) { console.log('  ❌ JS 报错 ' + r.errs.length + ' 条：'); r.errs.forEach(e => console.log('     · ' + e)); pageBad++; }
    if (ASK) {   /* 自定义问法：每页求一次值，一次命令问清所有页 */
      let av = null;
      /* awaitPromise：问法可以是 Promise（先点开详情/弹窗、等渲染再取值），否则只拿到 [object Object]（10-27） */
      try { av = await c.evalv(ASK, true); } catch (e) { av = '（求值失败：' + e.message + '）'; }
      console.log('  ❓ ' + (av === null || av === undefined ? '(空)' : String(av)).slice(0, 400));
    }
    const secs = ((Date.now() - t0) / 1000).toFixed(1);
    if (!pageBad) console.log('  ✅ 渲染正常（已挂载·无报错·无横向溢出）· ' + secs + 's');
    else console.log('  —— 本页 ' + pageBad + ' 项异常 · ' + secs + 's');
    bad += pageBad;
  }
  await c.send('Emulation.clearDeviceMetricsOverride', {});
  await c.close();
  return bad;
}

/* ───────── 主流程 ───────── */
(async () => {
  if (CMD === 'find') cmdFind();
  else if (CMD === 'show') cmdShow();
  else if (CMD === 'tree') cmdTree();
  else if (CMD === 'get') cmdGet();
  else if (CMD === 'set') { cmdSet(); assemble(); }
  else if (CMD === 'del') { cmdDel(); assemble(); }
  else if (CMD === 'shot') { assemble(); await shoot(String(pos[0] || flags.shot || '').split(',').filter(Boolean)); return; }
  else if (CMD === 'render' || CMD === 'r') { assemble(); const bad = await renderReport(String(pos[0] || flags.check || '').split(',').filter(Boolean)); process.exit(bad ? 1 : 0); }
  /* deliv —— 在【交付件】（用户实际打开的那个离线 .html）上一次问清，不重新装配。
     治 2026-10-13 实测的头号往返黑洞：那一场 act.js goto+eval 问了 106 次。
       node p.js <源.json> deliv all                      一次看完所有页（结构/报错/溢出）
       node p.js <源.json> deliv issuing,poret            只看这几页
       node p.js <源.json> deliv all --ask "<JS表达式>"    每页再求一个自定义值
       node p.js <源.json> deliv all --file <别的.html>    指定文件（默认读源里的 _deliverable） */
  else if (CMD === 'deliv') {
    let tgt = (flags.file && flags.file !== true) ? String(flags.file) : null;
    if (!tgt) { try { tgt = load()._deliverable; } catch (_) {} }
    if (!tgt) { console.error('✗ 源 JSON 里没有 "_deliverable"，也没给 --file <交付件.html>'); process.exit(1); }
    const ids = String(pos[0] || 'all').split(',').filter(Boolean);
    console.log('交付件：' + tgt);
    const bad = await renderReport(ids, { target: path.resolve(tgt), ask: (flags.ask && flags.ask !== true) ? String(flags.ask) : null });
    process.exit(bad ? 1 : 0);
  }
  else { console.error('✗ 不认识的子命令：' + CMD + '（find/show/tree/get/del/set/shot/render/deliv）'); process.exit(1); }

  if (flags.shot && flags.shot !== true) await shoot(String(flags.shot).split(',').filter(Boolean));
  if (flags.check && flags.check !== true) { const bad = await renderReport(String(flags.check).split(',').filter(Boolean)); if (bad) process.exit(1); }
})().catch(e => { console.error('ERR ' + (e && e.stack || e)); process.exit(1); });
