#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   保真审计闸 · fidelity-audit.js · 2026-09-16 · 零依赖(findChrome + 原生 CDP·随包)
   ────────────────────────────────────────────────────────────────────────
   目的：复刻任何系统时，不靠人逐个指细节。机器把【真系统(快照/URL)】与【复刻件】每页
   指纹全抽下来逐维 diff，一次列出所有不一致：工具栏按钮(文案+启用/禁用+主次)、列、
   分区标题、表单字段(label/必填)、状态页签、筛选控件数、行操作图标；computed 样式维
   还逐值比【状态页签选中/未选态底色+字色】(2026-09-17 补·根治页签切换色漏查)；
   并单独查【聚合单元格(商品/订单信息)变形】(列宽过窄→逐字竖排·2026-09-17 补盲区)；
   行图标数不够判红(2026-09-18)；排除 #anno-app 标注层控件(那是本工具 chrome·非被复刻系统)；
   【弹窗维度】(2026-09-18 补·堵眼验盲区)：配 _fidelityDialogs 后机器逐个点开弹窗、与真弹窗快照比 标题/宽/底部按钮。红了 exit 1。
   ————————————————————————————————————————————————————————————————
   配置驱动(通用·非写死某系统)：读 project-data.json 顶部两字段——
     "_deliverable":  "<复刻件离线 .html 绝对路径>"
     "_fidelityPages":[ { "name":"商品列表", "real":"<真系统快照.mhtml 或 http URL>", "page":"goods_list" }, ... ]
   real 支持：本地 .mhtml/.html 绝对路径(自动转 file://) 或 http(s) URL(真系统 live·需登录态)。
   用法：node fidelity-audit.js <project-data.json>
   随包同一套，装了包的用户复刻任何系统都用它自检到 1:1。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const { spawn } = require('child_process');
const { findChrome } = require('./_gate-env');
const CHROME = process.env.CHROME_PATH || findChrome();
const sleep = ms => new Promise(z => setTimeout(z, ms));

const PDATA = process.argv[2];
if (!PDATA || !fs.existsSync(PDATA)) { console.log('用法: node fidelity-audit.js <project-data.json>（需含 _deliverable + _fidelityPages）'); process.exit(2); }
const pd = JSON.parse(fs.readFileSync(PDATA, 'utf8'));
const DELIV = pd._deliverable;
const PAGES = pd._fidelityPages || [];
// §弹窗审计维度(2026-09-18补·堵掉唯一眼验盲区)：机器点开每个弹窗再逐值比 title/宽/底部按钮
//   "_fidelityDialogs":[ { "name":"停用确认","real":"<弹窗快照.mhtml>","page":"goods_list","openBy":"停用","selectRow":true } … ]
//   openBy=复刻件工具栏里点哪个按钮开弹窗；selectRow=先勾一行(依赖勾选的批量弹窗)；menuPick=下拉按钮里点第几项(导入/导出)
const DIALOGS = pd._fidelityDialogs || [];
if (!DELIV || !PAGES.length) { console.log('⊘ project-data 未配置 _deliverable / _fidelityPages —— 复刻项目请加(见脚本头注释)。跳过。'); process.exit(0); }
const toUrl = p => /^https?:\/\//.test(p) ? p : ('file:///' + path.resolve(p).replace(/\\/g, '/'));
const delivUrl = page => toUrl(DELIV) + '?page=' + encodeURIComponent(page);

const FP = `(() => {
  const vis = e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const norm = s => (s || '').replace(/\\s+/g, '').trim();
  const skip = /^(简体中文|Portugués|Português|English|Español|标注|立即刷新|个人中心|修改密码|退出登录|前往|页)$/;
  // 排除 #anno-app（我们工具的标注层·emoji 控件 ✏️改名/🗑删除/清空 等）——那是复刻工具自带 chrome，不是被复刻系统的按钮(2026-09-18 补·headless 里会漏进来)
  /* §2026-10-11 除了标注层，**原型自己的外壳**也要排除：顶栏 logo/系统名、系统切换条、
     多标签页签栏、左侧菜单 —— 那些是我们这套原型框架的 chrome，不是被复刻系统的页面内容。
     不排除的话每一页都会报「复刻多出：某零售系统 / 收银台 / 草稿中」，5 页 ×3 条＝15 条假红，
     而假红会让人直接忽略整道闸（和 render 闸那次一个道理）。 */
  const SHELL = '#anno-app,.topbar,.subbar,.pagetabs,.layout-tabs,.sys-tabs,.side,.sidebar,.el-aside,.app-header,.view-tabs';
  const inAnno = e => e.closest && e.closest(SHELL);
  const btns = [...document.querySelectorAll('.el-button, button')].filter(vis).filter(e => e.getBoundingClientRect().top > 95 && !inAnno(e))
    .map(e => ({ t: norm(e.textContent), d: !!(e.disabled || e.classList.contains('is-disabled')), p: e.classList.contains('el-button--primary') }))
    .filter(b => b.t && !skip.test(b.t) && b.t.length < 8);
  const seen = new Set(); const ubtns = btns.filter(b => { const k = b.t + b.d + b.p; if (seen.has(k)) return false; seen.add(k); return true; });
  const cols = [...new Set([...document.querySelectorAll('.el-table__header th, table thead th')].map(e => norm(e.textContent)).filter(Boolean))];
  const repSecs = [...document.querySelectorAll('.form-sec-title')].map(e => norm(e.textContent)).filter(Boolean);
  // 真系统分区标题=粗体≥15px 的短标题（不强制底边框——真系统「规格/商品信息/费用/操作日志」这类标题没底边线，
  //   旧版要求 borderBottom 会漏检→误判复刻「多出」。与复刻侧 .form-sec-title 像对像地比。2026-09-17 校正）
  /* §2026-10-11 ① 必须 vis(e)：关着的抽屉/弹窗里的标题（display:none）以前照样被算成"分区标题"；
     ② 排除价格/金额那类数字文本 —— 商品卡的价格就是 16px/600，会被误当标题，
        而真系统的冻结快照里商品是空的（静态快照没有接口数据），于是整屏价格全被报成"复刻多出"。 */
  const isMoney = t => /^(R\\$|[¥$€])?[0-9][0-9.,]*(\\/.+)?$/.test(t);
  const realSecs = [...new Set([...document.querySelectorAll('*')].filter(e => { const s = getComputedStyle(e); const t = norm(e.textContent); return vis(e) && e.children.length <= 1 && parseInt(s.fontSize) >= 15 && parseInt(s.fontWeight) >= 600 && t.length >= 2 && t.length < 12 && !skip.test(t) && !isMoney(t) && !inAnno(e) && !e.closest('th,button,.el-button,.el-table__header,.el-tabs__item,[class*="tab"]'); }).map(e => norm(e.textContent)))];
  const secs = repSecs.length ? repSecs : [...new Set(realSecs)];
  const labels = [...document.querySelectorAll('.el-form-item__label')].filter(e => !inAnno(e)).map(e => ({ t: norm(e.textContent).replace(/\\*/g, ''), r: e.classList.contains('is-required') || /\\*/.test(e.textContent) })).filter(x => x.t);
  const tabs = [...document.querySelectorAll('.status-tabs .stab, .el-tabs:not(.layout-tabs) .el-tabs__item')].filter(e => !inAnno(e)).map(e => norm(e.textContent)).filter(t => t && /启用|停用|全部|待|已|异常|正常|作废|草稿/.test(t)).map(t => t.replace(/\\(\\d+\\)/, '(N)'));
  const filters = [...document.querySelectorAll('.el-select__wrapper, .el-input__wrapper, .el-date-editor')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).length;
  const realIcons = [...document.querySelectorAll('.el-table__body tr .option-btn .icon-button use, tr .option-btn .icon-button use')].map(u => u.getAttribute('xlink:href')).filter(Boolean);
  const repIcons = document.querySelectorAll('.el-table__body tr .row-ic svg').length;
  // 每行操作图标数（真=.option-btn .icon-button / 复刻=.row-ic）取各行最大值——用于「行图标数是否够」判红(2026-09-18补·根治出库行只2个真系统6个漏判)
  const rowIconCounts = [...document.querySelectorAll('.el-table__body tr')].map(tr => Math.max(tr.querySelectorAll('.option-btn .icon-button').length, tr.querySelectorAll('.row-ic').length));
  const maxRowIcons = rowIconCounts.length ? Math.max(...rowIconCounts) : 0;
  return { btns: ubtns, cols, secs, labels, tabs, filters, realIconRefs: [...new Set(realIcons)], repIconCount: repIcons, maxRowIcons };
})()`;

// ── computed 样式穷举维度：每个组件的所有视觉属性 real vs 复刻逐值 diff（根治「只查结构·漏了颜色/背景/圆角」）──
const STYLE_PROBE = `(() => {
  const vis = e => e && e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0;
  const pick = e => { if(!e) return null; const s = getComputedStyle(e); return { bg:s.backgroundColor, color:s.color, border:s.borderColor, radius:s.borderRadius, shadow:s.boxShadow.replace(/\\s+/g,' ').slice(0,44), height:s.height, minWidth:s.minWidth, padding:s.padding, fontSize:s.fontSize, fontWeight:s.fontWeight, lineHeight:s.lineHeight }; };
  const g = sel => pick([...document.querySelectorAll(sel)].find(vis));
  const byText = (sel,t) => pick([...document.querySelectorAll(sel)].find(e=>vis(e)&&(e.textContent||'').replace(/\\s+/g,'').trim()===t));
  const statusLeaf = re => { const e=[...document.querySelectorAll('.el-table__body td *, tr td *')].find(x=>vis(x)&&x.children.length===0&&re.test((x.textContent||'').trim())); return pick(e); };
  // 状态页签选中/未选态（真=.el-tabs__item.is-active / 复刻=.status-tabs .stab.on）——按状态词过滤，避开浏览器页签(首页/商品管理)
  const STAT_ON=['已启用','全部'], STAT_OFF=['已停用','待提交','待发货','已发货','已取消'];
  const tabOn = e => /is-active/.test(e.className) || /(^|\\s)on(\\s|$)/.test(''+e.className);
  const tabTxt = e => (e.textContent||'').replace(/\\s+/g,'').replace(/\\(\\d+\\)/g,'').replace(/\\d+/g,'').trim();
  const tabPick = (words,on) => pick([...document.querySelectorAll('.el-tabs__item, .status-tabs .stab')].find(e=>vis(e)&&(tabOn(e)===on)&&words.some(w=>tabTxt(e)===w)));
  return {
    '筛选下拉wrapper': g('.search-box .el-select__wrapper') || g('.el-select__wrapper'),
    '筛选输入wrapper': g('.search-box .el-input__wrapper') || g('.el-input__wrapper'),
    '表头文字': g('.el-table__header th .cell'),
    '表体cell文字': g('.el-table__body td .cell'),
    '状态文字': statusLeaf(/^已?启用$|^已?停用$|^已?配对$|^未配对$|^待发货$|^已发货$|^已完成$|^已取消$/),
    '状态页签-选中': tabPick(STAT_ON,true),
    '状态页签-未选': tabPick(STAT_OFF,false),
    '主按钮查询': byText('.el-button','查询'),
    '次按钮重置': byText('.el-button','重置'),
    '主按钮新增': byText('.el-button','新增'),
  };
})()`;
// 聚合单元格变形探针（复刻件·2026-09-16 补盲区）：短字段行(<22字)被挤成≥3行=逐字竖排变形；列宽<180=过窄
const DEFORM_PROBE = `(() => {
  const out = { maxLines: 0, minW: 99999, sample: '', found: 0 };
  for (const td of [...document.querySelectorAll('.el-table__body td')]) {
    const lines = [...td.querySelectorAll('div')].filter(d => /[：:]/.test(d.textContent||'') && d.querySelector('span'));
    if (lines.length < 2) continue;
    out.found++;
    const w = td.getBoundingClientRect().width; if (w && w < out.minW) out.minW = w;
    for (const ln of lines) {
      const lh = parseFloat(getComputedStyle(ln).lineHeight) || 20;
      const n = Math.round(ln.scrollHeight / lh);
      const len = (ln.textContent||'').trim().length;
      if (len < 22 && n > out.maxLines) { out.maxLines = n; out.sample = (ln.textContent||'').trim().slice(0,24); }
    }
  }
  if (out.minW === 99999) out.minW = 0;
  return out;
})()`;
// §弹窗探针：抓当前可见弹窗的 标题/宽/底部按钮（真快照弹窗已开·复刻件点开后再抓）
const DLGPROBE = `(() => {
  const d = [...document.querySelectorAll('.el-dialog, .el-message-box')].find(e => e.getBoundingClientRect().width > 0 && e.getBoundingClientRect().height > 0);
  if (!d) return null;
  const r = d.getBoundingClientRect();
  const head = d.querySelector('.el-dialog__title, .el-message-box__title') || d.querySelector('.el-dialog__header, .el-message-box__header');
  const title = head ? (head.textContent || '').replace(/\\s+/g, '').replace(/[×✕]/g, '').trim() : '';
  const btns = [...d.querySelectorAll('.el-dialog__footer button, .el-message-box__btns button, .el-dialog__footer .el-button')].map(b => (b.textContent || '').replace(/\\s+/g, '').trim()).filter(Boolean);
  return { title, w: Math.round(r.width), btns: [...new Set(btns)] };
})()`;
// §复刻件里点开弹窗（可选先勾一行·点工具栏按钮·下拉再点第 menuPick 项）
function OPEN(cfg) {
  const ob = (cfg.openBy || '').replace(/'/g, "\\'");
  const pickMenu = cfg.menuPick != null ? `setTimeout(()=>{const its=[...document.querySelectorAll('.el-dropdown-menu__item')];const it=its[${cfg.menuPick}];if(it)it.click();setTimeout(()=>res({ok:1}),750);},420);` : `setTimeout(()=>res({ok:1}),750);`;
  return `(() => new Promise(res=>{ try{
    ${cfg.selectRow ? `const cb=document.querySelector('.el-table__body tr .el-checkbox');if(cb)cb.click();` : ''}
    setTimeout(()=>{ const bs=[...document.querySelectorAll('.sel-toolbar .el-button,.sel-toolbar .sel-link,.sel-right .el-button')]; const b=bs.find(e=>(e.textContent||'').replace(/\\s+/g,'').trim()==='${ob}'); if(!b)return res({err:'按钮未找到'}); b.click(); ${pickMenu} }, ${cfg.selectRow ? 700 : 30});
  }catch(e){res({err:e.message})} }))()`;
}
const STYLE_KEYS = ['bg','color','border','radius','padding','fontSize','fontWeight'];  // height/minWidth 属布局·由㊸闸+结构维管·此处只比视觉属性(避免文字元素 height auto 噪声)
// 页签只比核心视觉信号(底色/字色/字重/圆角)——边框分四向·padding 真系统抽值有噪声，避免误红
const PROBE_KEYS = { '状态页签-选中': ['bg','color','fontWeight','radius'], '状态页签-未选': ['bg','color','fontWeight'] };
function diffStyle(RS, PS) {
  let d = 0;
  for (const comp of Object.keys(RS)) {
    const r = RS[comp], p = PS[comp];
    if (!r && !p) continue;
    if (!r || !p) { continue; } // 组件某侧不存在(结构维度已管)·此处只比都在的
    const keys = PROBE_KEYS[comp] || STYLE_KEYS;
    const bad = keys.filter(k => String(r[k]) !== String(p[k])).map(k => k + ':真[' + r[k] + ']复[' + p[k] + ']');
    if (bad.length) { d++; console.log('    ✗ [样式] ' + comp + '\\n        ' + bad.join('\\n        ')); }
  }
  if (!d) console.log('    ✓ 组件 computed 样式逐值一致');
  return d;
}
function diffList(name, R, P, keyer = x => x) {
  const rs = R.map(keyer), ps = P.map(keyer);
  const miss = R.filter((x, i) => !ps.includes(rs[i]));
  const extra = P.filter((x, i) => !rs.includes(ps[i]));
  if (miss.length || extra.length) { console.log('    ✗ ' + name + (miss.length ? '  真有复刻缺:' + JSON.stringify(miss) : '') + (extra.length ? '  复刻多出:' + JSON.stringify(extra) : '')); return 1; }
  console.log('    ✓ ' + name + ' (' + R.length + ')'); return 0;
}

(async () => {
  if (!CHROME) { console.log('⚠ 未找到 Chrome（设 CHROME_PATH）·跳过审计'); process.exit(0); }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fa-'));
  const dport = 9820;
  const ch = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--hide-scrollbars', '--window-size=1680,1050', '--force-device-scale-factor=1', '--remote-debugging-port=' + dport, '--user-data-dir=' + path.join(dir, 'ud'), 'about:blank']);
  let ws;
  try {
    let tab = null;
    for (let i = 0; i < 60; i++) { try { tab = (await (await fetch(`http://localhost:${dport}/json/list`)).json()).find(t => t.type === 'page'); if (tab) break; } catch (_) {} await sleep(200); }
    if (!tab) throw new Error('Chrome 未就绪');
    ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
    let id = 0; const pend = {};
    ws.onmessage = m => { const d = JSON.parse(m.data); if (d.id && pend[d.id]) { pend[d.id](d); delete pend[d.id]; } };
    const send = (m, p = {}) => new Promise(r => { const i = ++id; pend[i] = r; ws.send(JSON.stringify({ id: i, method: m, params: p })); });
    const evalv = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true })).result?.result?.value;
    const evalvA = async e => (await send('Runtime.evaluate', { expression: e, returnByValue: true, awaitPromise: true })).result?.result?.value;
    // 可交互维：复刻件里每个可见按钮/行图标/链接点了必须有反应(弹窗/跳转/toast/DOM变化)·无反应=摆设=红
    const ENUM = `(() => { const skip=/^(简体中文|标注|立即刷新|个人中心|修改密码|退出登录|oms-demo|A|首页|商品|出库|订单|分销|入库|工单|售后|物流|财务|数据|设置|公制|英制)$/; return [...document.querySelectorAll('.el-button,.row-ic,.sel-link,.option-btn .icon-button,.page-form .el-button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.top>90}).map(e=>(e.textContent||'').replace(/\\s+/g,'').trim().slice(0,8)||'行图标').filter(t=>!skip.test(t)).length; })()`;
    const CLICK = idx => `(() => new Promise(res=>{ const skip=/^(简体中文|标注|立即刷新|个人中心|修改密码|退出登录|oms-demo|A|首页|商品|出库|订单|分销|入库|工单|售后|物流|财务|数据|设置|公制|英制)$/; const els=[...document.querySelectorAll('.el-button,.row-ic,.sel-link,.option-btn .icon-button,.page-form .el-button')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.top>90}).filter(e=>!skip.test((e.textContent||'').replace(/\\s+/g,'').trim().slice(0,8))); const el=els[${idx}]; if(!el)return res({t:'gone'}); const label=(el.textContent||'').replace(/\\s+/g,'').trim().slice(0,8)||'行图标'; const u0=location.href; let m=false; const o=new MutationObserver(()=>m=true); o.observe(document.body,{childList:true,subtree:true}); try{el.click()}catch(_){} setTimeout(()=>{o.disconnect(); const pop=[...document.querySelectorAll('.el-overlay,.el-message,.el-popper,.el-dropdown__popper,.el-select__popper,.el-dropdown-menu')].some(e=>{const r=e.getBoundingClientRect(); const s=getComputedStyle(e); return r.width>0&&r.height>0&&s.display!=='none'&&s.visibility!=='hidden'&&e.getAttribute('aria-hidden')!=='true';}); res({t:(m||location.href!==u0||pop)?'ok':'inert',label})},550); }))()`;
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1680, height: 1050, deviceScaleFactor: 1, mobile: false });
    const load = async (url) => { await send('Page.navigate', { url }); for (let i = 0; i < 90; i++) { await sleep(140); if (await evalv(`!!document.querySelector('#app *, .el-table, .page-form, .el-form')`) === true) break; } await sleep(900); };

    console.log('\n════════ 保真审计 fidelity-audit（真系统 ⇄ 复刻件·逐维 diff）════════');
    console.log('  配置源: ' + path.basename(PDATA) + ' · 复刻件: ' + path.basename(DELIV));
    let total = 0;
    for (const pg of PAGES) {
      console.log('\n══ ' + pg.name + ' ══');
      let R, P, RS, PS;
      try { await load(toUrl(pg.real)); R = await evalv(FP); RS = await evalv(STYLE_PROBE); await load(delivUrl(pg.page)); P = await evalv(FP); PS = await evalv(STYLE_PROBE); }
      catch (e) { console.log('  加载/抽取失败:', e.message); total++; continue; }
      if (!R || !P) { console.log('  指纹为空（真或复刻页未渲染）'); total++; continue; }
      const isForm = /新增|创建|编辑|详情|查看/.test(pg.name);
      let d = 0;
      d += diffList('工具栏按钮(文案·禁用·主次)', R.btns, P.btns, x => x.t + (x.d ? '[禁用]' : '') + (x.p ? '[主]' : ''));
      d += diffList('列', R.cols, P.cols);
      d += diffList('分区标题', R.secs, P.secs);
      d += diffList('表单字段(label·必填)', R.labels, P.labels, x => x.t + (x.r ? '*' : ''));
      if (!isForm) {
        d += diffList('状态页签', R.tabs, P.tabs);
        if (R.filters !== P.filters) { console.log('    ✗ 筛选控件数 真=' + R.filters + ' 复刻=' + P.filters); d++; } else console.log('    ✓ 筛选控件数 (' + R.filters + ')');
      }
      if (RS && PS) d += diffStyle(RS, PS);
      // 聚合列变形维（复刻件·当前已加载复刻页）：商品/订单信息聚合列被挤成逐字竖排 = 变形（列宽<180 或短字段≥3行）
      if (!isForm) try {
        const df = await evalv(DEFORM_PROBE);
        if (df && df.found && (df.maxLines >= 3 || (df.minW && df.minW < 180))) {
          d++; console.log('    ✗ [聚合] 商品/订单信息列变形：短字段「' + df.sample + '」占 ' + df.maxLines + ' 行·列宽 ' + Math.round(df.minW) + 'px（应≥230·给 columns 显式 width）');
        } else if (df && df.found) console.log('    ✓ 聚合单元格无变形（列宽 ' + Math.round(df.minW) + 'px·短字段最多 ' + df.maxLines + ' 行）');
      } catch (e) {}
      // 可交互维（复刻件·每个按钮点了要有反应）：逐个 fresh-reload + click + 检测 DOM/url 变化
      try {
        const nBtn = await evalv(ENUM);
        const inert = [];
        for (let bi = 0; bi < Math.min(nBtn, 40); bi++) {
          await load(delivUrl(pg.page));
          const rr = await evalvA(CLICK(bi));
          if (rr && rr.t === 'inert') inert.push(rr.label);
        }
        if (inert.length) { d += 1; console.log('    ✗ [交互] 摆设(点了没反应): ' + JSON.stringify([...new Set(inert)])); }
        else console.log('    ✓ 按钮可交互 (' + nBtn + '个全有反应)');
      } catch (e) { console.log('    · 交互检查跳过:', e.message); }
      // 行操作图标：真系统某行最多 N 个图标，复刻件最多行图标数 < N = 缺图标 = 红（2026-09-18 升级·原来只提示不判红·出库2个真6个漏过）
      if (!isForm && R.maxRowIcons > 0) {
        if ((P.maxRowIcons || 0) < R.maxRowIcons) { d++; console.log('    ✗ [行图标] 真系统每行最多 ' + R.maxRowIcons + ' 个操作图标·复刻最多 ' + (P.maxRowIcons || 0) + ' 个（缺图标·补 actions 或 hideIf 分状态）真类型=' + JSON.stringify(R.realIconRefs)); }
        else console.log('    ✓ 行操作图标（真每行≤' + R.maxRowIcons + '·复刻≤' + P.maxRowIcons + '）');
      }
      console.log('  —— ' + pg.name + '：' + (d ? d + ' 处不一致' : '全对 ✓'));
      total += d;
    }
    // ═══ 弹窗维度（2026-09-18 补·堵眼验盲区）：机器点开每个弹窗，与真弹窗快照逐值比 标题/宽/底部按钮 ═══
    if (DIALOGS.length) {
      console.log('\n══ 弹窗（点开逐个比）══');
      for (const dc of DIALOGS) {
        let rD, pD;
        try {
          await load(toUrl(dc.real)); rD = await evalv(DLGPROBE);
          await load(delivUrl(dc.page));
          for (let i = 0; i < 25; i++) { if (await evalv(`!!document.querySelector('.el-table__body tr, .page-form')`) === true) break; await sleep(200); }
          await sleep(400);
          const op = await evalvA(OPEN(dc)); await sleep(600); pD = await evalv(DLGPROBE);
          if (op && op.err) { total++; console.log('    ✗ [' + dc.name + '] 复刻件打不开弹窗：' + op.err + '（openBy=' + dc.openBy + '）'); continue; }
        } catch (e) { total++; console.log('    ✗ [' + dc.name + '] 加载失败:', e.message); continue; }
        if (!rD) { console.log('    · [' + dc.name + '] 真快照未探到弹窗（快照可能没开弹窗）·跳过'); continue; }
        if (!pD) { total++; console.log('    ✗ [' + dc.name + '] 复刻件点了「' + dc.openBy + '」没弹出弹窗'); continue; }
        const bad = [];
        if (rD.title !== pD.title) bad.push('标题 真[' + rD.title + ']复[' + pD.title + ']');
        if (Math.abs(rD.w - pD.w) > 20) bad.push('宽 真[' + rD.w + ']复[' + pD.w + ']');
        const rb = rD.btns.join('/'), pb = pD.btns.join('/');
        if (rb !== pb) bad.push('底部按钮 真[' + rb + ']复[' + pb + ']');
        if (bad.length) { total++; console.log('    ✗ [' + dc.name + '] ' + bad.join(' · ')); }
        else console.log('    ✓ [' + dc.name + '] 标题/宽/按钮一致（' + pD.title + '·' + pD.w + 'px·' + pb + '）');
      }
    }
    console.log('\n════════ ' + (total ? '合计 ' + total + ' 处不一致（逐条改到全绿）' : '全部维度一致 ✓ —— 达 1:1') + ' ════════');
    ws.close();
    process.exit(total ? 1 : 0);
  } catch (e) { console.error('审计异常:', e.message); process.exit(2); }
  finally { try { ch.kill(); } catch (_) {} try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {} }
})();
