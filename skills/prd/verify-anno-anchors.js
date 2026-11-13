// 浏览器实测：原型里“跟着按钮走”的标注（pin.anchor）是否都显示在该显示的地方。
// 用法：node verify-anno-anchors.js <原型.html> [--map <映射.json>] [--only 5.3.4.5.3,9.4.1] [--width 1600] [--out 结果.txt]
//   不带 --map：检查原型里已经烤进去的标注（pin.anchor）。
//   带 --map：  用映射里的 pages/tab/notTab/texts 覆盖同章节号的标注再检查（原型里没有的章节号临时补一个检查用的标注）——
//               改映射后不用重新装配原型就能先验一遍。
// 怎么验：无头浏览器打开原型，打开标注开关；对每个标注 anchor.pages 里的每个页面，进页面、逐层点页签/状态/子页签（开关全开再来一遍），
//   每种状态下触发一次锚点刷新，记下标注是否显示、贴在哪个文字上。判定（每个页面单独判）：
//     ✗ 页面进不去（菜单里找不到这个页面 id）
//     ✗ 页签找不到（没有任何状态满足 tab / notTab）
//     ✗ 该显示没显示（满足页签条件的状态里一次都没显示 = 锚点文字一个都找不到）
//     ✗ 不该显示却显示了（不满足页签条件的状态里显示了）
//     ⚠ 满足页签条件但个别状态没显示（例如按钮只在某几个子页签有）——只提示，不算失败
// 输出：每个章节号一行的表 + 汇总；有 ✗ 退出码 1，全过 0。
// 临时文件：浏览器配置目录放临时沙盒（skills/_shared/qa/_tmp-sandbox.js），结束自动删。
const fs = require('fs'), path = require('path');
const { openPage, PAGE_HELPERS, PG_MENUS, walkStates } = require('./_anno-browser.js');

(async () => {
  const argv = process.argv.slice(2); const pos = []; const o = {};
  for (let i = 0; i < argv.length; i++) { const a = argv[i]; if (a.startsWith('--')) o[a.slice(2)] = argv[++i]; else pos.push(a); }
  const html = pos[0];
  if (!html) { console.error('用法：node verify-anno-anchors.js <原型.html> [--map 映射.json] [--only 章节号,章节号] [--out 结果.txt]'); process.exit(1); }
  const map = o.map ? JSON.parse(fs.readFileSync(o.map, 'utf8')) : null;
  const only = o.only ? new Set(o.only.split(/[,，\s]+/).filter(Boolean)) : null;
  const t0 = Date.now();
  const b = await openPage(html, { width: +o.width || 1600 });
  let lines = [], fails = 0;
  try {
    await b.ev(PAGE_HELPERS);
    // 打开标注层、准备待验标注
    const PREP = async (a) => {
      for (let i = 0; i < 80 && !(document.querySelector('#anno-app') && document.querySelector('#anno-app')._vnode); i++) await __W(250);
      const el = document.querySelector('#anno-app'); const AS = el && el._vnode && el._vnode.component && el._vnode.component.setupState;
      if (!AS || !AS.annoPins) return { err: '原型里没有标注层（#anno-app）' };
      if (typeof window.__annoAnchorTick !== 'function') return { err: '标注层版本太旧：没有 __annoAnchorTick（需 1.11.0 及以上）' };
      window.__AS = AS; AS.showPins = true; document.body.classList.add('anno-mode-on');
      const added = [];
      if (a.map) for (const e of a.map) for (const sec of e.secs) {
        const anchor = Object.assign({ pages: e.pages || [], tab: e.tab || '', texts: e.texts || [] }, e.notTab ? { notTab: e.notTab } : {});
        const p = AS.annoPins.find(x => x.prdSection === sec);
        if (p) p.anchor = anchor; else { AS.annoPins.push({ id: 'chk-' + sec, number: 900 + added.length, x: 0, y: 0, title: sec, prdSection: sec, anchor, fieldSpecs: '', useCaseRules: '' }); added.push(sec); }
      }
      let list = AS.annoPins.map((p, i) => ({ i, sec: p.prdSection || p.id, title: p.title || '', anchor: p.anchor ? JSON.parse(JSON.stringify(p.anchor)) : null }))   /* 响应式代理按值传回会变空，先转成普通对象 */.filter(p => p.anchor);
      if (a.only) list = list.filter(p => a.only.includes(p.sec));
      if (a.map) { const secs = new Set(a.map.flatMap(e => e.secs)); list = list.filter(p => secs.has(p.sec)); }
      return { list, added, total: AS.annoPins.length };
    };
    const prepArg = { map, only: only ? [...only] : null };
    const prep = await b.ev(PREP, prepArg);
    b.afterReload = async () => { await b.ev(PAGE_HELPERS); await b.ev(PREP, prepArg); };   // 页面卡死重开浏览器后：重新打开标注层、重新套映射
    if (prep.err) { console.error(prep.err); process.exit(1); }
    const pins = prep.list;
    console.log(`待验标注 ${pins.length} 个${prep.added.length ? `（映射里有、原型里没有的 ${prep.added.length} 个已临时补上）` : ''}`);
    const need = new Set(pins.flatMap(p => p.anchor.pages || []));
    const { menus } = await b.ev(PG_MENUS);
    const anyPage = pins.some(p => !(p.anchor.pages || []).length);   // 没限定页面的标注：所有页面都要看
    const use = anyPage ? menus : menus.filter(m => need.has(String(m.id).split('@')[0]));
    console.log(`涉及页面 ${need.size} 个、菜单 ${use.length} 个，开始逐个状态检查…`);
    // obs[pinIdx][page] = [{ tabPath, tabOk, vis, via }]
    const obs = {};
    const idx = pins.map(p => p.i);
    await walkStates(b, {
      menus: use, t0,
      onState: async (st) => {
        const r = await b.ev(async (ix) => {
          window.__annoAnchorTick(); await __W(30); window.__annoAnchorTick();
          const { by, active } = __collect(); const out = [];
          for (const i of ix) {
            const p = __AS.annoPins[i]; const a = p.anchor;
            const tabOk = (!a.tab || [].concat(a.tab).every(t => active.has(__N(t)))) && (!a.notTab || ![].concat(a.notTab).some(t => active.has(__N(t))));
            const pageOk = !a.pages || !a.pages.length || a.pages.includes(__AS.page);
            let via = ''; if (p._vis === true) for (const t of a.texts || []) { if (by.get(__N(t))) { via = t; break; } }
            out.push([i, pageOk ? 1 : 0, tabOk ? 1 : 0, p._vis === true ? 1 : 0, via]);
          }
          return out;
        }, idx);
        for (const [i, pageOk, tabOk, vis, via] of r) {
          if (!pageOk) continue;
          ((obs[i] = obs[i] || {})[st.page] = obs[i][st.page] || []).push({ tabPath: st.tabPath.join('›') || '（默认）', tabOk, vis, via, flagsOn: st.flagsOn });
        }
      },
    });
    // 判定
    const rows = [];
    for (const p of pins) {
      const a = p.anchor; const parts = []; let bad = false, warn = false;
      const pgs = (a.pages || []).length ? a.pages : Object.keys(obs[p.i] || {});
      if (!pgs.length) { parts.push('✗没限定页面，也没在任何页面显示'); bad = true; }
      for (const pg of pgs) {
        const L = (obs[p.i] || {})[pg];
        if (!L || !L.length) { parts.push(`${pg}: ✗页面进不去`); bad = true; continue; }
        const ok = L.filter(x => x.tabOk), no = L.filter(x => !x.tabOk);
        const shown = ok.filter(x => x.vis), wrong = no.filter(x => x.vis), miss = ok.filter(x => !x.vis);
        if (!ok.length) { parts.push(`${pg}: ✗页签找不到（tab=${JSON.stringify(a.tab || '')}${a.notTab ? ' notTab=' + JSON.stringify(a.notTab) : ''}）`); bad = true; continue; }
        if (!shown.length) { parts.push(`${pg}: ✗该显示没显示（${ok.map(x => x.tabPath).join('、')} 里都找不到 ${JSON.stringify(a.texts)}）`); bad = true; continue; }
        if (wrong.length) { parts.push(`${pg}: ✗不该显示却显示了（${wrong.map(x => x.tabPath).join('、')}）`); bad = true; continue; }
        const vias = [...new Set(shown.map(x => x.via).filter(Boolean))];
        let s = `${pg}: ✓ 显示于 ${[...new Set(shown.map(x => x.tabPath + (x.flagsOn ? '[开关全开]' : '')))].join('、')} 贴在【${vias.join('/') || '?'}】`;
        if (miss.length) { warn = true; s += `；⚠ ${[...new Set(miss.map(x => x.tabPath))].join('、')} 没显示`; }
        if (no.length) s += `；其它 ${no.length} 个状态正确隐藏`;
        parts.push(s);
      }
      if (bad) fails++;
      rows.push(`${bad ? '✗' : warn ? '⚠' : '✓'} ${p.sec} ${p.title} | ${parts.join(' | ')}`);
    }
    lines = rows;
    const okN = rows.filter(r => r[0] === '✓').length, wN = rows.filter(r => r[0] === '⚠').length;
    lines.push('', `汇总：${pins.length} 个标注，✓ ${okN}，⚠ ${wN}（显示正确但个别状态没显示），✗ ${fails}；用时 ${Math.round((Date.now() - t0) / 1000)} 秒`);
    if (b.dialogs.length) lines.push(`（检查中自动关掉了 ${b.dialogs.length} 个浏览器弹框）`);
  } finally { await b.close(); }
  console.log(lines.join('\n'));
  if (o.out) fs.writeFileSync(o.out, lines.join('\n'));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error('出错：', e && e.stack || e); process.exit(1); });
