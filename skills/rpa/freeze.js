#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   freeze.js · 像素级冻结抓取 —— 把【真系统当前页面】冻成任意浏览器双击就开的通用单 .html
   零依赖(Chrome 内置 CDP 快照 + 本地 mhtml2html·无 npm 包·无 AGPL·可打包上 GitHub)。
   ────────────────────────────────────────────────────────────────────────
   为什么像素级：它冻的是 Chrome 渲染完的【真实 DOM + 全部资源】，不是重画。断网也自洽。
   ────────────────────────────────────────────────────────────────────────
   用法：
     node launch.js <系统首页/登录页>          # 先起调试 Chrome（登录态由你完成）
     node freeze.js <out.html> [url] [port=9222] [--keep-mhtml]
        · 不给 url → 冻结 Chrome 当前页；给 url → 先导航过去再冻。
        · 图形验证码用 captcha.js 自认；邮箱/短信码需用户给。真系统只看不提交。
   两种场景通吃：① 我登录真系统逐页冻；② 用户直接发链接 → freeze.js <out> <链接>。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');
const { connect } = require('./_cdp');
const { convert } = require('./mhtml2html');

(async () => {
  const out = process.argv[2];
  if (!out) { console.error('用法: node freeze.js <out.html> [url] [port] [--keep-mhtml]'); process.exit(2); }
  const url = process.argv[3] && !process.argv[3].startsWith('--') ? process.argv[3] : null;
  const port = (process.argv.find(a => /^\d+$/.test(a)) || '9222');
  const keepMhtml = process.argv.includes('--keep-mhtml');

  const cdp = await connect(+port);
  try {
    if (url) {
      console.log('→ 导航到 ' + url);
      await cdp.navigate(url);
      /* ⚠️ 必须等 DOM 稳定再冻，固定睡几秒是不够的。
         2026-10-29 实测：真系统列表页固定等 3.3 秒冻出来 DOM 只有 246KB（正常 570KB）、
         一个按钮都没有 —— 冻的是还没渲染完的空壳。更糟的是它**不报错**，
         产出一个看着正常的文件，等你从里面提炼"真值"时才发现是错的。
         这里等到元素数连续两次不变（最多 30 秒）。 */
      /* ⚠️「连续两次元素数不变」是不够的：SPA 在等接口返回时元素数会**暂时不变**，
         于是被误判成加载完了 —— 实测冻出来 878 个元素的空壳（真实页面是 2000+），
         筛选区、表格、按钮一个都没有。改成：至少等 6 秒，且连续 5 次（2.5 秒）不变。 */
      let last = -1, stable = 0;
      for (let i = 0; i < 80; i++) {
        await new Promise(z => setTimeout(z, 500));
        let n = 0; try { n = await cdp.evalv('document.querySelectorAll("*").length'); } catch (_) {}
        if (n > 200 && n === last) stable++; else stable = 0;
        last = n;
        if (i >= 12 && stable >= 5) break;      // 前 6 秒无论如何都等满
      }
      console.log('   DOM 稳定（' + last + ' 个元素）');
    }
    console.log('→ 冻结当前页 (' + (await cdp.url()) + ')');
    /* §2026-10-28 真系统页面（OMS/WMS 列表页带几十张图）做整页 MHTML 快照时，
       返回体有几十 MB，一次性从调试通道吐回来会**把连接撑断**（报
       「CDP 连接已断开，captureSnapshot 未完成」）。
       解法：先让页面停掉动画、断开懒加载，再取；取不到就退回「只冻 DOM + 内联样式」的轻量方案，
       保证**一定有产物**，而不是像以前那样静默退出留个 0 字节。 */
    /* ⚠️ 2026-10-28 实测：对 OMS/WMS 这类列表页，Page.captureSnapshot 会把调试连接整个撑断，
       而且**断了之后同一条连接上的任何后续调用都废**（接着报 Runtime.evaluate 超时）。
       所以不再「先试整页、失败再退」——试一次的代价是整条连接报废。
       默认直接走轻量冻结；真要 MHTML 的，显式加 --mhtml（自己承担撑断风险）。 */
    let mhtml = null;
    if (process.argv.includes('--mhtml')) {
      try {
        const { result } = await cdp.send('Page.captureSnapshot', { format: 'mhtml' }, 180000);
        if (result && result.data) mhtml = result.data;
      } catch (e) { console.log('   整页快照失败（' + e.message + '）'); }
    }
    if (!mhtml) {
      /* 轻量冻结：把渲染完的 DOM + 所有生效样式表原样取出来，图片保持原链接。
         逐像素程度不如 MHTML，但结构与样式 100% 是真系统当下这一刻的，可直接拿来比对。 */
      /* ⚠️ 2026-10-28：整份 HTML 一次性从调试通道吐回来（几 MB）同样会把连接撑断。
         所以先在页面里拼好、存成变量，再**分片取回**（每片 256KB），逐片确认。 */
      /* §2026-10-29 样式走 CDP 取（CSS.getStyleSheetText），页面侧只负责出 DOM。
         好处：页面里 `document.styleSheets[i].cssRules` 对【跨域样式表】抛 SecurityError
         会被静默跳过，走 CDP 则读得到 —— 遇到 CDN 托管样式的站点不会无声无息少抓一截。

         ⚠️ 更正：我一度认为这就是"冻结件失真"的根因，**实测否定了**。
         某 WMS 真系统跨域表 = 0，冻结件里 CSS 38980 条规则、变量与 EP 基础规则都在，
         可按钮 border 在冻结件里仍渲染成 UA 默认 `2px outset`（活页面是 `1px solid`）。
         **真因未查清**，别再拿"跨域"解释它。 */
      /* ════ 样式必须取【原始 CSS 文本】，绝不能用 cssRules 的 cssText 重建 ════
         §2026-10-29 查清的根因（折腾了整整一轮才钉死）：
           真系统 CSS 写的是 `border: var(--el-border)` —— 简写属性 + 变量。
           CSSOM 读 `rule.cssText` 时会把简写展开成子属性，但值里含未解析的 var()，
           **序列化出来变成 `border-top-style: ; border-top-width: ; …`（属性名在、值是空的）**。
           这种声明再被浏览器解析时**直接丢弃** → 冻结件里按钮没有 border，
           回退成 UA 默认 `2px outset`（活页面是 `1px solid`）。
           实测：同一条 `.el-button` 规则，活页面 31 条非变量声明 / 冻结件只剩 18 条。
         危害远不止 border：`margin`/`padding`/`font`/`background`/`transition`/`flex`
         凡是用 var() 简写的全中 —— 而且**不报错**，冻结件看着正常，值却是错的。
         所以：<style> 取 textContent，<link> 用 fetch 取原文，都是原始字节，不过 CSSOM。 */
      let cssText = "";
      const srcLen = await cdp.evalv(`(async function(){
        var parts = [], miss = 0;
        var els = [].slice.call(document.querySelectorAll('style, link[rel="stylesheet"]'));
        for (var i = 0; i < els.length; i++) {
          var el = els[i];
          if (el.tagName === 'STYLE') { parts.push(el.textContent || ''); continue; }
          try { var r = await fetch(el.href); parts.push('/* ' + el.href + ' */\\n' + (await r.text())); }
          catch (e) { miss++; parts.push('/* 取不到(跨域?): ' + el.href + ' */'); }
        }
        window.__frzCss = parts.join('\\n');
        window.__frzMiss = miss;
        return window.__frzCss.length;
      })()`, true);
      if (srcLen > 0) {
        const miss = await cdp.evalv('window.__frzMiss');
        const CH0 = 262144;
        for (let i = 0; i < Math.ceil(srcLen / CH0); i++) {
          cssText += (await cdp.evalv('window.__frzCss.substr(' + (i * CH0) + ',' + CH0 + ')') || '');
        }
        console.log('   样式原文 ' + Math.round(cssText.length / 1024) + ' KB' +
                    (miss ? '（' + miss + ' 份取不到，已在产物里标注）' : '（全部取到·未经 CSSOM 转写）'));
      }
      /* ⚠️ CSS 留在 node 这边拼，【不要】塞进 eval 表达式 —— 真系统的样式表动辄几百 KB，
         拼进表达式会让 Runtime.evaluate 直接抛 Uncaught（2026-10-29 实测踩到）。
         页面只负责吐 DOM，HTML 在 node 侧组装。 */
      const total = await cdp.evalv(`(function(){
        var css='';
        if(!${cssText ? "1" : "0"}){  /* 兜底：CDP 没取到样式才退回页面内 cssRules（读不到跨域表）*/
          [].slice.call(document.styleSheets).forEach(function(s){
            try{ [].slice.call(s.cssRules).forEach(function(r){ css+=r.cssText+'\\n'; }); }catch(e){}
          });
        }
        window.__frzCss=css;
        window.__frz=document.body.innerHTML;
        return window.__frz.length;
      })()`);
      if (!total) throw new Error('页面里没拼出内容');
      const CH = 262144;
      const parts = Math.ceil(total / CH);
      console.log('   DOM ' + Math.round(total / 1024) + ' KB → 分 ' + parts + ' 片取回');
      let body = '';
      for (let i = 0; i < parts; i++) {
        const seg = await cdp.evalv('window.__frz.substr(' + (i * CH) + ',' + CH + ')');
        body += (seg || '');
      }
      if (body.length < total * 0.9) throw new Error('分片取回不完整（' + body.length + '/' + total + '）');
      if (!cssText) {   // 走了兜底：样式也在页面里，同样分片取回
        const cl = await cdp.evalv('window.__frzCss.length') || 0;
        for (let i = 0; i < Math.ceil(cl / CH); i++) cssText += (await cdp.evalv('window.__frzCss.substr(' + (i * CH) + ',' + CH + ')') || '');
      }
      await cdp.evalv('(function(){try{delete window.__frz;delete window.__frzCss}catch(e){}return 1})()');
      const origin = await cdp.evalv('location.origin');
      const html = '<!doctype html><html><head><meta charset="utf-8"><base href="' + origin + '">' +
                   '<style>' + cssText + '</style></head><body>' + body + '</body></html>';
      fs.writeFileSync(out, html, 'utf8');
      console.log('✅ 轻量冻结件 → ' + out + '（' + Math.round(html.length / 1024) + ' KB · DOM ' +
                  Math.round(body.length / 1024) + 'KB + 样式 ' + Math.round(cssText.length / 1024) + 'KB）');
      return;
    }
    if (keepMhtml) { const mp = out.replace(/\.html?$/i, '') + '.mhtml'; fs.writeFileSync(mp, mhtml, 'utf8'); console.log('   (保留 MHTML → ' + mp + ')'); }
    const r = convert(Buffer.from(mhtml, 'utf8').toString('latin1'));
    fs.writeFileSync(out, r.html, 'utf8');
    console.log('✅ 像素级冻结件 → ' + out);
    console.log('   部件 ' + r.nParts + ' · 内联CSS ' + r.nInlinedCss + ' · 内联资源 ' + r.nRes + ' · 残留外链 ' + r.leftover + '（多为导航/API地址·静态件无需）');
    console.log('   任意浏览器双击即开·断网自洽·逐像素等于真系统。');
  } finally { cdp.close(); }
})().catch(e => { console.error('冻结失败:', e.message); process.exit(1); });
