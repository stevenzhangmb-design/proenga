#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   新增项对比闸 · added-structure-audit.js（随包·跨工具通用·零依赖）
   ────────────────────────────────────────────────────────────────────────
   为什么要有（2026-10-29 用户铁律「没让做的一个都不许加」）：
     用户让「待开票显示某句文案」，AI 自作主张给采购退货单加了一个通用「发票信息」页签——
     原型本来就有一套专门表，结果改出来和原设计冲突，还写进了 PRD。
     「新增了什么」混在「已做」里带过，用户根本看不出来。
   做什么：把源数据 project-data.json 和【上次用户认可的基线】逐项比，只列【新增】的结构：
     新页面 / 新弹窗 / 新详情 / 新板块 / 新页签 / 新字段 / 新列 / 新按钮 / 新示例单（收银台订单）/ 表格多出来的示例行。
     文字改动不算新增（那是改，不是加）。
   用法：
     node added-structure-audit.js <project-data.json>            对比基线，把新增项写进 <名>.added-pending.txt 并打印
     node added-structure-audit.js <project-data.json> --accept   用户已经点头 → 把当前数据记为新基线，清掉待批准清单
   基线文件 <名>.audit-base.json 放在源数据旁边；第一次运行没有基线时，以当前数据建基线（不报新增）。
   收工检查（_shared/qa/_stop-ledger-check.js）发现 .added-pending.txt 有内容就拦住：
     必须先把新增项列给用户、用户批准后跑 --accept，才能说「做完了」。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs');
const path = require('path');

const pd = process.argv[2];
const accept = process.argv.includes('--accept');
if (!pd || !fs.existsSync(pd)) { console.log('用法：node added-structure-audit.js <project-data.json> [--accept]'); process.exit(1); }
const basePath = pd.replace(/\.json$/i, '.audit-base.json');
const pendPath = pd.replace(/\.json$/i, '.added-pending.txt');

if (accept || !fs.existsSync(basePath)) {
  fs.copyFileSync(pd, basePath);
  if (fs.existsSync(pendPath)) fs.unlinkSync(pendPath);
  console.log(accept ? '✅ 已按用户认可记为新基线，待批准清单已清空' : '✅ 第一次运行：以当前数据建基线（之后的新增都会被列出来）');
  process.exit(0);
}

const cur = JSON.parse(fs.readFileSync(pd, 'utf8'));
const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
const zh = v => (v && typeof v === 'object' && !Array.isArray(v)) ? (v.zh != null ? v.zh : (v.label ? zh(v.label) : (v.t != null ? zh(v.t) : ''))) : (v == null ? '' : String(v));
const strip = s => String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
/* 一个对象的「身份」：它的标识和名字都算（新版多了个 key、旧版只有 label，也要认成同一个），找不到就不比 */
const idsOf = o => { if (!o || typeof o !== 'object' || Array.isArray(o)) return [];
  const out = [];
  for (const k of ['key', 'name', 'id', 'no', 'page', 'anchor']) if (o[k] != null && typeof o[k] !== 'object') out.push(k + '=' + o[k]);
  for (const k of ['label', 'title', 'when']) { const t = strip(zh(o[k])); if (t) out.push(k + '=' + t); }
  return out; };
const idOf = o => { const a = idsOf(o); const nm = a.find(x => /^(label|title|when)=/.test(x)); return nm || a[0] || ''; };
/* 这些数组里放的是「结构」，多一个就是新增 */
const STRUCT = { sections: '板块', tabs: '页签', fields: '字段', columns: '列', footerBtns: '底部按钮', actions: '操作按钮', toolbar: '工具按钮',
  listTools: '列表工具', selectActions: '勾选后按钮', statusTabs: '状态页签', detailViews: '详情', steps: '步骤', orders: '收银台示例单', blocks: '发票块', filters: '筛选项' };
/* 这些对象的每个键是一个结构（弹窗名、页面名、整页名） */
const MAPS = { dialogs: '弹窗', pagecfg: '页面', fullPages: '整页', byStatus: '状态面板' };

const found = [];
function walk(a, b, where) {
  if (!a || typeof a !== 'object') return;
  if (Array.isArray(a)) return;
  for (const k of Object.keys(a)) {
    const av = a[k], bv = b && typeof b === 'object' ? b[k] : undefined;
    const here = where ? where + ' › ' + k : k;
    if (MAPS[k] && av && typeof av === 'object' && !Array.isArray(av)) {
      for (const kk of Object.keys(av)) {
        if (!bv || !(kk in bv)) { found.push('新增' + MAPS[k] + '：' + (where ? where + ' › ' : '') + kk); continue; }
        walk(av[kk], bv[kk], (where ? where + ' › ' : '') + kk);
      }
      continue;
    }
    if (Array.isArray(av)) {
      const bArr = Array.isArray(bv) ? bv : [];
      if (STRUCT[k]) {
        /* 同名的有好几个（9 份「采购退货单详情」）→ 按出现顺序一个对一个，别都拿第一个比（会把别人的行数当成新增） */
        const bIds = new Map(); bArr.forEach(x => { idsOf(x).forEach(id => { if (!bIds.has(id)) bIds.set(id, []); bIds.get(id).push(x); }); });
        const used = new Set();
        const take = x => { for (const t of idsOf(x)) { const q = bIds.get(t) || []; const y = q.find(z => !used.has(z)); if (y) { used.add(y); return y; } } return null; };
        av.forEach((x, i) => { const id = idOf(x); const hit = take(x);
          if (id && !hit) found.push('新增' + STRUCT[k] + '：' + here + ' › ' + id);
          else if (id) walk(x, hit, here + ' › ' + id);
          else if (!id && i >= bArr.length && x && typeof x === 'object') found.push('新增' + STRUCT[k] + '：' + here + ' 第 ' + (i + 1) + ' 个'); });
      } else if (k === 'rows' && av.length > bArr.length && (av.length === 0 || Array.isArray(av[0]))) {
        found.push('表格多了 ' + (av.length - bArr.length) + ' 行示例数据：' + here);
      }
      continue;
    }
    if (av && typeof av === 'object') walk(av, bv, here);
  }
}
walk(cur, base, '');

if (!found.length) { if (fs.existsSync(pendPath)) fs.unlinkSync(pendPath); console.log('✅ 和基线比，没有新增项'); process.exit(0); }
const text = found.slice(0, 200).join('\n') + (found.length > 200 ? '\n…共 ' + found.length + ' 项' : '');
fs.writeFileSync(pendPath, text + '\n', 'utf8');
console.log('⚠ 和用户上次认可的版本比，新增了 ' + found.length + ' 项（必须列给用户、用户批准后跑 --accept）：\n' + text);
process.exit(0);
