#!/usr/bin/env node
/**
 * choice-conformance-gate.js — 选择一致性自检闸（机器闸 / 随包发）
 *
 * 目的：画完原型后，自动验"原型是否和用户四问时选的一致"。
 *       验的是【输出 vs 原型里记录的选择 __DESIGN_CHOICE__】——防画着画着跑偏
 *       （选了 BR 却冒出 ¥、选了移动版却出了 EP 桌面栈…）。
 *
 * 真理源：原型里烙的 `window.__DESIGN_CHOICE__ = { ui, form, region, currency, timezone, uiSpec/uiRef }`
 *         （装配器按四问答案写入）。无此标记 = 旧原型 = 跳过（不误拦；新原型装配器会写）。
 *
 * 用法：node choice-conformance-gate.js <原型.html | 目录>
 * 退出码：0 全绿 / 1 有红(禁交付) / 2 用法错。
 *
 * 检查项（按声明的选择分叉；只硬拦确定性维度，模糊的只警告——宁漏报不误报）：
 *   C-MARK 选择标记：有 __DESIGN_CHOICE__ 才验；无 → 跳过（legacy）
 *   C-CUR  币种符号：currency=BRL → 不得出现 ¥（防残留 CN 币种）；CNY → 不得出现 R$
 *   C-STK  前端栈：form=移动版/小程序/app → 须 uv-ui/rpx，且不得是 EP 桌面栈(el-table)
 *                  form=b端/网站 → 须有 Element Plus
 *   C-LANG 语言：locales/defaultLocale 声明自洽 + region=BR ⇒ locales 必须含 pt
 *                （defaultLocale=zh 是合法的：PM 自己看中文、演示时切 pt。缺译由 i18n-completeness-gate 硬验）
 *   ui=default 的默认令牌(颜色/分页)由 design-token-gate 负责，本闸不重复。
 *   ui=custom 且无 learned-spec → 只验上面通用项（视觉忠实度靠人眼，闸不冒充）。
 */
'use strict';
const fs = require('fs');
const path = require('path');

// 从标记文本里按字段抽值（兼容 JSON "k":"v" 与 JS 字面量 k:'v'——key 可带引号）
function field(marker, key) {
  const m = marker.match(new RegExp("[\"']?" + key + "[\"']?\\s*:\\s*[\"']([^\"']*)[\"']", 'i'));
  return m ? m[1].trim() : '';
}
/** 从 `const NAME=` 之后括号配对提取完整 JSON 字面量原文（跳过字符串/转义） */
function grabLiteral(src, decl) {
  const i = src.indexOf(decl);
  if (i < 0) return '';
  let p = i + decl.length;
  while (p < src.length && /\s/.test(src[p])) p++;
  const open = src[p];
  if (open !== '{' && open !== '[') return '';
  const close = open === '{' ? '}' : ']';
  let depth = 0, inStr = false, esc = false;
  for (let j = p; j < src.length; j++) {
    const c = src[j];
    if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
    if (c === '"') { inStr = true; continue; }
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) return src.slice(p, j + 1); }
  }
  return '';
}

// 抽数组字段（locales:["zh","en","pt"]）
function arrField(marker, key) {
  const m = marker.match(new RegExp("[\"']?" + key + "[\"']?\\s*:\\s*\\[([^\\]]*)\\]", 'i'));
  if (!m) return [];
  return m[1].split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
}

function checkOne(file) {
  const html = fs.readFileSync(file, 'utf8');
  const base = path.basename(file);

  if (/__NOT_A_PROTOTYPE__/.test(html)) return { file: base, skip: '说明文档(非原型)' };

  const mm = html.match(/__DESIGN_CHOICE__\s*=\s*(\{[^}]*\})/);
  if (!mm) {
    /* 🏛 禁手搓闸：只有【标准装配器 / 模式2 注入】会写 __DESIGN_CHOICE__。
       没有它 = 没走标准流程 = 疑似手搓单文件（发票那种：function_points 空、标注跨页飘移、
       将来导不了研发版）。以前这里静默跳过 → 手搓一条路绕过全部机器闸，这是纵容。
       现在：带【旧原型豁免标记】的老资产放行(但每次响亮警告)；其余一律判红、禁交付。 */
    if (/__ANNO_LEGACY_GRANDFATHER__/.test(html)) {
      return { file: base, skip: '旧原型豁免(__ANNO_LEGACY_GRANDFATHER__)', loudWarn: '⚠ 手搓遗留原型：未走标准装配器、无 __DESIGN_CHOICE__，自检覆盖不到。真消债=用标准装配器重造。' };
    }
    return { file: base, reds: [
      '禁手搓：缺 __DESIGN_CHOICE__ 标记 —— 本原型未走标准装配器(模式1)/模式2 注入，疑似手搓单文件。',
      '  后果：绕过全部机器闸、function_points 易为空、标注易跨页飘移、将来【导出研发版】拿不到料。',
      '  修法：用 qa/assemble-prototype.js 重造(模式1)；或自定义外壳走 qa/inject-latest-anno-layer.js(模式2)并写入 __DESIGN_CHOICE__。',
      '  确属不可重造的历史资产 → 在原型里登记 __ANNO_LEGACY_GRANDFATHER__ 豁免标记(带原因)，本闸会放行并每次警告。'
    ], warns: [] };
  }
  const marker = mm[1];

  const ui = (field(marker, 'ui') || 'default').toLowerCase();
  const form = (field(marker, 'form') || '').toLowerCase();
  const region = (field(marker, 'region') || '').toUpperCase();
  const currency = (field(marker, 'currency') || '').toUpperCase();

  const reds = [], warns = [];
  /* 业务区 = 【标注层之前的模板区】 + 【项目数据字面量 SYSTEMS/NAV/PAGECFG】。
     标注层内置 ¥/el-* 示例模板，会污染币种/栈判定，必须排除。
     ⚠️ 2026-07-10 实测修：装配器把 @@ANNOTATION_LAYER@@ 放在项目数据 <script> 之【前】，
        原来只取 slice(0, cut) → **业务数据从来没被扫到过**（BRL 原型明明有 R$ 却报"没找到 R$"）。
        故显式把三个数据字面量拼回来。这是"闸有盲区、长期假绿"的又一例。 */
  let cut = html.length;
  for (const anchor of ['id="anno-app"', '__ANNO_LAYER_VERSION__', '标注层标准组件']) {
    const i = html.indexOf(anchor);
    if (i >= 0 && i < cut) cut = i;
  }
  /* ⚠️ 必须剥掉 <script>/<style>：离线版把 EP 压缩 JS 内联进来了，里面有个变量名就叫 `R$=`
       （"[object WeakMap]"），CN 原型会被 C-CUR 误判红。剥完再把项目数据字面量拼回来。 */
  const stripVendor = s => s.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const dataLits = ['const SYSTEMS=', 'const NAV=', 'const PAGECFG='].map(d => grabLiteral(html, d)).join('\n');
  const body = stripVendor(html.slice(0, cut)) + '\n' + dataLits;

  // C-CUR 币种符号（负向为主·可靠；只看业务区）
  if (currency === 'BRL' && /￥|(?<![A-Za-z])¥/.test(body)) reds.push('C-CUR 币种漂移：选了 BRL 却出现 ¥（残留 CN 币种？应为 R$）');
  if (currency === 'CNY' && /R\$/.test(body)) reds.push('C-CUR 币种漂移：选了 CNY 却出现 R$（残留 BR 币种？应为 ¥）');
  if (currency === 'BRL' && !/R\$|BRL/.test(body)) warns.push('C-CUR：选了 BRL 但业务区没找到 R$/BRL（确认金额展示币种）');

  // C-STK 前端栈（业务区判定）
  const isMobileForm = /(移动|mobile|小程序|app|pda|h5)/i.test(form);
  const hasUv = /uv-navbar|uv-list|uv-ui|uni\.\$uv|\brpx\b/i.test(body);
  const hasEP = /element-plus|ElementPlus|<el-/i.test(body);
  if (isMobileForm) {
    if (!hasUv) reds.push(`C-STK 前端栈错：form=${form}(移动版) 应为 uv-ui/rpx，却没找到 uv-* / rpx`);
    if (/<el-table/i.test(body)) reds.push(`C-STK 前端栈错：form=${form}(移动版) 里出现 EP 桌面组件 el-table（移动版应走 uv-ui）`);
  } else if (form) {
    if (!hasEP) warns.push(`C-STK：form=${form}(桌面/网站) 业务区没找到 Element Plus（确认前端栈）`);
  }

  // C-LANG 语言（规范 §5.5：locales/defaultLocale 是唯一真理源）
  // 注意：多语原型 defaultLocale 可以是 zh（PM 自己看中文、演示时切 pt），
  //       所以【不能】因为"默认不是 pt"就判红——只验声明自洽 + BR 必须能切 pt。
  const locales = arrField(marker, 'locales');
  const defaultLocale = field(marker, 'defaultLocale');
  if (locales.length) {
    if (defaultLocale && !locales.includes(defaultLocale))
      reds.push(`C-LANG 声明不自洽：defaultLocale=${defaultLocale} 不在 locales=[${locales.join(',')}] 里`);
    if (locales.length > 1) {
      // 多语原型：BR 版必须真的能切到葡语，否则"多语"名不副实
      if (region === 'BR' && !locales.includes('pt'))
        reds.push(`C-LANG 语言错：多语 BR 原型 locales=[${locales.join(',')}] 不含 pt（巴西版必须能切葡语）`);
      warns.push(`C-LANG：多语原型 [${locales.join('/')}]，缺译由 i18n-completeness-gate 硬验`);
    } else if (region === 'BR') {
      // 单语原型不判红：多语是【用户四问时的选择】，不是所有 BR 原型的强制项。
      // 用新规则去追溯判红旧的合法单语产物 = 误报（宁漏报不误报）。
      warns.push('C-LANG：region=BR 但这是单语原型（locales=[zh]）。要演示给巴西客户须重装配为 ["zh","en","pt"]。');
    }
  } else if (region === 'BR') {
    warns.push('C-LANG：region=BR，未找到 locales 声明（旧装配器产物），语言一致性只能人工确认（不硬拦）');
  }

  return { file: base, ui, form, region, currency, reds, warns };
}

function collect(target) {
  const st = fs.statSync(target);
  if (st.isFile()) return [target];
  const out = [];
  for (const f of fs.readdirSync(target))
    if (/^原型.*\.html$/i.test(f) && !/分享版|share|\.bak|backup|备份/i.test(f)) out.push(path.join(target, f));
  return out;
}

// 无参时自动发现 archive 里的真装配版 offline 原型（与 design-token-gate / 真机冒烟闸同源）
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

  console.log('选择一致性自检闸 · 验"原型 == 四问所选(__DESIGN_CHOICE__)"');
  console.log('───────────────────────────────────────');
  const files = target ? collect(target) : autoDiscover();
  if (!files.length) { console.log('⊘ 未找到交付原型(装配版*offline.html)，跳过'); process.exit(0); }

  let anyRed = false;
  for (const f of files) {
    const r = checkOne(f);
    if (r.skip) {
      console.log(`  ⊘ ${r.file} — 跳过（${r.skip}）`);
      if (r.loudWarn) console.log(`      ${r.loudWarn}`);
      continue;
    }
    const tag = r.ui ? `[ui=${r.ui} form=${r.form||'-'} region=${r.region||'-'} ${r.currency||'-'}]` : '';
    if (r.reds.length) {
      anyRed = true;
      console.log(`  ✘ ${r.file} ${tag}`);
      r.reds.forEach(x => console.log(`      · ${x}`));
    } else {
      console.log(`  ✓ ${r.file} ${tag} — 与所选一致`);
    }
    r.warns.forEach(x => console.log(`      ⚠ ${x}`));
  }
  console.log('───────────────────────────────────────');
  if (anyRed) { console.log('选择一致性自检：有红 ✘ —— 原型偏离了你四问所选，禁交付'); process.exit(1); }
  console.log('选择一致性自检：全绿 ✓'); process.exit(0);
}
main();
