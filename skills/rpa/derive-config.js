#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   derive-config.js · 冻结件 → project-data 页面配置【stub】反向推导
   目的：抓完真系统后，机器先把每页结构抽成装配器能吃的 project-data 骨架，
        人只需精修（宽度/聚合/弹窗），把"手写 200 行配置"降到"精修 50 行"。
   零依赖·连 launch.js 起的调试 Chrome（与 extract-spec 一致）。
   用法：node launch.js about:blank 9222
        node derive-config.js <冻结件.html|.mhtml> <page-id> [out.json] [port=9222]
   产出：{ "<page-id>": { listTitle|pageForm, filters?, statusTabs?, columns?, actions?, selectActions?, rows? } }
        —— 直接粘进 project-data 的 "pages" 下，再对照冻结件精修（列宽/聚合列/弹窗另配）。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const { connect } = require('./_cdp');

const PROBE = `(() => {
  const norm = s => (s||'').replace(/\\s+/g,' ').trim();
  const skip = /^(简体中文|Portugués|Português|English|Español|标注|立即刷新|个人中心|修改密码|退出登录)$/;
  const vis = e => e && e.getBoundingClientRect().width>0 && e.getBoundingClientRect().height>0;
  const out = { type:'', listTitle:'' };
  // 页型判定：有整页表单/多个 form-item 且无数据表格行 → 表单；否则列表
  const hasTableRows = document.querySelector('.el-table__body tr');
  const formItems = [...document.querySelectorAll('.el-form-item')].filter(vis);
  const isForm = (!hasTableRows && formItems.length>4) || document.querySelector('.page-form');
  out.type = isForm ? 'form' : 'list';
  // 标题 = 当前激活的浏览器页签 或 列表卡标题
  const activeTab = [...document.querySelectorAll('.el-tabs__item.is-active')].map(e=>norm(e.textContent).replace(/×/g,'').trim()).filter(t=>t && !/^(首页)$/.test(t));
  out.listTitle = activeTab[activeTab.length-1] || '';

  if (out.type === 'form') {
    // 分区标题（粗体≥15px 短标题）
    const secTitles = [...new Set([...document.querySelectorAll('*')].filter(e=>{const s=getComputedStyle(e);const t=norm(e.textContent);return e.children.length<=1 && parseInt(s.fontSize)>=15 && parseInt(s.fontWeight)>=600 && t.length>=2 && t.length<12 && !skip.test(t) && !e.closest('th,button,.el-tabs__item');}).map(e=>norm(e.textContent)))];
    // 字段 label + 必填 + 类型猜测
    const fields = formItems.map(fi=>{
      const lb=fi.querySelector('.el-form-item__label'); if(!lb)return null;
      const label=norm(lb.textContent).replace(/[*：:]/g,'').trim(); if(!label)return null;
      const req=/\\*/.test(lb.textContent)||fi.querySelector('.is-required')!=null;
      let type='';
      if(fi.querySelector('.el-select'))type='select';
      else if(fi.querySelector('.el-date-editor'))type='date';
      else if(fi.querySelector('textarea'))type='textarea';
      else if(fi.querySelector('.el-radio'))type='radio';
      const f={label}; if(req)f.required=true; if(type)f.type=type; return f;
    }).filter(Boolean);
    out.pageForm = { _sectionsSeen: secTitles, fields };
    out.footer = [...document.querySelectorAll('.el-dialog__footer .el-button, .page-form-footer .el-button, .el-form + * .el-button')].map(b=>norm(b.textContent)).filter(t=>t&&t.length<6);
    return out;
  }

  // ── 列表 ──
  // 列（表头，跳过空/勾选列）
  out.columns = [...new Set([...document.querySelectorAll('.el-table__header th .cell, .el-table__header-wrapper th .cell')].map(e=>norm(e.textContent)).filter(t=>t && t.length<14))];
  // 状态页签（带计数 或 状态词）
  out.statusTabs = [...document.querySelectorAll('.el-tabs__item')].map(e=>norm(e.textContent)).filter(t=>t && /启用|停用|全部|待|已|异常|正常|作废|草稿|\\(\\d+\\)/.test(t) && t.length<16).map(t=>({label:t}));
  // 筛选控件（数量 + 首项文本当占位/label）
  out.filters = [...document.querySelectorAll('.search-box .el-select__wrapper, .search-box .el-input__wrapper, .search-box .el-date-editor, [class*="search"] .el-select__wrapper, [class*="filter"] .el-select__wrapper')].filter(vis).slice(0,30).map(e=>{
    const ph=e.querySelector('.el-select__placeholder, input'); const t=ph?norm(ph.textContent||ph.placeholder||''):'';
    const isSel=!!e.querySelector('.el-select__placeholder')||e.className.includes('select');
    return isSel?{type:'select',_first:t}:{_ph:t};
  });
  // 工具栏批量按钮（列表卡内、表格上方的 el-button）
  const tbl = document.querySelector('.el-table'); const tblTop = tbl?tbl.getBoundingClientRect().top:99999;
  out.selectActions = [...new Set([...document.querySelectorAll('.el-button, button')].filter(e=>{const r=e.getBoundingClientRect();return vis(e)&&r.top>120&&r.top<tblTop;}).map(e=>norm(e.textContent)).filter(t=>t && !skip.test(t) && t.length<8 && !/查询|重置|新增/.test(t)))];
  // 行操作图标（数量·类型靠 tooltip/aria 猜）
  const firstRow = document.querySelector('.el-table__body tr');
  out.actionsPerRow = firstRow ? firstRow.querySelectorAll('.option-btn .icon-button, .row-ic, [class*="action"] button').length : 0;
  return out;
})()`;

(async () => {
  const inp = process.argv[2], pageId = process.argv[3];
  if (!inp || !pageId) { console.error('用法: node derive-config.js <冻结件.html|.mhtml> <page-id> [out.json] [port]'); process.exit(2); }
  const out = process.argv[4] || inp.replace(/\.(html?|mhtml)$/i, '') + '-config-stub.json';
  const port = process.argv[5] || '9222';
  const cdp = await connect(+port);
  try {
    const fileUrl = encodeURI('file:///' + path.resolve(inp).replace(/\\/g, '/'));
    await cdp.send('Page.navigate', { url: fileUrl });
    for (let i = 0; i < 50; i++) { await new Promise(z => setTimeout(z, 500)); if ((+(await cdp.evalv('document.body?document.body.querySelectorAll("*").length:0'))) > 80) break; }
    await new Promise(z => setTimeout(z, 800));
    const v = await cdp.evalv(PROBE);
    if (!v) throw new Error('探针无返回');
    const cfg = {}; cfg[pageId] = v;
    fs.writeFileSync(out, JSON.stringify(cfg, null, 2), 'utf8');
    console.log('✅ 配置 stub → ' + out + '  （页型=' + v.type + '）');
    if (v.type === 'list') console.log('   列 ' + (v.columns || []).length + ' · 状态页签 ' + (v.statusTabs || []).length + ' · 筛选 ' + (v.filters || []).length + ' · 批量按钮 ' + JSON.stringify(v.selectActions) + ' · 行图标/行 ' + v.actionsPerRow);
    else console.log('   分区 ' + JSON.stringify(v.pageForm._sectionsSeen) + ' · 字段 ' + v.pageForm.fields.length + ' · 底部 ' + JSON.stringify(v.footer));
    console.log('   ⚠ 这是 stub：列宽/聚合列/select 选项/弹窗 需对照冻结件精修（filters 的 _first/_ph、pageForm 的分区归属要人工归并）。');
  } catch (e) { console.error('推导异常:', e.message); process.exitCode = 1; }
  finally { cdp.close(); }
})();
