#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   tokens.js · 带【上下文】的真值抽取器（复刻的地基）
   ────────────────────────────────────────────────────────────────────────
   2026-10-29 建。为什么要重做一版：

     老抽法（deepcrawl 内嵌的那段）把同一类组件的值一股脑堆进一个数组，
     于是 55 份真值里有 41 处"分歧"。拆完发现没有一处是两个系统的差异，
     全是抽法自己制造的噪音，三个来源：

       ① 外层和内层混收 —— <th> 自己 padding 是 8px 0，它里面的 .cell 是 0 12px。
          两个都当"表头"收，一致率当然只有 35%。
       ② 不记上下文 —— 列表主表的表头是 #999，弹窗里内嵌表的表头是 #909399。
          这是两种场景的真实不同，不记场景就变成"对不上"。
       ③ border 拼成一串 —— 'border: 0px rgb(51,51,51)' 里宽度是 0，
          那个颜色只是继承的文字色，毫无意义；四边不同值还会拼成一长串。

     复刻要 1:1，真值就必须带着"它是哪一层、在什么场景里"。否则机器没法比，
     只能靠人肉眼看 —— 那就又回到"对个大概"。

   抽出来的每一桶 = 组件 × 层 × 上下文 × 变体，
   **同一桶内部的值必须完全一致**；不一致就把差异明细打出来，是真·待查。

   用法：
     node tokens.js <冻结件.html 或 目录> [--out <目录>] [--jobs N]
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
try { require('../_shared/qa/_tmp-sandbox'); } catch (_) {}
const { connect } = require('./_cdp');

/* ── 在页面里跑的抽取脚本 ────────────────────────────────────────────
   口径三条：
     · 组件按 Element Plus 的类名认（比按 tagName 猜准）
     · 每个组件明确标 outer / inner 两层，绝不混
     · 上下文看祖先链：弹窗 / 抽屉 / 表单 / 页签内容 / 页面主区 */
const EXTRACT = `(function(){
  var out = {};
  var vis = function(e){ var r = e.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    var s = getComputedStyle(e);
    return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };

  /* 上下文：最近的那个"场景容器"说了算（弹窗优先于表单，表单优先于页面主区） */
  var ctxOf = function(e){
    if (e.closest('.el-dialog')) return '弹窗';
    if (e.closest('.el-drawer')) return '抽屉';
    if (e.closest('.el-message-box')) return '确认框';
    var t = e.closest('.el-table') || e.closest('table');
    if (t && !t.closest('.el-date-table,.el-month-table,.el-year-table,.el-picker-panel')) {
      if (t.closest('.el-dialog')) return '弹窗内表';
      if (t.closest('.el-form')) return '表单内表';
      if (t.closest('.el-tab-pane')) return '页签内表';
      return '列表主表';
    }
    if (e.closest('.el-form')) return '表单';
    if (e.closest('.el-tab-pane')) return '页签内容';
    return '页面主区';
  };

  /* 只记真正有意义的边框：宽度为 0 的那条边，它的颜色是继承来的，记了是噪音 */
  var borderOf = function(s){
    var sides = ['Top','Right','Bottom','Left'], parts = [];
    for (var i=0;i<4;i++){
      var w = parseFloat(s['border'+sides[i]+'Width'])||0;
      var st = s['border'+sides[i]+'Style'];
      if (w > 0 && st !== 'none') parts.push(w+'px '+st+' '+s['border'+sides[i]+'Color']);
      else parts.push('无');
    }
    return (parts[0]===parts[1] && parts[1]===parts[2] && parts[2]===parts[3]) ? parts[0] : parts.join(' | ');
  };

  /* ⚠️ 宽高【不参与】样式签名 —— 列宽随内容变、行高随内容变，
     把它们算进"样式是否相同"，每个单元格都会变成一个独立取值（几百个），
     既撑爆返回值，也把真正的样式差异淹掉。宽高单独统计分布。 */
  var pick = function(e){
    var s = getComputedStyle(e);
    return { font: s.fontSize, weight: s.fontWeight, color: s.color,
      bg: s.backgroundColor, border: borderOf(s), radius: s.borderRadius,
      pad: s.padding, line: s.lineHeight };
  };

  /* 同一桶里把相同的值合并计数，不同的值全留着（那才是真·待查） */
  var put = function(bucket, e, variant){
    if (!vis(e)) return;
    var key = bucket + '｜' + ctxOf(e) + (variant ? '｜' + variant : '');
    var v = pick(e), sig = JSON.stringify(v);
    var r = e.getBoundingClientRect();
    var t = (e.textContent||'').replace(/\\s+/g,' ').trim().slice(0,14);
    out[key] = out[key] || {};
    var b = out[key][sig];
    if (!b) b = out[key][sig] = { 值: v, n: 0, 高: {}, 宽: {}, 例: [] };
    b.n++;
    var hk = String(Math.round(r.height)), wk = String(Math.round(r.width));
    b.高[hk] = (b.高[hk]||0) + 1;
    b.宽[wk] = (b.宽[wk]||0) + 1;
    if (b.例.length < 3 && t) b.例.push(t);
  };

  var all = function(sel){ return [].slice.call(document.querySelectorAll(sel)); };

  /* ── 表格 ─────────────────────────────────────────────────────────
     ⚠️ 2026-10-29 实测纠正了两个错误假设：
       ① 真系统【不是全用 Element Plus 的 el-table】—— WMS 出库订单列表是
          **手写原生表格**（.native-table-wrap / th.first-th / td.check-box-td）。
          只认 .el-table__cell 的话，这页一个表格都抽不到。
       ② 日期选择器内部也是 <table>（.el-date-table 里 91 个日期格）。
          用通用 'th,td' 抽就会把日历格当成列表数据 —— 老真值里表体一致率
          只有 4%，根子就在这儿。按那种值复刻，表格永远对不上。
     所以：先圈出【真正的数据表】，再在表内分层抽。 */
  var INNER_UI = '.el-date-table,.el-month-table,.el-year-table,.el-picker-panel,.el-time-spinner,.el-calendar';
  var dataTables = all('.el-table, table').filter(function(t){
    if (t.closest(INNER_UI)) return false;                 // 日历/时间面板里的表，不是数据表
    if (t.tagName === 'TABLE' && t.closest('.el-table')) return false;  // el-table 内部的 table，已由外层代表
    return t.querySelectorAll('th,td').length > 0;
  });
  /* ⚠️ 2026-10-29 实测：真系统【两套表格样式并存】，而且是成组出现的 ——
       原生手写表：表头 13px / 600 / #999999 / 底 #F7F8FA
       ElementPlus 表：表头 14px / 700 / #909399 / 底 #F5F7FA
     占比约 60:40。不把"这是哪套表"当成单元格的变体维度，就会报出一堆
     "字号 13px 61% vs 14px 39%" 的假分歧 —— 其实两个值都对，只是属于不同的表。 */
  dataTables.forEach(function(t){
    var kind = t.classList.contains('el-table') ? 'EP表' : '原生表';
    put('表格外框', t, kind);
    [].slice.call(t.querySelectorAll('th')).forEach(function(e){
      var r = e.getBoundingClientRect();
      var va = kind + '·' + ((!(e.textContent||'').trim() && r.width <= 60) ? '勾选列' : '普通列');
      put('表头·外层th', e, va);
      var c = e.querySelector(':scope > .cell') || e.firstElementChild;
      if (c && c.tagName === 'DIV') put('表头·内层div', c, va);
    });
    [].slice.call(t.querySelectorAll('td')).forEach(function(e){
      var r = e.getBoundingClientRect();
      var va = kind + '·' + ((!(e.textContent||'').trim() && r.width <= 60) ? '勾选列'
             : (e.colSpan > 1 ? '跨列合并格' : (r.height > 60 ? '多行聚合格' : '单行格')));
      put('表体·外层td', e, va);
      var c = e.querySelector(':scope > .cell') || e.firstElementChild;
      if (c && c.tagName === 'DIV') put('表体·内层div', c, va);
    });
    [].slice.call(t.querySelectorAll('tbody tr')).forEach(function(e){
      put('表体·行tr', e, kind + '·' + (e.getBoundingClientRect().height > 60 ? '多行' : '单行'));
    });
    [].slice.call(t.querySelectorAll('thead tr')).forEach(function(e){ put('表头·行tr', e, kind); });
  });

  /* ── 输入：有边框圆角的是 wrapper，inner 是透明的文字层 ── */
  /* ⚠️ 尺寸（Element Plus 的 small/default/large）必须进变体 —— 按钮本来就分了，
     下拉框和输入框以前漏了。后果：一个 size="small" 的下拉（高24/12px/#606266）
     会掉进"正常态"桶，被拿去跟常规 32px 下拉比，报出 5 项"值不等"的假红。
     2026-10-29 实测踩到：卡片工具区「50条/页」下拉就是这么被判红的。 */
  var sizeOf = function(e, cls){
    var box = e.closest(cls) || e;
    if (box.classList.contains(cls.slice(1) + '--small')) return '·小';
    if (box.classList.contains(cls.slice(1) + '--large')) return '·大';
    return '';
  };

  /* 分页器内的输入框/下拉框（跳页框、每页条数）是 small 尺寸，跟筛选区的常规控件
     不是一个值。混在一起会报出"下拉框高 32px vs 24px"这种假差异，还会误导规范修正。 */
  all('.el-input__wrapper').forEach(function(e){
    var inp = e.querySelector('input'), va;
    if (e.closest('.el-pagination')) va = '分页器内';
    else if (inp && (inp.disabled || inp.readOnly)) va = '禁用只读';
    else if (e.closest('.el-date-editor')) va = '日期控件内层';
    /* 组合输入框（带前缀下拉/后缀单位）的圆角是"只圆一边"，跟独立输入框不是一个值 ——
       不分开就会报出 "圆角 0px 44% vs 4px 41% vs 0px 4px 4px 0px 15%" 这种假分歧 */
    else if (e.closest('.el-input-group')) {
      var g = e.closest('.el-input-group');
      va = g.classList.contains('el-input-group--prepend') ? '组合框·右半'
         : g.classList.contains('el-input-group--append') ? '组合框·左半' : '组合框';
    }
    else va = '独立·正常态';
    va += sizeOf(e, '.el-input');
    put('输入框·wrapper', e, va);
    if (inp) put('输入框·inner', inp, va);
  });
  all('.el-date-editor').forEach(function(e){ put('日期控件·外层', e, e.className.indexOf('range')>=0 ? '范围' : '单日'); });
  all('.el-select__wrapper').forEach(function(e){
    var va = e.closest('.el-pagination') ? '分页器内'
      : e.classList.contains('is-disabled') ? '禁用' : '正常态';
    put('下拉框·wrapper', e, va + sizeOf(e, '.el-select'));
  });
  all('.el-textarea__inner').forEach(function(e){ put('文本域', e, '正常态'); });

  /* ── 按钮：主/次/文字/危险，按类名分，不按颜色猜 ── */
  all('.el-button').forEach(function(e){
    if (e.closest('.el-pagination')) { put('分页按钮', e, ''); return; }
    var c = e.classList, va;
    if (c.contains('is-link') || c.contains('is-text') || c.contains('el-button--text')) va = '文字型';
    else if (c.contains('el-button--primary')) va = '主钮实心';
    else if (c.contains('el-button--danger')) va = '危险钮';
    else if (c.contains('el-button--success')) va = '成功钮';
    else va = '次钮白底';
    var sz = c.contains('el-button--small') ? '·小' : (c.contains('el-button--large') ? '·大' : '');
    put('按钮', e, va + sz);
  });

  /* ── 弹窗 / 表单 / 页签 / 分页 ── */
  all('.el-dialog').forEach(function(e){ put('弹窗容器', e, ''); });
  all('.el-dialog__header').forEach(function(e){ put('弹窗头', e, ''); });
  all('.el-dialog__title').forEach(function(e){ put('弹窗标题', e, ''); });
  all('.el-dialog__body').forEach(function(e){ put('弹窗体', e, ''); });
  all('.el-dialog__footer').forEach(function(e){ put('弹窗脚', e, ''); });
  all('.el-form-item__label').forEach(function(e){
    put('表单标签', e, e.closest('.el-form--label-top') ? 'label在上' : 'label在左');
  });
  all('.el-form-item').forEach(function(e){ put('表单字段行', e, e.closest('.el-form--label-top') ? 'label在上' : 'label在左'); });
  /* 页签有两种：顶部整页页签（卡片式灰底）和内容区页签（线条式）—— 样式不同，分开收 */
  all('.el-tabs__item').forEach(function(e){
    var box = e.closest('.el-tabs');
    var kind = (box && (box.classList.contains('el-tabs--card') || box.classList.contains('el-tabs--border-card'))) ? '卡片式' : '线条式';
    put('页签', e, kind + '·' + (e.classList.contains('is-active') ? '选中' : '未选中'));
  });
  all('.el-pagination').forEach(function(e){ put('分页条', e, ''); });
  /* 勾选框选中时底色是主色、未选中是白底 —— 不分态就是一半一半的假分歧 */
  all('.el-checkbox__inner').forEach(function(e){
    var w = e.closest('.el-checkbox') || e.parentElement;
    var st = (w && w.classList.contains('is-checked')) ? '选中'
           : (w && w.classList.contains('is-indeterminate')) ? '半选' : '未选中';
    put('勾选框', e, st);
  });
  all('.el-table__header-wrapper, .el-table__body-wrapper').forEach(function(e){
    put('表格区', e, e.className.indexOf('header')>=0 ? '表头区' : '表体区');
  });

  return JSON.stringify(out);
})()`;

let ASK = null;
async function one(file, outDir, port) {
  const c = await connect(port);
  try {
    await c.send('Page.enable');
    /* 支持直接给线上 URL（不只是本地冻结件）—— 真系统上查一个值时，
       没必要先冻结整页 20MB 再抽，那要几分钟 */
    const url = /^https?:\/\//i.test(file) ? file : ('file:///' + file.replace(/\\/g, '/'));
    await c.send('Page.navigate', { url }, 180000);
    /* 等 DOM 稳定。⚠️ 对【线上 SPA】不能只等"连续两次元素数不变"——
       等接口返回时元素数会暂时不变，被误判成加载完，抽到的是空壳
       （freeze.js 踩过：冻出 878 个元素的空页面）。线上页至少等满 6 秒 + 连续 5 次不变；
       本地冻结件是静态的，沿用快判定即可。 */
    const live = /^https?:/i.test(url);
    const minI = live ? 12 : 0, needStable = live ? 5 : 2;
    let last = -1, stable = 0;
    for (let i = 0; i < (live ? 80 : 40); i++) {
      await new Promise(z => setTimeout(z, 500));
      let n = 0; try { n = await c.evalv('document.querySelectorAll("*").length'); } catch (_) {}
      if (n > 100 && n === last) { if (++stable >= needStable && i >= minI) break; } else stable = 0;
      last = n;
    }
    /* 现场诊断口：选择器对不上冻结件时，不用另写脚本，直接问页面
       （抽取器永远会遇到"这个系统的类名不一样"，所以这个口是常备的，不是临时的） */
    if (ASK) {
      console.log('【' + path.basename(file) + '】' + String(await c.evalv(ASK)).slice(0, 3000));
      return true;
    }
    const raw = await c.evalv(EXTRACT);
    if (!raw) {
      /* 返回空时把现场打出来 —— 不然只能靠猜，又要另写诊断脚本 */
      const n = await c.evalv('document.querySelectorAll("*").length');
      const rs = await c.evalv('document.readyState');
      const th = await c.evalv('document.querySelectorAll(".el-table th.el-table__cell").length');
      const lg = (c.logs() || []).slice(0, 3).join(' ; ');
      throw new Error('抽取返回空 · 元素 ' + n + ' · readyState=' + rs + ' · 表头 ' + th + (lg ? ' · 页面报错: ' + lg : ''));
    }
    /* 产物命名：本地文件用文件名；线上 URL 用【路径全段】拼，不能只取最后一段 ——
       不同模块常有同名页（/a/list 和 /b/list），只取 basename 会互相覆盖。 */
    const name = /^https?:/i.test(file)
      ? (file.replace(/^https?:\/\//, '').replace(/[\/:?#&=]+/g, '_').replace(/_+$/, '').slice(0, 120))
      : path.basename(file, '.html');
    const dst = path.join(outDir, name + '.ctx.json');
    fs.writeFileSync(dst, JSON.stringify(JSON.parse(raw), null, 1), 'utf8');
    const buckets = Object.keys(JSON.parse(raw)).length;
    console.log('  ✓ ' + name + ' · ' + buckets + ' 桶');
    return true;
  } finally { try { c.close(); } catch (_) {} }
}

(async () => {
  const target = process.argv[2];
  if (!target) { console.error('用法: node tokens.js <冻结件.html|目录> [--out 目录] [--jobs N]'); process.exit(2); }
  const ai = f => { const i = process.argv.indexOf(f); return i > 0 ? process.argv[i + 1] : null; };
  const shard = ai('--shard');          // 内部用：i/n
  const isUrl = /^https?:\/\//i.test(target);
  /* --urls <routes.json>：吃 routes.js 导出的路由清单，一次把整个系统的列表页抽完。
     为什么要有：靠点菜单只能发现一小部分页面 —— 实测 某 WMS 路由表里有 121 个列表页，
     而我之前点菜单只抓到 11 个（6%）。路由表才是"系统的全部页面清单"。 */
  const urlsFile = ai('--urls');
  let files;
  if (urlsFile) {
    const j = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
    const only = ai('--mod');                       // 只抽某个模块，如 --mod outWarehouse
    let ps = j.候选列表页 || [];
    if (only) ps = ps.filter(p => p.split('/')[1] === only);
    files = ps.map(p => j.origin.replace(/\/$/, '') + p);
    console.log('路由清单 ' + files.length + ' 个页面' + (only ? '（模块 ' + only + '）' : '') + ' ← ' + urlsFile);
  } else {
    const st = isUrl ? null : fs.statSync(target);
    files = (st && st.isDirectory())
      ? fs.readdirSync(target).filter(f => f.endsWith('.html')).map(f => path.join(target, f))
      : [target];
  }
  const outDir = ai('--out') || (isUrl || urlsFile ? process.cwd() : path.dirname(target));
  /* 断点续跑：已经抽过的页面默认跳过。
     ⚠️ 2026-10-30 实测必须有：182 页全量要跑近一小时，中途一旦被打断
     （会话重连、Chrome 崩、机器休眠），重来一遍就是白烧一小时。
     `--redo` 可强制重抽。 */
  const REDO = process.argv.includes('--redo');
  if (!REDO && (urlsFile || (fs.existsSync(outDir) && fs.statSync(outDir).isDirectory()))) {
    const before = files.length;
    files = files.filter(f => {
      const nm = /^https?:/i.test(f)
        ? f.replace(/^https?:\/\//, '').replace(/[\/:?#&=]+/g, '_').replace(/_+$/, '').slice(0, 120)
        : path.basename(f, '.html');
      return !fs.existsSync(path.join(outDir, nm + '.ctx.json'));
    });
    if (before !== files.length) console.log('  断点续跑：跳过已抽的 ' + (before - files.length) + ' 个，还剩 ' + files.length + ' 个（要重抽加 --redo）');
  }
  if (!files.length) { console.log('✅ 全部已抽完，没有要做的'); process.exit(0); }
  const jobs = Math.max(1, +(ai('--jobs') || (files.length > 3 ? 4 : 1)));
  /* --ask 的表达式可以写成 @<文件> —— PowerShell 传长 JS 会把引号吃掉（踩过两次），
     写进文件最稳 */
  ASK = ai('--ask');
  if (ASK && ASK[0] === '@') ASK = fs.readFileSync(ASK.slice(1), 'utf8');

  if (!shard && jobs > 1 && files.length > 1) {
    console.log(files.length + ' 个冻结件 · ' + jobs + ' 进程并行重抽');
    const t0 = Date.now();
    const rs = await Promise.all(Array.from({ length: jobs }, (_, i) => new Promise(res => {
      const p = spawn(process.execPath, [__filename, target, '--out', outDir, '--shard', i + '/' + jobs, '--port', String(9820 + i * 2)],
        { stdio: 'inherit' });
      p.on('exit', code => res(code === 0));
    })));
    const ok = rs.every(Boolean);
    console.log((ok ? '✅' : '⚠️') + ' 重抽完成 · ' + ((Date.now() - t0) / 1000).toFixed(1) + 's → ' + outDir);
    process.exit(ok ? 0 : 1);
  }

  let list = files;
  if (shard) { const [i, n] = shard.split('/').map(Number); list = files.filter((_, k) => k % n === i); }
  const port = +(ai('--port') || 9820);
  let bad = 0;
  for (const f of list) {
    try { await one(f, outDir, port); }
    catch (e) { bad++; console.error('  ✗ ' + path.basename(f) + ' · ' + e.message); }
  }
  process.exit(bad ? 1 : 0);
})().catch(e => { console.error('抽取失败:', e.message); process.exit(1); });
