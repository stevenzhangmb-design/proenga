#!/usr/bin/env node
/**
 * design-token-gate.js — 设计令牌对照闸（机器闸 / 随包发）
 *
 * 目的：画完原型后，自动比对原型里的关键设计令牌是否 == system-design-spec.md 的值，
 *       不符就红。把"符合设计规范"从"结构级"升到"数值级"。
 *       期望值【从 system-design-spec.md 现场解析】——闸不写死，规范改了闸自动跟（单一真理源）。
 *
 * 用法：
 *   node design-token-gate.js <原型.html>        # 检查单个文件
 *   node design-token-gate.js ./archive          # 检查目录下所有 原型*.html
 *
 * 退出码：0 = 全绿（合规）；1 = 有红（不符，禁交付）；2 = 用法/读取错误。
 *
 * 豁免（跳过·不误拦）：
 *   · 含 __NOT_A_PROTOTYPE__（说明文档网页）
 *   · 分享版 / .bak / backup / 备份
 *   · 含 __DESIGN_SPEC_CUSTOM__（用户选了"提供参考/不用默认"——按用户素材落地，不强制默认令牌）
 *
 * 检查项（仅对"默认规范"原型；条件项按组件存在与否触发）：
 *   T1 主色     — 原型不得把 --el-color-primary 设成 ≠ 规范主色；且规范主色须出现（防 EP 默认 #409EFF 漂移）
 *   T2 警告色   — 原型不得把 --el-color-warning 设成 ≠ 规范警告色（防 EP 默认 #E6A23C 漂移）
 *   T3 分页     — 若有 el-pagination：page-sizes 与 layout 必须 == 规范值
 *   T4 筛选区   — 若有筛选区网格（form-grid/search）：须是规范的 3 列 repeat(3, 1fr)
 */
'use strict';
const fs = require('fs');
const path = require('path');

// ---------- 定位规范文件 ----------
const SPEC = path.join(__dirname, '..', 'system-design-spec.md');
function readSpec() {
  try { return fs.readFileSync(SPEC, 'utf8'); }
  catch (_) { console.error('✘ 读不到 system-design-spec.md：' + SPEC); process.exit(2); }
}

// ---------- 从规范解析期望值（单一真理源） ----------
function parseExpected(spec) {
  const exp = {};
  // 主色：--el-color-primary: #3363ff
  let m = spec.match(/--el-color-primary:\s*(#[0-9a-fA-F]{6})/);
  exp.primary = m ? m[1].toLowerCase() : null;
  // 警告色：--el-color-warning: #f2ac3a
  m = spec.match(/--el-color-warning:\s*(#[0-9a-fA-F]{6})/);
  exp.warning = m ? m[1].toLowerCase() : null;
  // 分页 page-sizes：:page-sizes="[10, 25, 50, 100]"
  m = spec.match(/:page-sizes="(\[[^\]]+\])"/);
  exp.pageSizes = m ? m[1].replace(/\s+/g, '') : null;   // 归一化去空格
  // 分页 layout：layout="total, sizes, prev, pager, next, jumper"
  m = spec.match(/layout="(total[^"]*jumper)"/);
  exp.pageLayout = m ? m[1].replace(/\s+/g, '') : null;
  // 筛选区 3 列：grid-template-columns: repeat(3, 1fr)
  exp.filterCols = /repeat\(3,\s*1fr\)/.test(spec) ? 3 : null;
  return exp;
}

// ---------- 归一化 HEX 比较 ----------
const hexEq = (a, b) => a && b && a.toLowerCase() === b.toLowerCase();

// ---------- 检查单个原型 ----------
function checkOne(file, exp) {
  const html = fs.readFileSync(file, 'utf8');
  const base = path.basename(file);

  // 豁免
  if (/__NOT_A_PROTOTYPE__/.test(html)) return { file: base, skip: '说明文档(非原型)' };
  if (/__DESIGN_SPEC_CUSTOM__/.test(html)) return { file: base, skip: '自定义设计规范(非默认·不强制默认令牌)' };

  const reds = [];

  // 取"生效值"= 文档里最后一个赋值（同为 :root 时层叠赢家在后；避免误读 EP 打包默认那一个）
  const effective = (re) => {
    const all = [...html.matchAll(re)];
    return all.length ? all[all.length - 1][1].toLowerCase() : null;
  };

  // T1 主色 —— 生效的 --el-color-primary 必须 == 规范值（防停在 EP 默认 #409EFF）
  if (exp.primary) {
    const got = effective(/--el-color-primary:\s*(#[0-9a-fA-F]{3,8})/gi);
    if (!got) reds.push(`T1 主色未设置：原型没有 --el-color-primary（规范要求 ${exp.primary}）`);
    else if (!hexEq(got, exp.primary)) reds.push(`T1 主色错：原型生效主色 ${got}，规范要求 ${exp.primary}（若停在 EP 默认 #409eff = 没套上 TF 主题）`);
  }

  // T2 警告色 —— 生效的 --el-color-warning 必须 == 规范值（防 EP 默认 #E6A23C）
  if (exp.warning) {
    const got = effective(/--el-color-warning:\s*(#[0-9a-fA-F]{3,8})/gi);
    if (got && !hexEq(got, exp.warning)) reds.push(`T2 警告色错：原型生效警告色 ${got}，规范要求 ${exp.warning}（EP 默认 #E6A23C 是错的）`);
  }

  // T3 分页 —— 若真用了 <el-pagination 组件（非 .el-pagination CSS 类），page-sizes 与 layout 必须对
  const hasPagination = /<el-pagination/i.test(html);
  if (hasPagination) {
    if (exp.pageSizes) {
      const pms = html.match(/:page-sizes="(\[[^\]]+\])"/);
      const got = pms ? pms[1].replace(/\s+/g, '') : null;
      if (!got) reds.push('T3 分页缺：有 el-pagination 但没设 :page-sizes（规范要 ' + exp.pageSizes + '）');
      else if (got !== exp.pageSizes) reds.push(`T3 分页 page-sizes 错：原型 ${got}，规范 ${exp.pageSizes}`);
    }
    if (exp.pageLayout) {
      const plm = html.match(/layout="(total[^"]*jumper)"/);
      const got = plm ? plm[1].replace(/\s+/g, '') : null;
      if (!got) reds.push('T3 分页缺：有 el-pagination 但 layout 不是规范串（规范要 "' + exp.pageLayout + '"）');
      else if (got !== exp.pageLayout) reds.push(`T3 分页 layout 错：原型 "${got}"，规范 "${exp.pageLayout}"`);
    }
  }

  // T4 筛选区列数（3 列）—— v1 暂不硬拦：正则分不清哪个 repeat() 是筛选区网格（易误报），
  //   留待后续用 DOM 分析实现（识别 .search-box/.filter 容器内的 grid 列数）。此处不做判定。

  return { file: base, reds };
}

// ---------- 收集目标文件 ----------
function collect(target) {
  const st = fs.statSync(target);
  if (st.isFile()) return [target];
  const out = [];
  for (const f of fs.readdirSync(target)) {
    if (/^原型.*\.html$/i.test(f) && !/分享版|share|\.bak|backup|备份/i.test(f)) out.push(path.join(target, f));
  }
  return out;
}

// ---------- 无参时自动发现 archive 里的真实交付原型(装配版 offline)，与真机冒烟闸同源 ----------
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
    if (out.length) break;  // 第一个命中的 archive 目录为准
  }
  return [...new Set(out)];
}

// ---------- 主流程 ----------
function main() {
  const target = process.argv[2];
  if (target && !fs.existsSync(target)) { console.error('✘ 目标不存在：' + target); process.exit(2); }

  const exp = parseExpected(readSpec());
  console.log('设计令牌对照闸 · 期望值(源自 system-design-spec.md)：');
  console.log(`  主色=${exp.primary} 警告=${exp.warning} 分页sizes=${exp.pageSizes} 分页layout="${exp.pageLayout}"（筛选区3列 v1暂不硬拦）`);
  console.log('───────────────────────────────────────');

  const files = target ? collect(target) : autoDiscover();
  if (!files.length) { console.log('⊘ 未找到交付原型(装配版*offline.html)，跳过'); process.exit(0); }

  let anyRed = false;
  for (const f of files) {
    const r = checkOne(f, exp);
    if (r.skip) { console.log(`  ⊘ ${r.file} — 跳过（${r.skip}）`); continue; }
    if (r.reds.length) {
      anyRed = true;
      console.log(`  ✘ ${r.file}`);
      r.reds.forEach(x => console.log(`      · ${x}`));
    } else {
      console.log(`  ✓ ${r.file} — 令牌合规`);
    }
  }
  console.log('───────────────────────────────────────');
  if (anyRed) { console.log('设计令牌对照闸：有红 ✘ —— 禁交付（改回规范值再来）'); process.exit(1); }
  console.log('设计令牌对照闸：全绿 ✓'); process.exit(0);
}
main();
