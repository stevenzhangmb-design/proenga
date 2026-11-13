#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   deepcrawl.js · 深层页面穷举抓取（1:1 复刻的真正大头）
   ────────────────────────────────────────────────────────────────────────
   2026-10-28 建。为什么必须有这个工具：
     列表页只是门面。真正决定「复刻得像不像」的是**点开之后**的东西——
     新增 / 编辑 / 查看详情 / 删除确认 / 导入 / 导出 / 批量操作 / 打印……
     以前靠我一条条敲命令去点，既漏又慢，而且换个系统就得重来。
     这个工具把「发现入口 → 逐个点开 → 冻结 + 抽真值 → 退回来」做成可复跑的流程。

   它做四件事：
     ① 发现入口：工具条按钮、行操作图标/链接、状态页签、分页器之外的一切可点元素
     ② 逐个点开：点之前记下 URL 和弹窗数，点之后看变化，判断这一下打开了什么
     ③ 每个新界面都【冻结 + 抽真值】：冻结走分片取回（整份一次吐会把调试连接撑断）
     ④ 自动退回来：Esc 关弹窗 / 浏览器后退 / 点取消，保证能继续点下一个

   ⚠️ 真系统只看不提交：默认【跳过】提交/保存/删除/确认这类会改真数据的按钮，
      只打开界面就抓，抓完立刻退。要抓确认弹窗本身，用 --allow-confirm（仍不点最终确认）。

   用法：
     node deepcrawl.js <port> <输出目录> <页面名前缀> [--allow-confirm] [--max N]

   例：
     node deepcrawl.js 9611 "E:\\真值" WMS-出库订单
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { connect } = require('./_cdp');
const sleep = ms => new Promise(z => setTimeout(z, ms));

/* 会改真数据的按钮——默认一律不点 */
const DANGER = /^(提交|保存|确定|确认|删除|移除|发货|强制发货|取消订单|作废|审核|通过|驳回|出库|入库|确认收货|结算|支付|submit|save|confirm|delete)$/i;
/* 纯噪音，点了没意义 */
const NOISE = /^(查询|重置|搜索|刷新|立即刷新|上一页|下一页|首页|末页|\d+|«|»|<|>)$/;

/* 发现当前页所有值得点的入口 */
const FIND = `(function(){
  var out=[];
  var push=function(el,kind){
    var r=el.getBoundingClientRect();
    if(r.width<6||r.height<6) return;
    if(r.top<0||r.left<0) return;
    var t=(el.textContent||'').replace(/\\s+/g,'').slice(0,16);
    var title=el.getAttribute('title')||el.getAttribute('aria-label')||'';
    out.push({kind:kind,text:t||title,x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)});
  };
  [].slice.call(document.querySelectorAll('button,.el-button')).forEach(function(e){push(e,'toolbar')});
  /* ⚠️ 2026-10-30 补【状态页签】——此前整类缺失。
     报告里的入口类型只有 toolbar / rowAction / rowOpen，一个 tab 都没有，
     可真系统每个列表页上方都有「全部 / 待出库 / 已发货 / 已取消」这排状态页签，
     **切过去之后列、筛选条件、工具条按钮都可能变**。不抓等于整维度空白。
     只收【列表上方】那一组（top<100 的是顶栏导航和多标签页工作区，不是状态页签）。*/
  var tabs=[].slice.call(document.querySelectorAll('.el-tabs__item')).filter(function(e){
    var r=e.getBoundingClientRect();
    return r.width>0&&r.height>0&&r.top>=100&&r.top<520&&!/is-active/.test(e.className);});
  tabs.slice(0,12).forEach(function(e){push(e,'statusTab')});
  var tb=[].slice.call(document.querySelectorAll('table')).filter(function(e){return e.querySelectorAll('tbody tr').length})[0];
  if(tb){
    var rows=[].slice.call(tb.querySelectorAll('tbody tr')).filter(function(r){return r.querySelectorAll('td').length>3});
    if(rows.length){
      var tds=rows[0].querySelectorAll('td');
      /* ⚠️ 2026-10-28 实测：行操作常常是**纯 SVG 图标按钮**（WMS 用 .icon-button，20x20，没有任何文字）。
         只认「有文字的元素」会把行操作全部漏掉 —— 第一次跑就是这样，9 个入口里一个行操作都没有。
         所以这里按【可点容器】收，不要求有文字；名字取 title/aria-label，再没有就用序号兜底。 */
      [tds[tds.length-1]].forEach(function(c){ if(!c) return;
        [].slice.call(c.querySelectorAll('.icon-button,.el-tooltip,a,button,.el-button,[class*=icon-btn],[class*=option]')).forEach(function(e,i){
          var r=e.getBoundingClientRect(); if(r.width<10||r.width>160) return;
          var nm=(e.textContent||'').replace(/\\s+/g,'')||e.getAttribute('title')||e.getAttribute('aria-label')||('图标'+(i+1));
          var rr=e.getBoundingClientRect();
          out.push({kind:'rowAction',text:nm.slice(0,16),x:Math.round(rr.left+rr.width/2),y:Math.round(rr.top+rr.height/2)});
        });
      });
      [].slice.call(rows[0].querySelectorAll('a')).forEach(function(e){push(e,'rowLink')});
      /* 单据号那一格通常可点进详情。
         ⚠️ 2026-10-30 收紧：原来只看"文字长度>6"，于是把聚合格里的**纯展示文本**
         也当成了功能入口——像「邮箱：--姓名：--部门：--」这种根本不可点，
         点了当然没反应，却被记成"疑似漏抓"，把覆盖率数字做成了假的（59 个里一多半是这类）。
         现在要求**真的可点**：是 <a>，或 computed cursor 是 pointer。 */
      if(tds[1]) [].slice.call(tds[1].querySelectorAll('span,a,div')).slice(0,4).forEach(function(e){
        var t=(e.textContent||'').trim();
        if(t.length<=6) return;
        var clickable = e.tagName==='A' || getComputedStyle(e).cursor==='pointer';
        if(clickable) push(e,'rowOpen');});
      /* ⚠️ 2026-10-29 补：**行内展开器**（真系统多品混合订单的「剩余N个商品 ∨ / 收起 ∧」）。
         以前收不到它，两个原因：① 它在商品信息那一格、不在单据号格；
         ② 文字「剩余1个商品」正好 6 个字，被上面那个 length>6 的条件挡掉。
         （注：本段在模板字符串里，注释别用反引号，会提前终止模板串）
         这类交互【不开新界面】，漏收就等于整块交互没抓到 —— 按语义收，不按长度。 */
      /* 扫【整张表】不是只扫第一行：多品混合订单可能在第 N 行，只看首行会整类漏掉 */
      var tb0=rows[0].closest('table')||document;
      [].slice.call(tb0.querySelectorAll('span,a,div,button')).forEach(function(e){
        var t=(e.textContent||'').trim();
        if(t.length>14) return;
        if(/^(剩余\\d+个商品|收起|展开|更多|查看全部)/.test(t)) push(e,'inlineToggle');
      });
    }
  }
  /* 去重：按【类型+文字】，**不带坐标**。
     §2026-10-29 修：原来 key 里带 x/y，于是同一个「SKU编号:xxx」出现在不同数据行
     （y 不同）就被当成两个入口，白点一遍 —— 实测 78 个入口里有 5 个是这么来的。
     抓取的目的是覆盖【每一种功能】，不是每一行；同名同类的入口点一个就够。 */
  var seen={},uniq=[];
  out.forEach(function(o){var k=o.kind+'|'+o.text; if(!seen[k]){seen[k]=1;uniq.push(o)}});
  return JSON.stringify(uniq);
})()`;

/* 当前界面指纹：URL + 弹窗数 + 弹窗标题 + 可见输入框数 */
const STATE = `(function(){
  var dlgs=[].slice.call(document.querySelectorAll('.el-dialog,.el-drawer,.el-message-box')).filter(function(e){
    return e.getBoundingClientRect().width>0;});
  var titles=dlgs.map(function(e){
    var t=e.querySelector('.el-dialog__title,.el-drawer__title,.el-message-box__title');
    return t?(t.textContent||'').split(/\\s+/).join('').slice(0,20):'';}).filter(Boolean);
  /* ⚠️ 2026-10-29 实测补：很多工具条按钮打开的是**下拉菜单**（WMS 的「导出」弹出
     「按勾选导出 / 按筛选导出」），既不是弹窗也不换 URL。只看弹窗/URL/输入框，
     会把它们全判成「点了没反应」—— 当时 6 个入口里有 4 个是被这样误判的。 */
  var pops=[].slice.call(document.querySelectorAll('.el-popper,.el-dropdown-menu,.el-select-dropdown'))
    .filter(function(e){var r=e.getBoundingClientRect(); return r.width>0&&r.height>0;});
  /* ⚠️ 别在这里写 \\s —— 模板字符串再转义一层会变成无效正则，整个 STATE 求值失败，
     表现是「下拉明明开着却读不到」（2026-10-29 为此白改了三轮）。用字符类代替。 */
  var popTexts=pops.map(function(e){return (e.textContent||'').split(/\\s+/).join('').slice(0,40)}).filter(Boolean);
  /* ⚠️ 2026-10-29 再补一类：**行内就地变化**。真系统列表里有两种交互既不开弹窗、
     不换 URL、也不弹下拉 —— ① 多品混合订单的「剩余N个商品 ∨ / 收起 ∧」行内展开；
     ② 商品缩略图 hover 弹出的大图预览浮层。只看 弹窗/URL/下拉/输入框，
     它们会被判成「点了没反应」（当时 13 个"疑似漏抓"里就有这类）。
     用【元素总数】和【可见图片数】当信号：行内展开会多出节点，图片浮层会多出 img。 */
  var imgs=[].slice.call(document.querySelectorAll('img')).filter(function(e){
    var r=e.getBoundingClientRect(); return r.width>20&&r.height>20;}).length;
  /* ⚠️ 2026-10-30 补：**切状态页签**既不换 URL、不开弹窗、不弹下拉，节点数也常常
     只差几个（同样 20 行数据）—— 用上面那些信号全判成"点了没反应"。
     切页签真正会变的是：选中的是哪个页签、表头列、首行内容。用这三个当信号。 */
  var act=document.querySelector('.el-tabs__item.is-active');
  var ths=[].slice.call(document.querySelectorAll('thead th')).filter(function(e){
    return e.getBoundingClientRect().width>0;});
  var r1=document.querySelector('tbody tr');
  return JSON.stringify({url:location.pathname, dlg:dlgs.length, titles:titles,
    pop:pops.length, popTexts:popTexts, nodes:document.querySelectorAll('*').length, imgs:imgs,
    tab:act?(act.textContent||'').trim().slice(0,20):'',
    cols:ths.length, colNames:ths.map(function(e){return (e.textContent||'').trim().slice(0,12)}).join('|').slice(0,200),
    row1:r1?(r1.textContent||'').replace(/\\s+/g,'').slice(0,60):'',
    inputs:document.querySelectorAll('input:not([type=hidden])').length});
})()`;

/* 分片取回整页（一次吐几 MB 会把调试连接撑断 —— 2026-10-28 实测） */
/* §2026-10-29 样式走 CDP 取（能读到跨域样式表，页面侧 cssRules 读不到会被静默跳过）。
   每页都重取一次会慢，所以首页取一次缓存：同一系统同一轮抓取，样式表是同一份。
   ⚠️ 注：这不是"冻结件 border 失真"的原因（实测该系统跨域表 = 0，CSS 并没有丢），
   真因未查清，详见 freeze.js 同处注释。 */
let _cssCache = null;
async function freezeChunked(c, outFile) {
  if (_cssCache === null) {
    _cssCache = "";
    /* ⚠️ 取【原始 CSS 文本】，绝不用 cssRules 的 cssText 重建 —— 后者对
       `border: var(--el-border)` 这类【简写 + 变量】会序列化成值为空的子属性
       （`border-top-style: ;`），重新解析时被丢弃，冻结件里那条样式就没了，
       而且不报错。实测：同一条 .el-button 规则，原文 31 条声明 / cssText 重建只剩 18 条，
       按钮 border 从 `1px solid` 变成 UA 默认 `2px outset`。
       危害覆盖所有 var() 简写：margin/padding/font/background/transition/flex…
       详见 freeze.js 同处注释。 */
    try {
      const n = await c.evalv(`(async function(){
        var parts = [], miss = 0;
        var els = [].slice.call(document.querySelectorAll('style, link[rel="stylesheet"]'));
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (el.tagName === 'STYLE') { parts.push(el.textContent || ''); continue; }
          try { var r = await fetch(el.href); parts.push('/* ' + el.href + ' */\\n' + (await r.text())); }
          catch (e) { miss++; }
        }
        window.__frzCss = parts.join('\\n'); window.__frzMiss = miss;
        return window.__frzCss.length;
      })()`, true);
      if (n > 0) {
        const CH0 = 262144;
        for (let i = 0; i < Math.ceil(n / CH0); i++) _cssCache += (await c.evalv('window.__frzCss.substr(' + (i * CH0) + ',' + CH0 + ')') || '');
        const miss = await c.evalv('window.__frzMiss');
        console.log('  样式原文 ' + Math.round(_cssCache.length / 1024) + ' KB' + (miss ? '（' + miss + ' 份取不到）' : '（未经 CSSOM 转写）'));
      }
    } catch (_) {}
  }
  /* ⚠️ CSS 留在 node 侧拼，别塞进 eval 表达式 —— 19MB 的样式会让 Runtime.evaluate
     直接抛 Uncaught（2026-10-29 实测）。页面只负责吐 DOM。 */
  if (!_cssCache) {
    /* 原始样式一份都没取到：这种情况下 cssText 重建会【静默产出失真样式】
       （var() 简写被转写成空值声明后丢弃），宁可明确报警也不要坏数据。 */
    console.log('  ⚠ 取不到样式原文 —— 本页冻结件只有 DOM，样式类真值不可用');
  }
  const total = await c.evalv(`(function(){
    window.__frz = document.body.innerHTML;
    return window.__frz.length;})()`);
  if (!total) return 0;
  const CH = 262144, parts = Math.ceil(total / CH);
  let html = '';
  let body = '';
  for (let i = 0; i < parts; i++) body += (await c.evalv('window.__frz.substr(' + (i * CH) + ',' + CH + ')') || '');
  await c.evalv('(function(){try{delete window.__frz}catch(e){}return 1})()');
  const origin = await c.evalv('location.origin');
  html = '<!doctype html><html><head><meta charset="utf-8"><base href="' + origin + '">' +
         '<style>' + (_cssCache || '') + '</style></head><body>' + body + '</body></html>';
  fs.writeFileSync(outFile, html, 'utf8');
  return html.length;
}

/* 抽这一屏所有组件的 computed 样式（1:1 复刻靠的就是这些数） */
const TOKENS = `(function(){
  var pick=function(sel,n){
    var out=[];
    [].slice.call(document.querySelectorAll(sel)).slice(0,n||3).forEach(function(e){
      var r=e.getBoundingClientRect(); if(r.width<1) return;
      var s=getComputedStyle(e);
      out.push({t:(e.textContent||'').replace(/\\s+/g,'').slice(0,12),
        w:Math.round(r.width),h:Math.round(r.height),
        font:s.fontSize,weight:s.fontWeight,color:s.color,bg:s.backgroundColor,
        border:s.borderWidth+' '+s.borderColor,radius:s.borderRadius,pad:s.padding,line:s.lineHeight});
    });
    return out;
  };
  return JSON.stringify({
    dialogTitle:pick('.el-dialog__title,.el-drawer__title',2),
    dialog:pick('.el-dialog,.el-drawer',2),
    formLabel:pick('.el-form-item__label',6),
    input:pick('.el-input__wrapper',6),
    select:pick('.el-select__wrapper',4),
    btnPrimary:pick('.el-button--primary',4),
    btnDefault:pick('.el-button:not(.el-button--primary)',4),
    th:pick('.el-table__header th .cell,table th',6),
    td:pick('.el-table__body td .cell,table tbody td',6),
    tab:pick('.el-tabs__item',6)
  });})()`;

(async () => {
  const a = process.argv.slice(2);
  const port = +(a[0] || 9222);
  const outDir = a[1];
  let prefix = a[2] || 'page';
  const allowConfirm = a.includes('--allow-confirm');
  const maxI = a.indexOf('--max');
  const MAX = maxI > 0 ? +a[maxI + 1] : 999;
  /* --urls <routes.json> [--mod <模块>]：按路由清单【逐页】深抓，一次跑完整个模块。
     §2026-10-30 加：原来一次只抓"当前页"，41 个页面就要人工 41 轮导航，
     而且每轮都要重连 Chrome。现在一条命令跑完，连接复用。
     断点续跑：该页已有抓取报告就跳过（深抓一页要几分钟，中断重来代价大）。 */
  const ui = a.indexOf('--urls');
  const urlsFile = ui > 0 ? a[ui + 1] : null;
  const mi = a.indexOf('--mod');
  const onlyMod = mi > 0 ? a[mi + 1] : null;
  if (!outDir) { console.error('用法: node deepcrawl.js <port> <输出目录> <前缀> [--urls routes.json [--mod 模块]] [--allow-confirm] [--max N]'); process.exit(2); }
  fs.mkdirSync(outDir, { recursive: true });

  let targets = [null];          // null = 抓当前页（老用法）
  if (urlsFile) {
    const j = JSON.parse(fs.readFileSync(urlsFile, 'utf8'));
    let ps = j.候选列表页 || [];
    if (onlyMod) ps = ps.filter(p => p.split('/')[1] === onlyMod);
    targets = ps.map(p => ({ url: j.origin.replace(/\/$/, '') + p, name: p.replace(/^\//, '').replace(/\//g, '-') }));
    const before = targets.length;
    targets = targets.filter(t => !fs.existsSync(path.join(outDir, prefix + '-' + t.name + '-深层抓取报告.json')));
    console.log('路由清单 ' + before + ' 页' + (onlyMod ? '（模块 ' + onlyMod + '）' : '') +
                (before !== targets.length ? ' · 断点续跑跳过已抓 ' + (before - targets.length) : '') +
                ' → 本次抓 ' + targets.length + ' 页');
    if (!targets.length) { console.log('✅ 都抓过了'); process.exit(0); }
  }

  /* §2026-10-30 留个"我在抓"的标记：RPA 抓取会长时间占满浏览器，
     这期间若有人跑交付总闸，闸会被拖慢好几倍（实测 260 秒 → 1855 秒），
     而闸那边**完全看不出原因**，只会以为闸自己变慢了或者机器有问题。
     标记让闸能在开头说清楚"现在有 RPA 在抓，慢是正常的"。 */
  const BUSY = path.join(require('os').homedir(), '.proenga-rpa-busy');
  try {
    fs.writeFileSync(BUSY, JSON.stringify({
      pid: process.pid, 开始: new Date().toISOString(),
      任务: 'deepcrawl ' + (onlyMod ? '模块 ' + onlyMod : '') + ' → ' + path.basename(outDir)
    }), 'utf8');
    const clean = () => { try { const j = JSON.parse(fs.readFileSync(BUSY, 'utf8')); if (j.pid === process.pid) fs.unlinkSync(BUSY); } catch (_) {} };
    process.on('exit', clean);
    for (const sig of ['SIGINT', 'SIGTERM', 'SIGBREAK']) { try { process.once(sig, () => { clean(); process.exit(130); }); } catch (_) {} }
  } catch (_) {}

  const c = await connect(port);
  const basePrefix = prefix;
  let pageIdx = 0;
  for (const tgt of targets) {
  if (tgt) {
    pageIdx++;
    prefix = basePrefix + '-' + tgt.name;
    console.log('\n──── [' + pageIdx + '/' + targets.length + '] ' + tgt.url + ' ────');
    try { await c.send('Page.navigate', { url: tgt.url }, 120000); } catch (e) { console.log('  导航失败：' + e.message); continue; }
  }
  try {
    try { await c.send('Page.bringToFront'); } catch (_) {}
    /* ⚠️ 2026-10-29 补：开抓前必须等页面真的渲染完。
       deepcrawl 原来假设"调用方已经把页面打开好了"，但 SPA 列表页从导航到数据回来要好几秒，
       早一步开抓的结果是 **「发现可点入口 0 个 / 这页没有勾选框」** —— 整页白抓，而且不报错。
       判定和 freeze.js 一致：至少等满 6 秒，且元素数连续 5 次（2.5 秒）不变。 */
    {
      let last = -1, stable = 0;
      for (let i = 0; i < 80; i++) {
        await sleep(500);
        let n = 0; try { n = await c.evalv('document.querySelectorAll("*").length'); } catch (_) {}
        if (n > 200 && n === last) stable++; else stable = 0;
        last = n;
        if (i >= 12 && stable >= 5) break;
      }
      console.log('  页面就绪（' + last + ' 个元素）');
    }
    /* ⚠️ 2026-10-28 实测：工具条上「标记/导出/打印」这类按钮**必须先勾选一行**才会有反应，
       不勾就点，界面一动不动 —— 第一次跑 2 个入口全是「点了没反应」，就是这个原因。
       所以开抓前先勾上第一行（只勾选，不提交任何操作）。 */
    /* ⚠️ 再一条实测（2026-10-28）：Element Plus 的勾选框，原生 input 是 **0×0 隐藏**的，
       点它完全没用；真正能点的是 .el-checkbox__inner（14×14）。而且它**不在** .el-table__body
       容器里，按容器找一个都找不到（第一次跑返回 no-checkbox 就是这个原因）。
       所以：收集所有可见的 __inner，取表头以下的第一个，**按真实坐标点**。 */
    const pickPos = JSON.parse(await c.evalv(`(function(){
      var ins=[].slice.call(document.querySelectorAll('.el-checkbox__inner')).map(function(e){
        var r=e.getBoundingClientRect();
        return {x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2),w:Math.round(r.width)};
      }).filter(function(p){return p.w>=10&&p.y>260;});
      return JSON.stringify(ins[0]||null);})()`) || 'null');
    if (pickPos) {
      await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: pickPos.x, y: pickPos.y, button: 'left', clickCount: 1 });
      await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: pickPos.x, y: pickPos.y, button: 'left', clickCount: 1 });
      await sleep(1000);
      const n = await c.evalv(`(function(){var m=(document.body.innerText||'').match(/已选[：:]\\s*(\\d+)/);return m?m[1]:'?';})()`);
      console.log('  先勾选首行：已选 ' + n + ' 条');
    } else console.log('  先勾选首行：这页没有勾选框');
    await sleep(600);

    const base = JSON.parse(await c.evalv(STATE));
    const entries = JSON.parse(await c.evalv(FIND) || '[]');
    const todo = entries.filter(e => e.text && !NOISE.test(e.text) && (allowConfirm || !DANGER.test(e.text)));
    console.log('发现可点入口 ' + entries.length + ' 个，实际抓 ' + Math.min(todo.length, MAX) + ' 个');
    console.log('  跳过（会改真数据/无意义）: ' + entries.filter(e => !todo.includes(e)).map(e => e.text).join(' ') || '  无');

    const report = [];
    for (let i = 0; i < Math.min(todo.length, MAX); i++) {
      const e = todo[i];
      const name = (prefix + '-' + String(i + 1).padStart(2, '0') + '-' + e.text).replace(/[\\/:*?"<>|]/g, '_');
      /* ⚠️ 2026-10-28 第三条实测：勾选状态在每次操作后会被清掉，而且页面上常有**多个表格**，
         按坐标取「第一个可见勾选框」可能勾到别的表（当时提示「请先选择要强制发货的出库订单」
         「请选择数据」—— 明明显示已选 50 条，点按钮却说没选）。
         所以：每点一个按钮之前，都重新勾一次【主数据表】的首行。
         主表的认法：包含最多数据行的那张表，比「第一个可见」靠谱。 */
      const re = JSON.parse(await c.evalv(`(function(){
        var tbs=[].slice.call(document.querySelectorAll('table')).map(function(t){
          return {t:t,n:[].slice.call(t.querySelectorAll('tbody tr')).filter(function(r){return r.querySelectorAll('td').length>3}).length};
        }).filter(function(o){return o.n>0;}).sort(function(a,b){return b.n-a.n;});
        if(!tbs.length) return 'null';
        var inner=tbs[0].t.querySelector('tbody .el-checkbox__inner');
        if(!inner) return 'null';
        var r=inner.getBoundingClientRect();
        return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)});})()`) || 'null');
      if (re) {
        await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: re.x, y: re.y, button: 'left', clickCount: 1 });
        await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: re.x, y: re.y, button: 'left', clickCount: 1 });
        await sleep(700);
      }
      /* ⚠️ 2026-10-30 根治「后面的入口全废」：**每个入口点击前先复位到干净的列表页**。
         事故现场：OMS 商品管理第 2 个入口「停用」打开了商品选择弹窗，节点从 2322 暴涨到 8191，
         此后行的位置全变了，后面 5 个入口（查看/编辑/打印标签/链接）**全部误报"点了没反应"**，
         等于白跑——而且报告看不出是脏状态造成的，会被当成"这些功能真的没反应"。
         判据：节点数比初始基准偏离超过 25% 就重新导航。只在批量模式（知道本页 URL）下做。 */
      if (tgt) {
        const cur = JSON.parse(await c.evalv(STATE));
        const drift = Math.abs((cur.nodes || 0) - (base.nodes || 0)) / Math.max(1, base.nodes || 1);
        if (drift > 0.25 || cur.url !== base.url) {
          console.log('     （页面已偏离初始态 ' + Math.round(drift * 100) + '%，重新导航复位）');
          try {
            await c.send('Page.navigate', { url: tgt.url }, 120000);
            let last = -1, stable = 0;
            for (let k = 0; k < 60; k++) {
              await sleep(500);
              let n = 0; try { n = await c.evalv('document.querySelectorAll("*").length'); } catch (_) {}
              if (n > 200 && n === last) stable++; else stable = 0;
              last = n;
              if (k >= 10 && stable >= 4) break;
            }
          } catch (_) {}
        }
      }
      /* ⚠️ 2026-10-29：基准状态必须【每次点击前重读】，不能用循环外读的那一份。
         前面的入口可能已经把页面改了（进过详情再退回、勾过选、展开过某行），
         拿过期基准比"节点数有没有变多"，行内展开这类交互就会被判成「点了没反应」。 */
      const before = JSON.parse(await c.evalv(STATE));
      /* 注：这里【不做按文字重定位】。试过，得不偿失 ——
         行操作那些入口的名字是序号兜底的「图标1/图标2」（它们本来就没有文字），
         按文字找永远找不到，于是被误判成"入口已消失"，比用原坐标更糟。
         入口坐标是同一轮 FIND 刚量的，页面没翻页就仍然有效。 */
      const px = e.x, py = e.y;

      /* ⚠️ 2026-10-30：行操作图标【先 hover 取 tooltip 真名】。
         这些图标没有文字、没有 title，FIND 只能按序号叫它们「图标1/图标2」——
         于是报告里全是"图标2 → 没反应"，既看不出点的是什么功能，
         也**没法判断它是不是危险操作**（删除/作废混在里面照点不误）。
         实测 hover 450ms 后 tooltip 就给出真名：查看 / 编辑 / 打印标签。
         取到名字后要重新过一遍危险名单——否则"图标2"其实是「删除」就闯祸了。 */
      let rx = px, ry = py;
      if (e.kind === 'rowAction' && /^图标\d+$/.test(e.text)) {
        try {
          /* ⚠️ 行操作图标必须【按结构位置重新定位】：前面的入口可能进过详情页再退回、
             开过弹窗、勾过选，行的位置早就变了，FIND 当时量的坐标会点空
             （表现就是"图标2 → 没反应"，而它其实是「编辑」）。
             按【操作列的第 N 个图标】找，不按文字找——这些图标本来就没有文字。 */
          const idx = +(/^图标(\d+)$/.exec(e.text)[1]) - 1;
          const np = JSON.parse(await c.evalv(`(function(){
            var tbs=[].slice.call(document.querySelectorAll('table,.el-table')).filter(function(t){
              return !t.closest('.el-date-table,.el-picker-panel') && t.querySelectorAll('tbody tr').length>0;})
              .sort(function(a,b){return b.querySelectorAll('tbody tr').length-a.querySelectorAll('tbody tr').length;});
            if(!tbs.length) return 'null';
            var row=tbs[0].querySelector('tbody tr'); if(!row) return 'null';
            var tds=[].slice.call(row.querySelectorAll('td')); var last=tds[tds.length-1]; if(!last) return 'null';
            var ic=[].slice.call(last.querySelectorAll('.icon-button,.el-tooltip,a,button,.el-button'))
              .filter(function(x){var r=x.getBoundingClientRect();return r.width>=10&&r.width<=160;});
            var el=ic[${idx}]; if(!el) return 'null';
            var r=el.getBoundingClientRect();
            return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)});})()`) || 'null');
          if (np) { rx = np.x; ry = np.y; }
          await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rx, y: ry });
          await sleep(500);
          const tip = await c.evalv(`(function(){
            var ps=[].slice.call(document.querySelectorAll('.el-popper[role=tooltip],.el-tooltip__popper'))
              .filter(function(p){var r=p.getBoundingClientRect();return r.width>0&&r.height>0;})
              .map(function(p){return (p.textContent||'').trim();}).filter(Boolean);
            return ps[0]||'';})()`);
          if (tip && tip.length <= 12) {
            console.log('     （' + e.text + ' 的 tooltip 真名：' + tip + '）');
            e.text = tip;
            if (!allowConfirm && DANGER.test(tip)) {
              report.push({ text: tip, kind: e.kind, result: '跳过（危险操作·真系统只看不提交）' });
              console.log('  [' + (i + 1) + '] ' + tip + ' → 跳过（危险操作）');
              continue;
            }
          }
        } catch (_) {}
      }
      await c.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: rx, y: ry });
      await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: rx, y: ry, button: 'left', clickCount: 1 });
      await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rx, y: ry, button: 'left', clickCount: 1 });
      /* ⚠️ 下拉菜单很"娇气"：等太久、或中间做了别的鼠标动作，它自己就收了。
         所以先快读一次状态（抓下拉），再等长一点读第二次（抓弹窗/跳转），两次取其一。 */
      await sleep(700);
      const quick = JSON.parse(await c.evalv(STATE));
      let now = quick, frozenEarly = 0;
      if (quick.pop > before.pop) {
        /* 下拉开着的这一刻就冻，晚了它自己就收了，抓到的会是收起后的页面 */
        frozenEarly = await freezeChunked(c, path.join(outDir, name + '.html'));
        const tk = await c.evalv(TOKENS);
        fs.writeFileSync(path.join(outDir, name + '.tokens.json'), tk || '{}', 'utf8');
      } else {
        await sleep(1900);
        now = JSON.parse(await c.evalv(STATE));
      }
      /* 行内就地变化也算「有反应」：节点数明显【变化】= 行内展开或收起；
         大图数变化 = hover 预览浮层出现/消失。
         ⚠️ 必须取【绝对值】，不能只认"增多"：同一个 toggle 第二次点是【收起】，
         节点是减少的，只认增多就会把收起判成「点了没反应」（2026-10-29 实测踩到）。
         阈值 8 个节点，避开动画/计时器造成的微小抖动。 */
      const dNodes = Math.abs((now.nodes || 0) - (before.nodes || 0));
      const inlineGrew = dNodes > 8 || (now.imgs || 0) !== (before.imgs || 0);
      /* ⚠️ 2026-10-30：切状态页签的「有反应」要单独认。
         切「全部 → 已发货」常常节点数只差两三个（同样 20 行），上面所有信号都不动，
         于是整类被判成"点了没反应"。真正变的是：选中页签、表头列、首行内容。 */
      const tabSwitched = (now.tab || '') !== (before.tab || '')
                       || (now.colNames || '') !== (before.colNames || '')
                       || (now.row1 || '') !== (before.row1 || '');
      const opened = now.dlg > before.dlg || now.url !== before.url || now.inputs > before.inputs + 1
                  || now.pop > before.pop   /* 下拉菜单也算「打开了东西」 */
                  || inlineGrew             /* 行内展开 / 图片浮层 */
                  || (e.kind === 'statusTab' && tabSwitched);
      if (!opened) {
        /* 「点了没反应」常常不是真没反应，而是弹了条提示（如「请先选择数据」）。
           把提示记下来，问题才会自己说话，不用我一个个手动复现。 */
        const tip = await c.evalv(`(function(){
          var m=[].slice.call(document.querySelectorAll('.el-message,.el-message__content,.el-notification__content'))
            .map(function(x){return (x.textContent||'').trim()}).filter(Boolean);
          return m.slice(0,2).join(' / ');})()`);
        /* 「清空/重置/刷新」这类**按设计就不开新界面**，记成"点了没反应"是误导——
           会让人以为功能坏了，还把覆盖率分母撑大。如实写明。 */
        const byDesign = /^(清空|重置|刷新|全选|反选|收起|展开|排序)$/.test(String(e.text || '').trim());
        const res = tip ? ('提示：' + tip) : (byDesign ? '按设计不开新界面' : '点了没反应');
        report.push({ text: e.text, kind: e.kind, result: res });
        console.log('  [' + (i + 1) + '] ' + e.text + ' → ' + (tip ? '提示：' + tip : (byDesign ? '按设计不开界面' : '没反应')));
        continue;
      }

      const kb = frozenEarly || await freezeChunked(c, path.join(outDir, name + '.html'));
      if (!frozenEarly) {
        const tok = await c.evalv(TOKENS);
        fs.writeFileSync(path.join(outDir, name + '.tokens.json'), tok || '{}', 'utf8');
      }
      const what = (e.kind === 'statusTab' && tabSwitched)
        ? ('切到页签「' + (now.tab || e.text) + '」' +
           (now.cols !== before.cols ? '·列 ' + before.cols + '→' + now.cols : '·列不变(' + now.cols + ')') +
           ((now.colNames || '') !== (before.colNames || '') ? '·列名有变' : ''))
        : now.titles[0]
        || (now.pop > before.pop ? ('下拉：' + (now.popTexts[0] || ''))
        : (now.url !== before.url ? now.url
        : (inlineGrew ? ('行内展开/收起（节点 ' + (before.nodes || 0) + '→' + (now.nodes || 0) +
                         (now.imgs !== before.imgs ? '·图 ' + before.imgs + '→' + now.imgs : '') + '）')
        : now.url)));
      report.push({ text: e.text, kind: e.kind, result: what, kb: Math.round(kb / 1024) });
      console.log('  [' + (i + 1) + '/' + Math.min(todo.length, MAX) + '] ' + e.text + ' → ' + what + ' (' + Math.round(kb / 1024) + 'KB)');

      /* 退回来：Esc → 点取消/关闭 → 浏览器后退，三道保险 */
      await c.send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await c.send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
      await sleep(600);
      /* 下拉菜单 Esc 不一定收得掉，点一下页面空白处把它关了，免得挡住下一个入口 */
      await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 8, y: 300, button: 'left', clickCount: 1 });
      await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 8, y: 300, button: 'left', clickCount: 1 });
      await sleep(700);
      let st = JSON.parse(await c.evalv(STATE));
      /* ⚠️ 2026-10-28 第四条实测：关弹窗用 DOM 的 .click() **不生效**（Element Plus 的关闭钮
         和取消钮都要真实鼠标事件）。当时后果很具体：【标记】弹窗没关掉，后面 4 个入口
         全都在同一个弹窗上重复冻结，报告里 4 行标题一模一样、字节数一模一样。
         所以改成：拿到关闭钮/取消钮的**真实坐标**，用硬件级点击关，最多试 3 轮。 */
      for (let k = 0; k < 3 && st.dlg > base.dlg; k++) {
        const closePos = JSON.parse(await c.evalv(`(function(){
          var d=[].slice.call(document.querySelectorAll('.el-dialog,.el-drawer,.el-message-box'))
            .filter(function(e){return e.getBoundingClientRect().width>0}).pop();
          if(!d) return 'null';
          var btn=d.querySelector('.el-dialog__headerbtn,.el-drawer__close-btn');
          if(!btn){ btn=[].slice.call(d.querySelectorAll('button,.el-button')).filter(function(b){
            return /^(取消|关闭|返回|cancel|close)$/i.test((b.textContent||'').replace(/\\s+/g,''))})[0]; }
          if(!btn) return 'null';
          var r=btn.getBoundingClientRect();
          return JSON.stringify({x:Math.round(r.left+r.width/2),y:Math.round(r.top+r.height/2)});})()`) || 'null');
        if (!closePos) break;
        await c.send('Input.dispatchMouseEvent', { type: 'mousePressed', x: closePos.x, y: closePos.y, button: 'left', clickCount: 1 });
        await c.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: closePos.x, y: closePos.y, button: 'left', clickCount: 1 });
        await sleep(1100);
        st = JSON.parse(await c.evalv(STATE));
      }
      if (st.dlg > base.dlg) { console.log('     ⚠️ 弹窗关不掉，跳过后续入口以免重复抓同一个'); break; }
      if (st.url !== base.url) { await c.evalv('(function(){history.back();return 1})()'); await sleep(2200); }
    }

    fs.writeFileSync(path.join(outDir, prefix + '-深层抓取报告.json'), JSON.stringify(report, null, 2), 'utf8');
    const ok = report.filter(r => r.result !== '点了没反应').length;
    console.log('完成：' + ok + ' 个界面已冻结+抽真值，' + (report.length - ok) + ' 个点了没反应');
  } catch (e) {
    /* 批量模式下，一页出错不能把整批带崩 —— 记下来继续下一页 */
    console.log('  ⚠ 本页抓取出错：' + e.message);
    if (!tgt) throw e;
  }
  }   // for targets
  try { c.close(); } catch (_) {}
  if (targets.length > 1) console.log('\n════ 批量深抓结束 · ' + targets.length + ' 页 · 产物在 ' + outDir + ' ════');
})().catch(e => { console.error('深层抓取失败:', e.message); process.exit(1); });
