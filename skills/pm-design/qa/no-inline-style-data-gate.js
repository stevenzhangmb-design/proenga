/* ════════════════════════════════════════════════════════════════════════
   ㊳ 数据禁手写内联样式 HTML 闸 · no-inline-style-data-gate.js · 随包发
   ────────────────────────────────────────────────────────────────────────
   【为什么】走"生成前后端代码(B)"的地基铁律：原型的【数据】(__PRD_DATA__/PAGECFG)
   里绝不能塞【带硬编码颜色的手写 HTML 单元格】(如 `<span style='color:#3363FF'>1.480</span>`)。
   这类手写样式：① 绕过骨架标准渲染器 → 代码生成器无法映射成组件、只能原样塞 → 代码质量崩；
                ② 硬编码色 → 生成的 CSS 写死、不可令牌化 → 换皮/换组件库全失效。
   正解：单元格走【结构化数据】(如 {t, link:true}) 或骨架语义渲染，颜色走令牌，禁手写 style=。
   【精准范围】只扫【数据块】(window.__PRD_DATA__ / PAGECFG 的大括号对象)，
     绝不扫标注层/骨架自身的合法 style=(实测:装配版数据块 0 命中·手搓版 790 命中)。
   【豁免】带 __ANNO_LEGACY_GRANDFATHER__ 的手搓老原型 → 响亮警告(非红)，提示"要走代码生成必须重构成结构化"。
   用法：node no-inline-style-data-gate.js [原型.html ...]   无参=自发现真交付原型(同 ㊱)
   退出码：0=全绿/豁免 · 1=有红
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');

const SCAN_DIRS = require('./_archive-dir').protoScanDirs();
const SKIP_RE = /_serverless验证|_草稿|_superseded|fixtures|node_modules|分享版|-分享/i;
function findDeliverables() {
  const out = [];
  for (const d of SCAN_DIRS) {
    if (!fs.existsSync(d)) continue;
    const walk = dir => {
      let ents = []; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
      for (const e of ents) {
        const fp = path.join(dir, e.name);
        if (SKIP_RE.test(fp)) continue;
        if (e.isDirectory()) walk(fp);
        else if (e.isFile() && /\.html$/i.test(e.name)) {
          let st; try { st = fs.statSync(fp); } catch (_) { continue; }
          if (st.size < 100 * 1024) continue;
          let body = ''; try { body = fs.readFileSync(fp, 'utf8'); } catch (_) { continue; }
          if (body.includes('__ANNO_LAYER_VERSION__')) out.push(fp);
        }
      }
    };
    walk(d);
  }
  return out;
}

// 大括号计数法提取一个完整 JS 对象(跳过字符串内的括号)
function extractObj(s, fromIdx) {
  let i = s.indexOf('{', fromIdx); const jStart = i;
  if (i < 0) return '';
  let depth = 0, inStr = false, q = '', esc = false;
  for (; i < s.length; i++) {
    const ch = s[i];
    if (esc) { esc = false; continue; }
    if (ch === '\\') { esc = true; continue; }
    if (inStr) { if (ch === q) inStr = false; continue; }
    if (ch === '"' || ch === "'" || ch === '`') { inStr = true; q = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return s.slice(jStart, i + 1); }
  }
  return '';
}
const ANCHORS = ['window.__PRD_DATA__', '__PRD_DATA__', 'const PAGECFG', 'PAGECFG =', 'let PAGECFG', 'window.__PAGECFG__'];
const PAT = /<[a-z][a-z0-9]*\b[^>]*\bstyle\s*=\s*['"][^'"]*(?:color|background)\s*:\s*#[0-9a-fA-F]{3,6}[^>]*>/gi;
/* 按钮禁用词(§8.0 命名铁律)：精确串匹配·只扫数据块 → 避开"创建时间/清空标注/批量搜索"合法用法(实测装配版0命中)。
   驳回【不列】(已驳回/驳回原因=合法状态)。正确词：新增(非新建/创建)·查询(非搜索)·重置(非清空/清除)·审核不通过(非拒绝)。 */
const BTN_BAD = /["'](新建|创建|搜索|清空|清除|拒绝)["']/g;
const BTN_FIX = { 新建: '新增', 创建: '新增', 搜索: '查询', 清空: '重置', 清除: '重置', 拒绝: '审核不通过' };

function checkOne(file) {
  const html = fs.readFileSync(file, 'utf8').replace(/^﻿/, '');
  let block = '';
  for (const a of ANCHORS) { const k = html.indexOf(a); if (k >= 0) { const b = extractObj(html, k); if (b.length > block.length) block = b; } }
  if (!block) return { file, status: 'skip', nHtml: 0, badWords: [] };
  const hits = block.match(PAT) || [];
  const badWords = [...new Set((block.match(BTN_BAD) || []).map(w => w.replace(/["']/g, '')))];
  if (hits.length === 0 && badWords.length === 0) return { file, status: 'pass', nHtml: 0, badWords: [] };
  const gf = /__ANNO_LEGACY_GRANDFATHER__/.test(html);
  return { file, status: gf ? 'warn' : 'fail', nHtml: hits.length, samples: [...new Set(hits)].slice(0, 3), badWords };
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : findDeliverables();
console.log('\n════════ ㊳ 数据卫生闸（生成代码地基·禁手写内联样式HTML + 禁按钮禁用词）════════');
if (!targets.length) { console.log('  （未发现真交付原型，跳过）\n════════════════════════════════'); process.exit(0); }

let red = 0;
const wf = ws => ws.map(w => w + '→' + (BTN_FIX[w] || '?')).join(' / ');
for (const f of targets) {
  let r; try { r = checkOne(f); } catch (e) { console.log('  ⚠ 读取失败 ' + path.basename(f) + ': ' + e.message); continue; }
  const nm = path.basename(f);
  if (r.status === 'pass') console.log('  ✓ ' + nm + ' —— 数据结构化·命名合规');
  else if (r.status === 'skip') console.log('  · ' + nm + ' —— 无数据块，跳过');
  else if (r.status === 'warn') { console.log('  ⚠ ' + nm + ' —— ' + r.nHtml + ' 处手写样式HTML' + (r.badWords.length ? ' + 禁用词[' + wf(r.badWords) + ']' : '') + '，但带 __ANNO_LEGACY_GRANDFATHER__ 豁免(放行)。**代码生成前须重构+改名。**'); }
  else {
    red++;
    console.log('  ✗ ' + nm + '：');
    if (r.nHtml) { console.log('      · ' + r.nHtml + ' 处【硬编码色手写HTML单元格】(代码生成杀手)：'); r.samples.forEach(s => console.log('        • ' + s.replace(/\s+/g, ' ').slice(0, 76))); }
    if (r.badWords.length) console.log('      · 按钮禁用词(§8.0 命名铁律)：' + wf(r.badWords));
  }
}
if (red) {
  console.log('\n  ❌ FAIL(' + red + ' 个原型)：数据禁手写硬编码色HTML(改结构化+令牌) & 按钮禁用词(用规范词)。手搓老原型可加 __ANNO_LEGACY_GRANDFATHER__ 临时豁免(代码生成前须重构)。\n════════════════════════════════');
  process.exit(1);
}
console.log('\n  全绿 PASS ✅ —— 数据结构化·令牌化·命名合规\n════════════════════════════════');
process.exit(0);
