#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   ㊴ 工程命名硬卡闸 · function-name-gate.js · 零依赖
   ────────────────────────────────────────────────────────────────────────
   规则单一真理源：skills/pm-design/工程命名规范.md（本闸=其可执行形态）。
   把"提炼的功能名(fp_name)"卡死在三类坏名之外，硬卡：命中任一 → 判红，不许交付。
     ① 纯编号/纯数字/单号     例：PTKFX260806009 / 1 / 20260806009
     ② 通用兜底词             例：功能区 / 列表 / 操作 / 未命名
     ③ 营销句/说明整句         例：连接你的商店体验更多功能
   两处复用同一判定 checkName()：
     · anno-server /anno-inject 落名前（源头硬卡，坏名进不了 prd-data）
     · 本闸挂 deliver-gate（交付前逐一扫 prd-data.json + 原型内嵌 __PRD_DATA__.fp_name）
   用法：node function-name-gate.js      退出码 0=全合格 · 1=有坏名或自测失败
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');

/* ── 命名判定（唯一真理·anno-server 也 require 这个函数）── */
const GENERIC = ['功能区', '功能', '列表', '操作', '区域', '未命名', '功能标注', '标注', '按钮', '卡片', '内容', '元素', '占位', '标题', '文本'];
function checkName(raw) {
  const n = String(raw == null ? '' : raw).trim().replace(/^功能点[:：]/, '').trim();
  if (!n) return { ok: false, reason: '空名' };
  if (/^\d+$/.test(n)) return { ok: false, reason: '纯数字' };
  if (/^[A-Za-z]{0,8}[-_]?\d{5,}[A-Za-z0-9]*$/.test(n)) return { ok: false, reason: '纯编号/单号(取到了数据值)' };
  if (GENERIC.includes(n)) return { ok: false, reason: '通用兜底词(没取到真名)' };
  if (n.length > 20) return { ok: false, reason: '过长·疑似整段文字' };
  if (/[，。！？；]/.test(n)) return { ok: false, reason: '含标点·是整句不是功能名' };
  if (n.length >= 8 && /(你|您|我们|更多|体验|欢迎|立即|马上|快来|点击这里|了解更多|开始使用|连接你|请点)/.test(n)) return { ok: false, reason: '营销/引导语·不是功能名' };
  return { ok: true };
}
module.exports = { checkName };

/* ── 独立运行：自测牙齿 + 扫真实 prd-data / 原型 ── */
if (require.main === module) {
  let selfBad = 0;
  const MUST_RED = ['功能区', 'PTKFX260806009', '连接你的商店体验更多功能', '列表', '1', '20260806009', '操作', '欢迎使用本系统立即开始体验'];
  const MUST_GREEN = ['导出', '新增采购单', '账户余额 (BRL)', '消息通知/消息公告', '一件代发/B2B/退货', '门店对账', '导出对账单', '审核', '我的订单'];
  for (const g of MUST_RED) if (checkName(g).ok) { selfBad++; console.log('  ✗ 自测漏网(该红却绿): ' + g); }
  for (const g of MUST_GREEN) if (!checkName(g).ok) { selfBad++; console.log('  ✗ 自测误伤(该绿却红): ' + g + ' —— ' + checkName(g).reason); }
  console.log('\n════════ ㊴ 工程命名硬卡闸 ════════');
  console.log('  自测: ' + (selfBad ? '❌ ' + selfBad + ' 项不符——闸判定有误，先修 checkName' : '✅ 牙齿在(坏名全红·好名全绿)'));

  const DIRS = require('./_archive-dir').protoScanDirs();
  const skip = /node_modules|screenshots|\.pre-|对接料|生成代码/i;
  const targets = [];
  (function walk(ds) { for (const d of ds) { let es = []; try { es = fs.readdirSync(d, { withFileTypes: true }); } catch (e) { continue; }
    for (const e of es) { const p = path.join(d, e.name); if (skip.test(p)) continue;
      if (e.isDirectory()) walk([p]);
      else if (/prd-data.*\.json$/i.test(e.name)) targets.push(p);
      else if (/\.html$/i.test(e.name)) { try { if (fs.statSync(p).size >= 100 * 1024) targets.push(p); } catch (e) {} } } } })(DIRS);

  let realBad = 0, scanned = 0, names = 0;
  const seen = new Set();
  for (const f of targets) {
    let txt = ''; try { txt = fs.readFileSync(f, 'utf8'); } catch (e) { continue; }
    scanned++;
    const re = /"fp_name"\s*:\s*"((?:[^"\\]|\\.)*)"/g; let m;
    while ((m = re.exec(txt))) {
      let nm; try { nm = JSON.parse('"' + m[1] + '"'); } catch (e) { nm = m[1]; }
      names++;
      const r = checkName(nm);
      if (!r.ok) { const key = path.basename(f) + '::' + nm; if (seen.has(key)) continue; seen.add(key);
        realBad++; console.log('  ✗ 坏名 [' + nm + ']  (' + r.reason + ')  ← ' + path.basename(f)); }
    }
  }
  console.log('──────────────────────────────────');
  console.log('  扫了 ' + scanned + ' 个文件 · ' + names + ' 个功能名');
  if (selfBad || realBad) { console.log('  ❌ ' + (realBad ? realBad + ' 个坏名必须改对才放行' : '') + (selfBad ? ' · 自测未过' : '')); process.exit(1); }
  console.log('  ✅ 全部功能名合格 —— 工程命名硬卡 PASS');
  process.exit(0);
}
