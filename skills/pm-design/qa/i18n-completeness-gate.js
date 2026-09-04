#!/usr/bin/env node
/**
 * i18n-completeness-gate.js — 三语完整性闸（机器闸 / 随包发）
 *
 * 目的：多语言原型里，防【AI 偷懒只出中文】或【漏译某几条】。
 *   规范 §5.5：文案写成 {"zh":..,"en":..,"pt":..} 即随语言切换；写成普通字符串则各语言同显。
 *   风险：AI 生成 project-data 时，把本该三语的 label 写成裸中文字符串 → 切到 pt 还是中文，
 *         演示给巴西客户当场穿帮，而其它闸一个都看不出来。
 *
 * 真理源：原型里烙的 `window.__DESIGN_CHOICE__.locales / .defaultLocale`（装配器按四问答案写入）。
 *   单语（locales 长度 <2）或无标记（legacy）→ 跳过，不误拦存量原型。
 *
 * 用法：node i18n-completeness-gate.js [原型.html | 目录]     无参 → 自动发现 archive 里的交付原型
 * 退出码：0 全绿 / 1 有红(禁交付) / 2 用法错。
 *
 * 检查项：
 *   I1 至少有三语文案：多语原型里必须真的存在 locale 对象（0 个 = AI 压根没做多语）
 *   I2 无缺译：任一 locale 对象缺 locales 里声明的语言、或值为空串 → 红（逐条列出）
 *   I3 defaultLocale ∈ locales；region=BR ⇒ locales 含 pt
 *
 * 注意（本闸的已知边界，别当它万能）：
 *   · 只验【结构完整性】（有没有那一栏），不验【翻译质量】——机器判不了 "Buscar" 对不对。
 *   · mock 业务数据（表格 rows）按规范不翻译，本闸不要求它三语。
 */
'use strict';
const fs = require('fs');
const path = require('path');

const LOCALE_KEYS = ['zh', 'en', 'pt', 'spa'];

/** 从 `const NAME=` 之后做括号配对提取（跳过字符串/转义），拿到完整 JSON 字面量 */
function grabLiteral(src, decl) {
  const i = src.indexOf(decl);
  if (i < 0) return null;
  let p = i + decl.length;
  while (p < src.length && /\s/.test(src[p])) p++;
  const open = src[p];
  if (open !== '{' && open !== '[') return null;
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let j = p; j < src.length; j++) {
    const c = src[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') { inStr = true; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return src.slice(p, j + 1); }
  }
  return null;
}

function parseLiteral(src, decl) {
  const raw = grabLiteral(src, decl);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (_) { return null; }
}

const isI18nObj = v =>
  !!v && typeof v === 'object' && !Array.isArray(v) &&
  Object.keys(v).length > 0 && Object.keys(v).every(k => LOCALE_KEYS.includes(k));

/** 递归找出所有 locale 对象及其路径 */
function walk(node, pathStr, found) {
  if (!node || typeof node !== 'object') return;
  if (isI18nObj(node)) { found.push({ path: pathStr, obj: node }); return; }
  if (Array.isArray(node)) node.forEach((v, i) => walk(v, `${pathStr}[${i}]`, found));
  else for (const k of Object.keys(node)) walk(node[k], pathStr ? `${pathStr}.${k}` : k, found);
}

function checkOne(file) {
  const html = fs.readFileSync(file, 'utf8');
  const base = path.basename(file);
  if (/__NOT_A_PROTOTYPE__/.test(html)) return { file: base, skip: '说明文档(非原型)' };

  const choice = parseLiteral(html, 'window.__DESIGN_CHOICE__=');
  if (!choice) return { file: base, skip: '无 __DESIGN_CHOICE__(legacy·禁手搓闸㉝已另行把关)' };

  const locales = Array.isArray(choice.locales) ? choice.locales : ['zh'];
  if (locales.length < 2) return { file: base, skip: `单语原型(locales=${JSON.stringify(locales)})` };

  const reds = [], warns = [];

  // I3 声明自洽
  if (!locales.includes(choice.defaultLocale))
    reds.push(`I3 defaultLocale=${choice.defaultLocale} 不在 locales=${JSON.stringify(locales)} 里`);
  if (String(choice.region).toUpperCase() === 'BR' && !locales.includes('pt'))
    reds.push(`I3 region=BR 但 locales 不含 pt（巴西版必须能切葡语）`);

  // 只看【项目数据】三个字面量：UI_DICT 是标准件、天然全译，不重复验
  const found = [];
  for (const decl of ['const SYSTEMS=', 'const NAV=', 'const PAGECFG=']) {
    const lit = parseLiteral(html, decl);
    if (lit === null) { warns.push(`解析不出 ${decl.replace(/const |=/g, '')}（跳过该段）`); continue; }
    walk(lit, decl.replace(/const |=/g, ''), found);
  }

  // I4 custom 复杂页：写成裸 HTML 字符串就永远不跟随语言切换（注册/登录/购买这类页最容易漏）
  const pagecfg = parseLiteral(html, 'const PAGECFG=') || {};
  const rawCustom = Object.keys(pagecfg).filter(k => typeof pagecfg[k].custom === 'string' && /[一-龥]/.test(pagecfg[k].custom));
  if (rawCustom.length)
    warns.push(`I4 有 ${rawCustom.length} 个 custom 页是裸中文 HTML，切语言不会变：${rawCustom.slice(0, 6).join(', ')}${rawCustom.length > 6 ? ' …' : ''}（改成 {"zh":"…","en":"…","pt":"…"}）`);

  /* I5 枚举值必须三语：状态标签/类型这类 {t:"…",c:"…"} 单元是【产品定义的枚举】，真实系统也走 i18n。
     写成裸中文 → 葡语界面里状态列还是中文，演示当场穿帮。（单号/金额/客户名是数据实例，不在此列） */
  const rawTags = [];
  (function walkTags(node, p) {
    if (!node || typeof node !== 'object') return;
    if (!Array.isArray(node) && typeof node.t === 'string' && 'c' in node && /[一-龥]/.test(node.t)) { rawTags.push(`${p} = "${node.t}"`); return; }
    if (Array.isArray(node)) node.forEach((v, i) => walkTags(v, `${p}[${i}]`));
    else for (const k of Object.keys(node)) walkTags(node[k], `${p}.${k}`);
  })(pagecfg, 'PAGECFG');
  if (rawTags.length) {
    reds.push(`I5 有 ${rawTags.length} 个枚举值(状态/类型标签)是裸中文，切语言不会变：`);
    rawTags.slice(0, 10).forEach(t => reds.push(`     - ${t}`));
    if (rawTags.length > 10) reds.push(`     … 另有 ${rawTags.length - 10} 个`);
    reds.push(`     修法：{"t":{"zh":"已开票","en":"Issued","pt":"Emitida"},"c":"green"}`);
  }

  // I1 压根没做多语
  if (!found.length)
    reds.push(`I1 声明了多语(${locales.join('/')})，但 SYSTEMS/NAV/PAGECFG 里一个三语文案对象都没有 —— 文案全是裸字符串，切了语言不会变`);

  // I2 缺译
  const missing = [];
  for (const { path: p, obj } of found) {
    const lack = locales.filter(lc => !obj[lc] || !String(obj[lc]).trim());
    if (lack.length) missing.push(`${p} 缺 [${lack.join(', ')}]（zh="${obj.zh || ''}"）`);
  }
  if (missing.length) {
    reds.push(`I2 有 ${missing.length} 处缺译：`);
    missing.slice(0, 15).forEach(m => reds.push(`     - ${m}`));
    if (missing.length > 15) reds.push(`     … 另有 ${missing.length - 15} 处`);
  }

  return { file: base, locales, total: found.length, reds, warns };
}

function collect(target) {
  const st = fs.statSync(target);
  if (st.isFile()) return [target];
  const out = [];
  for (const f of fs.readdirSync(target))
    if (/^原型.*\.html$/i.test(f) && !/分享版|share|\.bak|backup|备份/i.test(f)) out.push(path.join(target, f));
  return out;
}

// 与 design-token-gate / choice-conformance-gate 同源的自动发现
function autoDiscover() {
  const dirs = require('./_archive-dir').archiveDirs();
  const isDeliv = f => /装配版/.test(f) && /offline/i.test(f) && f.endsWith('.html') && !/分享版|备份|\.bak/i.test(f);
  const out = [];
  for (const d of dirs) {
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { continue; }
    for (const e of ents) {
      if (e.isFile() && isDeliv(e.name)) out.push(path.join(d, e.name));
      else if (e.isDirectory() && !/node_modules|_planning|vendor|assets|草稿/i.test(e.name)) {
        try { for (const f of fs.readdirSync(path.join(d, e.name))) if (isDeliv(f)) out.push(path.join(d, e.name, f)); } catch (_) {}
      }
    }
    if (out.length) break;
  }
  return [...new Set(out)];
}

function main() {
  const target = process.argv[2];
  if (target && !fs.existsSync(target)) { console.error('✘ 目标不存在：' + target); process.exit(2); }

  console.log('三语完整性闸 · 验"多语原型的每条文案都真有 en/pt"（规范 §5.5）');
  console.log('───────────────────────────────────────');
  const files = target ? collect(target) : autoDiscover();
  if (!files.length) { console.log('⊘ 未找到交付原型(装配版*offline.html)，跳过'); process.exit(0); }

  let anyRed = false;
  for (const f of files) {
    const r = checkOne(f);
    if (r.skip) { console.log(`  ⊘ ${r.file} — 跳过（${r.skip}）`); continue; }
    if (r.reds.length) {
      anyRed = true;
      console.log(`  ✘ ${r.file} [locales=${r.locales.join('/')}]`);
      r.reds.forEach(x => console.log(`      · ${x}`));
    } else {
      console.log(`  ✓ ${r.file} [locales=${r.locales.join('/')}] — ${r.total} 条文案全译`);
    }
    r.warns.forEach(x => console.log(`      ⚠ ${x}`));
  }
  console.log('───────────────────────────────────────');
  if (anyRed) { console.log('三语完整性：有红 ✘ —— 多语原型有缺译/没做多语，禁交付'); process.exit(1); }
  console.log('三语完整性：全绿 ✓'); process.exit(0);
}
main();
