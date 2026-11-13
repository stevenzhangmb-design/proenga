// 自动出【PRD → 原型标注】映射草稿（不用圈选、不用手写映射）。
// 用法：node auto-anno-map.js <PRD.md> <原型.html> <输出映射.json> [选项]
//   选项：
//     --project-data <pd.json>  可选，只用来在报告里注明来源（页面结构以原型实际渲染为准）
//     --inventory <inv.json>    把爬到的“页面 × 页签 × 可见按钮”清单存下来；已存在就直接复用、不再开浏览器（反复调匹配时省时间）
//     --recrawl                 有 --inventory 也强制重新爬
//     --ref <人工映射.json>     有人工核对过的映射时，对比准确率（页面集合 / 页签 / 首个锚点文字）
//     --width <px>              浏览器宽度，默认 1600
// 做什么：
//   ① 无头浏览器打开原型，按菜单逐个进页面（本工具包骨架：系统 setSys / 菜单 nav / 收银 posNavItems / go(id)），
//      在每个页面里逐个点状态面板、页签、子页签（最多 3 层），记下每种状态下看得见的按钮/文字和收在下拉里的菜单项；
//      骨架的开关（FLAGS 里的布尔量）全打开再爬一遍，开关才出现的页签（如“开票前置”）也能爬到。
//   ② 读 PRD 里每个写了【字段规范】或【用例规则】的功能点，连同它上面的标题路径（模块 › 页签 › 功能）。
//   ③ 匹配：功能名（去掉序号和括号说明）对按钮文字；标题路径里出现的菜单名/页签名决定页面和页签；
//      同样的按钮+页签在多个页面都有（电商/零售两套）就都带上；按钮收在【更多】里的，锚点写成 [按钮, 更多…]。
//   ④ 输出映射草稿（格式同 prd-to-annotations.js 的映射）+ 报告 <输出映射>.report.txt（每条的把握程度、没匹配上的）。
//      映射是草稿：报告里标“低”和“没匹配上”的要 AI/人工复核后再交给 prd-to-annotations.js 出标注。
// 退出码：0 全部匹配；2 有没匹配上的功能点（映射里没有它们，需补）；1 出错。
// 临时文件：浏览器配置目录放在临时沙盒（skills/_shared/qa/_tmp-sandbox.js），结束自动删。
const fs = require('fs'), path = require('path');
const { parsePrd } = require('./prd-to-annotations.js');
const { openPage, PAGE_HELPERS, PG_MENUS, walkStates } = require('./_anno-browser.js');

const N = s => String(s || '').replace(/[▾⌄›﹀▼\s]/g, '').replace(/[（(]\d+[)）]$/, '').replace(/([^\d.\-])\d+$/, '$1').trim();
const NP = s => N(s).replace(/[（(][^（）()]*[)）]$/, '').replace(/^(.{2,})[·•][^·•]{1,20}$/, '$1');   // 只用于比较：去掉末尾括号/“·”说明（“按日期导出(XML)”“打印发票·DANFE”）

// ───────────── ① 爬原型 ─────────────
async function crawl(html, opt) {
  const t0 = Date.now();
  const b = await openPage(html, { width: opt.width || 1600 });
  try {
    await b.ev(PAGE_HELPERS);
    const { menus, generic } = await b.ev(PG_MENUS);
    console.log(`菜单 ${menus.length} 个${generic ? '（没认出骨架菜单 API，只爬当前页）' : ''}，开始逐个进页面…`);
    const states = await walkStates(b, { menus, t0 });
    return { html: path.basename(html), at: new Date().toISOString(), ms: Date.now() - t0, states };
  } finally { await b.close(); }
}

// ───────────── ②③ 匹配 ─────────────
const NOISE = /^(功能点详细介绍|功能说明|功能点|页面说明|字段规范|用例规则|列表|详情页?)$/;
const splitTok = s => String(s || '').replace(/^\d+(?:\.\d+)*\s*/, '').split(/[\/／、+＋\-－–—·,，\s（）()【】:：的]+/).map(x => N(x)).filter(x => x.length >= 2);

function nameVariants(name, bodyText) {
  const out = [];
  const add = (v, sc, fromBody) => { v = NP(v); if (fromBody && GENERIC.test(v)) return; if (v && v.length >= 1 && !out.some(o => o.v === v && o.sc >= sc)) out.push({ v, sc }); };
  const noParen = name.replace(/[（(][^（）()]*[）)]/g, '').trim();
  add(noParen, 100);
  const strip = s => s.replace(/^(批量|重新|用户填写|用户|手动|手工|含|再次)/, '').replace(/(场景|功能|操作|设置)$/, '');
  if (strip(noParen) !== noParen) add(strip(noParen), 90);
  for (const m of name.matchAll(/[（(]([^（）()]*)[）)]/g)) for (const p of m[1].split(/[、\/，,]/)) { add(p.replace(/^含/, ''), 70); add(strip(p.replace(/^含/, '')), 65); }
  // PRD 正文里的【按钮】：“点击【X】”最可信；【A】›【B】 的 B 是下拉菜单里的项
  const br = [...String(bodyText || '').matchAll(/【([^【】]{1,20})】/g)].map(m => m[1]);
  const clicks = [...String(bodyText || '').matchAll(/(?:点击|点|单击|选择)【([^【】]{1,20})】/g)].map(m => m[1]);
  const chains = [...String(bodyText || '').matchAll(/【([^【】]{1,20})】\s*[›>»]\s*【([^【】]{1,20})】/g)].map(m => m[2]);
  chains.slice(0, 3).forEach(x => add(x, 62, 1));
  clicks.slice(0, 4).forEach((x, i) => add(x, 60 - i * 3, 1));
  br.slice(0, 6).forEach(x => add(x, 40, 1));
  return out;
}

function textScore(t, vars) {
  const tn = NP(t); if (!tn) return 0; let best = 0;
  for (const { v, sc } of vars) {
    let s = 0;
    if (tn === v) s = sc;
    else if (tn.length >= 2 && v.includes(tn)) s = sc * 0.55 * (tn.length / v.length);
    else if (v.length >= 2 && tn.includes(v)) s = sc * 0.6 * (v.length / tn.length);
    if (s > best) best = s;
  }
  return best;
}
const ctxScore = (toks, labels) => {
  let s = 0, minLv = Infinity;
  for (const { tk, w, lv, exactOnly } of toks) {
    let b = 0;
    for (const L0 of labels) { const L = N(L0); const Lp = NP(L0); if (!L) continue; if (tk === L || tk === Lp) { b = 3; break; } if (Math.min(tk.length, L.length) >= 2 && (L.includes(tk) || tk.includes(L))) b = Math.max(b, 1); }
    if (exactOnly && b < 3) b = 0;
    s += b * w; if (b === 3 && lv < minLv) minLv = lv;
  }
  return { s, minLv };
};
// PRD 正文里常见的通用按钮（确定/取消…）不拿来当功能锚点
const GENERIC = /^(确定|确认|取消|关闭|查询|重置|保存|提交|返回|去处理|知道了|是|否|好的|下一步|上一步|完成|搜索)$/;

const parent0 = upper => upper[upper.length - 1];
function matchAll(prd, inv) {
  const { fpOf, kids, ancestors, body } = prd;
  const navWords = new Set(); inv.states.forEach(s => s.labels.forEach(l => navWords.add(N(l))));
  const results = [];
  for (const [sec, h] of fpOf) {
    const anc = ancestors(h).filter(x => !NOISE.test(x.name));
    const upper = anc.slice(0, -1);
    // 标题路径切词：越上层越决定“哪个页面”，越下层越决定“哪个页签”
    const toks = []; upper.forEach((x, i) => splitTok(x.text).forEach(tk => toks.push({ tk, w: Math.max(0.5, 1.5 - 0.25 * i), lv: i })));
    splitTok(h.name).forEach(tk => toks.push({ tk, w: 0.5, lv: upper.length }));
    const upperNames = new Set(upper.map(x => NP(x.name.replace(/[（(][^（）()]*[）)]/g, ''))));
    const bodyText = kids(h).map(k => body(k)).join('\n') + '\n' + body(h);
    const vars = nameVariants(h.name, bodyText);
    // 上一级标题本身不是功能点、但像按钮名（如 创建发票 › 销售发票）→ 也当候选
    if (parent0(upper) && !fpOf.has(parent0(upper).num)) { const pv = NP(parent0(upper).name.replace(/[（(][^（）()]*[）)]/g, '')); if (pv) { const ex = vars.find(v => v.v === pv); if (ex) ex.sc = Math.max(ex.sc, 62); else vars.push({ v: pv, sc: 62 }); } }
    const isBatch = /^批量/.test(h.name);
    // 兄弟功能点名字括号里的词（决定 notTab：如“重新开票（开票失败）”）
    const parent = upper[upper.length - 1];
    const sibTabs = new Set();
    if (parent) for (const [s2, h2] of fpOf) if (s2 !== sec && ancestors(h2).includes(parent)) { const m = h2.name.match(/[（(]([^）)]*)[）)]/); if (m) splitTok(m[1]).forEach(t => sibTabs.add(t)); }
    const mentionBy = (t, minLv) => toks.some(({ tk, lv }) => lv > minLv && (tk === N(t) || (N(t).length >= 2 && tk.includes(N(t)) && tk.length <= N(t).length + 3)));
    // 候选：每个状态里的每个按钮/文字/下拉项
    const cand = [];
    for (const st of inv.states) {
      const { s: pc, minLv } = ctxScore(toks, st.labels);
      const lvCut = minLv === Infinity ? -1 : minLv;          // 定页面的那层标题及以上不再算页签提及（如 5.5 标题里的“门店预订单”）
      const ment = st.tabPath.filter(t => mentionBy(t, lvCut)).length, unm = st.tabPath.length - ment;
      const base = { st, pc, ment, unm, lvCut };
      for (const [t, isBtn, inRow, isTab] of st.texts) {
        if (navWords.has(N(t))) continue;
        let ts = textScore(t, vars); if (ts < 20) continue;
        if (isTab) { if (NP(t) !== vars[0].v) continue; ts *= 0.8; }   // 功能名和页签名一字不差（如 无需开票）才贴页签上
        else if (!isBtn) ts *= inRow ? (NP(t) === vars[0].v ? 0.6 : 0.4) : 0.7;   // 和功能名一字不差的行内文字（如状态“无需开票”）放宽
        if (isBatch && inRow) ts *= 0.5;                         // “批量…”是工具条上的按钮，不是行上的                    // 表格里的普通文字（如类型列“销售发票”）最不像按钮
        cand.push(Object.assign({ t, via: null, ts, inRow }, base));
      }
      for (const [trig, inRow, items] of st.dd) for (const it of items) {
        let ts = textScore(it, vars); if (ts < 20) continue;
        if (upperNames.has(NP(trig))) ts += 30;                 // 上一级标题就是这个下拉按钮（如 创建发票 › 销售发票）
        cand.push(Object.assign({ t: it, via: trig, ts, inRow }, base));
      }
    }
    if (!cand.length) { results.push({ sec, name: h.name, path: anc.map(x => x.text).join(' › '), conf: '没匹配上', why: '原型里找不到同名或相近的按钮/文字' }); continue; }
    cand.forEach(c => c.score = c.ts + c.pc * 20 + c.ment * 6 - c.unm * 2);
    cand.sort((a, b) => b.score - a.score);
    const best = cand[0]; const T = NP(best.t);
    const withT = cand.filter(c => NP(c.t) === T);
    const maxPc = Math.max(...withT.map(c => c.pc));
    let chosen = withT.filter(c => c.pc >= maxPc - 0.01);
    if (isBatch && chosen.some(c => !c.inRow)) chosen = chosen.filter(c => !c.inRow);
    const pages = [...new Set(chosen.map(c => c.st.page))];
    // 页签
    let tab = '', notTab = null;
    const maxMent = Math.max(...chosen.map(c => c.ment));
    if (maxMent > 0) {
      const b2 = chosen.filter(c => c.ment === maxMent).sort((a, b) => a.unm - b.unm || b.score - a.score)[0];
      const tp = b2.st.tabPath.filter(t => mentionBy(t, b2.lvCut));
      tab = tp.length === 1 ? tp[0] : tp;
      const kidsT = new Set();
      inv.states.filter(s => s.page === b2.st.page && s.tabPath.length > b2.st.tabPath.length && b2.st.tabPath.every((x, i) => s.tabPath[i] === x)).forEach(s => { const t2 = s.tabPath[b2.st.tabPath.length]; if (sibTabs.has(N(t2)) && !mentionBy(t2, b2.lvCut)) kidsT.add(t2); });
      if (kidsT.size) notTab = kidsT.size === 1 ? [...kidsT][0] : [...kidsT];
    } else {
      // 路径没提页签：按钮只在同一个页签（及其子页签）下出现 → 限定它；到处都有 → 不限
      const pg = pages[0]; const all = inv.states.filter(s => s.page === pg && !s.flagsOn);
      const has = [...new Set(chosen.filter(c => c.st.page === pg).map(c => c.st))];
      const hasDefault = has.filter(s => !s.flagsOn);
      const pool = hasDefault.length ? hasDefault : has;
      if (pool.length && all.length > 1 && pool.length < all.length) {
        let pre = pool[0].tabPath.slice(); pool.forEach(s => { let i = 0; while (i < pre.length && s.tabPath[i] === pre[i]) i++; pre = pre.slice(0, i); });
        if (pre.length) tab = pre.length === 1 ? pre[0] : pre;
      }
    }
    // 锚点文字：直接看得见的用它本身；收在下拉里的后面跟下拉按钮（工具条的在前、行上的在后）
    // 锚点要用元素真实文字（标注层按 _anNorm 原文匹配）：同义的几个写法都带上，直接可见的在前
    const texts = [];
    [...chosen].sort((a, b) => (a.via ? 1 : 0) - (b.via ? 1 : 0) || b.score - a.score).forEach(c => { if (!texts.includes(N(c.t))) texts.push(N(c.t)); });
    const trigs = new Map(); chosen.forEach(c => { if (c.via && !trigs.has(c.via)) { const d = c.st.dd.find(x => x[0] === c.via); trigs.set(c.via, d ? d[1] : 0); } });
    [...trigs].sort((a, b) => a[1] - b[1]).forEach(([v]) => { if (!texts.includes(v)) texts.push(v); });
    // 标题最指向的页面（页面分最高）上没找到按钮 → 多半要走业务流程才出现（收银结账后、弹窗里），提示复核
    let topPc = 0; const topPages = new Set();
    for (const st of inv.states) { const { s: pc } = ctxScore(toks, st.labels); if (pc > topPc + 0.01) { topPc = pc; topPages.clear(); } if (pc >= topPc - 0.01 && pc > 0) topPages.add(st.page); }
    const offPage = topPc > maxPc + 0.01 && !pages.some(p => topPages.has(p));
    let conf = best.ts >= 85 && maxPc > 0 ? '高' : best.ts >= 50 && maxPc > 0 ? '中' : '低';
    if (offPage) conf = '低';
    const alt = cand.filter(c => NP(c.t) !== T).slice(0, 2).map(c => `${c.t}@${c.st.page}${c.st.tabPath.length ? '/' + c.st.tabPath.join('›') : ''}`);
    results.push({ sec, name: h.name, path: anc.map(x => x.text).join(' › '), conf, entry: Object.assign({ pages, tab, texts }, notTab ? { notTab } : {}), why: `按钮“${best.t}”${best.via ? '（在【' + best.via + '】下拉里）' : ''} 文字分${Math.round(best.ts)} 页面分${Math.round(maxPc * 10) / 10} 页签提及${maxMent}${offPage ? `；⚠ 标题更像在说页面 ${[...topPages].join("/")}，但那里没爬到这个按钮（可能要走业务流程/开弹窗才出现），请人工确认页面和锚点` : ""}`, alt });
  }
  return results;
}

function toMap(results) {
  const map = [];
  for (const r of results) {
    if (!r.entry) continue;
    const key = JSON.stringify(r.entry);
    const ex = map.find(e => e._k === key && e._conf === r.conf);
    if (ex) ex.secs.push(r.sec); else map.push(Object.assign({ secs: [r.sec] }, r.entry, { _conf: r.conf, _k: key }));
  }
  map.forEach(e => delete e._k);
  return map;
}

// ───────────── 与人工映射对比 ─────────────
function compare(results, ref, inv) {
  const R = new Map(); ref.forEach(e => e.secs.forEach(s => R.set(s, e)));
  const arr = x => [].concat(x || []).map(N).filter(Boolean);
  const eqSet = (a, b) => { a = arr(a).sort(); b = arr(b).sort(); return a.length === b.length && a.every((x, i) => x === b[i]); };
  // 行为对比：在爬到的每个状态里，按标注层同样的规则算“标注号贴在哪个文字上 / 不显示”，两份映射处处一样 = 行为一致
  const vis = inv.states.map(st => new Set(st.texts.map(x => N(x[0]))));
  const act = inv.states.map(st => new Set(st.active.map(N)));
  const where = (e, i) => { const st = inv.states[i]; if (!(e.pages || []).includes(st.page)) return null;
    if (e.tab && !arr(e.tab).every(t => act[i].has(t))) return null; if (e.notTab && arr(e.notTab).some(t => act[i].has(t))) return null;
    for (const t of e.texts || []) if (vis[i].has(N(t))) return N(t); return null; };
  const rows = []; const c = { n: 0, pages: 0, tab: 0, text: 0, all: 0, beh: 0 };
  for (const r of results) {
    const e = R.get(r.sec); if (!e) continue; c.n++;
    const m = r.entry || { pages: [], tab: '', texts: [] };
    const p = eqSet(m.pages, e.pages), t = eqSet(m.tab, e.tab) && eqSet(m.notTab, e.notTab), x = !!m.texts.length && NP(m.texts[0]) === NP(e.texts[0]);
    let beh = true, diff = '', refShown = 0;
    inv.states.forEach((st, i) => { const a = where(m, i), b = where(e, i); if (b) refShown++; if (a !== b && beh) { beh = false; diff = `${st.page}/${st.tabPath.join('›') || '默认'}${st.flagsOn ? '[开关全开]' : ''} 工具=${a || '不显示'} 人工=${b || '不显示'}`; } });
    if (!refShown) beh = beh && false;   // 人工映射在爬到的状态里一次都不显示（要走业务流程才出现），不算行为一致
    c.pages += p; c.tab += t; c.text += x; c.all += p && t && x; c.beh += beh;
    rows.push(`${p && t && x ? '对' : beh ? '同' : '差'} ${r.sec} ${r.name} | 页面${p ? '✓' : '✗'} 页签${t ? '✓' : '✗'} 文字${x ? '✓' : '✗'} 行为${beh ? '✓' : '✗' + (refShown ? '' : '（人工映射在爬到的状态里也不显示）')}${diff ? ' 例:' + diff : ''} | 工具:${JSON.stringify(m)} | 人工:${JSON.stringify({ pages: e.pages, tab: e.tab || '', texts: e.texts, notTab: e.notTab })}`);
  }
  return { c, rows };
}

// ───────────── 主流程 ─────────────
(async () => {
  const argv = process.argv.slice(2); const pos = []; const o = {};
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) { const k = a.slice(2); if (['recrawl'].includes(k)) o[k] = true; else o[k] = argv[++i]; } else pos.push(a); }
  const [mdPath, html, outPath] = pos;
  if (!mdPath || !html || !outPath) { console.error('用法：node auto-anno-map.js <PRD.md> <原型.html> <输出映射.json> [--inventory inv.json] [--recrawl] [--ref 人工映射.json] [--project-data pd.json]'); process.exit(1); }
  const t0 = Date.now();
  const prd = parsePrd(mdPath);
  console.log(`PRD 带字段规范/用例规则的功能点 ${prd.fpOf.size} 个`);
  let inv;
  if (o.inventory && fs.existsSync(o.inventory) && !o.recrawl) { inv = JSON.parse(fs.readFileSync(o.inventory, 'utf8')); console.log(`复用页面清单 ${o.inventory}（${inv.states.length} 个状态）`); }
  else { inv = await crawl(html, { width: +o.width || 1600 }); if (o.inventory) fs.writeFileSync(o.inventory, JSON.stringify(inv)); console.log(`爬完：${inv.states.length} 个页面状态，用时 ${Math.round(inv.ms / 1000)} 秒`); }
  const t1 = Date.now();
  const results = matchAll(prd, inv);
  const map = toMap(results);
  fs.writeFileSync(outPath, JSON.stringify(map, null, 1));
  const lines = [`自动映射报告  PRD=${path.basename(mdPath)}  原型=${path.basename(html)}${o['project-data'] ? '  project-data=' + path.basename(o['project-data']) : ''}`,
    `功能点 ${results.length} 个：高 ${results.filter(r => r.conf === '高').length}，中 ${results.filter(r => r.conf === '中').length}，低 ${results.filter(r => r.conf === '低').length}，没匹配上 ${results.filter(r => !r.entry).length}`,
    `页面状态 ${inv.states.length} 个；匹配用时 ${Date.now() - t1}ms`, '',
    '【要复核】低把握和没匹配上的：', ...results.filter(r => r.conf === '低' || !r.entry).map(r => `  ${r.sec} ${r.name}（${r.path}）→ ${r.entry ? JSON.stringify(r.entry) : '无'}；${r.why}${r.alt && r.alt.length ? '；备选 ' + r.alt.join('、') : ''}`), '',
    '【全部】', ...results.map(r => `  [${r.conf}] ${r.sec} ${r.name} → ${r.entry ? JSON.stringify(r.entry) : '无'}；${r.why}`)];
  if (o.ref) {
    const { c, rows } = compare(results, JSON.parse(fs.readFileSync(o.ref, 'utf8')), inv);
    const pct = x => (c.n ? Math.round(x * 1000 / c.n) / 10 : 0) + '%';
    lines.push('', `【对比人工映射】共 ${c.n} 个：页面集合一致 ${c.pages}（${pct(c.pages)}）、页签一致 ${c.tab}（${pct(c.tab)}）、首个锚点文字一致 ${c.text}（${pct(c.text)}）、三项全对 ${c.all}（${pct(c.all)}）、在爬到的全部状态里标注位置与人工映射完全一致 ${c.beh}（${pct(c.beh)}）`, ...rows);
    console.log(`对比人工映射：页面 ${pct(c.pages)}  页签 ${pct(c.tab)}  文字 ${pct(c.text)}  全对 ${pct(c.all)}（${c.all}/${c.n}）  行为一致 ${pct(c.beh)}（${c.beh}/${c.n}）`);
  }
  const rep = outPath.replace(/\.json$/i, '') + '.report.txt';
  fs.writeFileSync(rep, lines.join('\n'));
  console.log(`映射草稿 → ${outPath}（${map.length} 条，覆盖 ${results.filter(r => r.entry).length} 个功能点）；报告 → ${rep}；总用时 ${Math.round((Date.now() - t0) / 1000)} 秒`);
  process.exit(results.some(r => !r.entry) ? 2 : 0);
})().catch(e => { console.error('出错：', e && e.stack || e); process.exit(1); });
