#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   layout.js · 结构排版抽取器 —— 抓「怎么排」，不是「什么颜色」
   ────────────────────────────────────────────────────────────────────────
   2026-10-30 建。补的是一个**整维度的空缺**：

     此前整条链路（tokens → specdiff → emit-css）抽的全是**组件样式令牌**
     —— 按钮多高、表头什么色、输入框什么底。这些是「长什么样」。
     但用户要的 1:1 复刻里有另一半，一直是空的：**「怎么排」**
       · 新增/编辑页：几列？label 在上还是在左？label 多宽？字段行间距多少？
         有没有分组标题？按钮区在页脚还是页头？
       · 查看/详情页：几栏？标题区什么结构？内嵌明细表放在哪？
       · 列表页：列顺序、对齐、哪些列固定、操作列在最左还是最右？
       · 筛选区：几个控件、什么类型、什么顺序、有没有折叠、每个多宽？
       · 菜单：一级/二级/三级怎么分组？
     证据：`真系统设计规范.md` 只有 10 个章节，全是组件样式，一条结构都没有。
     结果就是「按默认规范画的原型」组件颜色对得上，**排版却是我自己编的**。

   为什么从冻结件抽、不连真系统：
     344 个冻结件已经含完整 DOM + 内联 CSS，`getComputedStyle` 照样准，
     而且**离线、可重跑、不占真系统**。连 live 抓一次只能抽一页；
     这里一次把 344 页全抽完，还能断点续跑。

   ⚠️ 一个必须如实标记的局限：真系统 OMS/WMS 的侧边菜单是**悬停才展开**的。
   冻结那一刻鼠标不在菜单上，二级/三级就不在 DOM 里。所以菜单维会标
   `菜单: { 完整度: '仅一级' }` —— **宁可报"只抓到一级"，不要把一级当成全部**
   （这正是 2026-10-29 那次"静默漏抓比报错危险"的同一个教训）。

   用法：
     node layout.js <冻结件目录|单个.html> <输出目录> [--port 9222] [--redo]
     产出 <页名>.layout.json，外加一份 _汇总.json
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
try { require('../_shared/qa/_tmp-sandbox'); } catch (_) {}
const { connect } = require('./_cdp');
const fs = require('fs');
const path = require('path');

const FN = `(() => {
  const R = el => el.getBoundingClientRect();
  const vis = el => { if (!el) return false; const r = R(el); const s = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'; };
  const txt = el => (el ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : '');
  const cs = (el, ps) => { if (!el) return null; const s = getComputedStyle(el); const o = {}; ps.forEach(p => { o[p] = s[p]; }); return o; };
  const px = v => Math.round(parseFloat(v) || 0);

  /* 页面最大的"列表表格"（不在表单/弹窗内）——筛选区和工具条都要靠它定位上下边界。
     §2026-10-30 实测必须有这个：新增页**没有列表表格**，原先用 tblTop=1e9 兜底，
     结果把表单字段全算成了"筛选控件"（抽出 5 个筛选，实际是 0）。*/
  function listHost() {
    const cands = [...document.querySelectorAll('.el-table, .native-table-wrap, table')].filter(vis)
      .filter(t => !t.closest('.el-dialog') && !t.closest('.el-date-picker') && !t.closest('.el-form'))
      .filter(t => t.querySelectorAll('thead th').length >= 3);
    return cands.sort((a, b) => R(b).height - R(a).height)[0] || null;
  }

  /* ── 1. 菜单结构 ───────────────────────────────────────────────────────
     真系统两种形态并存：**顶栏横向导航**（OMS 实测是这种，而且它是用 el-tabs
     实现的、不是 el-menu —— 所以这里必须一起认，否则会在 §6 被当成 74 个
     "状态页签"）+ **侧边树**。悬停式的二级在冻结件里可能缺，如实标记。 */
  function menu() {
    const topMenu = [...document.querySelectorAll('.el-menu--horizontal > .el-menu-item, .el-menu--horizontal > .el-sub-menu')]
      .filter(vis).map(li => ({ 名: txt(li.querySelector('.el-sub-menu__title') || li).slice(0, 30), 有子级: !!li.querySelector('.el-menu') }));
    /* el-tabs 当导航用：位于页面顶部 100px 内的那一组 */
    const topTabs = [...document.querySelectorAll('.el-tabs__item')].filter(vis)
      .filter(t => R(t).top < 100)
      .map(t => ({ 名: txt(t).slice(0, 30), 有子级: false, 选中: /is-active/.test(t.className),
        宽: px(R(t).width), 高: px(R(t).height) }));
    const top = topMenu.length ? topMenu : topTabs;
    const topImpl = topMenu.length ? 'el-menu--horizontal' : (topTabs.length ? 'el-tabs（页签当导航用）' : '无');
    const side = [];
    const sideRoot = [...document.querySelectorAll('.el-menu:not(.el-menu--horizontal)')].filter(vis)
      .sort((a, b) => R(b).height - R(a).height)[0];
    if (sideRoot) {
      [...sideRoot.children].filter(vis).forEach(li => {
        const t = li.querySelector('.el-sub-menu__title');
        const node = { 名: txt(t || li).slice(0, 30), 层: 1, 子: [] };
        li.querySelectorAll(':scope > .el-menu > .el-menu-item, :scope > .el-menu > .el-sub-menu').forEach(c2 => {
          if (!vis(c2)) return;
          const n2 = { 名: txt(c2.querySelector('.el-sub-menu__title') || c2).slice(0, 30), 层: 2, 子: [] };
          c2.querySelectorAll(':scope > .el-menu > .el-menu-item').forEach(c3 => { if (vis(c3)) n2.子.push({ 名: txt(c3).slice(0, 30), 层: 3 }); });
          node.子.push(n2);
        });
        side.push(node);
      });
    }
    const depth = side.reduce((m, a) => Math.max(m, a.子.length ? (a.子.some(b => b.子.length) ? 3 : 2) : 1), 0);
    return {
      导航形态: side.length ? (top.length ? '顶栏 + 侧边树' : '侧边树') : (top.length ? '顶栏横向导航（无侧边树）' : '没抓到导航'),
      顶栏实现: topImpl,
      顶栏一级: top, 侧边: side,
      侧边最深层: depth,
      完整度: side.length === 0 ? '侧边菜单没抓到（可能是悬停式·冻结时未展开）'
            : depth === 1 ? '仅一级（二级可能是悬停才展开·冻结时不在DOM里）' : '到' + depth + '级',
      一级项样式: sideRoot ? cs(sideRoot.querySelector('.el-sub-menu__title, .el-menu-item'), ['height', 'fontSize', 'color', 'paddingLeft', 'backgroundColor']) : null,
      选中项样式: cs(document.querySelector('.el-menu-item.is-active'), ['color', 'backgroundColor', 'fontWeight'])
    };
  }

  /* ── 2. 筛选区 ─────────────────────────────────────────────────────────
     定位：包含 ≥2 个控件、且位于最大表格之上的那个容器。 */
  function filterArea() {
    const tbl = listHost();
    if (!tbl) return null;   /* 没有列表表格就没有筛选区 —— 别把表单字段算成筛选 */
    const tblTop = R(tbl).top;
    const ctrls = [...document.querySelectorAll('.el-input, .el-select, .el-date-editor, .el-cascader, .el-input-number')]
      .filter(vis).filter(c => R(c).top < tblTop - 4 && R(c).top < 600)
      .filter(c => !c.closest('.el-pagination') && !c.closest('.el-dialog') && !c.closest('.el-table'));
    if (!ctrls.length) return null;
    /* 按 y 聚类成行，再按 x 排序 —— 这就是"几行几列、什么顺序" */
    const rows = [];
    ctrls.forEach(c => {
      const y = R(c).top;
      let row = rows.find(r => Math.abs(r.y - y) < 12);
      if (!row) { row = { y, items: [] }; rows.push(row); }
      row.items.push(c);
    });
    rows.sort((a, b) => a.y - b.y).forEach(r => r.items.sort((a, b) => R(a).left - R(b).left));
    const flat = [];
    rows.forEach((r, ri) => r.items.forEach((c, ci) => {
      const inp = c.querySelector('input, textarea');
      /* label：左侧或上方的紧邻文字（筛选区真系统常把字段名放占位符里，所以 label 可能为空） */
      let lab = '';
      let p = c.parentElement;
      for (let up = 0; up < 2 && !lab && p; up++, p = p.parentElement) {
        const cand = [...p.children].filter(ch => ch !== c && !ch.contains(c) && txt(ch) && vis(ch));
        const L = cand.find(ch => R(ch).right <= R(c).left + 6) || cand.find(ch => R(ch).bottom <= R(c).top + 6);
        if (L) lab = txt(L).slice(0, 24);
      }
      flat.push({
        行: ri + 1, 序: ci + 1, label: lab,
        占位: inp ? (inp.getAttribute('placeholder') || '') : '',
        类型: (c.className.match(/el-(input-number|input|select|date-editor|cascader)/) || [, '?'])[1],
        宽: px(R(c).width), 高: px(R(c).height)
      });
    }));
    /* 查询/重置/展开收起按钮在哪一行、什么顺序 */
    const btns = [...document.querySelectorAll('button, .el-button')].filter(vis)
      .filter(b => R(b).top < tblTop - 4 && !b.closest('.el-dialog') && !b.closest('.el-table'))
      .map(b => ({ 文案: txt(b).slice(0, 12), x: px(R(b).left), y: px(R(b).top), 主钮: /el-button--primary/.test(b.className) }))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    const last = rows[rows.length - 1];
    const qb = btns.filter(b => /查询|搜索|重置|清空|展开|收起|Pesquisar|Limpar/.test(b.文案));
    return {
      行数: rows.length, 控件数: flat.length, 控件: flat,
      行间距: rows.length > 1 ? px(rows[1].y - rows[0].y) : null,
      宽度取值: [...new Set(flat.map(f => f.宽))].sort((a, b) => a - b),
      查询重置: qb,
      查询钮位置: qb.length && last ? (Math.abs(qb[0].y - last.y) < 20 ? '与末行筛选同行' : '单独一行') : null,
      有折叠: btns.some(b => /展开|收起/.test(b.文案))
    };
  }

  /* ── 3. 列表（列顺序/对齐/固定/操作列位置）───────────────────────────── */
  function listArea() {
    const host = listHost();
    if (!host) return null;
    const ep = host.classList.contains('el-table') || !!host.closest('.el-table');
    const ths = [...host.querySelectorAll('thead th')].filter(vis);
    if (!ths.length) return null;
    const cols = ths.map((th, i) => {
      const inner = th.querySelector('.cell') || th.firstElementChild || th;
      const s = getComputedStyle(inner);
      return {
        序: i + 1, 列名: txt(th).slice(0, 24) || (th.querySelector('.el-checkbox') ? '[勾选框]' : ''),
        宽: px(R(th).width), 对齐: s.textAlign,
        固定: /el-table-fixed-column|is-fixed|first-th/.test(th.className) ? (/right/.test(th.className) ? '右固定' : '左固定') : '',
        勾选列: !!th.querySelector('.el-checkbox')
      };
    });
    const opIdx = cols.findIndex(c => /操作|Ação|Acoes|Operação/.test(c.列名));
    const firstRow = [...host.querySelectorAll('tbody tr')].filter(vis)[0];
    return {
      实现: ep ? 'EP表(el-table)' : '原生手写表',
      列数: cols.length, 列: cols,
      勾选列位置: cols.findIndex(c => c.勾选列) === 0 ? '第1列' : (cols.some(c => c.勾选列) ? '第' + (cols.findIndex(c => c.勾选列) + 1) + '列' : '无'),
      操作列位置: opIdx < 0 ? '无独立操作列' : (opIdx === cols.length - 1 ? '最后一列' : '第' + (opIdx + 1) + '/' + cols.length + '列'),
      操作列固定: opIdx >= 0 ? (cols[opIdx].固定 || '不固定') : '',
      行高: firstRow ? px(R(firstRow).height) : null,
      行操作形态: firstRow ? (() => {
        const tds = [...firstRow.children];
        const last = tds[tds.length - 1];
        if (!last) return '';
        const imgs = last.querySelectorAll('img, i, svg').length, as = last.querySelectorAll('a, .el-button').length;
        return imgs > as ? '图标 ×' + imgs : (as ? '文字链 ×' + as : '无');
      })() : '',
      对齐分布: cols.reduce((o, c) => { o[c.对齐] = (o[c.对齐] || 0) + 1; return o; }, {}),
      分页: (() => { const p = [...document.querySelectorAll('.el-pagination')].filter(vis)[0]; if (!p) return null;
        return { 组成: [...p.children].filter(vis).map(c => (c.className.match(/el-pagination__(\\w+)|el-pager|btn-(prev|next)/) || [, c.className.split(' ')[0]])[0]).slice(0, 8),
                 高: px(R(p).height), 对齐: getComputedStyle(p).justifyContent }; })()
    };
  }

  /* ── 4. 表单（新增/编辑）排版 ──────────────────────────────────────────
     关键是**结构**：几列、label 位置/宽、字段行距、分组、按钮区在哪。 */
  function formArea() {
    const dlg = [...document.querySelectorAll('.el-dialog')].filter(vis)[0];
    /* §2026-10-30 必须锁定到**具体那一个 el-form**，不能用 document 当作用域：
       整页冻结件里顶栏/筛选/其它区的控件会一起进来 —— 实测税种新增页抽出
       「字段 55 个 / 行距众数只占 17/30」，一眼就知道混了多个区域。
       有多个 el-form 时取字段最多的那个（就是主表单）。*/
    const root = dlg || (() => {
      const forms = [...document.querySelectorAll('.el-form')].filter(vis)
        .filter(f => !f.closest('.el-dialog'));
      if (!forms.length) return null;
      /* 只要外层 form，避免嵌套 form 重复计数 */
      const outer = forms.filter(f => !forms.some(g => g !== f && g.contains(f)));
      return outer.map(f => ({ f, n: f.querySelectorAll('.el-form-item').length }))
        .sort((a, b) => b.n - a.n)[0].f;
    })();
    if (!root) return null;
    const scope = root;
    const fis = [...scope.querySelectorAll('.el-form-item')].filter(vis)
      .filter(fi => !fi.querySelector('.el-form-item'));   /* 只要叶子字段 */
    const ctrls = [...scope.querySelectorAll('.el-input, .el-select, .el-date-editor, .el-textarea, .el-input-number')]
      .filter(vis).filter(c => !c.closest('.el-pagination') && !c.closest('.el-table'));
    if (fis.length < 3 && ctrls.length < 3) return null;
    /* 筛选区也是 el-form 包的，会在这里撞车 —— 页面同时有列表表格且这个 form
       整体在表格之上，那它是筛选区不是新增表单，交给 §2 处理。*/
    const lh = listHost();
    if (lh && R(scope).bottom <= R(lh).top + 8) return null;
    const units = fis.length >= 3 ? fis : ctrls;
    /* 列数 = x 聚类（容差 30px） */
    const xs = [];
    units.forEach(u => { const x = R(u).left; if (!xs.some(v => Math.abs(v - x) < 30)) xs.push(x); });
    xs.sort((a, b) => a - b);
    /* 行距 = 相邻两行 y 差的众数 */
    const ys = [...new Set(units.map(u => Math.round(R(u).top)))].sort((a, b) => a - b);
    const gaps = {};
    for (let i = 1; i < ys.length; i++) { const g = ys[i] - ys[i - 1]; if (g > 2 && g < 200) gaps[g] = (gaps[g] || 0) + 1; }
    const gapMode = Object.entries(gaps).sort((a, b) => b[1] - a[1])[0];
    const lab0 = scope.querySelector('.el-form-item__label');
    const labPos = (() => {
      if (!lab0 || !fis.length) return '?';
      const fi = lab0.closest('.el-form-item'); const c = fi && fi.querySelector('.el-form-item__content');
      if (!c) return '?';
      return R(lab0).bottom <= R(c).top + 4 ? 'label在上(label-top)' : 'label在左';
    })();
    /* 分组：真系统整页表单是**一组卡片**，每张卡顶部一个粗体标题（基本信息 / ICMS / …）。
       这些标题既不是 el-divider__text 也不是 h2/h3，第一版全漏了（抽出"分组标题: []"）。
       退回按视觉判断：卡片容器内、字段之上、字重 ≥600 的短文本。*/
    const secs = [];
    scope.querySelectorAll('.el-divider__text, h2, h3, .section-title, .form-section-title, .el-card__header, div, span, p').forEach(h => {
      if (!vis(h) || h.querySelector('input, button, .el-form-item')) return;
      const t = txt(h); if (!t || t.length > 24) return;
      const s = getComputedStyle(h);
      if (parseInt(s.fontWeight) < 600 && parseFloat(s.fontSize) < 15) return;
      if (secs.some(x => x.文案 === t)) return;
      secs.push({ 文案: t, y: px(R(h).top), 字号: s.fontSize, 字重: s.fontWeight, 色: s.color });
    });
    secs.sort((a, b) => a.y - b.y);
    /* 卡片容器：分组标题各自所在的那个带底色/圆角的块 */
    /* 卡片：真系统不一定用 .el-card。退回按视觉认：含字段、有圆角或白底、且不是整个表单本身 */
    const cards = (() => {
      const named = [...scope.querySelectorAll('.el-card, .form-card, .card, section')].filter(vis)
        .filter(c => c.querySelector('.el-form-item'));
      if (named.length) return named;
      const guess = [...scope.querySelectorAll('div')].filter(vis)
        .filter(c => c !== scope && c.querySelector('.el-form-item'))
        .filter(c => { const s = getComputedStyle(c);
          return parseFloat(s.borderRadius) > 0 || /rgb\\(255, 255, 255\\)/.test(s.backgroundColor) || s.boxShadow !== 'none'; });
      /* 只要最外层那几个，避免父子重复计数 */
      return guess.filter(c => !guess.some(g => g !== c && g.contains(c)));
    })();
    /* 左侧锚点侧栏：整页表单常配一列"基本信息/ICMS/…"的跳转锚点。
       第一版按 ul/el-menu 找，抽出 null —— 真系统不一定用这些标签。
       改成按内容认：页面左侧、包含 ≥3 个**与分组标题同名**的文本的最小容器。*/
    const anchorNav = (() => {
      if (secs.length < 3) return null;
      const names = new Set(secs.map(s => s.文案));
      const cands = [...document.querySelectorAll('div, ul, nav, aside')].filter(vis)
        .filter(n => R(n).left < 350 && R(n).top > 60 && R(n).width < 360)
        .filter(n => !n.closest('.el-menu--horizontal'))
        .map(n => {
          const kids = [...n.querySelectorAll('*')].filter(vis).filter(k => names.has(txt(k)));
          const uniq = new Set(kids.map(k => txt(k)));
          return { n, hit: uniq.size };
        })
        .filter(o => o.hit >= 3);
      if (!cands.length) return null;
      /* 取命中最多里最小的那个容器 */
      const best = cands.sort((a, b) => b.hit - a.hit || R(a.n).height - R(b.n).height)[0].n;
      const its = [...best.querySelectorAll('*')].filter(vis).filter(k => names.has(txt(k)))
        .filter((k, i, arr) => arr.findIndex(x => txt(x) === txt(k)) === i);
      return { 项: its.map(k => txt(k)), 宽: px(R(best).width), 左距: px(R(best).left),
        项高: its[0] ? px(R(its[0]).height) : null,
        项样式: cs(its[0], ['fontSize', 'color', 'padding', 'backgroundColor']),
        选中样式: cs(best.querySelector('.is-active, .active'), ['color', 'backgroundColor', 'fontWeight']) };
    })();
    const foot = [...(dlg || document).querySelectorAll('.el-dialog__footer, .form-footer, .page-footer, .footer-btns')].filter(vis)[0];
    /* 整页表单的提交按钮不在 __footer 类里，而且**页面很长**——55 个字段的 bottom
       远在视口之下，所以"取字段之下的按钮"也抽不到（实测页脚按钮为空）。
       真系统用的是**固定在视口底部的按钮条**（取消 + 提交，居中）。
       所以这里认两种：① 祖先里有 position:fixed/sticky 的按钮；② 视口下 1/4 的按钮。 */
    const fixedish = el => { for (let p = el; p && p !== document.body; p = p.parentElement) {
      const po = getComputedStyle(p).position; if (po === 'fixed' || po === 'sticky') return true; } return false; };
    const fbtns = (foot
      ? [...foot.querySelectorAll('button, .el-button')].filter(vis)
      : [...(dlg || document).querySelectorAll('button, .el-button')].filter(vis)
          .filter(b => !b.closest('.el-table') && !b.closest('.el-pagination') && !b.closest('.el-menu'))
          .filter(b => fixedish(b) || R(b).top > innerHeight * 0.75)
      ).map(b => ({ 文案: txt(b).slice(0, 12), 主钮: /el-button--primary/.test(b.className),
                    固定条: fixedish(b), x: px(R(b).left), y: px(R(b).top),
                    宽: px(R(b).width), 高: px(R(b).height) }))
       .filter(b => b.文案).sort((a, b) => a.x - b.x);
    return {
      形态: dlg ? '弹窗(宽 ' + px(R(dlg).width) + 'px)' : '整页',
      字段数: units.length, 列数: xs.length, 列起始x: xs.map(px),
      label位置: labPos,
      label宽: lab0 ? px(R(lab0).width) : null,
      label样式: cs(lab0, ['fontSize', 'color', 'fontWeight', 'textAlign', 'lineHeight']),
      字段行距: gapMode ? +gapMode[0] + 'px（' + gapMode[1] + ' 次·共 ' + (ys.length - 1) + ' 个间隔）' : null,
      必填星号: (() => { const r = scope.querySelector('.el-form-item.is-required .el-form-item__label'); if (!r) return '无';
        const b = getComputedStyle(r, '::before'); return b && b.content && b.content !== 'none' ? '伪元素::before ' + b.content + ' 色 ' + b.color : '行内'; })(),
      文本域: (() => { const t = [...scope.querySelectorAll('.el-textarea__inner')].filter(vis)[0]; return t ? { 宽: px(R(t).width), 高: px(R(t).height) } : null; })(),
      分组标题: secs.slice(0, 20),
      分组卡片数: cards.length,
      卡片样式: cards.length ? cs(cards[0], ['backgroundColor', 'borderRadius', 'padding', 'marginBottom', 'boxShadow', 'border']) : null,
      左侧锚点导航: anchorNav,
      页脚按钮: fbtns,
      页脚固定: fbtns.some(b => b.固定条) ? '固定在视口底部（长表单滚动时常驻）' : '随内容流',
      页脚按钮定位: foot ? '容器 .' + foot.className.split(' ')[0] : '按位置推断（字段区之下）',
      页脚对齐: foot ? getComputedStyle(foot).textAlign + '/' + getComputedStyle(foot).justifyContent
             : (fbtns.length ? (() => {
                 const cx = fbtns.reduce((s, b) => s + b.x, 0) / fbtns.length;
                 return cx > innerWidth * 0.4 && cx < innerWidth * 0.6 ? '居中' : (cx < innerWidth * 0.4 ? '左对齐' : '右对齐');
               })() : null)
    };
  }

  /* ── 5. 查看/详情页排版 ────────────────────────────────────────────────
     特征：有大量"只读键值对"（label + 纯文本，不是输入控件），常配内嵌明细表。 */
  function detailArea() {
    const kv = [...document.querySelectorAll('.el-descriptions-item, .detail-item, .info-item')].filter(vis);
    const ro = [...document.querySelectorAll('.el-form-item')].filter(vis)
      .filter(fi => !fi.querySelector('input:not([disabled]), textarea:not([disabled]), .el-select'));
    const units = kv.length >= 3 ? kv : ro;
    if (units.length < 3) return null;
    const xs = [];
    units.forEach(u => { const x = R(u).left; if (!xs.some(v => Math.abs(v - x) < 30)) xs.push(x); });
    const inner = [...document.querySelectorAll('.el-table, table')].filter(vis)
      .filter(t => R(t).top > (units[0] ? R(units[0]).top : 0));
    return {
      形态: kv.length >= 3 ? 'el-descriptions 描述列表' : '只读表单(el-form 禁用态)',
      键值对数: units.length, 栏数: xs.length,
      标题区: (() => { const h = [...document.querySelectorAll('.el-page-header, .detail-header, .page-title, h2')].filter(vis)[0];
        return h ? { 文案: txt(h).slice(0, 40), 高: px(R(h).height), 样式: cs(h, ['fontSize', 'fontWeight', 'color']) } : null; })(),
      内嵌明细表: inner.length ? inner.map(t => ({ 列数: t.querySelectorAll('thead th').length, 距顶: px(R(t).top) })) : null,
      /* ⚠️ 2026-11-04 修：这里原来数的是**全页所有** .el-tabs__item，于是把顶栏导航（12 个）
         和多标签页工作区（十几个）全算进了"详情页内页签数" —— 蒸馏出来是荒谬的"142 个页签"。
         和 §6 tabs() 用同一条判定：top<100 的是导航/工作区，不是页内页签。 */
      有页签: [...document.querySelectorAll('.el-tabs__item')].filter(vis).filter(t => R(t).top >= 100).length || 0
    };
  }

  /* ── 6. 状态页签（用户点名的"各类状态切换"）────────────────────────── */
  function tabs() {
    /* §2026-10-30 必须把**导航页签**排除掉。实测 OMS 顶栏导航就是 el-tabs 做的，
       不排除就会把「首页/业务费用/账户余额…」12 个导航项算成"状态页签"
       —— 第一版抽出"74 个页签"，全是导航和别的页签混在一起。
       判定：top < 100 的是导航（已归入 §1 菜单），其余才是状态页签。 */
    const items = [...document.querySelectorAll('.el-tabs__item')].filter(vis)
      .filter(t => R(t).top >= 100);
    if (!items.length) return null;
    const root = items[0].closest('.el-tabs');
    /* 同一页可能有多组页签（列表状态页签 + 详情页内页签），只取最靠上那一组 */
    const grp = items.filter(t => t.closest('.el-tabs') === root);
    return {
      页签数: grp.length, 页签组数: new Set(items.map(t => t.closest('.el-tabs'))).size,
      页签: grp.map(t => ({ 文案: txt(t).slice(0, 20), 选中: /is-active/.test(t.className),
        宽: px(R(t).width), 高: px(R(t).height) })),
      形态: root ? (/card/.test(root.className) ? '卡片式' : '下划线式') : '?',
      距顶: px(R(items[0]).top),
      位置: (() => { const lh = listHost(); if (!lh) return '页内';
        return R(items[0]).bottom <= R(lh).top + 8 ? '列表上方（状态筛选用）' : '页内'; })(),
      选中样式: cs(grp.find(t => /is-active/.test(t.className)), ['color', 'backgroundColor', 'fontWeight', 'borderBottom', 'borderTop', 'borderLeft', 'borderRight']),
      未选样式: cs(grp.find(t => !/is-active/.test(t.className)), ['color', 'backgroundColor', 'fontWeight'])
    };
  }

  /* ── 6b. 多标签页工作区 ────────────────────────────────────────────────
     §2026-10-30 截图实测发现、规范里一条都没有的结构：顶栏导航**下面还有一条
     标签条**，记录用户打开过的每个页面（箱库存 × / 商品库存 × / 新增税种管理 ×），
     每个带关闭叉、两端有滚动箭头、最右有"全部关闭"。
     这是整个系统的核心工作区范式 —— 用户可以同时开十几个页面来回切。
     第一版把它和状态页签混在一起，抽出了荒谬的"74 个页签"。*/
  function workTabs() {
    /* 收紧判定（第一版抽出 74 个，截图实际只有 11 个）：真系统把**二级菜单**也用
       el-tabs 渲染，而且悬停面板的项同样 top<100、同样"可见"。
       所以不能只按位置筛，要：① 锁定到**含 is-active 的那一个 el-tabs 容器**；
       ② 只要该容器 nav 内的项；③ 丢掉被容器 overflow 裁掉的（横向滚动区外的）。*/
    const all = [...document.querySelectorAll('.el-tabs__item')].filter(vis).filter(t => R(t).top < 100);
    if (all.length < 2) return null;
    const root = (all.find(t => /is-active/.test(t.className)) || all[0]).closest('.el-tabs');
    if (!root) return null;
    const nav = root.querySelector('.el-tabs__nav-scroll, .el-tabs__nav-wrap') || root;
    const nr = R(nav);
    const items = [...root.querySelectorAll('.el-tabs__item')].filter(vis)
      .filter(t => { const r = R(t); return r.right > nr.left - 2 && r.left < nr.right + 2; });
    if (items.length < 2) return null;
    const closable = items.filter(t => t.querySelector('.el-icon, svg, [class*=close]')).length;
    return {
      说明: '顶栏导航下方的多标签页工作区（打开过的页面都挂在这里，可来回切、可关闭）',
      标签数: items.length,
      标签: items.map(t => ({ 文案: txt(t).replace(/\\s*×\\s*$/, '').slice(0, 20), 选中: /is-active/.test(t.className),
        宽: px(R(t).width), 高: px(R(t).height) })),
      可关闭: closable + '/' + items.length,
      形态: root ? (/card/.test(root.className) ? '卡片式' : '下划线式') : '?',
      条高: root ? px(R(root.querySelector('.el-tabs__header') || root).height) : null,
      距顶: px(R(items[0]).top),
      有左右滚动箭头: !!(root && root.querySelector('[class*=prev], [class*=next]')),
      选中样式: cs(items.find(t => /is-active/.test(t.className)), ['color', 'backgroundColor', 'fontWeight', 'borderBottom', 'borderTop']),
      未选样式: cs(items.find(t => !/is-active/.test(t.className)), ['color', 'backgroundColor', 'fontWeight'])
    };
  }

  /* ── 7. 工具条按钮（文案/顺序/主次/位置）─────────────────────────────── */
  function toolbar() {
    const tbl = listHost();
    if (!tbl) return null;
    const top = R(tbl).top;
    const bs = [...document.querySelectorAll('button, .el-button')].filter(vis)
      .filter(b => R(b).top < top - 4 && !b.closest('.el-dialog') && !b.closest('.el-pagination'))
      .map(b => ({ 文案: txt(b).slice(0, 14), x: px(R(b).left), y: px(R(b).top),
        类: /primary/.test(b.className) ? '主' : (/danger/.test(b.className) ? '危' : '次'),
        禁用: b.disabled || /is-disabled/.test(b.className) }))
      .sort((a, b) => a.y - b.y || a.x - b.x);
    if (!bs.length) return null;
    const lastY = Math.max(...bs.map(b => b.y));
    /* ⚠️ 2026-11-04 补【右端图标区】——此前整块抽不到。
       工具条右端那几个**无文字的图标按钮**（刷新 ⟳ / 列配置 / 单位切换…）
       在按文案收集时全被丢掉（文案为空）。而它们正是"列表该有哪些标配"的真值。
       取法：和工具条按钮同一行、但位于页面右半边、且没有文字的可点元素；
       名字按 title/aria-label/svg 的 class 取，取不到就记形状和位置，别编。*/
    const rowY = lastY;
    const icons = [...document.querySelectorAll('i, svg, img, .el-icon, [class*=icon]')].filter(vis)
      .filter(el => { const r = R(el);
        return Math.abs(r.top + r.height / 2 - (rowY + 16)) < 40 && r.left > innerWidth * 0.5
          && r.width >= 10 && r.width <= 48 && !el.closest('.el-table') && !el.closest('.el-pagination')
          && !el.closest('.el-input') && !el.closest('.el-select'); })
      .filter((el, i, arr) => !arr.some(o => o !== el && o.contains(el)))   /* 只要最外层，避免 svg 套 i 重复 */
      .map(el => {
        const r = R(el);
        const host = el.closest('button, .el-button, [class*=btn], a') || el;
        return { 名: (host.getAttribute('title') || host.getAttribute('aria-label') ||
                      el.getAttribute('title') || el.getAttribute('aria-label') || '').slice(0, 16),
                 类名: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : String(el.className || '')).slice(0, 40),
                 x: px(r.left), 宽: px(r.width), 高: px(r.height) };
      }).sort((a, b) => a.x - b.x);
    /* 右端的分段切换组（公制/英制 这类）也在这行，单独记 */
    const rightBtns = bs.filter(b => Math.abs(b.y - lastY) < 20 && b.x > innerWidth * 0.5);
    return { 按钮数: bs.length, 按钮: bs,
      末行按钮: bs.filter(b => Math.abs(b.y - lastY) < 20).map(b => b.文案),
      右端有文字按钮: rightBtns.map(b => b.文案),
      右端图标: icons,
      右端图标数: icons.length };
  }

  const out = { url: location.href, 视口: innerWidth + 'x' + innerHeight };
  const safe = (k, f) => { try { out[k] = f(); } catch (e) { out[k] = { 抽取出错: e.message }; } };
  safe('菜单', menu); safe('多标签页工作区', workTabs); safe('筛选区', filterArea); safe('列表', listArea);
  safe('表单', formArea); safe('详情', detailArea); safe('状态页签', tabs); safe('工具条', toolbar);
  out.页型 = out.表单 ? (out.表单.形态.startsWith('弹窗') ? '弹窗表单' : '整页表单')
           : out.详情 ? '详情/查看页' : out.列表 ? '列表页' : '其它';
  return out;
})()`;

(async () => {
  const src = process.argv[2], outDir = process.argv[3];
  if (!src || !outDir) {
    console.error('用法: node layout.js <冻结件目录|单个.html> <输出目录> [--port 9222] [--redo]');
    process.exit(2);
  }
  const pi = process.argv.indexOf('--port');
  const port = pi > 0 ? process.argv[pi + 1] : 9222;
  const REDO = process.argv.includes('--redo');
  const st = fs.statSync(src);
  const files = st.isDirectory()
    ? fs.readdirSync(src).filter(f => /\.html$/i.test(f)).map(f => path.join(src, f))
    : [src];
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const cdp = await connect(port);
  let done = 0, skip = 0, fail = 0;
  const all = {};
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const name = path.basename(f, path.extname(f));
    const dst = path.join(outDir, name + '.layout.json');
    if (!REDO && fs.existsSync(dst)) {
      skip++; try { all[name] = JSON.parse(fs.readFileSync(dst, 'utf8')); } catch (_) {}
      continue;
    }
    const url = 'file:///' + f.replace(/\\/g, '/');
    try {
      await cdp.send('Page.navigate', { url });
      /* 冻结件是静态 DOM，但 12~20MB 的样式要时间解析。等到 body 有内容为止，
         而不是固定 sleep —— 固定 sleep 正是 2026-10-29 "冻结空壳"那次的坑。 */
      let ok = false;
      for (let t = 0; t < 40; t++) {
        await new Promise(r => setTimeout(r, 300));
        try {
          const n = await cdp.evalv('document.querySelectorAll("*").length');
          if (n > 400) { ok = true; break; }
        } catch (_) {}
      }
      if (!ok) throw new Error('渲染不出内容（节点 < 400）');
      await new Promise(r => setTimeout(r, 400));
      const data = await cdp.evalv(FN);
      data.来源 = path.basename(f);
      fs.writeFileSync(dst, JSON.stringify(data, null, 2), 'utf8');
      all[name] = data;
      done++;
      process.stdout.write('[' + (i + 1) + '/' + files.length + '] ' + name + ' → ' + data.页型 +
        (data.列表 ? ' 列' + data.列表.列数 : '') + (data.筛选区 ? ' 筛' + data.筛选区.控件数 : '') +
        (data.表单 ? ' 字段' + data.表单.字段数 + '/' + data.表单.列数 + '列' : '') +
        (data.状态页签 ? ' 状态页签' + data.状态页签.页签数 : '') +
        (data.多标签页工作区 ? ' 工作区标签' + data.多标签页工作区.标签数 : '') + '\n');
    } catch (e) {
      fail++;
      console.error('[' + (i + 1) + '/' + files.length + '] ✗ ' + name + ' —— ' + e.message);
    }
  }
  fs.writeFileSync(path.join(outDir, '_汇总.json'), JSON.stringify(all, null, 2), 'utf8');
  console.log('\n结构抽取完成：新抽 ' + done + ' · 跳过(已有) ' + skip + ' · 失败 ' + fail + ' → ' + outDir);
  try { cdp.close(); } catch (_) {}
  process.exit(fail && !done ? 1 : 0);
})().catch(e => { console.error('失败:', e.message); process.exit(1); });
