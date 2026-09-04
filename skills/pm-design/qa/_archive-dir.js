'use strict';
/* ════════════════════════════════════════════════════════════════════════
   archive 目录解析（零个人痕迹·公开仓安全）· _archive-dir.js
   ────────────────────────────────────────────────────────────────────────
   替代各闸里曾写死的个人机器路径 → 改为 env 变量 + 相对仓库解析（公开仓无个人痕迹）。
   解析顺序：① 环境变量 ANNO_ARCHIVE_DIR ② 相对仓库的约定位置 ③ 当前目录/archive。
   约定：archive 与 ai-rules 同级（<父>/ai-rules + <父>/archive），或在仓库内 <repo>/archive。
   扫描目录另可用 PROTO_DIRS（分号分隔）覆盖，供维护者指向自己的原型目录。
   ════════════════════════════════════════════════════════════════════════ */
const path = require('path');
const fs = require('fs');

function archiveDirs() {
  const cands = [
    process.env.ANNO_ARCHIVE_DIR,
    path.resolve(__dirname, '..', '..', '..', '..', 'archive'), // <父>/archive（archive 与 ai-rules 同级·默认约定）
    path.resolve(__dirname, '..', '..', '..', 'archive'),       // <repo>/archive（archive 在仓库内）
    path.resolve(process.cwd(), 'archive'),
  ].filter(Boolean);
  return [...new Set(cands.map(d => path.normalize(d)))];
}

function existingArchiveDir() {
  return archiveDirs().find(d => { try { return fs.existsSync(d); } catch (e) { return false; } }) || archiveDirs()[0];
}

/* 扫描目录：PROTO_DIRS（维护者自定义·分号分隔）优先，否则用解析出的 archive 目录 */
function protoScanDirs() {
  if (process.env.PROTO_DIRS) return process.env.PROTO_DIRS.split(';').map(s => s.trim()).filter(Boolean);
  return archiveDirs();
}

module.exports = { archiveDirs, existingArchiveDir, protoScanDirs };
