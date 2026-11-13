#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   specdiff.js · 汇总真值 → 判定「共同标准 / 系统差异 / 桶内不纯」
   ────────────────────────────────────────────────────────────────────────
   2026-10-29 建。吃 tokens.js 产出的 .ctx.json（带上下文的真值）。

   为什么不能像 distill.js 那样简单取众数：
     取众数只会给出"权威值 + 一致率 50%"，而 50% 可能是三种完全不同的意思 ——
       (a) 两个系统真的做得不一样 → 要人来定以谁为准
       (b) 我把实心钮和文字钮算成了一类 → 我自己的采样问题
       (c) 我把日历格当成了表格数据 → 我的选择器写错了（真发生过）
     这三种混在一个数字里，人就只能"对个大概"。那不叫 1:1。

   所以这里只做一件事：把每个【组件×上下文×变体】的桶，按系统摆开，逐属性比，
   然后落到三类结论之一 ——
     ✅ 共同标准   两系统同值、各自桶内也纯 → 直接写进默认规范
     ⚖️ 系统差异   各自桶内都纯、但彼此不同 → **只有这些需要人拍板**
     🔍 桶内不纯   同一系统桶内还有分歧 → 是我的变体没拆够，附上例子文本供继续拆

   用法：
     node specdiff.js <真值目录(.ctx.json)> [--md 输出.md] [--json 输出.json]
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const PN = { font: '字号', weight: '字重', color: '文字色', bg: '背景', border: '边框', radius: '圆角', pad: '内边距', line: '行高' };
const PROPS = Object.keys(PN);
/* 这些是【容器】：它们的高 = 里面有多少行内容，跟设计规范无关。
   不排掉就会报出「表格外框 12690px vs 15554px」这种假差异（2026-10-29 实测踩到）。 */
const H_MEANINGLESS = /^(表格外框|表格区|弹窗容器|弹窗体|分页条|表单字段行)$/;

const dir = process.argv[2];
if (!dir) { console.error('用法: node specdiff.js <真值目录> [--md 输出.md] [--json 输出.json]'); process.exit(2); }
const ai = f => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };

const files = fs.readdirSync(dir).filter(f => f.endsWith('.ctx.json'));
if (!files.length) { console.error('目录里没有 .ctx.json（先跑 tokens.js 抽真值）'); process.exit(1); }

/* 系统标识：旧产物用 `WMS-xxx` / `OMS-xxx` 前缀；新产物（tokens.js 抽线上 URL）用
   host 开头，如 `www.example-wms.com_outWarehouse_...` / `oms.example-wms.com_...`。
   ⚠️ 2026-10-30 踩到：原来写死 /^WMS/ 匹配，`www.wms-demo...` 匹配不上被整批丢弃
   （33 个 WMS 页面全没进统计，报告却只说"WMS 0 份"，差点当成抓取失败去查）。
   现在按 host 的首段认系统，不写死任何系统名。 */
function sysOf(fn) {
  const m = /^(WMS|OMS)[-_]/i.exec(fn);
  if (m) return m[1].toUpperCase();
  const head = fn.split('_')[0] || '';
  if (/^[\w.-]+\.[a-z]{2,}/i.test(head)) {          // 是个域名
    const parts = head.split('.');
    const sub = parts[0].toLowerCase();
    return (sub === 'www' || sub === 'web') ? (parts[1] || head).toUpperCase() : sub.toUpperCase();
  }
  return '其他';
}

/* 内部仍用两个槽（A/B）做两两比较，但【槽名不等于系统名】——
   系统名从文件名认出来（可能是 WMS / OMS，也可能是别的系统），
   取样本最多的两个占槽，显示时用真实名。这样换任何一对系统都不用改代码。 */
const _cnt = {};
files.forEach(fn => { const s = sysOf(fn); _cnt[s] = (_cnt[s] || 0) + 1; });
const SYSN = Object.keys(_cnt).sort((a, b) => _cnt[b] - _cnt[a]).slice(0, 2);
const SLOT = {}; SYSN.forEach((n, i) => { SLOT[n] = i === 0 ? 'WMS' : 'OMS'; });
const LABEL = { WMS: SYSN[0] || 'A', OMS: SYSN[1] || 'B' };

/* 桶key → 槽 → 样式签名 → { 值, n, 高分布, 例子, 出处 } */
const bag = {};
const seen = { WMS: 0, OMS: 0 };
files.forEach(fn => {
  let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, fn), 'utf8')); } catch (_) { return; }
  const sys = SLOT[sysOf(fn)];
  if (!sys) return;                       // 第三个及以后的系统不参与两两比较
  seen[sys]++;
  const src = fn.replace('.ctx.json', '');
  Object.keys(j).forEach(bk => {
    bag[bk] = bag[bk] || {};
    bag[bk][sys] = bag[bk][sys] || {};
    Object.keys(j[bk]).forEach(sig => {
      const it = j[bk][sig];
      const b = bag[bk][sys][sig] || (bag[bk][sys][sig] = { 值: it.值, n: 0, 高: {}, 例: [], 出处: [] });
      b.n += it.n || 1;
      Object.keys(it.高 || {}).forEach(h => { b.高[h] = (b.高[h] || 0) + it.高[h]; });
      (it.例 || []).forEach(t => { if (b.例.length < 4 && b.例.indexOf(t) < 0) b.例.push(t); });
      if (b.出处.length < 3) b.出处.push(src);
    });
  });
});

/* 桶内主值 + 纯度 */
function main(m) {
  if (!m) return null;
  const es = Object.entries(m).sort((a, b) => b[1].n - a[1].n);
  const total = es.reduce((s, e) => s + e[1].n, 0);
  const topH = Object.entries(es[0][1].高 || {}).sort((a, b) => b[1] - a[1])[0];
  return {
    值: es[0][1].值, n: es[0][1].n, 总: total,
    纯度: Math.round(es[0][1].n / total * 100),
    高: topH ? +topH[0] : null,
    例: es[0][1].例,
    其他: es.slice(1, 4).map(e => ({ 值: e[1].值, n: e[1].n, 例: e[1].例, 出处: e[1].出处 }))
  };
}

const rows = [];
Object.keys(bag).sort().forEach(bk => {
  const [组件, 上下文, 变体] = bk.split('｜');
  const W = main(bag[bk].WMS), O = main(bag[bk].OMS);
  const r = { 桶: bk, 组件, 上下文, 变体: 变体 || '', WMS: W, OMS: O };
  const cmpH = !H_MEANINGLESS.test(组件);
  const pureW = !W || W.纯度 === 100, pureO = !O || O.纯度 === 100;
  if (!pureW || !pureO) r.结论 = '桶内不纯';
  else if (W && O) {
    const d = PROPS.filter(p => W.值[p] !== O.值[p]);
    if (cmpH && W.高 !== O.高) d.push('高');
    r.差异属性 = d;
    r.结论 = d.length ? '系统差异' : '共同标准';
  } else r.结论 = '单边有值';

  /* 真系统自己混用：把两个系统的样本合起来看某个属性有几种取值。
     ⚠️ 这跟"系统差异"是两回事，也是最容易误判的一类 ——
     同一个属性在 A 桶里 WMS=#333/OMS=#444、在 B 桶里反过来，那根本不是
     "WMS 和 OMS 不一样"，而是**真系统自己两种值都在用**。
     要拍板的其实是这个：复刻时统一成哪个，还是照抄这种不一致。 */
  const allSig = Object.assign({}, bag[bk].WMS || {}, bag[bk].OMS || {});
  const merged = {};
  ['WMS', 'OMS'].forEach(s => Object.keys(bag[bk][s] || {}).forEach(sig => {
    const it = bag[bk][s][sig];
    const m = merged[sig] || (merged[sig] = { 值: it.值, n: 0, 例: [], 出处: [] });
    m.n += it.n;
    it.例.forEach(t => { if (m.例.length < 3 && m.例.indexOf(t) < 0) m.例.push(t); });
    it.出处.forEach(o => { if (m.出处.length < 4 && m.出处.indexOf(o) < 0) m.出处.push(o); });
  }));
  void allSig;
  const es = Object.values(merged).sort((a, b) => b.n - a.n);
  const tot = es.reduce((s, e) => s + e.n, 0);
  r.混用 = PROPS.filter(p => new Set(es.map(e => e.值[p])).size > 1).map(p => ({
    属性: PN[p] || p,
    取值: [...new Map(es.map(e => [e.值[p], 0])).keys()].map(val => {
      const hit = es.filter(e => e.值[p] === val);
      return { 值: val, 占比: Math.round(hit.reduce((s, e) => s + e.n, 0) / tot * 100),
               例: hit[0].例.slice(0, 2), 出处: hit[0].出处.slice(0, 3) };
    }).sort((a, b) => b.占比 - a.占比)
  }));
  rows.push(r);
});

const ORD = { '系统差异': 0, '桶内不纯': 1, '单边有值': 2, '共同标准': 3 };
rows.sort((a, b) => (ORD[a.结论] - ORD[b.结论]) || a.桶.localeCompare(b.桶));
const cnt = k => rows.filter(r => r.结论 === k).length;

console.log('样本：' + LABEL.WMS + ' ' + seen.WMS + ' 份 · ' + LABEL.OMS + ' ' + seen.OMS + ' 份 · 桶 ' + rows.length + ' 个');
console.log('⚖️ 系统差异（要拍板）' + cnt('系统差异') + ' · 🔍 桶内不纯（我继续拆）' + cnt('桶内不纯') +
            ' · ✅ 共同标准 ' + cnt('共同标准') + ' · 单边有值 ' + cnt('单边有值'));

/* --page-matrix "<组件关键字>｜<属性中文名>"：按【页面】列出该属性的取值。
   为什么要有：报告说"13px 占 61%、14px 占 39%"没法拍板 —— 人要知道的是
   **哪些模块用哪套**，才能说"以 XX 那套为准"。这是复刻时的必备视图。 */
const pm = ai('--page-matrix');
if (pm) {
  /* 最后一段是属性名，前面全部当桶关键字（桶 key 自己就含 ｜，不能简单二分） */
  const seg = pm.split('｜');
  const propCn = seg.pop();
  const compKey = seg.join('｜');
  const prop = PROPS.find(p => PN[p] === propCn) || propCn;
  if (!PN[prop]) { console.error('属性名要是：' + Object.values(PN).join('/')); process.exit(2); }
  const byVal = {};
  files.forEach(fn => {
    let j; try { j = JSON.parse(fs.readFileSync(path.join(dir, fn), 'utf8')); } catch (_) { return; }
    const src = fn.replace('.ctx.json', '');
    Object.keys(j).filter(bk => bk.indexOf(compKey) >= 0).forEach(bk => {
      const es = Object.values(j[bk]).sort((a, b) => b.n - a.n);
      if (!es.length) return;
      const val = es[0].值[prop];
      byVal[val] = byVal[val] || new Set();
      byVal[val].add(src);
    });
  });
  console.log('\n【' + compKey + ' 的 ' + propCn + '】按页面归属：');
  Object.entries(byVal).sort((a, b) => b[1].size - a[1].size).forEach(([val, set]) => {
    const l = [...set].sort();
    console.log('\n  ' + val + '  → ' + l.length + ' 个页面');
    console.log('    ' + l.join('、'));
  });
  process.exit(0);
}

/* --baseline <out.json>：输出【复刻目标值】。这是复刻的唯一真理源：
   fidelity-verify.js 拿它逐值卡复刻件，不靠肉眼看。

   结构上每个属性给两样东西：
     · 主值 = 占比最高的取值 → 复刻时照它做
     · 容许 = 真系统这个桶【出现过的全部取值】 → 验收时落在任一个上都算过
   为什么必须记"全部"而不是"主值 + 前 3 个"：
     2026-10-29 实测，只记前 3 个的基线把 55 个真系统页面里的 46 个判成了红 ——
     **基线把真系统自己判成不合格，那它就是错的**，拿它去卡复刻件只会制造假红。 */
const bl = ai('--baseline');
if (bl) {
  const o = { 来源: dir, 生成: new Date().toISOString().slice(0, 10), 样本: seen, 基线: {} };
  rows.forEach(r => {
    const x = r.WMS || r.OMS;
    if (!x) return;
    const cmpH = !H_MEANINGLESS.test(r.组件);
    /* 把两个系统该桶的所有签名摊开，逐属性收齐出现过的取值（按出现次数排序） */
    const cnt = {};
    ['WMS', 'OMS'].forEach(s => Object.keys(bag[r.桶][s] || {}).forEach(sig => {
      const it = bag[r.桶][s][sig];
      PROPS.forEach(p => {
        cnt[p] = cnt[p] || {};
        cnt[p][it.值[p]] = (cnt[p][it.值[p]] || 0) + it.n;
      });
      if (cmpH) {
        cnt.h = cnt.h || {};
        Object.keys(it.高 || {}).forEach(h => { cnt.h[h + 'px'] = (cnt.h[h + 'px'] || 0) + it.高[h]; });
      }
    }));
    const 容许 = {}, 主值 = {};
    Object.keys(cnt).forEach(p => {
      const es = Object.entries(cnt[p]).sort((a, b) => b[1] - a[1]);
      容许[p] = es.map(e => e[0]);
      主值[p] = es[0][0];
    });
    const e = { 组件: r.组件, 场景: r.上下文, 变体: r.变体, 主值, 容许, 纯度: x.纯度, 样本: x.总 };
    /* ⚠️ 标出【UA 默认值】—— `2px outset` / `inset` 是 <button> 等元素的浏览器默认边框，
       CSS 作者几乎不会这么写，所以它多半不是真系统的设计值。
       2026-10-29 实测：同一个「查询」按钮，**活页面上是 `1px solid`，冻结件里渲染成
       `2px outset`** —— 说明从冻结件抽出来的 border 类值不可信。
       ⚠️ 真因尚未查清：已排除「CSS 丢失」（冻结件 38980 条规则、`--el-border` 等变量
       全部正常解析、EP 的 `.el-button` 基础规则也在）和「跨域样式表被跳过」（该系统跨域表 = 0）。
       在查清并重抓之前，这些值【不能拿去判复刻件红】—— 拿脏基线判红只会让人
       去改本来正确的复刻件。 */
    const ua = Object.keys(主值).filter(p => /\b(outset|inset)\b/.test(String(主值[p])));
    if (ua.length) e.可疑_UA默认值 = ua.map(p => PN[p] || p);
    if (r.结论 === '系统差异') { e.WMS主值 = r.WMS.值; e.OMS主值 = r.OMS.值; e.注 = '两系统此桶取值不同'; }
    o.基线[r.桶] = e;
  });
  fs.writeFileSync(bl, JSON.stringify(o, null, 1), 'utf8');
  console.log('→ 复刻基线 ' + Object.keys(o.基线).length + ' 桶 → ' + bl);
}

const jo = ai('--json');
if (jo) { fs.writeFileSync(jo, JSON.stringify({ 样本: seen, 明细: rows }, null, 1), 'utf8'); console.log('→ ' + jo); }

const mo = ai('--md');
if (mo) {
  const v = (x, p) => x ? (p === '高' ? (x.高 != null ? x.高 + 'px' : '—') : x.值[p]) : '—';
  let md = '# 真值汇总（组件 × 上下文 × 变体）\n\n> 来源：' + dir + '\n> 样本：WMS ' + seen.WMS + ' 份 · OMS ' + seen.OMS + ' 份真实界面\n' +
    '> 每个桶 = 一个组件在一个场景下的一个变体。桶内取值不一致，就是变体还没拆够，不是系统差异。\n\n';

  /* ⚠️ 外层/内层同属性冲突 —— 必须主动喊出来，这个坑 2026-10-29 已被踩第二次。
     真系统 el-table 表头：外层 th 的 font-size 是 13px，内层 .cell 又覆盖回 14px。
     文字在内层渲染，所以【用户看到的是内层的值】；只看外层就会得出"规范写错了"
     这种错结论，然后去改一个本来正确的规范（历史上真发生过，还被改回去过一次）。
     光写进文档防不住（文档没人每次都读），所以让报告自己把冲突列在最前面。 */
  const layerWarn = [];
  rows.forEach(r => {
    const m = /^(.+?)·外层/.exec(r.组件);
    if (!m) return;
    const inner = rows.find(x => x.组件.indexOf(m[1] + '·内层') === 0 && x.上下文 === r.上下文 && x.变体 === r.变体);
    if (!inner) return;
    const a = (r.WMS || r.OMS), b = (inner.WMS || inner.OMS);
    if (!a || !b) return;
    PROPS.forEach(p => {
      if (a.值[p] != null && b.值[p] != null && a.值[p] !== b.值[p] && p !== 'bg' && p !== 'border' && p !== 'pad' && p !== 'radius') {
        layerWarn.push({ 组件: m[1], 场景: r.上下文, 变体: r.变体, 属性: PN[p], 外层: a.值[p], 内层: b.值[p] });
      }
    });
  });
  if (layerWarn.length) {
    md += '## ⚠️ 先看这个：外层和内层的同一属性不一样（' + layerWarn.length + ' 处）\n\n' +
      '**文字在内层渲染，所以用户看到的是「内层」那一列的值。** 拿实测值跟设计规范对照时，\n' +
      '务必确认规范写的是哪一层 —— 只看外层会得出"规范写错了"的错结论，然后去改一个本来正确的规范。\n' +
      '（2026-10-29 实测：el-table 表头外层 `th` 是 13px、内层 `.cell` 覆盖回 14px，各 199 样本纯度 100%。这个坑已被踩过两次。）\n\n' +
      '| 组件 | 场景 | 变体 | 属性 | 外层 | 内层（← 用户看到的）|\n|---|---|---|---|---|---|\n';
    layerWarn.forEach(w => { md += '| ' + w.组件 + ' | ' + w.场景 + ' | ' + (w.变体 || '-') + ' | ' + w.属性 +
      ' | `' + w.外层 + '` | **`' + w.内层 + '`** |\n'; });
    md += '\n';
  }

  /* 真系统自己混用 —— 这才是人要拍板的：复刻时统一成哪个？
     只列视觉上看得出来的属性，且少数派占比 ≥3%（1% 那种是个别页面的特例，不值得拿去烦人） */
  const VISIBLE = new Set(['文字色', '字号', '字重', '背景', '圆角']);
  const mix = [];
  rows.forEach(r => (r.混用 || []).forEach(m => {
    if (!VISIBLE.has(m.属性)) return;
    const minor = m.取值[m.取值.length - 1];
    if (!minor || minor.占比 < 3) return;
    mix.push({ 组件: r.组件, 上下文: r.上下文, 变体: r.变体, 属性: m.属性, 取值: m.取值 });
  }));
  md += '## 🎯 真系统自己混用两种值 —— 要你定统一成哪个（' + mix.length + ' 项）\n\n' +
    '不是 WMS 和 OMS 的区别，是**同一套系统里两种值都在用**（多半是不同时期做的页面）。\n' +
    '复刻时要么统一成一个，要么照抄这种不一致。按出现占比排序，占比高的是主流值。\n\n' +
    '| 组件 | 场景 | 变体 | 属性 | 取值（占比） | 出处举例 |\n|---|---|---|---|---|---|\n';
  mix.sort((a, b) => b.取值[1].占比 - a.取值[1].占比).forEach(m => {
    md += '| ' + m.组件 + ' | ' + m.上下文 + ' | ' + (m.变体 || '-') + ' | ' + m.属性 + ' | ' +
      m.取值.map(v => '`' + v.值 + '` ' + v.占比 + '%').join(' vs ') + ' | ' +
      (m.取值[1].出处[0] || '-') + ' |\n';
  });
  md += '\n';

  const sysDiff = rows.filter(r => r.结论 === '系统差异');
  md += '## ⚖️ 系统差异 —— 要你拍板的就这些（' + sysDiff.length + ' 个桶）\n\n';
  md += sysDiff.length ? '两系统**各自桶内 100% 一致**，但彼此不同。机器无权替你选。\n\n' : '（没有。两个系统这些组件取值完全相同。）\n\n';
  sysDiff.forEach(r => {
    md += '### ' + r.组件 + ' · ' + r.上下文 + (r.变体 ? ' · ' + r.变体 : '') + '\n\n';
    md += '| 属性 | WMS | OMS |\n|---|---|---|\n';
    r.差异属性.forEach(p => { md += '| ' + (PN[p] || p) + ' | `' + v(r.WMS, p) + '` | `' + v(r.OMS, p) + '` |\n'; });
    const ex = [].concat(r.WMS ? r.WMS.例 : [], r.OMS ? r.OMS.例 : []).filter(Boolean).slice(0, 4);
    if (ex.length) md += '\n例：' + ex.map(x => '「' + x + '」').join('、') + '\n';
    md += '\n';
  });

  const dirty = rows.filter(r => r.结论 === '桶内不纯');
  md += '## 🔍 桶内不纯 —— 我的变体还没拆够（' + dirty.length + ' 个桶）\n\n不用你管。下面列出每桶里的其它取值和例子文本，供继续拆。\n\n';
  dirty.forEach(r => {
    md += '- **' + r.组件 + ' · ' + r.上下文 + (r.变体 ? ' · ' + r.变体 : '') + '**：';
    ['WMS', 'OMS'].forEach(s => {
      const x = r[s]; if (!x) return;
      md += s + ' 纯度 ' + x.纯度 + '%（主 ' + x.n + '/' + x.总 + '）';
      if (x.其他.length) md += '，另有 ' + x.其他.map(o => {
        const d = PROPS.filter(p => o.值[p] !== x.值[p]).map(p => (PN[p] || p) + '=' + o.值[p]);
        return '〔' + (d.join(' ') || '同样式') + (o.例.length ? ' 例「' + o.例[0] + '」' : '') + '〕×' + o.n;
      }).join('、');
      md += '；';
    });
    md += '\n';
  });

  md += '\n## ✅ 共同标准 —— 直接写进默认规范（' + cnt('共同标准') + ' 个桶）\n\n';
  md += '| 组件 | 场景 | 变体 | 高 | 字号/字重 | 文字色 | 背景 | 边框 | 圆角 | 内边距 | 行高 |\n|---|---|---|---|---|---|---|---|---|---|---|\n';
  rows.filter(r => r.结论 === '共同标准').forEach(r => {
    const x = r.WMS;
    md += '| ' + r.组件 + ' | ' + r.上下文 + ' | ' + (r.变体 || '-') + ' | ' + (x.高 != null ? x.高 : '-') +
      ' | ' + x.值.font + '/' + x.值.weight + ' | `' + x.值.color + '` | `' + x.值.bg + '` | `' + x.值.border +
      '` | ' + x.值.radius + ' | ' + x.值.pad + ' | ' + x.值.line + ' |\n';
  });

  const one = rows.filter(r => r.结论 === '单边有值');
  if (one.length) {
    md += '\n## · 单边有值 —— 只有一个系统采到（' + one.length + ' 个桶）\n\n不构成差异：要么另一边没这个变体，要么我还没抓到那一页。\n\n';
    md += '| 组件 | 场景 | 变体 | 哪边 | 高 | 字号 | 文字色 | 背景 |\n|---|---|---|---|---|---|---|---|\n';
    one.forEach(r => {
      const s = r.WMS ? 'WMS' : 'OMS', x = r.WMS || r.OMS;
      md += '| ' + r.组件 + ' | ' + r.上下文 + ' | ' + (r.变体 || '-') + ' | ' + s + ' | ' + (x.高 != null ? x.高 : '-') +
        ' | ' + x.值.font + ' | `' + x.值.color + '` | `' + x.值.bg + '` |\n';
    });
  }
  fs.writeFileSync(mo, md, 'utf8');
  console.log('→ ' + mo);
}
