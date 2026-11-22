/* ════════════════════════════════════════════════════════════════════════
   _find-paired-prd.js — 给原型找配对的 PRD（字段一致性检查、交付件自检共用）· 2026-11-20
   ────────────────────────────────────────────────────────────────────────
   找的顺序（找到就停）：
     ① project-data 顶层写了 "_prd": "<PRD 的 .md 或 prd-data.json 路径>"（相对 project-data 所在目录，或绝对路径；
        也可以写成数组，取第一个存在的）。写了但文件不存在 = 明确报错，不往下猜。
     ② 原型或 project-data 同目录：system_name 一致的 prd-data.json → 文件名含系统名的 PRD*.md → 目录里只有一份 PRD*.md。
     ③ 按项目名模糊匹配：在原型、project-data 所在目录及往上两级目录里，找名字带 PRD 的子目录（和这些目录本身），
        PRD 的 .md 文件名去掉标点、日期、“修订版/正式版/草稿”等字后，和项目名（project-data 文件名、交付件文件名、
        systemName、title 同样处理后）互相包含就算配上；配上多份取最新修改的那份。
   找不到返回 null，调用方必须明确提示“未检查（不算通过）”，不能悄悄算通过。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');

function readHead(file) { try { return fs.readFileSync(file, 'utf8'); } catch (_) { return ''; } }
// 只取顶层简单字符串值（project-data 可能几十 MB，不整份 JSON.parse）
function topStr(text, key) {
  const re = new RegExp('"' + key + '"\\s*:\\s*("(?:[^"\\\\]|\\\\.)*"|\\[[^\\]]*\\])');
  const m = re.exec(text); if (!m) return null;
  try { return JSON.parse(m[1]); } catch (_) { return null; }
}
const protoSys = f => { const m = readHead(f).match(/"system_name"\s*:\s*"((?:[^"\\]|\\.)*)"/); return m ? m[1] : ''; };
const keyOf = s => String(s || '')
  .replace(/\.(md|json|html?)$/i, '').replace(/-?project-data$/i, '').replace(/-?offline$/i, '')
  .replace(/\d{4}[-.年／/]?\d{1,2}[-.月／/]?\d{1,2}日?/g, '')
  .replace(/修订版|正式版|草稿|装配版|分享版|只读版|原型|^PRD-?/g, '')
  .replace(/[\s\-_—–:：／/\\·,，.。()（）【】\[\]]+/g, '').toLowerCase();

function listMd(dir) {
  try { return fs.readdirSync(dir).filter(f => /\.md$/i.test(f) && !/^~\$/.test(f)).map(f => path.join(dir, f)); } catch (_) { return []; }
}
function newest(files) { return files.map(f => ({ f, t: (() => { try { return fs.statSync(f).mtimeMs; } catch (_) { return 0; } })() })).sort((a, b) => b.t - a.t)[0].f; }

function findPairedPrd({ proto, projectData } = {}) {
  const sys = proto ? protoSys(proto) : '';
  // ① project-data 的 _prd
  if (projectData && fs.existsSync(projectData)) {
    let v = topStr(readHead(projectData), '_prd');
    if (v != null) {
      const list = (Array.isArray(v) ? v : [v]).filter(Boolean).map(p => path.isAbsolute(p) ? p : path.resolve(path.dirname(projectData), p));
      const hit = list.find(p => fs.existsSync(p));
      if (hit) return { file: hit, how: 'project-data 的 _prd' };
      return { file: null, how: 'project-data 的 _prd', error: 'project-data 里 _prd 写的 PRD 不存在：' + list.join('；') };
    }
  }
  const dirs = [...new Set([proto && path.dirname(proto), projectData && path.dirname(projectData)].filter(Boolean))];
  // ② 同目录
  for (const d of dirs) {
    const pj = path.join(d, 'prd-data.json');
    if (fs.existsSync(pj)) { try { const p = JSON.parse(fs.readFileSync(pj, 'utf8').replace(/^﻿/, '')); if (!sys || p.system_name === sys) return { file: pj, how: '同目录 prd-data.json' }; } catch (_) {} }
    const mds = listMd(d).filter(f => /^PRD/i.test(path.basename(f)));
    const byName = sys ? mds.filter(f => path.basename(f).includes(sys)) : [];
    if (byName.length) return { file: newest(byName), how: '同目录 PRD（文件名含系统名）' };
    if (mds.length === 1) return { file: mds[0], how: '同目录唯一一份 PRD' };
  }
  // ③ 按项目名模糊匹配
  const keys = new Set();
  if (projectData) {
    keys.add(keyOf(path.basename(projectData)));
    const t = readHead(projectData);
    for (const k of ['systemName', 'title', '_deliverable']) { const v = topStr(t, k); if (typeof v === 'string') keys.add(keyOf(path.basename(v))); }
  }
  if (proto) keys.add(keyOf(path.basename(proto)));
  if (sys) keys.add(keyOf(sys));
  const ks = [...keys].filter(k => k.length >= 4);
  if (!ks.length) return null;
  const searchDirs = new Set();
  for (const d of dirs) {
    let cur = d;
    for (let up = 0; up <= 2; up++) {
      searchDirs.add(cur);
      try { for (const e of fs.readdirSync(cur, { withFileTypes: true })) if (e.isDirectory() && /prd/i.test(e.name)) searchDirs.add(path.join(cur, e.name)); } catch (_) {}
      const par = path.dirname(cur); if (par === cur) break; cur = par;
    }
  }
  const cands = [];
  for (const d of searchDirs) for (const f of listMd(d)) {
    const k = keyOf(path.basename(f)); if (k.length < 4) continue;
    if (ks.some(x => x.includes(k) || k.includes(x))) cands.push(f);
  }
  if (cands.length) return { file: newest([...new Set(cands)]), how: '按项目名在上级目录模糊匹配' };
  return null;
}
module.exports = { findPairedPrd };
