/* 通用闸环境探测 · _gate-env.js · 让全套闸自动适配任何项目，不绑死示例(充值管理) */
const fs = require('fs'), path = require('path'), os = require('os'), { execSync } = require('child_process');
function findArchive() {
  const cands = [process.env.ARCHIVE_DIR, path.join(__dirname, '..', '..', '..', '..', 'archive'), path.join(process.cwd(), 'archive'), path.join(__dirname, '..', '..', '..', 'archive')];
  for (const c of cands) { if (c && fs.existsSync(c)) return c; }
  return cands[1];
}
function findChrome() {
  if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
  const home = os.homedir();
  const cands = process.platform === 'win32' ? [
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    path.join(home, 'AppData/Local/Google/Chrome/Application/chrome.exe'),
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  ] : process.platform === 'darwin' ? [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
  ] : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium-browser', '/usr/bin/chromium', '/usr/bin/microsoft-edge', '/snap/bin/chromium'];
  for (const c of cands) { if (fs.existsSync(c)) return c; }
  try { const cmd = process.platform === 'win32' ? 'where chrome' : 'command -v google-chrome chromium chromium-browser microsoft-edge'; const out = execSync(cmd, { stdio: 'pipe' }).toString().trim().split(/\r?\n/)[0]; if (out && fs.existsSync(out)) return out; } catch (e) {}
  return null;
}
function findPrototypes(archive) {
  archive = archive || findArchive();
  let files = [];
  try { files = fs.readdirSync(archive).filter(f => f.endsWith('.html') && !/备份|\.bak|backup|试跑|草稿|draft|demo|proto-test|分享版|share/i.test(f)).map(f => path.join(archive, f)); } catch (e) {}
  return files.filter(f => { try { const s = fs.readFileSync(f, 'utf8'); return s.includes('window.__PRD_DATA__') && s.includes('anno-app'); } catch (e) { return false; } });
}
// TARGET_PRDDATA 可显式指定 prd-data.json（多工程/异构时把闸指向某个具体工程，不依赖自动猜）
function findPrdData(archive) {
  if (process.env.TARGET_PRDDATA && fs.existsSync(process.env.TARGET_PRDDATA)) return process.env.TARGET_PRDDATA;
  archive = archive || findArchive(); const p = path.join(archive, 'prd-data.json'); return fs.existsSync(p) ? p : null;
}
// 通用化：闸目标(原型/prd-data/PRD.md)均可用环境变量显式覆盖，让维护者把任意闸指向任意工程。
// TARGET_HTML / TARGET_PRDDATA / TARGET_PRDMD 任一未给则回退自动探测(按 system_name 匹配)。
function primaryTarget() {
  const archive = findArchive();
  const envHtml = process.env.TARGET_HTML && fs.existsSync(process.env.TARGET_HTML) ? process.env.TARGET_HTML : null;
  const envMd   = process.env.TARGET_PRDMD && fs.existsSync(process.env.TARGET_PRDMD) ? process.env.TARGET_PRDMD : null;
  const prdData = findPrdData(archive);
  let sysName = '';
  if (prdData) { try { sysName = (JSON.parse(fs.readFileSync(prdData, 'utf8').replace(/^﻿/, '')).system_name) || ''; } catch (e) {} }
  const protos = findPrototypes(archive);
  const match = (f) => { if (!sysName) return true; try { return fs.readFileSync(f, 'utf8').includes(sysName); } catch (e) { return false; } };
  let prototype = envHtml || protos.find(f => /offline/i.test(f) && match(f)) || protos.find(f => /offline/i.test(f)) || protos.find(match) || protos[0] || null;
  let mdFiles = []; try { mdFiles = fs.readdirSync(archive).filter(f => /^PRD-.*\.md$/.test(f)); } catch (e) {}
  const tail = sysName ? sysName.split(/[·\/]/).pop().trim() : '';
  let md = mdFiles.find(f => tail && f.includes(tail)) || mdFiles[0] || null;
  return { archive, prdData, prototype, prdMd: envMd || (md ? path.join(archive, md) : null), sysName };
}
const ANNOTATION_LAYER = path.join(__dirname, '..', 'components', 'annotation-layer.html');
const REFERENCE_PROTOTYPE = path.join(__dirname, 'fixtures', 'reference-prototype.html');
module.exports = { findArchive, findChrome, findPrototypes, findPrdData, primaryTarget, ANNOTATION_LAYER, REFERENCE_PROTOTYPE };
