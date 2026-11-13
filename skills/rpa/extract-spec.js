#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   extract-spec.js · 从【冻结件/真快照】穷举提炼每类组件的 getComputedStyle → 喂默认UI规范
   零依赖·连 launch.js 起的调试 Chrome(与 extract.js 一致·已证明能渲染大冻结件)。
   用法：node launch.js about:blank 9222   （先起一次调试 Chrome）
        node extract-spec.js <冻结件.html|.mhtml> [out.json] [port=9222]
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const { connect } = require('./_cdp');

const PROBE = `(() => {
  const S = e => { if(!e) return null; const s=getComputedStyle(e); const r=e.getBoundingClientRect();
    return { bg:s.backgroundColor, color:s.color, border:s.border, borderColor:s.borderColor, radius:s.borderRadius,
      shadow:s.boxShadow.replace(/\\s+/g,' ').slice(0,60), w:Math.round(r.width), h:Math.round(r.height),
      pad:s.padding, margin:s.margin, font:s.fontFamily.slice(0,40), fs:s.fontSize, fw:s.fontWeight, lh:s.lineHeight, ls:s.letterSpacing }; };
  const vis = e => e && e.getBoundingClientRect().width>0 && e.getBoundingClientRect().height>0;
  const g = sel => { const e=[...document.querySelectorAll(sel)].find(vis); return e?S(e):null; };
  const byText = (sel,t) => { const e=[...document.querySelectorAll(sel)].find(x=>vis(x)&&(x.textContent||'').replace(/\\s+/g,'').trim()===t); return e?S(e):null; };
  const rootVars = () => { const cs=getComputedStyle(document.documentElement); const out={};
    ['--el-color-primary','--el-color-success','--el-color-warning','--el-color-danger','--el-color-info',
     '--el-text-color-primary','--el-text-color-regular','--el-text-color-secondary','--el-text-color-placeholder',
     '--el-border-color','--el-border-color-light','--el-border-color-lighter','--el-bg-color',
     '--el-font-size-base','--el-border-radius-base','--el-component-size'].forEach(v=>{ const x=cs.getPropertyValue(v).trim(); if(x) out[v]=x; }); return out; };
  return {
    vars: rootVars(),
    body: S(document.body),
    topnav: g('.el-menu--horizontal') || g('.layout-header') || g('[class*="header"]'),
    tabbar: g('.el-tabs__header'),
    tabActive: g('.el-tabs__item.is-active'),
    tabIdle: g('.el-tabs__item:not(.is-active)'),
    filterSelect: g('.el-select__wrapper'),
    filterInput: g('.el-input__wrapper'),
    filterDate: g('.el-date-editor'),
    btnPrimary: byText('.el-button','查询') || byText('.el-button','新增') || g('.el-button--primary'),
    btnDefault: byText('.el-button','重置') || g('.el-button:not(.el-button--primary)'),
    thHead: g('.el-table__header th .cell') || g('.el-table__header th'),
    tdCell: g('.el-table__body td .cell') || g('.el-table__body td'),
    tableRow: g('.el-table__body tr'),
    pager: g('.el-pagination'),
    pagerActive: g('.el-pager li.is-active') || g('.el-pager li.active'),
    pagerNum: g('.el-pager li'),
    checkbox: g('.el-checkbox__inner'),
    radio: g('.el-radio__inner'),
    switch: g('.el-switch__core'),
    link: g('.cell a') || g('td a'),
    dialog: g('.el-dialog'),
    dialogHead: g('.el-dialog__header'),
    formLabel: g('.el-form-item__label'),
    formInput: g('.el-form .el-input__wrapper'),
    // 查看/详情页专用
    backBtn: byText('.el-button','返回'),
    stepBar: g('.el-steps') || g('[class*="step"]'),
    stepActive: g('.el-step__title.is-process') || g('.el-step__head.is-process'),
    descLabel: g('.el-descriptions__label') || g('.el-descriptions__cell.is-label'),
    descValue: g('.el-descriptions__content') || g('.el-descriptions__cell.is-content'),
    roLabelSKU: byText('*','SKU编号'),
    detailSection: (function(){ const e=[...document.querySelectorAll('*')].find(x=>vis(x)&&x.children.length<=1&&(x.textContent||'').trim()==='基本信息'); return e?(function(){const s=getComputedStyle(e);const r=e.getBoundingClientRect();return {bg:s.backgroundColor,color:s.color,border:s.border,borderColor:s.borderColor,radius:s.borderRadius,shadow:'',w:Math.round(r.width),h:Math.round(r.height),pad:s.padding,margin:s.margin,font:'',fs:s.fontSize,fw:s.fontWeight,lh:s.lineHeight,ls:''};})():null; })(),
  };
})()`;

(async () => {
  const inp = process.argv[2];
  if (!inp) { console.error('用法: node extract-spec.js <冻结件.html|.mhtml> [out.json] [port]'); process.exit(2); }
  const out = process.argv[3] || inp.replace(/\.(html?|mhtml)$/i,'') + '-spec-extract.json';
  const port = process.argv[4] || '9222';
  const cdp = await connect(+port);
  try {
    const fileUrl = encodeURI('file:///' + path.resolve(inp).replace(/\\/g,'/'));
    await cdp.send('Page.navigate',{ url:fileUrl });
    // 轮询直到渲染出实质内容（大冻结件解析慢）
    let ok=false; for(let i=0;i<50;i++){ await new Promise(z=>setTimeout(z,500));
      const n = await cdp.evalv('document.body?document.body.querySelectorAll("*").length:0'); if((+n)>80){ ok=true; break; } }
    await new Promise(z=>setTimeout(z,800));
    const val = await cdp.evalv(PROBE);
    if(!val) throw new Error('探针无返回');
    fs.writeFileSync(out, JSON.stringify(val,null,1), 'utf8');
    console.log('✅ 提炼 → ' + out + (ok?'':'  ⚠(内容偏少)'));
    for (const k of Object.keys(val)) { if(k==='vars'||k==='body') continue; const v=val[k]; if(v) console.log('  '+k.padEnd(13)+' bg='+(v.bg||'').padEnd(18)+' color='+(v.color||'').padEnd(18)+' h='+String(v.h).padEnd(4)+' fs='+String(v.fs).padEnd(6)+' fw='+String(v.fw).padEnd(4)+' radius='+v.radius); }
    if(val.vars) console.log('  vars: '+JSON.stringify(val.vars));
  } catch(e){ console.error('提炼异常:', e.message); process.exitCode=1; }
  finally { cdp.close(); }
})();
